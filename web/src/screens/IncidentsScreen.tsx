import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
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
  UserCheck,
  ChevronRight,
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
        note: note || (approve ? 'Authorized via Mission Control' : 'Paused by Mission Control'),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents-list'] });
      queryClient.invalidateQueries({ queryKey: ['incident-detail', currentIncidentId] });
    },
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
              DEMO 8 • GUARDIAN OVERSIGHT
            </span>
            <span className="text-xs text-zinc-400">Autonomous Incident Response & Human Gate</span>
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-inner">
              <ShieldAlert className="w-5 h-5" />
            </div>
            Guardian Incident Response
          </h2>
          <p className="text-sm text-zinc-400 mt-1.5 max-w-2xl leading-relaxed">
            Plain-language incident reports dispatched instantly via Email, WhatsApp, and Slack.
            Unattended money-moving agents are paused immediately until authorized by the human owner.
          </p>
        </div>
      </div>

      {listLoading && (
        <div className="p-16 text-center text-zinc-500 text-xs animate-pulse">
          Loading Guardian incident backlog...
        </div>
      )}

      {/* Main Split Layout: Left List, Right Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Incidents Backlog */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-xs">
            <span className="uppercase font-bold text-zinc-300 tracking-wider">
              Watched Agents Backlog ({incidents.length})
            </span>
            <span className="text-[11px] font-mono text-zinc-500">Live Sentry</span>
          </div>

          <div className="space-y-2.5 max-h-[720px] overflow-y-auto pr-1">
            {incidents.map((inc) => {
              const isSelected = inc.incident_id === currentIncidentId;
              const isCritical = inc.severity === 'critical';

              return (
                <motion.div
                  key={inc.incident_id}
                  whileHover={{ x: 2 }}
                  onClick={() => setSelectedIncidentId(inc.incident_id)}
                  className={`p-4 rounded-xl border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-rose-950/40 border-rose-500 shadow-lg shadow-rose-950/50 text-white ring-1 ring-rose-500/50'
                      : 'glass-card border-zinc-800/80 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                        isCritical
                          ? 'bg-rose-950 text-rose-300 border border-rose-500/50'
                          : 'bg-amber-950 text-amber-300 border border-amber-500/50'
                      }`}
                    >
                      {inc.severity}
                    </span>

                    {inc.needs_approval && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 animate-pulse font-mono">
                        <DollarSign className="w-3 h-3 text-amber-400" />
                        FINANCIAL PAUSE
                      </span>
                    )}

                    <span className="text-[10px] font-mono text-zinc-500 uppercase">{inc.status}</span>
                  </div>

                  <div className="font-bold text-zinc-100 text-sm leading-snug line-clamp-2">{inc.title}</div>
                  <div className="text-[11px] text-zinc-400 mt-2 flex items-center justify-between font-mono">
                    <span>Run: {inc.run_id?.slice(0, 10)}</span>
                    <span className="text-zinc-500">{new Date(inc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Right 2 Columns: Detailed Incident Case File */}
        <div className="lg:col-span-2 space-y-6">
          {detailLoading && (
            <div className="p-16 text-center text-zinc-500 text-xs">Loading incident case file...</div>
          )}

          <AnimatePresence mode="wait">
            {detail && (
              <motion.div
                key={detail.incident_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Executive Incident Header Card */}
                <div className="glass-card p-6 rounded-2xl border border-zinc-800 shadow-xl space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs uppercase font-bold text-rose-400 font-mono tracking-wider">
                          CASE FILE #{detail.incident_id}
                        </span>
                        <span className="text-[11px] text-zinc-500">Agent Owner: <strong className="text-zinc-300">{detail.owner || 'Aryan'}</strong></span>
                      </div>
                      <h3 className="text-2xl font-extrabold text-white tracking-tight">{detail.title}</h3>
                    </div>

                    <Link
                      to={`/runs/${detail.run_id}`}
                      className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-2 transition-all self-start sm:self-auto border border-zinc-700/60"
                    >
                      <span>Inspect Flight Trace</span>
                      <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                    </Link>
                  </div>

                  {/* What / Why / Fix breakdown */}
                  <div className="space-y-4 text-xs leading-relaxed">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block mb-1">
                        What Happened
                      </span>
                      <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 text-zinc-200 text-sm leading-relaxed">
                        {detail.what_happened}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider block mb-1">
                        Root Cause Finding
                      </span>
                      <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/30 text-rose-100 text-sm leading-relaxed">
                        {detail.why}
                      </div>
                    </div>

                    {detail.how_to_fix && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider block mb-1">
                          Recommended Recovery Fix
                        </span>
                        <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-100 text-sm leading-relaxed space-y-1.5">
                          {Array.isArray(detail.how_to_fix) ? (
                            detail.how_to_fix.map((f: string, i: number) => (
                              <div key={i} className="flex items-start gap-2">
                                <span className="text-emerald-400 font-bold">•</span>
                                <span>{f}</span>
                              </div>
                            ))
                          ) : (
                            <div>{detail.how_to_fix}</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Money-Moving Approval Gate (Crucial Guardian USP) */}
                  {detail.needs_approval && (
                    <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-950/50 via-zinc-900 to-amber-950/30 border border-amber-500/50 shadow-2xl space-y-4">
                      <div className="flex items-center gap-2.5 text-amber-300 text-xs font-bold uppercase tracking-wider">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                          <DollarSign className="w-4 h-4" />
                        </div>
                        <span>Financial Oversight Protection: Agent Execution Suspended</span>
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        {detail.actions_taken ||
                          'This agent attempted real money-moving actions. Black Box has paused further execution to protect capital until human approval.'}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 pt-2">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() =>
                            decisionMutation.mutate({ id: detail.incident_id, approve: true })
                          }
                          disabled={decisionMutation.isPending}
                          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Authorize & Resume Agent</span>
                        </motion.button>

                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() =>
                            decisionMutation.mutate({ id: detail.incident_id, approve: false })
                          }
                          disabled={decisionMutation.isPending}
                          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-rose-950/50 cursor-pointer disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Keep Paused (Reject Action)</span>
                        </motion.button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Notification Dispatch Channels */}
                {detail.notifications && (
                  <div className="glass-card p-6 rounded-2xl border border-zinc-800 shadow-xl space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-200 block pb-2 border-b border-zinc-800">
                      Dispatched Multi-Channel Alerts
                    </span>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      {detail.notifications.map((notif: any, idx: number) => {
                        const isSent = notif.status === 'sent';
                        return (
                          <div
                            key={idx}
                            className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2.5 text-zinc-200">
                              {notif.channel?.includes('email') ? (
                                <Mail className="w-4 h-4 text-blue-400" />
                              ) : notif.channel?.includes('whatsapp') ? (
                                <MessageSquare className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Send className="w-4 h-4 text-zinc-400" />
                              )}
                              <span className="capitalize font-medium">{notif.channel}</span>
                            </div>

                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
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
                  <div className="glass-card p-6 rounded-2xl border border-zinc-800 shadow-xl space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-200 block pb-2 border-b border-zinc-800">
                      Chronological Incident Progression
                    </span>

                    <div className="space-y-2">
                      {detail.evidence.timeline.map((step: any, idx: number) => {
                        const isCause = step.flag?.includes('cause') || step.idx === detail.evidence.cause_step;
                        return (
                          <div
                            key={idx}
                            className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                              isCause
                                ? 'bg-rose-950/40 border-rose-500/50 text-rose-200 font-bold'
                                : 'bg-zinc-950/80 border-zinc-800/80 text-zinc-300'
                            }`}
                          >
                            <div className="flex items-center gap-3 truncate">
                              <span className="font-mono text-zinc-500 font-bold">#{step.idx}</span>
                              <span className="truncate">{step.label}</span>
                            </div>

                            {step.flag && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-rose-600 text-white uppercase shrink-0 font-bold">
                                {step.flag}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};


