import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Network, Database, ShieldAlert, Cpu, ArrowRight } from 'lucide-react';

interface FailureFamily {
  id: string;
  name: string;
  count: number;
  pct: number;
  centroid: { x: number; y: number };
  sampleRuns: string[];
  rootCause: string;
  color: string;
}

const FAMILIES: FailureFamily[] = [
  {
    id: 'F-01',
    name: 'SCHEMA DRIFT & UNHANDLED NULLS',
    count: 142,
    pct: 34,
    centroid: { x: 32, y: 38 },
    sampleRuns: ['run_apac_settle_09', 'run_emea_ledger_44', 'run_fx_sweep_12'],
    rootCause: 'Database tools dropping optional columns silently; downstream LLMs defaulting to 0.0 without alert.',
    color: '#ef4444',
  },
  {
    id: 'F-02',
    name: 'TOOL LATENCY & HTTP TIMEOUTS',
    count: 118,
    pct: 28,
    centroid: { x: 68, y: 32 },
    sampleRuns: ['run_crm_sync_02', 'run_quote_fetch_88', 'run_kyc_verify_17'],
    rootCause: 'Upstream gateway latency exceeding 2.5s threshold, leading to truncated tool payloads.',
    color: '#f59e0b',
  },
  {
    id: 'F-03',
    name: 'HALLUCINATED SQL SYNTAX',
    count: 94,
    pct: 22,
    centroid: { x: 42, y: 72 },
    sampleRuns: ['run_billing_gen_99', 'run_tax_calc_04', 'run_ledger_audit_51'],
    rootCause: 'LLM planner inventing PostgreSQL dialect dialect functions inside SQLite storage shards.',
    color: '#a855f7',
  },
  {
    id: 'F-04',
    name: 'CONTEXT OVERFLOW & MEMORY LEAK',
    count: 68,
    pct: 16,
    centroid: { x: 74, y: 68 },
    sampleRuns: ['run_doc_digest_10', 'run_case_study_23', 'run_policy_eval_08'],
    rootCause: 'RAG retrieval injecting oversized markdown tables, starving output generation tokens.',
    color: '#38bdf8',
  },
];

export const Chapter06Pattern: React.FC = () => {
  const [selectedFamily, setSelectedFamily] = useState<FailureFamily>(FAMILIES[0]);

  return (
    <section
      id="ch-06"
      className="relative py-28 px-6 sm:px-12 md:px-20 font-sans border-b border-[#1f2937]/50 bg-[#070a10]"
    >
      <div className="max-w-6xl mx-auto">
        {/* Chapter Header */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 mb-3 text-xs font-mono text-purple-400">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            <span className="uppercase">CHAPTER 06 // THE PATTERN</span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-500">FLEET FAILURE ATLAS</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-light text-white uppercase tracking-tight mb-4">
            From one failure <br />
            <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-300 to-cyan-300">
              to fleet patterns.
            </span>
          </h2>

          <p className="text-base sm:text-lg text-zinc-400 font-normal max-w-2xl leading-relaxed">
            Isolated crashes are rarely unique. The Failure Atlas maps high-dimensional execution graphs into
            recurring failure clusters. One root-cause patch cures dozens of production incidents across your fleet.
          </p>
        </div>

        {/* Failure Atlas Controlled Cluster Instrument */}
        <div className="bg-[#090d16] border border-[#1f2937] rounded-lg p-6 font-mono shadow-2xl">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between pb-4 border-b border-[#1f2937] gap-3 text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <Network className="w-4 h-4 text-purple-400" />
              <span className="text-white font-bold">FAILURE TOPOLOGY SPACE: 422 HISTORICAL INCIDENTS</span>
            </div>

            <div className="text-[10px] text-zinc-500">
              CLUSTER ENGINE: UMAP PROJECTION + GNN EMBEDDINGS
            </div>
          </div>

          {/* Interactive Split Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6 items-stretch">
            {/* Left: Controlled Constellation Canvas (7 cols) */}
            <div className="lg:col-span-7 relative min-h-[360px] bg-[#05070a] border border-[#1f2937] rounded p-4 flex flex-col justify-between overflow-hidden">
              {/* Subtle Grid coordinate lines */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293720_1px,transparent_1px),linear-gradient(to_bottom,#1f293720_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

              {/* Connecting Cluster Edges */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {FAMILIES.map((fam) => (
                  <circle
                    key={fam.id}
                    cx={`${fam.centroid.x}%`}
                    cy={`${fam.centroid.y}%`}
                    r={selectedFamily.id === fam.id ? '28' : '18'}
                    fill="none"
                    stroke={fam.color}
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    className="opacity-40 transition-all duration-300"
                  />
                ))}
              </svg>

              {/* Interactive Centroids */}
              <div className="absolute inset-0">
                {FAMILIES.map((fam) => {
                  const isSelected = fam.id === selectedFamily.id;
                  return (
                    <button
                      key={fam.id}
                      onClick={() => setSelectedFamily(fam)}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all ${
                        isSelected ? 'scale-125 z-20' : 'hover:scale-110 z-10'
                      }`}
                      style={{ left: `${fam.centroid.x}%`, top: `${fam.centroid.y}%` }}
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 shadow-lg"
                        style={{
                          backgroundColor: `${fam.color}25`,
                          borderColor: fam.color,
                          color: '#ffffff',
                          boxShadow: isSelected ? `0 0 16px ${fam.color}80` : undefined,
                        }}
                      >
                        {fam.id}
                      </div>
                      <span className="block mt-1 text-[9px] text-zinc-400 font-mono whitespace-nowrap bg-black/80 px-1 py-0.5 rounded border border-zinc-800">
                        {fam.count} runs
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Canvas Corner Meta */}
              <div className="relative z-10 flex justify-between text-[9px] text-zinc-600">
                <span>AXIS-X: TOPOLOGY DRIFT</span>
                <span>AXIS-Y: ERROR PROPAGATION</span>
              </div>
            </div>

            {/* Right: Active Cluster Deep-Dive Dossier (5 cols) */}
            <div className="lg:col-span-5 p-5 rounded bg-[#06080d] border border-[#1a2333] space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs pb-3 border-b border-zinc-800 mb-3">
                  <span className="font-bold text-white">
                    CLUSTER {selectedFamily.id} // {selectedFamily.name}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-bold"
                    style={{ backgroundColor: `${selectedFamily.color}20`, color: selectedFamily.color }}
                  >
                    {selectedFamily.pct}% OF FLEET
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase">IDENTIFIED CAUSAL PATTERN:</span>
                    <p className="text-zinc-300 font-sans leading-relaxed mt-1">
                      {selectedFamily.rootCause}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase">REPRESENTATIVE REPLAY SHARDS:</span>
                    <div className="mt-1 space-y-1">
                      {selectedFamily.sampleRuns.map((r) => (
                        <div key={r} className="p-1.5 rounded bg-black/60 border border-zinc-800 text-[10px] text-cyan-400 font-mono flex items-center justify-between">
                          <span>{r}</span>
                          <span className="text-zinc-600">ISOLATED</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-800 text-[10px] text-zinc-500 flex items-center justify-between">
                <span>ACTIONABLE FLEET REPAIR:</span>
                <span className="text-emerald-400 font-bold">1 PATCH DEPLOYED</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
