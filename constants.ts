import { User, Role, UsageLog } from './types';

export const USERS: User[] = [
  {
    id: 1,
    email: 'admin@example.com',
    role: Role.Admin,
    tokenCap: 1000000,
    tokensUsed: 12500,
    lastLogin: '2023-10-27T10:00:00Z',
    status: 'active',
  },
  {
    id: 2,
    email: 'user@example.com',
    role: Role.User,
    tokenCap: 50000,
    tokensUsed: 45000,
    lastLogin: '2023-10-27T12:30:00Z',
    status: 'active',
  },
  {
    id: 3,
    email: 'inactive@example.com',
    role: Role.User,
    tokenCap: 20000,
    tokensUsed: 19950,
    lastLogin: '2023-10-25T08:00:00Z',
    status: 'inactive',
  },
];

export const USAGE_LOGS: UsageLog[] = [
    {
        id: 'log1',
        userId: 1,
        toolName: 'Metadata Extractor',
        timestamp: '2023-10-27T10:05:00Z',
        promptTokens: 2500,
        responseTokens: 1500
    },
    {
        id: 'log2',
        userId: 2,
        toolName: 'Metadata Extractor',
        timestamp: '2023-10-27T12:35:00Z',
        promptTokens: 8000,
        responseTokens: 4200
    },
    {
        id: 'log3',
        userId: 2,
        toolName: 'Metadata Extractor',
        timestamp: '2023-10-26T11:00:00Z',
        promptTokens: 15000,
        responseTokens: 7800
    },
];

export const HELP_CONTENT = {
    title: 'Usage Instructions',
    sections: [
        {
            title: 'How to Use the Metadata Extractor',
            content: 'Select or upload a file. The tool accepts PDF (.pdf) files up to 100 MB.'
        },
        {
            title: 'What it Does',
            content: 'It finds all figures, tables, images, equations, and maps/graphs in your document and generates alternative text, keywords, and a taxonomy classification for each.'
        },
        {
            title: 'Editing Workflow',
            content: 'After extraction, you can edit any generated field directly in the results table. Click the "Regenerate" button for a fresh suggestion on a specific item. When you are finished, click "Save" to commit your changes (simulated in this prototype).'
        },
        {
            title: 'Token Transparency',
            content: 'Each extraction consumes tokens from your monthly cap. The number of tokens used is shown after the extraction and is tracked in your Usage Dashboard. Token usage is based on Gemini API billing: prompt + response tokens.'
        },
        {
            title: 'Exporting Your Data',
            content: 'When ready, click "Export CSV" to download all extracted metadata as a CSV file, ready for your publisher workflow.'
        },
        {
            title: 'Admin Note',
            content: 'If your token cap is reached, tool execution will be disabled. Please contact your administrator to request a top-up.'
        }
    ]
};