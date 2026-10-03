import React, { useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { VerdictBadge } from '../components/common/VerdictBadge';
import { KPI } from '../components/common/KPI';
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

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-mono">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
              DEMO SCREEN 6
            </span>
            <span className="text-xs text-zinc-400">Automated Red-Teaming & Safety Rating</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight mt-1 flex items-center gap-2.5">
            <Flame className="w-6 h-6 text-amber-500" />
            Agent Crash Test
          </h2>
          <p className="text-sm text-zinc-400 mt-1 max-w-2xl font-sans">
            Plant every known mistake kind (F1–F10) into a passing run to evaluate safety: did the agent
            recover (robust), fail safely, fail silently, or take an unsafe action?
          </p>
        </div>

        <button
          onClick={handleStartCrashTest}
          disabled={isRunning}
          className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-800 text-white font-medium text-xs rounded-lg shadow-lg shadow-amber-950/50 transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed font-sans"
        >
          {isRunning ? (
            <>
              <RotateCw className="w-4 h-4 animate-spin text-white" />
              <span>Planting Mistake Battery...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" />
              <span>Launch Red-Team Crash Test</span>
            </>
          )}
        </button>
      </div>

      {/* Target Run Input */}
      <div className="flex items-center gap-3 text-xs bg-zinc-900/60 p-3.5 rounded-xl border border-zinc-800/80">
        <span className="text-zinc-400 uppercase text-[10px]">Passing Baseline Run ID:</span>
        <input
          type="text"
          value={targetRunId}
          onChange={(e) => setTargetRunId(e.target.value)}
          disabled={isRunning}
          className="bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-zinc-200 w-72 focus:outline-none focus:border-amber-500"
        />
        <Link
          to={`/runs/${targetRunId}`}
          className="text-amber-400 hover:text-amber-300 flex items-center gap-1 text-[11px]"
        >
          View Graph <ExternalLink className="w-3 h-3" />
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
        <div className="p-16 rounded-xl bg-zinc-900/20 border border-zinc-800/80 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
            <Flame className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-zinc-200">No Crash Test Ran Yet</h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto font-sans">
            Click <strong>Launch Red-Team Crash Test</strong> to inject mutations F1–F10 into the passing run
            and compute the 1–5 star safety rating.
          </p>
        </div>
      )}

      {/* Running State */}
      {isRunning && (
        <div className="p-6 rounded-xl bg-zinc-900/40 border border-zinc-800 text-center space-y-2">
          <RotateCw className="w-6 h-6 text-amber-400 animate-spin mx-auto" />
          <div className="text-xs text-zinc-300 font-bold">Injecting planted mistakes into agent save-points...</div>
          <div className="text-[11px] text-zinc-500">Completed {testRows.length} tests so far</div>
        </div>
      )}

      {/* Star Rating Hero Card */}
      {summary && (
        <div className="p-6 rounded-xl bg-gradient-to-r from-zinc-900/80 via-zinc-900 to-amber-950/20 border border-zinc-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
              AGENT RESILIENCE & SAFETY RATING
            </span>
            <div className="flex items-center gap-1.5 justify-center md:justify-start">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`w-7 h-7 ${
                    s <= starsCount
                      ? 'fill-amber-400 text-amber-400 filter drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                      : 'text-zinc-700'
                  }`}
                />
              ))}
              <span className="ml-3 text-2xl font-extrabold text-white">
                {starsCount} / 5 Stars
              </span>
            </div>
            <div className="text-xs text-zinc-400 font-sans">
              Score: {((summary.score ?? 1) * 100).toFixed(0)}% • Tested against {summary.tests || testRows.length} planted mistakes
            </div>
          </div>

          {/* Counts badges */}
          {summary.counts && (
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-center min-w-[90px]">
                <span className="text-[10px] text-zinc-500 block uppercase">Robust</span>
                <span className="text-emerald-400 font-bold text-lg">{summary.counts.robust || 0}</span>
              </div>
              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-center min-w-[90px]">
                <span className="text-[10px] text-zinc-500 block uppercase">Failed Safely</span>
                <span className="text-amber-400 font-bold text-lg">{summary.counts['failed safely'] || 0}</span>
              </div>
              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-center min-w-[90px]">
                <span className="text-[10px] text-zinc-500 block uppercase">Silently</span>
                <span className="text-rose-400 font-bold text-lg">{summary.counts['failed silently'] || 0}</span>
              </div>
              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-center min-w-[90px]">
                <span className="text-[10px] text-zinc-500 block uppercase">Unsafe</span>
                <span className="text-rose-500 font-bold text-lg">{summary.counts.unsafe || 0}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Weak Against Alert */}
      {summary?.weak_against && summary.weak_against.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold">Vulnerability Identified:</span> Agent is weak against{' '}
              <span className="font-bold text-white">[{summary.weak_against.join(', ')}]</span>
            </div>
          </div>
          <span className="text-[10px] bg-amber-900/60 px-2 py-0.5 rounded border border-amber-500/40">
            Action Recommended
          </span>
        </div>
      )}

      {/* Planted Mistake Grid Tiles */}
      {testRows.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
            <span className="text-xs uppercase font-bold text-zinc-300 tracking-wider">
              Planted Mistakes Battery ({testRows.length} Interventions)
            </span>
            <span className="text-[11px] text-zinc-500">Live Resilience Matrix</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {testRows.map((row, idx) => {
              const isRobust = row.verdict === 'robust';
              const isUnsafe = row.verdict === 'unsafe';

              return (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border text-xs space-y-3 transition-all ${
                    isRobust
                      ? 'bg-zinc-900/60 border-zinc-800 hover:border-emerald-500/40'
                      : isUnsafe
                      ? 'bg-rose-950/30 border-rose-500/50 shadow-lg shadow-rose-950/40'
                      : 'bg-zinc-900/60 border-zinc-800 hover:border-amber-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
                      {row.fault}
                    </span>
                    <VerdictBadge verdict={row.verdict} size="sm" />
                  </div>

                  <div>
                    <div className="font-bold text-zinc-200">
                      {row.fault_name || `Fault ${row.fault}`}
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">
                      Planted at Step #{row.step}
                    </div>
                  </div>

                  {row.answer && (
                    <div className="p-2 rounded bg-zinc-950 border border-zinc-800/80 text-[11px] text-zinc-300 truncate">
                      Answer: {row.answer}
                    </div>
                  )}

                  <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[10px] text-zinc-500">
                    <span>Fork: {row.run_id?.slice(0, 10)}</span>
                    <Link
                      to={`/runs/${row.run_id}`}
                      className="text-amber-400 hover:text-amber-300 flex items-center gap-1"
                    >
                      Inspect Fork <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
