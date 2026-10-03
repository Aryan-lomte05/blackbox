import React, { useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';
import { VerdictBadge } from '../components/common/VerdictBadge';
import {
  Flame,
  Play,
  RotateCw,
  AlertTriangle,
  Star,
  ShieldCheck,
  ShieldAlert,
  Bug,
  ExternalLink,
  Filter,
} from 'lucide-react';

interface CrashRow {
  fault: string;
  fault_name?: string;
  step: number;
  verdict: 'robust' | 'failed safely' | 'failed silently' | 'unsafe' | string;
  run_id: string;
  answer?: string;
  labelled?: boolean;
}

export const CrashTestScreen: React.FC = () => {
  const [searchParams] = useSearchParams();
  const runIdFromUrl = searchParams.get('run_id') || '469bcbeba27744c0';

  const [targetRunId, setTargetRunId] = useState(runIdFromUrl);
  const [isRunning, setIsRunning] = useState(false);
  const [testRows, setTestRows] = useState<CrashRow[]>([]);
  const [summary, setSummary] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filterVerdict, setFilterVerdict] = useState<string>('all');

  const eventSourceRef = useRef<EventSource | null>(null);

  const handleStartCrashTest = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setErrorMsg(null);
    setTestRows([]);
    setSummary(null);

    try {
      const resp = await api.post<{ job_id: string; events: string; result: string }>(
        `/api/runs/${targetRunId}/crash-test?per_fault=1`
      );

      const es = api.createEventSource(resp.events);
      eventSourceRef.current = es;

      es.addEventListener('test', (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          setTestRows((prev) => {
            const existingIdx = prev.findIndex((r) => r.fault === parsed.fault && r.step === parsed.step);
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
          if (parsed.result) {
            setSummary(parsed.result);
            if (parsed.result.rows && parsed.result.rows.length > 0) {
              setTestRows(parsed.result.rows);
            }
          } else if (parsed.stars !== undefined) {
            setSummary(parsed);
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
      setErrorMsg(err.detail || err.message || 'Failed to start crash test');
    }
  };

  const starsCount = summary?.stars ?? 0;

  const filteredRows = testRows.filter((r) => {
    if (filterVerdict === 'all') return true;
    return r.verdict.toLowerCase().includes(filterVerdict);
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-sans">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              DEMO 6 • AUTOMATED RED-TEAMING
            </span>
            <span className="text-xs text-zinc-400">Agent Resilience & Safety Rating</span>
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <Flame className="w-5 h-5" />
            </div>
            Agent Crash Test
          </h2>
          <p className="text-sm text-zinc-400 mt-1.5 max-w-2xl leading-relaxed">
            Plant every known mistake kind (F1–F10) into a passing baseline run to evaluate autonomous safety: does the agent recover (robust), fail safely, fail silently, or take an unsafe real-world action?
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleStartCrashTest}
          disabled={isRunning}
          className="px-6 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:from-zinc-800 disabled:to-zinc-800 text-white font-semibold text-xs rounded-xl shadow-lg shadow-amber-950/60 transition-all flex items-center gap-2.5 cursor-pointer disabled:cursor-not-allowed border border-amber-500/30"
        >
          {isRunning ? (
            <>
              <RotateCw className="w-4 h-4 animate-spin text-white" />
              <span>Planting Mistake Battery ({testRows.length} tested)...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" />
              <span>Launch Red-Team Crash Test</span>
            </>
          )}
        </motion.button>
      </div>

      {/* Target Run Input */}
      <div className="glass-card flex items-center justify-between gap-4 p-4 rounded-xl border border-zinc-800/80">
        <div className="flex items-center gap-3 text-xs">
          <span className="text-zinc-400 font-medium">Passing Baseline Run:</span>
          <input
            type="text"
            value={targetRunId}
            onChange={(e) => setTargetRunId(e.target.value)}
            disabled={isRunning}
            className="bg-zinc-950/80 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-200 w-64 focus:outline-none focus:border-amber-500"
          />
        </div>
        <Link
          to={`/runs/${targetRunId}`}
          className="text-amber-400 hover:text-amber-300 flex items-center gap-1.5 text-xs font-medium transition-colors"
        >
          <span>View Baseline Trace</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Error State */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Empty State */}
      {!summary && testRows.length === 0 && !isRunning && !errorMsg && (
        <div className="p-16 rounded-2xl glass-card border border-zinc-800/80 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
            <Flame className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-zinc-200">No Crash Test Ran Yet</h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
            Click <strong>Launch Red-Team Crash Test</strong> to inject mutations F1–F10 into the passing run and compute the formal 1–5 star safety rating.
          </p>
        </div>
      )}

      {/* Running State */}
      {isRunning && (
        <div className="p-8 rounded-2xl glass-card border border-zinc-800 text-center space-y-2">
          <RotateCw className="w-7 h-7 text-amber-400 animate-spin mx-auto" />
          <div className="text-sm text-zinc-200 font-bold">Injecting planted mistakes into agent save-points...</div>
          <div className="text-xs text-zinc-500 font-mono">Completed {testRows.length} tests so far</div>
        </div>
      )}

      {/* Star Rating Hero Card */}
      <AnimatePresence>
        {summary && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-900 to-amber-950/30 border border-zinc-800 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6"
          >
            <div className="space-y-2.5 text-center md:text-left">
              <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                AGENT RESILIENCE & SAFETY RATING
              </span>
              <div className="flex items-center gap-2 justify-center md:justify-start">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-8 h-8 transition-transform hover:scale-110 ${
                      s <= starsCount
                        ? 'fill-amber-400 text-amber-400 filter drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]'
                        : 'text-zinc-700'
                    }`}
                  />
                ))}
                <span className="ml-3 text-3xl font-extrabold text-white font-mono">
                  {starsCount} / 5 Stars
                </span>
              </div>
              <div className="text-xs text-zinc-400 font-medium">
                Resilience Score: <strong className="text-amber-400 font-mono">{((summary.score ?? 1) * 100).toFixed(0)}%</strong> • Evaluated across {summary.tests || testRows.length} planted mistakes
              </div>
            </div>

            {/* Counts breakdown badges */}
            {summary.counts && (
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-center min-w-[95px]">
                  <span className="text-[10px] text-zinc-500 block uppercase font-mono">Robust</span>
                  <span className="text-emerald-400 font-bold text-xl font-mono">{summary.counts.robust || 0}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-center min-w-[95px]">
                  <span className="text-[10px] text-zinc-500 block uppercase font-mono">Failed Safely</span>
                  <span className="text-amber-400 font-bold text-xl font-mono">{summary.counts['failed safely'] || 0}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-center min-w-[95px]">
                  <span className="text-[10px] text-zinc-500 block uppercase font-mono">Silently</span>
                  <span className="text-rose-400 font-bold text-xl font-mono">{summary.counts['failed silently'] || 0}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-center min-w-[95px]">
                  <span className="text-[10px] text-zinc-500 block uppercase font-mono">Unsafe</span>
                  <span className="text-rose-500 font-bold text-xl font-mono">{summary.counts.unsafe || 0}</span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Weak Against Alert */}
      {summary?.weak_against && summary.weak_against.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between"
        >
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold">Autonomous Vulnerability Identified:</span> Agent fails to catch{' '}
              <span className="font-bold text-white font-mono">[{summary.weak_against.join(', ')}]</span>
            </div>
          </div>
          <span className="text-[10px] bg-amber-900/60 px-2.5 py-1 rounded-md border border-amber-500/40 font-semibold uppercase">
            Prompt Guard Recommended
          </span>
        </motion.div>
      )}

      {/* Planted Mistake Grid Tiles */}
      {testRows.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-zinc-800">
            <span className="text-xs uppercase font-bold text-zinc-200 tracking-wider">
              Planted Mistakes Battery ({testRows.length} Interventions)
            </span>

            {/* Verdict Filter Pills */}
            <div className="flex items-center gap-2 text-xs">
              <Filter className="w-3.5 h-3.5 text-zinc-500" />
              {['all', 'robust', 'safely', 'silently', 'unsafe'].map((pill) => (
                <button
                  key={pill}
                  onClick={() => setFilterVerdict(pill)}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono capitalize transition-all cursor-pointer ${
                    filterVerdict === pill
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:text-zinc-300'
                  }`}
                >
                  {pill}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRows.map((row, idx) => {
              const isRobust = row.verdict === 'robust';
              const isUnsafe = row.verdict === 'unsafe';

              return (
                <motion.div
                  key={idx}
                  whileHover={{ y: -2 }}
                  className={`p-4 rounded-xl border text-xs space-y-3 transition-all ${
                    isRobust
                      ? 'glass-card border-zinc-800 hover:border-emerald-500/40'
                      : isUnsafe
                      ? 'bg-rose-950/30 border-rose-500/50 shadow-lg shadow-rose-950/40'
                      : 'glass-card border-zinc-800 hover:border-amber-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
                      {row.fault}
                    </span>
                    <VerdictBadge verdict={row.verdict} size="sm" />
                  </div>

                  <div>
                    <div className="font-bold text-zinc-100 text-sm">
                      {row.fault_name || `Fault ${row.fault}`}
                    </div>
                    <div className="text-[11px] font-mono text-zinc-400 mt-0.5">
                      Planted at Step #{row.step}
                    </div>
                  </div>

                  {row.answer && (
                    <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800 text-[11px] text-zinc-300 truncate font-mono">
                      Answer: {row.answer}
                    </div>
                  )}

                  <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-xs">
                    <span className="font-mono text-[11px] text-zinc-500">Fork: {row.run_id?.slice(0, 10)}</span>
                    <Link
                      to={`/runs/${row.run_id}`}
                      className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium transition-colors"
                    >
                      <span>Inspect Fork</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

