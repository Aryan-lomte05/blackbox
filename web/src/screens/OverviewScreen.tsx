import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { OverviewResponse } from '../types/api';
import { formatRelativeTime } from '../lib/time';
import {
  Layers,
  HardDrive,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  Radio,
  CheckCircle2,
} from 'lucide-react';

export const OverviewScreen: React.FC = () => {
  const navigate = useNavigate();
  const [failurePage, setFailurePage] = useState(0);

  const { data, isLoading } = useQuery<OverviewResponse>({
    queryKey: ['overview-data'],
    queryFn: async () => {
      return await api.get<OverviewResponse>('/api/ui/overview');
    },
    refetchInterval: 10000,
  });

  const totalRuns = data?.kpis?.runs ?? (data?.kpis?.total_runs ?? 0);
  const totalSteps = data?.kpis?.steps ?? 0;
  const failuresDiagnosed = data?.kpis?.labelled_failures ?? 0;

  const passed = data?.kpis?.passed ?? Math.max(0, totalRuns - (data?.kpis?.failed ?? 0) - (data?.kpis?.crashed ?? 0));
  const failed = data?.kpis?.failed ?? failuresDiagnosed;
  const crashed = data?.kpis?.crashed ?? 0;
  const blobMb = data?.kpis?.blob_mb ?? 0;
  const savePointDedup = data?.kpis?.save_point_dedup ?? 0;

  const total = totalRuns || 1;
  const passedPct = Math.max(0, Math.min(100, (passed / total) * 100)).toFixed(1);
  const failedPct = Math.max(0, Math.min(100, (failed / total) * 100)).toFixed(1);
  const crashedPct = Math.max(0, Math.min(100, (crashed / total) * 100)).toFixed(1);

  const recentFailures = (data?.recent_failures && data.recent_failures.length > 0)
    ? data.recent_failures.map((rf) => ({
        title: rf.planted ? `Planted: ${rf.planted} mistake` : `${rf.agent} in ${rf.family_label || rf.family.toUpperCase()}`,
        run_id: rf.run_id.slice(0, 4).toUpperCase(),
        family: rf.family_label || rf.family.toUpperCase(),
        time: formatRelativeTime(rf.created_at),
        fullId: rf.run_id,
      }))
    : [];

  const pageSize = 3;
  const totalFailurePages = Math.max(1, Math.ceil(recentFailures.length / pageSize));
  const displayedFailures = recentFailures.slice(failurePage * pageSize, (failurePage + 1) * pageSize);

  const activeIncident = data?.incidents && data.incidents.length > 0 ? data.incidents[0] : null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* 1. HERO BANNER with Flight Recorder Earth Horizon */}
      <div className="relative rounded-2xl bg-[#0b0c10] border border-white/[0.08] overflow-hidden p-8 min-h-[220px] flex items-center shadow-2xl">
        <div className="absolute right-0 top-0 bottom-0 w-3/5 pointer-events-none select-none overflow-hidden">
          <img
            src="/earth_horizon.jpg"
            alt="Earth Horizon"
            className="w-full h-full object-cover object-left opacity-80 mix-blend-screen"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0b0c10] via-[#0b0c10]/60 to-transparent" />
        </div>

        <div className="relative z-10 max-w-xl space-y-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white font-heading">
              BLACK BOX
            </h1>
            <div className="text-xs font-mono font-bold tracking-widest text-zinc-300 uppercase mt-1">
              AI AGENT FLIGHT RECORDER
            </div>
            <div className="text-xs font-semibold text-zinc-300 mt-2">
              Record. Diagnose. Prove. Fix.
            </div>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Investigate failures, understand causality, and make your agents safer.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Link
              to="/runs"
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-lg shadow-blue-900/30 transition-all cursor-pointer"
            >
              <span>Investigate a Run</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            <Link
              to="/lab"
              className="px-4 py-2 rounded-lg bg-[#14161b] hover:bg-[#1c1f26] text-zinc-200 border border-white/[0.08] font-medium text-xs transition-colors cursor-pointer"
            >
              Live Lab
            </Link>
          </div>
        </div>
      </div>

      {/* 2. 4 KPI STATS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* TOTAL RUNS */}
        <div className="p-4 rounded-xl bg-[#0c0d10] border border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              TOTAL RUNS
            </span>
            <Layers className="w-4 h-4 text-zinc-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {isLoading ? '—' : totalRuns.toLocaleString()}
          </div>
          <div className="text-[11px] font-sans text-emerald-400/90 flex items-center gap-1">
            <span>Authoritative backend store</span>
          </div>
        </div>

        {/* TOTAL STEPS */}
        <div className="p-4 rounded-xl bg-[#0c0d10] border border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              TOTAL STEPS
            </span>
            <Radio className="w-4 h-4 text-zinc-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {isLoading ? '—' : totalSteps.toLocaleString()}
          </div>
          <div className="text-[11px] font-sans text-zinc-400 flex items-center gap-1">
            <span>Logged intermediate states</span>
          </div>
        </div>

        {/* STORAGE */}
        <div className="p-4 rounded-xl bg-[#0c0d10] border border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              STORAGE
            </span>
            <HardDrive className="w-4 h-4 text-zinc-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {isLoading ? '—' : blobMb > 0 ? `${blobMb} MB` : `${((data?.kpis?.savepoints_bytes ?? 0) / 1e6).toFixed(1)} MB`}
          </div>
          <div className="text-[11px] font-sans text-cyan-400 flex items-center gap-1 font-mono">
            <span>{Math.round(savePointDedup * 100)}% deduped</span>
          </div>
        </div>

        {/* FAILURES */}
        <div className="p-4 rounded-xl bg-[#0c0d10] border border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              FAILURES
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {isLoading ? '—' : failuresDiagnosed.toLocaleString()}
          </div>
          <div className="text-[11px] font-sans text-rose-400/90 flex items-center gap-1 font-mono">
            <span>{totalRuns > 0 ? ((failed / totalRuns) * 100).toFixed(1) : '0'}% failure rate</span>
          </div>
        </div>
      </div>

      {/* 3. RUN HEALTH SECTION */}
      <div className="p-4 rounded-xl bg-[#0c0d10] border border-white/[0.06] space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-white font-mono">
            RUN HEALTH
          </span>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{isLoading ? '—' : passed.toLocaleString()} Passed</span>
            </span>
            <span className="flex items-center gap-1.5 text-rose-400">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>{isLoading ? '—' : failed.toLocaleString()} Failed</span>
            </span>
            <span className="flex items-center gap-1.5 text-cyan-400">
              <span className="w-2 h-2 rounded-full bg-cyan-500" />
              <span>{isLoading ? '—' : crashed} Crashed</span>
            </span>
          </div>
        </div>

        {/* Multi-segment horizontal bar */}
        <div className="h-2.5 w-full bg-[#16181d] rounded-full overflow-hidden flex gap-0.5">
          <div
            className="bg-emerald-500 h-full rounded-l-full transition-all"
            style={{ width: `${passedPct}%` }}
            title={`${passed.toLocaleString()} Passed (${passedPct}%)`}
          />
          <div
            className="bg-rose-500 h-full transition-all"
            style={{ width: `${failedPct}%` }}
            title={`${failed.toLocaleString()} Failed (${failedPct}%)`}
          />
          <div
            className="bg-cyan-500 h-full rounded-r-full transition-all"
            style={{ width: `${crashedPct}%` }}
            title={`${crashed} Crashed (${crashedPct}%)`}
          />
        </div>
      </div>

      {/* 4. RECENT FAILURES & ACTIVE INCIDENTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* RECENT FAILURES */}
        <div className="p-4 rounded-xl bg-[#0c0d10] border border-white/[0.06] flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
            <span className="text-xs font-bold uppercase tracking-wider text-white font-mono">
              RECENT FAILURES
            </span>
            {recentFailures.length > pageSize && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setFailurePage((p) => Math.max(0, p - 1))}
                  disabled={failurePage === 0}
                  className="p-1 rounded text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:hover:text-zinc-500"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setFailurePage((p) => Math.min(totalFailurePages - 1, p + 1))}
                  disabled={failurePage >= totalFailurePages - 1}
                  className="p-1 rounded text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:hover:text-zinc-500"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="divide-y divide-white/[0.04] space-y-1">
            {displayedFailures.length === 0 ? (
              <div className="py-6 text-center text-xs font-mono text-zinc-500">
                {isLoading ? 'Loading recorded failures...' : 'No failures recorded in recent runs'}
              </div>
            ) : (
              displayedFailures.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => navigate(item.fullId ? `/runs/${item.fullId}` : '/runs')}
                  className="pt-2.5 pb-2 flex items-center justify-between hover:bg-white/[0.02] px-2 rounded-lg transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                    <div>
                      <div className="text-xs font-medium text-zinc-200 group-hover:text-white transition-colors">
                        {item.title}
                      </div>
                      <div className="text-[11px] font-mono text-zinc-500">
                        run_{item.run_id} · {item.family}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-zinc-500">{item.time}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ACTIVE INCIDENTS */}
        <div className="p-4 rounded-xl bg-[#0c0d10] border border-white/[0.06] flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
            <span className="text-xs font-bold uppercase tracking-wider text-white font-mono">
              ACTIVE INCIDENTS
            </span>
            <span className="text-[11px] font-mono text-zinc-500">
              {data?.kpis?.open_incidents ?? (activeIncident ? 1 : 0)} open
            </span>
          </div>

          {activeIncident ? (
            <div className="p-3.5 rounded-lg bg-[#111216] border border-white/[0.06] space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-mono font-bold uppercase text-rose-400 tracking-wider">
                      {activeIncident.severity.toUpperCase()}
                    </div>
                    <div className="text-sm font-bold text-white mt-0.5">
                      {activeIncident.title}
                    </div>
                  </div>
                </div>
                <span className="text-xs font-mono text-zinc-500">
                  {formatRelativeTime(activeIncident.created_at)}
                </span>
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed">
                Run #{activeIncident.run_id.slice(0, 8)} flagged with status {activeIncident.status}.
              </p>

              <div className="pt-1">
                <Link
                  to="/incidents"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#171920] hover:bg-[#20232c] text-zinc-200 border border-white/[0.08] text-xs font-medium transition-colors"
                >
                  <span>Review Incident</span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-lg bg-[#111216] border border-white/[0.06] text-center space-y-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
              <div className="text-xs font-bold text-white font-mono">No Active Incidents</div>
              <p className="text-[11px] text-zinc-400">All guardian safety policies and live agent executions are nominal.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
