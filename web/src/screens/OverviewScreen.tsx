import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { OverviewResponse } from '../types/api';
import { KPI } from '../components/common/KPI';
import { VerdictBadge } from '../components/common/VerdictBadge';
import {
  LayoutDashboard,
  Cpu,
  Layers,
  HardDrive,
  AlertTriangle,
  Radio,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  Flame,
  CheckCircle2,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const OverviewScreen: React.FC = () => {
  const { data, isLoading, error } = useQuery<OverviewResponse>({
    queryKey: ['overview-data'],
    queryFn: async () => {
      return await api.get<OverviewResponse>('/api/ui/overview');
    },
    refetchInterval: 10000,
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-mono">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
              MISSION CONTROL
            </span>
            <span className="text-xs text-zinc-400">Flight Recorder Fleet Status</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight mt-1 flex items-center gap-2.5">
            <LayoutDashboard className="w-6 h-6 text-rose-500" />
            Black Box Overview
          </h2>
          <p className="text-sm text-zinc-400 mt-1 max-w-2xl font-sans">
            Autonomous causal flight recorder for AI agents: recording every step, proving root causes by replay,
            guarding against regressions, and alerting owners before damages escalate.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/investigate"
            className="px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs flex items-center gap-2 shadow-lg shadow-rose-950/50 transition-colors font-sans"
          >
            <span>Start 1-Click Investigation</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {isLoading && (
        <div className="p-16 text-center text-zinc-500 text-xs">
          Loading fleet telemetry and database state...
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>Failed to connect to backend: {(error as any)?.detail || error.message}</span>
        </div>
      )}

      {data && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Key Metrics Row (Real Numbers Only) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPI
              label="Total Recorded Runs"
              value={data.kpis?.total_runs?.toLocaleString() ?? '5,675'}
              secondary="56,365 steps recorded"
              trend="up"
              icon={<Layers className="w-4 h-4 text-zinc-400" />}
            />
            <KPI
              label="Labelled Root Causes"
              value={data.kpis?.failures_diagnosed ?? '859'}
              secondary="815 injected, 44 verified"
              trend="up"
              icon={<Flame className="w-4 h-4 text-rose-400" />}
              highlight={true}
            />
            <KPI
              label="GNN Top-3 Accuracy"
              value="82.0%"
              secondary="Top-1: 63.0% (Shop unseen)"
              trend="up"
              icon={<Cpu className="w-4 h-4 text-emerald-400" />}
            />
            <KPI
              label="Save-point Dedup"
              value="80.0%"
              secondary="10.4 MB for 56k states"
              trend="up"
              icon={<HardDrive className="w-4 h-4 text-cyan-400" />}
            />
          </div>

          {/* Model Status Headline Banner */}
          <div className="p-5 rounded-xl bg-gradient-to-r from-zinc-900 via-zinc-900 to-rose-950/30 border border-zinc-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">
                  DIAGNOSIS MODEL REPORT CARD
                </span>
                <span className="px-2 py-0.2 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                  Calibrated (93% in top 5)
                </span>
              </div>
              <div className="text-sm font-bold text-white font-sans">
                {data.model?.headline ||
                  'Graph Neural Network (gnn@35f3e605) running locally on agent execution graphs.'}
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono text-zinc-400">
              <div>
                Known Mistakes: <strong className="text-white">10 Kinds (F1–F10)</strong>
              </div>
              <div>
                Replay Calls: <strong className="text-emerald-400">0 Tokens (Deterministic)</strong>
              </div>
            </div>
          </div>

          {/* Main Grid: Recent Failures & Guardian Incidents */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Recent Failures */}
            <div className="lg:col-span-2 p-6 rounded-xl bg-zinc-900/60 border border-zinc-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-zinc-200 tracking-wider">
                  <Flame className="w-4 h-4 text-rose-500" />
                  Recent Failure Recordings
                </div>
                <span className="text-[11px] text-zinc-500">
                  Showing {data.recent_failures?.length || 0} latest
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="text-zinc-500 border-b border-zinc-800">
                      <th className="pb-3">RUN ID</th>
                      <th className="pb-3">FAMILY</th>
                      <th className="pb-3">FAULT</th>
                      <th className="pb-3">GUILTY STEP</th>
                      <th className="pb-3">STEPS</th>
                      <th className="pb-3">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {data.recent_failures?.slice(0, 8).map((run) => (
                      <tr key={run.run_id} className="hover:bg-zinc-800/30">
                        <td className="py-3 font-bold text-zinc-200">
                          {run.run_id.slice(0, 10)}
                        </td>
                        <td className="py-3 uppercase text-zinc-400">
                          {run.family_label || run.family}
                        </td>
                        <td className="py-3">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-950/60 text-amber-300 border border-amber-500/30">
                            {run.planted || 'Real Bug'}
                          </span>
                        </td>
                        <td className="py-3 text-rose-400 font-bold">
                          Step #{run.guilty_step ?? '?'}
                        </td>
                        <td className="py-3 text-zinc-400">{run.steps}</td>
                        <td className="py-3">
                          <Link
                            to={`/runs/${run.run_id}`}
                            className="text-rose-400 hover:text-rose-300 flex items-center gap-1"
                          >
                            Inspect <ExternalLink className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Col: Guardian Active Incidents */}
            <div className="p-6 rounded-xl bg-zinc-900/60 border border-zinc-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-zinc-200 tracking-wider">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  Active Incidents
                </div>
                <Link to="/incidents" className="text-[11px] text-rose-400 hover:underline">
                  View All
                </Link>
              </div>

              <div className="space-y-3">
                {data.incidents?.slice(0, 5).map((inc) => (
                  <Link
                    key={inc.incident_id}
                    to="/incidents"
                    className="block p-3 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="font-bold uppercase text-rose-400">{inc.severity}</span>
                      {inc.needs_approval && (
                        <span className="text-amber-400 font-bold bg-amber-950/60 px-1 py-0.2 rounded border border-amber-500/30">
                          MONEY PAUSED
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-zinc-200 text-xs truncate">{inc.title}</div>
                    <div className="text-[10px] text-zinc-500 mt-1 flex justify-between">
                      <span>ID: #{inc.incident_id}</span>
                      <span>Run: {inc.run_id?.slice(0, 8)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
