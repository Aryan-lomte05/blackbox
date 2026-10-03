import React, { useState, useRef, useEffect } from 'react';
import { api, ApiError } from '../lib/api';
import { StepKind } from '../types/api';
import { VerdictBadge } from '../components/common/VerdictBadge';
import {
  FlaskConical,
  Play,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Bug,
  Sparkles,
  Terminal,
  Cpu,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface LabStageItem {
  id: string; // unique key for repeating stages
  n: number;
  title: string;
  detail: string;
  data?: any;
  t: number;
}

interface LabStepItem {
  idx: number;
  kind: StepKind;
  name: string;
  node: string;
  used?: string;
  output?: string;
}

const PRESET_QUESTIONS = [
  {
    label: 'Math (Bakery)',
    family: 'math',
    q: 'A bakery bakes 24 muffins per tray. It bakes 6 trays and sells 97 muffins. How many muffins are left?',
  },
  {
    label: 'QA (Inception)',
    family: 'qa',
    q: 'Who directed the film Inception, and in what year was it released?',
  },
  {
    label: 'Shop Operations',
    family: 'ops',
    q: '',
  },
];

const STAGE_NAMES = [
  'Understand',
  'Knowledge',
  'Run Live',
  'Clean Answer',
  'Choose Mistake',
  'Plant Mistake',
  'Broken Answer',
  'Live Checker',
  'Diagnose',
  'Verify',
  'Repair',
  'Compare',
  'Incident',
  'Scorecard',
];

export const LiveLabScreen: React.FC = () => {
  const [question, setQuestion] = useState(PRESET_QUESTIONS[0].q);
  const [family, setFamily] = useState<string | null>(PRESET_QUESTIONS[0].family);
  const [mistake, setMistake] = useState('auto');
  const [repair, setRepair] = useState(false);

  const [isRunning, setIsRunning] = useState(false);
  const [activeStageN, setActiveStageN] = useState<number>(0);
  const [stages, setStages] = useState<LabStageItem[]>([]);
  const [liveSteps, setLiveSteps] = useState<LabStepItem[]>([]);
  const [scorecard, setScorecard] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const feedEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll feed on updates
  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [stages, liveSteps]);

  const handleStartLab = async () => {
    if (isRunning) return;
    setErrorMsg(null);
    setStages([]);
    setLiveSteps([]);
    setScorecard(null);
    setActiveStageN(1);
    setIsRunning(true);

    try {
      const resp = await api.post<{ job_id: string; events: string; result: string }>('/api/lab', {
        question: question.trim(),
        family: family || undefined,
        mistake,
        repair,
      });

      const es = api.createEventSource(resp.events);
      eventSourceRef.current = es;

      es.addEventListener('stage', (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          const stageItem: LabStageItem = {
            id: `${parsed.n}-${Date.now()}-${Math.random()}`,
            n: parsed.n,
            title: parsed.title,
            detail: parsed.detail,
            data: parsed,
            t: parsed.t,
          };
          setActiveStageN(parsed.n);
          setStages((prev) => [...prev, stageItem]);
        } catch (err) {
          console.error('Error parsing stage event:', err);
        }
      });

      es.addEventListener('step', (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed.step) {
            setLiveSteps((prev) => [...prev, parsed.step]);
          }
        } catch (err) {
          console.error('Error parsing step event:', err);
        }
      });

      es.addEventListener('done', (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed.result) {
            setScorecard(parsed.result);
          }
        } catch (err) {
          console.error('Error parsing done event:', err);
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
      setErrorMsg(err.detail || err.message || 'Failed to start lab job');
    }
  };

  const handleStop = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setIsRunning(false);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
              DEMO SCREEN 3 (AUDIENCE MOMENT)
            </span>
            <span className="text-xs font-mono text-zinc-400">14-Stage Real-Time Pipeline</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight mt-1 flex items-center gap-2.5">
            <FlaskConical className="w-6 h-6 text-rose-500" />
            Live Lab
          </h2>
          <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
            Type any question: the AI agent answers live, Black Box plants an on-stage mistake,
            and streams the investigation across all 14 stages with zero mock data.
          </p>
        </div>

        {/* Start / Stop Controls */}
        <div className="flex items-center gap-3">
          {isRunning ? (
            <button
              onClick={handleStop}
              className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-rose-400 font-mono text-xs rounded-lg border border-zinc-700 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <RotateCw className="w-4 h-4 animate-spin text-rose-500" />
              <span>Cancel Stream</span>
            </button>
          ) : (
            <button
              onClick={handleStartLab}
              className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs rounded-lg shadow-lg shadow-rose-950/50 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Launch Live Lab</span>
            </button>
          )}
        </div>
      </div>

      {/* Preset Buttons & Interactive Input Box */}
      <div className="p-6 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-mono text-zinc-400 font-semibold uppercase tracking-wider">
            Audience Question Prompt
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-zinc-500">Presets:</span>
            {PRESET_QUESTIONS.map((p, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setQuestion(p.q);
                  setFamily(p.family);
                }}
                disabled={isRunning}
                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono border border-zinc-700/60 transition-colors cursor-pointer disabled:opacity-50"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <textarea
          rows={2}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={isRunning || family === 'ops'}
          placeholder={family === 'ops' ? '(Generated store operations: orders, stock, refunds)' : 'Type any question to test the live agent...'}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-rose-500 transition-colors resize-none"
        />

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 text-xs font-mono text-zinc-400">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span>Mistake to plant:</span>
              <select
                value={mistake}
                onChange={(e) => setMistake(e.target.value)}
                disabled={isRunning}
                className="bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1 text-zinc-200 focus:outline-none focus:border-rose-500"
              >
                <option value="auto">auto (Best for question)</option>
                <option value="F1">F1: wrong tool argument</option>
                <option value="F2">F2: wrong tool result</option>
                <option value="F3">F3: tool returned nothing</option>
                <option value="F4">F4: misleading paragraph</option>
                <option value="F5">F5: missing paragraph</option>
                <option value="F6">F6: wrong fact</option>
                <option value="F7">F7: wrong tool</option>
                <option value="F8">F8: lost memory</option>
                <option value="F9">F9: dropped instruction</option>
                <option value="F10">F10: answered too early</option>
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={repair}
                onChange={(e) => setRepair(e.target.checked)}
                disabled={isRunning}
                className="rounded border-zinc-700 bg-zinc-950 text-rose-600 focus:ring-0 cursor-pointer"
              />
              <span>Repair with GenAI (Stage 11)</span>
            </label>
          </div>

          <div className="text-[11px] text-zinc-500">
            Stages: 1 Understand → 2 Knowledge → 3 Run → ... → 14 Scorecard
          </div>
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs font-mono flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 14-Stage Visual Stepper */}
      <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          {STAGE_NAMES.map((name, idx) => {
            const stageNum = idx + 1;
            const isCompleted = activeStageN > stageNum || scorecard !== null;
            const isCurrent = activeStageN === stageNum && isRunning;

            return (
              <div
                key={stageNum}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                  isCurrent
                    ? 'bg-rose-950/80 text-rose-200 border border-rose-500/80 shadow-md shadow-rose-950/60 font-bold animate-pulse'
                    : isCompleted
                    ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30'
                    : 'bg-zinc-950/50 text-zinc-500 border border-zinc-800/80'
                }`}
              >
                <span className="text-[10px] opacity-70">#{stageNum}</span>
                <span>{name}</span>
                {isCompleted && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Stage Stream Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Sequential Stages */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-6 rounded-xl bg-zinc-900/60 border border-zinc-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-mono uppercase font-bold text-zinc-200">
                  Sequential Investigation Stream
                </span>
              </div>
              <span className="text-[11px] font-mono text-zinc-500">
                {stages.length} events received
              </span>
            </div>

            {stages.length === 0 && !isRunning && (
              <div className="p-12 text-center text-zinc-500 font-mono text-xs">
                Click "Launch Live Lab" to trigger the live pipeline and stream all 14 stages.
              </div>
            )}

            <div className="space-y-3 max-h-[560px] overflow-y-auto pr-2">
              {stages.map((st) => (
                <div
                  key={st.id}
                  className={`p-3.5 rounded-lg border text-xs font-mono transition-all ${
                    st.n === 14
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-100'
                      : st.n === 6 || st.n === 7
                      ? 'bg-amber-950/30 border-amber-500/40 text-amber-100'
                      : st.n === 10
                      ? 'bg-rose-950/30 border-rose-500/40 text-rose-100 font-semibold'
                      : 'bg-zinc-950 border-zinc-800/80 text-zinc-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-bold text-[10px]">
                        STAGE {st.n}/14
                      </span>
                      <span className="font-bold text-white uppercase tracking-tight">{st.title}</span>
                    </div>
                    <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      +{st.t.toFixed(1)}s
                    </span>
                  </div>

                  <div className="text-zinc-300 leading-relaxed">{st.detail}</div>

                  {/* If stage 3, embed live agent steps */}
                  {st.n === 3 && liveSteps.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-zinc-800/60 space-y-2">
                      <div className="text-[10px] uppercase font-bold text-zinc-400">
                        Live Recorded Agent Steps ({liveSteps.length}):
                      </div>
                      <div className="space-y-1.5">
                        {liveSteps.map((step) => (
                          <div
                            key={step.idx}
                            className="p-2 rounded bg-zinc-900 border border-zinc-800 text-[11px] flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="font-bold text-zinc-400">#{step.idx}</span>
                              <span className="text-rose-400">{step.kind}</span>
                              <span className="text-zinc-300 truncate">{step.name}</span>
                            </div>
                            <span className="text-zinc-500 text-[10px] truncate max-w-xs">
                              {step.output?.slice(0, 60)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={feedEndRef} />
            </div>
          </div>
        </div>

        {/* Right Col: Stage 14 Scorecard Hero */}
        <div className="space-y-6">
          <div className="p-6 rounded-xl bg-gradient-to-b from-zinc-900/80 to-zinc-950 border border-zinc-800 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-rose-400" />
                Stage 14: Scorecard
              </h3>
              {scorecard && <VerdictBadge verdict="PROVED" size="sm" />}
            </div>

            {scorecard ? (
              <div className="space-y-4 text-xs font-mono">
                <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
                  <div className="flex justify-between text-zinc-400">
                    <span>Planted Mistake:</span>
                    <span className="text-amber-400 font-bold">{scorecard.planted || 'None'}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>True Guilty Step:</span>
                    <span className="text-rose-400 font-bold">Step #{scorecard.guilty}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Diagnosis Model:</span>
                    <span className={scorecard.hit ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                      {scorecard.hit ? 'Top-3 HIT' : 'Missed'}
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Replay Verified Cause:</span>
                    <span className="text-emerald-400 font-bold">Step #{scorecard.cause}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Replay Runtime:</span>
                    <span className="text-zinc-200">{scorecard.seconds}s total</span>
                  </div>
                </div>

                {scorecard.run_id && (
                  <Link
                    to={`/runs/${scorecard.run_id}`}
                    className="w-full py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>Open Recorded Run Graph</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-zinc-500 font-mono text-xs">
                The scorecard will appear here once Stage 14 is reached.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
