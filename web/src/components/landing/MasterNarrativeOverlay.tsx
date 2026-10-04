import React from 'react';
import { motion } from 'framer-motion';
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

  // Opacities for the 8 acts
  const op1 = getRangeOpacity(p, 0.00, 0.00, 0.08, 0.12);
  const op2 = getRangeOpacity(p, 0.11, 0.14, 0.22, 0.25);
  const op3 = getRangeOpacity(p, 0.24, 0.27, 0.35, 0.38);
  const op4 = getRangeOpacity(p, 0.37, 0.40, 0.49, 0.52);
  const op5 = getRangeOpacity(p, 0.51, 0.54, 0.63, 0.66);
  const op6 = getRangeOpacity(p, 0.65, 0.68, 0.76, 0.79);
  const op7 = getRangeOpacity(p, 0.78, 0.81, 0.89, 0.91);
  const op8 = getRangeOpacity(p, 0.90, 0.93, 1.00, 1.00);

  // Dynamic run step during Act 2
  const runProgress = Math.max(0, Math.min(1, (p - 0.12) / 0.13));
  const activeStepNum = Math.min(5, Math.max(1, Math.floor(runProgress * 5) + 1));

  return (
    <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-6 sm:p-10 md:p-16 font-sans">
      {/* =========================================================================
          ACT I: THE TRACE (Hero) [p: 0.00 - 0.12]
          ========================================================================= */}
      {op1 > 0.01 && (
        <div
          style={{ opacity: op1, transform: `translateY(${getRangeY(p, 0, 0.12)}px)` }}
          className="absolute inset-x-6 sm:inset-x-12 top-20 md:top-24 flex flex-col items-center text-center max-w-4xl mx-auto transition-opacity duration-75"
        >
          {/* Technical Sub-Tag */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-[#090d15]/80 border border-[#1f2937] text-[11px] font-mono text-cyan-400 mb-6 tracking-widest uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            ACT I // THE LIVING EXECUTION TRACE
          </div>

          {/* Master Headline */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-white uppercase leading-[1.05] mb-4">
            AI AGENT <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-white to-zinc-400">
              FLIGHT RECORDER
            </span>
          </h1>

          {/* Three Core Tenets */}
          <p className="text-sm sm:text-base md:text-lg font-mono tracking-widest text-zinc-300 uppercase font-semibold mb-4">
            RECORD THE RUN. &nbsp;FIND THE CAUSE. &nbsp;PROVE THE FIX.
          </p>

          <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl leading-relaxed mb-8">
            When autonomous agents loop, drop schemas, or hallucinate tool parameters, traditional logs
            show you the crash—not the silent mutation four hops earlier. Black Box captures the immutable
            execution DAG, isolates root causes, and verifies fixes with counterfactual replay.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-4 pointer-events-auto">
            <button
              onClick={onOpenAuth}
              className="px-6 py-3 rounded bg-white hover:bg-zinc-200 text-black font-semibold text-xs font-mono tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(56,189,248,0.2)] active:scale-[0.98]"
            >
              <span>{isAuthenticated ? 'OPEN DASHBOARD' : 'OPEN BLACK BOX'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onExploreClick}
              className="px-5 py-3 rounded bg-[#0b101b] hover:bg-[#111827] text-zinc-300 hover:text-white border border-[#1f2937] text-xs font-mono tracking-wider transition-all flex items-center gap-2 cursor-pointer active:scale-[0.98]"
            >
              <span>FOLLOW THE TRACE</span>
              <ChevronDown className="w-3.5 h-3.5 text-cyan-400 animate-bounce" />
            </button>
          </div>

          {/* Architectural specs strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-12 border-t border-[#1f2937]/50 mt-12 w-full text-left">
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
          ACT II: THE RUN [p: 0.11 - 0.25]
          ========================================================================= */}
      {op2 > 0.01 && (
        <div
          style={{ opacity: op2, transform: `translateY(${getRangeY(p, 0.11, 0.25)}px)` }}
          className="absolute left-6 sm:left-14 top-20 md:top-24 max-w-md transition-opacity duration-75"
        >
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded bg-[#090d15]/90 border border-cyan-500/40 text-[10px] font-mono text-cyan-400 mb-3 tracking-widest uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            ACT II // 02 OF 08 : THE RUN
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight uppercase leading-snug mb-2">
            IMMUTABLE EXECUTION <br />
            <span className="text-cyan-400 font-mono">RECORDING</span>
          </h2>

          <p className="text-xs text-zinc-400 leading-relaxed mb-4">
            Scrolling directly scrubs in-flight agent execution. Every prompt, tool payload, memory state,
            and schema boundary is captured into a deterministic, queryable directed acyclic graph (DAG).
          </p>

          {/* Telemetry Card */}
          <div className="p-3.5 rounded bg-[#080d16]/90 border border-[#1f2937] font-mono text-xs space-y-2 backdrop-blur-sm">
            <div className="flex items-center justify-between text-[11px] pb-2 border-b border-[#1f2937]/70">
              <span className="text-zinc-500 uppercase">SCRUBBED PROGRESS</span>
              <span className="text-cyan-400 font-bold">{(runProgress * 100).toFixed(0)}%</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">ACTIVE STEP:</span>
              <span className="text-white font-bold">#0{activeStepNum} IN-FLIGHT</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">MEMORY SNAPSHOT:</span>
              <span className="text-zinc-300">2.4 MB (IMMUTABLE)</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">SCHEMA VALIDITY:</span>
              <span className="text-emerald-400 font-semibold">100% PASS</span>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          ACT III: THE FAILURE [p: 0.24 - 0.38]
          ========================================================================= */}
      {op3 > 0.01 && (
        <div
          style={{ opacity: op3, transform: `translateY(${getRangeY(p, 0.24, 0.38)}px)` }}
          className="absolute left-6 sm:left-14 top-20 md:top-24 max-w-md transition-opacity duration-75"
        >
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded bg-rose-950/60 border border-rose-500/50 text-[10px] font-mono text-rose-400 mb-3 tracking-widest uppercase">
            <ShieldAlert className="w-3 h-3 text-rose-400 animate-pulse" />
            ACT III // 03 OF 08 : THE FAILURE
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight uppercase leading-snug mb-2">
            THE ERROR IS NEVER <br />
            <span className="text-rose-500 font-mono">WHERE IT CRASHES</span>
          </h2>

          <p className="text-xs text-zinc-400 leading-relaxed mb-4">
            Notice Step 06 crashes with a NullPointer exception. But Step 06 did not cause the crash—Step 04 quietly
            dropped the currency column three hops earlier. Traditional APMs alert on the symptom. Black Box detects
            the latent contamination wave.
          </p>

          {/* Anomaly Telemetry Card */}
          <div className="p-3.5 rounded bg-[#13070b]/90 border border-rose-900/60 font-mono text-xs space-y-2 backdrop-blur-sm">
            <div className="flex items-center justify-between text-[11px] pb-2 border-b border-rose-900/40">
              <span className="text-rose-400 uppercase font-bold">LATENT MUTATION DETECTED</span>
              <span className="text-rose-500 animate-pulse font-extrabold">STEP #04</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">MUTATED PAYLOAD:</span>
              <span className="text-rose-300 font-bold">currency: undefined</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">CONTAMINATION WAVE:</span>
              <span className="text-amber-400 font-semibold">PROPAGATING → #05, #06</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">SYMPTOM CRASH:</span>
              <span className="text-zinc-500">STEP #06 (NULL_FORMAT)</span>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          ACT IV: THE CAUSE [p: 0.37 - 0.52]
          ========================================================================= */}
      {op4 > 0.01 && (
        <div
          style={{ opacity: op4, transform: `translateY(${getRangeY(p, 0.37, 0.52)}px)` }}
          className="absolute left-6 sm:left-14 top-20 md:top-24 max-w-md transition-opacity duration-75"
        >
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded bg-rose-950/80 border border-rose-500 text-[10px] font-mono text-rose-300 mb-3 tracking-widest uppercase">
            <Crosshair className="w-3 h-3 text-rose-400 animate-spin" />
            ACT IV // 04 OF 08 : THE CAUSE
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight uppercase leading-snug mb-2">
            MATHEMATICAL <br />
            <span className="text-rose-400 font-mono">CAUSAL ISOLATION</span>
          </h2>

          <p className="text-xs text-zinc-400 leading-relaxed mb-4">
            The HUD reticle isolates Step 04. Counterfactual graph subtraction mathematically proves Step 04 was both
            necessary and sufficient to produce the failure. Irrelevant background nodes are muted.
          </p>

          {/* Causal Proof HUD Card */}
          <div className="p-3.5 rounded bg-[#0e070c]/90 border border-rose-800/80 font-mono text-xs space-y-2 backdrop-blur-sm">
            <div className="flex items-center justify-between text-[11px] pb-2 border-b border-rose-900/40">
              <span className="text-zinc-400 uppercase">CAUSAL ATTRIBUTION CONFIDENCE</span>
              <span className="text-rose-400 font-bold">99.4%</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">NECESSARY CAUSE:</span>
              <span className="text-emerald-400 font-bold">VERIFIED (100%)</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">SUFFICIENT CAUSE:</span>
              <span className="text-emerald-400 font-bold">VERIFIED (99.8%)</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">BLAST RADIUS:</span>
              <span className="text-amber-400 font-bold">3 DOWNSTREAM NODES</span>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          ACT V: THE PROOF [p: 0.51 - 0.66]
          ========================================================================= */}
      {op5 > 0.01 && (
        <div
          style={{ opacity: op5, transform: `translateY(${getRangeY(p, 0.51, 0.66)}px)` }}
          className="absolute left-6 sm:left-14 top-20 md:top-24 max-w-md transition-opacity duration-75"
        >
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/50 text-[10px] font-mono text-emerald-400 mb-3 tracking-widest uppercase">
            <GitFork className="w-3 h-3 text-emerald-400" />
            ACT V // 05 OF 08 : THE PROOF
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight uppercase leading-snug mb-2">
            COUNTERFACTUAL FORK & <br />
            <span className="text-emerald-400 font-mono">VERIFICATION</span>
          </h2>

          <p className="text-xs text-zinc-400 leading-relaxed mb-4">
            The timeline rewinds to Save-Point #03. Step 04 is patched with a verified schema validator.
            Black Box replays only the contaminated downstream nodes while reusing 82% of prior compute.
          </p>

          {/* Replay Verification HUD Card */}
          <div className="p-3.5 rounded bg-[#06120d]/90 border border-emerald-900/60 font-mono text-xs space-y-2 backdrop-blur-sm">
            <div className="flex items-center justify-between text-[11px] pb-2 border-b border-emerald-900/40">
              <span className="text-zinc-400 uppercase">REUSED UPSTREAM COMPUTE</span>
              <span className="text-emerald-400 font-bold">82% SAVED</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">FORK EXECUTION:</span>
              <span className="text-emerald-300 font-bold">#04&apos; REPAIR (0.3s)</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">REPLAY DURATION:</span>
              <span className="text-zinc-300">1.4s (vs 28.6s full run)</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">COUNTERFACTUAL VERDICT:</span>
              <span className="text-emerald-400 font-bold">VERIFIED PASS (100%)</span>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          ACT VI: THE PATTERN [p: 0.65 - 0.79]
          ========================================================================= */}
      {op6 > 0.01 && (
        <div
          style={{ opacity: op6, transform: `translateY(${getRangeY(p, 0.65, 0.79)}px)` }}
          className="absolute left-6 sm:left-14 top-20 md:top-24 max-w-md transition-opacity duration-75"
        >
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded bg-[#090d15]/90 border border-cyan-500/40 text-[10px] font-mono text-cyan-400 mb-3 tracking-widest uppercase">
            <Layers className="w-3 h-3 text-cyan-400" />
            ACT VI // 06 OF 08 : THE PATTERN
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight uppercase leading-snug mb-2">
            FLEET <br />
            <span className="text-cyan-400 font-mono">FAILURE ATLAS</span>
          </h2>

          <p className="text-xs text-zinc-400 leading-relaxed mb-4">
            One failure is an incident. Ten failures are a systemic pattern. Black Box groups topological
            execution traces into semantic fingerprints across 10,000+ agent runs. Never debug the same root cause twice.
          </p>

          {/* Atlas Clustering HUD Card */}
          <div className="p-3.5 rounded bg-[#080d16]/90 border border-[#1f2937] font-mono text-xs space-y-2 backdrop-blur-sm">
            <div className="flex items-center justify-between text-[11px] pb-2 border-b border-[#1f2937]/70">
              <span className="text-zinc-500 uppercase">IDENTIFIED FINGERPRINT</span>
              <span className="text-cyan-400 font-bold">F-01 [SCHEMA_MUTATION]</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">FLEET INCIDENTS:</span>
              <span className="text-white font-bold">42 MATCHING RUNS</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">AFFECTED MODELS:</span>
              <span className="text-zinc-300">Claude-3.5, GPT-4o</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">SYSTEMIC REMEDY:</span>
              <span className="text-emerald-400 font-semibold">FLEET HOT-PATCH READY</span>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          ACT VII: THE CONTROL [p: 0.78 - 0.91]
          ========================================================================= */}
      {op7 > 0.01 && (
        <div
          style={{ opacity: op7, transform: `translateY(${getRangeY(p, 0.78, 0.91)}px)` }}
          className="absolute left-6 sm:left-14 top-20 md:top-24 max-w-md transition-opacity duration-75"
        >
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded bg-amber-950/70 border border-amber-500/50 text-[10px] font-mono text-amber-400 mb-3 tracking-widest uppercase">
            <ShieldCheck className="w-3 h-3 text-amber-400 animate-pulse" />
            ACT VII // 07 OF 08 : THE CONTROL
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight uppercase leading-snug mb-2">
            GUARDIAN RUNTIME <br />
            <span className="text-amber-400 font-mono">INTERCEPT</span>
          </h2>

          <p className="text-xs text-zinc-400 leading-relaxed mb-4">
            From post-mortem investigation to real-time runtime control. Guardian active policy boundaries intercept
            in-flight agent runs before external mutations or financial side-effects occur.
          </p>

          {/* Guardian HUD Card */}
          <div className="p-3.5 rounded bg-[#130d07]/90 border border-amber-900/60 font-mono text-xs space-y-2 backdrop-blur-sm">
            <div className="flex items-center justify-between text-[11px] pb-2 border-b border-amber-900/40">
              <span className="text-amber-400 uppercase font-bold">STATE: IN-FLIGHT PAUSED</span>
              <span className="text-zinc-400">LATENCY: 0.2MS</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">TRIGGER POLICY:</span>
              <span className="text-amber-300 font-semibold">PREVENT_DROP_CURRENCY</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">ACTION TAKEN:</span>
              <span className="text-emerald-400 font-semibold">SAVE-POINT ANCHORED</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">OPERATOR CONTROL:</span>
              <span className="text-white font-bold">AWAITING DECISION</span>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          ACT VIII: THE DESTINATION [p: 0.90 - 1.00]
          ========================================================================= */}
      {op8 > 0.01 && (
        <div
          style={{ opacity: op8, transform: `translateY(${getRangeY(p, 0.90, 1.00)}px)` }}
          className="absolute inset-x-6 sm:inset-x-12 top-24 md:top-28 flex flex-col items-center text-center max-w-4xl mx-auto transition-opacity duration-75"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-[#090d15]/80 border border-[#1f2937] text-[11px] font-mono text-cyan-400 mb-6 tracking-widest uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            ACT VIII // 08 OF 08 : ENTER BLACK BOX
          </div>

          <h2 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-white uppercase leading-[1.05] mb-4">
            WHEN THE RUN BREAKS, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-white to-zinc-400">
              KNOW WHY.
            </span>
          </h2>

          <p className="text-sm sm:text-base font-mono tracking-widest text-zinc-300 uppercase font-semibold mb-4">
            BLACK BOX — AI AGENT FLIGHT RECORDER
          </p>

          <p className="text-xs sm:text-sm text-zinc-400 max-w-xl leading-relaxed mb-8">
            Deploy the telemetry layer for your autonomous agent systems in under 4 minutes.
            Zero-overhead tracing, mathematical causal isolation, and counterfactual verification out of the box.
          </p>

          {/* Primary Action Button */}
          <div className="flex flex-wrap items-center justify-center gap-4 pointer-events-auto">
            <button
              onClick={onOpenAuth}
              className="px-8 py-4 rounded bg-white hover:bg-zinc-200 text-black font-extrabold text-sm font-mono tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-[0_0_30px_rgba(56,189,248,0.25)] active:scale-[0.98]"
            >
              <span>{isAuthenticated ? 'ENTER DASHBOARD' : 'OPEN BLACK BOX'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Architecture verification bullet points */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-12 border-t border-[#1f2937]/50 mt-12 w-full text-left">
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

      {/* Floating Bottom Telemetry Status Strip */}
      <div className="relative z-10 flex items-center justify-between border-t border-[#1f2937]/50 pt-4 text-[10px] font-mono text-zinc-500">
        <div className="flex items-center gap-4">
          <span className="text-zinc-400 font-semibold">BLACK BOX ENGINE</span>
          <span className="hidden sm:inline text-zinc-600">|</span>
          <span className="hidden sm:inline">STATE: DETERMINISTIC</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-zinc-600">SCROLL NAVIGATION</span>
          <span className="text-cyan-400 font-bold">{(p * 100).toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
};
