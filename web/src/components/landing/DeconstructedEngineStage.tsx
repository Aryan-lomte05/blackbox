import React, { useState, useEffect, useRef } from 'react';
import { SiliconCore3D } from '../3d/SiliconCore3D';
import { ChevronLeft, ChevronRight, Pause, Play, Sparkles } from 'lucide-react';

const LAYERS = [
  {
    id: 'layer-1',
    num: '01',
    title: 'Deterministic Ingestion Buffer',
    sub: 'Sub-millisecond trace capture without thread blocking',
    desc: 'Hooks directly into OpenAI, Anthropic, LangGraph, and custom Python tool calls. Generates immutable cryptographically hashed DAGs for every token, state mutation, and external RPC without slowing down production traffic.',
    tag: '< 0.2ms Latency',
    color: 'text-amber-400',
    borderColor: 'border-amber-500/40',
    bg: 'bg-amber-500/10',
    glow: 'rgba(245, 158, 11, 0.15)',
    metrics: [
      { label: 'INGESTION LATENCY', val: '< 0.18ms' },
      { label: 'RUNTIME OVERHEAD', val: '0.00%' },
      { label: 'HASH SPECIFICATION', val: 'SHA-256 DAG' },
    ],
  },
  {
    id: 'layer-2',
    num: '02',
    title: 'Causal Anomaly Isolation',
    sub: 'Graph Neural Network step attribution',
    desc: 'When an agent hallucinates or crashes at Step 08, the poison was often planted in Step 02. Black Box back-propagates causal responsibility along data-dependency edges to calculate exact Shapley values and isolate the root cause.',
    tag: '99.4% Precision',
    color: 'text-rose-400',
    borderColor: 'border-rose-500/40',
    bg: 'bg-rose-500/10',
    glow: 'rgba(244, 63, 94, 0.15)',
    metrics: [
      { label: 'ATTRIBUTION PRECISION', val: '99.4%' },
      { label: 'ATTRIBUTION KERNEL', val: 'GNN Shapley' },
      { label: 'ISOLATION SPEED', val: '42ms' },
    ],
  },
  {
    id: 'layer-3',
    num: '03',
    title: 'Counterfactual Replay Fork',
    sub: 'Scientific proof with zero API model burn',
    desc: 'Re-runs the exact execution with only the suspect step repaired. Unchanged upstream steps execute instantaneously from recorded memory cache, costing $0.00 and zero tokens to prove causality.',
    tag: 'Zero Tokens',
    color: 'text-emerald-400',
    borderColor: 'border-emerald-500/40',
    bg: 'bg-emerald-500/10',
    glow: 'rgba(16, 185, 129, 0.15)',
    metrics: [
      { label: 'REPLAY TOKEN COST', val: '$0.00' },
      { label: 'MEMORY CACHE HIT', val: '100%' },
      { label: 'VERIFICATION SPEED', val: '45x Faster' },
    ],
  },
  {
    id: 'layer-4',
    num: '04',
    title: 'Fleet Regression Firewall',
    sub: 'Automated CI/CD safety barrier for agent swarms',
    desc: 'Before any prompt or tool repair is merged to production, Black Box automatically replays the fix across historical passing and failing agent runs. Approves deployment only if regressions are strictly zero.',
    tag: 'Zero Regressions',
    color: 'text-cyan-400',
    borderColor: 'border-cyan-500/40',
    bg: 'bg-cyan-500/10',
    glow: 'rgba(56, 189, 248, 0.15)',
    metrics: [
      { label: 'REGRESSION RATE', val: '0.00%' },
      { label: 'HISTORICAL RUNS', val: '10,000+' },
      { label: 'MERGE GATEWAY', val: 'Deterministic' },
    ],
  },
];

const ROTATION_INTERVAL = 6000; // 6 seconds per card

export const DeconstructedEngineStage: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);

  const activeLayer = LAYERS[activeTab];

  // Auto-rotation timer and progress line
  useEffect(() => {
    if (isPaused) return;

    const stepMs = 50;
    const progressInc = (stepMs / ROTATION_INTERVAL) * 100;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setActiveTab((cur) => (cur + 1) % LAYERS.length);
          return 0;
        }
        return prev + progressInc;
      });
    }, stepMs);

    return () => clearInterval(interval);
  }, [isPaused, activeTab]);

  const handleSelectTab = (idx: number) => {
    setActiveTab(idx);
    setProgress(0);
  };

  const handlePrev = () => {
    setActiveTab((prev) => (prev - 1 + LAYERS.length) % LAYERS.length);
    setProgress(0);
  };

  const handleNext = () => {
    setActiveTab((prev) => (prev + 1) % LAYERS.length);
    setProgress(0);
  };

  return (
    <section id="causal-engine" className="relative py-24 sm:py-32 bg-[#08090c] border-t border-white/[0.06] overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        {/* Main Heading (Clean, Monumental, Editorial) */}
        <div className="max-w-3xl mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-md mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[11px] font-mono tracking-widest text-zinc-300 uppercase">
              02 / Causal Architecture
            </span>
          </div>

          <h2 className="font-serif text-4xl sm:text-6xl md:text-7xl font-light tracking-tight text-white leading-[1.05]">
            The Causal Core.{' '}
            <span className="italic font-normal text-zinc-400">
              Not logs. Not heuristics. Mathematical proof.
            </span>
          </h2>
        </div>

        {/* Side-by-Side: Rotating Layer Card on Left, 3D Silicon Microprocessor on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left: Rotating 4-Layer Card */}
          <div className="lg:col-span-6 flex flex-col">
            <div
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
              className="apple-glass-card rounded-3xl p-6 sm:p-10 border border-white/10 shadow-2xl relative overflow-hidden backdrop-blur-2xl transition-all duration-500"
              style={{
                boxShadow: `0 30px 80px -15px ${activeLayer.glow}, inset 0 1px 0 rgba(255, 255, 255, 0.1)`,
              }}
            >
              {/* Dynamic Top Progress Line for Auto-Rotation */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/[0.06]">
                <div
                  className="h-full bg-amber-400 transition-all duration-75"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Step Navigation Pills & Controls Bar */}
              <div className="flex items-center justify-between gap-3 mb-8">
                {/* 4 Layer Step Selectors */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {LAYERS.map((layer, idx) => {
                    const isCur = activeTab === idx;
                    return (
                      <button
                        key={layer.id}
                        onClick={() => handleSelectTab(idx)}
                        className={`px-3 py-1.5 rounded-full text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5 ${
                          isCur
                            ? `${layer.bg} ${layer.color} border ${layer.borderColor} shadow-md`
                            : 'bg-white/[0.03] text-zinc-400 hover:text-white border border-white/[0.06]'
                        }`}
                      >
                        <span className="font-semibold">{layer.num}</span>
                        <span className="hidden sm:inline text-[11px]">
                          {idx === 0 && 'Ingestion'}
                          {idx === 1 && 'Anomaly'}
                          {idx === 2 && 'Replay'}
                          {idx === 3 && 'Firewall'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Arrow Controls & Pause Indicator */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIsPaused(!isPaused)}
                    className="p-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors cursor-pointer border border-white/[0.06]"
                    title={isPaused ? 'Resume auto-rotation' : 'Pause auto-rotation'}
                  >
                    {isPaused ? <Play className="w-3.5 h-3.5 text-amber-400" /> : <Pause className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={handlePrev}
                    className="p-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors cursor-pointer border border-white/[0.06]"
                    title="Previous layer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleNext}
                    className="p-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors cursor-pointer border border-white/[0.06]"
                    title="Next layer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Active Card Body with Smooth Key Transitions */}
              <div key={activeLayer.id} className="animate-fade-in flex flex-col gap-4">
                {/* Layer Badge & Index */}
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-mono font-bold tracking-widest ${activeLayer.color}`}>
                    LAYER {activeLayer.num} / 04
                  </span>
                  <span className={`text-[10px] font-mono px-3 py-1 rounded-full border ${activeLayer.borderColor} ${activeLayer.bg} ${activeLayer.color} font-semibold uppercase tracking-wider`}>
                    {activeLayer.tag}
                  </span>
                </div>

                {/* Layer Title (Editorial Serif & Crisp Precision) */}
                <h3 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-normal text-white tracking-tight leading-snug">
                  {activeLayer.title}
                </h3>

                {/* Subtitle */}
                <p className="text-sm sm:text-base font-medium text-zinc-300">
                  {activeLayer.sub}
                </p>

                {/* Technical Description */}
                <p className="text-xs sm:text-sm text-zinc-400 font-light leading-relaxed">
                  {activeLayer.desc}
                </p>

                {/* 3 Telemetry Metrics for Active Layer */}
                <div className="grid grid-cols-3 gap-3 pt-6 mt-4 border-t border-white/[0.08]">
                  {activeLayer.metrics.map((m, mIdx) => (
                    <div key={mIdx} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
                      <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider truncate mb-1">
                        {m.label}
                      </div>
                      <div className={`text-sm sm:text-base font-mono font-semibold ${mIdx === 0 ? activeLayer.color : 'text-white'}`}>
                        {m.val}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Subtle Interaction Helper */}
              <div className="mt-6 flex items-center justify-between text-[11px] font-mono text-zinc-500 pt-3 border-t border-white/[0.04]">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400/80" />
                  <span>Photolithographic 4nm Silicon Micro-Architecture</span>
                </div>
                <span>Hover to pause</span>
              </div>
            </div>
          </div>

          {/* Right: 3D Silicon Microprocessor Core Hovering in Open Space */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center relative">
            <SiliconCore3D activeLayerName={activeLayer.title} />

            {/* Apple Keynote Telemetry Stats Beneath 3D Model */}
            <div className="grid grid-cols-3 gap-4 w-full mt-4">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
                <div className="text-xl sm:text-2xl font-semibold text-white tracking-tight font-mono">
                  &lt; 0.2ms
                </div>
                <div className="text-[10px] font-mono text-zinc-500 uppercase mt-1">
                  Ingestion Delay
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
                <div className="text-xl sm:text-2xl font-semibold text-emerald-400 tracking-tight font-mono">
                  $0.00
                </div>
                <div className="text-[10px] font-mono text-zinc-500 uppercase mt-1">
                  Replay Cost
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
                <div className="text-xl sm:text-2xl font-semibold text-cyan-400 tracking-tight font-mono">
                  100%
                </div>
                <div className="text-[10px] font-mono text-zinc-500 uppercase mt-1">
                  Bit Reproducibility
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
