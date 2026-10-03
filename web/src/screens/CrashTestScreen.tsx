import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useJobStream } from '../lib/stream';
import { MonoLabel } from '../components/common/MonoLabel';
import { RecMark } from '../components/common/RecMark';
import { StepChip } from '../components/common/StepChip';
import { Verdict } from '../components/common/Verdict';
import { KPI } from '../components/common/KPI';
import { EmptyState } from '../components/common/EmptyState';
import { Play, RotateCw, ArrowRight, ShieldCheck, ShieldAlert, Star } from 'lucide-react';

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
  const initialRunId = searchParams.get('run') || searchParams.get('run_id') || '469bcbeba27744c0';

  const [runId, setRunId] = useState(initialRunId);
  const [jobId, setJobId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [testRows, setTestRows] = useState<CrashRow[]>([]);
  const [summary, setSummary] = useState<any | null>(null);

  const { events, isStreaming, isDone, error: streamError } = useJobStream(jobId);

  // Track live test events and done summary
  useEffect(() => {
    if (!events.length) return;

    events.forEach((evt) => {
      const d = evt.data || {};
      if (evt.type === 'test' && d.fault) {
        setTestRows((prev) => {
          const exists = prev.find((r) => r.fault === d.fault && r.step === d.step);
          const newRow: CrashRow = {
            fault: d.fault,
            fault_name: d.fault_name || `Mistake ${d.fault}`,
            step: d.step,
            verdict: d.verdict || 'robust',
            run_id: d.run_id,
            answer: d.answer,
          };
          if (exists) {
            return prev.map((r) => (r.fault === d.fault && r.step === d.step ? newRow : r));
          }
          return [...prev, newRow];
        });
      } else if (evt.type === 'done') {
        const res = d.result || d;
        setSummary(res);
        if (res.rows && res.rows.length > 0) {
          setTestRows(res.rows);
        }
      }
    });
  }, [events]);

  const handleStartCrashTest = async () => {
    if (!runId.trim()) return;
    setIsStarting(true);
    setErrorMsg(null);
    setTestRows([]);
    setSummary(null);

    try {
      const resp = await api.post<{ job_id: string }>(`/api/runs/${runId.trim()}/crash-test?per_fault=1`);
      if (resp?.job_id) {
        setJobId(resp.job_id);
      } else {
        throw new Error('Backend did not return a job_id');
      }
    } catch (err: any) {
      setErrorMsg(err.detail || err.message || 'Failed to start crash test job');
    } finally {
      setIsStarting(false);
    }
  };

  const getTileVerdictClasses = (v: string) => {
    switch (v.toLowerCase()) {
      case 'robust':
        return 'border-[var(--ok)]/40 bg-[var(--ok-bg)] text-[var(--ok)]';
      case 'failed safely':
        return 'border-[var(--trail)]/40 bg-[var(--trail-bg)] text-[var(--trail)]';
      case 'failed silently':
      case 'unsafe':
        return 'border-[var(--guilty)]/40 bg-[var(--guilty-bg)] text-[var(--guilty)]';
      default:
        return 'border-[var(--line)] bg-[var(--raised)] text-[var(--text)]';
    }
  };

  const starsCount = summary?.stars ?? 5;
  const scorePercent = summary?.score !== undefined ? Math.round(summary.score * 100) : 100;
  const weakAgainstList: string[] = summary?.weak_against || [];

  return (
    <div className="space-y-8 pb-24">
      {/* Top Header */}
      <div className="border-b border-[var(--line)] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <MonoLabel index="06" label="AUTOMATED FAULT INJECTION CRASH TEST" />
            <RecMark streaming={isStreaming || isStarting} size="sm" />
          </div>
          <h1 className="text-2xl font-bold font-sans text-[var(--text-strong)] tracking-tight">
            Agent Crash Test & Resilience Scorecard
          </h1>
          <p className="text-xs font-sans text-[var(--muted)] mt-1 max-w-2xl leading-relaxed">
            Stress-test a passing run against the full F1–F10 catalog of realistic agent failures. Measure whether the agent recovers robustly or fails silently.
          </p>
        </div>

        {/* Run Selector & Action */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[var(--faint)]">PASSING RUN:</span>
            <input
              type="text"
              value={runId}
              onChange={(e) => setRunId(e.target.value)}
              placeholder="run id..."
              className="px-2.5 py-1.5 bg-[var(--raised)] border border-[var(--line)] rounded-[var(--radius-sm)] text-xs font-mono text-[var(--text)] w-44 focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <button
            onClick={handleStartCrashTest}
            disabled={isStreaming || isStarting}
            className="px-4 py-1.5 bg-[var(--accent)] hover:brightness-110 active:brightness-95 disabled:opacity-50 text-[var(--bg)] font-sans font-semibold text-xs rounded-[var(--radius-sm)] transition-all flex items-center gap-2 cursor-pointer select-none"
          >
            {isStreaming || isStarting ? (
              <>
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>Injecting Faults...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Crash Test</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {(errorMsg || streamError) && (
        <div className="p-4 rounded-[var(--radius)] border border-[var(--guilty)]/40 bg-[var(--guilty-bg)] text-[var(--guilty)] text-xs font-mono">
          {errorMsg || streamError}
        </div>
      )}

      {/* Summary Scorecard Bar when results arrive */}
      {summary && (
        <div className="space-y-4">
          <MonoLabel index="SCORE" label="RESILIENCE RATING & WEAKNESS AUDIT" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Verdict
              verdict="CRASH TEST"
              stars={starsCount}
              detail={`Scored ${scorePercent}% resilience against planted operational faults.`}
            />

            <KPI
              label="RESILIENCE SCORE"
              value={`${scorePercent}%`}
              context={`${summary.tests || 6} fault vectors evaluated`}
              variant={scorePercent >= 80 ? 'ok' : 'trail'}
            />

            <div className="panel p-4 flex flex-col justify-between">
              <MonoLabel label="WEAK AGAINST" className="mb-2" />
              {weakAgainstList.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {weakAgainstList.map((f) => (
                    <span
                      key={f}
                      className="px-2 py-0.5 rounded bg-[var(--guilty-bg)] text-[var(--guilty)] border border-[var(--guilty)]/40 font-mono text-xs font-bold"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-xs font-mono text-[var(--ok)] font-medium">
                  None (Passed all fault injections)
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tiles: One tile per planted mistake */}
      {(testRows.length > 0 || isStreaming) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <MonoLabel index="VECTORS" label="PLANTED MISTAKE TEST TILES (F1–F10)" />
            <span className="text-[10px] font-mono text-[var(--faint)]">
              {testRows.length} TESTS RECORDED
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {testRows.map((tile) => {
              const verdictClass = getTileVerdictClasses(tile.verdict);
              return (
                <div
                  key={`${tile.fault}-${tile.step}`}
                  className="panel p-4 flex flex-col justify-between space-y-3 select-none hover:border-[var(--line-strong)] transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-[var(--raised)] border border-[var(--line)] text-[var(--text-strong)]">
                          {tile.fault}
                        </span>
                        <StepChip step={tile.step} variant="default" />
                      </div>

                      <span
                        className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded-[var(--radius-sm)] border ${verdictClass}`}
                      >
                        {tile.verdict}
                      </span>
                    </div>

                    <div className="text-xs font-sans text-[var(--text)] font-medium">
                      {tile.fault_name || tile.fault}
                    </div>

                    {tile.answer && (
                      <div className="text-[11px] font-mono text-[var(--muted)] truncate mt-1">
                        Answer: {tile.answer}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between text-[11px] font-mono">
                    <span className="text-[var(--faint)]">Fork trace:</span>
                    <Link
                      to={`/runs/${tile.run_id}`}
                      className="text-[var(--accent)] hover:underline flex items-center gap-1"
                    >
                      <span>{tile.run_id.slice(0, 8)}...</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State before first run */}
      {!summary && testRows.length === 0 && !isStreaming && !isStarting && (
        <EmptyState
          title="Crash Test Suite Ready"
          description="Evaluate agent robustness by injecting counterfactual perturbations (wrong tool arguments, dropped instructions, misleading paragraphs) into this run."
          endpoint={`POST /api/runs/${runId}/crash-test`}
          command={`blackbox test --run ${runId}`}
          actionText="Execute Crash Test"
          onAction={handleStartCrashTest}
        />
      )}
    </div>
  );
};
