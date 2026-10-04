import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll } from 'framer-motion';
import { Network, Sparkles, AlertTriangle, CheckCircle, ArrowRight, ShieldCheck, Database, RotateCcw } from 'lucide-react';

interface AtlasCluster {
  id: string;
  name: string;
  faultCode: string;
  count: number;
  color: string;
  cx: number; // percentage
  cy: number; // percentage
  nodes: { x: number; y: number }[];
  symptoms: string;
  affectedFamilies: string[];
  canonicalFix: string;
  fixSuccessRate: string;
}

const CLUSTERS: AtlasCluster[] = [
  {
    id: 'f1',
    name: 'Tool Schema Drift',
    faultCode: 'F1',
    count: 482,
    color: '#38bdf8',
    cx: 28,
    cy: 35,
    nodes: [
      { x: 25, y: 32 }, { x: 30, y: 38 }, { x: 26, y: 40 }, { x: 32, y: 30 }, { x: 23, y: 36 }
    ],
    symptoms: 'Tool JSON API renames or omits expected keys, causing downstream parser to crash with KeyError or silent zero-fallbacks.',
    affectedFamilies: ['Financial Ops', 'Warehouse SQL', 'E-commerce Shop'],
    canonicalFix: 'Pydantic contract validation adapter at tool boundary with automatic retry on key mismatch.',
    fixSuccessRate: '98.4%',
  },
  {
    id: 'f4',
    name: 'Hallucinated Constraint',
    faultCode: 'F4',
    count: 319,
    color: '#a855f7',
    cx: 72,
    cy: 30,
    nodes: [
      { x: 69, y: 28 }, { x: 75, y: 34 }, { x: 74, y: 26 }, { x: 70, y: 35 }, { x: 77, y: 31 }
    ],
    symptoms: 'Planner LLM invents non-existent database parameters or restrictive filters not requested by the user.',
    affectedFamilies: ['QA Search', 'Customer Support', 'HotpotQA'],
    canonicalFix: 'Schema reflection step that asserts all query parameters exist in the active ontology.',
    fixSuccessRate: '94.1%',
  },
  {
    id: 'f7',
    name: 'Context Window Truncation',
    faultCode: 'F7',
    count: 240,
    color: '#f59e0b',
    cx: 45,
    cy: 70,
    nodes: [
      { x: 42, y: 68 }, { x: 48, y: 72 }, { x: 44, y: 75 }, { x: 49, y: 66 }, { x: 40, y: 71 }
    ],
    symptoms: 'Prompt length exceeds model attention window, silently truncating initial instructions and user constraints.',
    affectedFamilies: ['Document Summarization', 'Multi-turn Ops'],
    canonicalFix: 'Hierarchical chunk compression checkpoint prior to final synthesis.',
    fixSuccessRate: '91.8%',
  },
  {
    id: 'f2',
    name: 'Infinite Retry Loop',
    faultCode: 'F2',
    count: 188,
    color: '#ef4444',
    cx: 78,
    cy: 72,
    nodes: [
      { x: 75, y: 70 }, { x: 81, y: 74 }, { x: 77, y: 76 }, { x: 80, y: 68 }
    ],
    symptoms: 'Agent retries failed external API requests with identical payload without adjusting parameters.',
    affectedFamilies: ['Web Scraping', 'Payment Gateway'],
    canonicalFix: 'Exponential backoff with parameter jitter and circuit breaker threshold at 3 attempts.',
    fixSuccessRate: '99.2%',
  },
];

export const FailureAtlasSection: React.FC = () => {
  const [selectedCluster, setSelectedCluster] = useState<AtlasCluster>(CLUSTERS[0]);

  const handleClusterClick = (cl: AtlasCluster) => {
    setSelectedCluster(cl);
  };

  return (
    <section id="atlas" className="relative py-20 md:py-32 border-t border-[#1f2937]/80 bg-[#070a10]">
      <div className="max-w-[1400px] mx-auto px-6 font-sans">
        {/* Section Eyebrow */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-2 mb-3 font-mono text-xs text-purple-400"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
          <span className="tracking-widest uppercase font-semibold">07 // PATTERN RECOGNITION</span>
        </motion.div>

        {/* Section Headline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mb-8"
        >
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-[1.1] uppercase">
            FAILURES BECOME PATTERNS.
            <br />
            <span className="text-zinc-400">NEVER DEBUG THE SAME BUG TWICE.</span>
          </h2>
          <p className="text-sm sm:text-base text-zinc-400 mt-4 leading-relaxed">
            Across thousands of production agent runs, failures are rarely unique. Black Box groups
            error fingerprints into morphological clusters, letting you apply proven counterfactual
            fixes across entire failure families.
          </p>
        </motion.div>

        {/* Interactive Scrub Status Bar */}
        <div className="mb-8 p-3 rounded-lg bg-[#0b0f17] border border-[#1f2937] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            <span className="text-zinc-400">ATLAS CONSTELLATION CLUSTER:</span>
            <span className="text-white font-bold" style={{ color: selectedCluster.color }}>
              [{selectedCluster.faultCode}] {selectedCluster.name}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-zinc-500 text-[11px] font-mono">
              INCIDENTS: <span className="text-purple-400 font-bold">{selectedCluster.count}</span>
            </span>
          </div>
        </div>

        {/* Constellation Canvas & Cluster Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Constellation Map (7 cols) */}
          <div className="lg:col-span-7 bg-[#0b0f17] border border-[#1f2937] rounded-lg p-6 relative min-h-[380px] overflow-hidden flex flex-col justify-between font-mono">
            {/* Grid & Centroid Rings */}
            <div className="absolute inset-0 bg-[radial-gradient(#1f2937_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none opacity-40" />

            {/* Connecting lines between nodes in clusters */}
            {/* Connecting lines and satellite points */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {CLUSTERS.map((cl) => {
                const isSelected = selectedCluster.id === cl.id;
                return (
                  <g key={cl.id}>
                    {cl.nodes.map((n, i) => (
                      <g key={i}>
                        <line
                          x1={`${cl.cx}%`}
                          y1={`${cl.cy}%`}
                          x2={`${n.x}%`}
                          y2={`${n.y}%`}
                          stroke={cl.color}
                          strokeWidth="1"
                          strokeOpacity={isSelected ? '0.6' : '0.15'}
                        />
                        <circle
                          cx={`${n.x}%`}
                          cy={`${n.y}%`}
                          r={isSelected ? '2.5' : '1.5'}
                          fill={cl.color}
                          opacity={isSelected ? 0.9 : 0.4}
                        />
                      </g>
                    ))}
                    {/* Outer boundary ring with dynamic orbital animation */}
                    <motion.circle
                      cx={`${cl.cx}%`}
                      cy={`${cl.cy}%`}
                      r={isSelected ? '38' : '28'}
                      fill="none"
                      stroke={cl.color}
                      strokeWidth={isSelected ? '1.5' : '1'}
                      strokeDasharray="4 4"
                      animate={{
                        strokeDashoffset: [0, 50],
                      }}
                      transition={{
                        duration: 14,
                        repeat: Infinity,
                        ease: 'linear',
                      }}
                      strokeOpacity={isSelected ? 0.9 : 0.3}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Interactive Cluster Centroids */}
            <div className="relative z-10 w-full h-full min-h-[300px]">
              {CLUSTERS.map((cl) => {
                const isSelected = selectedCluster.id === cl.id;
                return (
                  <motion.button
                    key={cl.id}
                    whileHover={{ scale: 1.08, zIndex: 30 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedCluster(cl)}
                    className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300 group focus:outline-none"
                    style={{ left: `${cl.cx}%`, top: `${cl.cy}%` }}
                    aria-label={`Select cluster ${cl.name}`}
                  >
                    {/* Centroid Core */}
                    <div
                      className={`px-3 py-1.5 rounded-full border text-xs font-mono font-bold flex items-center gap-2 transition-all ${
                        isSelected
                          ? 'border-white bg-[#05070b] text-white shadow-lg ring-2 ring-white/50'
                          : 'border-zinc-700 bg-[#070a10] text-zinc-300 hover:border-zinc-500'
                      }`}
                      style={{
                        borderColor: isSelected ? cl.color : undefined,
                        boxShadow: isSelected ? `0 0 20px ${cl.color}40` : undefined,
                      }}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cl.color }} />
                      <span>{cl.faultCode}: {cl.name}</span>
                      <span className="text-[10px] text-zinc-500 font-normal">({cl.count})</span>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* Map Readout Footer */}
            <div className="relative z-10 pt-3 border-t border-[#1f2937] flex items-center justify-between text-[11px] text-zinc-500">
              <span>TOPOLOGICAL EMBEDDINGS (DIM: 384 → 2D UMAP)</span>
              <span>TOTAL CLUSTERED RUNS: 1,229</span>
            </div>
          </div>

          {/* Right Column: Cluster Detail Inspector (5 cols) */}
          <div className="lg:col-span-5 bg-[#0b0f17] border border-[#1f2937] rounded-lg p-6 flex flex-col justify-between font-mono text-xs">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#1f2937]">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: selectedCluster.color }}
                  />
                  <span className="font-bold text-white uppercase text-sm">
                    {selectedCluster.name}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] font-bold">
                  {selectedCluster.faultCode}
                </span>
              </div>

              {/* Symptoms Description */}
              <div className="space-y-1">
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">SYMPTOM MANIFESTATION:</p>
                <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                  {selectedCluster.symptoms}
                </p>
              </div>

              {/* Affected Families */}
              <div className="space-y-1 pt-2">
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">AFFECTED AGENT FAMILIES:</p>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {selectedCluster.affectedFamilies.map((fam, i) => (
                    <span key={i} className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 text-[10px]">
                      {fam}
                    </span>
                  ))}
                </div>
              </div>

              {/* Canonical Verified Fix */}
              <div className="p-3.5 rounded bg-[#070a10] border border-[#1f2937] space-y-2 mt-2">
                <div className="flex items-center justify-between text-[10px] text-emerald-400 font-bold uppercase">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> CANONICAL VERIFIED REPAIR:
                  </span>
                  <span>{selectedCluster.fixSuccessRate} FIX RATE</span>
                </div>
                <p className="text-xs text-zinc-200 font-sans leading-relaxed">
                  {selectedCluster.canonicalFix}
                </p>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-[#1f2937] flex items-center justify-between text-[11px]">
              <span className="text-zinc-500">{selectedCluster.count} SIMILAR CASES INDEXED</span>
              <button
                onClick={() => {}}
                className="text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1 cursor-pointer font-bold"
              >
                <span>EXPLORE ATLAS</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
