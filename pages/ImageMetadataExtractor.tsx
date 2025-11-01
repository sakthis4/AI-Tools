import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { ExtractedAsset } from '../types';
import { useAppContext } from '../hooks/useAppContext';
import { generateMetadataForImage } from '../services/geminiService';
import Spinner from '../components/Spinner';
import { UploadIcon, ChevronLeftIcon, SparklesIcon, DownloadIcon, TrashIcon, XIcon, ExclamationIcon } from '../components/icons/Icons';

interface ImageAsset {
    id: string;
    file: File;
    previewUrl: string;
    metadata?: Partial<ExtractedAsset>;
    status: 'pending' | 'processing' | 'done' | 'error';
    error?: string;
}

export default function ImageMetadataExtractor({ onBack }: { onBack: () => void }) {
    const { currentUser, addUsageLog, addToast } = useAppContext();
    const [imageAssets, setImageAssets] = useState<ImageAsset[]>([]);
    const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
    const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        const newImageAssets: ImageAsset[] = acceptedFiles.map(file => ({
            id: crypto.randomUUID(),
            file,
            previewUrl: URL.createObjectURL(file),
            status: 'pending'
        }));
        setImageAssets(prev => [...prev, ...newImageAssets]);
        setStatus('idle');
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'] },
    });

    // This ref is used to correctly clean up object URLs when the component unmounts.
    // It holds the latest version of the assets array to avoid stale closures in the cleanup effect.
    const imageAssetsRef = useRef<ImageAsset[]>();
    imageAssetsRef.current = imageAssets;

    useEffect(() => {
        // This effect's cleanup function will run only when the component unmounts,
        // thanks to the empty dependency array.
        return () => {
            // Use the ref to access the latest asset list and revoke all URLs.
            if (imageAssetsRef.current) {
                imageAssetsRef.current.forEach(asset => URL.revokeObjectURL(asset.previewUrl));
            }
        };
    }, []); // Empty dependency array ensures cleanup runs only on unmount.

    const handleProcess = async () => {
        if (!currentUser) {
            addToast({ type: 'error', message: 'No user logged in.' });
            return;
        }
        if (currentUser.tokensUsed >= currentUser.tokenCap) {
            addToast({ type: 'error', message: 'Token cap reached - contact admin.' });
            return;
        }

        setStatus('processing');
        const assetsToProcess = imageAssets.filter(a => a.status === 'pending');

        await Promise.all(assetsToProcess.map(async (asset) => {
            setImageAssets(prev => prev.map(a => a.id === asset.id ? { ...a, status: 'processing' } : a));
            try {
                const base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(asset.file);
                    reader.onload = () => resolve((reader.result as string).split(',')[1]);
                    reader.onerror = error => reject(error);
                });

                const metadata = await generateMetadataForImage(base64, asset.file.type);
                setImageAssets(prev => prev.map(a => a.id === asset.id ? { ...a, status: 'done', metadata: { ...metadata, id: a.id } } : a));

            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                setImageAssets(prev => prev.map(a => a.id === asset.id ? { ...a, status: 'error', error: errorMessage } : a));
            }
        }));

        addUsageLog({ userId: currentUser.id, toolName: 'Image Metadata Extractor', promptTokens: 0, responseTokens: 0 });
        setStatus('done');
        addToast({ type: 'success', message: `Processing complete.` });
        if (imageAssets.length > 0 && !selectedAssetId) {
            setSelectedAssetId(imageAssets[0].id);
        }
    };
    
    const handleCellUpdate = (assetId: string, field: keyof ExtractedAsset, value: any) => {
        setImageAssets(prev =>
          prev.map(asset => {
              if (asset.id === assetId && asset.metadata) {
                  const newMetadata = { ...asset.metadata, [field]: value };
                  return { ...asset, metadata: newMetadata };
              }
              return asset;
          })
        );
    };
    
    const handleDeleteAsset = (assetId: string) => {
        const assetToRemove = imageAssets.find(asset => asset.id === assetId);
        if (assetToRemove) {
            URL.revokeObjectURL(assetToRemove.previewUrl);
        }
        setImageAssets(prev => prev.filter(asset => asset.id !== assetId));
        if (selectedAssetId === assetId) {
            setSelectedAssetId(null);
        }
    };

    const handleExport = () => {
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Filename,Asset ID,Asset Type,Alt Text,Keywords,Taxonomy\n";

        imageAssets.forEach(asset => {
            if (!asset.metadata) return;
            const row = [
                asset.file.name,
                asset.metadata.assetId,
                asset.metadata.assetType,
                `"${(asset.metadata.altText || '').replace(/"/g, '""')}"`,
                `"${(asset.metadata.keywords || []).join(', ').replace(/"/g, '""')}"`,
                `"${(asset.metadata.taxonomy || '').replace(/"/g, '""')}"`
            ].join(',');
            csvContent += row + "\r\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "image_metadata_export.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        addToast({ type: 'info', message: "CSV export initiated." })
    }
    
    const selectedAsset = imageAssets.find(a => a.id === selectedAssetId);

    const renderInputArea = () => (
        <div className="h-full flex flex-col">
            <div {...getRootProps()} className={`flex-grow p-10 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors flex flex-col justify-center items-center ${isDragActive ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-primary-400'}`}>
                <input {...getInputProps()} />
                <UploadIcon className="h-12 w-12 mx-auto text-gray-400" />
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    {isDragActive ? "Drop the images here..." : "Drag 'n' drop images here, or click to select"}
                </p>
                <p className="text-xs text-gray-500">JPG, PNG, GIF, WEBP</p>
            </div>
            {imageAssets.length > 0 && (
                <>
                <div className="flex-shrink-0 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 p-4 mt-4 bg-white dark:bg-gray-800 rounded-lg max-h-48 overflow-y-auto">
                    {imageAssets.map(asset => (
                        <div key={asset.id} className="relative group">
                            <img src={asset.previewUrl} alt={asset.file.name} className="w-full h-full object-cover rounded" />
                            <button onClick={() => handleDeleteAsset(asset.id)} className="absolute top-0 right-0 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                <XIcon className="h-3 w-3" />
                            </button>
                        </div>
                    ))}
                </div>
                <button
                    onClick={handleProcess}
                    disabled={imageAssets.length === 0}
                    className="mt-4 w-full py-3 px-4 bg-indigo-500 text-white font-semibold rounded-lg hover:bg-indigo-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                    Generate Metadata for {imageAssets.length} image{imageAssets.length > 1 ? 's' : ''}
                </button>
                </>
            )}
        </div>
    );

    const renderProcessingArea = () => (
        <div className="flex flex-col items-center justify-center h-full">
            <Spinner text={`Processing...`} size="lg"/>
            <div className="w-full max-w-md bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-4">
                <div className="bg-indigo-500 h-2.5 rounded-full" style={{ width: `${(imageAssets.filter(a=> a.status === 'done' || a.status === 'error').length / imageAssets.length) * 100}%` }}></div>
            </div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {imageAssets.filter(a=> a.status === 'done' || a.status === 'error').length} of {imageAssets.length} images complete.
            </p>
        </div>
    );
    
    const renderResultsArea = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full overflow-hidden">
        {/* Left Panel: Image List */}
        <div className="md:col-span-1 flex flex-col h-full overflow-hidden">
             <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md flex-shrink-0">
                 <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Images ({imageAssets.length})</h3>
                    <button onClick={handleExport} className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-md hover:bg-green-600 inline-flex items-center">
                        <DownloadIcon className="h-4 w-4 mr-1"/>Export
                    </button>
                </div>
            </div>
            <div className="mt-4 flex-grow overflow-y-auto space-y-2 pr-2">
                {imageAssets.map(asset => (
                    <button 
                        key={asset.id} 
                        onClick={() => setSelectedAssetId(asset.id)}
                        className={`w-full text-left p-2 rounded-lg flex items-center gap-3 transition-colors ${selectedAssetId === asset.id ? 'bg-primary-100 dark:bg-primary-900/50' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                    >
                        <img src={asset.previewUrl} className="w-12 h-12 object-cover rounded-md flex-shrink-0" />
                        <div className="flex-grow overflow-hidden">
                            <p className="text-sm font-medium truncate text-gray-800 dark:text-gray-200">{asset.metadata?.assetId || asset.file.name}</p>
                            {asset.status === 'processing' && <p className="text-xs text-blue-500">Processing...</p>}
                            {asset.status === 'error' && <p className="text-xs text-red-500 truncate">Error: {asset.error}</p>}
                            {asset.status === 'done' && <p className="text-xs text-gray-500 truncate">{asset.metadata?.assetType}</p>}
                        </div>
                    </button>
                ))}
            </div>
        </div>

        {/* Right Panel: Metadata Editor */}
        <div className="md:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md h-full overflow-y-auto">
            {selectedAsset && selectedAsset.metadata ? (
                <div className="space-y-6">
                    <img src={selectedAsset.previewUrl} className="w-full max-h-80 object-contain rounded-lg bg-gray-100 dark:bg-gray-700" />
                    <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Asset ID</label>
                        <input type="text" value={selectedAsset.metadata.assetId} onChange={e => handleCellUpdate(selectedAsset.id, 'assetId', e.target.value)} className="w-full mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700/50 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Alt Text</label>
                        <textarea value={selectedAsset.metadata.altText} onChange={e => handleCellUpdate(selectedAsset.id, 'altText', e.target.value)} className="w-full mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700/50 text-sm h-24 focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Keywords</label>
                        <div className="mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700/50 min-h-[50px]">
                            <div className="flex flex-wrap gap-2">
                                {selectedAsset.metadata.keywords?.map((k, index) => (
                                    <span key={index} className="flex items-center text-sm bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded-full">
                                        {k}
                                        <button onClick={() => handleCellUpdate(selectedAsset.id, 'keywords', selectedAsset.metadata?.keywords?.filter((_, i) => i !== index))} className="ml-1.5 text-gray-500 dark:text-gray-300 hover:text-red-500">
                                            <XIcon className="h-3 w-3" />
                                        </button>
                                    </span>
                                ))}
                                <input type="text" placeholder="Add..." onKeyDown={(e) => {
                                    if (e.key === 'Enter' && e.currentTarget.value.trim() && selectedAsset.metadata?.keywords) {
                                        e.preventDefault();
                                        handleCellUpdate(selectedAsset.id, 'keywords', [...selectedAsset.metadata.keywords, e.currentTarget.value.trim()]);
                                        e.currentTarget.value = '';
                                    }
                                }} className="flex-grow bg-transparent focus:outline-none text-sm" />
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Taxonomy</label>
                        <input type="text" value={selectedAsset.metadata.taxonomy} onChange={e => handleCellUpdate(selectedAsset.id, 'taxonomy', e.target.value)} className="w-full mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700/50 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                </div>
            ) : (
                 <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                    <p>Select an image to view its metadata.</p>
                </div>
            )}
        </div>
    </div>
  );


    return (
        <div className="animate-fade-in h-full flex flex-col p-4 md:p-6 lg:p-8 bg-gray-100 dark:bg-gray-900">
            <div className="flex items-center mb-6 flex-shrink-0">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 mr-3">
                    <ChevronLeftIcon className="h-5 w-5" />
                </button>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Image Metadata Extractor</h2>
            </div>
            
            <div className="flex-grow overflow-hidden">
                {status === 'idle' && renderInputArea()}
                {status === 'processing' && renderProcessingArea()}
                {status === 'done' && renderResultsArea()}
            </div>
        </div>
    );
}