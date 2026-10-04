import React, { useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  Terminal,
  ShieldAlert,
  GitFork,
  Crosshair,
  ShieldCheck,
  CheckCircle2,
  Layers,
  Activity,
  Cpu,
  Database,
  Lock,
  ExternalLink,
  Code2,
  FileCode,
  AlertTriangle,
  Play,
  RotateCcw,
} from 'lucide-react';

interface MasterNarrativeOverlayProps {
  progress: number; // 0.0 to 1.0
  onOpenAuth: () => void;
  onExploreClick: () => void;
  isAuthenticated: boolean;
}

function getRangeOpacity(p: number, start: number, peakStart: number, peakEnd: number, end: number): number {
  if (p < start || p > end) return 0;
  if (p < peakStart) return (p - start) / (peakStart - start);
  if (p <= peakEnd) return 1;
  return 1 - (p - peakEnd) / (end - peakEnd);
}

function getRangeY(p: number, start: number, end: number): number {
  const t = Math.max(0, Math.min(1, (p - start) / (end - start)));
  return (1 - t) * 16 - 8;
}

export const MasterNarrativeOverlay: React.FC<MasterNarrativeOverlayProps> = ({
  progress,
  onOpenAuth,
  onExploreClick,
  isAuthenticated,
}) => {
  const p = Math.max(0, Math.min(1, progress));

  // Opacities for the 7 key scenes mapped to the reference
  const op1 = getRangeOpacity(p, 0.00, 0.00, 0.08, 0.12);
  const op2 = getRangeOpacity(p, 0.11, 0.14, 0.24, 0.27);
  const op4 = getRangeOpacity(p, 0.26, 0.30, 0.48, 0.52);
  const op5 = getRangeOpacity(p, 0.51, 0.55, 0.63, 0.67);
  const op6 = getRangeOpacity(p, 0.66, 0.69, 0.77, 0.80);
  const op7 = getRangeOpacity(p, 0.79, 0.82, 0.88, 0.91);
  const op8 = getRangeOpacity(p, 0.90, 0.93, 1.00, 1.00);

  // Local state for tabs
  const [act2Tab, setAct2Tab] = useState<'request' | 'output' | 'metadata'>('request');
  const [act4Tab, setAct4Tab] = useState<'request' | 'output' | 'sources' | 'checker'>('request');
  const [atlasFilter, setAtlasFilter] = useState<'All' | 'QA' | 'Math' | 'Shop' | 'Travel'>('All');

  return (
    <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-6 sm:p-10 md:p-14 font-sans overflow-hidden">
      {/* =========================================================================
          SCREEN 1: 01 / 08 THE TRACE (Hero with Isometric Black Box)
          ========================================================================= */}
      {op1 > 0.01 && (
        <div
          style={{ opacity: op1, transform: `translateY(${getRangeY(p, 0, 0.12)}px)` }}
          className="absolute inset-x-6 sm:inset-x-12 top-20 md:top-24 flex flex-col justify-between max-w-7xl mx-auto h-[calc(100vh-140px)] transition-opacity duration-75"
        >
          {/* Left Column Text & CTAs */}
          <div className="max-w-xl text-left pt-6">
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-white uppercase leading-[1.02] mb-3">
              AI AGENT <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-200 to-cyan-400">
                FLIGHT RECORDER
              </span>
            </h1>

            <p className="text-sm sm:text-base font-mono tracking-wider text-zinc-300 font-semibold mb-4">
              Record the run. Find the cause. Prove the fix.
            </p>

            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed mb-8 max-w-lg">
              When autonomous agents loop, drop schemas, or hallucinate tool parameters, traditional logs
              show you the crash—not the silent mutation four hops earlier. Black Box captures the immutable
              execution DAG, isolates root causes, and verifies fixes with counterfactual replay.
            </p>

            <div className="flex flex-wrap items-center gap-4 pointer-events-auto">
              <button
                onClick={onOpenAuth}
                className="px-6 py-3 rounded-full bg-white hover:bg-zinc-200 text-black font-semibold text-xs font-mono tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(56,189,248,0.25)] active:scale-[0.98]"
              >
                <span>{isAuthenticated ? 'OPEN DASHBOARD' : 'OPEN BLACK BOX'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={onExploreClick}
                className="px-5 py-3 rounded-full bg-[#0b101b] hover:bg-[#111827] text-zinc-300 hover:text-white border border-[#1f2937] text-xs font-mono tracking-wider transition-all flex items-center gap-2 cursor-pointer active:scale-[0.98]"
              >
                <span>WATCH THE TRACE</span>
                <ChevronDown className="w-3.5 h-3.5 text-cyan-400 animate-bounce" />
              </button>
            </div>
          </div>

          {/* Bottom 4-Column Specification Strip from Reference */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-6 border-t border-[#1f2937]/50 w-full text-left">
            <div>
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">RECORDING PROTOCOL</p>
              <p className="text-xs font-mono text-zinc-300 font-semibold mt-1">RFC-9122 DAG STREAM</p>
            </div>
            <div>
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">INSPECTION LATENCY</p>
              <p className="text-xs font-mono text-cyan-400 font-semibold mt-1">&lt; 0.4MS / STEP</p>
            </div>
            <div>
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">ISOLATION ENGINE</p>
              <p className="text-xs font-mono text-zinc-300 font-semibold mt-1">SHAPLEY CAUSALITY</p>
            </div>
            <div>
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">REPLAY VERIFICATION</p>
              <p className="text-xs font-mono text-emerald-400 font-semibold mt-1">COUNTERFACTUAL FORK</p>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SCREEN 2: 02 / 08 THE RUN (Real-Time Execution & Split Telemetry)
          ========================================================================= */}
      {op2 > 0.01 && (
        <div
          style={{ opacity: op2, transform: `translateY(${getRangeY(p, 0.11, 0.27)}px)` }}
          className="absolute inset-x-6 sm:inset-x-12 top-20 md:top-24 flex flex-col justify-between max-w-7xl mx-auto h-[calc(100vh-140px)] transition-opacity duration-75"
        >
          {/* Top Headline & Description */}
          <div className="max-w-xl text-left">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight uppercase leading-snug mb-2">
              IMMUTABLE EXECUTION <br />
              <span className="text-cyan-400 font-mono">IN REAL TIME</span>
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-lg">
              Every prompt, tool payload, memory state, and schema boundary is captured into a
              deterministic, queryable directed acyclic graph (DAG).
            </p>
          </div>

          {/* Bottom Split Telemetry Panels from Reference Image */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 pointer-events-auto">
            {/* Left Panel: STEP 03 // RETRIEVAL */}
            <div className="p-4 rounded-lg bg-[#080d16]/95 border border-[#1f2937] font-mono text-xs backdrop-blur-md shadow-lg">
              <div className="flex items-center justify-between pb-2.5 border-b border-[#1f2937]/70 text-[11px]">
                <span className="text-cyan-400 font-bold uppercase tracking-wider">STEP 03 // RETRIEVAL</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setAct2Tab('request')}
                    className={`cursor-pointer transition-colors ${
                      act2Tab === 'request' ? 'text-white border-b-2 border-cyan-400 pb-0.5' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Request
                  </button>
                  <button
                    onClick={() => setAct2Tab('output')}
                    className={`cursor-pointer transition-colors ${
                      act2Tab === 'output' ? 'text-white border-b-2 border-cyan-400 pb-0.5' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Output
                  </button>
                  <button
                    onClick={() => setAct2Tab('metadata')}
                    className={`cursor-pointer transition-colors ${
                      act2Tab === 'metadata' ? 'text-white border-b-2 border-cyan-400 pb-0.5' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Metadata
                  </button>
                </div>
              </div>

              <div className="pt-3 text-[11px] leading-relaxed text-zinc-300 font-mono overflow-x-auto">
                <span className="text-zinc-500">&#123;</span><br />
                &nbsp;&nbsp;<span className="text-cyan-400">&quot;query&quot;</span>: <span className="text-amber-300">&quot;best time to visit maharashtra in june&quot;</span>,<br />
                &nbsp;&nbsp;<span className="text-cyan-400">&quot;top_k&quot;</span>: <span className="text-emerald-400">5</span>,<br />
                &nbsp;&nbsp;<span className="text-cyan-400">&quot;sources&quot;</span>: <span className="text-zinc-400">[&quot;...&quot;]</span><br />
                <span className="text-zinc-500">&#125;</span>
              </div>
            </div>

            {/* Right Panel: EXECUTION STREAM */}
            <div className="p-4 rounded-lg bg-[#0d0709]/95 border border-rose-900/40 font-mono text-xs backdrop-blur-md shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2.5 border-b border-rose-900/30 text-[11px]">
                  <span className="text-zinc-400 font-bold uppercase tracking-wider">EXECUTION STREAM</span>
                  <span className="text-rose-500 font-semibold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                    LIVE ERROR DETECTED
                  </span>
                </div>

                <div className="pt-3 space-y-2 text-[11px]">
                  <div className="flex items-center gap-2 text-zinc-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                    <span>Step 06 - State Update</span>
                  </div>
                  <div className="flex items-center gap-2 text-rose-400 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    <span>NullPointerException</span>
                  </div>
                  <p className="text-zinc-400 pl-3.5 text-[10px] leading-relaxed">
                    Cannot read properties of undefined (reading &apos;currency&apos;)
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-rose-900/20 flex justify-end">
                <button
                  onClick={onOpenAuth}
                  className="text-cyan-400 hover:text-cyan-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>View Stack Trace</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SCREEN 3: 04 / 08 THE CAUSE (Mathematical Causal Isolation)
          ========================================================================= */}
      {op4 > 0.01 && (
        <div
          style={{ opacity: op4, transform: `translateY(${getRangeY(p, 0.26, 0.52)}px)` }}
          className="absolute inset-x-6 sm:inset-x-12 top-20 md:top-24 flex flex-col justify-between max-w-7xl mx-auto h-[calc(100vh-140px)] transition-opacity duration-75"
        >
          {/* Top Row: Headline Left, Stats HUD Right */}
          <div className="flex flex-col md:flex-row items-start justify-between gap-6">
            <div className="max-w-xl text-left">
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight uppercase leading-snug mb-2">
                MATHEMATICAL <br />
                <span className="text-amber-400 font-mono">CAUSAL ISOLATION</span>
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-lg">
                The HUD reticle isolates Step 04. Counterfactual graph subtraction mathematically proves
                Step 04 was both necessary to produce this currency drop and sufficient to produce the failure.
              </p>
            </div>

            {/* Right HUD Metrics Strip from Reference Image */}
            <div className="w-full md:w-72 p-3.5 rounded-lg bg-[#0e070c]/90 border border-amber-900/60 font-mono text-xs space-y-1.5 backdrop-blur-md">
              <div className="flex items-center justify-between text-[11px] pb-1.5 border-b border-amber-900/40">
                <span className="text-zinc-400 uppercase">NECESSARY</span>
                <span className="text-emerald-400 font-bold">Verified (100%)</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400 uppercase">SUFFICIENT</span>
                <span className="text-emerald-400 font-bold">Verified (99.8%)</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400 uppercase">BLAST RADIUS</span>
                <span className="text-amber-400 font-bold">3 downstream nodes</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400 uppercase">CONTAMINATION</span>
                <span className="text-rose-400 font-bold">Propagates -&gt; #05, #06</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400 uppercase">ROOT SYMPTOM</span>
                <span className="text-zinc-300">NullPointer exception</span>
              </div>
            </div>
          </div>

          {/* Bottom Panel: EVIDENCE from Reference Image */}
          <div className="w-full max-w-xl p-4 rounded-lg bg-[#080d16]/95 border border-[#1f2937] font-mono text-xs backdrop-blur-md shadow-lg pointer-events-auto">
            <div className="flex items-center justify-between pb-2 border-b border-[#1f2937]/70 text-[11px]">
              <span className="text-zinc-400 font-bold uppercase tracking-wider">EVIDENCE</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setAct4Tab('request')}
                  className={`cursor-pointer transition-colors ${
                    act4Tab === 'request' ? 'text-white border-b-2 border-amber-400 pb-0.5' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Request
                </button>
                <button
                  onClick={() => setAct4Tab('output')}
                  className={`cursor-pointer transition-colors ${
                    act4Tab === 'output' ? 'text-white border-b-2 border-amber-400 pb-0.5' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Output
                </button>
                <button
                  onClick={() => setAct4Tab('sources')}
                  className={`cursor-pointer transition-colors ${
                    act4Tab === 'sources' ? 'text-white border-b-2 border-amber-400 pb-0.5' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Sources
                </button>
                <button
                  onClick={() => setAct4Tab('checker')}
                  className={`cursor-pointer transition-colors ${
                    act4Tab === 'checker' ? 'text-white border-b-2 border-amber-400 pb-0.5' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Checker
                </button>
              </div>
            </div>

            <div className="pt-2.5 text-[11px] leading-relaxed text-zinc-300 font-mono">
              <span className="text-zinc-500">&#123;</span><br />
              &nbsp;&nbsp;<span className="text-cyan-400">&quot;query&quot;</span>: <span className="text-amber-300">&quot;best time to visit maharashtra in june&quot;</span>,<br />
              &nbsp;&nbsp;<span className="text-cyan-400">&quot;top_k&quot;</span>: <span className="text-emerald-400">5</span>,<br />
              &nbsp;&nbsp;<span className="text-cyan-400">&quot;sources&quot;</span>: <span className="text-zinc-400">[&quot;...&quot;]</span><br />
              <span className="text-zinc-500">&#125;</span>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SCREEN 4: 05 / 08 THE PROOF (Counterfactual Fork & Replay Verification)
          ========================================================================= */}
      {op5 > 0.01 && (
        <div
          style={{ opacity: op5, transform: `translateY(${getRangeY(p, 0.51, 0.67)}px)` }}
          className="absolute inset-x-6 sm:inset-x-12 top-20 md:top-24 flex flex-col justify-between max-w-7xl mx-auto h-[calc(100vh-140px)] transition-opacity duration-75"
        >
          {/* Top Headline & Description */}
          <div className="max-w-xl text-left">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight uppercase leading-snug mb-2">
              COUNTERFACTUAL FORK <br />
              <span className="text-emerald-400 font-mono">&amp; VERIFICATION</span>
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-lg">
              The timeline rewinds to a save-point. Step 04 is patched with a verified schema validation.
              Only the contaminated downstream nodes are re-executed.
            </p>
          </div>

          {/* Center Two-Column Execution Comparison from Reference */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 my-auto max-w-3xl mx-auto w-full">
            {/* Left: ORIGINAL RUN (FAILED) */}
            <div className="p-4 rounded-lg bg-[#0e0709]/90 border border-rose-900/60 font-mono text-xs backdrop-blur-md">
              <div className="flex items-center justify-between pb-3 border-b border-rose-900/40">
                <span className="text-zinc-400 font-bold uppercase tracking-wider">ORIGINAL RUN</span>
                <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-500/50 text-[10px] font-bold">
                  FAILED
                </span>
              </div>
              <ul className="pt-3 space-y-2.5 text-[11px] text-zinc-400">
                <li className="flex items-center gap-3">
                  <span className="text-zinc-600">01</span>
                  <span>Input</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-zinc-600">02</span>
                  <span>LLM</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-zinc-600">03</span>
                  <span>Retrieval</span>
                </li>
                <li className="flex items-center gap-3 text-rose-400 font-bold">
                  <span className="w-5 h-5 rounded-full bg-rose-500/20 border border-rose-500 flex items-center justify-center text-[10px]">
                    04
                  </span>
                  <span>Search</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-zinc-600">05</span>
                  <span>LLM</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-zinc-600">06</span>
                  <span>State</span>
                </li>
              </ul>
            </div>

            {/* Right: REPLAY RUN (VERIFIED) */}
            <div className="p-4 rounded-lg bg-[#06120e]/90 border border-emerald-900/60 font-mono text-xs backdrop-blur-md">
              <div className="flex items-center justify-between pb-3 border-b border-emerald-900/40">
                <span className="text-zinc-400 font-bold uppercase tracking-wider">REPLAY RUN</span>
                <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/50 text-[10px] font-bold">
                  VERIFIED
                </span>
              </div>
              <ul className="pt-3 space-y-2.5 text-[11px]">
                <li className="flex items-center justify-between text-zinc-500">
                  <div className="flex items-center gap-3">
                    <span>01</span>
                    <span>Input</span>
                  </div>
                  <span className="text-[10px]">[reused]</span>
                </li>
                <li className="flex items-center justify-between text-zinc-500">
                  <div className="flex items-center gap-3">
                    <span>02</span>
                    <span>LLM</span>
                  </div>
                  <span className="text-[10px]">[reused]</span>
                </li>
                <li className="flex items-center justify-between text-zinc-500">
                  <div className="flex items-center gap-3">
                    <span>03</span>
                    <span>Retrieval</span>
                  </div>
                  <span className="text-[10px]">[reused]</span>
                </li>
                <li className="flex items-center justify-between text-emerald-400 font-bold">
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-[10px]">
                      04
                    </span>
                    <span>Search</span>
                  </div>
                  <span className="text-[10px] text-emerald-300 font-semibold">[patched]</span>
                </li>
                <li className="flex items-center justify-between text-zinc-300">
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-500">05</span>
                    <span>LLM</span>
                  </div>
                  <span className="text-[10px] text-zinc-500">[executed]</span>
                </li>
                <li className="flex items-center justify-between text-zinc-300">
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-500">06</span>
                    <span>State</span>
                  </div>
                  <span className="text-[10px] text-zinc-500">[executed]</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar: REPLAY EFFICIENCY & STATS from Reference */}
          <div className="p-4 rounded-lg bg-[#070b12]/90 border border-[#1f2937] font-mono text-xs backdrop-blur-md">
            <div className="flex items-center justify-between text-[11px] pb-2 text-zinc-400">
              <span className="font-bold uppercase tracking-wider">REPLAY EFFICIENCY</span>
              <div className="flex items-center gap-4 text-[10px]">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded bg-cyan-400" />
                  Executed (3)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded bg-zinc-600" />
                  Reused (9)
                </span>
              </div>
            </div>

            {/* Segmented Efficiency Progress Bar */}
            <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden flex my-2">
              <div className="h-full bg-cyan-400 w-1/4" />
              <div className="h-full bg-zinc-600 w-3/4" />
            </div>

            {/* 6 High-Impact Metrics */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 pt-2 text-center text-[10px]">
              <div>
                <p className="text-sm font-bold text-white">12</p>
                <p className="text-zinc-500">total steps</p>
              </div>
              <div>
                <p className="text-sm font-bold text-white">3</p>
                <p className="text-zinc-500">executed</p>
              </div>
              <div>
                <p className="text-sm font-bold text-white">9</p>
                <p className="text-zinc-500">reused</p>
              </div>
              <div>
                <p className="text-sm font-bold text-white">0</p>
                <p className="text-zinc-500">model calls</p>
              </div>
              <div>
                <p className="text-sm font-bold text-cyan-400">82%</p>
                <p className="text-zinc-500">tokens saved</p>
              </div>
              <div>
                <p className="text-sm font-bold text-cyan-400">1.4s</p>
                <p className="text-zinc-500">time saved</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SCREEN 5: 06 / 08 THE PATTERN (Fleet Failure Atlas & Insights)
          ========================================================================= */}
      {op6 > 0.01 && (
        <div
          style={{ opacity: op6, transform: `translateY(${getRangeY(p, 0.66, 0.80)}px)` }}
          className="absolute inset-x-6 sm:inset-x-12 top-20 md:top-24 flex flex-col justify-between max-w-7xl mx-auto h-[calc(100vh-140px)] transition-opacity duration-75"
        >
          {/* Top Filter Category Pills from Reference */}
          <div className="flex items-center justify-end gap-2 pointer-events-auto">
            {(['All', 'QA', 'Math', 'Shop', 'Travel'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setAtlasFilter(tab)}
                className={`px-3 py-1 rounded text-[11px] font-mono transition-all cursor-pointer ${
                  atlasFilter === tab
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-400/50 font-bold'
                    : 'bg-[#090d16] text-zinc-500 hover:text-zinc-300 border border-[#1f2937]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Headline & Description */}
          <div className="max-w-xl text-left pt-2">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight uppercase leading-snug mb-2">
              FLEET <br />
              <span className="text-cyan-400 font-mono">FAILURE ATLAS</span>
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-lg">
              One failure is an incident. Ten failures are a systemic pattern. Black Box groups topological
              execution traces into semantic fingerprints across 10,000+ agent runs. Never debug the same root cause twice.
            </p>
          </div>

          {/* Bottom Dual Panels from Reference Image */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 pointer-events-auto">
            {/* Left Panel: TOP FINGERPRINTS */}
            <div className="p-4 rounded-lg bg-[#080d16]/95 border border-[#1f2937] font-mono text-xs backdrop-blur-md">
              <p className="text-[11px] font-bold uppercase text-zinc-400 pb-2 border-b border-[#1f2937]/70">
                TOP FINGERPRINTS
              </p>
              <ul className="pt-3 space-y-2.5 text-[11px]">
                <li className="flex items-center justify-between text-zinc-300">
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-400 font-bold">01</span>
                    <span>Search contamination</span>
                  </div>
                  <span className="text-zinc-400">43 runs - 12.7%</span>
                </li>
                <li className="flex items-center justify-between text-zinc-300">
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-400 font-bold">02</span>
                    <span>Calculator error</span>
                  </div>
                  <span className="text-zinc-400">31 runs - 9.1%</span>
                </li>
                <li className="flex items-center justify-between text-zinc-300">
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-400 font-bold">03</span>
                    <span>Retrieval mismatch</span>
                  </div>
                  <span className="text-zinc-400">26 runs - 7.6%</span>
                </li>
              </ul>
            </div>

            {/* Right Panel: RECOVERY INSIGHTS */}
            <div className="p-4 rounded-lg bg-[#080d16]/95 border border-[#1f2937] font-mono text-xs backdrop-blur-md flex flex-col justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase text-zinc-400 pb-2 border-b border-[#1f2937]/70">
                  RECOVERY INSIGHTS
                </p>
                <ul className="pt-3 space-y-2 text-[11px] text-zinc-300">
                  <li className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Fixing source attribution resolves 87%</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                    <span>Add schema validator to search tools</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                    <span>Use deterministic extraction for entities</span>
                  </li>
                </ul>
              </div>

              <div className="pt-3 border-t border-[#1f2937]/50 flex justify-end">
                <button
                  onClick={onOpenAuth}
                  className="text-cyan-400 hover:text-cyan-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>View Full Atlas</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SCREEN 6: 07 / 08 THE CONTROL (Guardian Runtime Intercept)
          ========================================================================= */}
      {op7 > 0.01 && (
        <div
          style={{ opacity: op7, transform: `translateY(${getRangeY(p, 0.79, 0.91)}px)` }}
          className="absolute inset-x-6 sm:inset-x-12 top-20 md:top-24 flex flex-col justify-between max-w-7xl mx-auto h-[calc(100vh-140px)] transition-opacity duration-75"
        >
          {/* Top Headline & Description */}
          <div className="max-w-xl text-left">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight uppercase leading-snug mb-2">
              GUARDIAN RUNTIME <br />
              <span className="text-amber-400 font-mono">INTERCEPT</span>
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-lg">
              From post-mortem investigation to real-time runtime control. Guardian active policy boundaries
              intercept in-flight agent runs before external mutations or financial side-effects occur.
            </p>
          </div>

          {/* Center Pipeline 5-Stage Indicator from Reference */}
          <div className="max-w-2xl mx-auto w-full py-2">
            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 bg-[#080d16]/90 p-3 rounded border border-[#1f2937]">
              <span className="text-zinc-500">Agent Run</span>
              <span className="text-zinc-600">──&gt;</span>
              <span className="text-amber-400 font-semibold">Anomaly Detected</span>
              <span className="text-zinc-600">──&gt;</span>
              <span className="text-rose-400 font-bold px-1.5 py-0.5 rounded bg-rose-950/60 border border-rose-500/40">
                Run Paused (||)
              </span>
              <span className="text-zinc-600">──&gt;</span>
              <span className="text-zinc-500">Cause Identified</span>
              <span className="text-zinc-600">──&gt;</span>
              <span className="text-zinc-500">Operator Decision</span>
            </div>
          </div>

          {/* Interactive Incident Card from Reference */}
          <div className="max-w-md mx-auto w-full p-4 rounded-lg bg-[#11090a]/95 border border-rose-900/60 font-mono text-xs backdrop-blur-md shadow-xl pointer-events-auto">
            <div className="flex items-center justify-between pb-2 border-b border-rose-900/40">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>CRITICAL INCIDENT</span>
              </div>
              <span className="text-zinc-500 text-[10px]">run_9A71</span>
            </div>

            <div className="pt-2.5 space-y-1.5 text-[11px]">
              <p className="text-white font-bold text-sm">Trader Bot</p>
              <p className="text-zinc-400 text-[10px]">Agent paused after unsafe action attempt</p>
              <p className="text-zinc-500 text-[10px]">Jan 4, 2026 - run_9A71</p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-zinc-400 text-[10px]">Confidence:</span>
                <span className="text-rose-400 font-bold">87%</span>
              </div>
              <p className="text-[10px] text-zinc-400">Cause: Distorted position size from search output</p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 mt-3 border-t border-rose-900/30">
              <button
                onClick={onOpenAuth}
                className="px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-[11px] transition-colors cursor-pointer"
              >
                Keep Paused
              </button>
              <button
                onClick={onOpenAuth}
                className="px-3 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-[11px] transition-colors cursor-pointer shadow-sm shadow-cyan-500/20"
              >
                Approve Retry
              </button>
            </div>
          </div>

          {/* Bottom Table: RECENT INCIDENTS from Reference */}
          <div className="p-3.5 rounded-lg bg-[#080d16]/90 border border-[#1f2937] font-mono text-xs backdrop-blur-md">
            <p className="text-[10px] font-bold uppercase text-zinc-400 pb-2 border-b border-[#1f2937]/70">
              RECENT INCIDENTS
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-[10px]">
              <div className="flex items-center justify-between text-zinc-300">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  Trader Bot
                </span>
                <span className="text-rose-400">Critical | Paused</span>
              </div>
              <div className="flex items-center justify-between text-zinc-300">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Portfolio Agent
                </span>
                <span className="text-amber-400">High | Mitigated</span>
              </div>
              <div className="flex items-center justify-between text-zinc-300">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Market Research
                </span>
                <span className="text-emerald-400">Medium | Resolved</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SCREEN 7: 08 / 08 ENTER BLACK BOX (Luminous Cybernetic Horizon CTA)
          ========================================================================= */}
      {op8 > 0.01 && (
        <div
          style={{ opacity: op8, transform: `translateY(${getRangeY(p, 0.90, 1.00)}px)` }}
          className="absolute inset-x-6 sm:inset-x-12 top-20 md:top-24 flex flex-col justify-between max-w-7xl mx-auto h-[calc(100vh-140px)] transition-opacity duration-75 text-center"
        >
          {/* Centered Master Editorial Headline from Reference */}
          <div className="max-w-3xl mx-auto pt-6">
            <h2 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-white uppercase leading-[1.02] mb-3">
              WHEN THE RUN BREAKS, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-100 to-cyan-400">
                KNOW WHY.
              </span>
            </h2>

            <p className="text-sm sm:text-base font-mono tracking-widest text-zinc-300 uppercase font-semibold mb-3">
              BLACK BOX — AI AGENT FLIGHT RECORDER
            </p>

            <p className="text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto leading-relaxed mb-6">
              Deploy the telemetry layer for your autonomous agent systems in under 4 minutes.
              Zero-overhead tracing, mathematical causal isolation, and counterfactual verification out of the box.
            </p>

            {/* Primary Action Button from Reference */}
            <div className="pointer-events-auto">
              <button
                onClick={onOpenAuth}
                className="px-8 py-3.5 rounded-full bg-white hover:bg-zinc-200 text-black font-extrabold text-xs sm:text-sm font-mono tracking-wider transition-all inline-flex items-center gap-2 cursor-pointer shadow-[0_0_35px_rgba(56,189,248,0.35)] active:scale-[0.98]"
              >
                <span>{isAuthenticated ? 'ENTER DASHBOARD' : 'OPEN BLACK BOX'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Bottom 4-Column Specification Strip from Reference */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-6 border-t border-[#1f2937]/50 w-full text-left">
            <div>
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">INTEGRATION</p>
              <p className="text-xs font-mono text-zinc-300 font-semibold mt-1">1 LINE OF CODE</p>
            </div>
            <div>
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">DEPLOYMENT</p>
              <p className="text-xs font-mono text-cyan-400 font-semibold mt-1">SELF-HOST OR CLOUD</p>
            </div>
            <div>
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">PROTOCOL</p>
              <p className="text-xs font-mono text-zinc-300 font-semibold mt-1">OPEN TELEMETRY</p>
            </div>
            <div>
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">GUARANTEE</p>
              <p className="text-xs font-mono text-emerald-400 font-semibold mt-1">ZERO DATA RETENTION</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
