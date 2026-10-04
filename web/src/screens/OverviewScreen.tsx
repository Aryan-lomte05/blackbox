import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { OverviewResponse } from '../types/api';
import { MonoLabel } from '../components/common/MonoLabel';
import { RecMark } from '../components/common/RecMark';
import { KPI } from '../components/common/KPI';
import { StepChip } from '../components/common/StepChip';
import { SavingsMeter } from '../components/common/SavingsMeter';
import { EmptyState } from '../components/common/EmptyState';
import { ArrowRight, Compass, ShieldAlert, RotateCw, ExternalLink, HardDrive } from 'lucide-react';

export const OverviewScreen: React.FC = () => {
  const { data, isLoading, error } = useQuery<OverviewResponse | any>({
    queryKey: ['overview-telemetry'],
    queryFn: async () => {
      return await api.get<any>('/api/ui/overview');
    },
    refetchInterval: 15000,
  });

  const kpis = data?.kpis || {};
  const totalRuns = kpis.runs !== undefined ? kpis.runs.toLocaleString() : (isLoading ? '—' : '0');
  const totalSteps = kpis.steps !== undefined ? kpis.steps.toLocaleString() : (isLoading ? '—' : '0');
  const labelledFailures = kpis.labelled_failures !== undefined ? kpis.labelled_failures.toLocaleString() : (isLoading ? '—' : '0');
  const openIncidents = kpis.open_incidents !== undefined ? kpis.open_incidents.toString() : (isLoading ? '—' : '0');
  const criticalIncidents = kpis.critical_incidents !== undefined ? kpis.critical_incidents : 0;
  const dedupRatio = kpis.save_point_dedup !== undefined ? Math.round(kpis.save_point_dedup * 100) : null;
  const blobMb = kpis.blob_mb !== undefined ? kpis.blob_mb : null;
  const passedCount = kpis.passed !== undefined ? kpis.passed.toLocaleString() : '—';
  const failedCount = kpis.failed !== undefined ? kpis.failed.toLocaleString() : '—';

  // Filter recent failures from recent_runs or recent_failures
  const failuresList = (data?.recent_runs || data?.recent_failures || [])
    .filter((r: any) => r.outcome === 'fail' || r.outcome === 'failed' || r.planted)
    .slice(0, 10);

  const jobQueue = data?.queue || [];

  return (
    <div className="space-y-8 pb-24">
      {/* Top Header */}
      <div className="border-b border-[var(--line)] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <MonoLabel index="09" label="INSTRUMENT TELEMETRY & RUN FLEET" />
            <RecMark streaming={jobQueue.length > 0} size="sm" />
          </div>
          <h1 className="text-2xl font-bold font-sans text-[var(--text-strong)] tracking-tight">
            Fleet Overview & Telemetry
          </h1>
          <p className="text-xs font-sans text-[var(--muted)] mt-1 max-w-2xl leading-relaxed">
            Continuous flight recorder metrics: total agent runs recorded, ground-truth verified failure labels, causal deduplication ratios, and active Guardian incidents.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/investigate"
            className="px-4 py-2 bg-[var(--accent)] hover:brightness-110 active:brightness-95 text-[var(--bg)] font-sans font-semibold text-xs rounded-[var(--radius-sm)] transition-all flex items-center gap-2 select-none"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Investigate Failure</span>
          </Link>
        </div>
      </div>

      {/* Main KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI
          label="RECORDED RUNS"
          value={totalRuns}
          context={totalSteps !== '—' ? `${totalSteps} recorded steps` : undefined}
        />
        <KPI
          label="LABELLED FAILURES"
          value={labelledFailures}
          context="ground truth test suite"
          variant="guilty"
        />
        <KPI
          label="STORAGE DEDUP"
          value={dedupRatio !== null ? `${dedupRatio}%` : '—'}
          context="immutable DAG save points"
          variant="ok"
        />
        <KPI
          label="OPEN INCIDENTS"
          value={openIncidents}
          context={criticalIncidents > 0 ? `${criticalIncidents} requiring human approval` : 'Active fleet protection'}
          variant={criticalIncidents > 0 ? 'trail' : 'default'}
        />
      </div>

      {/* Storage & Replay Dedup Bar */}
      <div className="panel p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
        <div className="flex items-center gap-2.5 text-xs font-mono text-[var(--info)]">
          <HardDrive className="w-4 h-4 shrink-0" />
          <span>
            {dedupRatio !== null ? `${dedupRatio}% save-point deduplication` : 'Telemetry deduplication active'} · {blobMb !== null ? `${blobMb} MB storage footprint` : 'Active DAG storage'} · zero tokens spent on cached replays
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono text-[var(--faint)]">
          <span>RUN STATUS:</span>
          <span className="text-[var(--ok)] font-semibold">{passedCount} PASS</span>
          <span>·</span>
          <span className="text-[var(--guilty)] font-semibold">{failedCount} FAIL</span>
        </div>
      </div>

      {/* Recent Failures Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <MonoLabel index="RECENT" label="RECENT FLEET FAILURES (READY FOR INVESTIGATION)" />
          <Link to="/runs" className="text-xs font-mono text-[var(--accent)] hover:underline flex items-center gap-1">
            <span>View all runs</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {failuresList.length === 0 ? (
          <EmptyState
            title="No Recent Failures"
            description="All recorded agent traces in the database completed with status PASS."
            endpoint="GET /api/runs?status=failed"
          />
        ) : (
          <div className="panel overflow-hidden">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[var(--raised)] border-b border-[var(--line)] text-[10px] font-mono text-[var(--faint)] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Run ID</th>
                  <th className="py-2.5 px-4">Agent / Task Family</th>
                  <th className="py-2.5 px-4">Planted Fault</th>
                  <th className="py-2.5 px-4">Guilty Step</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)] font-mono text-xs">
                {failuresList.map((rf: any) => (
                  <tr key={rf.run_id} className="hover:bg-[var(--raised)]/40 transition-colors">
                    <td className="py-2.5 px-4 font-semibold text-[var(--text-strong)]">
                      <Link to={`/runs/${rf.run_id}`} className="hover:underline">
                        {rf.run_id}
                      </Link>
                    </td>
                    <td className="py-2.5 px-4 font-sans text-xs text-[var(--text)]">
                      <span className="capitalize">{rf.family_label || rf.family}</span>
                      <span className="text-[var(--faint)] text-[11px] ml-2">({rf.agent})</span>
                    </td>
                    <td className="py-2.5 px-4">
                      {rf.planted ? (
                        <span className="px-1.5 py-0.5 rounded bg-[var(--guilty-bg)] text-[var(--guilty)] border border-[var(--guilty)]/30 text-[10px] font-bold">
                          {rf.planted}
                        </span>
                      ) : (
                        <span className="text-[var(--faint)]">natural</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      {rf.guilty_step !== null && rf.guilty_step !== undefined ? (
                        <StepChip step={rf.guilty_step} variant="guilty" />
                      ) : (
                        <span className="text-[var(--ghost)]">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <Link
                        to={`/runs/${rf.run_id}`}
                        className="inline-flex items-center gap-1 text-xs font-sans text-[var(--accent)] hover:underline"
                      >
                        <span>Investigate</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Active Job Queue */}
      <div className="space-y-3">
        <MonoLabel index="QUEUE" label="BACKGROUND EXPERIMENT JOB QUEUE" />
        <div className="panel p-4 text-xs font-mono">
          {jobQueue.length > 0 ? (
            <div className="divide-y divide-[var(--line)]">
              {jobQueue.map((job: any) => (
                <div key={job.id} className="py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RotateCw className="w-3.5 h-3.5 animate-spin text-[var(--accent)]" />
                    <span className="font-semibold text-[var(--text-strong)]">{job.name}</span>
                    <span className="text-[var(--faint)]">({job.id})</span>
                  </div>
                  <span className="text-[var(--faint)]">status: {job.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[var(--faint)] flex items-center justify-between">
              <span>Job queue idle. No background ablation or verification tasks pending.</span>
              <span className="text-[10px] uppercase text-[var(--ok)]">NOMINAL</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
