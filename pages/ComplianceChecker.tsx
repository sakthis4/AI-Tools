
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { useAppContext } from '../hooks/useAppContext';
import Spinner from '../components/Spinner';
import { UploadIcon, ChevronLeftIcon, DownloadIcon, CheckIcon, XIcon, ExclamationIcon, ChevronDownIcon } from '../components/icons/Icons';
import * as pdfjsLib from 'pdfjs-dist';
import { performComplianceCheck } from '../services/geminiService';
import { ComplianceFinding, FindingStatus } from '../types';

// The main library is loaded as a module via importmap, so the worker must also be a module.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs`;

const FileUpload: React.FC<{
    title: string;
    acceptedFileTypes: { [key: string]: string[] };
    file: File | null;
    onFileSelect: (file: File | null) => void;
}> = ({ title, acceptedFileTypes, file, onFileSelect }) => {
    
    const onDrop = useCallback((acceptedFiles: File[], fileRejections: FileRejection[]) => {
        if (acceptedFiles.length > 0) {
            onFileSelect(acceptedFiles[0]);
        }
        if (fileRejections.length > 0) {
            console.error("File rejected:", fileRejections[0].errors);
        }
    }, [onFileSelect]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: acceptedFileTypes,
        multiple: false
    });

    if (file) {
        return (
            <div className="p-4 border-2 border-dashed border-green-500 rounded-lg text-center bg-green-50 dark:bg-green-900/20">
                <p className="font-semibold text-green-700 dark:text-green-300">{title}</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">{file.name}</p>
                <button 
                    onClick={() => onFileSelect(null)}
                    className="mt-2 text-xs text-red-500 hover:underline"
                >
                    Remove
                </button>
            </div>
        )
    }

    return (
        <div {...getRootProps()} className={`p-6 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-primary-400'}`}>
            <input {...getInputProps()} />
            <UploadIcon className="h-8 w-8 mx-auto text-gray-400" />
            <p className="mt-2 text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</p>
            <p className="text-xs text-gray-500">{Object.values(acceptedFileTypes).flat().join(', ').toUpperCase()}</p>
        </div>
    );
};

const LazyPdfPage = ({ pdfDoc, pageNum, scale, viewerRef }: { pdfDoc: pdfjsLib.PDFDocumentProxy; pageNum: number; scale: number; viewerRef: React.RefObject<HTMLDivElement> }) => {
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
    }, [viewerRef]);

    useEffect(() => {
        if (!isIntersecting || isRendered || scale <= 0) return;

        let isCancelled = false;
        
        pdfDoc.getPage(pageNum).then(page => {
            const canvas = canvasRef.current;
            if (isCancelled || !canvas) return;

            const viewport = page.getViewport({ scale });
            const context = canvas.getContext('2d');
            if (!context) return;
            
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            page.render({ canvasContext: context, viewport, canvas: canvas as any }).promise.then(() => {
                if (!isCancelled) {
                    setIsRendered(true);
                }
            });
        });

        return () => {
            isCancelled = true;
        };
    }, [isIntersecting, isRendered, pdfDoc, pageNum, scale]);

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
};

async function extractTextFromPdf(pdfDoc: pdfjsLib.PDFDocumentProxy): Promise<string> {
    let fullText = '';
    for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => 'str' in item ? item.str : '').join(' ');
        fullText += `[Page ${i}]\n${pageText}\n\n`;
    }
    return fullText;
}

const ComplianceChecker: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { currentUser, addUsageLog, addToast } = useAppContext();
    const [files, setFiles] = useState<{ manuscript: File | null, ifa: File | null }>({ manuscript: null, ifa: null });
    const [status, setStatus] = useState<'idle' | 'processing' | 'done'>('idle');
    const [results, setResults] = useState<ComplianceFinding[] | null>(null);
    const [openAccordion, setOpenAccordion] = useState<string | null>(null);
    const [processingLog, setProcessingLog] = useState<string[]>([]);
    
    // PDF Viewer State
    const [pdfDocs, setPdfDocs] = useState<{ manuscript: pdfjsLib.PDFDocumentProxy | null, ifa: pdfjsLib.PDFDocumentProxy | null }>({ manuscript: null, ifa: null });
    const [pdfScales, setPdfScales] = useState({ manuscript: 0, ifa: 0 });
    const [pageDimensions, setPageDimensions] = useState<{ manuscript: any[], ifa: any[] }>({ manuscript: [], ifa: [] });
    const [activeViewer, setActiveViewer] = useState<'manuscript' | 'ifa'>('manuscript');
    
    const viewerRefs = {
        manuscript: useRef<HTMLDivElement>(null),
        ifa: useRef<HTMLDivElement>(null),
    };
    const pageRefs = {
        manuscript: useRef<Array<HTMLDivElement | null>>([]),
        ifa: useRef<Array<HTMLDivElement | null>>([]),
    }
    const resizeTimer = useRef<ReturnType<typeof setTimeout>>();

    const loadPdf = async (file: File | null, type: 'manuscript' | 'ifa') => {
        if (!file) {
            setPdfDocs(docs => ({ ...docs, [type]: null }));
            return;
        }
        try {
            const fileBuffer = await file.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument(fileBuffer);
            const pdf = await loadingTask.promise;
            setPdfDocs(docs => ({ ...docs, [type]: pdf }));
            pageRefs[type].current = Array(pdf.numPages).fill(null);
        } catch (err) {
            addToast({ type: 'error', message: `Could not load ${type} PDF file.` });
        }
    };

    const handleFileSelect = useCallback((file: File | null, type: 'manuscript' | 'ifa') => {
        setFiles(f => ({ ...f, [type]: file }));
        loadPdf(file, type);
    }, [addToast]);

    const updatePdfDimensions = useCallback(async (pdf: pdfjsLib.PDFDocumentProxy, type: 'manuscript' | 'ifa') => {
        const viewerRef = viewerRefs[type];
        if (!viewerRef.current) return;

        const container = viewerRef.current;
        await new Promise(resolve => setTimeout(resolve, 0));
        const style = window.getComputedStyle(container);
        const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
        const availableWidth = container.clientWidth - paddingX;
        if (availableWidth <= 0) return;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1 });
        const newScale = availableWidth / viewport.width;
        
        setPdfScales(s => ({...s, [type]: newScale}));
        
        const dimensions = [];
        for (let i = 1; i <= pdf.numPages; i++) {
            const p = await pdf.getPage(i);
            const vp = p.getViewport({ scale: newScale });
            dimensions.push({ width: vp.width, height: vp.height });
        }
        setPageDimensions(dims => ({...dims, [type]: dimensions}));
    }, [viewerRefs]);

    useEffect(() => {
        if (status === 'done') {
            if(pdfDocs.manuscript) updatePdfDimensions(pdfDocs.manuscript, 'manuscript');
            if(pdfDocs.ifa) updatePdfDimensions(pdfDocs.ifa, 'ifa');
        }
    }, [status, pdfDocs.manuscript, pdfDocs.ifa, updatePdfDimensions]);

    useEffect(() => {
        const handleResize = () => {
            if (resizeTimer.current) clearTimeout(resizeTimer.current);
            resizeTimer.current = setTimeout(() => {
                 if(pdfDocs.manuscript) updatePdfDimensions(pdfDocs.manuscript, 'manuscript');
                 if(pdfDocs.ifa) updatePdfDimensions(pdfDocs.ifa, 'ifa');
            }, 200);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [pdfDocs.manuscript, pdfDocs.ifa, updatePdfDimensions]);
    
    const handleGoToPage = (pageNum: number, doc: 'manuscript' | 'ifa') => {
        setActiveViewer(doc);
        // Defer scroll to allow viewer to switch and render
        setTimeout(() => {
            const pageElement = pageRefs[doc].current[pageNum - 1];
            pageElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    };

    const runChecks = async () => {
        if (!files.manuscript || !files.ifa || !pdfDocs.manuscript || !pdfDocs.ifa) {
            addToast({type: 'error', message: "Please upload both Manuscript and IFA documents."});
            return;
        }
        if (!currentUser) { addToast({ type: 'error', message: 'No user logged in.' }); return; }
        if (currentUser.tokensUsed >= currentUser.tokenCap) { addToast({ type: 'error', message: 'Token cap reached - contact admin.' }); return; }

        setStatus('processing');
        setResults(null);
        setProcessingLog([]);

        const logProgress = (message: string) => {
            const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
            setProcessingLog(prev => [...prev, `[${timestamp}] ${message}`]);
        };
        
        try {
            logProgress("Extracting text from manuscript...");
            const manuscriptText = await extractTextFromPdf(pdfDocs.manuscript);
            
            logProgress("Extracting rules from IFA document...");
            const ifaText = await extractTextFromPdf(pdfDocs.ifa);
            
            logProgress("Comparing documents using our analysis engine. This may take a moment...");
            const findings = await performComplianceCheck(manuscriptText, ifaText);

            logProgress("All checks complete. Generating final report...");
            addUsageLog({ userId: currentUser.id, toolName: 'Compliance Checker', promptTokens: 0, responseTokens: 0 });
            setResults(findings);
            setStatus('done');
            addToast({type: 'success', message: 'Compliance check complete.'});
        } catch(err) {
            console.error(err);
            const message = err instanceof Error ? err.message : "An unknown error occurred during processing.";
            addToast({type: 'error', message});
            setStatus('idle');
        }
    };

    const handleExport = () => {
        if (!results || !files.manuscript) return;
        let reportContent = `COMPLIANCE REPORT\n========================================\nManuscript: ${files.manuscript.name}\nDate: ${new Date().toLocaleString()}\n\n`;
        results.forEach(check => {
            reportContent += `CHECK: ${check.checkCategory}\nStatus: ${check.status.toUpperCase()}\nSummary: ${check.summary}\n\n`;
            reportContent += `> Manuscript (p. ${check.manuscriptPage}): "${check.manuscriptQuote}"\n`;
            reportContent += `> IFA Guideline (p. ${check.ifaPage}): "${check.ifaRule}"\n\n`;
            reportContent += `Recommendation: ${check.recommendation}\n`;
            reportContent += `----------------------------------------\n\n`;
        });
        const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `compliance-report-${files.manuscript.name}.txt`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        addToast({ type: 'info', message: "Report export initiated." });
    };

    const handleReset = () => {
        setFiles({ manuscript: null, ifa: null });
        setPdfDocs({ manuscript: null, ifa: null });
        setStatus('idle');
        setResults(null);
    };

    const renderStatusIcon = (status: FindingStatus) => {
        switch (status) {
            case 'pass': return <CheckIcon className="h-6 w-6 text-green-500" />;
            case 'warn': return <ExclamationIcon className="h-6 w-6 text-yellow-500" />;
            case 'fail': return <XIcon className="h-6 w-6 text-red-500" />;
            default: return <div className="h-5 w-5 rounded-full bg-gray-300 dark:bg-gray-600"></div>;
        }
    };
    
    const renderIdle = () => (
        <div className="h-full flex flex-col justify-center">
            <div className="max-w-3xl mx-auto w-full space-y-4">
                <FileUpload title="Upload Manuscript" acceptedFileTypes={{ 'application/pdf': ['.pdf'] }} file={files.manuscript} onFileSelect={(file) => handleFileSelect(file, 'manuscript')} />
                <FileUpload title="Upload IFA Form" acceptedFileTypes={{ 'application/pdf': ['.pdf'] }} file={files.ifa} onFileSelect={(file) => handleFileSelect(file, 'ifa')} />
            </div>
            <div className="max-w-3xl mx-auto w-full">
                <button onClick={runChecks} disabled={!files.manuscript || !files.ifa} className="mt-8 w-full py-3 px-4 bg-purple-500 text-white font-semibold rounded-lg hover:bg-purple-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors">Run Compliance Checks</button>
            </div>
        </div>
    );

    const renderProcessing = () => (
        <div className="flex flex-col items-center justify-center h-full">
            <div className="w-full max-w-2xl bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg">
                <h3 className="text-xl font-semibold text-center mb-4">Running Checks on <span className="font-bold text-primary-500">{files.manuscript?.name}</span>...</h3>
                <div className="w-full h-48 bg-gray-900 text-white font-mono text-xs p-4 rounded-lg overflow-y-auto flex flex-col-reverse">
                    <div>
                        {processingLog.map((line, i) => <p key={i} className="animate-fade-in-up">{line}</p>)}
                    </div>
                </div>
                 <div className="text-center mt-4">
                    <Spinner size="md" />
                 </div>
            </div>
        </div>
    );
    
    const renderResults = () => {
        if (!results) return null;
        
        const issuesFound = results.filter(c => c.status !== 'pass').length;
        const overallStatus: FindingStatus = results.some(c => c.status === 'fail') ? 'fail' : results.some(c => c.status === 'warn') ? 'warn' : 'pass';

        const overallStatusStyles = {
            pass: { bg: 'bg-green-100 dark:bg-green-900/50', border: 'border-green-500', text: 'text-green-800 dark:text-green-200', title: 'Compliance Passed' },
            warn: { bg: 'bg-yellow-100 dark:bg-yellow-900/50', border: 'border-yellow-500', text: 'text-yellow-800 dark:text-yellow-200', title: 'Requires Attention' },
            fail: { bg: 'bg-red-100 dark:bg-red-900/50', border: 'border-red-500', text: 'text-red-800 dark:text-red-200', title: 'Compliance Issues Found' },
        };
        const styles = overallStatusStyles[overallStatus];

        return (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-full overflow-hidden">
                <div className="lg:col-span-2 h-full flex flex-col overflow-hidden">
                    <div className="flex-shrink-0 mb-6 flex justify-between items-center">
                        <h3 className="text-xl font-bold truncate">Compliance Report</h3>
                        <div className="space-x-2 flex-shrink-0">
                            <button onClick={handleReset} className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md">Start Over</button>
                            <button onClick={handleExport} className="px-4 py-2 text-sm bg-green-500 text-white rounded-md hover:bg-green-600 inline-flex items-center"><DownloadIcon className="h-4 w-4 mr-2"/>Export</button>
                        </div>
                    </div>
                    
                    <div className={`flex-shrink-0 ${styles.bg} border-l-4 ${styles.border} ${styles.text} p-4 rounded-r-lg mb-6`} role="alert">
                        <p className="font-bold">{styles.title}</p>
                        <p className="text-sm">Found {issuesFound} issue{issuesFound === 1 ? '' : 's'} requiring attention. See details below.</p>
                    </div>

                    <div className="flex-grow overflow-y-auto pr-2 space-y-3">
                        {results.map((finding, index) => {
                            const isSelected = openAccordion === finding.checkCategory;
                            return (
                                <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                                    <button onClick={() => setOpenAccordion(isSelected ? null : finding.checkCategory)} className="w-full flex items-center justify-between p-4 text-left">
                                        <div className="flex items-center space-x-3">{renderStatusIcon(finding.status)}<span className="font-semibold">{finding.checkCategory}</span></div>
                                        <div className="flex items-center space-x-4"><span className="text-sm text-gray-500 truncate">{finding.summary}</span><ChevronDownIcon className={`h-5 w-5 text-gray-500 transition-transform duration-300 ${isSelected ? 'rotate-180' : ''}`} /></div>
                                    </button>
                                    {isSelected && <div className="px-6 pb-4 border-t border-gray-200 dark:border-gray-700">
                                        <div className="mt-4 text-gray-700 dark:text-gray-300 prose prose-sm dark:prose-invert max-w-none space-y-4">
                                            <div>
                                                <h4 className="font-semibold text-gray-900 dark:text-gray-100">IFA Guideline <button onClick={() => handleGoToPage(finding.ifaPage, 'ifa')} className="text-primary-500 hover:underline text-xs">(p. {finding.ifaPage})</button></h4>
                                                <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-600 dark:text-gray-400">{finding.ifaRule}</blockquote>
                                            </div>
                                             <div>
                                                <h4 className="font-semibold text-gray-900 dark:text-gray-100">Manuscript Content <button onClick={() => handleGoToPage(finding.manuscriptPage, 'manuscript')} className="text-primary-500 hover:underline text-xs">(p. {finding.manuscriptPage})</button></h4>
                                                <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-600 dark:text-gray-400">{finding.manuscriptQuote}</blockquote>
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-gray-900 dark:text-gray-100">Recommendation</h4>
                                                <p>{finding.recommendation}</p>
                                            </div>
                                        </div>
                                    </div>}
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="lg:col-span-3 h-full flex flex-col overflow-hidden bg-gray-200 dark:bg-gray-700 rounded-lg shadow-inner">
                     <div className="flex-shrink-0 p-2 bg-gray-300 dark:bg-gray-800 flex items-center justify-center space-x-2">
                        <button onClick={() => setActiveViewer('manuscript')} className={`px-4 py-1.5 text-sm rounded-md ${activeViewer === 'manuscript' ? 'bg-primary-500 text-white' : 'bg-white dark:bg-gray-700 hover:bg-gray-100'}`}>Manuscript</button>
                        <button onClick={() => setActiveViewer('ifa')} className={`px-4 py-1.5 text-sm rounded-md ${activeViewer === 'ifa' ? 'bg-primary-500 text-white' : 'bg-white dark:bg-gray-700 hover:bg-gray-100'}`}>IFA Document</button>
                    </div>

                    <div className="flex-grow overflow-y-auto relative">
                        <div ref={viewerRefs.manuscript} className={`h-full w-full overflow-y-auto p-2 md:p-4 ${activeViewer === 'manuscript' ? '' : 'hidden'}`}>
                            {pdfDocs.manuscript && pageDimensions.manuscript.length > 0 && pageDimensions.manuscript.map((dim, index) => (
                                <div key={`ms_page_${index + 1}`} ref={el => { if(el) pageRefs.manuscript.current[index] = el; }} className="relative shadow-lg mb-4 bg-white dark:bg-gray-800 mx-auto" style={{ width: dim.width, height: dim.height }}>
                                    <LazyPdfPage pdfDoc={pdfDocs.manuscript!} pageNum={index + 1} scale={pdfScales.manuscript} viewerRef={viewerRefs.manuscript} />
                                </div>
                            ))}
                        </div>
                        <div ref={viewerRefs.ifa} className={`h-full w-full overflow-y-auto p-2 md:p-4 ${activeViewer === 'ifa' ? '' : 'hidden'}`}>
                            {pdfDocs.ifa && pageDimensions.ifa.length > 0 && pageDimensions.ifa.map((dim, index) => (
                                <div key={`ifa_page_${index + 1}`} ref={el => { if(el) pageRefs.ifa.current[index] = el; }} className="relative shadow-lg mb-4 bg-white dark:bg-gray-800 mx-auto" style={{ width: dim.width, height: dim.height }}>
                                    <LazyPdfPage pdfDoc={pdfDocs.ifa!} pageNum={index + 1} scale={pdfScales.ifa} viewerRef={viewerRefs.ifa} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="animate-fade-in h-full flex flex-col p-4 md:p-6 lg:p-8 bg-gray-100 dark:bg-gray-900">
            <div className="flex items-center mb-6 flex-shrink-0">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 mr-3"><ChevronLeftIcon className="h-5 w-5" /></button>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">IFA Compliance Checker</h2>
            </div>
            <div className="flex-grow overflow-hidden">
                {status === 'idle' && renderIdle()}
                {status === 'processing' && renderProcessing()}
                {status === 'done' && renderResults()}
            </div>
        </div>
    );
};

export default ComplianceChecker;
