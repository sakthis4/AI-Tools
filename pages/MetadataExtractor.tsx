
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { ExtractedAsset } from '../types';
import { useAppContext } from '../hooks/useAppContext';
import { extractMetadataFromDocument } from '../services/geminiService';
import Spinner from '../components/Spinner';
import { UploadIcon, LinkIcon, ChevronLeftIcon, SparklesIcon, DownloadIcon, TrashIcon, ChevronDownIcon, XIcon } from '../components/icons/Icons';

interface MetadataExtractorProps {
  onBack: () => void;
}

export default function MetadataExtractor({ onBack }: MetadataExtractorProps) {
  const { currentUser, addUsageLog, addToast } = useAppContext();
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'parsing' | 'extracting' | 'done' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [extractedAssets, setExtractedAssets] = useState<ExtractedAsset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile.size > 100 * 1024 * 1024) {
      addToast({ type: 'error', message: 'File size cannot exceed 100MB.' });
      return;
    }
    setFile(selectedFile);
    setUrl('');
  }, [addToast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 
      'application/pdf': ['.pdf'], 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] 
    },
    multiple: false
  });
  
  const handleProcess = async () => {
    if (!file && !url) {
        addToast({ type: 'error', message: 'Please upload a file or provide a URL.' });
        return;
    }
    if (!currentUser) {
        addToast({ type: 'error', message: 'No user logged in.' });
        return;
    }
    if(currentUser.tokensUsed >= currentUser.tokenCap) {
        addToast({ type: 'error', message: 'Token cap reached - contact admin.' });
        return;
    }

    setStatus('parsing');
    setStatusMessage('Parsing asset...');
    
    try {
        setStatus('extracting');
        setStatusMessage('Extracting metadata with Gemini AI...');

        const result = await extractMetadataFromDocument({ file: file, url: url });
        
        const assetsWithIds = result.map(asset => ({...asset, id: crypto.randomUUID()}));
        setExtractedAssets(assetsWithIds);
        if (assetsWithIds.length > 0) {
            setSelectedAssetId(assetsWithIds[0].id);
        }
        setStatus('done');

        const { promptTokens, responseTokens } = addUsageLog({ 
            userId: currentUser.id, 
            toolName: 'Metadata Extractor',
        });
        const totalTokens = promptTokens + responseTokens;
        addToast({ type: 'success', message: `Extraction complete! ${totalTokens.toLocaleString()} tokens used.` });

    } catch (error) {
        console.error("Extraction failed:", error);
        const errorMessage = error instanceof Error ? error.message : 'Extraction failed. Please try again.';
        setStatus('error');
        setStatusMessage('An error occurred during extraction.');
        addToast({ type: 'error', message: errorMessage });
    }
  };

  const handleRegenerate = async (assetId: string) => {
    addToast({type: 'info', message: `Regenerating metadata for ${assetId}...`})
    // This is a mock regeneration. In a real app, you'd call Gemini with the specific asset context.
    setTimeout(() => {
        setExtractedAssets(prev => prev.map(asset => {
            if (asset.id === assetId) {
                return { ...asset, altText: asset.altText + " (regenerated)" };
            }
            return asset;
        }));
        addToast({type: 'success', message: `Metadata for ${assetId} regenerated.`})
    }, 2000);
  }

  const handleSave = () => {
    // Mock save
    addToast({type: 'success', message: "Metadata saved successfully."});
  }

  const handleExport = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Filename,Asset ID,Asset Type,Page/Location,Alt Text,Keywords,Taxonomy\n";

    extractedAssets.forEach(asset => {
        const row = [
            file?.name || url,
            asset.assetId,
            asset.assetType,
            asset.pageNumber,
            `"${asset.altText.replace(/"/g, '""')}"`,
            `"${asset.keywords.join(', ').replace(/"/g, '""')}"`,
            `"${asset.taxonomy.replace(/"/g, '""')}"`
        ].join(',');
        csvContent += row + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "metadata_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast({type: 'info', message: "CSV export initiated."})
  }
  
  const handleCellUpdate = (assetId: string, field: keyof ExtractedAsset, value: any) => {
    setExtractedAssets(prev =>
      prev.map(asset => (asset.id === assetId ? { ...asset, [field]: value } : asset))
    );
  };
  
  const handleDeleteAsset = (assetId: string) => {
    setExtractedAssets(prev => prev.filter(asset => asset.id !== assetId));
    addToast({ type: 'info', message: `Asset removed.` });
    if (selectedAssetId === assetId) {
        setSelectedAssetId(null);
    }
  }

  const renderInputArea = () => (
    <div className="max-w-3xl mx-auto">
        <div {...getRootProps()} className={`p-10 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-primary-400'}`}>
            <input {...getInputProps()} />
            <UploadIcon className="h-12 w-12 mx-auto text-gray-400" />
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {isDragActive ? "Drop the file here..." : "Drag 'n' drop a file here, or click to select a file"}
            </p>
            <p className="text-xs text-gray-500">PDF, DOCX (Max 100MB)</p>
        </div>
        {file && <p className="text-center mt-4 text-green-600 dark:text-green-400">Selected: {file.name}</p>}
        
        <div className="my-6 flex items-center">
            <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
            <span className="flex-shrink mx-4 text-gray-500">OR</span>
            <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
        </div>

        <div className="relative">
            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input 
                type="url" 
                placeholder="Paste public URL to a document" 
                value={url}
                onChange={e => { setUrl(e.target.value); setFile(null); }}
                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
        </div>

        <button 
            onClick={handleProcess} 
            disabled={!file && !url}
            className="mt-8 w-full py-3 px-4 bg-primary-500 text-white font-semibold rounded-lg hover:bg-primary-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
            Extract Metadata
        </button>
    </div>
  );

  const renderProcessingArea = () => (
    <div className="flex flex-col items-center justify-center h-64">
        <Spinner text={statusMessage} size="lg"/>
    </div>
  );

  const renderResultsArea = () => (
    <div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md mb-4">
             <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Extracted Assets ({extractedAssets.length})</h3>
                <div className="space-x-2">
                    <button onClick={handleSave} className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600">Save Changes</button>
                    <button onClick={handleExport} className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-md hover:bg-green-600 inline-flex items-center"><DownloadIcon className="h-4 w-4 mr-1"/>Export CSV</button>
                </div>
            </div>
        </div>

        <div className="space-y-3 pb-4 max-h-[calc(100vh-250px)] overflow-y-auto pr-2">
            {extractedAssets.map(asset => {
                const isSelected = selectedAssetId === asset.id;
                return (
                    <div key={asset.id} className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border ${isSelected ? 'border-primary-500' : 'border-gray-200 dark:border-gray-700'}`}>
                        <button 
                            onClick={() => setSelectedAssetId(isSelected ? null : asset.id)}
                            className="w-full flex items-center justify-between p-4 text-left"
                        >
                            <div className="flex items-center space-x-4">
                                <img src={`https://picsum.photos/seed/${asset.id}/100/60`} alt="Asset preview" className="rounded-md w-24 h-16 object-cover bg-gray-200 dark:bg-gray-700"/>
                                <div className="flex-1">
                                    <div className="font-semibold text-gray-800 dark:text-white">{asset.assetId} - <span className="font-normal text-gray-500 dark:text-gray-400">{asset.assetType} on Page {asset.pageNumber}</span></div>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">{asset.preview}</p>
                                </div>
                            </div>
                            <ChevronDownIcon className={`h-5 w-5 text-gray-500 transition-transform duration-300 ${isSelected ? 'rotate-180' : ''}`} />
                        </button>

                        {isSelected && (
                            <div className="p-4 border-t border-gray-200 dark:border-gray-700 animate-fade-in">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Left side: Alt text and Taxonomy */}
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center justify-between">
                                                <span>Alt Text</span>
                                                <button onClick={() => handleRegenerate(asset.id)} className="p-1 text-xs text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center">
                                                    <SparklesIcon className="h-3 w-3 mr-1"/>Regenerate
                                                </button>
                                            </label>
                                            <textarea 
                                                value={asset.altText} 
                                                onChange={e => handleCellUpdate(asset.id, 'altText', e.target.value)} 
                                                className="w-full mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700/50 text-sm h-32 focus:ring-primary-500 focus:border-primary-500" 
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Taxonomy</label>
                                            <input 
                                                type="text"
                                                value={asset.taxonomy} 
                                                onChange={e => handleCellUpdate(asset.id, 'taxonomy', e.target.value)} 
                                                className="w-full mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700/50 text-sm focus:ring-primary-500 focus:border-primary-500" 
                                            />
                                        </div>
                                    </div>
                                    {/* Right side: Keywords and actions */}
                                    <div className="space-y-4">
                                         <div>
                                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Keywords</label>
                                            <div className="mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700/50 min-h-[50px]">
                                                <div className="flex flex-wrap gap-2">
                                                    {asset.keywords.map((k, index) => (
                                                        <span key={index} className="flex items-center text-sm bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded-full">
                                                            {k}
                                                            <button 
                                                                onClick={() => handleCellUpdate(asset.id, 'keywords', asset.keywords.filter((_, i) => i !== index))}
                                                                className="ml-1.5 text-gray-500 dark:text-gray-300 hover:text-red-500"
                                                            >
                                                                <XIcon className="h-3 w-3" />
                                                            </button>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Add a keyword and press Enter"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                                        e.preventDefault();
                                                        handleCellUpdate(asset.id, 'keywords', [...asset.keywords, e.currentTarget.value.trim()]);
                                                        e.currentTarget.value = '';
                                                    }
                                                }}
                                                className="w-full mt-2 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700/50 text-sm focus:ring-primary-500 focus:border-primary-500"
                                            />
                                        </div>
                                        <div className="text-right pt-4">
                                            <button onClick={() => handleDeleteAsset(asset.id)} className="inline-flex items-center px-3 py-1.5 text-sm text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/50 rounded-md hover:bg-red-200 dark:hover:bg-red-900">
                                                <TrashIcon className="h-4 w-4 mr-2"/>
                                                Delete Asset
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    </div>
  );

  return (
    <div className="animate-fade-in h-full flex flex-col">
      <div className="flex items-center mb-6 flex-shrink-0">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 mr-3">
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Metadata Extractor</h2>
      </div>
      
      <div className="flex-grow overflow-hidden">
        {status === 'idle' && renderInputArea()}
        {(status === 'parsing' || status === 'extracting') && renderProcessingArea()}
        {status === 'done' && renderResultsArea()}
        {status === 'error' && <div className="text-center text-red-500">{statusMessage} <button onClick={() => setStatus('idle')} className="text-primary-500 hover:underline">Try Again</button></div>}
      </div>
    </div>
  );
}