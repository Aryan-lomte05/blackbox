import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';
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
  Clock,
  ExternalLink,
  ChevronRight,
  Radio,
  ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface LabStageItem {
  id: string;
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
    label: 'Math (Bakery Muffins)',
    family: 'math',
    q: 'A bakery bakes 24 muffins per tray. It bakes 6 trays and sells 97 muffins. How many muffins are left?',
  },
  {
    label: 'QA (Inception Film)',
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
          console.error(err);
        }
      });

      es.addEventListener('step', (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed.step) {
            setLiveSteps((prev) => [...prev, parsed.step]);
          }
        } catch (err) {
          console.error(err);
        }
      });

      es.addEventListener('done', (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed.result) {
            setScorecard(parsed.result);
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
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-sans">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
              CINEMATIC LIVE DEMO
            </span>
            <span className="text-xs text-zinc-400">14 Visible Investigation Stages</span>
          </div>
          <h2 className="text-3xl font-heading font-extrabold text-white tracking-tight mt-1.5 flex items-center gap-3">
            <FlaskConical className="w-7 h-7 text-rose-500" />
            Live Lab
          </h2>
          <p className="text-sm text-zinc-300 mt-1.5 max-w-2xl leading-relaxed">
            Test any question in front of the audience: watch the agent answer, observe Black Box inject a realistic mistake live on stage, and follow the 14-stage causal investigation stream.
          </p>
        </div>

        {/* Start / Cancel */}
        <div className="flex items-center gap-3">
          {isRunning ? (
            <button
              onClick={handleStop}
              className="px-5 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-medium text-xs rounded-xl border border-rose-500/30 transition-all flex items-center gap-2 cursor-pointer"
            >
              <RotateCw className="w-4 h-4 animate-spin text-rose-400" />
              <span>Cancel Pipeline</span>
            </button>
          ) : (
            <button
              onClick={handleStartLab}
              className="px-6 py-2.5 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-semibold text-xs rounded-xl shadow-lg shadow-rose-600/30 transition-all flex items-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Launch Live Lab</span>
            </button>
          )}
        </div>
      </div>

      {/* Question Input Card */}
      <div className="p-6 rounded-3xl bg-zinc-900/60 border border-white/[0.08] shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
            Audience Question Prompt
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Presets:</span>
            {PRESET_QUESTIONS.map((p, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setQuestion(p.q);
                  setFamily(p.family);
                }}
                disabled={isRunning}
                className="px-3 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 text-xs border border-white/[0.06] transition-colors cursor-pointer disabled:opacity-50"
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
          placeholder={family === 'ops' ? '(Generated store operations: orders, inventory, refunds)' : 'Type any question to test live...'}
          className="w-full bg-zinc-950 border border-white/[0.08] rounded-2xl p-4 text-xs font-sans text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500 transition-colors resize-none leading-relaxed"
        />

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 text-xs text-zinc-400">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span>Planted Fault:</span>
              <select
                value={mistake}
                onChange={(e) => setMistake(e.target.value)}
                disabled={isRunning}
                className="bg-zinc-950 border border-white/[0.08] rounded-xl px-3 py-1.5 text-zinc-200 focus:outline-none focus:border-rose-500 text-xs"
              >
                <option value="auto">auto (AI selects best for prompt)</option>
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
                className="rounded border-zinc-700 bg-zinc-950 text-rose-600 focus:ring-0"
              />
              <span>Repair with GenAI (Stage 11)</span>
            </label>
          </div>

          <div className="text-[11px] text-zinc-500 font-mono">
            Pipeline: 1 Understand → 2 Knowledge → 3 Run → ... → 14 Scorecard
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 14-Stage Stepper Bar */}
      <div className="p-4 rounded-2xl bg-zinc-900/40 border border-white/[0.06] overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          {STAGE_NAMES.map((name, idx) => {
            const stageNum = idx + 1;
            const isCompleted = activeStageN > stageNum || scorecard !== null;
            const isCurrent = activeStageN === stageNum && isRunning;

            return (
              <div
                key={stageNum}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all ${
                  isCurrent
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/60 shadow-lg shadow-rose-950/50 font-bold animate-pulse'
                    : isCompleted
                    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                    : 'bg-white/[0.02] text-zinc-500 border border-white/[0.04]'
                }`}
              >
                <span className="text-[10px] opacity-60 font-mono">#{stageNum}</span>
                <span>{name}</span>
                {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stream Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Stages Feed */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-6 rounded-3xl bg-zinc-900/50 border border-white/[0.08] shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
                <span className="text-xs uppercase font-bold text-zinc-200 tracking-wider">
                  Sequential Investigation Pipeline
                </span>
              </div>
              <span className="text-xs text-zinc-400 font-mono">
                {stages.length} events received
              </span>
            </div>

            {stages.length === 0 && !isRunning && (
              <div className="p-16 text-center text-zinc-500 text-xs">
                Click "Launch Live Lab" to start the live demonstration pipeline.
              </div>
            )}

            <div className="space-y-3 max-h-[580px] overflow-y-auto pr-2">
              {stages.map((st) => (
                <motion.div
                  key={st.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-2xl border text-xs transition-all ${
                    st.n === 14
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-100 shadow-lg'
                      : st.n === 6 || st.n === 7
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-100'
                      : st.n === 10
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-100 font-semibold'
                      : 'bg-zinc-950 border-white/[0.06] text-zinc-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2 py-0.5 rounded-md bg-white/[0.06] text-zinc-300 font-mono font-bold text-[10px]">
                        STAGE {st.n}/14
                      </span>
                      <span className="font-heading font-bold text-white uppercase tracking-tight text-xs">
                        {st.title}
                      </span>
                    </div>
                    <span className="text-[11px] text-zinc-400 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3 text-zinc-500" />
                      +{st.t.toFixed(1)}s
                    </span>
                  </div>

                  <div className="text-zinc-300 leading-relaxed font-sans">{st.detail}</div>

                  {/* Stage 3 Live Step Ticker */}
                  {st.n === 3 && liveSteps.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2">
                      <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                        Agent Steps Streamed ({liveSteps.length}):
                      </span>
                      <div className="space-y-1.5">
                        {liveSteps.map((step) => (
                          <div
                            key={step.idx}
                            className="p-2.5 rounded-xl bg-zinc-900 border border-white/[0.04] text-xs flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="font-mono font-bold text-zinc-400">#{step.idx}</span>
                              <span className="text-rose-400 font-mono text-[10px] uppercase">{step.kind}</span>
                              <span className="text-zinc-200 font-medium truncate">{step.name}</span>
                            </div>
                            <span className="text-zinc-400 font-mono text-[11px] truncate max-w-xs ml-2">
                              {step.output?.slice(0, 50)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
              <div ref={feedEndRef} />
            </div>
          </div>
        </div>

        {/* Right Col: Hero Scorecard */}
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-gradient-to-b from-zinc-900 via-zinc-900/90 to-zinc-950 border border-white/[0.08] shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <span className="text-xs font-heading font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-rose-400" />
                Stage 14: Scorecard
              </span>
              {scorecard && <VerdictBadge verdict="PROVED" size="sm" />}
            </div>

            {scorecard ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4"
              >
                <div className="p-4 rounded-2xl bg-zinc-950 border border-white/[0.06] space-y-3 text-xs">
                  <div className="flex justify-between items-center text-zinc-400">
                    <span>Planted Mistake:</span>
                    <span className="text-amber-400 font-bold font-mono">{scorecard.planted || 'None'}</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400">
                    <span>True Guilty Step:</span>
                    <span className="text-rose-400 font-bold font-mono">Step #{scorecard.guilty}</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400">
                    <span>GNN Top-3 Ranker:</span>
                    <span className={scorecard.hit ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                      {scorecard.hit ? 'HIT (Found it)' : 'Missed'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400">
                    <span>Replay Verified Cause:</span>
                    <span className="text-emerald-400 font-bold font-mono">Step #{scorecard.cause}</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400">
                    <span>Execution Runtime:</span>
                    <span className="text-white font-mono">{scorecard.seconds}s total</span>
                  </div>
                </div>

                {scorecard.run_id && (
                  <Link
                    to={`/runs/${scorecard.run_id}`}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-600/30"
                  >
                    <span>Inspect Recorded Run Graph</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                )}
              </motion.div>
            ) : (
              <div className="p-12 text-center text-zinc-500 text-xs">
                The final causal scorecard will appear here once Stage 14 is reached.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
