import { useRef } from 'react';
import {
    Upload,
    FileText,
    CheckCircle2,
    XCircle,
    Loader2,
    Trash2,
    Zap,
    Square,
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { ProcessingFile } from '../types';

interface UploadPanelProps {
    files: ProcessingFile[];
    isProcessing: boolean;
    progress: { done: number; total: number } | null;
    onFilesAdded: (files: File[]) => void;
    onRemoveFile: (id: string) => void;
    onClearAll: () => void;
    onStart: () => void;
    onCancel: () => void;
}

export default function UploadPanel({
    files,
    isProcessing,
    progress,
    onFilesAdded,
    onRemoveFile,
    onClearAll,
    onStart,
    onCancel,
}: UploadPanelProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canStart =
        !isProcessing &&
        files.some((f) => f.status === 'pending' || f.status === 'error');

    return (
        <>
            {/* Dropzone */}
            <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files) {
                        onFilesAdded(Array.from(e.dataTransfer.files));
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
                        if (e.target.files) {
                            onFilesAdded(Array.from(e.target.files));
                        }
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
                    <h3 className="font-bold text-slate-900">
                        Click or drag to upload literature
                    </h3>
                </div>
            </div>

            {/* File list */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden h-[500px]">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                        <FileText size={16} className="text-slate-400" />
                        Pending processing list ({files.length})
                    </span>
                    <button
                        onClick={onClearAll}
                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors rounded-md hover:bg-red-50"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {files.map((f) => (
                        <div
                            key={f.id}
                            title={f.error}
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 group text-sm"
                        >
                            <div
                                className={cn(
                                    'p-1.5 rounded-md shrink-0',
                                    f.status === 'completed'
                                        ? 'bg-green-100 text-green-600'
                                        : f.status === 'processing'
                                          ? 'bg-blue-100 text-blue-600'
                                          : f.status === 'error'
                                            ? 'bg-red-100 text-red-600'
                                            : 'bg-slate-100 text-slate-500',
                                )}
                            >
                                {f.status === 'completed' ? (
                                    <CheckCircle2 size={14} />
                                ) : f.status === 'processing' ? (
                                    <Loader2
                                        size={14}
                                        className="animate-spin"
                                    />
                                ) : f.status === 'error' ? (
                                    <XCircle size={14} />
                                ) : (
                                    <FileText size={14} />
                                )}
                            </div>
                            <span className="truncate flex-1 font-medium text-slate-600">
                                {f.file.name}
                                {f.error && (
                                    <span className="block text-xs text-red-500 font-normal truncate max-w-[220px]">
                                        {f.error}
                                    </span>
                                )}
                            </span>
                            {f.status === 'pending' && !isProcessing && (
                                <button
                                    onClick={() => onRemoveFile(f.id)}
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
                {isProcessing && progress && (
                    <div className="px-4 pb-2">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                            <span>Processing</span>
                            <span>
                                {progress.done} / {progress.total}
                            </span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-600 transition-all"
                                style={{
                                    width: `${
                                        progress.total
                                            ? Math.round(
                                                  (progress.done /
                                                      progress.total) *
                                                      100,
                                              )
                                            : 0
                                    }%`,
                                }}
                            />
                        </div>
                    </div>
                )}
                <div className="p-4 border-t border-slate-100">
                    {isProcessing ? (
                        <button
                            onClick={onCancel}
                            className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-600/20"
                        >
                            <Square size={18} />
                            Cancel
                        </button>
                    ) : (
                        <button
                            onClick={onStart}
                            disabled={!canStart}
                            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20"
                        >
                            <Zap size={18} />
                            Run the analysis
                        </button>
                    )}
                </div>
            </div>
        </>
    );
}
