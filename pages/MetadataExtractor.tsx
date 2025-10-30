import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { ExtractedAsset, BoundingBox } from '../types';
import { useAppContext } from '../hooks/useAppContext';
import { extractAssetsFromPage, generateMetadataForSelection } from '../services/geminiService';
import Spinner from '../components/Spinner';
import { UploadIcon, ChevronLeftIcon, SparklesIcon, DownloadIcon, TrashIcon, ChevronDownIcon, XIcon, CursorClickIcon } from '../components/icons/Icons';
import * as pdfjsLib from 'pdfjs-dist';

// Set up the PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs`;

interface MetadataExtractorProps {
  onBack: () => void;
}

export default function MetadataExtractor({ onBack }: MetadataExtractorProps) {
  const { currentUser, addUsageLog, addToast } = useAppContext();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'extracting' | 'done' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [extractedAssets, setExtractedAssets] = useState<ExtractedAsset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  
  // PDF Viewer State
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number; }[]>([]);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
  
  // Asset Selection State
  const [selectionMode, setSelectionMode] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionRect, setSelectionRect] = useState<{ pageIndex: number; rect: BoundingBox; } | null>(null);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number; } | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);


  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile.size > 100 * 1024 * 1024) {
      addToast({ type: 'error', message: 'File size cannot exceed 100MB.' });
      return;
    }
    setFile(selectedFile);
  }, [addToast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 
      'application/pdf': ['.pdf']
    },
    multiple: false
  });

  useEffect(() => {
    if (selectedAssetId) {
        const asset = extractedAssets.find(a => a.id === selectedAssetId);
        if (asset) {
            const pageElement = pageRefs.current[asset.pageNumber - 1];
            pageElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
  }, [selectedAssetId, extractedAssets]);
  
  const handleProcess = async () => {
    if (!file) {
        addToast({ type: 'error', message: 'Please upload a PDF file.' });
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

    setStatus('loading');
    setStatusMessage('Loading PDF document...');
    setExtractedAssets([]); // Clear previous results
    
    try {
        const fileBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument(fileBuffer);
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);

        // Pre-calculate all page dimensions for the viewer
        const dimensions = [];
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 });
            dimensions.push({ width: viewport.width, height: viewport.height });
        }
        setPageDimensions(dimensions);
        pageRefs.current = Array(pdf.numPages).fill(null);
        
        setStatus('extracting');
        const allAssets: ExtractedAsset[] = [];

        // Process page by page
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            setStatusMessage(`Analyzing page ${pageNum} of ${pdf.numPages}...`);
            
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1.5 }); // Use same scale as dimensions
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!context) continue;

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport }).promise;
            const pageImageBase64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

            const assetsOnPage = await extractAssetsFromPage(pageImageBase64);
            
            if (assetsOnPage.length > 0) {
                const newAssetsWithContext = assetsOnPage.map(asset => ({
                    ...asset,
                    id: crypto.randomUUID(),
                    pageNumber: pageNum,
                }));
                allAssets.push(...newAssetsWithContext);
                // Update state incrementally to show results as they come in
                setExtractedAssets([...allAssets]); 
            }
        }
        
        setStatus('done');
        setStatusMessage('');

        const { promptTokens, responseTokens } = addUsageLog({ 
            userId: currentUser.id, 
            toolName: 'Metadata Extractor',
        });
        const totalTokens = promptTokens + responseTokens;
        addToast({ type: 'success', message: `Extraction complete! ${allAssets.length} assets found. ${totalTokens.toLocaleString()} tokens used.` });

    } catch (error) {
        console.error("Processing failed:", error);
        const errorMessage = error instanceof Error ? error.message : 'Processing failed. Please try again.';
        setStatus('error');
        setStatusMessage(errorMessage);
        addToast({ type: 'error', message: errorMessage });
    }
  };


  const handleRegenerate = async (assetId: string) => {
    addToast({type: 'info', message: `Regenerating metadata for ${assetId}...`})
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

  const handleExport = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Filename,Asset ID,Asset Type,Page/Location,Alt Text,Keywords,Taxonomy\n";

    extractedAssets.forEach(asset => {
        const row = [
            file?.name || 'document',
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

  // --- Asset Selection Logic ---
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectionMode) return;
    const target = e.target as HTMLElement;
    const pageElement = target.closest('.pdf-page-container') as HTMLDivElement;
    if (!pageElement || !viewerRef.current) return;
    
    setIsSelecting(true);
    const rect = pageElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setSelectionStart({ x, y });
    setSelectionRect({
        pageIndex: parseInt(pageElement.dataset.pageIndex || '0', 10),
        rect: { x: (x / rect.width) * 100, y: (y / rect.height) * 100, width: 0, height: 0 }
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelecting || !selectionStart || !selectionRect) return;
    
    const pageElement = viewerRef.current?.querySelector(`[data-page-index="${selectionRect.pageIndex}"]`) as HTMLDivElement;
    if(!pageElement) return;

    const rect = pageElement.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    const newRect: BoundingBox = {
        x: (Math.min(selectionStart.x, currentX) / rect.width) * 100,
        y: (Math.min(selectionStart.y, currentY) / rect.height) * 100,
        width: (Math.abs(currentX - selectionStart.x) / rect.width) * 100,
        height: (Math.abs(currentY - selectionStart.y) / rect.height) * 100
    };
    setSelectionRect({ ...selectionRect, rect: newRect });
  };
  
  const handleMouseUp = () => {
    setIsSelecting(false);
    setSelectionStart(null);
  };
  
  const handleGenerateForSelection = async () => {
    if (!selectionRect || !pdfDoc) return;
    const { pageIndex, rect: selectionBox } = selectionRect;
    
    setStatusMessage('Generating metadata for selection...');
    const originalStatus = status;
    setStatus('extracting');

    try {
        const page = await pdfDoc.getPage(pageIndex + 1);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Could not get canvas context");
        
        const viewport = page.getViewport({ scale: 1.5 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: ctx, viewport }).promise;

        const sx = (selectionBox.x / 100) * canvas.width;
        const sy = (selectionBox.y / 100) * canvas.height;
        const sWidth = (selectionBox.width / 100) * canvas.width;
        const sHeight = (selectionBox.height / 100) * canvas.height;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = sWidth;
        tempCanvas.height = sHeight;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) throw new Error("Could not get temporary canvas context");
        tempCtx.drawImage(canvas, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);
        
        const imageDataUrl = tempCanvas.toDataURL('image/png');
        
        const newMetadata = await generateMetadataForSelection(imageDataUrl);

        const newAsset: ExtractedAsset = {
            ...newMetadata,
            id: crypto.randomUUID(),
            pageNumber: pageIndex + 1,
            boundingBox: selectionBox,
        };

        setExtractedAssets(prev => [...prev, newAsset]);
        addToast({ type: 'success', message: `New asset "${newAsset.assetId}" added!` });

    } catch (error) {
        console.error("Failed to generate metadata for selection:", error);
        addToast({ type: 'error', message: 'Could not generate metadata for selection.' });
    } finally {
        setStatus(originalStatus);
        setStatusMessage('');
        setSelectionRect(null);
        setSelectionMode(false);
    }
  };

  const LazyPdfPage = React.memo(({ pdfDoc, pageNum }: { pdfDoc: pdfjsLib.PDFDocumentProxy; pageNum: number }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [isIntersecting, setIsIntersecting] = useState(false);
    const [isRendered, setIsRendered] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsIntersecting(true);
                    observer.unobserve(entry.target);
                }
            },
            { 
                root: viewerRef.current,
                rootMargin: "500px 0px" // Preload pages within 500px of the viewport
            }
        );

        const currentContainer = containerRef.current;
        if (currentContainer) {
            observer.observe(currentContainer);
        }

        return () => {
            if (currentContainer) {
                observer.unobserve(currentContainer);
            }
        };
    }, []);

    useEffect(() => {
        if (!isIntersecting || isRendered) return;

        let isCancelled = false;
        
        pdfDoc.getPage(pageNum).then(page => {
            if (isCancelled || !canvasRef.current) return;

            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');
            if (!context) return;
            
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            page.render({ canvasContext: context, viewport }).promise.then(() => {
                if (!isCancelled) {
                    setIsRendered(true);
                }
            });
        });

        return () => {
            isCancelled = true;
        };
    }, [isIntersecting, isRendered, pdfDoc, pageNum]);

    return (
        <div ref={containerRef} className="absolute inset-0">
            {isIntersecting && <canvas ref={canvasRef} className={isRendered ? 'block' : 'hidden'} />}
            {isIntersecting && !isRendered && (
                <div className="w-full h-full flex items-center justify-center bg-gray-300 dark:bg-gray-600">
                    <Spinner size="md" />
                </div>
            )}
        </div>
    );
  });

  // --- Render Functions ---
  const renderInputArea = () => (
    <div className="max-w-3xl mx-auto">
        <div {...getRootProps()} className={`p-10 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-primary-400'}`}>
            <input {...getInputProps()} />
            <UploadIcon className="h-12 w-12 mx-auto text-gray-400" />
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {isDragActive ? "Drop the PDF file here..." : "Drag 'n' drop a PDF file here, or click to select"}
            </p>
            <p className="text-xs text-gray-500">PDF (Max 100MB)</p>
        </div>
        {file && <p className="text-center mt-4 text-green-600 dark:text-green-400">Selected: {file.name}</p>}
        
        <button 
            onClick={handleProcess} 
            disabled={!file}
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full overflow-hidden">
        {/* Left Panel: PDF Viewer */}
        <div 
          ref={viewerRef}
          className={`overflow-y-auto bg-gray-200 dark:bg-gray-700 p-2 md:p-4 rounded-lg shadow-inner ${selectionMode ? 'cursor-crosshair' : ''}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
            {pdfDoc && pageDimensions.map((dim, index) => (
                <div 
                    key={`page_${index + 1}`} 
                    ref={el => pageRefs.current[index] = el}
                    data-page-index={index}
                    className="relative shadow-lg mb-4 bg-white dark:bg-gray-800 pdf-page-container"
                    style={{ width: dim.width, height: dim.height }}
                >
                    <LazyPdfPage pdfDoc={pdfDoc} pageNum={index + 1} />
                    {/* Highlight selected asset */}
                    {extractedAssets.filter(a => a.pageNumber === index + 1 && a.id === selectedAssetId && a.boundingBox).map(asset => (
                        <div
                          key={`highlight-${asset.id}`}
                          className="absolute border-2 border-primary-500 bg-primary-500/30 pointer-events-none rounded-sm"
                          style={{
                            top: `${asset.boundingBox!.y}%`,
                            left: `${asset.boundingBox!.x}%`,
                            width: `${asset.boundingBox!.width}%`,
                            height: `${asset.boundingBox!.height}%`,
                          }}
                        />
                    ))}
                    {/* Show current selection rectangle */}
                    {selectionRect && selectionRect.pageIndex === index && (
                       <div
                          className="absolute border-2 border-dashed border-red-500 bg-red-500/20 pointer-events-none"
                          style={{
                            top: `${selectionRect.rect.y}%`,
                            left: `${selectionRect.rect.x}%`,
                            width: `${selectionRect.rect.width}%`,
                            height: `${selectionRect.rect.height}%`,
                          }}
                        />
                    )}
                </div>
            ))}
            {selectionRect && !isSelecting && (
              <div 
                className="absolute p-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl flex items-center gap-2"
                style={{
                  top: `calc(${selectionRect.rect.y}% + ${selectionRect.rect.height}%)`,
                  left: `${selectionRect.rect.x}%`,
                  transform: `translateY(8px)`
                }}
              >
                  <button onClick={handleGenerateForSelection} className="px-2 py-1 text-xs bg-primary-500 text-white rounded hover:bg-primary-600">Generate Metadata</button>
                  <button onClick={() => setSelectionRect(null)} className="p-1 text-gray-500 hover:text-red-500"><XIcon className="h-4 w-4" /></button>
              </div>
            )}
        </div>

        {/* Right Panel: Metadata */}
        <div className="flex flex-col h-full overflow-hidden">
             <div className="bg-white dark:bg-gray-800 p-2 md:p-4 rounded-lg shadow-md mb-4 flex-shrink-0">
                 <div className="flex justify-between items-center">
                    <h3 className="text-base md:text-lg font-semibold">Extracted Assets ({extractedAssets.length})</h3>
                    <div className="space-x-2">
                        <button onClick={() => setSelectionMode(!selectionMode)} title="Select a missing asset on the document" className={`px-2 py-1.5 text-xs md:text-sm rounded-md inline-flex items-center transition-colors ${selectionMode ? 'bg-primary-600 text-white' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>
                            <CursorClickIcon className="h-4 w-4 mr-1"/> Select
                        </button>
                        <button onClick={handleExport} className="px-2 py-1.5 text-xs md:text-sm bg-green-500 text-white rounded-md hover:bg-green-600 inline-flex items-center">
                            <DownloadIcon className="h-4 w-4 mr-1"/>Export CSV
                        </button>
                    </div>
                </div>
            </div>

            <div className="space-y-3 pb-4 flex-grow overflow-y-auto pr-2">
                {extractedAssets.map(asset => {
                    const isSelected = selectedAssetId === asset.id;
                    return (
                        <div key={asset.id} className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border ${isSelected ? 'border-primary-500' : 'border-transparent'}`}>
                            <button 
                                onClick={() => setSelectedAssetId(isSelected ? null : asset.id)}
                                className="w-full flex items-center justify-between p-4 text-left"
                            >
                                <div className="flex items-center space-x-4">
                                    <div className="flex-1">
                                        <div className="font-semibold text-gray-800 dark:text-white">{asset.assetId} - <span className="font-normal text-gray-500 dark:text-gray-400">{asset.assetType} on Page {asset.pageNumber}</span></div>
                                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-1">{asset.preview}</p>
                                    </div>
                                </div>
                                <ChevronDownIcon className={`h-5 w-5 text-gray-500 transition-transform duration-300 ${isSelected ? 'rotate-180' : ''}`} />
                            </button>

                            {isSelected && (
                                <div className="p-4 border-t border-gray-200 dark:border-gray-700 animate-fade-in space-y-4">
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center justify-between">
                                            <span>Alt Text</span>
                                            <button onClick={() => handleRegenerate(asset.id)} className="p-1 text-xs text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center">
                                                <SparklesIcon className="h-3 w-3 mr-1"/>Regenerate
                                            </button>
                                        </label>
                                        <textarea value={asset.altText} onChange={e => handleCellUpdate(asset.id, 'altText', e.target.value)} className="w-full mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700/50 text-sm h-24 focus:ring-primary-500 focus:border-primary-500" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Keywords</label>
                                        <div className="mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700/50 min-h-[50px]">
                                            <div className="flex flex-wrap gap-2">
                                                {asset.keywords.map((k, index) => (
                                                    <span key={index} className="flex items-center text-sm bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded-full">
                                                        {k}
                                                        <button onClick={() => handleCellUpdate(asset.id, 'keywords', asset.keywords.filter((_, i) => i !== index))} className="ml-1.5 text-gray-500 dark:text-gray-300 hover:text-red-500">
                                                            <XIcon className="h-3 w-3" />
                                                        </button>
                                                    </span>
                                                ))}
                                                 <input
                                                    type="text"
                                                    placeholder="Add..."
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                                            e.preventDefault();
                                                            handleCellUpdate(asset.id, 'keywords', [...asset.keywords, e.currentTarget.value.trim()]);
                                                            e.currentTarget.value = '';
                                                        }
                                                    }}
                                                    className="flex-grow bg-transparent focus:outline-none text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <button onClick={() => handleDeleteAsset(asset.id)} className="inline-flex items-center px-3 py-1.5 text-sm text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/50 rounded-md hover:bg-red-200 dark:hover:bg-red-900">
                                            <TrashIcon className="h-4 w-4 mr-2"/>
                                            Delete Asset
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
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
        {(status === 'loading' || status === 'extracting') && renderProcessingArea()}
        {status === 'done' && renderResultsArea()}
        {status === 'error' && <div className="text-center text-red-500">{statusMessage} <button onClick={() => setStatus('idle')} className="text-primary-500 hover:underline">Try Again</button></div>}
      </div>
    </div>
  );
}