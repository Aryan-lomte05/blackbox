import React, { useState, useEffect, useRef } from 'react';
import { Play, RotateCcw, AlertTriangle, CheckCircle2, GitFork, Cpu, Database, Wrench, Sparkles } from 'lucide-react';

type TracePhase = 'normal' | 'failure' | 'isolating' | 'replay' | 'verified';

interface TraceNode {
  id: number;
  label: string;
  kind: 'input' | 'retrieval' | 'llm' | 'tool' | 'final';
  x: number; // percentage
  y: number; // percentage
  tokens: number;
  latencyMs: number;
  desc: string;
}

const NODES: TraceNode[] = [
  { id: 0, label: 'INPUT: TASK', kind: 'input', x: 10, y: 50, tokens: 42, latencyMs: 12, desc: 'User queries agent with complex multi-table analytical request' },
  { id: 1, label: 'RETRIEVAL', kind: 'retrieval', x: 26, y: 50, tokens: 340, latencyMs: 84, desc: 'Vector index fetch for database schemas and business rules' },
  { id: 2, label: 'LLM: PLANNER', kind: 'llm', x: 42, y: 50, tokens: 520, latencyMs: 410, desc: 'Generates SQL execution strategy and parameter mapping' },
  { id: 3, label: 'TOOL: SQL_EXEC', kind: 'tool', x: 58, y: 50, tokens: 180, latencyMs: 290, desc: 'Database query execution against analytics warehouse' },
  { id: 4, label: 'LLM: SYNTHESIZE', kind: 'llm', x: 74, y: 50, tokens: 680, latencyMs: 512, desc: 'Formats numerical output into tabular response' },
  { id: 5, label: 'FINAL: ANSWER', kind: 'final', x: 90, y: 50, tokens: 95, latencyMs: 24, desc: 'Returns final completion payload to caller' },
];

export const HeroTraceVisual: React.FC = () => {
  const [phase, setPhase] = useState<TracePhase>('normal');
  const [selectedNode, setSelectedNode] = useState<TraceNode | null>(null);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [cursorPos, setCursorPos] = useState({ x: 0.5, y: 0.5 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-play narrative progression loop
  useEffect(() => {
    if (!isAutoPlaying) return;

    const sequence: { next: TracePhase; delay: number }[] = [
      { next: 'failure', delay: 3200 },
      { next: 'isolating', delay: 2800 },
      { next: 'replay', delay: 3000 },
      { next: 'verified', delay: 3500 },
      { next: 'normal', delay: 3500 },
    ];

    let currentIdx = 0;
    let timer: NodeJS.Timeout;

    const runNext = () => {
      const step = sequence[currentIdx];
      timer = setTimeout(() => {
        setPhase(step.next);
        currentIdx = (currentIdx + 1) % sequence.length;
        runNext();
      }, step.delay);
    };

    runNext();
    return () => clearTimeout(timer);
  }, [isAutoPlaying]);

  // Cursor reactivity
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setCursorPos({ x, y });
  };

  const getKindColor = (kind: string) => {
    switch (kind) {
      case 'tool':
        return '#f97316';
      case 'llm':
        return '#38bdf8';
      case 'retrieval':
        return '#a855f7';
      case 'final':
        return '#22c55e';
      default:
        return '#6b7280';
    }
  };

  const getNodeState = (node: TraceNode) => {
    if (phase === 'normal') {
      return { status: 'healthy', color: '#38bdf8', bg: '#0b1626' };
    }
    if (phase === 'failure') {
      if (node.id === 3) return { status: 'failed', color: '#ef4444', bg: '#2a0f12' };
      if (node.id > 3) return { status: 'aborted', color: '#4b5563', bg: '#111827' };
      return { status: 'healthy', color: '#38bdf8', bg: '#0b1626' };
    }
    if (phase === 'isolating') {
      if (node.id === 3) return { status: 'guilty', color: '#ef4444', bg: '#2a0f12' };
      if (node.id > 3) return { status: 'contaminated', color: '#f59e0b', bg: '#2a1f05' };
      return { status: 'reusable', color: '#38bdf8', bg: '#0b1626' };
    }
    if (phase === 'replay' || phase === 'verified') {
      if (node.id < 3) return { status: 'reused', color: '#38bdf8', bg: '#0b1626' };
      if (node.id === 3) return { status: 'repaired', color: '#22c55e', bg: '#0b2416' };
      return { status: 'verified', color: '#22c55e', bg: '#0b2416' };
    }
    return { status: 'healthy', color: '#38bdf8', bg: '#0b1626' };
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative w-full max-w-5xl mx-auto rounded-lg bg-[#070a10] border border-[#1f2937] shadow-2xl p-6 font-sans select-none overflow-hidden group"
    >
      {/* Background Hairline Grid Rail */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293715_1px,transparent_1px),linear-gradient(to_bottom,#1f293715_1px,transparent_1px)] bg-[size:28px_28px] pointer-events-none" />

      {/* Subtle cursor proximity ambient glow */}
      <div
        className="absolute w-72 h-72 rounded-full pointer-events-none transition-all duration-300 -translate-x-1/2 -translate-y-1/2 opacity-20 blur-3xl"
        style={{
          left: `${cursorPos.x * 100}%`,
          top: `${cursorPos.y * 100}%`,
          background: phase === 'isolating' || phase === 'failure' ? '#ef4444' : '#38bdf8',
        }}
      />

      {/* Top Telemetry Header Bar */}
      <div className="relative z-10 flex flex-wrap items-center justify-between pb-4 border-b border-[#1f2937] text-xs font-mono text-zinc-400 gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full transition-colors ${
                phase === 'failure' || phase === 'isolating'
                  ? 'bg-red-500 animate-pulse'
                  : phase === 'verified'
                  ? 'bg-emerald-400'
                  : 'bg-cyan-400 animate-pulse'
              }`}
            />
            <span className="text-white font-semibold tracking-wider text-[11px] uppercase">
              TRACE INSPECTOR // LIVE SIGNAL
            </span>
          </div>
          <span className="text-zinc-600">|</span>
          <span className="text-[11px] text-zinc-400">
            PHASE:{' '}
            <span
              className={`font-semibold uppercase ${
                phase === 'isolating'
                  ? 'text-red-400'
                  : phase === 'verified'
                  ? 'text-emerald-400'
                  : phase === 'replay'
                  ? 'text-cyan-400'
                  : 'text-zinc-200'
              }`}
            >
              {phase === 'normal' && '01 // EXECUTION TRACE STREAMING'}
              {phase === 'failure' && '02 // TOOL CRASH AT STEP 3'}
              {phase === 'isolating' && '03 // CAUSAL ATTRIBUTION: GUILTY ISOLATED'}
              {phase === 'replay' && '04 // COUNTERFACTUAL FORK BRANCHING'}
              {phase === 'verified' && '05 // COUNTERFACTUAL REPAIR PROVEN'}
            </span>
          </span>
        </div>

        {/* Phase Timeline Buttons */}
        <div className="flex items-center gap-1 bg-[#0b0f17] p-1 rounded border border-[#1f2937]">
          <button
            onClick={() => {
              setIsAutoPlaying(false);
              setPhase('normal');
            }}
            className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono transition-colors ${
              phase === 'normal' ? 'bg-zinc-800 text-cyan-300 font-bold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Run
          </button>
          <button
            onClick={() => {
              setIsAutoPlaying(false);
              setPhase('failure');
            }}
            className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono transition-colors ${
              phase === 'failure' ? 'bg-red-950 text-red-300 font-bold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Fail
          </button>
          <button
            onClick={() => {
              setIsAutoPlaying(false);
              setPhase('isolating');
            }}
            className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono transition-colors ${
              phase === 'isolating' ? 'bg-red-900 text-red-200 font-bold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Diagnose
          </button>
          <button
            onClick={() => {
              setIsAutoPlaying(false);
              setPhase('replay');
            }}
            className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono transition-colors ${
              phase === 'replay' ? 'bg-cyan-950 text-cyan-300 font-bold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Fork
          </button>
          <button
            onClick={() => {
              setIsAutoPlaying(false);
              setPhase('verified');
            }}
            className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono transition-colors ${
              phase === 'verified' ? 'bg-emerald-950 text-emerald-300 font-bold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Verify
          </button>

          <button
            onClick={() => setIsAutoPlaying(!isAutoPlaying)}
            title={isAutoPlaying ? 'Pause loop' : 'Auto-play narrative'}
            className="ml-1 p-1 text-zinc-400 hover:text-white transition-colors"
          >
            {isAutoPlaying ? <RotateCcw className="w-3 h-3 text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} /> : <Play className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Execution Visual Stage Canvas */}
      <div className="overflow-x-auto overflow-y-hidden pb-4 pt-2 -mx-2 px-2">
        <div className="relative h-64 md:h-72 my-2 flex items-center justify-center min-w-[700px] md:min-w-0 w-full">
          {/* SVG Interconnecting Edges */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {/* Main Execution Path Edges */}
          {NODES.slice(0, -1).map((node, i) => {
            const nextNode = NODES[i + 1];
            const isContaminated = (phase === 'isolating' || phase === 'failure') && i >= 3;
            const isBroken = phase === 'failure' && i === 2;
            const isReused = (phase === 'replay' || phase === 'verified') && i < 2;

            return (
              <g key={`edge-${node.id}-${nextNode.id}`}>
                <line
                  x1={`${node.x}%`}
                  y1={`${node.y}%`}
                  x2={`${nextNode.x}%`}
                  y2={`${nextNode.y}%`}
                  stroke={
                    isBroken
                      ? '#ef4444'
                      : isContaminated
                      ? '#f59e0b'
                      : isReused
                      ? '#38bdf8'
                      : '#374151'
                  }
                  strokeWidth={isBroken || isContaminated ? '2' : '1.5'}
                  strokeDasharray={isBroken ? '4 4' : undefined}
                  className={isContaminated || isBroken ? 'animate-pulse' : ''}
                />
              </g>
            );
          })}

          {/* Fork Replay Branch (shown during replay and verified) */}
          {(phase === 'replay' || phase === 'verified') && (
            <g className="animate-in fade-in duration-500">
              {/* Curve from Node 2 (Planner) down into Replay Lane */}
              <path
                d="M 42% 50% Q 50% 82%, 58% 82%"
                fill="none"
                stroke="#22c55e"
                strokeWidth="2"
                strokeDasharray="4 4"
                className="animate-dash-flow"
              />
              <line
                x1="58%"
                y1="82%"
                x2="74%"
                y2="82%"
                stroke="#22c55e"
                strokeWidth="2"
              />
              <line
                x1="74%"
                y1="82%"
                x2="90%"
                y2="82%"
                stroke="#22c55e"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>

        {/* Primary Row Trace Nodes */}
        {NODES.map((node) => {
          const state = getNodeState(node);
          const isGuilty = phase === 'isolating' && node.id === 3;
          const isContaminated = phase === 'isolating' && node.id > 3;

          return (
            <div
              key={node.id}
              onClick={() => setSelectedNode(node)}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300 group/node"
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
            >
              {/* Outer pulsing ring for guilty node */}
              {isGuilty && (
                <div className="absolute -inset-2.5 rounded-full border border-red-500 animate-ping opacity-75" />
              )}

              {/* Node Card Container */}
              <div
                className={`relative w-20 md:w-24 p-2 rounded border transition-all text-center ${
                  isGuilty
                    ? 'border-red-500 bg-red-950/80 shadow-lg shadow-red-900/40 ring-1 ring-red-400'
                    : isContaminated
                    ? 'border-amber-600 bg-amber-950/40'
                    : 'border-[#1f2937] hover:border-zinc-500 bg-[#0b0f17]'
                }`}
              >
                {/* Kind indicator icon */}
                <div className="flex items-center justify-center mb-1 text-zinc-400 group-hover/node:text-white transition-colors">
                  {node.kind === 'tool' && <Wrench className="w-3.5 h-3.5" style={{ color: isGuilty ? '#ef4444' : getKindColor('tool') }} />}
                  {node.kind === 'llm' && <Cpu className="w-3.5 h-3.5 text-cyan-400" />}
                  {node.kind === 'retrieval' && <Database className="w-3.5 h-3.5 text-purple-400" />}
                  {node.kind === 'final' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  {node.kind === 'input' && <Sparkles className="w-3.5 h-3.5 text-zinc-400" />}
                </div>

                <p className="text-[10px] font-mono font-bold tracking-tight text-zinc-200 truncate">
                  {node.label}
                </p>

                <p className="text-[9px] font-mono text-zinc-500 mt-0.5">
                  #{node.id} · {node.latencyMs}ms
                </p>

                {/* Status Badge */}
                {isGuilty && (
                  <span className="mt-1 inline-block px-1 py-0.2 rounded bg-red-600 text-white font-mono text-[8px] font-bold tracking-widest uppercase">
                    GUILTY
                  </span>
                )}
                {isContaminated && (
                  <span className="mt-1 inline-block px-1 py-0.2 rounded bg-amber-600/30 text-amber-300 font-mono text-[8px] tracking-wider uppercase">
                    TRAIL
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* Counterfactual Replay Fork Nodes (Shown on Replay & Verified) */}
        {(phase === 'replay' || phase === 'verified') && (
          <>
            {/* Fork Origin Tag */}
            <div className="absolute left-[48%] top-[66%] -translate-x-1/2 text-[9px] font-mono text-emerald-400 flex items-center gap-1 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800">
              <GitFork className="w-2.5 h-2.5" /> FORK AT STEP 2
            </div>

            {/* Replay Node 3 (Repaired Tool) */}
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300"
              style={{ left: '58%', top: '82%' }}
              onClick={() =>
                setSelectedNode({
                  id: 3,
                  label: 'TOOL: REPAIRED',
                  kind: 'tool',
                  x: 58,
                  y: 82,
                  tokens: 185,
                  latencyMs: 142,
                  desc: 'Patched SQL syntax hallucination applied. Executed cleanly with 0 exceptions.',
                })
              }
            >
              <div className="w-20 md:w-24 p-2 rounded border border-emerald-500/80 bg-emerald-950/70 text-center shadow-lg shadow-emerald-950/40">
                <Wrench className="w-3.5 h-3.5 text-emerald-400 mx-auto mb-1" />
                <p className="text-[10px] font-mono font-bold text-emerald-200 truncate">TOOL: REPAIRED</p>
                <p className="text-[9px] font-mono text-emerald-400/80">#3' · 142ms</p>
                <span className="mt-1 inline-block px-1 py-0.2 rounded bg-emerald-500 text-black font-mono text-[8px] font-bold">
                  REPLACED
                </span>
              </div>
            </div>

            {/* Replay Node 4 (Resynthesized LLM) */}
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300"
              style={{ left: '74%', top: '82%' }}
            >
              <div className="w-20 md:w-24 p-2 rounded border border-emerald-500/80 bg-emerald-950/70 text-center">
                <Cpu className="w-3.5 h-3.5 text-emerald-400 mx-auto mb-1" />
                <p className="text-[10px] font-mono font-bold text-emerald-200 truncate">LLM: VERIFIED</p>
                <p className="text-[9px] font-mono text-emerald-400/80">#4' · 380ms</p>
                <span className="mt-1 inline-block px-1 py-0.2 rounded bg-emerald-900 text-emerald-300 font-mono text-[8px]">
                  NEW PATH
                </span>
              </div>
            </div>

            {/* Replay Node 5 (Final Verified Outcome) */}
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300"
              style={{ left: '90%', top: '82%' }}
            >
              <div className="w-20 md:w-24 p-2 rounded border border-emerald-400 bg-emerald-900/60 text-center ring-1 ring-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300 mx-auto mb-1" />
                <p className="text-[10px] font-mono font-bold text-white truncate">FINAL: PASS</p>
                <p className="text-[9px] font-mono text-emerald-300">#5' · OK</p>
                <span className="mt-1 inline-block px-1 py-0.2 rounded bg-emerald-400 text-black font-mono text-[8px] font-bold">
                  PROVEN
                </span>
              </div>
            </div>
          </>
        )}
        </div>
      </div>

      {/* Bottom Forensic Readout Strip */}
      <div className="relative z-10 pt-3 border-t border-[#1f2937] flex flex-wrap items-center justify-between text-xs font-mono text-zinc-400 gap-4">
        <div className="flex items-center gap-4 text-[11px]">
          <div>
            <span className="text-zinc-600">STEPS REUSED: </span>
            <span className="text-cyan-400 font-bold">
              {phase === 'verified' || phase === 'replay' ? '3 / 6 (50%)' : '0'}
            </span>
          </div>
          <div>
            <span className="text-zinc-600">TOKENS SAVED: </span>
            <span className="text-emerald-400 font-bold">
              {phase === 'verified' || phase === 'replay' ? '902 TOKENS (62%)' : '—'}
            </span>
          </div>
          <div>
            <span className="text-zinc-600">ATTRIBUTION: </span>
            <span className="text-red-400 font-bold">
              {phase === 'isolating' || phase === 'replay' || phase === 'verified' ? 'STEP 3 (P=0.96)' : 'MONITORING'}
            </span>
          </div>
        </div>

        <div className="text-[10px] text-zinc-500">
          CLICK ANY NODE TO INSPECT EXECUTION SAVE-POINT
        </div>
      </div>

      {/* Modal Inspector Drawer for Clicked Node */}
      {selectedNode && (
        <div className="absolute inset-x-6 bottom-4 bg-[#0b0f17]/95 border border-zinc-700 rounded p-4 z-20 animate-in fade-in slide-in-from-bottom-2 backdrop-blur-md">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200 text-[10px] font-mono uppercase">
                  STEP #{selectedNode.id}
                </span>
                <span className="text-xs font-bold text-white font-mono">{selectedNode.label}</span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {selectedNode.tokens} tokens · {selectedNode.latencyMs}ms
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-sans max-w-xl">{selectedNode.desc}</p>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-zinc-400 hover:text-white text-xs font-mono px-2 py-1"
            >
              ✕ CLOSE
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
