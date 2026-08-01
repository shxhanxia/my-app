import { useState, useEffect, useRef } from 'react';
import { Settings } from 'lucide-react';
import { cn } from './lib/utils';
import { processPdf, testConnection } from './lib/aiService';
import { extractTextFromPdf } from './lib/pdfWorker';
import { exportToExcel } from './lib/excelHelper';
import SettingsPanel from './components/SettingsPanel';
import UploadPanel from './components/UploadPanel';
import ResultsTable from './components/ResultsTable';
import ErrorBoundary from './components/ErrorBoundary';
import type {
    ClinicalData,
    ModelConfig,
    ProcessingFile,
    TestStatus,
} from './types';
import logo from './logo.jpg';

const STORAGE_KEY = 'ai_clinical_config';
const DEFAULT_MODEL = 'gemini-3.1-pro-preview';

export default function App() {
    const [modelConfig, setModelConfig] = useState<ModelConfig>({
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        apiKey: '',
        model: DEFAULT_MODEL,
        isMultimodal: false,
    });
    const [batchSize, setBatchSize] = useState(10);
    const [files, setFiles] = useState<ProcessingFile[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [progress, setProgress] = useState<{
        done: number;
        total: number;
    } | null>(null);
    const [testStatus, setTestStatus] = useState<TestStatus>('idle');
    const [testMessage, setTestMessage] = useState('');

    const cancelRef = useRef(false);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Load settings from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                setModelConfig((prev) => ({ ...prev, ...JSON.parse(saved) }));
            } catch (e) {
                console.error('Failed to load settings from localStorage');
            }
        }
    }, []);

    // Update state immediately, but debounce the localStorage write.
    const saveSettings = (newConfig: ModelConfig) => {
        setModelConfig(newConfig);
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
        }, 300);
    };

    const handleTestConnection = async () => {
        setTestStatus('testing');
        setTestMessage('');
        const result = await testConnection(modelConfig);
        setTestStatus(result.success ? 'success' : 'error');
        if (!result.success && result.message) {
            setTestMessage(result.message);
        }
        setTimeout(() => {
            setTestStatus('idle');
            setTestMessage('');
        }, 4000);
    };

    const addFiles = (incoming: File[]) => {
        const newFiles: ProcessingFile[] = incoming
            .filter((f) => f.name.toLowerCase().endsWith('.pdf'))
            .map((file) => ({
                file,
                id: Math.random().toString(36).substring(7) + Date.now(),
                status: 'pending' as const,
            }));
        setFiles((prev) => [...prev, ...newFiles]);
    };

    const removeFile = (id: string) => {
        setFiles((prev) => prev.filter((f) => f.id !== id));
    };

    const clearAll = () => {
        if (
            window.confirm(
                'Are you sure you want to clear all files and results?',
            )
        ) {
            setFiles([]);
        }
    };

    const updateResultField = (
        fileId: string,
        index: number,
        field: keyof ClinicalData,
        value: string | null,
    ) => {
        setFiles((prev) =>
            prev.map((f) => {
                if (f.id === fileId && f.results) {
                    const newResults = [...f.results];
                    newResults[index] = {
                        ...newResults[index],
                        [field]: value,
                    };
                    return { ...f, results: newResults };
                }
                return f;
            }),
        );
    };

    const setFileStatus = (id: string, status: ProcessingFile['status']) => {
        setFiles((prev) =>
            prev.map((f) => (f.id === id ? { ...f, status } : f)),
        );
    };

    // Process pending/error files with a concurrency limit (batchSize).
    // Each file gets its own AI call, so one failure doesn't sink the batch.
    const startProcessing = async () => {
        const pendingFiles = files.filter(
            (f) => f.status === 'pending' || f.status === 'error',
        );
        if (pendingFiles.length === 0) return;

        cancelRef.current = false;
        setIsProcessing(true);
        setProgress({ done: 0, total: pendingFiles.length });

        const queue = [...pendingFiles];
        const concurrency = Math.max(1, Math.min(batchSize, queue.length));

        const processOne = async (pf: ProcessingFile) => {
            setFileStatus(pf.id, 'processing');
            try {
                let results: ClinicalData[];
                if (modelConfig.isMultimodal) {
                    results = await processPdf(
                        { name: pf.file.name, file: pf.file },
                        modelConfig,
                    );
                } else {
                    const content = await extractTextFromPdf(pf.file);
                    results = await processPdf(
                        { name: pf.file.name, content },
                        modelConfig,
                    );
                }
                setFiles((prev) =>
                    prev.map((f) =>
                        f.id === pf.id
                            ? { ...f, status: 'completed', results }
                            : f,
                    ),
                );
            } catch (error: any) {
                console.error(`Processing failed for ${pf.file.name}:`, error);
                setFiles((prev) =>
                    prev.map((f) =>
                        f.id === pf.id
                            ? {
                                  ...f,
                                  status: 'error',
                                  error: error?.message || String(error),
                              }
                            : f,
                    ),
                );
            } finally {
                setProgress((p) =>
                    p ? { done: p.done + 1, total: p.total } : p,
                );
            }
        };

        const workers = Array.from({ length: concurrency }, async () => {
            while (queue.length > 0) {
                if (cancelRef.current) return;
                const pf = queue.shift()!;
                if (cancelRef.current) return;
                await processOne(pf);
            }
        });

        await Promise.all(workers);
        setIsProcessing(false);
        setProgress(null);
    };

    const cancelProcessing = () => {
        cancelRef.current = true;
        setIsProcessing(false);
        setProgress(null);
    };

    const exportData = async () => {
        const dataToExport = files
            .filter(
                (f) =>
                    f.status === 'completed' &&
                    f.results &&
                    f.results.length > 0,
            )
            .flatMap((f) => f.results!);

        if (dataToExport.length === 0) {
            alert('No completed results to export');
            return;
        }
        setIsExporting(true);
        try {
            // Yield so the button's loading state renders before blocking.
            await new Promise((r) => setTimeout(r, 0));
            await exportToExcel(dataToExport);
        } finally {
            setIsExporting(false);
        }
    };

    const doneCount = files.filter((f) => f.status === 'completed').length;

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-1 rounded-lg">
                            <img
                                src={logo}
                                alt="Logo"
                                className="w-8 h-8 rounded"
                            />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">
                                Data Mining Tool for Clinical Case Report
                            </h1>
                            <p className="text-xs text-slate-500 font-medium">
                                Smart Data Intelligence for Clinical Literature
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={cn(
                                'p-2 rounded-full transition-colors',
                                showSettings
                                    ? 'bg-slate-100 text-blue-600'
                                    : 'hover:bg-slate-100 text-slate-600',
                            )}
                        >
                            <Settings size={20} />
                        </button>
                        <div className="h-4 w-px bg-slate-200" />
                        <span className="text-sm font-medium text-slate-500">
                            {doneCount} / {files.length} Done
                        </span>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-4 lg:p-8 flex flex-col gap-8">
                <SettingsPanel
                    open={showSettings}
                    modelConfig={modelConfig}
                    batchSize={batchSize}
                    testStatus={testStatus}
                    testMessage={testMessage}
                    onChange={saveSettings}
                    onBatchSizeChange={setBatchSize}
                    onTestConnection={handleTestConnection}
                />

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Sidebar / Upload Panel */}
                    <div className="lg:col-span-4 flex flex-col gap-6">
                        <UploadPanel
                            files={files}
                            isProcessing={isProcessing}
                            progress={progress}
                            onFilesAdded={addFiles}
                            onRemoveFile={removeFile}
                            onClearAll={clearAll}
                            onStart={startProcessing}
                            onCancel={cancelProcessing}
                        />
                    </div>

                    {/* Results Table Panel */}
                    <div className="lg:col-span-8 flex flex-col gap-6">
                        <ErrorBoundary>
                            <ResultsTable
                                files={files}
                                isExporting={isExporting}
                                onExport={exportData}
                                onUpdateResult={updateResultField}
                            />
                        </ErrorBoundary>
                    </div>
                </div>
            </main>

            <footer className="max-w-7xl mx-auto px-4 py-12 text-center text-slate-400 text-xs font-medium">
                © 2026 Clinical Intelligence Platform. AI Powered Medical
                Research Extraction.
            </footer>
        </div>
    );
}
