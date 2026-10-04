import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { MonoLabel } from '../components/common/MonoLabel';
import { StepChip } from '../components/common/StepChip';
import { KPI } from '../components/common/KPI';
import { EmptyState } from '../components/common/EmptyState';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Send,
  ArrowRight,
  ExternalLink,
  RotateCw,
  Mail,
  MessageSquare,
  FileText,
} from 'lucide-react';

export const IncidentsScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  // 1. Fetch incidents list
  const { data: listData, isLoading, error } = useQuery<{ incidents: any[] } | any>({
    queryKey: ['incidents-list'],
    queryFn: async () => {
      const resp = await api.get<any>('/api/incidents');
      return Array.isArray(resp) ? { incidents: resp } : resp;
    },
  });

  const incidents: any[] = listData?.incidents || [];
  const activeIncidentId = selectedIncidentId || incidents[0]?.incident_id;

  // 2. Fetch active incident detail
  const { data: incidentDetail, isLoading: isDetailLoading } = useQuery<any>({
    queryKey: ['incident-detail', activeIncidentId],
    queryFn: async () => {
      if (!activeIncidentId) return null;
      return await api.get<any>(`/api/incidents/${activeIncidentId}`);
    },
    enabled: !!activeIncidentId,
  });

  // 3. Make Decision mutation (Approve / Keep paused)
  const decisionMutation = useMutation({
    mutationFn: async ({ approve, note }: { approve: boolean; note?: string }) => {
      if (!activeIncidentId) return;
      return await api.post<any>(`/api/incidents/${activeIncidentId}/decision`, {
        approve,
        by: 'Operator',
        note: note || (approve ? 'Approved by Operator' : 'Maintained pause by Operator'),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents-list'] });
      queryClient.invalidateQueries({ queryKey: ['incident-detail', activeIncidentId] });
    },
  });

  const current = incidentDetail || incidents.find((i) => i.incident_id === activeIncidentId);

  return (
    <div className="space-y-8 pb-24">
      {/* Top Header */}
      <div className="border-b border-[var(--line)] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <MonoLabel index="08" label="GUARDIAN AUTONOMOUS OUTBOX & SAFETY" />
            <span className="font-mono text-[10px] uppercase text-[var(--accent)] bg-[var(--raised)] px-2 py-0.5 rounded border border-[var(--line)]">
              HUMAN IN THE LOOP
            </span>
          </div>
          <h1 className="text-2xl font-bold font-sans text-[var(--text-strong)] tracking-tight">
            Incidents & Alert Dispatch
          </h1>
          <p className="text-xs font-sans text-[var(--muted)] mt-1 max-w-2xl leading-relaxed">
            Guardian automatically pauses failing agents and renders diagnostic postmortems across multi-channel alerting (Email, WhatsApp, Slack).
          </p>
        </div>

        {incidents.length > 0 && (
          <div className="flex items-center gap-2 font-mono text-xs text-[var(--faint)]">
            <span className="text-[var(--text-strong)] font-bold">{incidents.length}</span> ACTIVE INCIDENTS
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="panel p-12 text-center text-xs font-mono text-[var(--faint)]">
          Loading guardian incidents from backend...
        </div>
      ) : incidents.length === 0 ? (
        <EmptyState
          title="All Systems Nominal"
          description="Guardian has not detected any unmitigated regressions or safety invariant violations across live agent executions."
          endpoint="GET /api/incidents"
          command="blackbox guardian status"
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Dense Table of Incidents (4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <MonoLabel index="LIST" label="INCIDENT QUEUE" />

            <div className="panel overflow-hidden">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-[var(--raised)] border-b border-[var(--line)] text-[10px] font-mono text-[var(--faint)] uppercase tracking-wider">
                  <tr>
                    <th className="py-2 px-3">Sev</th>
                    <th className="py-2 px-3">Title</th>
                    <th className="py-2 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {incidents.map((inc) => {
                    const isSelected = inc.incident_id === activeIncidentId;
                    const isCritical = inc.severity === 'critical' || inc.severity === 'high';
                    return (
                      <tr
                        key={inc.incident_id}
                        onClick={() => setSelectedIncidentId(inc.incident_id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-[var(--raised)]' : 'hover:bg-[var(--raised)]/40'
                        }`}
                      >
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-block w-2 h-2 rounded-full ${
                              isCritical ? 'bg-[var(--guilty)]' : 'bg-[var(--trail)]'
                            }`}
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-[var(--text-strong)] truncate max-w-[170px]">
                            {inc.title}
                          </div>
                          <div className="font-mono text-[10px] text-[var(--faint)]">
                            #{inc.incident_id.slice(0, 8)}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[10px] uppercase">
                          <span
                            className={`px-1.5 py-0.5 rounded ${
                              inc.status === 'approved'
                                ? 'bg-[var(--ok-bg)] text-[var(--ok)]'
                                : inc.status === 'rejected'
                                ? 'bg-[var(--guilty-bg)] text-[var(--guilty)]'
                                : 'bg-[var(--trail-bg)] text-[var(--trail)]'
                            }`}
                          >
                            {inc.status || 'pending'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: Detail View matching Guardian Email (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {current ? (
              <div className="panel p-6 space-y-6">
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-[var(--line)]">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-mono text-xs font-bold text-[var(--guilty)] uppercase tracking-wider">
                        {current.severity?.toUpperCase() || 'HIGH'} SEVERITY
                      </span>
                      <span className="text-[var(--ghost)]">·</span>
                      <span className="font-mono text-xs text-[var(--faint)]">
                        INCIDENT #{current.incident_id}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold font-sans text-[var(--text-strong)] tracking-tight">
                      {current.title}
                    </h2>
                    {current.created_at && (
                      <div className="text-[11px] font-mono text-[var(--faint)] mt-1">
                        Reported at: {current.created_at}
                      </div>
                    )}
                  </div>

                  {/* Actions: Approve / Keep Paused */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => decisionMutation.mutate({ approve: true })}
                      disabled={decisionMutation.isPending}
                      className="px-3.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--ok)] text-[var(--bg)] font-sans font-semibold text-xs hover:brightness-110 active:brightness-95 disabled:opacity-50 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>
                    <button
                      onClick={() => decisionMutation.mutate({ approve: false })}
                      disabled={decisionMutation.isPending}
                      className="px-3.5 py-1.5 rounded-[var(--radius-sm)] border border-[var(--guilty)]/40 bg-[var(--guilty-bg)] text-[var(--guilty)] font-sans font-semibold text-xs hover:brightness-110 active:brightness-95 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      <span>Keep Paused</span>
                    </button>
                  </div>
                </div>

                {/* Section 1: What Happened */}
                <div className="space-y-1.5">
                  <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--faint)]">
                    WHAT HAPPENED
                  </div>
                  <div className="text-xs font-sans text-[var(--text)] leading-relaxed p-3 bg-[var(--bg)] rounded-[var(--radius-sm)] border border-[var(--line)]">
                    {current.what_happened || '—'}
                  </div>
                </div>

                {/* Section 2: Why */}
                <div className="space-y-1.5">
                  <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--faint)]">
                    WHY IT HAPPENED
                  </div>
                  <div className="text-xs font-sans text-[var(--text)] leading-relaxed p-3 bg-[var(--bg)] rounded-[var(--radius-sm)] border border-[var(--line)]">
                    {current.why || '—'}
                  </div>
                </div>

                {/* Section 3: How to Fix */}
                {current.how_to_fix && current.how_to_fix.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--faint)]">
                      HOW TO FIX
                    </div>
                    <ul className="space-y-1 p-3 bg-[var(--bg)] rounded-[var(--radius-sm)] border border-[var(--line)] text-xs font-sans text-[var(--muted)]">
                      {current.how_to_fix.map((fix: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-[var(--accent)] font-bold">›</span>
                          <span>{fix}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Section 4: Flight Data Timeline */}
                {current.evidence?.timeline && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--faint)]">
                        FLIGHT DATA RECORDER SNAPSHOT
                      </div>
                      {current.run_id && (
                        <Link
                          to={`/runs/${current.run_id}`}
                          className="font-mono text-[10px] text-[var(--accent)] hover:underline flex items-center gap-1"
                        >
                          <span>Open full trace {current.run_id.slice(0, 8)}</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                    </div>

                    <div
                      data-lenis-prevent
                      className="max-h-44 overflow-y-auto p-3 bg-[var(--bg)] rounded-[var(--radius-sm)] border border-[var(--line)] space-y-1 font-mono text-[11px]"
                    >
                      {current.evidence.timeline.map((step: any, idx: number) => {
                        const isCause = step.flag?.includes('cause') || step.idx === current.evidence?.cause_step;
                        return (
                          <div
                            key={idx}
                            className={`flex items-start gap-2 py-0.5 px-1 rounded ${
                              isCause ? 'bg-[var(--guilty-bg)] text-[var(--guilty)] font-semibold' : 'text-[var(--muted)]'
                            }`}
                          >
                            <span className="shrink-0 w-8 text-right text-[var(--faint)]">#{step.idx}</span>
                            <span className="flex-1 truncate">{step.label}</span>
                            {isCause && (
                              <span className="shrink-0 text-[10px] uppercase font-bold text-[var(--guilty)]">
                                ⚠ ROOT CAUSE
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Section 5: Dispatch Notifications per channel */}
                <div className="space-y-1.5 pt-2 border-t border-[var(--line)]">
                  <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--faint)]">
                    DISPATCH NOTIFICATIONS PER CHANNEL
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                    {(current.notifications || [
                      { channel: 'outbox', status: 'sent', detail: 'Local outbox artifact recorded' },
                      { channel: 'email-smtp', status: 'sent', detail: 'guardian@blackbox.flight' },
                      { channel: 'whatsapp-twilio', status: 'skipped', detail: 'Webhook configured' },
                    ]).map((notif: any, idx: number) => {
                      const isSent = notif.status === 'sent';
                      return (
                        <div
                          key={idx}
                          className="p-2.5 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--line)] flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            {notif.channel.includes('email') ? (
                              <Mail className="w-3.5 h-3.5 text-[var(--faint)]" />
                            ) : notif.channel.includes('whatsapp') ? (
                              <MessageSquare className="w-3.5 h-3.5 text-[var(--faint)]" />
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-[var(--faint)]" />
                            )}
                            <span className="text-[var(--text-strong)]">{notif.channel}</span>
                          </div>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                              isSent
                                ? 'bg-[var(--ok-bg)] text-[var(--ok)] border border-[var(--ok)]/30'
                                : 'bg-[var(--raised)] text-[var(--faint)]'
                            }`}
                          >
                            {isSent ? 'SENT ✓' : 'SKIPPED'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="panel p-12 text-center text-xs font-mono text-[var(--faint)]">
                Select an incident from the queue to view forensic details.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
