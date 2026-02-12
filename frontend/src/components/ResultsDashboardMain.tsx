import React, { useMemo, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Search, BarChart3, List } from 'lucide-react';
import { QuestionDetailModal } from './QuestionDetailModalMain';

type VariantType = 'baseline' | 'shuffle' | 'normalize' | 'irrelevant';

type StabilitySummary = {
    totalComparisons: number;
    totalFlips: number;
    flipRate: number;
    flipRateByVariantType: Record<string, { comparisons: number; flips: number; flipRate: number }>;
    baselineParseFailureRate: number;
};

type SuperGPQAResult = {
    dataset: 'supergpqa';
    model?: string;
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
    variantType: VariantType;
    variantIndex: number;
    choicePermutation: number[];
    predictedChoiceId: number | null;
    groundTruthChoiceId: number;
    baselineChoiceId: number | null;
    didFlip: boolean | null;
    parseable: boolean;
};

type JudgeResult = {
    overallScore: number | null;
    subscores: Record<string, number>;
    issues: string[];
    summary?: string;
    rawOutput: string;
    parseFailed: boolean;
};

type PrbenchResult = {
    dataset: 'prbench';
    itemId: string;
    field?: string;
    topic?: string;
    finalPrompt: string;
    conversation: Array<{ role: 'user' | 'assistant'; content: string }>;
    modelAnswer: string;
    judge: JudgeResult;
    isPerturbed: boolean;
};

type SuperGPQASummary = {
    dataset: 'supergpqa';
    total: number;
    correct: number;
    accuracy: number;
    stability?: StabilitySummary;
};

type PrbenchSummary = {
    dataset: 'prbench';
    total: number;
    scoredCount: number;
    meanScore: number;
    meanSubscores?: Record<string, number>;
};

type ResultItem = SuperGPQAResult | PrbenchResult;
type ExperimentSummary = SuperGPQASummary | PrbenchSummary;

interface ResultsDashboardProps {
    results: ResultItem[];
    summary: ExperimentSummary | null;
}

export function ResultsDashboard({ results, summary }: ResultsDashboardProps) {
    const [selectedQuestion, setSelectedQuestion] = useState<ResultItem | null>(null);
    const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
    const [showVariants, setShowVariants] = useState(false);
    const isPrbench = summary?.dataset === 'prbench';
    const superGpqaResults = useMemo(
        () => summary?.dataset === 'supergpqa' ? (results as SuperGPQAResult[]) : [],
        [results, summary?.dataset]
    );
    const baselineRows = useMemo(
        () => superGpqaResults.filter((row) => row.variantType === 'baseline'),
        [superGpqaResults]
    );
    const displayedRows = showVariants ? superGpqaResults : baselineRows;
    const flipRateByQuestion = useMemo(() => {
        const map = new Map<string, { comparisons: number; flips: number; flipRate: number }>();
        for (const row of superGpqaResults) {
            if (row.variantType === 'baseline' || typeof row.didFlip !== 'boolean') {
                continue;
            }
            const modelKey = row.model || 'main';
            const key = `${modelKey}:${row.questionId}`;
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
    }, [superGpqaResults]);

    const selectedSuperGpqaRow = (!isPrbench && selectedQuestion?.dataset === 'supergpqa')
        ? selectedQuestion as SuperGPQAResult
        : null;
    const relatedVariants = useMemo(() => {
        if (!selectedSuperGpqaRow) {
            return [];
        }
        const selectedModel = selectedSuperGpqaRow.model || 'main';
        return superGpqaResults
            .filter((row) => (row.model || 'main') === selectedModel && row.questionId === selectedSuperGpqaRow.questionId)
            .sort((a, b) => a.variantIndex - b.variantIndex);
    }, [selectedSuperGpqaRow, superGpqaResults]);

    const stability = summary?.dataset === 'supergpqa'
        ? (summary as SuperGPQASummary).stability
        : undefined;
    const flipByTypeEntries = Object.entries(stability?.flipRateByVariantType || {});

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
                {isPrbench ? (
                    <>
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                            <p className="text-sm text-gray-500 font-medium uppercase">Mean Judge Score</p>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span className="text-4xl font-bold text-indigo-600">
                                    {(summary as PrbenchSummary).scoredCount > 0
                                        ? (summary as PrbenchSummary).meanScore.toFixed(1)
                                        : '--'}
                                </span>
                                <span className="text-xs text-gray-400">/ 100</span>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                            <p className="text-sm text-gray-500 font-medium uppercase">Total Items</p>
                            <p className="text-3xl font-bold text-gray-800 mt-1">{summary.total}</p>
                        </div>
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                            <p className="text-sm text-gray-500 font-medium uppercase">
                                {Object.keys((summary as PrbenchSummary).meanSubscores || {}).length > 0 ? 'Mean Subscores' : 'Scored Items'}
                            </p>
                            {Object.keys((summary as PrbenchSummary).meanSubscores || {}).length > 0 ? (
                                <div className="mt-2 space-y-1 text-sm text-gray-600">
                                    {Object.entries((summary as PrbenchSummary).meanSubscores || {}).map(([key, value]) => (
                                        <div key={key} className="flex justify-between">
                                            <span className="truncate">{key}</span>
                                            <span className="font-semibold text-gray-800">{value.toFixed(1)}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-3xl font-bold text-gray-800 mt-1">
                                    {(summary as PrbenchSummary).scoredCount}
                                    <span className="text-lg text-gray-400 font-normal">/ {summary.total}</span>
                                </p>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                            <p className="text-sm text-gray-500 font-medium uppercase">Baseline Accuracy</p>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span className={`text-4xl font-bold ${((summary as SuperGPQASummary).accuracy > 0.7) ? 'text-green-600' : ((summary as SuperGPQASummary).accuracy > 0.4) ? 'text-yellow-600' : 'text-red-600'}`}>
                                    {((summary as SuperGPQASummary).accuracy * 100).toFixed(1)}%
                                </span>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                            <p className="text-sm text-gray-500 font-medium uppercase">Total Questions</p>
                            <p className="text-3xl font-bold text-gray-800 mt-1">{summary.total}</p>
                        </div>
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                            <p className="text-sm text-gray-500 font-medium uppercase">Correct / Total</p>
                            <p className="text-3xl font-bold text-gray-800 mt-1">
                                {(summary as SuperGPQASummary).correct}
                                <span className="text-lg text-gray-400 font-normal">/ {summary.total}</span>
                            </p>
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
                    </>
                )}
            </div>

            {!isPrbench && (
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500 font-medium uppercase mb-3">Flip Rate by Variant Type</p>
                    {flipByTypeEntries.length === 0 ? (
                        <p className="text-sm text-gray-500">No variant comparisons available.</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {flipByTypeEntries.map(([type, stats]) => (
                                <div key={type} className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                                    <p className="text-xs uppercase font-semibold text-gray-500">{type}</p>
                                    <p className="text-xl font-bold text-gray-800 mt-1">{(stats.flipRate * 100).toFixed(1)}%</p>
                                    <p className="text-xs text-gray-500">{stats.flips} flips / {stats.comparisons} comparisons</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                        <List size={18} className="text-gray-500" />
                        Detailed Results
                    </h3>
                    <div className="flex items-center gap-3">
                        {!isPrbench && (
                            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 accent-blue-600"
                                    checked={showVariants}
                                    onChange={(e) => setShowVariants(e.target.checked)}
                                />
                                Show variants
                            </label>
                        )}
                        <div className="flex bg-gray-200 p-1 rounded-lg">
                            <button
                                onClick={() => setViewMode('table')}
                                className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${viewMode === 'table' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Table
                            </button>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {viewMode === 'table' ? (
                        isPrbench ? (
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm text-xs uppercase text-gray-500 font-bold">
                                    <tr>
                                        <th className="p-4 w-20">Score</th>
                                        <th className="p-4 w-40">Topic</th>
                                        <th className="p-4">Final Prompt</th>
                                        <th className="p-4">Model Answer</th>
                                        <th className="p-4">Judge Notes</th>
                                        <th className="p-4 w-20">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {(results as PrbenchResult[]).map((r, i) => (
                                        <tr key={r.itemId || i} className="hover:bg-blue-50/30 transition-colors group align-top">
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg font-semibold text-indigo-600">
                                                        {r.judge.overallScore ?? '--'}
                                                    </span>
                                                    {r.judge.parseFailed && (
                                                        <AlertTriangle size={16} className="text-orange-500" />
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4 text-gray-600 text-xs uppercase tracking-wide">
                                                {r.topic || r.field || 'General'}
                                                {r.isPerturbed && <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Adv</span>}
                                            </td>
                                            <td className="p-4 text-gray-700 max-w-[260px]">
                                                <div className="line-clamp-4 whitespace-pre-wrap">{r.finalPrompt}</div>
                                            </td>
                                            <td className="p-4 text-gray-700 max-w-[260px]">
                                                <div className="line-clamp-4 whitespace-pre-wrap">{r.modelAnswer}</div>
                                            </td>
                                            <td className="p-4 text-gray-600 max-w-[260px]">
                                                {r.judge.issues.length > 0 ? (
                                                    <div className="line-clamp-4">{r.judge.issues.join(' • ')}</div>
                                                ) : (
                                                    <span className="text-gray-400">No issues flagged</span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <button
                                                    onClick={() => setSelectedQuestion(r)}
                                                    className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-blue-600 transition-colors"
                                                >
                                                    <Search size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm text-xs uppercase text-gray-500 font-bold">
                                    <tr>
                                        <th className="p-4 w-16">Status</th>
                                        <th className="p-4">Question ID</th>
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
                                        const mapKey = `${r.model || 'main'}:${r.questionId}`;
                                        const flipStats = flipRateByQuestion.get(mapKey);
                                        return (
                                            <tr key={`${r.questionId}-${r.variantIndex}-${i}`} className="hover:bg-blue-50/30 transition-colors group">
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
                                                <td className="p-4 text-gray-700 text-xs">
                                                    <span className="inline-flex items-center px-2 py-1 rounded bg-blue-50 text-blue-700 font-semibold">
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
                        )
                    ) : (
                        <div className="h-full flex items-center justify-center text-gray-400">
                            Chart visualization coming in Sprint 2
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
