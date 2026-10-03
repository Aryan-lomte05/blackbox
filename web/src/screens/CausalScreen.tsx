import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useJobStream } from '../lib/stream';
import { MonoLabel } from '../components/common/MonoLabel';
import { RecMark } from '../components/common/RecMark';
import { StepChip } from '../components/common/StepChip';
import { KPI } from '../components/common/KPI';
import { EmptyState } from '../components/common/EmptyState';
import { Play, RotateCw, Check, X, ArrowRight, ShieldAlert, DollarSign } from 'lucide-react';

export const CausalScreen: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialRunId = searchParams.get('run') || searchParams.get('run_id') || '37452fc329e1498f';

  const [runId, setRunId] = useState(initialRunId);
  const [jobId, setJobId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [report, setReport] = useState<any | null>(null);

  const { events, isStreaming, isDone, error: streamError } = useJobStream(jobId);

  // Extract report when done event arrives
  useEffect(() => {
    if (!events.length) return;
    const doneEvt = events.find((e) => e.type === 'done');
    if (doneEvt && doneEvt.data) {
      setReport(doneEvt.data.result || doneEvt.data);
    }
  }, [events]);

  const handleStartCausal = async () => {
    if (!runId.trim()) return;
    setIsStarting(true);
    setErrorMsg(null);
    setReport(null);

    try {
      const resp = await api.post<{ job_id: string }>(`/api/runs/${runId.trim()}/causal`);
      if (resp?.job_id) {
        setJobId(resp.job_id);
      } else {
        throw new Error('Backend did not return a job_id');
      }
    } catch (err: any) {
      setErrorMsg(err.detail || err.message || 'Failed to start causal report');
    } finally {
      setIsStarting(false);
    }
  };

  const blastRadius = report?.blast_radius;
  const contaminatedSteps = blastRadius?.contaminated || [];
  const moneySteps = blastRadius?.money_moving_steps || [];

  return (
    <div className="space-y-8 pb-24">
      {/* Top Header */}
      <div className="border-b border-[var(--line)] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <MonoLabel index="05" label="CAUSAL NECESSITY & SUFFICIENCY MATRIX" />
            <RecMark streaming={isStreaming || isStarting} size="sm" />
          </div>
          <h1 className="text-2xl font-bold font-sans text-[var(--text-strong)] tracking-tight">
            Causal Report & Blast Radius
          </h1>
          <p className="text-xs font-sans text-[var(--muted)] mt-1 max-w-2xl leading-relaxed">
            Distinguish root causes from symptoms: test whether fixing a suspect is necessary for success, and whether transplanting it into a clean run is sufficient to cause failure.
          </p>
        </div>

        {/* Run Selector & Action */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[var(--faint)]">RUN:</span>
            <input
              type="text"
              value={runId}
              onChange={(e) => setRunId(e.target.value)}
              placeholder="run id..."
              className="px-2.5 py-1.5 bg-[var(--raised)] border border-[var(--line)] rounded-[var(--radius-sm)] text-xs font-mono text-[var(--text)] w-44 focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <button
            onClick={handleStartCausal}
            disabled={isStreaming || isStarting}
            className="px-4 py-1.5 bg-[var(--accent)] hover:brightness-110 active:brightness-95 disabled:opacity-50 text-[var(--bg)] font-sans font-semibold text-xs rounded-[var(--radius-sm)] transition-all flex items-center gap-2 cursor-pointer select-none"
          >
            {isStreaming || isStarting ? (
              <>
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Causal Analysis</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {(errorMsg || streamError) && (
        <div className="p-4 rounded-[var(--radius)] border border-[var(--guilty)]/40 bg-[var(--guilty-bg)] text-[var(--guilty)] text-xs font-mono">
          {errorMsg || streamError}
        </div>
      )}

      {/* Streaming Progress Indicator */}
      {isStreaming && (
        <div className="panel p-4 flex items-center gap-3 text-xs font-mono text-[var(--faint)]">
          <RotateCw className="w-4 h-4 animate-spin text-[var(--accent)]" />
          <span>Evaluating counterfactual interventions across suspects...</span>
        </div>
      )}

      {/* Main Causal Report */}
      {report && (
        <div className="space-y-6">
          {/* Summary Banner */}
          {report.summary && (
            <div className="panel p-4 border-l-2 border-l-[var(--accent)]">
              <MonoLabel label="FINDINGS SUMMARY" className="mb-1" />
              <p className="text-xs font-sans text-[var(--text-strong)] leading-relaxed">
                {report.summary}
              </p>
            </div>
          )}

          {/* Table: Necessary / Sufficient Table per suspect */}
          <div className="space-y-3">
            <MonoLabel index="01" label="SUSPECT CAUSAL CLASSIFICATION" />

            <div className="panel overflow-hidden">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-[var(--raised)] border-b border-[var(--line)] text-[10px] font-mono text-[var(--faint)] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4">Step</th>
                    <th className="py-2.5 px-4">Kind / Component</th>
                    <th className="py-2.5 px-4 text-center">Necessary</th>
                    <th className="py-2.5 px-4 text-center">Sufficient</th>
                    <th className="py-2.5 px-4">Causal Verdict</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)] font-mono text-xs">
                  {(report.single || []).map((row: any) => {
                    const isNec = row.necessary === true;
                    const isSuff = row.sufficient === true;

                    return (
                      <tr key={row.step} className="hover:bg-[var(--raised)]/40 transition-colors">
                        <td className="py-2.5 px-4">
                          <StepChip
                            step={row.step}
                            variant={isNec ? 'guilty' : 'default'}
                          />
                        </td>
                        <td className="py-2.5 px-4 font-mono text-xs text-[var(--text)]">
                          {row.kind}:{row.name}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          {isNec ? (
                            <span className="inline-flex items-center gap-1 text-[var(--ok)] font-bold">
                              <Check className="w-3.5 h-3.5" />
                              <span>YES</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[var(--faint)]">
                              <X className="w-3.5 h-3.5" />
                              <span>NO</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          {isSuff ? (
                            <span className="inline-flex items-center gap-1 text-[var(--guilty)] font-bold">
                              <Check className="w-3.5 h-3.5" />
                              <span>YES</span>
                            </span>
                          ) : row.sufficient === false ? (
                            <span className="inline-flex items-center gap-1 text-[var(--faint)]">
                              <X className="w-3.5 h-3.5" />
                              <span>NO</span>
                            </span>
                          ) : (
                            <span className="text-[var(--ghost)]">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 font-sans text-xs">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-[var(--radius-sm)] border text-[10px] font-mono uppercase ${
                              isNec
                                ? 'bg-[var(--guilty-bg)] text-[var(--guilty)] border-[var(--guilty)]/30 font-semibold'
                                : 'bg-[var(--panel)] text-[var(--muted)] border-[var(--line)]'
                            }`}
                          >
                            {row.verdict || (isNec ? 'CONTRIBUTING CAUSE' : 'NOT A CAUSE')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Blast Radius Bar */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <MonoLabel index="02" label="DOWNSTREAM BLAST RADIUS" />
              {blastRadius && (
                <span className="text-[10px] font-mono text-[var(--faint)]">
                  {contaminatedSteps.length} OF {blastRadius.of_later_steps ?? 9} STEPS CONTAMINATED
                </span>
              )}
            </div>

            <div className="panel p-4 space-y-3">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2" data-lenis-prevent>
                {Array.from({ length: 14 }).map((_, idx) => {
                  const isContaminated = contaminatedSteps.includes(idx);
                  const isMoney = moneySteps.includes(idx);
                  const isRoot = idx === 4;

                  let barStyle = 'bg-[var(--raised)] border-[var(--line)] text-[var(--faint)]';
                  if (isMoney) {
                    barStyle = 'bg-[var(--guilty-bg)] border-[var(--guilty)] text-[var(--guilty)] ring-1 ring-[var(--guilty)]';
                  } else if (isRoot) {
                    barStyle = 'bg-[var(--guilty-bg)] border-[var(--guilty)] text-[var(--guilty)] font-bold';
                  } else if (isContaminated) {
                    barStyle = 'bg-[var(--trail-bg)] border-[var(--trail)] text-[var(--trail)]';
                  }

                  return (
                    <div
                      key={idx}
                      className={`flex-1 min-w-[56px] h-14 rounded-[var(--radius-sm)] border p-1.5 flex flex-col justify-between font-mono text-[10px] select-none ${barStyle}`}
                    >
                      <div className="flex items-center justify-between">
                        <span>#{idx}</span>
                        {isMoney && <DollarSign className="w-3 h-3 text-[var(--guilty)]" />}
                      </div>
                      <div className="truncate text-[9px] uppercase font-sans">
                        {isRoot ? 'ROOT' : isContaminated ? 'TRAIL' : 'CLEAN'}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono text-[var(--faint)] pt-2 border-t border-[var(--line)]">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[var(--guilty)]" />
                    <span>Root cause / Money moving</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[var(--trail)]" />
                    <span>Contaminated trail</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[var(--line)]" />
                    <span>Clean execution</span>
                  </span>
                </div>

                <span>SEVERITY: {blastRadius?.severity?.toUpperCase() || 'HIGH'}</span>
              </div>
            </div>
          </div>

          {/* Recovery Paths Chips */}
          <div className="space-y-3">
            <MonoLabel index="03" label="COUNTERFACTUAL RECOVERY PATHS" />

            <div className="panel p-4 flex flex-wrap items-center gap-3">
              {(report.recovery_paths || []).length > 0 ? (
                report.recovery_paths.map((rp: any, idx: number) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--info)]/30 bg-[var(--panel)] text-[var(--info)] font-mono text-xs select-none"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--info)]" />
                    <span>
                      step {rp.step} · {rp.how} strategy → <span className="font-semibold">PASS</span>
                    </span>
                    {rp.run && (
                      <Link to={`/runs/${rp.run}`} className="text-[var(--text)] hover:underline ml-1">
                        (run {rp.run.slice(0, 8)})
                      </Link>
                    )}
                  </span>
                ))
              ) : (
                <div className="text-xs font-mono text-[var(--faint)]">
                  No automated recovery paths found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty State before first run */}
      {!report && !isStreaming && !isStarting && (
        <EmptyState
          title="Causal Analysis Ready"
          description="Run counterfactual ablation to determine whether suspect steps are necessary causes or symptoms, and visualize the downstream contamination blast radius."
          endpoint={`POST /api/runs/${runId}/causal`}
          command={`blackbox causal --run ${runId}`}
          actionText="Run Causal Analysis"
          onAction={handleStartCausal}
        />
      )}
    </div>
  );
};
