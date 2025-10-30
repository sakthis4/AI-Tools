import { GoogleGenAI, Type } from '@google/genai';
import { ExtractedAsset, AssetType } from '../types';

// Schema for assets found on a single page
const PAGE_METADATA_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      assetId: { type: Type.STRING, description: 'A unique identifier for the asset, e.g., "Figure 1.1", "Table 2".' },
      assetType: {
        type: Type.STRING,
        enum: ['Figure', 'Table', 'Image', 'Equation', 'Map', 'Graph'],
        description: 'The type of the asset.',
      },
      preview: {
        type: Type.STRING,
        description: 'A brief, one-sentence textual description or the content of the asset.',
      },
      altText: {
        type: Type.STRING,
        description: 'A detailed, context-aware alternative text for accessibility purposes.',
      },
      keywords: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'A list of 3-5 relevant keywords for the asset.',
      },
      taxonomy: {
        type: Type.STRING,
        description: 'A hierarchical classification for the asset, e.g., "Graph -> Time-series".',
      },
      boundingBox: {
        type: Type.OBJECT,
        description: 'The bounding box of the asset on its page. All values are percentages (0-100).',
        properties: {
            x: { type: Type.NUMBER },
            y: { type: Type.NUMBER },
            width: { type: Type.NUMBER },
            height: { type: Type.NUMBER },
        },
        required: ['x', 'y', 'width', 'height'],
      },
    },
    required: ['assetId', 'assetType', 'preview', 'altText', 'keywords', 'taxonomy', 'boundingBox'],
  },
};


const SINGLE_ASSET_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    assetId: { type: Type.STRING, description: 'A suggested unique identifier for the asset, e.g., "Figure X", "Table Y".' },
    assetType: {
      type: Type.STRING,
      enum: ['Figure', 'Table', 'Image', 'Equation', 'Map', 'Graph'],
      description: 'The type of the asset.',
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
  required: ['assetId', 'assetType', 'preview', 'altText', 'keywords', 'taxonomy'],
};

/**
 * Processes a single page image from a PDF to extract metadata for all assets on that page.
 * @param pageImageBase64 - Base64 encoded string of the page image (JPEG format).
 * @returns A promise that resolves to an array of extracted assets for that page.
 */
export async function extractAssetsFromPage(pageImageBase64: string): Promise<Omit<ExtractedAsset, 'id' | 'pageNumber'>[]> {
    if (!process.env.API_KEY) {
        console.warn("API_KEY environment variable not set. Returning mock data.");
        // Simulate processing delay and return mock data for a page
        return new Promise(resolve => setTimeout(() => {
            const hasAsset = Math.random() > 0.3; // 70% chance of finding an asset
            if (hasAsset) {
                resolve([
                    {
                        assetId: `Mock Asset ${Math.floor(Math.random() * 100)}`,
                        assetType: AssetType.Graph,
                        preview: "A mock chart generated for demonstration.",
                        altText: "This is a longer mock alternative text for a chart showing placeholder data.",
                        keywords: ["mock", "demo", "chart"],
                        taxonomy: "Mock -> Chart",
                        boundingBox: { 
                            x: 10 + Math.random() * 20, 
                            y: 15 + Math.random() * 30, 
                            width: 50 + Math.random() * 20, 
                            height: 30 + Math.random() * 10 
                        }
                    }
                ]);
            } else {
                resolve([]);
            }
        }, 800 + Math.random() * 500));
    }
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const imagePart = { inlineData: { data: pageImageBase64, mimeType: 'image/jpeg' } };
    const textPart = { text: "Analyze the provided image, which is a single page from a document. Find ALL assets (figures, tables, images, equations, maps, and graphs) on this page. For each asset, extract its metadata according to the schema. If no assets are found, return an empty array." };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts: [imagePart, textPart] }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: PAGE_METADATA_SCHEMA,
            },
        });
        
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error calling Gemini API for page processing:", error);
        throw new Error("Failed to process page with Gemini API.");
    }
}


export async function generateMetadataForSelection(imageDataUrl: string): Promise<Omit<ExtractedAsset, 'id' | 'pageNumber' | 'boundingBox'>> {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY not set.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const imageData = imageDataUrl.split(',')[1];

  const imagePart = {
    inlineData: {
      data: imageData,
      mimeType: 'image/png'
    }
  };
  
  const textPart = {
    text: 'Analyze the provided image, which is a cropped asset from a document. Generate metadata for it according to the schema.'
  };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts: [imagePart, textPart] },
    config: {
      responseMimeType: 'application/json',
      responseSchema: SINGLE_ASSET_SCHEMA,
    },
  });

  const jsonText = response.text.trim();
  return JSON.parse(jsonText);
}