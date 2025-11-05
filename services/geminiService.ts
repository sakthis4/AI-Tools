import { GoogleGenAI, Type } from '@google/genai';
import { ExtractedAsset, AssetType, ComplianceFinding } from '../types';

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
        description: 'A hierarchical classification for the asset, following the IPTC Media Topics standard. For example: "sport > association football (soccer)".',
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
      description: 'A hierarchical classification for the asset, following the IPTC Media Topics standard. For example: "sport > association football (soccer)".',
    },
  },
  required: ['assetId', 'assetType', 'preview', 'altText', 'keywords', 'taxonomy'],
};


const IFA_COMPLIANCE_SCHEMA = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            checkCategory: { type: Type.STRING, description: 'The category of the compliance check, e.g., "Title Format", "Author Affiliations", "Funding Statement", "Conflict of Interest Disclosure".' },
            status: { type: Type.STRING, enum: ['pass', 'fail', 'warn'], description: 'The compliance status for this specific check. Use "pass" if compliant, "fail" for clear violations, and "warn" for ambiguities or potential issues.' },
            summary: { type: Type.STRING, description: 'A concise one-sentence summary of the finding.' },
            manuscriptQuote: { type: Type.STRING, description: 'The exact, brief quote from the manuscript that is relevant to the finding. If no specific quote applies (e.g., something is missing), state that clearly.' },
            manuscriptPage: { type: Type.NUMBER, description: 'The page number in the manuscript where the quote is found or where the issue occurs.' },
            ifaRule: { type: Type.STRING, description: 'The exact rule or guideline quoted from the IFA document that is being checked against.' },
            ifaPage: { type: Type.NUMBER, description: 'The page number in the IFA document where the rule is found.' },
            recommendation: { type: Type.STRING, description: 'A detailed, actionable recommendation on how to address the issue to become compliant.' }
        },
        required: ['checkCategory', 'status', 'summary', 'manuscriptQuote', 'manuscriptPage', 'ifaRule', 'ifaPage', 'recommendation']
    }
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
    const textPart = { text: "Analyze the provided image, which is a single page from a document. Find ALL assets (figures, tables, images, equations, maps, and graphs) on this page. For each asset, extract its metadata according to the schema. For the taxonomy field, use the IPTC Media Topics standard to create a hierarchical classification. If no assets are found, return an empty array." };

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


export async function generateMetadataForCroppedImage(imageDataUrl: string): Promise<Omit<ExtractedAsset, 'id' | 'pageNumber' | 'boundingBox'>> {
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
    text: 'Analyze the provided image, which is a cropped asset from a document. Generate metadata for it according to the schema. For the taxonomy field, use the IPTC Media Topics standard to create a hierarchical classification.'
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

export async function generateMetadataForImage(imageBase64: string, mimeType: string): Promise<Omit<ExtractedAsset, 'id' | 'pageNumber' | 'boundingBox'>> {
    if (!process.env.API_KEY) {
        console.warn("API_KEY environment variable not set. Returning mock data.");
        return new Promise(resolve => setTimeout(() => {
            resolve({
                assetId: `Mock Image ${Math.floor(Math.random() * 100)}`,
                assetType: AssetType.Image,
                preview: "A mock image generated for demonstration.",
                altText: "This is a longer mock alternative text for an image.",
                keywords: ["mock", "demo", "image"],
                taxonomy: "Mock -> Image",
            });
        }, 800 + Math.random() * 500));
    }
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const imagePart = { inlineData: { data: imageBase64, mimeType: mimeType } };
    const textPart = { text: "Analyze the provided image. Generate all metadata fields according to the schema. For the assetId, create a short descriptive ID based on the image content. For the taxonomy field, use the IPTC Media Topics standard to create a hierarchical classification." };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts: [imagePart, textPart] }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: SINGLE_ASSET_SCHEMA,
            },
        });
        
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error calling Gemini API for image processing:", error);
        throw new Error("Failed to process image with Gemini API.");
    }
}

export async function performComplianceCheck(manuscriptText: string, ifaText: string): Promise<ComplianceFinding[]> {
    if (!process.env.API_KEY) {
        console.warn("API_KEY environment variable not set. Returning mock compliance data.");
        return new Promise(resolve => setTimeout(() => resolve([
            {
                checkCategory: 'Title Word Count',
                status: 'fail',
                summary: 'Title exceeds the 15-word limit.',
                manuscriptQuote: 'A Comprehensive and In-Depth Analysis of the Molecular Mechanisms Underlying Cellular Senescence and Its Implications for Age-Related Pathologies',
                manuscriptPage: 1,
                ifaRule: 'The title should be concise and no more than 15 words in length.',
                ifaPage: 2,
                recommendation: 'Revise the manuscript title to be 15 words or fewer to comply with journal guidelines.'
            },
            {
                checkCategory: 'Author Affiliations',
                status: 'warn',
                summary: 'Affiliation for one author may be incomplete.',
                manuscriptQuote: 'Chen, L., BioGen Inc., London',
                manuscriptPage: 1,
                ifaRule: 'Author affiliations must include Department, Institution, City, and Country.',
                ifaPage: 3,
                recommendation: 'Review the affiliation for "Chen, L." and add the missing Department and Country information to ensure it is fully compliant.'
            },
            {
                checkCategory: 'Data Availability Statement',
                status: 'pass',
                summary: 'Statement is present and compliant.',
                manuscriptQuote: 'All data generated or analysed during this study are included in this published article.',
                manuscriptPage: 12,
                ifaRule: 'A data availability statement is required for all submissions.',
                ifaPage: 6,
                recommendation: 'No action needed. The data availability statement is compliant.'
            }
        ]), 3000));
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
        You are a meticulous compliance editor for a scientific journal. Your task is to compare the provided 'MANUSCRIPT' against the journal's 'INSTRUCTIONS FOR AUTHORS (IFA)'.
        
        Analyze the IFA page by page to extract all submission rules (e.g., title length, affiliation format, funding disclosures, data availability, conflicts of interest, reference style, etc.).
        
        Then, carefully check the manuscript against each rule you identified.
        
        For every major rule found in the IFA, provide a compliance finding according to the provided JSON schema. Be exhaustive and report on all key requirements.
        - If the manuscript complies with a rule, mark it as 'pass'.
        - If it clearly violates a rule, mark it as 'fail'.
        - If compliance is ambiguous or a potential issue is detected, mark it as 'warn'.
        - Provide exact quotes and page numbers from both documents for every finding.

        MANUSCRIPT TEXT:
        ${manuscriptText}

        INSTRUCTIONS FOR AUTHORS (IFA) TEXT:
        ${ifaText}
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: IFA_COMPLIANCE_SCHEMA,
            },
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error calling Gemini API for compliance check:", error);
        throw new Error("Failed to perform compliance check with Gemini API.");
    }
}
