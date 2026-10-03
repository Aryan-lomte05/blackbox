import React, { useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';
import { VerdictBadge } from '../components/common/VerdictBadge';
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
  Info,
  Layers,
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
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              DEMO 5 • CAUSAL VERIFICATION
            </span>
            <span className="text-xs text-zinc-400">Judea Pearl Interventions & Blast Radius</span>
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <Split className="w-5 h-5" />
            </div>
            Causal Proof Engine
          </h2>
          <p className="text-sm text-zinc-400 mt-1.5 max-w-2xl leading-relaxed">
            Mathematically prove root causes by counterfactual intervention: test if each suspect was <strong>necessary</strong> (fixing it fixes the run) and <strong>sufficient</strong> (injecting it alone breaks a passing run), then trace the downstream blast radius.
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleStartCausal}
          disabled={isRunning}
          className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-zinc-800 disabled:to-zinc-800 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-950/60 transition-all flex items-center gap-2.5 cursor-pointer disabled:cursor-not-allowed border border-indigo-500/30"
        >
          {isRunning ? (
            <>
              <RotateCw className="w-4 h-4 animate-spin text-white" />
              <span>Verifying Interventions ({streamEvents.length})...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" />
              <span>Run Pearl Causality Verification</span>
            </>
          )}
        </motion.button>
      </div>

      {/* Target Run Input */}
      <div className="glass-card flex items-center justify-between gap-4 p-4 rounded-xl border border-zinc-800/80">
        <div className="flex items-center gap-3 text-xs">
          <span className="text-zinc-400 font-medium">Target Failure Run:</span>
          <input
            type="text"
            value={targetRunId}
            onChange={(e) => setTargetRunId(e.target.value)}
            disabled={isRunning}
            className="bg-zinc-950/80 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-200 w-64 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <Link
          to={`/runs/${targetRunId}`}
          className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 text-xs font-medium transition-colors"
        >
          <span>Open Full Run Graph</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Error state */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Empty state */}
      {!reportData && !isRunning && !errorMsg && (
        <div className="p-16 rounded-2xl glass-card border border-zinc-800/80 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
            <Split className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-zinc-200">No Causal Analysis Generated Yet</h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
            Click <strong>Run Pearl Causality Verification</strong> to compute counterfactual proof for each suspect, measure downstream blast radius, and discover automated recovery paths.
          </p>
        </div>
      )}

      {/* Running event stream log */}
      {isRunning && (
        <div className="p-6 rounded-2xl glass-card border border-zinc-800 space-y-3 font-mono text-xs">
          <div className="flex items-center gap-2 text-indigo-400 font-bold">
            <RotateCw className="w-4 h-4 animate-spin" />
            <span>Streaming Interventions ({streamEvents.length} events received)...</span>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2 text-zinc-300 text-[11px]">
            {streamEvents.map((ev, i) => (
              <div key={i} className="p-2 rounded bg-zinc-950/80 border border-zinc-800/60 flex items-center justify-between">
                <div>
                  <span className="font-bold text-indigo-400 mr-2">[{ev.type.toUpperCase()}]</span>
                  <span>Step #{ev.step}: {ev.strategy || ev.verdict || (ev.sufficient !== undefined ? `sufficient=${ev.sufficient}` : '')}</span>
                </div>
                {ev.t && <span className="text-zinc-500">+{ev.t}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Causal Report Results */}
      <AnimatePresence>
        {reportData && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Executive Pearl Summary Banner */}
            {reportData.summary && (
              <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-950/50 via-zinc-900 to-purple-950/40 border border-indigo-500/40 shadow-xl space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">
                    PEARL FORMAL CAUSALITY VERDICT
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                    do-calculus verified
                  </span>
                </div>
                <div className="text-sm font-medium text-white leading-relaxed">
                  {reportData.summary}
                </div>
              </div>
            )}

            {/* Blast Radius Visualizer Bar */}
            {reportData.blast_radius && (
              <div className="glass-card p-6 rounded-2xl border border-zinc-800/80 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                  <div className="flex items-center gap-2 text-xs font-bold text-zinc-200 uppercase tracking-wider">
                    <ShieldAlert className="w-4 h-4 text-rose-500" />
                    <span>Downstream Blast Radius & Contamination</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase font-mono ${
                      reportData.blast_radius.severity === 'high'
                        ? 'bg-rose-950 text-rose-300 border border-rose-500/40 shadow-sm shadow-rose-950'
                        : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    Severity: {reportData.blast_radius.severity}
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex justify-between text-zinc-400 font-mono text-[11px]">
                    <span>Contaminated Steps:</span>
                    <span className="text-zinc-200 font-semibold">
                      {reportData.blast_radius.contaminated?.length || 0} of{' '}
                      {reportData.blast_radius.of_later_steps || reportData.blast_radius.contaminated?.length || 0}{' '}
                      subsequent steps
                    </span>
                  </div>

                  {/* Progress Visual Bar */}
                  <div className="w-full bg-zinc-950 rounded-full h-3 overflow-hidden border border-zinc-800 flex">
                    {reportData.blast_radius.contaminated?.map((st: number, i: number) => {
                      const isMoney = reportData.blast_radius.money_moving_steps?.includes(st);
                      return (
                        <div
                          key={i}
                          className={`h-full flex-1 border-r border-zinc-900 transition-all ${
                            isMoney ? 'bg-rose-600 animate-pulse' : 'bg-amber-500'
                          }`}
                          title={`Step #${st} ${isMoney ? '(MOVES MONEY!)' : '(contaminated state)'}`}
                        />
                      );
                    })}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-zinc-400 pt-1">
                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                      <span>Contaminated Steps: [{reportData.blast_radius.contaminated?.join(', ')}]</span>
                    </div>

                    {reportData.blast_radius.money_moving_steps?.length > 0 ? (
                      <div className="flex items-center gap-1.5 text-rose-400 font-bold bg-rose-950/60 px-2.5 py-1 rounded-lg border border-rose-500/40">
                        <DollarSign className="w-4 h-4 text-rose-400" />
                        <span>{reportData.blast_radius.money_moving_steps.length} Real-World Financial Steps in Blast Radius!</span>
                      </div>
                    ) : (
                      <span className="text-zinc-500 text-[11px]">No financial steps impacted</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Necessary vs Sufficient Table */}
            <div className="glass-card p-6 rounded-2xl border border-zinc-800/80 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                  Counterfactual Proof: Necessary vs. Sufficient Matrix
                </h3>
                <span className="text-[11px] font-mono text-zinc-500">Dual-Intervention Test</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="text-zinc-500 border-b border-zinc-800/80 text-[11px]">
                      <th className="pb-3 pl-2">SUSPECT</th>
                      <th className="pb-3">KIND</th>
                      <th className="pb-3">NECESSARY?</th>
                      <th className="pb-3">SUFFICIENT?</th>
                      <th className="pb-3">CAUSAL EFFECT</th>
                      <th className="pb-3">FORMAL VERDICT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40">
                    {reportData.steps?.map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-zinc-800/20 transition-colors">
                        <td className="py-3 pl-2 font-bold text-zinc-200">
                          Step #{row.step}
                          {row.step === reportData.cause && (
                            <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              PROVEN CAUSE
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-zinc-400">{row.kind || 'tool'}</td>
                        <td className="py-3">
                          {row.necessary ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 font-bold">
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span>YES</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900 text-zinc-500 border border-zinc-800">
                              <X className="w-3.5 h-3.5 text-zinc-500" />
                              <span>NO</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3">
                          {row.sufficient === true ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-500/30 font-bold">
                              <Check className="w-3.5 h-3.5 text-rose-400" />
                              <span>YES</span>
                            </span>
                          ) : row.sufficient === false ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900 text-zinc-500 border border-zinc-800">
                              <X className="w-3.5 h-3.5 text-zinc-500" />
                              <span>NO</span>
                            </span>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                        <td className="py-3 text-zinc-200 font-bold">
                          {row.causal_effect !== undefined ? `${(row.causal_effect * 100).toFixed(0)}%` : '—'}
                        </td>
                        <td className="py-3 text-zinc-300 font-sans">
                          <span className="font-semibold text-zinc-100">{row.verdict}</span>
                          {row.sufficiency?.note && (
                            <div className="text-[11px] text-zinc-400 mt-0.5">{row.sufficiency.note}</div>
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
              <div className="glass-card p-6 rounded-2xl border border-zinc-800/80 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    <span>Counterfactual Recovery Paths ({reportData.recovery_paths.length})</span>
                  </h3>
                  <span className="text-[11px] font-mono text-zinc-500">Fork & Replay Safe Points</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {reportData.recovery_paths.map((p: any, idx: number) => (
                    <motion.div
                      key={idx}
                      whileHover={{ y: -2 }}
                      className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-2.5 transition-all hover:border-emerald-500/40"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-emerald-400">Path #{idx + 1}: {p.how}</span>
                        <span className="text-[11px] font-mono text-zinc-400">At Step #{p.step}</span>
                      </div>
                      {p.change?.note && (
                        <div className="text-zinc-300 text-xs bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-800 leading-relaxed font-sans">
                          {p.change.note}
                        </div>
                      )}
                      <div className="pt-2 border-t border-zinc-800/60 flex justify-between items-center text-xs">
                        <span className="text-zinc-500 font-mono text-[11px]">Fork: {p.run?.slice(0, 12)}</span>
                        <Link
                          to={`/runs/${p.run}`}
                          className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium transition-colors"
                        >
                          <span>Inspect Fork Trace</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

