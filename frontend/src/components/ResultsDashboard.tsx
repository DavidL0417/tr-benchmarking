
import React, { useState } from 'react';
import { CheckCircle2, XCircle, Search, BarChart3, List } from 'lucide-react';
import { QuestionDetailModal } from './QuestionDetailModal';

type ResultItem = {
    questionId: string;
    originalQuestion: string;
    modelOutput: string;
    parsedChoice: string;
    groundTruth: string;
    originalGroundTruth: string;
    isCorrect: boolean;
    isPerturbed: boolean;
    questionText: string;
    benchmarkProfile?: 'legacy' | 'controlled';
    evaluationArm?: 'single' | 'deterministic' | 'stochastic';
    parseMethod?: string;
    isSchemaCompliant?: boolean;
    temperatureUsed?: number;
    temperatureApplied?: boolean;
};

type SplitSummary = {
    total: number;
    correct: number;
    accuracy: number;
};

type ExperimentSummary = {
    total: number;
    correct: number;
    accuracy: number;
    benchmarkProfile?: 'legacy' | 'controlled';
    splitSummary?: Record<string, SplitSummary>;
};

interface ResultsDashboardProps {
    results: ResultItem[];
    summary: ExperimentSummary | null;
}

export function ResultsDashboard({ results, summary }: ResultsDashboardProps) {
    const [selectedQuestion, setSelectedQuestion] = useState<ResultItem | null>(null);
    const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
    const splitEntries = Object.entries(summary?.splitSummary || {});

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
            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500 font-medium uppercase">Accuracy</p>
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
                    <p className="text-sm text-gray-500 font-medium uppercase">Benchmark Profile</p>
                    <p className="text-2xl font-bold text-gray-800 mt-1">
                        {summary.benchmarkProfile === 'controlled' ? 'Controlled' : 'Legacy'}
                    </p>
                </div>
            </div>

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

            {/* Main Content Area */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[600px]">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                        <List size={18} className="text-gray-500" />
                        Detailed Results
                    </h3>
                    <div className="flex bg-gray-200 p-1 rounded-lg">
                        <button
                            onClick={() => setViewMode('table')}
                            className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${viewMode === 'table' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Table
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto">
                    {viewMode === 'table' ? (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm text-xs uppercase text-gray-500 font-bold">
                                <tr>
                                    <th className="p-4 w-16">Status</th>
                                    <th className="p-4">Question ID</th>
                                    <th className="p-4">Run</th>
                                    <th className="p-4">Model Output</th>
                                    <th className="p-4">Expected</th>
                                    <th className="p-4 w-20">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {results.map((r, i) => (
                                    <tr key={r.questionId || i} className="hover:bg-blue-50/30 transition-colors group">
                                        <td className="p-4">
                                            {r.isCorrect ?
                                                <CheckCircle2 className="text-green-500" size={20} /> :
                                                <XCircle className="text-red-500" size={20} />
                                            }
                                        </td>
                                        <td className="p-4 font-mono text-gray-500 text-xs truncate max-w-[150px]" title={r.questionId}>
                                            {r.questionId.substring(0, 8)}...
                                            {r.isPerturbed && <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Adv</span>}
                                        </td>
                                        <td className="p-4">
                                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-blue-50 text-blue-700">
                                                {r.evaluationArm || 'single'}
                                            </span>
                                        </td>
                                        <td className="p-4 font-medium">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${r.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {r.parsedChoice}
                                            </span>
                                        </td>
                                        <td className="p-4 text-gray-600">
                                            {r.groundTruth}
                                            {r.groundTruth !== r.originalGroundTruth &&
                                                <span className="ml-2 text-xs text-orange-500" title="Label Noise Applied">(was {r.originalGroundTruth})</span>
                                            }
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
                        <div className="h-full flex items-center justify-center text-gray-400">
                            Chart visualization coming in Sprint 2
                        </div>
                    )}
                </div>
            </div>

            {selectedQuestion && (
                <QuestionDetailModal
                    data={selectedQuestion}
                    onClose={() => setSelectedQuestion(null)}
                />
            )}
        </div>
    );
}
