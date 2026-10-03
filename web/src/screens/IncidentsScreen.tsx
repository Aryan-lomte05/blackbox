import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { ShieldAlert, PauseCircle, ChevronLeft, ArrowRight, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';

export const IncidentsScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'Summary' | 'Timeline' | 'Cause' | 'Agent Output' | 'Notification'>('Summary');

  // Fetch incidents list
  const { data: listData } = useQuery<{ incidents: any[] }>({
    queryKey: ['incidents-list'],
    queryFn: async () => {
      const resp = await api.get<any>('/api/incidents');
      return Array.isArray(resp) ? { incidents: resp } : resp;
    },
  });

  const incidents = listData?.incidents || [];
  const currentIncident = incidents[0] || {
    incident_id: 'trader-bot-pause',
    title: 'Trader Bot',
    severity: 'critical',
    created_at: 'Jan 4, 2026 · 12:14',
    run_id: 'run_9A71',
  };

  // Real decision mutation
  const decisionMutation = useMutation({
    mutationFn: async ({ approve }: { approve: boolean }) => {
      return await api.post<any>(`/api/incidents/${currentIncident.incident_id}/decision`, {
        approve,
        by: 'Advay (Dashboard)',
        note: approve ? 'Authorized by Operator' : 'Maintained pause by Operator',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents-list'] });
      alert('Incident decision registered with Guardian.');
    },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Breadcrumb Header */}
      <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
        <Link to="/" className="hover:text-zinc-300 flex items-center gap-1">
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Incidents</span>
        </Link>
        <span>/</span>
        <span className="text-zinc-300">Incident Detail</span>
      </div>

      {/* Incident Hero Bar matching Reference Panel 6 */}
      <div className="p-5 rounded-2xl bg-[#0c0d10] border border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xl">
        <div className="flex items-center gap-4">
          {/* Pulsing Red Paused Icon */}
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 shrink-0 shadow-lg shadow-rose-950/50">
            <PauseCircle className="w-6 h-6 animate-pulse" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-600 text-white uppercase tracking-wider">
                CRITICAL
              </span>
              <span className="text-lg font-bold text-white font-heading">
                {currentIncident.title || 'Trader Bot'}
              </span>
            </div>

            <div className="text-xs text-zinc-300">
              Agent paused after unsafe action attempt
            </div>

            <div className="text-[11px] font-mono text-zinc-500">
              Jan 4, 2026 · 12:14 · {currentIncident.run_id || 'run_9A71'}
            </div>
          </div>
        </div>

        {/* Right Status Badge Box */}
        <div className="p-3 rounded-xl bg-[#14151a] border border-white/[0.06] text-right self-start md:self-auto">
          <div className="text-[11px] font-mono font-bold text-rose-400 uppercase tracking-wider">
            AGENT PAUSED
          </div>
          <div className="text-[10px] text-zinc-400 mt-0.5 max-w-xs">
            No money-moving tools were executed during investigation.
          </div>
        </div>
      </div>

      {/* Navigation Tabs matching Reference */}
      <div className="flex items-center gap-6 border-b border-white/[0.06] text-xs">
        {(['Summary', 'Timeline', 'Cause', 'Agent Output', 'Notification'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-2.5 transition-colors relative cursor-pointer ${
              activeTab === tab ? 'text-white font-medium' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <span>{tab}</span>
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Main 2-Column Grid matching Reference Panel 6 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Investigation Details & Actions (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <p className="text-xs text-zinc-300 leading-relaxed">
            The agent attempted to place an order after receiving a misleading search result. Black Box paused the agent and identified the root cause.
          </p>

          {/* 4-Metric Summary Grid matching Reference */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-3 rounded-xl bg-[#0c0d10] border border-white/[0.06] space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase">Cause</span>
              <div className="text-zinc-200 font-bold text-[11px]">Step 4 - Search result</div>
            </div>

            <div className="p-3 rounded-xl bg-[#0c0d10] border border-white/[0.06] space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase">Confidence</span>
              <div className="text-emerald-400 font-bold text-[11px]">Verified by replay</div>
            </div>

            <div className="p-3 rounded-xl bg-[#0c0d10] border border-white/[0.06] space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase">Impact</span>
              <div className="text-zinc-200 font-bold text-[11px]">9 downstream steps</div>
            </div>

            <div className="p-3 rounded-xl bg-[#0c0d10] border border-white/[0.06] space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase">Recovery paths</span>
              <div className="text-cyan-400 font-bold text-[11px]">2 verified paths</div>
            </div>
          </div>

          {/* Bottom Action Controls matching Reference */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => decisionMutation.mutate({ approve: false })}
              className="px-4 py-2 rounded-lg bg-[#14161b] hover:bg-[#1b1e25] border border-white/[0.08] text-xs font-medium text-zinc-200 transition-colors cursor-pointer"
            >
              Keep Paused
            </button>

            <button
              onClick={() => decisionMutation.mutate({ approve: true })}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-lg shadow-blue-900/30 transition-all cursor-pointer"
            >
              Approve Retry
            </button>
          </div>
        </div>

        {/* Right Column: Notification Preview Card (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="text-xs font-bold text-white font-mono uppercase tracking-wider">
            Notification Preview
          </div>

          <div className="p-4 rounded-xl bg-[#0c0d10] border border-white/[0.08] space-y-3 shadow-xl">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-zinc-800 border border-white/[0.08] flex items-center justify-center text-[10px] font-bold text-white">
                B
              </div>
              <span className="text-xs font-bold text-white">Black Box</span>
            </div>

            <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold">
              <PauseCircle className="w-4 h-4" />
              <span>Agent paused</span>
            </div>

            <div className="text-xs text-zinc-300 leading-relaxed">
              Trader Bot encountered a verified failure.
            </div>

            <div className="text-[11px] font-mono text-zinc-400 space-y-0.5 pt-1 border-t border-white/[0.04]">
              <div>Cause: Search input (Step 4)</div>
              <div className="text-emerald-400">No order was executed.</div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => navigate(`/runs/${currentIncident.run_id}`)}
                className="w-full py-1.5 rounded-lg bg-[#14161b] hover:bg-[#1c1f26] border border-white/[0.08] text-xs font-medium text-zinc-300 transition-colors"
              >
                View Incident
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
