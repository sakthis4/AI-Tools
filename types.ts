export enum Role {
  Admin = 'Admin',
  User = 'User',
}

export interface User {
  id: number;
  email: string;
  role: Role;
  tokenCap: number;
  tokensUsed: number;
  lastLogin: string;
  status: 'active' | 'inactive';
}

export interface UsageLog {
  id: string;
  userId: number;
  toolName: string;
  timestamp: string;
  promptTokens: number;
  responseTokens: number;
}

export enum AssetType {
    Figure = 'Figure',
    Table = 'Table',
    Image = 'Image',
    Equation = 'Equation',
    Map = 'Map',
    Graph = 'Graph'
}

export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface ExtractedAsset {
    id: string;
    assetId: string;
    assetType: AssetType;
    pageNumber?: number;
    preview: string;
    altText: string;
    keywords: string[];
    taxonomy: string;
    boundingBox?: BoundingBox;
}

export interface ToastData {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export type FindingStatus = 'pass' | 'fail' | 'warn';

export interface ComplianceFinding {
    checkCategory: string;
    status: FindingStatus;
    summary: string;
    manuscriptQuote: string;
    manuscriptPage: number;
    ifaRule: string;
    ifaPage: number;
    recommendation: string;
}
