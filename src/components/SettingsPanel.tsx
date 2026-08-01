import { motion, AnimatePresence } from 'motion/react';
import {
    CheckCircle2,
    XCircle,
    Loader2,
    RefreshCcw,
    HelpCircle,
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { ModelConfig, TestStatus } from '../types';

interface SettingsPanelProps {
    open: boolean;
    modelConfig: ModelConfig;
    batchSize: number;
    testStatus: TestStatus;
    testMessage: string;
    onChange: (config: ModelConfig) => void;
    onBatchSizeChange: (size: number) => void;
    onTestConnection: () => void;
}

export default function SettingsPanel({
    open,
    modelConfig,
    batchSize,
    testStatus,
    testMessage,
    onChange,
    onBatchSizeChange,
    onTestConnection,
}: SettingsPanelProps) {
    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                >
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">
                                Model ID
                            </label>
                            <input
                                type="text"
                                value={modelConfig.model}
                                onChange={(e) =>
                                    onChange({
                                        ...modelConfig,
                                        model: e.target.value,
                                    })
                                }
                                placeholder="e.g. gpt-4o, gemini-3.1-pro-preview"
                                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-600 mt-2 cursor-pointer group relative w-fit">
                                <input
                                    type="checkbox"
                                    checked={modelConfig.isMultimodal || false}
                                    onChange={(e) =>
                                        onChange({
                                            ...modelConfig,
                                            isMultimodal: e.target.checked,
                                        })
                                    }
                                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                />
                                Enable Multimodal (Read PDF directly)
                                <HelpCircle
                                    size={14}
                                    className="text-slate-400"
                                />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 text-center pointer-events-none">
                                    If enabled, the original PDF file will be
                                    sent directly to the model instead of
                                    extracting text locally. This requires a
                                    model that natively supports multimodal PDF
                                    reading (e.g. Gemini 1.5 Pro).
                                </div>
                            </label>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">
                                API address
                            </label>
                            <input
                                type="text"
                                value={modelConfig.baseUrl}
                                onChange={(e) =>
                                    onChange({
                                        ...modelConfig,
                                        baseUrl: e.target.value,
                                    })
                                }
                                placeholder="https://..."
                                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">
                                API Key
                            </label>
                            <input
                                type="password"
                                value={modelConfig.apiKey}
                                onChange={(e) =>
                                    onChange({
                                        ...modelConfig,
                                        apiKey: e.target.value,
                                    })
                                }
                                placeholder="Enter API Key (Optional if using built-in key)"
                                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">
                                Parallel files ({batchSize})
                            </label>
                            <input
                                type="range"
                                min="1"
                                max="50"
                                value={batchSize}
                                onChange={(e) =>
                                    onBatchSizeChange(parseInt(e.target.value))
                                }
                                className="w-full h-10 py-2 accent-blue-600"
                            />
                        </div>

                        <div className="col-span-1 md:col-span-2 lg:col-span-4 pt-2 border-t border-slate-100 flex flex-col items-end gap-2 text-right">
                            <div className="flex gap-3 w-full justify-end">
                                <button
                                    onClick={onTestConnection}
                                    disabled={testStatus === 'testing'}
                                    className={cn(
                                        'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                                        testStatus === 'success'
                                            ? 'bg-green-100 text-green-700'
                                            : testStatus === 'error'
                                              ? 'bg-red-100 text-red-700'
                                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                                    )}
                                >
                                    {testStatus === 'testing' ? (
                                        <Loader2
                                            className="animate-spin"
                                            size={16}
                                        />
                                    ) : testStatus === 'success' ? (
                                        <CheckCircle2 size={16} />
                                    ) : testStatus === 'error' ? (
                                        <XCircle size={16} />
                                    ) : (
                                        <RefreshCcw size={16} />
                                    )}
                                    {testStatus === 'testing'
                                        ? 'Testing...'
                                        : testStatus === 'success'
                                          ? 'Connection Successful'
                                          : testStatus === 'error'
                                            ? 'Connection Failed'
                                            : 'Test Model'}
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
    );
}
