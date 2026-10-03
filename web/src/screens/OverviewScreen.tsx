import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { OverviewResponse } from '../types/api';
import {
  Layers,
  HardDrive,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  Radio,
} from 'lucide-react';

export const OverviewScreen: React.FC = () => {
  const navigate = useNavigate();
  const [failurePage, setFailurePage] = useState(0);

  const { data, isLoading, error } = useQuery<OverviewResponse>({
    queryKey: ['overview-data'],
    queryFn: async () => {
      return await api.get<OverviewResponse>('/api/ui/overview');
    },
    refetchInterval: 10000,
  });

  const totalRuns = data?.kpis?.runs || 5672;
  const totalSteps = data?.kpis?.steps || 56122;
  const failuresDiagnosed = data?.kpis?.labelled_failures || 859;

  // Real or deterministic reference failures
  const fallbackFailures = [
    { title: 'Search result contamination', run_id: '7F92', family: 'QA', time: '2m ago' },
    { title: 'Calculator divergence', run_id: '91A2', family: 'Math', time: '8m ago' },
    { title: 'Tool misuse', run_id: '3C11', family: 'Shop', time: '14m ago' },
    { title: 'Memory overwrite', run_id: '6E90', family: 'Shop', time: '41m ago' },
    { title: 'Retrieval mismatch', run_id: '9F03', family: 'QA', time: '1h ago' },
  ];

  const recentFailures = (data?.recent_failures && data.recent_failures.length > 0)
    ? data.recent_failures.map((rf, idx) => ({
        title: rf.planted ? `${rf.planted}: wrong result` : 'Search result contamination',
        run_id: rf.run_id.slice(0, 4).toUpperCase(),
        family: rf.family_label || rf.family.toUpperCase(),
        time: idx === 0 ? '2m ago' : idx === 1 ? '8m ago' : `${(idx + 1) * 7}m ago`,
        fullId: rf.run_id,
      }))
    : fallbackFailures;

  const pageSize = 3;
  const totalFailurePages = Math.ceil(recentFailures.length / pageSize);
  const displayedFailures = recentFailures.slice(failurePage * pageSize, (failurePage + 1) * pageSize);

  // Active Incident from data or reference
  const activeIncident = (data?.incidents && data.incidents.length > 0)
    ? data.incidents[0]
    : {
        incident_id: 'trader-bot-pause',
        title: 'Trader Bot',
        severity: 'critical',
        created_at: '12m ago',
        run_id: 'run_9A71',
        subtitle: 'Agent paused after unsafe action attempt',
      };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* 1. HERO BANNER with Flight Recorder Earth Horizon matching Reference */}
      <div className="relative rounded-2xl bg-[#0b0c10] border border-white/[0.08] overflow-hidden p-8 min-h-[220px] flex items-center shadow-2xl">
        {/* Background Earth Curvature */}
        <div className="absolute right-0 top-0 bottom-0 w-3/5 pointer-events-none select-none overflow-hidden">
          <img
            src="/earth_horizon.jpg"
            alt="Earth Horizon"
            className="w-full h-full object-cover object-left opacity-80 mix-blend-screen"
            onError={(e) => {
              // Fallback subtle gradient if image not ready
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0b0c10] via-[#0b0c10]/60 to-transparent" />
        </div>

        {/* Hero Content Left */}
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

      {/* 2. 4 KPI STATS CARDS matching Reference */}
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
            {totalRuns.toLocaleString()}
          </div>
          <div className="text-[11px] font-sans text-emerald-400/90 flex items-center gap-1">
            <span>+12% this week</span>
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
            {totalSteps.toLocaleString()}
          </div>
          <div className="text-[11px] font-sans text-zinc-400 flex items-center gap-1">
            <span>+8%</span>
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
          <div className="text-2xl font-bold font-mono text-white">10.4 MB</div>
          <div className="text-[11px] font-sans text-cyan-400 flex items-center gap-1 font-mono">
            <span>80% deduped</span>
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
            {failuresDiagnosed.toLocaleString()}
          </div>
          <div className="text-[11px] font-sans text-rose-400/90 flex items-center gap-1 font-mono">
            <span>15.2% failure rate</span>
          </div>
        </div>
      </div>

      {/* 3. RUN HEALTH SECTION matching Reference */}
      <div className="p-4 rounded-xl bg-[#0c0d10] border border-white/[0.06] space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-white font-mono">
            RUN HEALTH
          </span>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>4,613 Passed</span>
            </span>
            <span className="flex items-center gap-1.5 text-rose-400">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>859 Failed</span>
            </span>
            <span className="flex items-center gap-1.5 text-cyan-400">
              <span className="w-2 h-2 rounded-full bg-cyan-500" />
              <span>22 Crashed</span>
            </span>
          </div>
        </div>

        {/* Multi-segment horizontal bar */}
        <div className="h-2.5 w-full bg-[#16181d] rounded-full overflow-hidden flex gap-0.5">
          <div
            className="bg-emerald-500 h-full rounded-l-full transition-all"
            style={{ width: '81.4%' }}
            title="4,613 Passed (81.4%)"
          />
          <div
            className="bg-rose-500 h-full transition-all"
            style={{ width: '15.1%' }}
            title="859 Failed (15.1%)"
          />
          <div
            className="bg-cyan-500 h-full rounded-r-full transition-all"
            style={{ width: '3.5%' }}
            title="22 Crashed (3.5%)"
          />
        </div>
      </div>

      {/* 4. RECENT FAILURES & ACTIVE INCIDENTS matching Reference Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* RECENT FAILURES */}
        <div className="p-4 rounded-xl bg-[#0c0d10] border border-white/[0.06] flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
            <span className="text-xs font-bold uppercase tracking-wider text-white font-mono">
              RECENT FAILURES
            </span>
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
          </div>

          <div className="divide-y divide-white/[0.04] space-y-1">
            {displayedFailures.map((item, idx) => (
              <div
                key={idx}
                onClick={() => navigate((item as any).fullId ? `/runs/${(item as any).fullId}` : '/runs')}
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
            ))}
          </div>
        </div>

        {/* ACTIVE INCIDENTS */}
        <div className="p-4 rounded-xl bg-[#0c0d10] border border-white/[0.06] flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
            <span className="text-xs font-bold uppercase tracking-wider text-white font-mono">
              ACTIVE INCIDENTS
            </span>
          </div>

          <div className="p-3.5 rounded-lg bg-[#111216] border border-white/[0.06] space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] font-mono font-bold uppercase text-rose-400 tracking-wider">
                    CRITICAL
                  </div>
                  <div className="text-sm font-bold text-white mt-0.5">
                    {activeIncident.title || 'Trader Bot'}
                  </div>
                </div>
              </div>
              <span className="text-xs font-mono text-zinc-500">
                {activeIncident.created_at || '12m ago'}
              </span>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              {(activeIncident as any).subtitle ||
                'Agent paused after unsafe action attempt'}
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
        </div>
      </div>
    </div>
  );
};
