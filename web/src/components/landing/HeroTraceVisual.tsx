import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll } from 'framer-motion';
import {
  Play,
  Pause,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  GitFork,
  Cpu,
  Database,
  Wrench,
  Sparkles,
  Sliders,
  Terminal,
  Activity,
  Zap,
  ShieldAlert,
  CornerDownRight,
  Radio,
  FileCode2,
} from 'lucide-react';

type TracePhase = 'normal' | 'failure' | 'isolating' | 'replay' | 'verified';

interface TraceNode {
  id: number;
  label: string;
  kind: 'input' | 'retrieval' | 'llm' | 'tool' | 'final';
  x: number; // percentage
  tokens: number;
  latencyMs: number;
  desc: string;
  payload: string;
}

const NODES: TraceNode[] = [
  {
    id: 0,
    label: 'INPUT: TASK',
    kind: 'input',
    x: 8,
    tokens: 42,
    latencyMs: 12,
    desc: 'Multi-table settlement inquiry dispatched to autonomous agent',
    payload: '{"task": "Calculate Q3 APAC settlements across customer margin tiers"}',
  },
  {
    id: 1,
    label: 'RETRIEVAL',
    kind: 'retrieval',
    x: 25,
    tokens: 340,
    latencyMs: 84,
    desc: 'Vector index retrieval for database schemas and business rules',
    payload: '{"query": "APAC FX rates & tier rules", "chunks_returned": 4}',
  },
  {
    id: 2,
    label: 'LLM: PLANNER',
    kind: 'llm',
    x: 42,
    tokens: 520,
    latencyMs: 410,
    desc: 'Constructs SQL query strategy and parameter bindings',
    payload: '{"plan": "query_warehouse(sql=SELECT account, currency, amount)"}',
  },
  {
    id: 3,
    label: 'TOOL: SQL_EXEC',
    kind: 'tool',
    x: 59,
    tokens: 180,
    latencyMs: 290,
    desc: 'Database execution against analytics warehouse (drops column silently)',
    payload: '{"sql": "SELECT account, amount FROM apac_ledger", "missing": ["currency"]}',
  },
  {
    id: 4,
    label: 'LLM: SYNTHESIZE',
    kind: 'llm',
    x: 76,
    tokens: 680,
    latencyMs: 512,
    desc: 'Formats numerical output; contaminated by null currency fallback',
    payload: '{"parsed_records": 12, "warning": "currency key missing, defaulted 0.0"}',
  },
  {
    id: 5,
    label: 'FINAL: EMIT',
    kind: 'final',
    x: 93,
    tokens: 95,
    latencyMs: 24,
    desc: 'Terminal exception triggered by downstream division error',
    payload: '{"status": "crashed", "error": "ZeroRevenueThresholdException: zero total"}',
  },
];

export const HeroTraceVisual: React.FC = () => {
  const [phase, setPhase] = useState<TracePhase>('normal');
  const [scrubProgress, setScrubProgress] = useState<number>(0.1);
  const [selectedNode, setSelectedNode] = useState<TraceNode | null>(null);
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(true);
  const [isManualOverride, setIsManualOverride] = useState<boolean>(false);
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 });

  const containerRef = useRef<HTMLDivElement>(null);

  // Direct scroll-scrubbing connected to the window/hero position
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 85%', 'end 15%'],
  });

  useEffect(() => {
    return scrollYProgress.on('change', (v) => {
      const clamped = Math.max(0, Math.min(1, v));
      setScrubProgress(clamped);

      if (isManualOverride) return;

      // Scrub phases directly according to scroll position
      if (clamped < 0.22) {
        setPhase('normal');
      } else if (clamped < 0.44) {
        setPhase('failure');
      } else if (clamped < 0.66) {
        setPhase('isolating');
      } else if (clamped < 0.88) {
        setPhase('replay');
      } else {
        setPhase('verified');
      }
    });
  }, [scrollYProgress, isManualOverride]);

  // Auto-play timer loop when user is not manually scrubbing
  useEffect(() => {
    if (!isAutoPlaying || isManualOverride) return;

    const sequence: { next: TracePhase; delay: number; prog: number }[] = [
      { next: 'failure', delay: 3500, prog: 0.35 },
      { next: 'isolating', delay: 3200, prog: 0.55 },
      { next: 'replay', delay: 3400, prog: 0.75 },
      { next: 'verified', delay: 4000, prog: 0.95 },
      { next: 'normal', delay: 4000, prog: 0.10 },
    ];

    let currentIdx = 0;
    let timer: NodeJS.Timeout;

    const runNext = () => {
      const step = sequence[currentIdx];
      timer = setTimeout(() => {
        setPhase(step.next);
        setScrubProgress(step.prog);
        currentIdx = (currentIdx + 1) % sequence.length;
        runNext();
      }, step.delay);
    };

    runNext();
    return () => clearTimeout(timer);
  }, [isAutoPlaying, isManualOverride]);

  // Subtle 3D perspective tilt on mouse move
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({
      rotateX: -y * 6,
      rotateY: x * 6,
    });
  };

  const handleMouseLeave = () => {
    setTilt({ rotateX: 0, rotateY: 0 });
  };

  const handlePhaseSelect = (targetPhase: TracePhase, prog: number) => {
    setIsManualOverride(true);
    setIsAutoPlaying(false);
    setPhase(targetPhase);
    setScrubProgress(prog);
  };

  const handleResumeAuto = () => {
    setIsManualOverride(false);
    setIsAutoPlaying(true);
  };

  const getNodeColor = (node: TraceNode) => {
    if (phase === 'normal') return { border: 'border-cyan-500/50', bg: 'bg-[#08121f]', glow: '#38bdf8' };
    if (phase === 'failure') {
      if (node.id === 3) return { border: 'border-red-500', bg: 'bg-red-950/80', glow: '#ef4444' };
      if (node.id > 3) return { border: 'border-red-900/60', bg: 'bg-zinc-950/80', glow: '#6b7280' };
      return { border: 'border-cyan-500/50', bg: 'bg-[#08121f]', glow: '#38bdf8' };
    }
    if (phase === 'isolating') {
      if (node.id === 3) return { border: 'border-red-500', bg: 'bg-red-950/90', glow: '#ef4444' };
      if (node.id > 3) return { border: 'border-amber-600/70', bg: 'bg-amber-950/40', glow: '#f59e0b' };
      return { border: 'border-cyan-500/50', bg: 'bg-[#08121f]', glow: '#38bdf8' };
    }
    if (phase === 'replay' || phase === 'verified') {
      if (node.id < 3) return { border: 'border-cyan-500/70', bg: 'bg-[#0b1b2d]', glow: '#38bdf8' };
      if (node.id === 3) return { border: 'border-red-800/60', bg: 'bg-red-950/40 opacity-60', glow: '#ef4444' };
      return { border: 'border-zinc-800', bg: 'bg-zinc-950/60 opacity-40', glow: '#4b5563' };
    }
    return { border: 'border-zinc-800', bg: 'bg-zinc-900', glow: '#38bdf8' };
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `perspective(1200px) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`,
        transition: 'transform 0.15s ease-out',
      }}
      className="relative w-full max-w-5xl mx-auto rounded-xl bg-[#06090f] border border-[#1f2937] shadow-[0_20px_70px_rgba(0,0,0,0.85)] p-5 md:p-7 font-sans select-none overflow-hidden group/board"
    >
      {/* Background Circuit Grid & Atmospheric Ambient Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(#1f293725_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
      <div
        className="absolute -top-24 left-1/2 -translate-x-1/2 w-[650px] h-[350px] rounded-full blur-[130px] pointer-events-none transition-colors duration-700"
        style={{
          background:
            phase === 'failure' || phase === 'isolating'
              ? 'rgba(239, 68, 68, 0.15)'
              : phase === 'verified'
              ? 'rgba(34, 197, 94, 0.15)'
              : 'rgba(56, 189, 248, 0.12)',
        }}
      />

      {/* Cybernetic Flight HUD Header */}
      <div className="relative z-10 flex flex-wrap items-center justify-between pb-4 border-b border-[#1f2937] text-xs font-mono text-zinc-400 gap-3">
        {/* Left: Signal Sensor & Active Phase */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full shadow-sm transition-colors ${
                phase === 'failure' || phase === 'isolating'
                  ? 'bg-red-500 shadow-red-500 animate-ping'
                  : phase === 'verified'
                  ? 'bg-emerald-400 shadow-emerald-400'
                  : 'bg-cyan-400 shadow-cyan-400 animate-pulse'
              }`}
            />
            <span className="text-white font-bold tracking-widest text-[11px] uppercase">
              BLACK BOX FLIGHT RECORDER
            </span>
          </div>

          <span className="text-zinc-600">//</span>

          <span className="text-[11px] font-semibold">
            {phase === 'normal' && <span className="text-cyan-400">PHASE 01: BIT-EXACT RECORDING</span>}
            {phase === 'failure' && <span className="text-red-400 font-bold animate-pulse">PHASE 02: ANOMALOUS COLLAPSE</span>}
            {phase === 'isolating' && <span className="text-amber-400">PHASE 03: GNN CAUSAL ISOLATION</span>}
            {phase === 'replay' && <span className="text-emerald-400">PHASE 04: COUNTERFACTUAL FORK</span>}
            {phase === 'verified' && <span className="text-emerald-300 font-bold">PHASE 05: VERIFIED FLEET REPAIR</span>}
          </span>
        </div>

        {/* Right: Interactive Phase Buttons & Auto Controls */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center bg-[#090e17] p-1 rounded-md border border-[#1f2937] text-[10px]">
            <button
              onClick={() => handlePhaseSelect('normal', 0.1)}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer font-bold ${
                phase === 'normal' ? 'bg-cyan-950 text-cyan-300 border border-cyan-700' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              RUN
            </button>
            <button
              onClick={() => handlePhaseSelect('failure', 0.35)}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer font-bold ${
                phase === 'failure' ? 'bg-red-950 text-red-300 border border-red-700' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              CRASH
            </button>
            <button
              onClick={() => handlePhaseSelect('isolating', 0.55)}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer font-bold ${
                phase === 'isolating' ? 'bg-amber-950 text-amber-300 border border-amber-700' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              DIAGNOSE
            </button>
            <button
              onClick={() => handlePhaseSelect('replay', 0.75)}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer font-bold ${
                phase === 'replay' ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              FORK
            </button>
            <button
              onClick={() => handlePhaseSelect('verified', 0.95)}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer font-bold ${
                phase === 'verified' ? 'bg-emerald-500 text-black' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              PROVE
            </button>
          </div>

          {isManualOverride ? (
            <button
              onClick={handleResumeAuto}
              title="Resume automatic cycle"
              className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-cyan-400 text-[10px] font-mono flex items-center gap-1 border border-zinc-700 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden sm:inline">AUTOPLAY</span>
            </button>
          ) : (
            <button
              onClick={() => setIsAutoPlaying(!isAutoPlaying)}
              title={isAutoPlaying ? 'Pause loop' : 'Play loop'}
              className="p-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
            >
              {isAutoPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 text-cyan-400" />}
            </button>
          )}
        </div>
      </div>

      {/* Tactile Scroll Scrubber Rail */}
      <div className="relative z-10 pt-3 pb-1">
        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 mb-1.5">
          <span className="flex items-center gap-1.5">
            <Sliders className="w-3 h-3 text-cyan-400" />
            <strong className="text-zinc-300 uppercase">Interactive Timeline Scrubber</strong>
            <span className="text-zinc-600">· SCROLL WHEEL LINKED</span>
          </span>
          <span className="text-cyan-400 font-bold">
            PROGRESS: {(scrubProgress * 100).toFixed(0)}%
          </span>
        </div>

        {/* Laser Progress Track with Drag / Click scrubbing */}
        <div
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickPct = (e.clientX - rect.left) / rect.width;
            setScrubProgress(clickPct);
            setIsManualOverride(true);
            setIsAutoPlaying(false);
            if (clickPct < 0.22) setPhase('normal');
            else if (clickPct < 0.44) setPhase('failure');
            else if (clickPct < 0.66) setPhase('isolating');
            else if (clickPct < 0.88) setPhase('replay');
            else setPhase('verified');
          }}
          className="relative h-2 w-full rounded-full bg-zinc-900/90 border border-zinc-800 cursor-pointer overflow-hidden group/bar"
        >
          {/* Active fill beam */}
          <motion.div
            className={`h-full transition-colors duration-300 ${
              phase === 'failure'
                ? 'bg-gradient-to-r from-red-600 via-rose-500 to-red-400 shadow-[0_0_12px_rgba(239,68,68,0.8)]'
                : phase === 'verified' || phase === 'replay'
                ? 'bg-gradient-to-r from-cyan-500 via-emerald-400 to-teal-300 shadow-[0_0_12px_rgba(34,197,94,0.8)]'
                : 'bg-gradient-to-r from-cyan-600 via-sky-400 to-cyan-300 shadow-[0_0_12px_rgba(56,189,248,0.8)]'
            }`}
            style={{ width: `${Math.max(5, scrubProgress * 100)}%` }}
            transition={{ ease: 'easeOut', duration: 0.15 }}
          />

          {/* Scrubber Stage Markers */}
          <div className="absolute inset-0 flex justify-between px-2 pointer-events-none">
            <span className="w-1 h-full bg-white/20" />
            <span className="w-1 h-full bg-white/20" />
            <span className="w-1 h-full bg-white/20" />
            <span className="w-1 h-full bg-white/20" />
            <span className="w-1 h-full bg-white/20" />
          </div>
        </div>
      </div>

      {/* Main Execution Canvas — Dual-Lane Topology with Particle Laser Stream */}
      <div className="relative py-8 my-2 overflow-x-auto min-h-[300px] flex flex-col justify-center">
        {/* SVG Dynamic Connection Wire Harness */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
          <defs>
            {/* Pulsing glow filter */}
            <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-red" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-green" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Primary Lane Connecting Traces */}
          {NODES.slice(0, -1).map((node, i) => {
            const nextNode = NODES[i + 1];
            const isContaminated = (phase === 'isolating' || phase === 'failure') && i >= 3;
            const isFaultSource = (phase === 'failure' || phase === 'isolating') && i === 2;
            const isReused = (phase === 'replay' || phase === 'verified') && i < 2;

            return (
              <g key={`edge-${node.id}-${nextNode.id}`}>
                {/* Background bus wire */}
                <line
                  x1={`${node.x}%`}
                  y1="34%"
                  x2={`${nextNode.x}%`}
                  y2="34%"
                  stroke="#1f2937"
                  strokeWidth="3"
                />

                {/* Foreground dynamic energy laser */}
                <line
                  x1={`${node.x}%`}
                  y1="34%"
                  x2={`${nextNode.x}%`}
                  y2="34%"
                  stroke={
                    isFaultSource
                      ? '#ef4444'
                      : isContaminated
                      ? '#f59e0b'
                      : isReused
                      ? '#38bdf8'
                      : phase === 'normal'
                      ? '#38bdf8'
                      : '#374151'
                  }
                  strokeWidth={isFaultSource || isContaminated ? '2.5' : '1.5'}
                  strokeDasharray={isFaultSource ? '5 5' : undefined}
                  filter={isFaultSource ? 'url(#glow-red)' : isReused ? 'url(#glow-cyan)' : undefined}
                  className={isContaminated || isFaultSource ? 'animate-pulse' : ''}
                />

                {/* Animated traveling data packet */}
                {phase === 'normal' && (
                  <motion.circle
                    r="3.5"
                    fill="#38bdf8"
                    filter="url(#glow-cyan)"
                    animate={{
                      cx: [`${node.x}%`, `${nextNode.x}%`],
                    }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: i * 0.25,
                    }}
                    cy="34%"
                  />
                )}
              </g>
            );
          })}

          {/* Counterfactual Fork Branch (Lanes split during replay & verified) */}
          {(phase === 'replay' || phase === 'verified') && (
            <g className="animate-in fade-in duration-500">
              {/* Divergence Arc from Save-Point #2 into Counterfactual Lane */}
              <path
                d="M 42% 34% C 48% 34%, 50% 76%, 59% 76%"
                fill="none"
                stroke="#22c55e"
                strokeWidth="2.5"
                filter="url(#glow-green)"
                strokeDasharray="6 6"
                className="animate-pulse"
              />

              {/* Forked Lane Horizontal Connectors */}
              <line
                x1="59%"
                y1="76%"
                x2="76%"
                y2="76%"
                stroke="#22c55e"
                strokeWidth="2.5"
                filter="url(#glow-green)"
              />
              <line
                x1="76%"
                y1="76%"
                x2="93%"
                y2="76%"
                stroke="#22c55e"
                strokeWidth="2.5"
                filter="url(#glow-green)"
              />

              {/* Traveling green patch packet */}
              <motion.circle
                r="4"
                fill="#4ade80"
                filter="url(#glow-green)"
                animate={{
                  cx: ['59%', '93%'],
                }}
                transition={{
                  duration: 1.4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                cy="76%"
              />
            </g>
          )}
        </svg>

        {/* PRIMARY EXECUTION ROW (TOP LANE) */}
        <div className="relative h-24 w-full min-w-[760px]">
          {NODES.map((node) => {
            const styles = getNodeColor(node);
            const isGuilty = (phase === 'isolating' || phase === 'failure') && node.id === 3;
            const isContaminated = (phase === 'isolating' || phase === 'failure') && node.id > 3;
            const isSelected = selectedNode?.id === node.id;

            return (
              <div
                key={node.id}
                onClick={() => setSelectedNode(node)}
                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300 group/card z-10"
                style={{ left: `${node.x}%`, top: '50%' }}
              >
                {/* Shockwave Radar Ring for Guilty Root Cause */}
                {isGuilty && (
                  <>
                    <motion.div
                      animate={{ scale: [1, 2.2], opacity: [0.9, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                      className="absolute -inset-4 rounded-xl border-2 border-red-500 pointer-events-none"
                    />
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-red-600 text-white font-mono text-[9px] font-black tracking-widest uppercase animate-bounce whitespace-nowrap shadow-lg shadow-red-900">
                      GUILTY ROOT
                    </div>
                  </>
                )}

                {/* Contamination Alert Header */}
                {isContaminated && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold text-amber-400 flex items-center gap-0.5 whitespace-nowrap">
                    <AlertTriangle className="w-2.5 h-2.5" /> POISONED
                  </div>
                )}

                {/* Tactical Node Card */}
                <motion.div
                  whileHover={{ scale: 1.05, y: -2 }}
                  className={`w-24 md:w-28 p-2.5 rounded-lg border text-center transition-all shadow-xl backdrop-blur-sm ${
                    styles.border
                  } ${styles.bg} ${
                    isSelected ? 'ring-2 ring-white scale-105' : ''
                  }`}
                >
                  <div className="flex items-center justify-between text-[9px] font-mono text-zinc-400 mb-1">
                    <span>#{node.id}</span>
                    <span className="font-bold text-white">{node.latencyMs}ms</span>
                  </div>

                  <div className="my-1 flex items-center justify-center">
                    {node.kind === 'input' && <Sparkles className="w-4 h-4 text-zinc-300" />}
                    {node.kind === 'retrieval' && <Database className="w-4 h-4 text-purple-400" />}
                    {node.kind === 'llm' && <Cpu className="w-4 h-4 text-cyan-400" />}
                    {node.kind === 'tool' && (
                      <Wrench
                        className={`w-4 h-4 ${isGuilty ? 'text-red-400 animate-spin' : 'text-amber-400'}`}
                        style={{ animationDuration: '4s' }}
                      />
                    )}
                    {node.kind === 'final' && (
                      <CheckCircle2
                        className={`w-4 h-4 ${isContaminated ? 'text-red-400' : 'text-emerald-400'}`}
                      />
                    )}
                  </div>

                  <p className="text-[10px] font-mono font-bold text-white tracking-tight truncate">
                    {node.label}
                  </p>

                  <p className="text-[8px] font-mono text-zinc-400 mt-0.5 truncate">
                    {node.tokens} tokens
                  </p>
                </motion.div>
              </div>
            );
          })}
        </div>

        {/* COUNTERFACTUAL FORK ROW (BOTTOM LANE) */}
        {(phase === 'replay' || phase === 'verified') && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="relative h-24 w-full min-w-[760px] mt-4"
          >
            {/* Fork Badge Label */}
            <div className="absolute left-[45%] top-[10%] -translate-x-1/2 text-[9px] font-mono text-emerald-300 flex items-center gap-1 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-600 shadow-md">
              <GitFork className="w-3 h-3 text-emerald-400" />
              <span>COUNTERFACTUAL FORK FROM SAVE-POINT #2</span>
            </div>

            {/* Repaired Node #3 */}
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 z-10 cursor-pointer"
              style={{ left: '59%', top: '50%' }}
              onClick={() =>
                setSelectedNode({
                  id: 3,
                  label: 'TOOL: REPAIRED',
                  kind: 'tool',
                  x: 59,
                  tokens: 185,
                  latencyMs: 140,
                  desc: 'Patched schema validation enforces presence of currency key. Query succeeded.',
                  payload: '{"sql": "SELECT account, currency, amount", "currency": "USD", "status": "200_OK"}',
                })
              }
            >
              <div className="w-24 md:w-28 p-2.5 rounded-lg border-2 border-emerald-500 bg-[#081e13] text-center shadow-lg shadow-emerald-950/50">
                <div className="flex items-center justify-between text-[9px] font-mono text-emerald-300 mb-1">
                  <span>#3' REPAIR</span>
                  <span className="font-bold text-white">140ms</span>
                </div>
                <Wrench className="w-4 h-4 text-emerald-400 mx-auto my-1" />
                <p className="text-[10px] font-mono font-bold text-emerald-200 truncate">SQL_EXEC</p>
                <span className="mt-1 inline-block px-1.5 py-0.5 rounded bg-emerald-500 text-black font-mono text-[8px] font-black uppercase">
                  PATCHED
                </span>
              </div>
            </div>

            {/* Resynthesized Node #4 */}
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 z-10 cursor-pointer"
              style={{ left: '76%', top: '50%' }}
            >
              <div className="w-24 md:w-28 p-2.5 rounded-lg border border-emerald-600 bg-[#081e13] text-center">
                <div className="flex items-center justify-between text-[9px] font-mono text-emerald-300 mb-1">
                  <span>#4' CLEAN</span>
                  <span className="font-bold text-white">395ms</span>
                </div>
                <Cpu className="w-4 h-4 text-emerald-400 mx-auto my-1" />
                <p className="text-[10px] font-mono font-bold text-emerald-200 truncate">SYNTHESIZE</p>
                <span className="mt-1 inline-block px-1.5 py-0.5 rounded bg-emerald-900/80 text-emerald-300 font-mono text-[8px]">
                  UNCONTAMINATED
                </span>
              </div>
            </div>

            {/* Final Proven Outcome Node #5 */}
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 z-10 cursor-pointer"
              style={{ left: '93%', top: '50%' }}
            >
              <div className="w-24 md:w-28 p-2.5 rounded-lg border-2 border-emerald-400 bg-emerald-950 text-center ring-2 ring-emerald-500/40 shadow-xl shadow-emerald-950">
                <div className="flex items-center justify-between text-[9px] font-mono text-emerald-300 mb-1">
                  <span>#5' PROVEN</span>
                  <span className="font-bold text-white">18ms</span>
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-300 mx-auto my-1" />
                <p className="text-[10px] font-mono font-bold text-white truncate">EMIT: VERIFIED</p>
                <span className="mt-1 inline-block px-1.5 py-0.5 rounded bg-emerald-400 text-black font-mono text-[8px] font-black uppercase">
                  PASS (100%)
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Cybernetic Live Oscilloscope Signal Waveform Strip */}
      <div className="relative z-10 mt-2 p-3 rounded-lg bg-[#04070d] border border-[#1f2937] overflow-hidden">
        <div className="flex items-center justify-between text-[10px] font-mono mb-2">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-zinc-400 font-bold uppercase">REASONING ENTROPY OSCILLOSCOPE</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-zinc-500">SAMPLE FREQ: 1000Hz</span>
            <span
              className={`font-bold ${
                phase === 'failure'
                  ? 'text-red-400'
                  : phase === 'verified'
                  ? 'text-emerald-400'
                  : 'text-cyan-400'
              }`}
            >
              SIGNAL: {phase === 'failure' ? 'CRITICAL DISTORTION' : phase === 'isolating' ? 'ANOMALY ISOLATED' : 'HARMONIC LOCK'}
            </span>
          </div>
        </div>

        {/* Real-time Dynamic Waveform Animation */}
        <div className="h-10 w-full relative flex items-center overflow-hidden">
          <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 800 60">
            {/* Background Grid Lines */}
            <line x1="0" y1="30" x2="800" y2="30" stroke="#1f2937" strokeDasharray="3 3" />
            <line x1="0" y1="15" x2="800" y2="15" stroke="#111827" strokeDasharray="2 2" />
            <line x1="0" y1="45" x2="800" y2="45" stroke="#111827" strokeDasharray="2 2" />

            {/* Dynamic Signal Path */}
            <motion.path
              d={
                phase === 'failure'
                  ? 'M 0 30 Q 100 25, 200 32 T 400 30 L 460 5 L 480 55 L 500 2 L 530 58 L 560 30 T 800 30'
                  : phase === 'isolating'
                  ? 'M 0 30 Q 150 28, 300 30 T 460 30 L 480 10 L 500 50 L 520 30 T 800 30'
                  : phase === 'replay' || phase === 'verified'
                  ? 'M 0 30 Q 100 12, 200 30 T 400 30 Q 500 10, 600 30 T 800 30'
                  : 'M 0 30 Q 100 15, 200 30 T 400 30 Q 500 15, 600 30 T 800 30'
              }
              fill="none"
              stroke={
                phase === 'failure'
                  ? '#ef4444'
                  : phase === 'verified'
                  ? '#22c55e'
                  : phase === 'isolating'
                  ? '#f59e0b'
                  : '#38bdf8'
              }
              strokeWidth="2"
              transition={{ duration: 0.4 }}
            />
          </svg>
        </div>
      </div>

      {/* Live Telemetry Flight Terminal Console */}
      <div className="relative z-10 mt-3 p-3.5 rounded-lg bg-[#030509] border border-[#1f2937] font-mono text-xs">
        <div className="flex items-center justify-between pb-2 border-b border-[#1f2937]/80 mb-2">
          <div className="flex items-center gap-2 text-zinc-400 text-[10px]">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-bold text-white uppercase tracking-wider">
              TELEMETRY STREAM // RUN CONTEXT DUMP
            </span>
          </div>
          <div className="text-[10px] text-zinc-500 flex items-center gap-3">
            <span>BIT-EXACT FIDELITY: 100%</span>
            <span>OVERHEAD: 0.0ms</span>
          </div>
        </div>

        {/* Dynamic Log Lines for Active Phase */}
        <div className="space-y-1 text-[11px] leading-relaxed">
          {phase === 'normal' && (
            <>
              <p className="text-zinc-400">
                <span className="text-zinc-600">[12:44:02.012]</span> <span className="text-cyan-400">DISPATCH:</span> Task &quot;APAC Q3 settlement schedule&quot; initialized into immutable SQLite shard.
              </p>
              <p className="text-zinc-300">
                <span className="text-zinc-600">[12:44:02.140]</span> <span className="text-purple-400">RETRIEVAL:</span> 4 vector chunks fetched. Schema validated against active database ontology.
              </p>
              <p className="text-emerald-400 font-semibold">
                <span className="text-zinc-600">[12:44:02.482]</span> <span className="text-emerald-400">STATUS:</span> In-loop execution streaming with zero divergence.
              </p>
            </>
          )}

          {phase === 'failure' && (
            <>
              <p className="text-zinc-400">
                <span className="text-zinc-600">[12:44:02.410]</span> Step #2 planner emitted SQL query to analytics warehouse.
              </p>
              <p className="text-red-400 font-bold bg-red-950/40 p-1 rounded border border-red-900/60">
                <span className="text-red-500">[ALARM 12:44:02.700]</span> 💥 STEP #3 TOOL FAILED SILENTLY: Dropped required column &apos;currency&apos;. Downstream memory context tainted!
              </p>
              <p className="text-zinc-400">
                <span className="text-zinc-600">[12:44:03.212]</span> Step #5 crashed with ZeroRevenueThresholdException. Traditional logs only show step 5!
              </p>
            </>
          )}

          {phase === 'isolating' && (
            <>
              <p className="text-zinc-300">
                <span className="text-zinc-600">[12:44:03.340]</span> <span className="text-amber-400">GNN DIAGNOSIS ENGINE:</span> Evaluating DAG topology and 3-tier step-checker alarms...
              </p>
              <p className="text-red-400 font-bold">
                <span className="text-zinc-600">[12:44:03.450]</span> ISOLATED ROOT CAUSE: Step #3 (Tool: SQL_EXEC) with confidence P=0.962 (SHAP: schema_drift +0.48).
              </p>
              <p className="text-amber-300">
                <span className="text-zinc-600">[12:44:03.490]</span> Steps #4 and #5 marked as contaminated symptoms. Target step for counterfactual repair: #3.
              </p>
            </>
          )}

          {phase === 'replay' && (
            <>
              <p className="text-zinc-300">
                <span className="text-zinc-600">[12:44:03.510]</span> <span className="text-cyan-400">COUNTERFACTUAL FORK:</span> Branching new trace directly from Save-point #2.
              </p>
              <p className="text-emerald-400 font-bold">
                <span className="text-zinc-600">[12:44:03.620]</span> REUSING STEPS 0..2: 100% token savings on upstream dependencies (902 tokens saved).
              </p>
              <p className="text-zinc-300">
                <span className="text-zinc-600">[12:44:03.760]</span> Substituting patched SQL validator at Step #3&apos;. Re-executing only downstream dependent nodes...
              </p>
            </>
          )}

          {phase === 'verified' && (
            <>
              <p className="text-emerald-300 font-bold">
                <span className="text-zinc-600">[12:44:03.880]</span> ✅ COUNTERFACTUAL VERIFIED: Repaired run completed with outcome: PASS (0 regressions).
              </p>
              <p className="text-zinc-300">
                <span className="text-zinc-600">[12:44:03.920]</span> PROVEN MATHEMATICAL CAUSALITY: Modifying Step #3 flipped outcome from FAIL to PASS.
              </p>
              <p className="text-cyan-300 font-semibold">
                <span className="text-zinc-600">[12:44:03.960]</span> REGRESSION FIREWALL: Rule &apos;enforce_currency_key&apos; approved across 40 historical shards.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Footer Metrics Readout */}
      <div className="relative z-10 mt-3 pt-3 border-t border-[#1f2937] flex flex-wrap items-center justify-between text-[11px] font-mono text-zinc-400 gap-3">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-zinc-600">STEPS REUSED: </span>
            <span className="text-cyan-400 font-bold">
              {phase === 'verified' || phase === 'replay' ? '3 / 6 (50%)' : '0'}
            </span>
          </div>
          <div>
            <span className="text-zinc-600">TOKENS SAVED: </span>
            <span className="text-emerald-400 font-bold">
              {phase === 'verified' || phase === 'replay' ? '902 TOKENS (82%)' : '—'}
            </span>
          </div>
          <div>
            <span className="text-zinc-600">ISOLATED CAUSE: </span>
            <span className={phase === 'isolating' || phase === 'replay' || phase === 'verified' ? 'text-red-400 font-bold' : 'text-zinc-500'}>
              {phase === 'isolating' || phase === 'replay' || phase === 'verified' ? 'STEP #3 (SQL_EXEC)' : 'MONITORING'}
            </span>
          </div>
        </div>

        <div className="text-[10px] text-zinc-500">
          CLICK ANY NODE TO INSPECT BIT-EXACT SAVE-POINT
        </div>
      </div>

      {/* Interactive Step Detail Drawer Modal */}
      {selectedNode && (
        <div className="absolute inset-x-4 bottom-4 bg-[#080d17]/95 border border-cyan-500/60 rounded-lg p-4 z-30 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-start justify-between">
            <div className="space-y-1.5 font-mono text-xs">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-700 text-cyan-300 font-bold text-[10px]">
                  STEP #{selectedNode.id}
                </span>
                <span className="font-bold text-white">{selectedNode.label}</span>
                <span className="text-zinc-500">
                  {selectedNode.tokens} tokens · {selectedNode.latencyMs}ms
                </span>
              </div>
              <p className="text-zinc-300 font-sans text-xs">{selectedNode.desc}</p>
              <div className="p-2 rounded bg-black/70 border border-zinc-800 text-[10px] text-cyan-400 overflow-x-auto">
                <code>{selectedNode.payload}</code>
              </div>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-zinc-400 hover:text-white text-xs font-mono px-2 py-1 cursor-pointer"
            >
              ✕ CLOSE
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
