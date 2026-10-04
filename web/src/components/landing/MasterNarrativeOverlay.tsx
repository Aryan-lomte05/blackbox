import React, { useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  ExternalLink,
  Shield,
  Layers,
  Terminal,
} from 'lucide-react';

interface MasterNarrativeOverlayProps {
  progress: number; // 0.0 to 1.0 continuous normalized scroll progress
  onOpenAuth: () => void;
  onExploreClick: () => void;
  isAuthenticated: boolean;
}

// Pure helper function for smooth scene opacities with gentle ease curves
function getSceneOpacity(
  p: number,
  start: number,
  peakStart: number,
  peakEnd: number,
  end: number
): number {
  if (p < start || p > end) return 0;
  if (p < peakStart) return (p - start) / (peakStart - start);
  if (p <= peakEnd) return 1;
  return 1 - (p - peakEnd) / (end - peakEnd);
}

export const MasterNarrativeOverlay: React.FC<MasterNarrativeOverlayProps> = ({
  progress,
  onOpenAuth,
  onExploreClick,
  isAuthenticated,
}) => {
  const p = Math.max(0, Math.min(1, progress));

  // Opacities for the 8 chapters strictly mapped to the reference thresholds
  const op1 = getSceneOpacity(p, 0.00, 0.00, 0.08, 0.12);
  const op2 = getSceneOpacity(p, 0.11, 0.14, 0.22, 0.25);
  const op3 = getSceneOpacity(p, 0.24, 0.27, 0.35, 0.38);
  const op4 = getSceneOpacity(p, 0.37, 0.40, 0.49, 0.52);
  const op5 = getSceneOpacity(p, 0.51, 0.54, 0.63, 0.66);
  const op6 = getSceneOpacity(p, 0.65, 0.68, 0.76, 0.79);
  const op7 = getSceneOpacity(p, 0.78, 0.81, 0.88, 0.91);
  const op8 = getSceneOpacity(p, 0.90, 0.93, 1.00, 1.00);

  // Interactive UI state for panels
  const [act2Tab, setAct2Tab] = useState<'request' | 'output' | 'metadata'>('request');
  const [act4Tab, setAct4Tab] = useState<'request' | 'output' | 'sources' | 'checker'>('request');
  const [atlasFilter, setAtlasFilter] = useState<'All' | 'QA' | 'Math' | 'Shop' | 'Novel'>('All');
  const [guardianState, setGuardianState] = useState<'paused' | 'retried'>('paused');

  return (
    <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-4 sm:p-8 md:p-12 font-sans overflow-hidden">
      {/* =========================================================================
          CHAPTER 01: THE TRACE [0.00 - 0.12]
          Editorial Headline Left + Specification Strip Bottom
          ========================================================================= */}
      {op1 > 0.01 && (
        <div
          style={{ opacity: op1 }}
          className="absolute inset-x-6 sm:inset-x-12 top-20 md:top-24 flex flex-col justify-between max-w-7xl mx-auto h-[calc(100vh-140px)] transition-opacity duration-150"
        >
          {/* Top Left: Editorial Block */}
          <div className="max-w-xl text-left pt-4">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-400/40 text-[10px] font-mono text-cyan-300 mb-4">
              <span>01 / 08</span>
              <span className="text-zinc-500">//</span>
              <span className="font-semibold tracking-wider">THE TRACE</span>
            </div>

            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-white uppercase leading-[1.05] mb-3">
              AI AGENT <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-200 to-cyan-400">
                FLIGHT RECORDER
              </span>
            </h1>

            <p className="text-xs sm:text-sm font-mono tracking-wider text-zinc-300 font-semibold mb-3">
              Record the run. Find the cause. Prove the fix.
            </p>

            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed mb-6 max-w-lg">
              When autonomous agents loop, drop schemas, or hallucinate tool parameters, traditional logs
              seldom show you the crash—let alone the silent mutation four hops earlier. Black Box captures the
              immutable execution DAG, isolates root causes, and verifies fixes with counterfactual replay.
            </p>

            <div className="flex flex-wrap items-center gap-3.5 pointer-events-auto">
              <button
                onClick={onOpenAuth}
                className="px-5 py-2.5 rounded-full bg-white hover:bg-zinc-200 text-black font-semibold text-xs font-mono tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-[0_0_16px_rgba(56,189,248,0.25)] active:scale-[0.98]"
              >
                <span>{isAuthenticated ? 'OPEN BLACK BOX' : 'OPEN BLACK BOX'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={onExploreClick}
                className="px-4 py-2.5 rounded-full bg-[#080d16] hover:bg-[#0f172a] text-zinc-300 hover:text-white border border-[#1f2937] text-xs font-mono tracking-wider transition-all flex items-center gap-2 cursor-pointer active:scale-[0.98]"
              >
                <span>WATCH THE TRACE</span>
                <ChevronDown className="w-3.5 h-3.5 text-cyan-400 animate-bounce" />
              </button>
            </div>
          </div>

          {/* Bottom: 4-Column Technical Specification Strip from Reference */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[#1f2937]/50 w-full text-left">
            <div>
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">RECORDING PROTOCOL</p>
              <p className="text-xs font-mono text-zinc-300 font-semibold mt-0.5">RFC-9122 DAG STREAM</p>
            </div>
            <div>
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">INSPECTION LATENCY</p>
              <p className="text-xs font-mono text-cyan-400 font-semibold mt-0.5">&lt; 0.4MS / STEP</p>
            </div>
            <div>
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">ISOLATION ENGINE</p>
              <p className="text-xs font-mono text-zinc-300 font-semibold mt-0.5">SHAPLEY CAUSALITY</p>
            </div>
            <div>
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">REPLAY VERIFICATION</p>
              <p className="text-xs font-mono text-emerald-400 font-semibold mt-0.5">COUNTERFACTUAL FORK</p>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          CHAPTER 02: THE RUN [0.12 - 0.25]
          Immutable Execution in Real Time + Split Telemetry Panels
          ========================================================================= */}
      {op2 > 0.01 && (
        <div
          style={{ opacity: op2 }}
          className="absolute inset-x-6 sm:inset-x-12 top-20 md:top-24 flex flex-col justify-between max-w-7xl mx-auto h-[calc(100vh-140px)] transition-opacity duration-150"
        >
          {/* Top Left: Heading & Description */}
          <div className="max-w-xl text-left pt-2">
            <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-400/40 text-[10px] font-mono text-cyan-300 mb-2">
              <span>02 / 08</span>
              <span className="text-zinc-500">//</span>
              <span className="font-semibold tracking-wider">THE RUN</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight uppercase leading-snug mb-1">
              IMMUTABLE EXECUTION <br />
              <span className="text-cyan-400 font-mono">IN REAL TIME</span>
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-lg">
              Every prompt, tool payload, memory state, and schema boundary is captured into a
              deterministic, queryable directed acyclic graph (DAG).
            </p>
          </div>

          {/* Bottom: Split Telemetry Panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-2 pointer-events-auto">
            {/* Left Panel: STEP 03 // RETRIEVAL */}
            <div className="p-3.5 rounded-lg bg-[#080d16]/95 border border-[#1f2937] font-mono text-xs backdrop-blur-md shadow-lg">
              <div className="flex items-center justify-between pb-2 border-b border-[#1f2937]/70 text-[11px]">
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

              <div className="pt-2 text-[11px] leading-relaxed text-zinc-300 font-mono">
                {act2Tab === 'request' && (
                  <pre className="text-cyan-300/90 whitespace-pre-wrap">
{`{
  "query": "best time to visit maharashtra in june",
  "top_k": 5,
  "sources": ["destinations_db", "weather_gov"]
}`}
                  </pre>
                )}
                {act2Tab === 'output' && (
                  <pre className="text-emerald-300/90 whitespace-pre-wrap">
{`{
  "matches": 5,
  "confidence": 0.94,
  "primary_source": "weather_gov",
  "status": "200_OK"
}`}
                  </pre>
                )}
                {act2Tab === 'metadata' && (
                  <pre className="text-zinc-400 whitespace-pre-wrap">
{`{
  "duration_ms": 642,
  "cache_hit": false,
  "protocol": "rfc_9122_dag",
  "hash": "0x7F92_RETRIEVE"
}`}
                  </pre>
                )}
              </div>
            </div>

            {/* Right Panel: EXECUTION STREAM */}
            <div className="p-3.5 rounded-lg bg-[#080d16]/95 border border-[#1f2937] font-mono text-xs backdrop-blur-md shadow-lg">
              <div className="flex items-center justify-between pb-2 border-b border-[#1f2937]/70 text-[11px]">
                <span className="text-zinc-300 font-bold uppercase tracking-wider">EXECUTION STREAM</span>
                <span className="text-[10px] text-cyan-400">RECORDING ACTIVE</span>
              </div>
              <ul className="pt-2 space-y-1.5 text-[11px] text-zinc-400">
                <li className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span className="text-zinc-300">Step 01: System prompt initialized</span>
                  </span>
                  <span className="text-zinc-500 text-[10px]">12ms</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span className="text-zinc-300">Step 02: Planner generated 2 tool calls</span>
                  </span>
                  <span className="text-zinc-500 text-[10px]">1.2s</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="text-cyan-300 font-semibold">Step 03: Vector retrieval executed</span>
                  </span>
                  <span className="text-cyan-400 text-[10px]">642ms</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          CHAPTER 03: THE FAILURE [0.25 - 0.38]
          Silent Mutation & Cascading Crash
          ========================================================================= */}
      {op3 > 0.01 && (
        <div
          style={{ opacity: op3 }}
          className="absolute inset-x-6 sm:inset-x-12 top-20 md:top-24 flex flex-col justify-between max-w-7xl mx-auto h-[calc(100vh-140px)] transition-opacity duration-150"
        >
          {/* Top Left: Headline & Description */}
          <div className="max-w-xl text-left pt-2">
            <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/40 text-[10px] font-mono text-rose-400 mb-2">
              <span>03 / 08</span>
              <span className="text-zinc-500">//</span>
              <span className="font-semibold tracking-wider">THE FAILURE</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight uppercase leading-snug mb-1">
              SILENT MUTATION & <br />
              <span className="text-rose-500 font-mono">CASCADING CRASH</span>
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-lg">
              An unvalidated null key in Step 04 bypassed traditional exception handlers, silently poisoning
              downstream memory until Step 06 suffered a fatal crash.
            </p>
          </div>

          {/* Bottom: Error Telemetry Panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-2 pointer-events-auto">
            {/* Left Panel: FORENSIC CRASH TRACE */}
            <div className="p-3.5 rounded-lg bg-[#14060a]/95 border border-rose-500/60 font-mono text-xs backdrop-blur-md shadow-lg shadow-rose-950/20">
              <div className="flex items-center justify-between pb-2 border-b border-rose-900/60 text-[11px]">
                <span className="text-rose-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3 text-rose-400" />
                  <span>STEP 06 CRASH // NullPointerException</span>
                </span>
                <span className="text-[10px] text-rose-400/80 bg-rose-950/80 px-2 py-0.5 rounded">
                  EXIT CODE: 1
                </span>
              </div>
              <div className="pt-2 text-[11px] font-mono text-zinc-300 space-y-1">
                <p className="text-rose-300 font-semibold">
                  Cannot read properties of undefined (reading &apos;currency&apos;)
                </p>
                <p className="text-zinc-500 text-[10px]">
                  at StateUpdater.mutate (/runtime/agent/state.ts:142:18)
                </p>
                <p className="text-zinc-500 text-[10px]">
                  at executeDagNode (/runtime/executor.ts:89:12)
                </p>
              </div>
            </div>

            {/* Right Panel: FAILURE CASCADE STREAM */}
            <div className="p-3.5 rounded-lg bg-[#080d16]/95 border border-[#1f2937] font-mono text-xs backdrop-blur-md shadow-lg">
              <div className="flex items-center justify-between pb-2 border-b border-[#1f2937]/70 text-[11px]">
                <span className="text-zinc-300 font-bold uppercase tracking-wider">PROPAGATION TRACE</span>
                <span className="text-[10px] text-rose-400">CONTAMINATION DETECTED</span>
              </div>
              <ul className="pt-2 space-y-1.5 text-[11px]">
                <li className="flex items-center justify-between text-zinc-500">
                  <span>Step 03: Retrieval passed payload</span>
                  <span className="text-[10px]">OK</span>
                </li>
                <li className="flex items-center justify-between text-rose-400 font-semibold">
                  <span>Step 04: Search dropped &apos;currency&apos; key</span>
                  <span className="text-[10px] bg-rose-950/80 px-1.5 rounded">GUILTY</span>
                </li>
                <li className="flex items-center justify-between text-amber-400">
                  <span>Step 05: LLM hallucinated unkeyed output</span>
                  <span className="text-[10px] bg-amber-950/80 px-1.5 rounded">MUTATED</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          CHAPTER 04: THE CAUSE [0.38 - 0.52]
          Mathematical Causal Isolation + Diagnostic HUD Reticle
          ========================================================================= */}
      {op4 > 0.01 && (
        <div
          style={{ opacity: op4 }}
          className="absolute inset-x-6 sm:inset-x-12 top-20 md:top-24 flex flex-col justify-between max-w-7xl mx-auto h-[calc(100vh-140px)] transition-opacity duration-150"
        >
          {/* Top Left: Headline & Description */}
          <div className="max-w-xl text-left pt-2">
            <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-400/40 text-[10px] font-mono text-amber-400 mb-2">
              <span>04 / 08</span>
              <span className="text-zinc-500">//</span>
              <span className="font-semibold tracking-wider">THE CAUSE</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight uppercase leading-snug mb-1">
              MATHEMATICAL <br />
              <span className="text-amber-400 font-mono">CAUSAL ISOLATION</span>
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-lg">
              The HUD reticle isolates Step 04. Counterfactual graph analysis proves Step 04 was both
              necessary and sufficient to produce the failure.
            </p>
          </div>

          {/* Bottom: Evidence Inspector & Diagnostic Attribution Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-2 pointer-events-auto">
            {/* Left: EVIDENCE INSPECTOR */}
            <div className="p-3.5 rounded-lg bg-[#0e0903]/95 border border-amber-500/50 font-mono text-xs backdrop-blur-md shadow-lg">
              <div className="flex items-center justify-between pb-2 border-b border-amber-900/50 text-[11px]">
                <span className="text-amber-400 font-bold uppercase tracking-wider">EVIDENCE // STEP 04</span>
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

              <div className="pt-2 text-[11px] leading-relaxed text-zinc-300 font-mono">
                {act4Tab === 'request' && (
                  <pre className="text-amber-300/90 whitespace-pre-wrap">
{`{
  "tool": "web_search",
  "query": "maharashtra travel weather package rate",
  "schema_version": "v1.2"
}`}
                  </pre>
                )}
                {act4Tab === 'output' && (
                  <pre className="text-rose-300/90 whitespace-pre-wrap">
{`{
  "title": "Maharashtra Tourism Guide",
  "rate": 4200,
  // [ERROR] "currency" omitted by upstream provider
}`}
                  </pre>
                )}
                {act4Tab === 'sources' && (
                  <pre className="text-zinc-400 whitespace-pre-wrap">
{`{
  "provider": "search_aggregator_ext",
  "latency_ms": 1820,
  "http_status": 200
}`}
                  </pre>
                )}
                {act4Tab === 'checker' && (
                  <pre className="text-emerald-400 whitespace-pre-wrap">
{`{
  "rule": "require_field_currency",
  "violation": true,
  "confidence": 0.998
}`}
                  </pre>
                )}
              </div>
            </div>

            {/* Right: DIAGNOSTIC CUSAL ATTRIBUTION METRICS from Reference */}
            <div className="p-3.5 rounded-lg bg-[#080d16]/95 border border-[#1f2937] font-mono text-xs backdrop-blur-md shadow-lg space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-[#1f2937]/70 text-[11px]">
                <span className="text-zinc-300 font-bold uppercase tracking-wider">CAUSAL ATTRIBUTION</span>
                <span className="text-[10px] text-amber-400 font-semibold">SHAPLEY ANALYSIS</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase">NECESSARY</p>
                  <p className="text-emerald-400 font-bold mt-0.5">Verified (100%)</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase">SUFFICIENT</p>
                  <p className="text-emerald-400 font-bold mt-0.5">Verified (99.8%)</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase">BLAST RADIUS</p>
                  <p className="text-amber-400 font-bold mt-0.5">3 downstream nodes</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase">CONTAMINATION</p>
                  <p className="text-rose-400 font-bold mt-0.5">Propagates → #05, #06</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          CHAPTER 05: THE PROOF [0.52 - 0.66]
          Counterfactual Fork & Verification
          ========================================================================= */}
      {op5 > 0.01 && (
        <div
          style={{ opacity: op5 }}
          className="absolute inset-x-6 sm:inset-x-12 top-20 md:top-24 flex flex-col justify-between max-w-7xl mx-auto h-[calc(100vh-140px)] transition-opacity duration-150"
        >
          {/* Top Left: Headline & Description */}
          <div className="max-w-xl text-left pt-2">
            <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-400/40 text-[10px] font-mono text-emerald-400 mb-2">
              <span>05 / 08</span>
              <span className="text-zinc-500">//</span>
              <span className="font-semibold tracking-wider">THE PROOF</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight uppercase leading-snug mb-1">
              COUNTERFACTUAL FORK <br />
              <span className="text-emerald-400 font-mono">&amp; VERIFICATION</span>
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-lg">
              The timeline rewinds to a save-point. Step 04 is patched with verified schema validation. Only
              the contaminated downstream nodes are re-executed.
            </p>
          </div>

          {/* Bottom: Replay Efficiency Metrics from Reference */}
          <div className="p-4 rounded-lg bg-[#041a14]/95 border border-emerald-500/40 font-mono text-xs backdrop-blur-md shadow-lg pointer-events-auto">
            <div className="flex items-center justify-between pb-2 border-b border-emerald-900/50 text-[11px]">
              <span className="text-emerald-400 font-bold uppercase tracking-wider">REPLAY EFFICIENCY</span>
              <div className="flex items-center gap-4 text-[10px]">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400" />
                  <span className="text-zinc-300">Executed (3)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-sky-900" />
                  <span className="text-zinc-400">Reused (9)</span>
                </span>
              </div>
            </div>

            {/* Replay Counter Columns */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 pt-3 text-center">
              <div>
                <p className="text-base sm:text-lg font-black text-white">12</p>
                <p className="text-[10px] text-zinc-500 uppercase">TOTAL STEPS</p>
              </div>
              <div>
                <p className="text-base sm:text-lg font-black text-cyan-400">3</p>
                <p className="text-[10px] text-zinc-500 uppercase">EXECUTED</p>
              </div>
              <div>
                <p className="text-base sm:text-lg font-black text-zinc-300">9</p>
                <p className="text-[10px] text-zinc-500 uppercase">REUSED</p>
              </div>
              <div>
                <p className="text-base sm:text-lg font-black text-white">0</p>
                <p className="text-[10px] text-zinc-500 uppercase">MODEL CALLS</p>
              </div>
              <div>
                <p className="text-base sm:text-lg font-black text-emerald-400">82%</p>
                <p className="text-[10px] text-zinc-500 uppercase">TOKENS SAVED</p>
              </div>
              <div>
                <p className="text-base sm:text-lg font-black text-emerald-400">1.4s</p>
                <p className="text-[10px] text-zinc-500 uppercase">TIME SAVED</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          CHAPTER 06: THE PATTERN [0.66 - 0.79]
          Fleet Failure Atlas & Topological Fingerprints
          ========================================================================= */}
      {op6 > 0.01 && (
        <div
          style={{ opacity: op6 }}
          className="absolute inset-x-6 sm:inset-x-12 top-20 md:top-24 flex flex-col justify-between max-w-7xl mx-auto h-[calc(100vh-140px)] transition-opacity duration-150"
        >
          {/* Top: Headline & Category Filter Pills */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pt-2">
            <div className="max-w-xl text-left">
              <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-400/40 text-[10px] font-mono text-cyan-300 mb-2">
                <span>06 / 08</span>
                <span className="text-zinc-500">//</span>
                <span className="font-semibold tracking-wider">THE PATTERN</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight uppercase leading-snug mb-1">
                FLEET FAILURE <br />
                <span className="text-cyan-400 font-mono">ATLAS</span>
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-lg">
                One failure is an incident. Ten failures are a systemic pattern. Black Box groups topological
                execution traces into semantic fingerprints across agent runs.
              </p>
            </div>

            {/* Filter Pills from Reference */}
            <div className="flex items-center gap-2 font-mono text-xs pointer-events-auto">
              {(['All', 'QA', 'Math', 'Shop', 'Novel'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setAtlasFilter(cat)}
                  className={`px-3 py-1 rounded-full border text-xs cursor-pointer transition-all ${
                    atlasFilter === cat
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/60 font-semibold'
                      : 'bg-[#080e18] text-zinc-500 border-[#1f2937] hover:text-zinc-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Bottom: Split Fingerprints & Recovery Insights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-2 pointer-events-auto">
            {/* Left: TOP FINGERPRINTS */}
            <div className="p-3.5 rounded-lg bg-[#080d16]/95 border border-[#1f2937] font-mono text-xs backdrop-blur-md shadow-lg">
              <div className="flex items-center justify-between pb-2 border-b border-[#1f2937]/70 text-[11px]">
                <span className="text-zinc-300 font-bold uppercase tracking-wider">TOP FINGERPRINTS</span>
                <span className="text-[10px] text-cyan-400">10,000+ AGENT RUNS</span>
              </div>
              <ul className="pt-2 space-y-2 text-[11px]">
                <li className="flex items-center justify-between">
                  <span className="text-cyan-300 font-semibold">01 Search contamination</span>
                  <span className="text-zinc-400">43 runs · 12.7%</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-amber-300">02 Calculator error</span>
                  <span className="text-zinc-400">31 runs · 9.1%</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-emerald-300">03 Retrieval mismatch</span>
                  <span className="text-zinc-400">26 runs · 7.6%</span>
                </li>
              </ul>
            </div>

            {/* Right: RECOVERY INSIGHTS */}
            <div className="p-3.5 rounded-lg bg-[#080d16]/95 border border-[#1f2937] font-mono text-xs backdrop-blur-md shadow-lg">
              <div className="flex items-center justify-between pb-2 border-b border-[#1f2937]/70 text-[11px]">
                <span className="text-zinc-300 font-bold uppercase tracking-wider">RECOVERY INSIGHTS</span>
                <span className="text-[10px] text-emerald-400">AUTOMATED FIXES</span>
              </div>
              <ul className="pt-2 space-y-2 text-[11px] text-zinc-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Fixing source attribution resolves 87% of errors</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Add schema validator to search tool payloads</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Use deterministic extraction for entity schemas</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          CHAPTER 07: THE CONTROL [0.79 - 0.91]
          Guardian Runtime Intercept & Operator Decision
          ========================================================================= */}
      {op7 > 0.01 && (
        <div
          style={{ opacity: op7 }}
          className="absolute inset-x-6 sm:inset-x-12 top-20 md:top-24 flex flex-col justify-between max-w-7xl mx-auto h-[calc(100vh-140px)] transition-opacity duration-150"
        >
          {/* Top Left: Headline & Description */}
          <div className="max-w-xl text-left pt-2">
            <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-400/40 text-[10px] font-mono text-cyan-300 mb-2">
              <span>07 / 08</span>
              <span className="text-zinc-500">//</span>
              <span className="font-semibold tracking-wider">THE CONTROL</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight uppercase leading-snug mb-1">
              GUARDIAN RUNTIME <br />
              <span className="text-cyan-400 font-mono">INTERCEPT</span>
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-lg">
              From post-mortem investigation to real-time runtime control. Guardian active policy boundaries
              intercept in-flight agent runs before external mutations or financial side-effects occur.
            </p>
          </div>

          {/* Center: Interactive Live Intercept Card */}
          <div className="max-w-xl mx-auto w-full p-4 rounded-lg bg-[#0e0709]/95 border border-rose-500/70 font-mono text-xs backdrop-blur-md shadow-2xl pointer-events-auto">
            <div className="flex items-center justify-between pb-2.5 border-b border-rose-900/60 text-[11px]">
              <span className="flex items-center gap-2 text-rose-400 font-bold uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <span>CRITICAL INCIDENT</span>
              </span>
              <span className="text-[10px] text-zinc-400">Jan 4, 2026 - run_9A71</span>
            </div>

            <div className="pt-2.5 space-y-2 text-[11px]">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-white font-bold text-sm">Trader Bot</h4>
                  <p className="text-zinc-400 text-[10px]">
                    Agent paused after unsafe action attempt
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-zinc-500 uppercase">CONFIDENCE</p>
                  <p className="text-cyan-400 font-bold text-sm">87%</p>
                </div>
              </div>

              <div className="p-2 rounded bg-black/50 border border-[#1f2937] text-[10px] text-zinc-400">
                Cause: Distorted position size from search retrieval
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setGuardianState('paused')}
                  className={`px-4 py-1.5 rounded text-xs font-mono transition-all cursor-pointer ${
                    guardianState === 'paused'
                      ? 'bg-zinc-800 text-white border border-zinc-600'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Keep Paused
                </button>
                <button
                  onClick={() => setGuardianState('retried')}
                  className={`px-4 py-1.5 rounded text-xs font-mono font-semibold transition-all cursor-pointer ${
                    guardianState === 'retried'
                      ? 'bg-emerald-500 text-black'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-black'
                  }`}
                >
                  {guardianState === 'retried' ? 'Retried ✓' : 'Approve Retry'}
                </button>
              </div>
            </div>
          </div>

          {/* Bottom: RECENT INCIDENTS TABLE */}
          <div className="p-3.5 rounded-lg bg-[#080d16]/95 border border-[#1f2937] font-mono text-xs backdrop-blur-md shadow-lg pointer-events-auto">
            <div className="flex items-center justify-between pb-2 border-b border-[#1f2937]/70 text-[11px]">
              <span className="text-zinc-300 font-bold uppercase tracking-wider">RECENT INCIDENTS</span>
              <span className="text-[10px] text-cyan-400">POLICY GUARD ACTIVE</span>
            </div>
            <div className="divide-y divide-[#1f2937]/50 text-[11px] pt-1">
              <div className="flex items-center justify-between py-1.5">
                <span className="text-white font-semibold">Trader Bot</span>
                <span className="text-rose-400">Critical</span>
                <span className="text-zinc-500 text-[10px]">2m ago</span>
                <span className="text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded text-[10px]">
                  {guardianState === 'retried' ? 'Retried' : 'Paused'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-zinc-300">Portfolio Rebalancer</span>
                <span className="text-amber-400">High</span>
                <span className="text-zinc-500 text-[10px]">14m ago</span>
                <span className="text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded text-[10px]">Mitigated</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-zinc-400">Market Researcher</span>
                <span className="text-zinc-400">Medium</span>
                <span className="text-zinc-500 text-[10px]">1h ago</span>
                <span className="text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded text-[10px]">Resolved</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          CHAPTER 08: ENTER BLACK BOX [0.91 - 1.00]
          Quiet Planetary Resolution & Final System Entry
          ========================================================================= */}
      {op8 > 0.01 && (
        <div
          style={{ opacity: op8 }}
          className="absolute inset-x-6 sm:inset-x-12 top-24 md:top-28 flex flex-col justify-between max-w-4xl mx-auto h-[calc(100vh-160px)] transition-opacity duration-150 text-center"
        >
          {/* Center Call to Action */}
          <div className="pt-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/40 text-[11px] font-mono text-cyan-300 mb-6">
              <span>08 / 08</span>
              <span className="text-zinc-500">//</span>
              <span className="font-semibold tracking-wider">ENTER BLACK BOX</span>
            </div>

            <h2 className="text-4xl sm:text-6xl md:text-7xl font-black text-white uppercase tracking-tight leading-[1.05] mb-4">
              WHEN THE RUN BREAKS, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-200 to-cyan-400">
                KNOW WHY.
              </span>
            </h2>

            <p className="text-xs sm:text-sm font-mono tracking-widest text-zinc-300 uppercase font-semibold mb-3">
              BLACK BOX — AI AGENT FLIGHT RECORDER
            </p>

            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-xl mx-auto mb-8">
              Deploy the telemetry layer for your autonomous agent systems. Immutable execution tracing,
              mathematical causal isolation, and counterfactual verification out of the box.
            </p>

            <div className="flex justify-center pointer-events-auto">
              <button
                onClick={onOpenAuth}
                className="px-8 py-3.5 rounded-full bg-white hover:bg-zinc-200 text-black font-semibold text-xs font-mono tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-[0_0_24px_rgba(56,189,248,0.3)] active:scale-[0.98]"
              >
                <span>OPEN BLACK BOX</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Bottom Specifications Bar from Reference */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[#1f2937]/50 w-full text-center">
            <div>
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">INTEGRATION</p>
              <p className="text-xs font-mono text-zinc-300 font-semibold mt-0.5">OTel / RFC-9122</p>
            </div>
            <div>
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">DEPLOYMENT</p>
              <p className="text-xs font-mono text-cyan-400 font-semibold mt-0.5">SELF-HOST OR CLOUD</p>
            </div>
            <div>
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">ATTRIBUTION</p>
              <p className="text-xs font-mono text-zinc-300 font-semibold mt-0.5">SHAPLEY CAUSALITY</p>
            </div>
            <div>
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">VERIFICATION</p>
              <p className="text-xs font-mono text-emerald-400 font-semibold mt-0.5">COUNTERFACTUAL FORK</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
