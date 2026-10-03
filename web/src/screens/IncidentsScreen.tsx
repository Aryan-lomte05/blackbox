import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { formatRelativeTime } from '../lib/time';
import {
  ShieldAlert,
  PauseCircle,
  ChevronLeft,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Clock,
  Send,
} from 'lucide-react';

export const IncidentsScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'Summary' | 'Timeline' | 'Cause' | 'Agent Output' | 'Notification'>('Summary');
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  // Fetch incidents list from real backend
  const { data: listData, isLoading } = useQuery<{ incidents: any[] }>({
    queryKey: ['incidents-list'],
    queryFn: async () => {
      const resp = await api.get<any>('/api/incidents');
      return Array.isArray(resp) ? { incidents: resp } : resp;
    },
  });

  const incidents: any[] = listData?.incidents || [];
  const currentIncident = incidents.find((i) => i.incident_id === selectedIncidentId) || incidents[0] || null;

  // Real decision mutation
  const decisionMutation = useMutation({
    mutationFn: async ({ approve }: { approve: boolean }) => {
      if (!currentIncident) return;
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

  if (isLoading) {
    return (
      <div className="p-12 text-center text-xs font-mono text-zinc-500">
        Loading active guardian incidents...
      </div>
    );
  }

  if (!currentIncident) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-4 font-sans text-center">
        <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
        <h2 className="text-base font-bold text-white font-mono">No Active Incidents</h2>
        <p className="text-xs text-zinc-400">All guardian policies and live agent executions are nominal.</p>
        <Link to="/" className="text-xs text-blue-400 hover:text-blue-300 inline-block pt-2">
          ← Return to Overview
        </Link>
      </div>
    );
  }

  const causeStep = currentIncident.evidence?.cause_step;
  const causeNote = currentIncident.evidence?.cause_note || 'Identified root cause';
  const timeline = currentIncident.evidence?.timeline || [];
  const notifications = currentIncident.notifications || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Breadcrumb Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
          <Link to="/" className="hover:text-zinc-300 flex items-center gap-1">
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Incidents</span>
          </Link>
          <span>/</span>
          <span className="text-zinc-300">Incident #{currentIncident.incident_id}</span>
        </div>

        {incidents.length > 1 && (
          <select
            value={currentIncident.incident_id}
            onChange={(e) => setSelectedIncidentId(e.target.value)}
            className="bg-[#121316] border border-white/[0.08] text-xs font-mono text-zinc-300 rounded-lg px-2.5 py-1 focus:outline-none"
          >
            {incidents.map((inc) => (
              <option key={inc.incident_id} value={inc.incident_id}>
                {inc.severity.toUpperCase()}: {inc.title.slice(0, 30)}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Incident Hero Bar matching Reference Panel 6 */}
      <div className="p-5 rounded-2xl bg-[#0c0d10] border border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 shrink-0 shadow-lg shadow-rose-950/50">
            <PauseCircle className="w-6 h-6 animate-pulse" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-600 text-white uppercase tracking-wider">
                {currentIncident.severity.toUpperCase()}
              </span>
              <span className="text-lg font-bold text-white font-heading">
                {currentIncident.title}
              </span>
            </div>

            <div className="text-xs text-zinc-300">
              {currentIncident.what_happened || 'Agent paused after safety guardrail triggered'}
            </div>

            <div className="text-[11px] font-mono text-zinc-500 flex items-center gap-2">
              <span>{formatRelativeTime(currentIncident.created_at)}</span>
              <span>·</span>
              <Link to={`/runs/${currentIncident.run_id}`} className="text-blue-400 hover:text-blue-300">
                run_{currentIncident.run_id.slice(0, 6)}
              </Link>
              <span>·</span>
              <span className="text-zinc-400 uppercase">Status: {currentIncident.status}</span>
            </div>
          </div>
        </div>

        {/* Right Status Badge Box */}
        <div className="p-3 rounded-xl bg-[#14151a] border border-white/[0.06] text-right self-start md:self-auto">
          <div className="text-[11px] font-mono font-bold text-rose-400 uppercase tracking-wider">
            {currentIncident.status === 'approved' ? 'RETRY APPROVED' : 'AGENT PAUSED'}
          </div>
          <div className="text-[10px] text-zinc-400 mt-0.5 max-w-xs">
            {currentIncident.decision
              ? `Decision by ${currentIncident.decision.by} (${currentIncident.decision.note})`
              : 'Autonomous safety circuit breaker engaged. Awaiting operator action.'}
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
          {activeTab === 'Summary' && (
            <div className="space-y-5">
              <p className="text-xs text-zinc-300 leading-relaxed">
                {currentIncident.what_happened} {currentIncident.why}
              </p>

              {/* 4-Metric Summary Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-3 rounded-xl bg-[#0c0d10] border border-white/[0.06] space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase">Cause</span>
                  <div className="text-zinc-200 font-bold text-[11px] truncate">
                    {causeStep !== undefined ? `Step ${causeStep}` : 'Analysis'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#0c0d10] border border-white/[0.06] space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase">Confidence</span>
                  <div className="text-emerald-400 font-bold text-[11px]">Verified by replay</div>
                </div>

                <div className="p-3 rounded-xl bg-[#0c0d10] border border-white/[0.06] space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase">Impact</span>
                  <div className="text-zinc-200 font-bold text-[11px]">
                    {timeline.length} recorded steps
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#0c0d10] border border-white/[0.06] space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase">Status</span>
                  <div className="text-cyan-400 font-bold text-[11px] uppercase">
                    {currentIncident.status}
                  </div>
                </div>
              </div>

              {currentIncident.how_to_fix && currentIncident.how_to_fix.length > 0 && (
                <div className="p-4 rounded-xl bg-[#0c0d10] border border-white/[0.06] space-y-2">
                  <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider block">
                    Recommended Fix Strategy
                  </span>
                  <ul className="space-y-1 text-xs text-zinc-300 list-disc pl-4">
                    {currentIncident.how_to_fix.map((fix: string, idx: number) => (
                      <li key={idx}>{fix}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {activeTab === 'Timeline' && (
            <div className="space-y-2">
              <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider block mb-2">
                Incident Step Timeline
              </span>
              <div className="space-y-1.5 font-mono text-xs">
                {timeline.map((item: any, idx: number) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border flex items-center justify-between ${
                      item.flag
                        ? 'bg-rose-950/20 border-rose-500/40 text-rose-200'
                        : 'bg-[#0c0d10] border-white/[0.04] text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded bg-black/40 flex items-center justify-center font-bold text-zinc-400 text-[11px]">
                        #{item.idx}
                      </span>
                      <span>{item.label}</span>
                    </div>
                    {item.flag && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white">
                        {item.flag}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'Cause' && (
            <div className="p-4 rounded-xl bg-[#0c0d10] border border-white/[0.06] space-y-3 font-mono text-xs">
              <div className="text-zinc-400 uppercase tracking-wider text-[11px]">Cause Diagnosis</div>
              <div className="text-zinc-200 text-sm">{currentIncident.why}</div>
              <div className="text-zinc-400 pt-2 border-t border-white/[0.04]">
                Cause Note: <span className="text-emerald-400">{causeNote}</span>
              </div>
            </div>
          )}

          {activeTab === 'Agent Output' && (
            <div className="p-4 rounded-xl bg-[#0c0d10] border border-white/[0.06] space-y-3 font-mono text-xs">
              <div className="text-zinc-400 uppercase tracking-wider text-[11px]">Agent Execution Narrative</div>
              <pre className="text-cyan-300 whitespace-pre-wrap">{currentIncident.what_happened}</pre>
            </div>
          )}

          {activeTab === 'Notification' && (
            <div className="space-y-2">
              <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider block mb-2">
                Delivered Notifications
              </span>
              {notifications.map((notif: any, idx: number) => (
                <div key={idx} className="p-3 rounded-lg bg-[#0c0d10] border border-white/[0.06] font-mono text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-300 uppercase font-bold">Channel: {notif.channel}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 uppercase">
                      {notif.status}
                    </span>
                  </div>
                  <div className="text-zinc-500 text-[11px]">{notif.detail}</div>
                </div>
              ))}
            </div>
          )}

          {/* Bottom Action Controls matching Reference */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => decisionMutation.mutate({ approve: false })}
              disabled={decisionMutation.isPending}
              className="px-4 py-2 rounded-lg bg-[#14161b] hover:bg-[#1b1e25] border border-white/[0.08] text-xs font-medium text-zinc-200 transition-colors cursor-pointer"
            >
              Keep Paused
            </button>

            <button
              onClick={() => decisionMutation.mutate({ approve: true })}
              disabled={decisionMutation.isPending}
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
              <span className="text-xs font-bold text-white">Black Box Guardian</span>
            </div>

            <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold">
              <PauseCircle className="w-4 h-4" />
              <span>{currentIncident.status === 'approved' ? 'Pause Released' : 'Agent Paused'}</span>
            </div>

            <div className="text-xs text-zinc-300 leading-relaxed">
              {currentIncident.title}: {currentIncident.what_happened}
            </div>

            <div className="text-[11px] font-mono text-zinc-400 space-y-0.5 pt-1 border-t border-white/[0.04]">
              <div>Cause: {causeStep !== undefined ? `Step ${causeStep}` : 'Identified by GNN'}</div>
              <div className="text-emerald-400">Autonomous pause prevented downstream divergence.</div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => navigate(`/runs/${currentIncident.run_id}`)}
                className="w-full py-1.5 rounded-lg bg-[#14161b] hover:bg-[#1c1f26] border border-white/[0.08] text-xs font-medium text-zinc-300 transition-colors cursor-pointer"
              >
                Inspect Run #{currentIncident.run_id.slice(0, 6)}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
