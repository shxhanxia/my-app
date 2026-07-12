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
  Zap
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
    model: 'gemini-3-flash-preview',
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
        if (parsed.model === 'gemini-2.0-flash') {
          parsed.model = 'gemini-3-flash-preview';
          localStorage.setItem('ai_clinical_config', JSON.stringify(parsed));
        }
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
    if (window.confirm('确定要清除所有文件和结果吗?')) {
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

  const updateResultField = (fileId: string, field: keyof ClinicalData, value: string | null) => {
    setFiles(prev => prev.map(f => {
      if (f.id === fileId && f.result) {
        return {
          ...f,
          result: {
            ...f.result,
            [field]: value
          }
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
          batch.map(async (pf) => ({
            name: pf.file.name,
            content: await extractTextFromPdf(pf.file)
          }))
        );

        // Call AI for the batch
        const results = await processBatchOfPdfs(batchTexts, modelConfig);

        // Map results back to files
        setFiles(prev => prev.map(f => {
          const result = results.find(r => r.pdfName === f.file.name);
          if (result && batch.find(bf => bf.id === f.id)) {
            return { ...f, status: 'completed', result };
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
      .filter(f => f.status === 'completed' && f.result)
      .map(f => f.result!);
    
    if (dataToExport.length === 0) {
      alert("没有可导出的完成结果");
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
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <BrainCircuit size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Clinical PDF Extractor</h1>
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
                  <label className="text-sm font-semibold text-slate-700">模型名称 (Model ID)</label>
                  <input
                    type="text"
                    value={modelConfig.model}
                    onChange={(e) => saveSettings({ ...modelConfig, model: e.target.value })}
                    placeholder="例如: gpt-4o, gemini-2.0-flash, deepseek-chat..."
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">API 地址 (OpenAI 兼容)</label>
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
                    placeholder="请输入 API Key (可选填写内置默认Key)"
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">批次大小 ({batchSize})</label>
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
                      {testStatus === 'testing' ? '正在测试...' : 
                       testStatus === 'success' ? '连接成功' :
                       testStatus === 'error' ? '连接失败' : '测试模型连接'}
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
                <h3 className="font-bold text-slate-900">点击或拖拽上传 PDF</h3>
                <p className="text-sm text-slate-500">支持一并上传多个临床文献文件</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden h-[500px]">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <FileText size={16} className="text-slate-400" />
                  待处理列表 ({files.length})
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
                    暂未上传解析文件
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
                  {isProcessing ? '正在智能解析中...' : '开始批量解析'}
                </button>
              </div>
            </div>
          </div>

          {/* Results Table Panel */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden min-h-[600px]">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">结果汇总看板</h2>
                  <p className="text-xs text-slate-500">实时展示多维度的臨床数据提煉結果</p>
                </div>
                <button
                  onClick={exportData}
                  disabled={files.filter(f => f.status === 'completed').length === 0}
                  className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-50 disabled:text-slate-300 text-white rounded-xl text-sm font-bold transition-all"
                >
                  <Download size={16} />
                  导出 XLSX 报表
                </button>
              </div>

              <div className="flex-1 overflow-x-auto pb-4">
                <table className="w-full text-left text-sm border-collapse min-w-max">
                  <thead className="bg-slate-50/80 sticky top-0 backdrop-blur-sm z-10">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200 sticky left-0 bg-slate-50/95 shadow-[1px_0_0_0_#e2e8f0]">文件名</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">性别</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">年龄</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">身高</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">体重</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">入院时心率</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">入院时收缩压</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">入院时舒张压</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">合并症</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">PRKAR1A基因突变情况</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">肿瘤位置</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">最大径(mm)</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">症状</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">病理类型</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">随访时间(月)</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">是否复发</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">作者国家</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">肿瘤数量</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.filter(f => f.status === 'completed' || f.status === 'processing').map((f) => (
                      <tr key={f.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 group">
                        <td className="px-4 py-2 sticky left-0 bg-white group-hover:bg-slate-50/50 shadow-[1px_0_0_0_#f1f5f9] max-w-[200px] z-0">
                          <div className="truncate font-medium text-slate-900" title={f.file.name}>
                            {f.file.name}
                          </div>
                        </td>
                        <td className="px-4 py-2 min-w-[80px]">
                          {f.status === 'processing' ? <div className="h-6 w-16 bg-slate-100 animate-pulse rounded" /> : (
                            <EditableCell value={f.result?.gender} onChange={(v) => updateResultField(f.id, 'gender', v)} />
                          )}
                        </td>
                        <td className="px-4 py-2 min-w-[80px]">
                          {f.status === 'processing' ? <div className="h-6 w-10 bg-slate-100 animate-pulse rounded" /> : (
                            <EditableCell value={f.result?.age} onChange={(v) => updateResultField(f.id, 'age', v)} />
                          )}
                        </td>
                        <td className="px-4 py-2 min-w-[80px]">
                          {f.status === 'processing' ? <div className="h-6 w-12 bg-slate-100 animate-pulse rounded" /> : (
                            <EditableCell value={f.result?.height} onChange={(v) => updateResultField(f.id, 'height', v)} />
                          )}
                        </td>
                        <td className="px-4 py-2 min-w-[80px]">
                          {f.status === 'processing' ? <div className="h-6 w-12 bg-slate-100 animate-pulse rounded" /> : (
                            <EditableCell value={f.result?.weight} onChange={(v) => updateResultField(f.id, 'weight', v)} />
                          )}
                        </td>
                        <td className="px-4 py-2 min-w-[100px]">
                          {f.status === 'processing' ? <div className="h-6 w-12 bg-slate-100 animate-pulse rounded" /> : (
                            <EditableCell value={f.result?.heartRate} onChange={(v) => updateResultField(f.id, 'heartRate', v)} />
                          )}
                        </td>
                        <td className="px-4 py-2 min-w-[120px]">
                          {f.status === 'processing' ? <div className="h-6 w-12 bg-slate-100 animate-pulse rounded" /> : (
                            <EditableCell value={f.result?.systolicBP} onChange={(v) => updateResultField(f.id, 'systolicBP', v)} />
                          )}
                        </td>
                        <td className="px-4 py-2 min-w-[120px]">
                          {f.status === 'processing' ? <div className="h-6 w-12 bg-slate-100 animate-pulse rounded" /> : (
                            <EditableCell value={f.result?.diastolicBP} onChange={(v) => updateResultField(f.id, 'diastolicBP', v)} />
                          )}
                        </td>
                        <td className="px-4 py-2 min-w-[200px]">
                          {f.status === 'processing' ? <div className="h-6 w-32 bg-slate-100 animate-pulse rounded" /> : (
                            <EditableCell value={f.result?.comorbidities} onChange={(v) => updateResultField(f.id, 'comorbidities', v)} />
                          )}
                        </td>
                        <td className="px-4 py-2 min-w-[150px]">
                          {f.status === 'processing' ? <div className="h-6 w-16 bg-slate-100 animate-pulse rounded" /> : (
                            <EditableCell value={f.result?.prkar1a} onChange={(v) => updateResultField(f.id, 'prkar1a', v)} />
                          )}
                        </td>
                        <td className="px-4 py-2 min-w-[150px]">
                          {f.status === 'processing' ? <div className="h-6 w-24 bg-slate-100 animate-pulse rounded" /> : (
                            <EditableCell value={f.result?.tumorLocation} onChange={(v) => updateResultField(f.id, 'tumorLocation', v)} />
                          )}
                        </td>
                        <td className="px-4 py-2 min-w-[100px]">
                          {f.status === 'processing' ? <div className="h-6 w-12 bg-slate-100 animate-pulse rounded" /> : (
                            <EditableCell value={f.result?.maxDiameterMm} onChange={(v) => updateResultField(f.id, 'maxDiameterMm', v)} />
                          )}
                        </td>
                        <td className="px-4 py-2 min-w-[200px]">
                          {f.status === 'processing' ? <div className="h-6 w-32 bg-slate-100 animate-pulse rounded" /> : (
                            <EditableCell value={f.result?.symptoms} onChange={(v) => updateResultField(f.id, 'symptoms', v)} />
                          )}
                        </td>
                        <td className="px-4 py-2 min-w-[150px]">
                          {f.status === 'processing' ? <div className="h-6 w-24 bg-slate-100 animate-pulse rounded" /> : (
                            <EditableCell value={f.result?.pathologyType} onChange={(v) => updateResultField(f.id, 'pathologyType', v)} />
                          )}
                        </td>
                        <td className="px-4 py-2 min-w-[120px]">
                          {f.status === 'processing' ? <div className="h-6 w-12 bg-slate-100 animate-pulse rounded" /> : (
                            <EditableCell value={f.result?.followUpMonths} onChange={(v) => updateResultField(f.id, 'followUpMonths', v)} />
                          )}
                        </td>
                        <td className="px-4 py-2 min-w-[100px]">
                          {f.status === 'processing' ? <div className="h-6 w-12 bg-slate-100 animate-pulse rounded" /> : (
                            <EditableCell value={f.result?.isRecurrent} onChange={(v) => updateResultField(f.id, 'isRecurrent', v)} />
                          )}
                        </td>
                        <td className="px-4 py-2 min-w-[100px]">
                          {f.status === 'processing' ? <div className="h-6 w-16 bg-slate-100 animate-pulse rounded" /> : (
                            <EditableCell value={f.result?.country} onChange={(v) => updateResultField(f.id, 'country', v)} />
                          )}
                        </td>
                        <td className="px-4 py-2 min-w-[80px]">
                          {f.status === 'processing' ? <div className="h-6 w-10 bg-slate-100 animate-pulse rounded" /> : (
                            <EditableCell value={f.result?.tumorCount} onChange={(v) => updateResultField(f.id, 'tumorCount', v)} />
                          )}
                        </td>
                      </tr>
                    ))}
                    {files.length === 0 && (
                      <tr>
                        <td colSpan={18} className="px-4 py-20 text-center text-slate-400 italic">
                          等待文件解析，暂无数据展示
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
