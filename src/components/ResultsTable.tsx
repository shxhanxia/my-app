import { Loader2, Download } from 'lucide-react';
import EditableCell from './EditableCell';
import type { ClinicalData, ProcessingFile } from '../types';

interface ResultsTableProps {
    files: ProcessingFile[];
    isExporting: boolean;
    onExport: () => void;
    onUpdateResult: (
        fileId: string,
        index: number,
        field: keyof ClinicalData,
        value: string | null,
    ) => void;
}

export default function ResultsTable({
    files,
    isExporting,
    onExport,
    onUpdateResult,
}: ResultsTableProps) {
    const completedCount = files.filter(
        (f) => f.status === 'completed',
    ).length;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden min-h-[600px]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-slate-900">
                        Results
                    </h2>
                </div>
                <button
                    onClick={onExport}
                    disabled={completedCount === 0 || isExporting}
                    className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-50 disabled:text-slate-300 text-white rounded-xl text-sm font-bold transition-all"
                >
                    {isExporting ? (
                        <Loader2 size={16} className="animate-spin" />
                    ) : (
                        <Download size={16} />
                    )}
                    {isExporting ? 'Exporting...' : 'Export results'}
                </button>
            </div>

            <div className="flex-1 overflow-x-auto pb-4">
                <table className="w-full text-left text-sm border-collapse min-w-max">
                    <thead className="bg-slate-50/80 sticky top-0 backdrop-blur-sm z-10">
                        <tr>
                            <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200 sticky left-0 bg-slate-50/95 shadow-[1px_0_0_0_#e2e8f0]">
                                Filename
                            </th>
                            <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">
                                Gender
                            </th>
                            <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">
                                Age (years)
                            </th>
                            <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">
                                Height (cm)
                            </th>
                            <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">
                                Weight (kg)
                            </th>
                            <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">
                                Heart rate (bpm)
                            </th>
                            <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">
                                SBP (mmHg)
                            </th>
                            <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">
                                DBP (mmHg)
                            </th>
                            <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">
                                Complication
                            </th>
                            <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">
                                Mutant Gene
                            </th>
                            <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">
                                Tumor Location
                            </th>
                            <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">
                                The longest diameter of tumor (mm)
                            </th>
                            <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">
                                Symptom
                            </th>
                            <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">
                                Pathological Type
                            </th>
                            <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">
                                Follow-up period (months)
                            </th>
                            <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">
                                Clinical prognosis
                            </th>
                            <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">
                                Country
                            </th>
                            <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">
                                Number of lumps
                            </th>
                            <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">
                                Author
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {files
                            .filter(
                                (f) =>
                                    f.status === 'completed' ||
                                    f.status === 'processing',
                            )
                            .flatMap((f) => {
                                const resultsToRender =
                                    f.results && f.results.length > 0
                                        ? f.results
                                        : [null];

                                return resultsToRender.map((res, index) => (
                                    <tr
                                        key={`${f.id}-${index}`}
                                        className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 group"
                                    >
                                        <td className="px-4 py-2 sticky left-0 bg-white group-hover:bg-slate-50/50 shadow-[1px_0_0_0_#f1f5f9] max-w-[200px] z-0">
                                            <div
                                                className="truncate font-medium text-slate-900"
                                                title={f.file.name}
                                            >
                                                {f.file.name}
                                                {resultsToRender.length > 1
                                                    ? ` (Case ${index + 1})`
                                                    : ''}
                                            </div>
                                        </td>
                                        {res === null &&
                                        f.status === 'processing' ? (
                                            // Skeleton row while processing
                                            Array.from({ length: 18 }).map(
                                                (_, i) => (
                                                    <td
                                                        key={i}
                                                        className="px-4 py-2"
                                                    >
                                                        <div className="h-6 w-16 bg-slate-100 animate-pulse rounded" />
                                                    </td>
                                                ),
                                            )
                                        ) : (
                                            <>
                                                <td className="px-4 py-2 min-w-[80px]">
                                                    <EditableCell
                                                        value={res?.gender}
                                                        onChange={(v) =>
                                                            onUpdateResult(
                                                                f.id,
                                                                index,
                                                                'gender',
                                                                v,
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td className="px-4 py-2 min-w-[80px]">
                                                    <EditableCell
                                                        value={res?.age}
                                                        onChange={(v) =>
                                                            onUpdateResult(
                                                                f.id,
                                                                index,
                                                                'age',
                                                                v,
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td className="px-4 py-2 min-w-[80px]">
                                                    <EditableCell
                                                        value={res?.height}
                                                        onChange={(v) =>
                                                            onUpdateResult(
                                                                f.id,
                                                                index,
                                                                'height',
                                                                v,
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td className="px-4 py-2 min-w-[80px]">
                                                    <EditableCell
                                                        value={res?.weight}
                                                        onChange={(v) =>
                                                            onUpdateResult(
                                                                f.id,
                                                                index,
                                                                'weight',
                                                                v,
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td className="px-4 py-2 min-w-[100px]">
                                                    <EditableCell
                                                        value={res?.heartRate}
                                                        onChange={(v) =>
                                                            onUpdateResult(
                                                                f.id,
                                                                index,
                                                                'heartRate',
                                                                v,
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td className="px-4 py-2 min-w-[120px]">
                                                    <EditableCell
                                                        value={res?.systolicBP}
                                                        onChange={(v) =>
                                                            onUpdateResult(
                                                                f.id,
                                                                index,
                                                                'systolicBP',
                                                                v,
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td className="px-4 py-2 min-w-[120px]">
                                                    <EditableCell
                                                        value={
                                                            res?.diastolicBP
                                                        }
                                                        onChange={(v) =>
                                                            onUpdateResult(
                                                                f.id,
                                                                index,
                                                                'diastolicBP',
                                                                v,
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td className="px-4 py-2 min-w-[200px]">
                                                    <EditableCell
                                                        value={
                                                            res?.comorbidities
                                                        }
                                                        onChange={(v) =>
                                                            onUpdateResult(
                                                                f.id,
                                                                index,
                                                                'comorbidities',
                                                                v,
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td className="px-4 py-2 min-w-[150px]">
                                                    <EditableCell
                                                        value={res?.mutantGene}
                                                        onChange={(v) =>
                                                            onUpdateResult(
                                                                f.id,
                                                                index,
                                                                'mutantGene',
                                                                v,
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td className="px-4 py-2 min-w-[150px]">
                                                    <EditableCell
                                                        value={
                                                            res?.tumorLocation
                                                        }
                                                        onChange={(v) =>
                                                            onUpdateResult(
                                                                f.id,
                                                                index,
                                                                'tumorLocation',
                                                                v,
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td className="px-4 py-2 min-w-[100px]">
                                                    <EditableCell
                                                        value={
                                                            res?.maxDiameterMm
                                                        }
                                                        onChange={(v) =>
                                                            onUpdateResult(
                                                                f.id,
                                                                index,
                                                                'maxDiameterMm',
                                                                v,
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td className="px-4 py-2 min-w-[200px]">
                                                    <EditableCell
                                                        value={res?.symptoms}
                                                        onChange={(v) =>
                                                            onUpdateResult(
                                                                f.id,
                                                                index,
                                                                'symptoms',
                                                                v,
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td className="px-4 py-2 min-w-[150px]">
                                                    <EditableCell
                                                        value={
                                                            res?.pathologyType
                                                        }
                                                        onChange={(v) =>
                                                            onUpdateResult(
                                                                f.id,
                                                                index,
                                                                'pathologyType',
                                                                v,
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td className="px-4 py-2 min-w-[120px]">
                                                    <EditableCell
                                                        value={
                                                            res?.followUpMonths
                                                        }
                                                        onChange={(v) =>
                                                            onUpdateResult(
                                                                f.id,
                                                                index,
                                                                'followUpMonths',
                                                                v,
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td className="px-4 py-2 min-w-[100px]">
                                                    <EditableCell
                                                        value={res?.isRecurrent}
                                                        onChange={(v) =>
                                                            onUpdateResult(
                                                                f.id,
                                                                index,
                                                                'isRecurrent',
                                                                v,
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td className="px-4 py-2 min-w-[100px]">
                                                    <EditableCell
                                                        value={res?.country}
                                                        onChange={(v) =>
                                                            onUpdateResult(
                                                                f.id,
                                                                index,
                                                                'country',
                                                                v,
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td className="px-4 py-2 min-w-[80px]">
                                                    <EditableCell
                                                        value={res?.tumorCount}
                                                        onChange={(v) =>
                                                            onUpdateResult(
                                                                f.id,
                                                                index,
                                                                'tumorCount',
                                                                v,
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td className="px-4 py-2 min-w-[150px]">
                                                    <EditableCell
                                                        value={res?.author}
                                                        onChange={(v) =>
                                                            onUpdateResult(
                                                                f.id,
                                                                index,
                                                                'author',
                                                                v,
                                                            )
                                                        }
                                                    />
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ));
                            })}
                        {files.length === 0 && (
                            <tr>
                                <td
                                    colSpan={19}
                                    className="px-4 py-20 text-center text-slate-400 italic"
                                >
                                    Waiting for file analysis, no data to
                                    display yet
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
