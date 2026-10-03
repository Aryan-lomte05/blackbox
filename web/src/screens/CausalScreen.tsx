import React, { useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { VerdictBadge } from '../components/common/VerdictBadge';
import { KPI } from '../components/common/KPI';
import {
  Split,
  Play,
  RotateCw,
  AlertTriangle,
  Check,
  X,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  ExternalLink,
  DollarSign,
} from 'lucide-react';

export const CausalScreen: React.FC = () => {
  const [searchParams] = useSearchParams();
  const runIdFromUrl = searchParams.get('run_id') || '37452fc329e1498f';

  const [targetRunId, setTargetRunId] = useState(runIdFromUrl);
  const [isRunning, setIsRunning] = useState(false);
  const [reportData, setReportData] = useState<any | null>(null);
  const [streamEvents, setStreamEvents] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  const handleStartCausal = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setErrorMsg(null);
    setStreamEvents([]);
    setReportData(null);

    try {
      const resp = await api.post<{ job_id: string; events: string; result: string }>(
        `/api/runs/${targetRunId}/causal`
      );

      const es = api.createEventSource(resp.events);
      eventSourceRef.current = es;

      es.addEventListener('attempt', (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          setStreamEvents((prev) => [...prev, { type: 'attempt', ...parsed }]);
        } catch (err) {
          console.error(err);
        }
      });

      es.addEventListener('result', (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          setStreamEvents((prev) => [...prev, { type: 'result', ...parsed }]);
        } catch (err) {
          console.error(err);
        }
      });

      es.addEventListener('verdict', (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          setStreamEvents((prev) => [...prev, { type: 'verdict', ...parsed }]);
        } catch (err) {
          console.error(err);
        }
      });

      es.addEventListener('sufficiency', (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          setStreamEvents((prev) => [...prev, { type: 'sufficiency', ...parsed }]);
        } catch (err) {
          console.error(err);
        }
      });

      es.addEventListener('done', (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed.result) {
            setReportData(parsed.result);
          } else if (parsed.summary) {
            setReportData(parsed);
          }
        } catch (err) {
          console.error(err);
        }
        setIsRunning(false);
        es.close();
      });

      es.addEventListener('error', (e: any) => {
        console.error('SSE Error:', e);
        setIsRunning(false);
        es.close();
      });
    } catch (err: any) {
      setIsRunning(false);
      setErrorMsg(err.detail || err.message || 'Failed to start causal analysis job');
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
              DEMO SCREEN 5
            </span>
            <span className="text-xs font-mono text-zinc-400">Pearl Causality & Blast Radius</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight mt-1 flex items-center gap-2.5">
            <Split className="w-6 h-6 text-indigo-400" />
            Causal Report
          </h2>
          <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
            Formal counterfactual verification: test if each suspect was <strong>necessary</strong> (fixing it fixes the run)
            and <strong>sufficient</strong> (injecting it alone breaks a passing run), calculate blast radius, and discover recovery paths.
          </p>
        </div>

        <button
          onClick={handleStartCausal}
          disabled={isRunning}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 text-white font-medium text-xs rounded-lg shadow-lg shadow-indigo-950/50 transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
        >
          {isRunning ? (
            <>
              <RotateCw className="w-4 h-4 animate-spin text-white" />
              <span>Verifying Pearl Causality...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" />
              <span>Run Causal Analysis</span>
            </>
          )}
        </button>
      </div>

      {/* Target Run Input */}
      <div className="flex items-center gap-3 text-xs bg-zinc-900/60 p-3.5 rounded-xl border border-zinc-800/80 font-mono">
        <span className="text-zinc-400 uppercase text-[10px]">Target Run ID:</span>
        <input
          type="text"
          value={targetRunId}
          onChange={(e) => setTargetRunId(e.target.value)}
          disabled={isRunning}
          className="bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-zinc-200 w-72 focus:outline-none focus:border-indigo-500"
        />
        <Link
          to={`/runs/${targetRunId}`}
          className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-[11px]"
        >
          View Graph <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {/* Error state */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs font-mono flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Empty state */}
      {!reportData && !isRunning && !errorMsg && (
        <div className="p-16 rounded-xl bg-zinc-900/20 border border-zinc-800/80 text-center space-y-3 font-mono">
          <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
            <Split className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-zinc-200">No Causal Analysis Generated Yet</h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            Click <strong>Run Causal Analysis</strong> to compute necessary and sufficient conditions for each suspect,
            along with downstream damage radius.
          </p>
        </div>
      )}

      {/* Running event stream log */}
      {isRunning && (
        <div className="p-6 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3 font-mono text-xs">
          <div className="flex items-center gap-2 text-indigo-400 font-bold">
            <RotateCw className="w-4 h-4 animate-spin" />
            <span>Streaming Causal Interventions ({streamEvents.length} events received)...</span>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2 text-zinc-300 text-[11px]">
            {streamEvents.map((ev, i) => (
              <div key={i} className="p-2 rounded bg-zinc-950 border border-zinc-800/60 flex items-center justify-between">
                <div>
                  <span className="font-bold text-zinc-400 mr-2">[{ev.type.toUpperCase()}]</span>
                  <span>Step #{ev.step}: {ev.strategy || ev.verdict || (ev.sufficient !== undefined ? `sufficient=${ev.sufficient}` : '')}</span>
                </div>
                {ev.t && <span className="text-zinc-500">+{ev.t}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Causal Report Results */}
      {reportData && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Executive Pearl Summary Banner */}
          {reportData.summary && (
            <div className="p-5 rounded-xl bg-indigo-950/30 border border-indigo-500/40 text-indigo-100 text-xs font-mono leading-relaxed space-y-1">
              <span className="text-[10px] uppercase font-bold text-indigo-400 block tracking-wider">
                Pearl Causal Summary & Verdict
              </span>
              <div>{reportData.summary}</div>
            </div>
          )}

          {/* Blast Radius Visualizer Bar */}
          {reportData.blast_radius && (
            <div className="p-6 rounded-xl bg-zinc-900/60 border border-zinc-800/80 shadow-xl space-y-4 font-mono">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-200 uppercase tracking-wider">
                  <ShieldAlert className="w-4 h-4 text-rose-500" />
                  Blast Radius & Downstream Contamination
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                    reportData.blast_radius.severity === 'high'
                      ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                      : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                  }`}
                >
                  Severity: {reportData.blast_radius.severity}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>Contaminated Steps:</span>
                  <span className="text-zinc-200">
                    {reportData.blast_radius.contaminated?.length || 0} of{' '}
                    {reportData.blast_radius.of_later_steps || reportData.blast_radius.contaminated?.length || 0}{' '}
                    later steps
                  </span>
                </div>

                {/* Progress Visual Bar */}
                <div className="w-full bg-zinc-950 rounded-full h-3 overflow-hidden border border-zinc-800 flex">
                  {reportData.blast_radius.contaminated?.map((st: number, i: number) => {
                    const isMoney = reportData.blast_radius.money_moving_steps?.includes(st);
                    return (
                      <div
                        key={i}
                        className={`h-full flex-1 border-r border-zinc-900 ${
                          isMoney ? 'bg-rose-600' : 'bg-amber-500'
                        }`}
                        title={`Step #${st} ${isMoney ? '(MOVES MONEY!)' : '(contaminated)'}`}
                      />
                    );
                  })}
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    <span>Contaminated Steps: [{reportData.blast_radius.contaminated?.join(', ')}]</span>
                  </div>

                  {reportData.blast_radius.money_moving_steps?.length > 0 ? (
                    <div className="flex items-center gap-1.5 text-rose-400 font-bold bg-rose-950/60 px-2 py-0.5 rounded border border-rose-500/40">
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>{reportData.blast_radius.money_moving_steps.length} Money-moving Steps in blast radius!</span>
                    </div>
                  ) : (
                    <span className="text-zinc-500">No money-moving steps impacted</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Necessary vs Sufficient Table */}
          <div className="p-6 rounded-xl bg-zinc-900/60 border border-zinc-800/80 shadow-xl space-y-4">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-200 pb-3 border-b border-zinc-800">
              Counterfactual Proof: Necessary vs. Sufficient Matrix
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="text-zinc-500 border-b border-zinc-800">
                    <th className="pb-3">SUSPECT</th>
                    <th className="pb-3">KIND</th>
                    <th className="pb-3">NECESSARY?</th>
                    <th className="pb-3">SUFFICIENT?</th>
                    <th className="pb-3">CAUSAL EFFECT</th>
                    <th className="pb-3">FORMAL VERDICT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {reportData.steps?.map((row: any, idx: number) => (
                    <tr key={idx} className="hover:bg-zinc-800/30">
                      <td className="py-3 font-bold text-zinc-200">
                        Step #{row.step}
                        {row.step === reportData.cause && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            CAUSE
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-zinc-400">{row.kind || 'tool'}</td>
                      <td className="py-3">
                        {row.necessary ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                            <Check className="w-4 h-4 text-emerald-400" />
                            <span>YES</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-zinc-500 font-medium">
                            <X className="w-4 h-4 text-zinc-500" />
                            <span>NO</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3">
                        {row.sufficient === true ? (
                          <span className="inline-flex items-center gap-1 text-rose-400 font-bold">
                            <Check className="w-4 h-4 text-rose-400" />
                            <span>YES</span>
                          </span>
                        ) : row.sufficient === false ? (
                          <span className="inline-flex items-center gap-1 text-zinc-500 font-medium">
                            <X className="w-4 h-4 text-zinc-500" />
                            <span>NO</span>
                          </span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="py-3 text-zinc-300">
                        {row.causal_effect !== undefined ? `${(row.causal_effect * 100).toFixed(0)}%` : '—'}
                      </td>
                      <td className="py-3 text-zinc-300">
                        <span className="font-semibold">{row.verdict}</span>
                        {row.sufficiency?.note && (
                          <div className="text-[10px] text-zinc-500 mt-0.5">{row.sufficiency.note}</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recovery Paths Discovered */}
          {reportData.recovery_paths && reportData.recovery_paths.length > 0 && (
            <div className="p-6 rounded-xl bg-zinc-900/60 border border-zinc-800/80 shadow-xl space-y-4">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 pb-3 border-b border-zinc-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Verified Recovery Paths ({reportData.recovery_paths.length})
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reportData.recovery_paths.map((p: any, idx: number) => (
                  <div key={idx} className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-400">Path #{idx + 1}: Strategy "{p.how}"</span>
                      <span className="text-[10px] text-zinc-400">At Step #{p.step}</span>
                    </div>
                    {p.change?.note && (
                      <div className="text-zinc-300 text-[11px] bg-zinc-900 p-2 rounded border border-zinc-800">
                        {p.change.note}
                      </div>
                    )}
                    <div className="pt-1 flex justify-between items-center text-[10px] text-zinc-500">
                      <span>Forked Run: {p.run?.slice(0, 12)}</span>
                      <Link
                        to={`/runs/${p.run}`}
                        className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                      >
                        Inspect Fork <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
