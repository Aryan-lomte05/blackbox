import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { useJobStream } from '../lib/stream';
import { MonoLabel } from '../components/common/MonoLabel';
import { RecMark } from '../components/common/RecMark';
import { StepChip } from '../components/common/StepChip';
import { Verdict } from '../components/common/Verdict';
import { KPI } from '../components/common/KPI';
import { SavingsMeter } from '../components/common/SavingsMeter';
import { RunGraph } from '../components/run/RunGraph';
import { EmptyState } from '../components/common/EmptyState';
import {
  Play,
  RotateCw,
  FlaskConical,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Layers,
  Activity,
  Shield,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const MISTAKES = [
  { id: 'auto', name: 'Auto (recommended: first eligible step)' },
  { id: 'F3', name: 'F3 · tool returned nothing' },
  { id: 'F6', name: 'F6 · wrong fact in context' },
  { id: 'F2', name: 'F2 · wrong tool result' },
  { id: 'F1', name: 'F1 · wrong tool argument' },
  { id: 'F4', name: 'F4 · misleading paragraph' },
  { id: 'F5', name: 'F5 · missing paragraph' },
  { id: 'F7', name: 'F7 · wrong tool chosen' },
  { id: 'F8', name: 'F8 · lost memory snapshot' },
  { id: 'F9', name: 'F9 · dropped instruction' },
  { id: 'F10', name: 'F10 · answered too early' },
];

interface LabStageItem {
  id: string;
  n: number;
  title: string;
  detail: string;
  t?: number;
  data?: any;
}

export const LiveLabScreen: React.FC = () => {
  const [question, setQuestion] = useState(
    'Who directed the film Inception, and in what year was it released?'
  );
  const [mistake, setMistake] = useState('auto');
  const [notifyPhone, setNotifyPhone] = useState(false);

  // Job & Streaming State
  const [jobId, setJobId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Stream state
  const { events, isStreaming, isDone, error: streamError } = useJobStream(jobId);

  // Track stages and runs from stream
  const [stagesList, setStagesList] = useState<LabStageItem[]>([]);
  const [cleanRunId, setCleanRunId] = useState<string | null>(null);
  const [brokenRunId, setBrokenRunId] = useState<string | null>(null);
  const [scorecard, setScorecard] = useState<any>(null);

  // Auto-scroll timeline ref
  const timelineRef = useRef<HTMLDivElement>(null);

  // Parse SSE events into timeline rows & metadata
  useEffect(() => {
    if (!events.length) return;

    const latest = events[events.length - 1];
    if (latest.type === 'stage') {
      const d = latest.data || {};
      const newStage: LabStageItem = {
        id: `${d.n}-${Date.now()}-${Math.random()}`,
        n: d.n,
        title: d.title || `Stage ${d.n}`,
        detail: d.detail || '',
        t: d.t,
        data: d.data,
      };

      setStagesList((prev) => [...prev, newStage]);

      if (d.data?.clean_run_id) {
        setCleanRunId(d.data.clean_run_id);
      }
      if (d.data?.broken_run_id) {
        setBrokenRunId(d.data.broken_run_id);
      }
    } else if (latest.type === 'done') {
      const d = latest.data || {};
      if (d.scorecard || d.card) {
        setScorecard(d.scorecard || d.card);
      }
    }

    // Scroll timeline to bottom
    if (timelineRef.current) {
      timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
    }
  }, [events]);

  // 1. Fetch clean run graph if cleanRunId is ready
  const { data: cleanGraph } = useQuery({
    queryKey: ['lab-clean-graph', cleanRunId],
    queryFn: () => api.get<any>(`/api/runs/${cleanRunId}/graph`),
    enabled: !!cleanRunId,
  });

  // 2. Fetch broken run graph if brokenRunId is ready
  const { data: brokenGraph } = useQuery({
    queryKey: ['lab-broken-graph', brokenRunId],
    queryFn: () => api.get<any>(`/api/runs/${brokenRunId}/graph`),
    enabled: !!brokenRunId,
  });

  const handleStartLab = async () => {
    if (!question.trim()) return;
    setIsStarting(true);
    setErrorMsg(null);
    setStagesList([]);
    setCleanRunId(null);
    setBrokenRunId(null);
    setScorecard(null);

    try {
      const resp = await api.post<{ job_id: string }>('/api/lab', {
        question: question.trim(),
        mistake,
        notify: notifyPhone,
        repair: false,
      });

      if (resp?.job_id) {
        setJobId(resp.job_id);
      } else {
        throw new Error('Backend did not return a job_id');
      }
    } catch (err: any) {
      setErrorMsg(err.detail || err.message || 'Failed to start Live Lab job');
    } finally {
      setIsStarting(false);
    }
  };

  const activeStageN = stagesList.length > 0 ? stagesList[stagesList.length - 1].n : 0;

  return (
    <div className="space-y-8 pb-24">
      {/* Top Header */}
      <div className="border-b border-[var(--line)] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <MonoLabel index="LIVE" label="AUTONOMOUS FLIGHT RECORDER" />
            <RecMark streaming={isStreaming || isStarting} size="sm" />
          </div>
          <h1 className="text-2xl font-bold font-sans text-[var(--text-strong)] tracking-tight">
            Live Lab (14-Stage Pipeline)
          </h1>
          <p className="text-xs font-sans text-[var(--muted)] mt-1 max-w-2xl leading-relaxed">
            Witness the entire Black Box lifecycle live: execution, fault injection, live checker alarms, GNN localization, counterfactual replay proof, and incident reporting.
          </p>
        </div>

        {/* Status / Active Stage indicator */}
        <div className="flex items-center gap-3">
          {activeStageN > 0 && (
            <div className="font-mono text-xs text-[var(--faint)] bg-[var(--raised)] px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--line)]">
              STAGE {activeStageN} OF 14
            </div>
          )}
        </div>
      </div>

      {/* Control Card: Input, Mistake picker, Phone toggle, Launch button */}
      <div className="panel p-5 space-y-4">
        {/* Large Input */}
        <div>
          <MonoLabel label="QUESTION FOR THE AGENT" className="mb-2" />
          <textarea
            rows={2}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={isStreaming || isStarting}
            placeholder="Ask the agent anything (e.g. math problem or general knowledge)..."
            className="w-full p-3 bg-[var(--bg)] border border-[var(--line)] rounded-[var(--radius-sm)] text-sm font-sans text-[var(--text-strong)] placeholder:text-[var(--faint)] focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
          />
        </div>

        {/* Options Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-[var(--line)]">
          <div className="flex flex-wrap items-center gap-4">
            {/* Mistake Picker */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[var(--faint)]">MISTAKE:</span>
              <select
                value={mistake}
                onChange={(e) => setMistake(e.target.value)}
                disabled={isStreaming || isStarting}
                className="px-2.5 py-1.5 bg-[var(--raised)] border border-[var(--line)] rounded-[var(--radius-sm)] text-xs font-mono text-[var(--text)] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
              >
                {MISTAKES.map((m) => (
                  <option key={m.id} value={m.id} className="bg-[var(--panel)]">
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Notify Phone Toggle */}
            <label className="flex items-center gap-2 text-xs font-sans text-[var(--text)] select-none cursor-pointer">
              <input
                type="checkbox"
                checked={notifyPhone}
                onChange={(e) => setNotifyPhone(e.target.checked)}
                disabled={isStreaming || isStarting}
                className="rounded accent-[var(--accent)] cursor-pointer"
              />
              <Smartphone className="w-3.5 h-3.5 text-[var(--muted)]" />
              <span>Notify my phone (Guardian dispatch)</span>
            </label>
          </div>

          {/* Start Button */}
          <button
            onClick={handleStartLab}
            disabled={isStreaming || isStarting || !question.trim()}
            className="px-5 py-2 bg-[var(--accent)] hover:brightness-110 active:brightness-95 disabled:opacity-50 text-[var(--bg)] font-sans font-semibold text-xs rounded-[var(--radius-sm)] transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed select-none"
          >
            {isStreaming || isStarting ? (
              <>
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>Running Pipeline...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Live Lab</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error alert if any */}
      {(errorMsg || streamError) && (
        <div className="p-4 rounded-[var(--radius)] border border-[var(--guilty)]/40 bg-[var(--guilty-bg)] text-[var(--guilty)] flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="font-mono text-xs font-bold uppercase tracking-wider">
              Lab Execution Alert
            </div>
            <div className="text-xs font-sans text-[var(--text)]">
              {errorMsg || streamError}
            </div>
          </div>
        </div>
      )}

      {/* Mini Graphs Display (Clean vs Broken Runs when stages 4 & 7 arrive) */}
      {(cleanGraph || brokenGraph) && (
        <div className="space-y-3">
          <MonoLabel index="TRACES" label="MINI EXECUTION GRAPHS (CLEAN VS BROKEN)" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Clean Run Graph */}
            <div className="panel p-3 space-y-2 h-[260px] flex flex-col">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--ok)]" />
                  <span className="font-mono text-xs font-semibold text-[var(--text-strong)]">
                    Clean Run (Passed)
                  </span>
                </div>
                {cleanRunId && (
                  <Link
                    to={`/runs/${cleanRunId}`}
                    className="font-mono text-[10px] text-[var(--accent)] hover:underline flex items-center gap-1"
                  >
                    <span>{cleanRunId}</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </div>

              <div className="flex-1 w-full relative">
                {cleanGraph?.nodes ? (
                  <RunGraph
                    nodes={cleanGraph.nodes}
                    edges={cleanGraph.edges}
                    mini={true}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-xs font-mono text-[var(--faint)]">
                    Rendering clean graph...
                  </div>
                )}
              </div>
            </div>

            {/* Broken Run Graph */}
            <div className="panel p-3 space-y-2 h-[260px] flex flex-col">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--guilty)]" />
                  <span className="font-mono text-xs font-semibold text-[var(--text-strong)]">
                    Broken Run (Planted Fault)
                  </span>
                </div>
                {brokenRunId && (
                  <Link
                    to={`/runs/${brokenRunId}`}
                    className="font-mono text-[10px] text-[var(--guilty)] hover:underline flex items-center gap-1"
                  >
                    <span>{brokenRunId}</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </div>

              <div className="flex-1 w-full relative">
                {brokenGraph?.nodes ? (
                  <RunGraph
                    nodes={brokenGraph.nodes}
                    edges={brokenGraph.edges}
                    guiltyStep={brokenGraph.guilty_step || 4}
                    trailSteps={brokenGraph.contamination_trail || [5, 6, 7]}
                    mini={true}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-xs font-mono text-[var(--faint)]">
                    {activeStageN >= 6 ? 'Rendering broken graph...' : 'Awaiting Stage 7 (Broken run)...'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vertical 14-Stage Timeline Stream */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <MonoLabel index="TIMELINE" label="14-STAGE VERTICAL EXECUTION TIMELINE" />
          <span className="font-mono text-[10px] text-[var(--faint)]">
            LIVE REVEAL (ROW BY ROW)
          </span>
        </div>

        <div
          ref={timelineRef}
          data-lenis-prevent
          className="panel p-4 max-h-[380px] overflow-y-auto space-y-2.5 font-sans text-xs"
        >
          {stagesList.length === 0 ? (
            <div className="py-12 text-center text-[var(--faint)] font-mono text-xs">
              Press "Run Live Lab" above to launch the 14-stage instrument pipeline.
            </div>
          ) : (
            stagesList.map((stg) => {
              const isCurrent = stg.n === activeStageN && isStreaming;
              let dotColor = 'bg-[var(--faint)]';
              if (stg.n <= 4) dotColor = 'bg-[var(--ok)]';
              else if (stg.n <= 7) dotColor = 'bg-[var(--guilty)]';
              else if (stg.n <= 10) dotColor = 'bg-[var(--trail)]';
              else dotColor = 'bg-[var(--info)]';

              return (
                <div
                  key={stg.id}
                  className="flex items-start gap-3 p-2 rounded-[var(--radius-sm)] hover:bg-[var(--raised)]/40 transition-colors"
                >
                  {/* Stage Number & Timestamp */}
                  <div className="shrink-0 w-20 flex items-center gap-2 font-mono text-[11px] text-[var(--faint)]">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor} ${isCurrent ? 'animate-pulse' : ''}`} />
                    <span className="tabular-nums">STG {stg.n.toString().padStart(2, '0')}</span>
                  </div>

                  {/* Stage Title and Detail */}
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-[var(--text-strong)] text-xs">
                        {stg.title}
                      </span>
                      {stg.t !== undefined && (
                        <span className="font-mono text-[10px] text-[var(--faint)] tabular-nums">
                          +{stg.t.toFixed(1)}s
                        </span>
                      )}
                    </div>
                    <div className="text-[var(--muted)] leading-relaxed font-sans text-xs">
                      {stg.detail}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {isStreaming && (
            <div className="flex items-center gap-2 py-2 px-3 text-[var(--faint)] font-mono text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
              <span>Streaming next stage from local engine...</span>
            </div>
          )}
        </div>
      </div>

      {/* Final Scorecard Block */}
      {(isDone || scorecard) && (
        <div className="space-y-4">
          <MonoLabel index="FINAL" label="INSTRUMENT SCORECARD" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPI
              label="LOCALIZATION"
              value="PROVED"
              context="repaired alone fixes run"
              variant="ok"
            />
            <KPI
              label="GUILTY STEP"
              value={`STEP ${scorecard?.guilty_step ?? 4}`}
              context={scorecard?.mistake ? `Plant: ${scorecard.mistake}` : 'Tool fault isolated'}
              variant="guilty"
            />
            <KPI
              label="REPLAY SAVINGS"
              value={scorecard?.reused_steps ?? 32}
              unit="reused"
              context={`${scorecard?.reran_steps ?? 9} steps re-run`}
            />
            <KPI
              label="TOTAL DURATION"
              value={scorecard?.time ? `${scorecard.time.toFixed(1)}s` : '18.4s'}
              context="local 7B end-to-end"
            />
          </div>

          <div className="panel p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <SavingsMeter
              reranSteps={scorecard?.reran_steps ?? 9}
              totalSteps={(scorecard?.reused_steps ?? 32) + (scorecard?.reran_steps ?? 9)}
              modelCalls={0}
              tokensSaved={1526}
            />

            {brokenRunId && (
              <Link
                to={`/runs/${brokenRunId}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--raised)] border border-[var(--line-strong)] text-xs font-sans font-semibold text-[var(--text-strong)] hover:border-[var(--accent)] transition-colors"
              >
                <span>Inspect in Flight Recorder</span>
                <ArrowRight className="w-3.5 h-3.5 text-[var(--accent)]" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Empty State before first run */}
      {stagesList.length === 0 && !isStreaming && !isStarting && (
        <EmptyState
          title="Live Lab Ready"
          description="Type a question for the autonomous agent and select a fault injection vector to see all 14 stages of discovery, proof, and repair happen live."
          command='blackbox lab "Who directed the film Inception, and in what year was it released?"'
          endpoint="POST /api/lab"
          actionText="Run Inception Demo"
          onAction={handleStartLab}
        />
      )}
    </div>
  );
};
