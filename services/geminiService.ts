
import { GoogleGenAI, Type } from '@google/genai';
import { ExtractedAsset, AssetType } from '../types';
import * as mammoth from 'mammoth';

interface ExtractMetadataParams {
  file?: File | null;
  url?: string;
}

const METADATA_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      assetId: { type: Type.STRING, description: 'A unique identifier for the asset, e.g., "Figure 1.1", "Table 2", "Equation 3".' },
      assetType: {
        type: Type.STRING,
        enum: ['Figure', 'Table', 'Image', 'Equation', 'Map', 'Graph'],
        description: 'The type of the asset.',
      },
      pageNumber: {
        type: Type.NUMBER,
        description: 'The page number where the asset is located in the document. For Word documents where pagination is uncertain, estimate or use 0.',
      },
      preview: {
        type: Type.STRING,
        description: 'A brief, one-sentence textual description or the content of the asset (e.g., the equation itself). This will be used as a preview.',
      },
      altText: {
        type: Type.STRING,
        description: 'A detailed, context-aware alternative text for accessibility purposes, fully describing the asset.',
      },
      keywords: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'A list of 3-5 relevant keywords for the asset.',
      },
      taxonomy: {
        type: Type.STRING,
        description: 'A hierarchical classification for the asset, e.g., "Graph -> Time-series", "Image -> Photographic".',
      },
    },
    required: ['assetId', 'assetType', 'pageNumber', 'preview', 'altText', 'keywords', 'taxonomy'],
  },
};

export async function extractMetadataFromDocument({ file, url }: ExtractMetadataParams): Promise<ExtractedAsset[]> {
    if (!process.env.API_KEY) {
        console.warn("API_KEY environment variable not set. Returning mock data.");
        return new Promise(resolve => setTimeout(() => resolve(MOCK_METADATA), 2000));
    }
    
    if (file) {
        const isDocx = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        if (isDocx) {
            return processWordDocument(file);
        } else { // Assume PDF or other standard type
            const fileContent = await fileToArrayBuffer(file).then(buffer => btoa(String.fromCharCode(...new Uint8Array(buffer))));
            return processStandardDocument({ fileContent, mimeType: file.type, url });
        }
    } else if (url) {
        return processStandardDocument({ url });
    }
    
    throw new Error("No file or URL provided for processing.");
}

const fileToArrayBuffer = (file: File): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = (error) => reject(error);
  });

async function processWordDocument(file: File): Promise<ExtractedAsset[]> {
    const arrayBuffer = await fileToArrayBuffer(file);
    
    const { value: text } = await mammoth.extractRawText({ arrayBuffer });
    
    const images: { data: string, mimeType: string }[] = [];
    const options = {
        convertImage: mammoth.images.imgElement(function(image) {
            return image.read("base64").then(function(imageBuffer) {
                images.push({ data: imageBuffer, mimeType: image.contentType });
                return { src: '' }; // src is not used
            });
        })
    };
    await mammoth.convertToHtml({ arrayBuffer }, options);

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const parts = [];
    parts.push({
        text: `Analyze the provided document content extracted from a Word (.docx) file. The raw text is: "${text}". The document also contains ${images.length} images, which are provided as subsequent parts. Your task is to find ALL figures, tables (from the text), images, equations, maps, and graphs. For each asset found, extract its metadata completely and accurately. Ensure 100% coverage. Match images to their context in the text for accurate metadata. Provide an approximate page number if possible, otherwise use 0.`
    });

    for (const image of images) {
        parts.push({
            inlineData: {
                data: image.data,
                mimeType: image.mimeType
            }
        });
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: METADATA_SCHEMA,
            },
        });
        
        const jsonText = response.text.trim();
        return JSON.parse(jsonText) as ExtractedAsset[];
    } catch (error) {
        console.error("Error calling Gemini API for Word document:", error);
        throw error;
    }
}

async function processStandardDocument({ fileContent, mimeType, url }: { fileContent?: string; mimeType?: string; url?: string; }): Promise<ExtractedAsset[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const parts = [];
    if (fileContent && mimeType) {
        parts.push({
            inlineData: {
                data: fileContent,
                mimeType: mimeType,
            },
        });
    }

    parts.push({
        text: `Analyze the provided document. Your task is to find ALL figures, tables, images, equations, maps, and graphs. For each asset found, extract its metadata completely and accurately. Ensure 100% coverage of all assets in the document. Provide the page number for each asset. If a URL is provided, analyze the document at that URL: ${url || ''}`,
    });

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts: parts }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: METADATA_SCHEMA,
            },
        });
        
        const jsonText = response.text.trim();
        return JSON.parse(jsonText) as ExtractedAsset[];
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw error;
    }
}

const MOCK_METADATA: ExtractedAsset[] = [
  {
    id: 'mock1',
    assetId: "Figure 1",
    assetType: AssetType.Graph,
    pageNumber: 2,
    preview: "Bar chart showing quarterly sales.",
    altText: "A bar chart displaying the company's sales figures for the four quarters of fiscal year 2023. Q1 had $1.2M, Q2 had $1.5M, Q3 showed a peak at $2.1M, and Q4 dropped slightly to $1.8M.",
    keywords: ["sales", "quarterly report", "finance", "bar chart"],
    taxonomy: "Graph -> Bar Chart"
  },
  {
    id: 'mock2',
    assetId: "Table 1",
    assetType: AssetType.Table,
    pageNumber: 3,
    preview: "Table of user growth metrics.",
    altText: "A table with four columns: 'Month', 'New Users', 'Returning Users', and 'Churn Rate'. Data is shown for January, February, and March 2023.",
    keywords: ["user metrics", "growth", "churn"],
    taxonomy: "Table -> Data Table"
  },
  {
    id: 'mock3',
    assetId: "Equation 1",
    assetType: AssetType.Equation,
    pageNumber: 5,
    preview: "E = mc^2",
    altText: "Einstein's mass-energy equivalence formula: E equals m times c squared, where E is energy, m is mass, and c is the speed of light.",
    keywords: ["physics", "relativity", "einstein"],
    taxonomy: "Equation -> Physics"
  },
   {
    id: 'mock4',
    assetId: "Image 1",
    assetType: AssetType.Image,
    pageNumber: 7,
    preview: "Photograph of a modern office space.",
    altText: "A wide-angle photograph of a bright, modern open-plan office. Large windows let in natural light, and employees are working collaboratively at shared desks.",
    keywords: ["office", "workplace", "collaboration"],
    taxonomy: "Image -> Photographic"
  }
];