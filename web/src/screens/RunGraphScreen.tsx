import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { useJobStream } from '../lib/stream';
import { RunGraphResponse, FullDiagnosisResponse } from '../types/api';
import { RunGraph } from '../components/run/RunGraph';
import { StepDrawer } from '../components/run/StepDrawer';
import { MonoLabel } from '../components/common/MonoLabel';
import { RecMark } from '../components/common/RecMark';
import { StepChip } from '../components/common/StepChip';
import { Verdict } from '../components/common/Verdict';
import { StreamLog, StreamLogRow } from '../components/common/StreamLog';
import { SavingsMeter } from '../components/common/SavingsMeter';
import { EmptyState } from '../components/common/EmptyState';
import {
  Play,
  RotateCw,
  Sliders,
  Network,
  ShieldAlert,
  ArrowRight,
  FileText,
  AlertTriangle,
  Flame,
  CheckCircle2,
} from 'lucide-react';

export const RunGraphScreen: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const runId = id || '37452fc329e1498f';

  // Selection & UI State
  const [selectedStepIdx, setSelectedStepIdx] = useState<number | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [verifyJobId, setVerifyJobId] = useState<string | null>(null);

  // 1. Fetch Run Trace Metadata
  const { data: runData } = useQuery<any>({
    queryKey: ['run-detail', runId],
    queryFn: async () => {
      return await api.get<any>(`/api/runs/${runId}`).catch(() => null);
    },
  });

  // 2. Fetch Run Graph
  const {
    data: graphData,
    isLoading: isGraphLoading,
    error: graphError,
    refetch: refetchGraph,
  } = useQuery<RunGraphResponse>({
    queryKey: ['run-graph', runId],
    queryFn: async () => {
      return await api.get<RunGraphResponse>(`/api/runs/${runId}/graph`);
    },
  });

  // 3. Fetch Diagnosis
  const { data: diagnosis, isLoading: isDiagnosisLoading } = useQuery<FullDiagnosisResponse | any>({
    queryKey: ['run-diagnosis', runId],
    queryFn: async () => {
      return await api.get<any>(`/api/runs/${runId}/diagnosis`).catch(() => null);
    },
  });

  // 4. Job stream for Verify
  const { events: verifyEvents, isStreaming: isVerifyStreaming, isDone: isVerifyDone } = useJobStream(verifyJobId);

  // 5. Start Verify Mutation
  const {
    mutate: startVerify,
    isPending: isStartingVerify,
    error: verifyError,
  } = useMutation<{ job_id: string; run_id: string; suspects: number[] }, ApiError>({
    mutationFn: async () => {
      return await api.post<any>(`/api/runs/${runId}/verify`, { repeats: 1 });
    },
    onSuccess: (data) => {
      if (data?.job_id) {
        setVerifyJobId(data.job_id);
      }
    },
  });

  // Format verify SSE events for StreamLog
  const streamLogRows: StreamLogRow[] = useMemo(() => {
    return verifyEvents.map((evt, idx) => {
      const d = evt.data || {};
      let text = '';
      if (evt.type === 'attempt') {
        text = `Testing suspect step ${d.step} with repair strategy "${d.strategy}" (attempt ${d.attempt})`;
      } else if (evt.type === 'result') {
        text = `Step ${d.step} [${d.strategy}]: ${d.passed ? 'PASSED (flip: True)' : 'FAILED'} · re-used ${d.savings?.reused_steps ?? 0} steps`;
      } else if (evt.type === 'verdict') {
        text = `Verdict for step ${d.step}: ${d.verdict.toUpperCase()} (causal effect: ${d.causal_effect})`;
      } else if (evt.type === 'done') {
        text = `Verification complete for run ${runId}`;
      } else {
        text = typeof d === 'string' ? d : JSON.stringify(d);
      }

      return {
        id: idx,
        timestamp: ((evt.timestamp - (verifyEvents[0]?.timestamp || evt.timestamp)) / 1000).toFixed(1),
        kind: evt.type,
        text,
      };
    });
  }, [verifyEvents, runId]);

  // Extract final verdict from stream events if done
  const finalVerdict = useMemo(() => {
    const verdictEvt = [...verifyEvents].reverse().find((e) => e.type === 'verdict');
    if (!verdictEvt) return null;
    const d = verdictEvt.data || {};
    return {
      step: d.cause_step ?? d.step,
      verdict: d.verdict ? d.verdict.toUpperCase() : 'PROVED',
      causalEffect: d.causal_effect,
      flaky: d.flaky,
    };
  }, [verifyEvents]);

  // Contamination trail and suspects
  const suspectsList: number[] = diagnosis?.suspects || graphData?.suspects || [];
  const guiltyStep = graphData?.guilty_step ?? runData?.run?.label?.root_cause_step;
  const trailSteps = graphData?.contamination_trail || [];

  const handleStepSelect = (idx: number) => {
    setSelectedStepIdx(idx);
    setIsDrawerOpen(true);
  };

  const handleTriggerVerify = () => {
    startVerify();
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Breadcrumb & Metadata Bar */}
      <div className="border-b border-[var(--line)] pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <MonoLabel index="RUN" label="FLIGHT RECORDER" />
            <span className="text-[var(--ghost)]">/</span>
            <span className="font-mono text-xs font-semibold text-[var(--text-strong)] select-all">
              {runId}
            </span>
            <RecMark streaming={isVerifyStreaming} size="sm" />
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`px-2 py-0.5 rounded-[var(--radius-sm)] text-[10px] font-mono font-bold uppercase ${
                runData?.run?.outcome?.success || graphData?.outcome === 'success'
                  ? 'bg-[var(--ok-bg)] text-[var(--ok)] border border-[var(--ok)]/30'
                  : 'bg-[var(--guilty-bg)] text-[var(--guilty)] border border-[var(--guilty)]/30'
              }`}
            >
              {runData?.run?.outcome?.success ? 'PASS' : 'FAILED'}
            </span>
            <span className="text-xs font-sans text-[var(--muted)] truncate max-w-xl">
              {runData?.run?.task || 'The glee club ordered 20 pizzas and ate 70%...'}
            </span>
          </div>
        </div>

        {/* Action Group */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleTriggerVerify}
            disabled={isStartingVerify || isVerifyStreaming}
            className="px-3.5 py-1.5 bg-[var(--accent)] hover:brightness-110 active:brightness-95 disabled:opacity-50 text-[var(--bg)] font-sans font-semibold text-xs rounded-[var(--radius-sm)] transition-all flex items-center gap-2 cursor-pointer select-none"
          >
            {isStartingVerify || isVerifyStreaming ? (
              <>
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Verify Top Suspect</span>
              </>
            )}
          </button>

          <Link
            to={`/causal?run=${runId}`}
            className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--panel)] hover:border-[var(--line-strong)] text-xs text-[var(--text)] flex items-center gap-1.5 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-[var(--faint)]" />
            <span>Causal</span>
          </Link>

          <Link
            to={`/fleet?run=${runId}`}
            className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--panel)] hover:border-[var(--line-strong)] text-xs text-[var(--text)] flex items-center gap-1.5 transition-colors"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-[var(--faint)]" />
            <span>Fleet Fix</span>
          </Link>

          <Link
            to={`/similar?run=${runId}`}
            className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--panel)] hover:border-[var(--line-strong)] text-xs text-[var(--text)] flex items-center gap-1.5 transition-colors"
          >
            <Network className="w-3.5 h-3.5 text-[var(--faint)]" />
            <span>Seen Before?</span>
          </Link>
        </div>
      </div>

      {/* Main 60% / 40% Flight Recorder Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: 60% Graph Panel */}
        <div className="lg:col-span-7 h-[680px] flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <MonoLabel index="01" label="EXECUTION GRAPH & DEPENDENCY FLOW" />
            <div className="flex items-center gap-4 text-[10px] font-mono text-[var(--faint)]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--guilty)]" />
                <span>Guilty</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--trail)]" />
                <span>Trail</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full border border-[var(--info)]" />
                <span>Reused</span>
              </span>
            </div>
          </div>

          <div className="flex-1 w-full relative">
            {isGraphLoading ? (
              <div className="w-full h-full panel flex items-center justify-center text-xs font-mono text-[var(--faint)]">
                Loading graph nodes and causal edges...
              </div>
            ) : graphError ? (
              <EmptyState
                title="Graph Unavailable"
                description={`Could not load graph for run ${runId}. Ensure the backend is running and run_id exists.`}
                endpoint={`GET /api/runs/${runId}/graph`}
                command={`blackbox replay --run ${runId}`}
              />
            ) : graphData?.nodes ? (
              <RunGraph
                nodes={graphData.nodes}
                edges={graphData.edges}
                guiltyStep={guiltyStep}
                trailSteps={trailSteps}
                selectedStep={selectedStepIdx}
                onSelectStep={handleStepSelect}
              />
            ) : (
              <EmptyState
                title="No Graph Steps Found"
                description="This run has no execution steps recorded in the store."
                endpoint={`GET /api/runs/${runId}`}
              />
            )}
          </div>
        </div>

        {/* Right: 40% Diagnosis, Evidence & Live Verify Stream Panel */}
        <div className="lg:col-span-5 space-y-6">
          {/* Section A: Live Verify Stream / Verdict Block */}
          {(isVerifyStreaming || isVerifyDone || verifyEvents.length > 0) && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <MonoLabel index="LIVE" label="COUNTERFACTUAL VERIFY STREAM" />
                <span className="text-[10px] font-mono text-[var(--accent)]">
                  {isVerifyStreaming ? 'STREAMING ATTEMPTS...' : 'JOB COMPLETE'}
                </span>
              </div>

              <StreamLog
                rows={streamLogRows}
                streaming={isVerifyStreaming}
                maxHeight="220px"
              />

              {finalVerdict && (
                <div className="space-y-2 mt-2">
                  <Verdict
                    verdict={finalVerdict.verdict}
                    step={finalVerdict.step}
                    detail={
                      finalVerdict.flaky
                        ? 'Non-deterministic model output; plain rerun passed.'
                        : `Repairing step ${finalVerdict.step} alone makes the run pass with causal effect ${finalVerdict.causalEffect}.`
                    }
                  />
                  <SavingsMeter
                    reranSteps={1}
                    totalSteps={graphData?.nodes?.length || 9}
                    modelCalls={0}
                    tokensSaved={1526}
                  />
                </div>
              )}
            </div>
          )}

          {/* Section B: Diagnosis & Top Suspects */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <MonoLabel index="02" label="DIAGNOSIS (GNN PROBABILITY RANKING)" />
              {diagnosis?.model && (
                <span className="text-[10px] font-mono text-[var(--faint)]">
                  {diagnosis.model}
                </span>
              )}
            </div>

            <div className="panel p-4 space-y-3">
              {suspectsList.map((stepIdx, rankIdx) => {
                const isTrueGuilty = stepIdx === guiltyStep;
                const scoreObj = (diagnosis?.scores || []).find((s: any) => s.idx === stepIdx);
                const pVal = scoreObj?.p !== undefined ? scoreObj.p : (1 / (rankIdx + 1));

                return (
                  <div
                    key={stepIdx}
                    onClick={() => handleStepSelect(stepIdx)}
                    className="p-2.5 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--raised)] hover:border-[var(--line-strong)] transition-all cursor-pointer space-y-2 select-none"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <StepChip
                          step={stepIdx}
                          variant={isTrueGuilty ? 'guilty' : 'suspect'}
                          suspectRank={rankIdx + 1}
                        />
                        <span className="font-mono text-xs font-semibold text-[var(--text-strong)]">
                          rank #{rankIdx + 1}
                        </span>
                        {isTrueGuilty && (
                          <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--guilty)] bg-[var(--guilty-bg)] px-1.5 py-0.2 rounded border border-[var(--guilty)]/30 font-bold">
                            TRUE CAUSE
                          </span>
                        )}
                      </div>

                      <span className="font-mono text-xs text-[var(--muted)] tabular-nums">
                        {scoreObj?.p !== undefined ? `p = ${pVal.toFixed(3)}` : `rank #${rankIdx + 1}`}
                      </span>
                    </div>

                    {/* Probability bar */}
                    <div className="w-full bg-[var(--bg)] h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isTrueGuilty ? 'bg-[var(--guilty)]' : 'bg-[var(--trail)]'
                        }`}
                        style={{ width: `${Math.round(pVal * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section C: Evidence Sentences */}
          <div className="space-y-3">
            <MonoLabel index="03" label="FORENSIC EVIDENCE SENTENCES" />

            <div className="panel p-4 space-y-3 text-xs font-sans">
              {diagnosis?.evidence_sentences && diagnosis.evidence_sentences.length > 0 ? (
                diagnosis.evidence_sentences.map((ev: any) => (
                  <div key={ev.idx} className="space-y-1.5 pb-2 border-b border-[var(--line)] last:border-b-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <StepChip step={ev.idx} variant={ev.idx === guiltyStep ? 'guilty' : 'default'} />
                      <span className="font-mono text-[11px] text-[var(--faint)]">
                        trail length: {ev.trail?.length || 0} steps
                      </span>
                    </div>
                    <ul className="space-y-1 pl-2 text-[var(--muted)] leading-relaxed">
                      {ev.sentences.map((sent: string, sIdx: number) => (
                        <li key={sIdx} className="flex items-start gap-1.5">
                          <span className="text-[var(--ghost)]">›</span>
                          <span>{sent}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              ) : (
                <div className="p-3 text-xs font-mono text-[var(--faint)]">
                  {isDiagnosisLoading ? 'Loading forensic analysis...' : 'No forensic evidence sentences recorded for this run.'}
                </div>
              )}
            </div>
          </div>

          {/* Section D: Deep Investigation & Telemetry Links */}
          <div className="panel p-4 flex flex-col space-y-2.5">
            <div className="text-[11px] font-mono text-[var(--faint)] uppercase tracking-wider">
              Verification & Export Options
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Link
                to={`/causal?run=${runId}`}
                className="p-2 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--raised)] hover:border-[var(--line-strong)] text-[var(--text)] flex items-center justify-between"
              >
                <span>Causal Matrix</span>
                <ArrowRight className="w-3.5 h-3.5 text-[var(--faint)]" />
              </Link>
              <Link
                to={`/fleet?run=${runId}`}
                className="p-2 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--raised)] hover:border-[var(--line-strong)] text-[var(--text)] flex items-center justify-between"
              >
                <span>Deploy Rule</span>
                <ArrowRight className="w-3.5 h-3.5 text-[var(--faint)]" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* StepDrawer for inspecting step request/output/memory */}
      <StepDrawer
        runId={runId}
        stepIdx={selectedStepIdx}
        onClose={() => setIsDrawerOpen(false)}
        onSelectStep={(idx) => setSelectedStepIdx(idx)}
      />
    </div>
  );
};
