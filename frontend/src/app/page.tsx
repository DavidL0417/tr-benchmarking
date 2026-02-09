
'use client';

import { useEffect, useState } from 'react';
import { ConfigPanel, ExperimentConfig } from '@/components/ConfigPanel';
import { ResultsDashboard } from '@/components/ResultsDashboard';

type DatasetQuestion = {
    id: string;
    subfield?: string;
    discipline?: string;
    difficulty?: string;
};

type ExperimentSummary = {
    total: number;
    correct: number;
    accuracy: number;
    benchmarkProfile?: 'legacy' | 'controlled';
    splitSummary?: Record<string, { total: number; correct: number; accuracy: number }>;
};

type ExperimentResult = {
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

export default function Home() {
    const [subjects, setSubjects] = useState<string[]>([]);

    const [config, setConfig] = useState<ExperimentConfig>({
        model: 'gpt-4o-mini', // Default to cheapest model
        promptTemplate: 'baseline',
        temperature: 0.2,
        benchmarkProfile: 'legacy',
        controlled: {
            deterministicSplit: true,
            stochasticTemperature: 0.7
        },
        perturbations: {
            adversarialText: false,
            labelNoise: 0
        },
        limit: 5,
        subject: 'All',
        difficulty: 'All'
    });

    const [isRunning, setIsRunning] = useState(false);
    const [results, setResults] = useState<ExperimentResult[]>([]);
    const [summary, setSummary] = useState<ExperimentSummary | null>(null);

    // Load initial data to populate filters
    useEffect(() => {
        async function loadData() {
            try {
                const res = await fetch('/api/dataset');
                const json = (await res.json()) as { data?: DatasetQuestion[] };
                if (json.data) {
                    // Extract unique subfields
                    const uniqueSubjects = Array.from(
                        new Set(
                            json.data
                                .map((d) => d.subfield || d.discipline)
                                .filter((value): value is string => Boolean(value))
                        )
                    ).sort();
                    setSubjects(uniqueSubjects);
                }
            } catch (e) {
                console.error("Failed to load dataset", e);
            }
        }
        loadData();
    }, []);

    const runExperiment = async () => {
        setIsRunning(true);
        setResults([]);
        setSummary(null);

        try {
            // 1. Fetch filtered data first
            const dataRes = await fetch('/api/dataset');
            const dataJson = (await dataRes.json()) as { data?: DatasetQuestion[] };

            let filtered: DatasetQuestion[] = dataJson.data || [];

            // Filter logic (Client side for now, could be server side)
            if (config.subject !== 'All') {
                filtered = filtered.filter((q) => (q.subfield === config.subject) || (q.discipline === config.subject));
            }
            if (config.difficulty !== 'All') {
                filtered = filtered.filter((q) => q.difficulty === config.difficulty);
            }

            if (config.benchmarkProfile === 'controlled') {
                filtered = [...filtered].sort((a, b) => String(a.id).localeCompare(String(b.id)));
            } else {
                filtered = filtered.sort(() => 0.5 - Math.random());
            }

            // Limit
            const sample = filtered.slice(0, config.limit);

            // 2. Send to experiment API
            const res = await fetch('/api/experiment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    questions: sample,
                    ...config
                })
            });

            const json = (await res.json()) as { results?: ExperimentResult[]; summary?: ExperimentSummary };
            if (json.results && json.summary) {
                setResults(json.results);
                setSummary(json.summary);
            }
        } catch (e) {
            console.error(e);
            alert('Experiment failed. Check console.');
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <main className="min-h-screen bg-gray-50 flex flex-col font-sans text-slate-900">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
                <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {/* <div className="bg-blue-600 p-2 rounded-lg text-white">
                            <SquareChevronDown size={18} />
                        </div> */}
                        <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-700 to-indigo-600 bg-clip-text text-transparent">
                            BenchmarkDemo <span className="font-light text-gray-400">AI Evaluator</span>
                        </h1>
                    </div>

                    <div className="text-xs font-mono text-gray-400">
                        v0.1.0-sprint1
                    </div>
                </div>
            </header>

            {/* Main Layout */}
            <div className="flex-1 max-w-[1600px] mx-auto w-full p-6 grid grid-cols-12 gap-8">

                {/* Sidebar Configuration */}
                <div className="col-span-12 lg:col-span-3">
                    <ConfigPanel
                        config={config}
                        setConfig={setConfig}
                        onRun={runExperiment}
                        isLoading={isRunning}
                        subjects={subjects}
                    />
                </div>

                {/* Results Area */}
                <div className="col-span-12 lg:col-span-9 flex flex-col gap-6">
                    <ResultsDashboard results={results} summary={summary} />
                </div>
            </div>
        </main>
    );
}
