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

  const { data: overview } = useQuery<any>({
    queryKey: ['overview-telemetry'],
    queryFn: async () => {
      return await api.get<any>('/api/ui/overview');
    },
  });

  const summary = data?.summary || {};
  const storage = data?.storage || {};
  const health = data?.health_by_family || {};
  const reportCard = data?.model_report_card || {};
  const modelResults = overview?.model?.results || {};

  const totalRuns = summary.runs !== undefined ? summary.runs.toLocaleString() : (isLoading ? '—' : '0');
  const labelledTotal = summary.labelled_failures !== undefined ? summary.labelled_failures.toLocaleString() : (isLoading ? '—' : '0');
  const dedupRatio = storage.save_point_dedup !== undefined ? Math.round(storage.save_point_dedup * 100) : null;
  const blobMb = storage.blob_mb !== undefined ? storage.blob_mb : null;
  const savePoints = storage.save_points !== undefined ? storage.save_points.toLocaleString() : (isLoading ? '—' : '0');

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
          value={totalRuns}
          context={`${savePoints} execution states`}
        />
        <KPI
          label="GROUND TRUTH CAUSES"
          value={labelledTotal}
          context="injected + verified labels"
          variant="guilty"
        />
        <KPI
          label="STORAGE DEDUPLICATION"
          value={dedupRatio !== null ? `${dedupRatio}%` : '—'}
          context="immutable DAG save points"
          variant="ok"
        />
        <KPI
          label="DATABASE FOOTPRINT"
          value={blobMb !== null ? `${blobMb} MB` : '—'}
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
                          {data.sources?.[fam] || '—'}
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
                  {Object.keys(modelResults).length > 0 ? (
                    Object.entries(modelResults).map(([splitName, splitData]: [string, any]) => {
                      const note = splitName === 'test_known'
                        ? 'Planted mistakes on known tasks'
                        : splitName === 'test_new_tasks'
                        ? 'Unseen task families'
                        : 'Natural failures (experimentally labelled)';
                      return (
                        <tr key={splitName} className="hover:bg-[var(--raised)]/40 transition-colors">
                          <td className="py-2.5 px-4 font-bold text-[var(--text-strong)] font-mono">
                            {splitName}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-[var(--faint)]">
                            {splitData.n}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-[var(--ok)] font-semibold">
                            {(splitData.top1 * 100).toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-[var(--ok)] font-semibold">
                            {(splitData.top3 * 100).toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-4 font-sans text-xs text-[var(--muted)]">
                            {note}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-[var(--muted)] font-mono text-xs">
                        {isLoading ? 'Loading benchmark splits...' : 'No benchmark splits evaluated.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
