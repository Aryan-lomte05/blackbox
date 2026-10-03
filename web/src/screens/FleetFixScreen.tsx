import React, { useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';
import { VerdictBadge } from '../components/common/VerdictBadge';
import {
  ShieldCheck,
  ShieldAlert,
  Play,
  RotateCw,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  Terminal,
  ExternalLink,
  Sparkles,
  Sliders,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from 'lucide-react';

interface FleetRunRow {
  n?: number;
  of?: number;
  run_id: string;
  family?: string;
  before?: boolean | string;
  after?: boolean | string;
  verdict: 'fixed' | 'still failing' | 'regression' | 'held' | string;
  new_run?: string;
  answer?: string;
  savings?: {
    steps_reused: number;
    steps_total: number;
  };
}

export const FleetFixScreen: React.FC = () => {
  const [searchParams] = useSearchParams();
  const runIdFromUrl = searchParams.get('run_id') || '37452fc329e1498f';

  const [targetRunId, setTargetRunId] = useState(runIdFromUrl);
  const [ruleInput, setRuleInput] = useState('');
  const [nFail, setNFail] = useState(3);
  const [nPass, setNPass] = useState(2);

  const [isRunning, setIsRunning] = useState(false);
  const [activeRule, setActiveRule] = useState<string | null>(null);
  const [rows, setRows] = useState<FleetRunRow[]>([]);
  const [verdict, setVerdict] = useState<'APPROVE' | 'BLOCK' | 'NO EFFECT' | null>(null);
  const [whyText, setWhyText] = useState<string | null>(null);
  const [stats, setStats] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  const applyPreset = (failCount: number, passCount: number) => {
    if (isRunning) return;
    setNFail(failCount);
    setNPass(passCount);
  };

  const handleStartFleetFix = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setErrorMsg(null);
    setRows([]);
    setVerdict(null);
    setWhyText(null);
    setStats(null);

    try {
      const resp = await api.post<{ job_id: string; events: string; result: string }>(
        `/api/runs/${targetRunId}/fleet-fix`,
        {
          rule: ruleInput.trim() || undefined,
          n_fail: nFail,
          n_pass: nPass,
        }
      );

      const es = api.createEventSource(resp.events);
      eventSourceRef.current = es;

      es.addEventListener('rule', (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed.rule) setActiveRule(parsed.rule);
        } catch (err) {
          console.error(err);
        }
      });

      es.addEventListener('run', (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          setRows((prev) => {
            const existingIdx = prev.findIndex((r) => r.run_id === parsed.run_id);
            if (existingIdx >= 0) {
              const updated = [...prev];
              updated[existingIdx] = { ...updated[existingIdx], ...parsed };
              return updated;
            }
            return [...prev, parsed];
          });
        } catch (err) {
          console.error(err);
        }
      });

      es.addEventListener('done', (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed.decision) setVerdict(parsed.decision);
          if (parsed.why) setWhyText(parsed.why);
          if (parsed.result) {
            setStats(parsed.result);
            if (parsed.result.decision) setVerdict(parsed.result.decision);
            if (parsed.result.why) setWhyText(parsed.result.why);
            if (parsed.result.rows && parsed.result.rows.length > 0) {
              setRows(parsed.result.rows);
            }
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
      setErrorMsg(err.detail || err.message || 'Failed to start fleet fix job');
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              DEMO 4 • ONE FIX FOR MANY
            </span>
            <span className="text-xs text-zinc-400">Regression Firewall & Fleet Protection</span>
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
              <ShieldCheck className="w-5 h-5" />
            </div>
            Regression Firewall
          </h2>
          <p className="text-sm text-zinc-400 mt-1.5 max-w-2xl leading-relaxed">
            Test a candidate fix or rule against past failures <em>and</em> passing runs.
            The firewall strictly holds deployment unless it proves zero regressions across existing fleet baselines.
          </p>
        </div>

        {/* Trigger Button */}
        <div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleStartFleetFix}
            disabled={isRunning}
            className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-zinc-800 disabled:to-zinc-800 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-950/60 transition-all flex items-center gap-2.5 cursor-pointer disabled:cursor-not-allowed border border-emerald-500/30"
          >
            {isRunning ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin text-white" />
                <span>Simulating Fleet Replay ({rows.length} tested)...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Launch Firewall Evaluation</span>
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* Inputs Configuration Card */}
      <div className="glass-card p-6 rounded-2xl border border-zinc-800/80 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300 uppercase tracking-wider">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span>Evaluation Parameters & Guardrails</span>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-500">Presets:</span>
            <button
              onClick={() => applyPreset(3, 2)}
              disabled={isRunning}
              className={`px-2.5 py-1 rounded-md text-[11px] font-mono border transition-all cursor-pointer ${
                nFail === 3 && nPass === 2
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              Standard (3 Fail / 2 Pass)
            </button>
            <button
              onClick={() => applyPreset(5, 5)}
              disabled={isRunning}
              className={`px-2.5 py-1 rounded-md text-[11px] font-mono border transition-all cursor-pointer ${
                nFail === 5 && nPass === 5
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              Strict Fleet Guard (5 / 5)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-zinc-400 text-xs font-medium block">Target Failure Run</label>
            <input
              type="text"
              value={targetRunId}
              onChange={(e) => setTargetRunId(e.target.value)}
              disabled={isRunning}
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <label className="text-zinc-400 font-medium">Historical Failures (n_fail)</label>
              <span className="font-mono text-emerald-400 font-bold">{nFail} runs</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={nFail}
              onChange={(e) => setNFail(parseInt(e.target.value, 10))}
              disabled={isRunning}
              className="w-full accent-emerald-500 bg-zinc-950 h-2 rounded-lg cursor-pointer"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <label className="text-zinc-400 font-medium">Passing Runs Guarded (n_pass)</label>
              <span className="font-mono text-teal-400 font-bold">{nPass} runs</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={nPass}
              onChange={(e) => setNPass(parseInt(e.target.value, 10))}
              disabled={isRunning}
              className="w-full accent-teal-500 bg-zinc-950 h-2 rounded-lg cursor-pointer"
            />
          </div>
        </div>

        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs">
            <label className="text-zinc-400 font-medium">
              Candidate Rule or Prompt Directive
            </label>
            <span className="text-[11px] text-zinc-500">Leave blank for automatic GenAI synthesis</span>
          </div>
          <input
            type="text"
            value={ruleInput}
            onChange={(e) => setRuleInput(e.target.value)}
            disabled={isRunning}
            placeholder="e.g. Always verify query specificity when search returns multiple conflicting domains before answering."
            className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
      </div>

      {/* Error state */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Big Firewall Verdict Banner */}
      <AnimatePresence>
        {verdict && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            className={`p-6 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-6 transition-all ${
              verdict === 'APPROVE'
                ? 'bg-gradient-to-r from-emerald-950/60 via-zinc-900 to-teal-950/40 border-emerald-500/60 shadow-2xl shadow-emerald-950/50 text-emerald-100'
                : verdict === 'BLOCK'
                ? 'bg-gradient-to-r from-rose-950/60 via-zinc-900 to-rose-950/40 border-rose-500/60 shadow-2xl shadow-rose-950/50 text-rose-100'
                : 'bg-zinc-900 border-zinc-800 text-zinc-200'
            }`}
          >
            <div className="flex items-center gap-5">
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-2xl shadow-xl ${
                  verdict === 'APPROVE'
                    ? 'bg-emerald-500 text-black shadow-emerald-500/30'
                    : verdict === 'BLOCK'
                    ? 'bg-rose-600 text-white shadow-rose-600/30'
                    : 'bg-zinc-700 text-white'
                }`}
              >
                {verdict === 'APPROVE' ? (
                  <CheckCircle2 className="w-8 h-8" />
                ) : verdict === 'BLOCK' ? (
                  <XCircle className="w-8 h-8" />
                ) : (
                  <HelpCircle className="w-8 h-8" />
                )}
              </div>
              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                  FIREWALL REPLAY DECISION
                </div>
                <div className="text-3xl font-extrabold tracking-tight">
                  {verdict === 'APPROVE'
                    ? 'APPROVED FOR FLEET DEPLOYMENT'
                    : verdict === 'BLOCK'
                    ? 'BLOCKED: REGRESSION DETECTED'
                    : verdict}
                </div>
                {whyText && (
                  <div className="text-sm mt-1 text-zinc-300 max-w-xl font-normal leading-relaxed">
                    {whyText}
                  </div>
                )}
              </div>
            </div>

            {/* Failure rate reduction KPI */}
            {stats && (
              <div className="flex items-center gap-4 bg-zinc-950/70 p-3 rounded-xl border border-zinc-800/80">
                <div className="text-center px-3">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Before</span>
                  <span className="text-2xl font-extrabold text-rose-400 font-mono">
                    {Math.round((stats.failure_rate_before ?? 0) * 100)}%
                  </span>
                </div>
                <ArrowRight className="w-5 h-5 text-zinc-600" />
                <div className="text-center px-3">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">After Fix</span>
                  <span className="text-2xl font-extrabold text-emerald-400 font-mono">
                    {Math.round((stats.failure_rate_after ?? 0) * 100)}%
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Rule Display */}
      {activeRule && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs space-y-1"
        >
          <span className="text-zinc-500 uppercase text-[10px] font-bold tracking-wider">
            Synthesized Directive Tested Across Fleet:
          </span>
          <div className="text-zinc-200 italic font-mono text-[13px]">"{activeRule}"</div>
        </motion.div>
      )}

      {/* Fleet Re-run Table */}
      <div className="glass-card p-6 rounded-2xl border border-zinc-800/80 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-200 uppercase tracking-wider">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>Fleet Evaluation Matrix ({rows.length} runs executed)</span>
          </div>
          <span className="text-[11px] font-mono text-zinc-500">Deterministic Replay Engine</span>
        </div>

        {rows.length === 0 && !isRunning && (
          <div className="p-16 text-center text-zinc-500 text-xs space-y-2">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="font-semibold text-zinc-300">Ready for Fleet Evaluation</div>
            <p className="max-w-sm mx-auto text-zinc-500">
              Click "Launch Firewall Evaluation" to run the candidate fix against all target runs simultaneously.
            </p>
          </div>
        )}

        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-zinc-500 border-b border-zinc-800/80 font-mono text-[11px]">
                  <th className="pb-3 pl-2">#</th>
                  <th className="pb-3">ORIGINAL RUN ID</th>
                  <th className="pb-3">BEFORE</th>
                  <th className="pb-3">AFTER FIX</th>
                  <th className="pb-3">FIREWALL VERDICT</th>
                  <th className="pb-3">REPLAYED FORK</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40 font-mono">
                {rows.map((row, idx) => {
                  const isFixed = row.verdict === 'fixed';
                  const isRegressed = row.verdict === 'regression';

                  return (
                    <motion.tr
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="hover:bg-zinc-800/20 transition-colors"
                    >
                      <td className="py-3 pl-2 text-zinc-500">{idx + 1}</td>
                      <td className="py-3 font-semibold text-zinc-200">
                        <Link
                          to={`/runs/${row.run_id}`}
                          className="hover:text-emerald-400 flex items-center gap-1 transition-colors"
                        >
                          {row.run_id.slice(0, 12)}
                          <ExternalLink className="w-3 h-3 text-zinc-600" />
                        </Link>
                      </td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.before === true || row.before === 'pass'
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                              : 'bg-rose-950/60 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {row.before === true || row.before === 'pass' ? 'PASS' : 'FAIL'}
                        </span>
                      </td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.after === true || row.after === 'pass'
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                              : 'bg-rose-950/60 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {row.after === true || row.after === 'pass' ? 'PASS' : 'FAIL'}
                        </span>
                      </td>
                      <td className="py-3">
                        <VerdictBadge verdict={row.verdict} size="sm" />
                      </td>
                      <td className="py-3 text-zinc-400">
                        {row.new_run ? (
                          <Link
                            to={`/runs/${row.new_run}`}
                            className="text-zinc-300 hover:text-white flex items-center gap-1 transition-colors"
                          >
                            <span>{row.new_run.slice(0, 10)}</span>
                            <ExternalLink className="w-3 h-3 text-zinc-500" />
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

