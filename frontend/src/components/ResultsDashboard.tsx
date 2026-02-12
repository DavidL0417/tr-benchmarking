import React, { useMemo, useState } from 'react';
import { CheckCircle2, XCircle, Search, BarChart3, List } from 'lucide-react';
import { QuestionDetailModal } from './QuestionDetailModal';

type VariantType = 'baseline' | 'shuffle' | 'normalize' | 'irrelevant';

type ResultItem = {
    model: string;
    questionId: string;
    originalQuestion: string;
    modelOutput: string;
    parsedChoice: string;
    groundTruth: string;
    originalGroundTruth: string;
    isCorrect: boolean;
    isPerturbed: boolean;
    questionText: string;
    choices?: string[];
    subfield?: string;
    benchmarkProfile?: 'legacy' | 'controlled';
    evaluationArm?: 'single' | 'deterministic' | 'stochastic';
    parseMethod?: string;
    isSchemaCompliant?: boolean;
    temperatureUsed?: number;
    temperatureApplied?: boolean;
    apiTransport?: 'responses' | 'chat_completions';
    variantType: VariantType;
    variantIndex: number;
    choicePermutation: number[];
    predictedChoiceId: number | null;
    groundTruthChoiceId: number;
    baselineChoiceId: number | null;
    didFlip: boolean | null;
    parseable: boolean;
};

type SplitSummary = {
    total: number;
    correct: number;
    accuracy: number;
};

type ModelSummary = {
    total: number;
    correct: number;
    accuracy: number;
    splitSummary?: Record<string, SplitSummary>;
};

type StabilitySummary = {
    totalComparisons: number;
    totalFlips: number;
    flipRate: number;
    flipRateByVariantType: Record<string, { comparisons: number; flips: number; flipRate: number }>;
    flipRateByModel?: Record<string, { comparisons: number; flips: number; flipRate: number }>;
    baselineParseFailureRate: number;
};

type ExperimentSummary = {
    total: number;
    correct: number;
    accuracy: number;
    benchmarkProfile?: 'legacy' | 'controlled';
    splitSummary?: Record<string, SplitSummary>;
    modelSummary?: Record<string, ModelSummary>;
    stability?: StabilitySummary;
};

interface ResultsDashboardProps {
    results: ResultItem[];
    summary: ExperimentSummary | null;
    isLoading: boolean;
    loadingStatus: string;
}

export function ResultsDashboard({ results, summary, isLoading, loadingStatus }: ResultsDashboardProps) {
    const [selectedQuestion, setSelectedQuestion] = useState<ResultItem | null>(null);
    const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
    const [showVariants, setShowVariants] = useState(false);

    const baselineRows = useMemo(
        () => results.filter((row) => row.variantType === 'baseline'),
        [results]
    );
    const displayedRows = showVariants ? results : baselineRows;
    const splitEntries = Object.entries(summary?.splitSummary || {});
    const modelEntries = Object.entries(summary?.modelSummary || {});
    const chartModels = useMemo(() => Array.from(new Set(baselineRows.map((r) => r.model))), [baselineRows]);
    const chartModelColors = ['#3b82f6', '#10b981', '#f97316', '#8b5cf6', '#ef4444', '#06b6d4'];
    const flipRateByQuestion = useMemo(() => {
        const map = new Map<string, { comparisons: number; flips: number; flipRate: number }>();
        for (const row of results) {
            if (row.variantType === 'baseline' || typeof row.didFlip !== 'boolean') {
                continue;
            }
            const key = `${row.model}:${row.questionId}`;
            if (!map.has(key)) {
                map.set(key, { comparisons: 0, flips: 0, flipRate: 0 });
            }
            const stats = map.get(key)!;
            stats.comparisons += 1;
            if (row.didFlip) {
                stats.flips += 1;
            }
        }
        for (const stats of map.values()) {
            stats.flipRate = stats.comparisons > 0 ? stats.flips / stats.comparisons : 0;
        }
        return map;
    }, [results]);
    const subfieldRows = useMemo(() => {
        const perSubfield = new Map<string, Map<string, { total: number; correct: number }>>();

        for (const row of baselineRows) {
            const subfield = row.subfield || 'Unknown';
            if (!perSubfield.has(subfield)) {
                perSubfield.set(subfield, new Map<string, { total: number; correct: number }>());
            }
            const modelMap = perSubfield.get(subfield)!;
            if (!modelMap.has(row.model)) {
                modelMap.set(row.model, { total: 0, correct: 0 });
            }
            const modelStats = modelMap.get(row.model)!;
            modelStats.total += 1;
            if (row.isCorrect) {
                modelStats.correct += 1;
            }
        }

        const rows = Array.from(perSubfield.entries()).map(([subfield, modelMap]) => {
            const perModel: Record<string, number | null> = {};
            const accuracyValues: number[] = [];
            for (const model of chartModels) {
                const stats = modelMap.get(model);
                if (!stats || stats.total === 0) {
                    perModel[model] = null;
                    continue;
                }
                const accuracy = (stats.correct / stats.total) * 100;
                perModel[model] = accuracy;
                accuracyValues.push(accuracy);
            }

            const averageAccuracy = accuracyValues.length > 0
                ? accuracyValues.reduce((sum, value) => sum + value, 0) / accuracyValues.length
                : 0;

            return { subfield, perModel, averageAccuracy };
        });

        rows.sort((a, b) => a.averageAccuracy - b.averageAccuracy);
        return rows;
    }, [baselineRows, chartModels]);
    const relatedVariants = useMemo(() => {
        if (!selectedQuestion) {
            return [];
        }
        return results
            .filter((row) => row.model === selectedQuestion.model && row.questionId === selectedQuestion.questionId)
            .sort((a, b) => a.variantIndex - b.variantIndex);
    }, [results, selectedQuestion]);
    const stability = summary?.stability;
    const flipByTypeEntries = Object.entries(stability?.flipRateByVariantType || {});
    const flipByModelEntries = Object.entries(stability?.flipRateByModel || {});

    if (isLoading) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-10 border border-blue-100 rounded-xl bg-gradient-to-br from-blue-50/60 to-indigo-50/60">
                <div className="h-12 w-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                <p className="text-xl font-semibold text-gray-800 mt-5">Running Experiment</p>
                <p className="text-sm text-gray-500 mt-2">{loadingStatus}</p>
                <p className="text-xs text-gray-400 mt-4">You can cancel from the left panel at any time.</p>
            </div>
        );
    }

    if (!summary) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 p-10 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                <BarChart3 size={48} className="mb-4 opacity-20" />
                <p className="text-lg font-medium">No results yet</p>
                <p className="text-sm">Run an experiment to see the benchmark data.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500 font-medium uppercase">Baseline Accuracy</p>
                    <div className="flex items-baseline gap-2 mt-1">
                        <span className={`text-4xl font-bold ${summary.accuracy > 0.7 ? 'text-green-600' : summary.accuracy > 0.4 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {(summary.accuracy * 100).toFixed(1)}%
                        </span>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500 font-medium uppercase">Total Questions</p>
                    <p className="text-3xl font-bold text-gray-800 mt-1">{summary.total}</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500 font-medium uppercase">Correct / Total</p>
                    <p className="text-3xl font-bold text-gray-800 mt-1">{summary.correct} <span className="text-lg text-gray-400 font-normal">/ {summary.total}</span></p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500 font-medium uppercase">Flip Rate (Overall)</p>
                    <p className="text-3xl font-bold text-gray-800 mt-1">
                        {stability ? `${(stability.flipRate * 100).toFixed(1)}%` : '--'}
                    </p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500 font-medium uppercase">Baseline Parse Failure</p>
                    <p className="text-3xl font-bold text-gray-800 mt-1">
                        {stability ? `${(stability.baselineParseFailureRate * 100).toFixed(1)}%` : '--'}
                    </p>
                </div>
            </div>

            {modelEntries.length > 1 && (
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500 font-medium uppercase mb-3">Model Comparison</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {modelEntries.map(([model, modelSummary]) => (
                            <div key={model} className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                                <p className="text-xs uppercase font-semibold text-gray-500">{model}</p>
                                <p className="text-xl font-bold text-gray-800 mt-1">{(modelSummary.accuracy * 100).toFixed(1)}%</p>
                                <p className="text-sm text-gray-500">{modelSummary.correct} / {modelSummary.total}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {(flipByTypeEntries.length > 0 || flipByModelEntries.length > 0) && (
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 space-y-4">
                    <p className="text-sm text-gray-500 font-medium uppercase">Stability Breakdown</p>
                    {flipByTypeEntries.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">By Variant Type</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {flipByTypeEntries.map(([type, stats]) => (
                                    <div key={type} className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                                        <p className="text-xs uppercase font-semibold text-gray-500">{type}</p>
                                        <p className="text-xl font-bold text-gray-800 mt-1">{(stats.flipRate * 100).toFixed(1)}%</p>
                                        <p className="text-xs text-gray-500">{stats.flips} / {stats.comparisons}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {flipByModelEntries.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">By Model</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {flipByModelEntries.map(([model, stats]) => (
                                    <div key={model} className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                                        <p className="text-xs uppercase font-semibold text-gray-500">{model}</p>
                                        <p className="text-xl font-bold text-gray-800 mt-1">{(stats.flipRate * 100).toFixed(1)}%</p>
                                        <p className="text-xs text-gray-500">{stats.flips} / {stats.comparisons}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {splitEntries.length > 0 && (
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500 font-medium uppercase mb-3">Determinism Split</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {splitEntries.map(([arm, armSummary]) => (
                            <div key={arm} className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                                <p className="text-xs uppercase font-semibold text-gray-500">{arm}</p>
                                <p className="text-xl font-bold text-gray-800 mt-1">{(armSummary.accuracy * 100).toFixed(1)}%</p>
                                <p className="text-sm text-gray-500">{armSummary.correct} / {armSummary.total}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                        <List size={18} className="text-gray-500" />
                        Detailed Results
                    </h3>
                    <div className="flex items-center gap-3">
                        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                            <input
                                type="checkbox"
                                className="w-4 h-4 accent-blue-600"
                                checked={showVariants}
                                onChange={(e) => setShowVariants(e.target.checked)}
                            />
                            Show variants
                        </label>
                        <div className="flex bg-gray-200 p-1 rounded-lg">
                            <button
                                onClick={() => setViewMode('table')}
                                className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${viewMode === 'table' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Table
                            </button>
                            <button
                                onClick={() => setViewMode('chart')}
                                className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${viewMode === 'chart' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Subfield Chart
                            </button>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {viewMode === 'table' ? (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm text-xs uppercase text-gray-500 font-bold">
                                <tr>
                                    <th className="p-4 w-16">Status</th>
                                    <th className="p-4">Question ID</th>
                                    <th className="p-4">Model</th>
                                    <th className="p-4">Run</th>
                                    <th className="p-4">Variant</th>
                                    <th className="p-4">Model Output</th>
                                    <th className="p-4">Expected</th>
                                    {!showVariants && <th className="p-4">Flip Rate</th>}
                                    {showVariants && <th className="p-4">Did Flip</th>}
                                    <th className="p-4 w-20">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {displayedRows.map((r, i) => {
                                    const key = `${r.model}:${r.questionId}`;
                                    const flipStats = flipRateByQuestion.get(key);
                                    return (
                                        <tr key={`${r.questionId}-${r.model}-${r.evaluationArm || 'single'}-${r.variantIndex}-${i}`} className="hover:bg-blue-50/30 transition-colors group">
                                            <td className="p-4">
                                                {r.isCorrect
                                                    ? <CheckCircle2 className="text-green-500" size={20} />
                                                    : <XCircle className="text-red-500" size={20} />
                                                }
                                            </td>
                                            <td className="p-4 font-mono text-gray-500 text-xs truncate max-w-[150px]" title={r.questionId}>
                                                {r.questionId.substring(0, 8)}...
                                                {r.isPerturbed && <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Adv</span>}
                                            </td>
                                            <td className="p-4">
                                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-indigo-50 text-indigo-700">
                                                    {r.model}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-blue-50 text-blue-700">
                                                    {r.evaluationArm || 'single'}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                                                    {r.variantType} #{r.variantIndex}
                                                </span>
                                            </td>
                                            <td className="p-4 font-medium">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${r.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {r.parsedChoice}
                                                </span>
                                            </td>
                                            <td className="p-4 text-gray-600">
                                                {r.groundTruth}
                                                {r.groundTruth !== r.originalGroundTruth && (
                                                    <span className="ml-2 text-xs text-orange-500" title="Label Noise Applied">(was {r.originalGroundTruth})</span>
                                                )}
                                            </td>
                                            {!showVariants && (
                                                <td className="p-4 text-gray-700">
                                                    {flipStats ? `${(flipStats.flipRate * 100).toFixed(1)}%` : '--'}
                                                </td>
                                            )}
                                            {showVariants && (
                                                <td className="p-4 text-gray-700">
                                                    {r.variantType === 'baseline'
                                                        ? '--'
                                                        : typeof r.didFlip === 'boolean'
                                                            ? (r.didFlip ? 'Yes' : 'No')
                                                            : 'n/a'}
                                                </td>
                                            )}
                                            <td className="p-4">
                                                <button
                                                    onClick={() => setSelectedQuestion(r)}
                                                    className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-blue-600 transition-colors"
                                                >
                                                    <Search size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <div className="p-6 space-y-4">
                            <h4 className="text-lg font-semibold text-gray-800">Weakest Legal Areas (Subfield Baseline Accuracy)</h4>
                            {subfieldRows.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-gray-400">
                                    No subfield data available in current results.
                                </div>
                            ) : (
                                <>
                                    <div className="flex flex-wrap gap-4">
                                        {chartModels.map((model, index) => (
                                            <div key={model} className="flex items-center gap-2 text-xs font-medium text-gray-600">
                                                <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: chartModelColors[index % chartModelColors.length] }} />
                                                {model}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-400 px-2 ml-[220px]">
                                        <span>0%</span>
                                        <span>20%</span>
                                        <span>40%</span>
                                        <span>60%</span>
                                        <span>80%</span>
                                        <span>100%</span>
                                    </div>
                                    <div className="space-y-5 pb-2">
                                        {subfieldRows.map((row) => (
                                            <div key={row.subfield} className="grid grid-cols-[220px_1fr] gap-4 items-start">
                                                <div className="pt-1 text-sm text-gray-700 text-right">{row.subfield}</div>
                                                <div className="space-y-1">
                                                    {chartModels.map((model, index) => {
                                                        const value = row.perModel[model];
                                                        const width = value === null ? 0 : Math.max(0, Math.min(100, value));
                                                        return (
                                                            <div key={`${row.subfield}-${model}`} className="grid grid-cols-[1fr_52px] gap-2 items-center">
                                                                <div className="h-4 bg-gray-100 rounded-sm overflow-hidden">
                                                                    <div
                                                                        className="h-full rounded-sm"
                                                                        style={{
                                                                            width: `${width}%`,
                                                                            backgroundColor: chartModelColors[index % chartModelColors.length]
                                                                        }}
                                                                    />
                                                                </div>
                                                                <span className="text-xs text-gray-600 text-right">
                                                                    {value === null ? '--' : `${value.toFixed(1)}%`}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {selectedQuestion && (
                <QuestionDetailModal
                    data={selectedQuestion}
                    relatedVariants={relatedVariants}
                    onClose={() => setSelectedQuestion(null)}
                />
            )}
        </div>
    );
}
