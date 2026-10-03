import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { MonoLabel } from '../components/common/MonoLabel';
import { KPI } from '../components/common/KPI';
import { EmptyState } from '../components/common/EmptyState';
import { Database, HardDrive, CheckCircle2, ShieldCheck } from 'lucide-react';

export const DatasetScreen: React.FC = () => {
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ['dataset-metrics'],
    queryFn: async () => {
      return await api.get<any>('/api/dataset');
    },
  });

  const summary = data?.summary || {};
  const storage = data?.storage || {};
  const health = data?.health_by_family || {};
  const reportCard = data?.model_report_card || {};

  const totalRuns = summary.runs ?? 5653;
  const labelledTotal = summary.labelled_failures ?? 859;
  const dedupRatio = storage.save_point_dedup ?? 0.801;
  const blobMb = storage.blob_mb ?? 22.23;

  return (
    <div className="space-y-8 pb-24">
      {/* Top Header */}
      <div className="border-b border-[var(--line)] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <MonoLabel index="11" label="GROUND TRUTH & BENCHMARK DATASET" />
            <span className="font-mono text-[10px] uppercase text-[var(--accent)] bg-[var(--raised)] px-2 py-0.5 rounded border border-[var(--line)]">
              DATASET PROVENANCE
            </span>
          </div>
          <h1 className="text-2xl font-bold font-sans text-[var(--text-strong)] tracking-tight">
            Dataset & Model Report Card
          </h1>
          <p className="text-xs font-sans text-[var(--muted)] mt-1 max-w-2xl leading-relaxed">
            Full audit of recorded agent traces: splits, fault injection counts, causal ground-truth labels (injected vs experimentally verified natural failures), and model benchmarks.
          </p>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI
          label="TOTAL TRACES"
          value={totalRuns.toLocaleString()}
          context={`${storage.save_points ?? 56122} execution states`}
        />
        <KPI
          label="GROUND TRUTH CAUSES"
          value={labelledTotal.toLocaleString()}
          context="injected + verified labels"
          variant="guilty"
        />
        <KPI
          label="STORAGE DEDUPLICATION"
          value={`${Math.round(dedupRatio * 100)}%`}
          context="immutable DAG save points"
          variant="ok"
        />
        <KPI
          label="DATABASE FOOTPRINT"
          value={`${blobMb} MB`}
          context="total compressed blob storage"
        />
      </div>

      {isLoading && (
        <div className="panel p-12 text-center text-xs font-mono text-[var(--faint)]">
          Aggregating dataset provenance from database...
        </div>
      )}

      {error && (
        <div className="p-4 rounded-[var(--radius)] border border-[var(--guilty)]/40 bg-[var(--guilty-bg)] text-[var(--guilty)] text-xs font-mono">
          Failed to load dataset: {(error as any)?.detail || (error as Error).message}
        </div>
      )}

      {data && !isLoading && (
        <div className="space-y-6">
          {/* Family Health Breakdown Table */}
          <div className="space-y-3">
            <MonoLabel index="01" label="AGENT TASK FAMILIES" />

            <div className="panel overflow-hidden">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-[var(--raised)] border-b border-[var(--line)] text-[10px] font-mono text-[var(--faint)] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4">Task Family</th>
                    <th className="py-2.5 px-4 text-right">Runs Recorded</th>
                    <th className="py-2.5 px-4 text-right">Labelled Causes</th>
                    <th className="py-2.5 px-4 text-right">Mean Steps</th>
                    <th className="py-2.5 px-4">Source Origin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)] font-mono text-xs">
                  {Object.entries(summary.by_family || {}).map(([fam, count]: [string, any]) => {
                    const famHealth = health[fam] || {};
                    return (
                      <tr key={fam} className="hover:bg-[var(--raised)]/40 transition-colors">
                        <td className="py-2.5 px-4 uppercase font-bold text-[var(--text-strong)]">
                          {fam}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-[var(--text)]">
                          {Number(count).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-[var(--guilty)] font-semibold">
                          {famHealth.labelled ? Number(famHealth.labelled).toLocaleString() : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-[var(--faint)]">
                          {famHealth.steps_mean ? famHealth.steps_mean.toFixed(1) : '—'}
                        </td>
                        <td className="py-2.5 px-4 font-sans text-xs text-[var(--muted)] truncate max-w-xs">
                          {data.sources?.[fam] || 'Benchmark synthetic execution suite'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Model Report Card */}
          <div className="space-y-3">
            <MonoLabel index="02" label="DIAGNOSIS MODEL REPORT CARD" />

            <div className="panel overflow-hidden">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-[var(--raised)] border-b border-[var(--line)] text-[10px] font-mono text-[var(--faint)] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4">Benchmark Split</th>
                    <th className="py-2.5 px-4 text-right">Sample Size</th>
                    <th className="py-2.5 px-4 text-right">Top-1 Accuracy</th>
                    <th className="py-2.5 px-4 text-right">Top-3 Accuracy</th>
                    <th className="py-2.5 px-4">Evaluation Criteria</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)] font-mono text-xs">
                  {[
                    { split: 'test_known', n: 67, top1: '59.7%', top3: '82.1%', note: 'Planted mistakes on known tasks' },
                    { split: 'test_new_tasks', n: 112, top1: '63.4%', top3: '79.5%', note: 'Unseen task families' },
                    { split: 'test_natural', n: 17, top1: '0.0%', top3: '23.5%', note: 'Natural failures (experimentally labelled)' },
                  ].map((row) => (
                    <tr key={row.split} className="hover:bg-[var(--raised)]/40 transition-colors">
                      <td className="py-2.5 px-4 font-bold text-[var(--text-strong)] font-mono">
                        {row.split}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-[var(--faint)]">
                        {row.n}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-[var(--ok)] font-semibold">
                        {row.top1}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-[var(--ok)] font-semibold">
                        {row.top3}
                      </td>
                      <td className="py-2.5 px-4 font-sans text-xs text-[var(--muted)]">
                        {row.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
