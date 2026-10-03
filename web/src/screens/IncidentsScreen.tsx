import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { VerdictBadge } from '../components/common/VerdictBadge';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  DollarSign,
  Send,
  Mail,
  MessageSquare,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  Terminal,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const IncidentsScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  // Fetch list of incidents
  const { data: listData, isLoading: listLoading } = useQuery<{ incidents: any[] }>({
    queryKey: ['incidents-list'],
    queryFn: async () => {
      const resp = await api.get<any>('/api/incidents');
      return Array.isArray(resp) ? { incidents: resp } : resp;
    },
  });

  const incidents = listData?.incidents || [];
  const currentIncidentId = selectedIncidentId || incidents[0]?.incident_id;

  // Fetch single incident details
  const { data: detail, isLoading: detailLoading } = useQuery<any>({
    queryKey: ['incident-detail', currentIncidentId],
    queryFn: async () => {
      if (!currentIncidentId) return null;
      return await api.get<any>(`/api/incidents/${currentIncidentId}`);
    },
    enabled: !!currentIncidentId,
  });

  // Decision mutation (approve / reject paused run)
  const decisionMutation = useMutation({
    mutationFn: async ({ id, approve, note }: { id: string; approve: boolean; note?: string }) => {
      return await api.post<any>(`/api/incidents/${id}/decision`, {
        approve,
        by: 'Advay (Dashboard)',
        note: note || (approve ? 'Approved via dashboard' : 'Kept paused via dashboard'),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents-list'] });
      queryClient.invalidateQueries({ queryKey: ['incident-detail', currentIncidentId] });
    },
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-mono">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
              DEMO SCREEN 8
            </span>
            <span className="text-xs text-zinc-400">Guardian Autonomous Oversight & Human Approval</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight mt-1 flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-rose-500" />
            Guardian Incident Response
          </h2>
          <p className="text-sm text-zinc-400 mt-1 max-w-2xl font-sans">
            Plain-language incident reports delivered via email, WhatsApp, and Slack.
            Unattended money-moving agents are paused immediately until authorized by the owner.
          </p>
        </div>
      </div>

      {listLoading && (
        <div className="p-12 text-center text-zinc-500 text-xs">
          Loading Guardian incident backlog...
        </div>
      )}

      {/* Main Split Layout: Left List, Right Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Incidents Backlog */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-xs">
            <span className="uppercase font-bold text-zinc-400 tracking-wider">
              Backlog ({incidents.length})
            </span>
            <span className="text-[11px] text-zinc-500">Watched Agents</span>
          </div>

          <div className="space-y-2.5 max-h-[720px] overflow-y-auto pr-1">
            {incidents.map((inc) => {
              const isSelected = inc.incident_id === currentIncidentId;
              const isCritical = inc.severity === 'critical';

              return (
                <div
                  key={inc.incident_id}
                  onClick={() => setSelectedIncidentId(inc.incident_id)}
                  className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-rose-950/40 border-rose-500 shadow-md shadow-rose-950/50 text-white ring-1 ring-rose-500/40'
                      : 'bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        isCritical
                          ? 'bg-rose-950 text-rose-300 border border-rose-500/50'
                          : 'bg-amber-950 text-amber-300 border border-amber-500/50'
                      }`}
                    >
                      {inc.severity}
                    </span>

                    {inc.needs_approval && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 animate-pulse">
                        <DollarSign className="w-3 h-3 text-amber-400" />
                        PAUSED
                      </span>
                    )}

                    <span className="text-[10px] text-zinc-500 uppercase">{inc.status}</span>
                  </div>

                  <div className="font-bold text-zinc-100 truncate">{inc.title}</div>
                  <div className="text-[11px] text-zinc-400 mt-1 flex items-center justify-between">
                    <span>Run: {inc.run_id?.slice(0, 10)}</span>
                    <span>{new Date(inc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 2 Columns: Detailed Incident Case File */}
        <div className="lg:col-span-2 space-y-6">
          {detailLoading && (
            <div className="p-16 text-center text-zinc-500 text-xs">Loading incident details...</div>
          )}

          {detail && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Executive Incident Header Card */}
              <div className="p-6 rounded-xl bg-zinc-900/80 border border-zinc-800 shadow-xl space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase font-bold text-rose-400">
                        INCIDENT #{detail.incident_id}
                      </span>
                      <span className="text-[11px] text-zinc-500">Owner: {detail.owner || 'Aryan'}</span>
                    </div>
                    <h3 className="text-xl font-bold text-white tracking-tight">{detail.title}</h3>
                  </div>

                  <Link
                    to={`/runs/${detail.run_id}`}
                    className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs flex items-center gap-1.5 transition-colors self-start md:self-auto"
                  >
                    <span>View Flight Trace</span>
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                  </Link>
                </div>

                {/* What / Why / Fix breakdown */}
                <div className="space-y-3 text-xs leading-relaxed">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-0.5">
                      What Happened
                    </span>
                    <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 font-sans">
                      {detail.what_happened}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-rose-400 block mb-0.5">
                      Root Cause Finding
                    </span>
                    <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-500/30 text-rose-100 font-sans">
                      {detail.why}
                    </div>
                  </div>

                  {detail.how_to_fix && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-0.5">
                        Recommended Recovery Fix
                      </span>
                      <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-emerald-100 font-sans space-y-1">
                        {Array.isArray(detail.how_to_fix) ? (
                          detail.how_to_fix.map((f: string, i: number) => <div key={i}>• {f}</div>)
                        ) : (
                          <div>{detail.how_to_fix}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Money-Moving Approval Gate (Crucial Guardian USP) */}
                {detail.needs_approval && (
                  <div className="p-5 rounded-xl bg-gradient-to-r from-amber-950/40 via-amber-950/20 to-zinc-950 border border-amber-500/50 space-y-3">
                    <div className="flex items-center gap-2 text-amber-300 text-xs font-bold uppercase tracking-wider">
                      <DollarSign className="w-4 h-4 text-amber-400" />
                      Financial Oversight Protection: Agent Paused
                    </div>
                    <p className="text-xs text-zinc-300 font-sans">
                      {detail.actions_taken ||
                        'This agent attempted real money-moving actions. Black Box has paused further execution to protect capital until human approval.'}
                    </p>

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={() =>
                          decisionMutation.mutate({ id: detail.incident_id, approve: true })
                        }
                        disabled={decisionMutation.isPending}
                        className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Authorize & Resume Agent</span>
                      </button>

                      <button
                        onClick={() =>
                          decisionMutation.mutate({ id: detail.incident_id, approve: false })
                        }
                        disabled={decisionMutation.isPending}
                        className="px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs flex items-center gap-2 shadow-lg shadow-rose-950/50 cursor-pointer disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Keep Paused (Reject)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Notification Dispatch Channels */}
              {detail.notifications && (
                <div className="p-6 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 block pb-2 border-b border-zinc-800">
                    Dispatched Alert Channels
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {detail.notifications.map((notif: any, idx: number) => {
                      const isSent = notif.status === 'sent';
                      return (
                        <div
                          key={idx}
                          className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2 text-zinc-300">
                            {notif.channel?.includes('email') ? (
                              <Mail className="w-4 h-4 text-blue-400" />
                            ) : notif.channel?.includes('whatsapp') ? (
                              <MessageSquare className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Send className="w-4 h-4 text-zinc-400" />
                            )}
                            <span className="capitalize">{notif.channel}</span>
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              isSent
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                : 'bg-zinc-800 text-zinc-500'
                            }`}
                          >
                            {notif.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Evidence Timeline */}
              {detail.evidence?.timeline && (
                <div className="p-6 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 block pb-2 border-b border-zinc-800">
                    Incident Chronological Sequence
                  </span>

                  <div className="space-y-2">
                    {detail.evidence.timeline.map((step: any, idx: number) => {
                      const isCause = step.flag?.includes('cause') || step.idx === detail.evidence.cause_step;
                      return (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                            isCause
                              ? 'bg-rose-950/40 border-rose-500/50 text-rose-200 font-bold'
                              : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-zinc-500 font-bold">#{step.idx}</span>
                            <span className="truncate">{step.label}</span>
                          </div>

                          {step.flag && (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-rose-600 text-white uppercase shrink-0">
                              {step.flag}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
