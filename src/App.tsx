import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings, 
  Upload, 
  FileText, 
  Download, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  BrainCircuit, 
  Trash2,
  RefreshCcw,
  Zap,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { extractTextFromPdf } from './lib/pdfWorker';
import { processBatchOfPdfs, testConnection } from './lib/aiService';
import { exportToExcel } from './lib/excelHelper';
import { ClinicalData, ModelConfig, ProcessingFile } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const EditableCell = ({ value, onChange, placeholder = 'Null' }: { value: any, onChange: (v: string | null) => void, placeholder?: string }) => {
  return (
    <input
      type="text"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      placeholder={placeholder}
      className="w-full bg-transparent border border-transparent focus:border-blue-500 focus:bg-white rounded px-2 py-1 -mx-2 transition-colors text-slate-700 placeholder:text-slate-300 min-w-[60px]"
    />
  );
};

export default function App() {
  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiKey: '',
    model: 'gemini-3.1-pro-preview',
    isMultimodal: false,
  });
  
  const [batchSize, setBatchSize] = useState(10);
  const [files, setFiles] = useState<ProcessingFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load settings from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('ai_clinical_config');
    if (saved) {
      try {
        let parsed = JSON.parse(saved);
        setModelConfig(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error("Failed to load settings from localStorage");
      }
    }
  }, []);

  const saveSettings = (newConfig: ModelConfig) => {
    setModelConfig(newConfig);
    localStorage.setItem('ai_clinical_config', JSON.stringify(newConfig));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files as FileList).filter((f: File) => f.name.toLowerCase().endsWith('.pdf')).map(file => ({
        file,
        id: Math.random().toString(36).substring(7) + Date.now(),
        status: 'pending' as const,
      }));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearAll = () => {
    if (window.confirm('Are you sure you want to clear all files and results?')) {
      setFiles([]);
    }
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

  const updateResultField = (fileId: string, index: number, field: keyof ClinicalData, value: string | null) => {
    setFiles(prev => prev.map(f => {
      if (f.id === fileId && f.results) {
        const newResults = [...f.results];
        newResults[index] = { ...newResults[index], [field]: value };
        return {
          ...f,
          results: newResults
        };
      }
      return f;
    }));
  };

  const startProcessing = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);

    const pendingFiles = files.filter(f => f.status === 'pending' || f.status === 'error');
    
    // Update status to processing
    setFiles(prev => prev.map(f => 
      pendingFiles.find(pf => pf.id === f.id) 
        ? { ...f, status: 'processing' } 
        : f
    ));

    // Process in batches
    for (let i = 0; i < pendingFiles.length; i += batchSize) {
      const batch = pendingFiles.slice(i, i + batchSize);
      
      try {
        // Extract text from all PDFs in batch
        const batchTexts = await Promise.all(
          batch.map(async (pf) => {
            if (modelConfig.isMultimodal) {
              return {
                name: pf.file.name,
                file: pf.file
              };
            }
            return {
              name: pf.file.name,
              content: await extractTextFromPdf(pf.file)
            };
          })
        );

        // Call AI for the batch
        const results = await processBatchOfPdfs(batchTexts, modelConfig);

        // Map results back to files
        setFiles(prev => prev.map(f => {
          const fileResults = results.filter(r => r.pdfName === f.file.name);
          if (fileResults.length > 0 && batch.find(bf => bf.id === f.id)) {
            return { ...f, status: 'completed', results: fileResults };
          } else if (batch.find(bf => bf.id === f.id)) {
            return { ...f, status: 'error', error: "No data extracted" };
          }
          return f;
        }));
      } catch (error: any) {
        console.error("Batch processing error:", error);
        setFiles(prev => prev.map(f => {
          if (batch.find(bf => bf.id === f.id)) {
            return { ...f, status: 'error', error: error.message };
          }
          return f;
        }));
      }
    }

    setIsProcessing(false);
  };

  const exportData = () => {
    const dataToExport = files
      .filter(f => f.status === 'completed' && f.results && f.results.length > 0)
      .flatMap(f => f.results!);
    
    if (dataToExport.length === 0) {
      alert("No completed results to export");
      return;
    }
    exportToExcel(dataToExport);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-lg">
              <img src="/logo.png" alt="Logo" className="w-8 h-8 rounded" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Data Mining Tool for Clinical Case Report</h1>
              <p className="text-xs text-slate-500 font-medium">Smart Data Intelligence for Clinical Literature</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={cn(
                "p-2 rounded-full transition-colors",
                showSettings ? "bg-slate-100 text-blue-600" : "hover:bg-slate-100 text-slate-600"
              )}
            >
              <Settings size={20} />
            </button>
            <div className="h-4 w-px bg-slate-200" />
            <span className="text-sm font-medium text-slate-500">
              {files.filter(f => f.status === 'completed').length} / {files.length} Done
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 lg:p-8 flex flex-col gap-8">
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Model ID</label>
                  <input
                    type="text"
                    value={modelConfig.model}
                    onChange={(e) => saveSettings({ ...modelConfig, model: e.target.value })}
                    placeholder="e.g. gpt-4o, gemini-3.1-pro-preview"
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-600 mt-2 cursor-pointer group relative w-fit">
                    <input 
                      type="checkbox" 
                      checked={modelConfig.isMultimodal || false}
                      onChange={(e) => saveSettings({ ...modelConfig, isMultimodal: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    Enable Multimodal (Read PDF directly)
                    <HelpCircle size={14} className="text-slate-400" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 text-center pointer-events-none">
                      If enabled, the original PDF file will be sent directly to the model instead of extracting text locally. This requires a model that natively supports multimodal PDF reading (e.g. Gemini 1.5 Pro).
                    </div>
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">API address</label>
                  <input
                    type="text"
                    value={modelConfig.baseUrl}
                    onChange={(e) => saveSettings({ ...modelConfig, baseUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">API Key</label>
                  <input
                    type="password"
                    value={modelConfig.apiKey}
                    onChange={(e) => saveSettings({ ...modelConfig, apiKey: e.target.value })}
                    placeholder="Enter API Key (Optional if using built-in key)"
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Batch size ({batchSize})</label>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={batchSize}
                    onChange={(e) => setBatchSize(parseInt(e.target.value))}
                    className="w-full h-10 py-2 accent-blue-600"
                  />
                </div>

                <div className="col-span-1 md:col-span-2 lg:col-span-4 pt-2 border-t border-slate-100 flex flex-col items-end gap-2 text-right">
                  <div className="flex gap-3 w-full justify-end">
                    <button
                      onClick={handleTestConnection}
                      disabled={testStatus === 'testing'}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                        testStatus === 'success' ? "bg-green-100 text-green-700" :
                        testStatus === 'error' ? "bg-red-100 text-red-700" :
                        "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      )}
                    >
                      {testStatus === 'testing' ? <Loader2 className="animate-spin" size={16} /> : 
                       testStatus === 'success' ? <CheckCircle2 size={16} /> :
                       testStatus === 'error' ? <XCircle size={16} /> : <RefreshCcw size={16} />}
                      {testStatus === 'testing' ? 'Testing...' : 
                       testStatus === 'success' ? 'Connection Successful' :
                       testStatus === 'error' ? 'Connection Failed' : 'Test Model'}
                    </button>
                  </div>
                  {testMessage && (
                    <div className="text-xs text-red-500 font-medium max-w-xl text-left bg-red-50 p-2 rounded border border-red-100">
                       {testMessage}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sidebar / Upload Panel */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div 
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files) {
                  const newFiles = Array.from(e.dataTransfer.files as FileList).filter((f: File) => f.name.toLowerCase().endsWith('.pdf')).map(file => ({
                    file,
                    id: Math.random().toString(36).substring(7) + Date.now(),
                    status: 'pending' as const,
                  }));
                  setFiles(prev => [...prev, ...newFiles]);
                }
              }}
              className="bg-white rounded-2xl border-2 border-dashed border-slate-200 hover:border-blue-400 transition-colors p-8 flex flex-col items-center justify-center text-center gap-4 cursor-pointer relative group"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf"
                onChange={(e) => {
                  handleFileChange(e);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
                className="hidden"
              />
              <div className="bg-blue-50 text-blue-600 p-4 rounded-full group-hover:scale-110 transition-transform">
                <Upload size={32} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Click or drag to upload literature</h3>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden h-[500px]">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <FileText size={16} className="text-slate-400" />
                  Pending processing list ({files.length})
                </span>
                <button 
                  onClick={clearAll}
                  className="p-1.5 text-slate-400 hover:text-red-500 transition-colors rounded-md hover:bg-red-50"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {files.map((f) => (
                  <div key={f.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 group text-sm">
                    <div className={cn(
                      "p-1.5 rounded-md shrink-0",
                      f.status === 'completed' ? "bg-green-100 text-green-600" :
                      f.status === 'processing' ? "bg-blue-100 text-blue-600" :
                      f.status === 'error' ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-500"
                    )}>
                      {f.status === 'completed' ? <CheckCircle2 size={14} /> :
                       f.status === 'processing' ? <Loader2 size={14} className="animate-spin" /> :
                       f.status === 'error' ? <XCircle size={14} /> : <FileText size={14} />}
                    </div>
                    <span className="truncate flex-1 font-medium text-slate-600">{f.file.name}</span>
                    {f.status === 'pending' && !isProcessing && (
                      <button 
                        onClick={() => removeFile(f.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
                {files.length === 0 && (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">
                    No files uploaded yet
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-slate-100">
                <button
                  onClick={startProcessing}
                  disabled={isProcessing || files.filter(f => f.status === 'pending' || f.status === 'error').length === 0}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20"
                >
                  {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
                  {isProcessing ? 'Processing...' : 'Run the analysis'}
                </button>
              </div>
            </div>
          </div>

          {/* Results Table Panel */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden min-h-[600px]">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Results</h2>
                </div>
                <button
                  onClick={exportData}
                  disabled={files.filter(f => f.status === 'completed').length === 0}
                  className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-50 disabled:text-slate-300 text-white rounded-xl text-sm font-bold transition-all"
                >
                  <Download size={16} />
                  Export results
                </button>
              </div>

              <div className="flex-1 overflow-x-auto pb-4">
                <table className="w-full text-left text-sm border-collapse min-w-max">
                  <thead className="bg-slate-50/80 sticky top-0 backdrop-blur-sm z-10">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200 sticky left-0 bg-slate-50/95 shadow-[1px_0_0_0_#e2e8f0]">Filename</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">Gender</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">Age (years)</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">Height (cm)</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">Weight (kg)</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">Heart rate (bpm)</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">SBP (mmHg)</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">DBP (mmHg)</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">Complication</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">Mutant Gene</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">Tumor Location</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">The longest diameter of tumor (mm)</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">Symptom</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">Pathological Type</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">Follow-up period (months)</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">Clinical prognosis</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">Country</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">Number of lumps</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">Author</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.filter(f => f.status === 'completed' || f.status === 'processing').flatMap((f) => {
                      const resultsToRender = (f.results && f.results.length > 0) ? f.results : [null];
                      
                      return resultsToRender.map((res, index) => (
                        <tr key={`${f.id}-${index}`} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 group">
                          <td className="px-4 py-2 sticky left-0 bg-white group-hover:bg-slate-50/50 shadow-[1px_0_0_0_#f1f5f9] max-w-[200px] z-0">
                            <div className="truncate font-medium text-slate-900" title={f.file.name}>
                              {f.file.name}{resultsToRender.length > 1 ? ` (Case ${index + 1})` : ''}
                            </div>
                          </td>
                          <td className="px-4 py-2 min-w-[80px]">
                            {f.status === 'processing' ? <div className="h-6 w-16 bg-slate-100 animate-pulse rounded" /> : (
                              <EditableCell value={res?.gender} onChange={(v) => updateResultField(f.id, index, 'gender', v)} />
                            )}
                          </td>
                          <td className="px-4 py-2 min-w-[80px]">
                            {f.status === 'processing' ? <div className="h-6 w-10 bg-slate-100 animate-pulse rounded" /> : (
                              <EditableCell value={res?.age} onChange={(v) => updateResultField(f.id, index, 'age', v)} />
                            )}
                          </td>
                          <td className="px-4 py-2 min-w-[80px]">
                            {f.status === 'processing' ? <div className="h-6 w-12 bg-slate-100 animate-pulse rounded" /> : (
                              <EditableCell value={res?.height} onChange={(v) => updateResultField(f.id, index, 'height', v)} />
                            )}
                          </td>
                          <td className="px-4 py-2 min-w-[80px]">
                            {f.status === 'processing' ? <div className="h-6 w-12 bg-slate-100 animate-pulse rounded" /> : (
                              <EditableCell value={res?.weight} onChange={(v) => updateResultField(f.id, index, 'weight', v)} />
                            )}
                          </td>
                          <td className="px-4 py-2 min-w-[100px]">
                            {f.status === 'processing' ? <div className="h-6 w-12 bg-slate-100 animate-pulse rounded" /> : (
                              <EditableCell value={res?.heartRate} onChange={(v) => updateResultField(f.id, index, 'heartRate', v)} />
                            )}
                          </td>
                          <td className="px-4 py-2 min-w-[120px]">
                            {f.status === 'processing' ? <div className="h-6 w-12 bg-slate-100 animate-pulse rounded" /> : (
                              <EditableCell value={res?.systolicBP} onChange={(v) => updateResultField(f.id, index, 'systolicBP', v)} />
                            )}
                          </td>
                          <td className="px-4 py-2 min-w-[120px]">
                            {f.status === 'processing' ? <div className="h-6 w-12 bg-slate-100 animate-pulse rounded" /> : (
                              <EditableCell value={res?.diastolicBP} onChange={(v) => updateResultField(f.id, index, 'diastolicBP', v)} />
                            )}
                          </td>
                          <td className="px-4 py-2 min-w-[200px]">
                            {f.status === 'processing' ? <div className="h-6 w-32 bg-slate-100 animate-pulse rounded" /> : (
                              <EditableCell value={res?.comorbidities} onChange={(v) => updateResultField(f.id, index, 'comorbidities', v)} />
                            )}
                          </td>
                          <td className="px-4 py-2 min-w-[150px]">
                            {f.status === 'processing' ? <div className="h-6 w-16 bg-slate-100 animate-pulse rounded" /> : (
                              <EditableCell value={res?.mutantGene} onChange={(v) => updateResultField(f.id, index, 'mutantGene', v)} />
                            )}
                          </td>
                          <td className="px-4 py-2 min-w-[150px]">
                            {f.status === 'processing' ? <div className="h-6 w-24 bg-slate-100 animate-pulse rounded" /> : (
                              <EditableCell value={res?.tumorLocation} onChange={(v) => updateResultField(f.id, index, 'tumorLocation', v)} />
                            )}
                          </td>
                          <td className="px-4 py-2 min-w-[100px]">
                            {f.status === 'processing' ? <div className="h-6 w-12 bg-slate-100 animate-pulse rounded" /> : (
                              <EditableCell value={res?.maxDiameterMm} onChange={(v) => updateResultField(f.id, index, 'maxDiameterMm', v)} />
                            )}
                          </td>
                          <td className="px-4 py-2 min-w-[200px]">
                            {f.status === 'processing' ? <div className="h-6 w-32 bg-slate-100 animate-pulse rounded" /> : (
                              <EditableCell value={res?.symptoms} onChange={(v) => updateResultField(f.id, index, 'symptoms', v)} />
                            )}
                          </td>
                          <td className="px-4 py-2 min-w-[150px]">
                            {f.status === 'processing' ? <div className="h-6 w-24 bg-slate-100 animate-pulse rounded" /> : (
                              <EditableCell value={res?.pathologyType} onChange={(v) => updateResultField(f.id, index, 'pathologyType', v)} />
                            )}
                          </td>
                          <td className="px-4 py-2 min-w-[120px]">
                            {f.status === 'processing' ? <div className="h-6 w-12 bg-slate-100 animate-pulse rounded" /> : (
                              <EditableCell value={res?.followUpMonths} onChange={(v) => updateResultField(f.id, index, 'followUpMonths', v)} />
                            )}
                          </td>
                          <td className="px-4 py-2 min-w-[100px]">
                            {f.status === 'processing' ? <div className="h-6 w-12 bg-slate-100 animate-pulse rounded" /> : (
                              <EditableCell value={res?.isRecurrent} onChange={(v) => updateResultField(f.id, index, 'isRecurrent', v)} />
                            )}
                          </td>
                          <td className="px-4 py-2 min-w-[100px]">
                            {f.status === 'processing' ? <div className="h-6 w-16 bg-slate-100 animate-pulse rounded" /> : (
                              <EditableCell value={res?.country} onChange={(v) => updateResultField(f.id, index, 'country', v)} />
                            )}
                          </td>
                          <td className="px-4 py-2 min-w-[80px]">
                            {f.status === 'processing' ? <div className="h-6 w-10 bg-slate-100 animate-pulse rounded" /> : (
                              <EditableCell value={res?.tumorCount} onChange={(v) => updateResultField(f.id, index, 'tumorCount', v)} />
                            )}
                          </td>
                          <td className="px-4 py-2 min-w-[150px]">
                            {f.status === 'processing' ? <div className="h-6 w-16 bg-slate-100 animate-pulse rounded" /> : (
                              <EditableCell value={res?.author} onChange={(v) => updateResultField(f.id, index, 'author', v)} />
                            )}
                          </td>
                        </tr>
                      ));
                    })}
                    {files.length === 0 && (
                      <tr>
                        <td colSpan={19} className="px-4 py-20 text-center text-slate-400 italic">
                          Waiting for file analysis, no data to display yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-4 py-12 text-center text-slate-400 text-xs font-medium">
        © 2026 Clinical Intelligence Platform. AI Powered Medical Research Extraction.
      </footer>
    </div>
  );
}
