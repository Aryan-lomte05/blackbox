import React, { useState, useEffect, useRef } from 'react';
import { motion, useScroll } from 'framer-motion';
import { Cpu, Wrench, Database, CheckCircle2, AlertTriangle, Eye, ShieldCheck, ArrowRight, CornerDownRight, RotateCcw } from 'lucide-react';

interface GraphNodeData {
  id: number;
  label: string;
  kind: 'input' | 'retrieval' | 'llm' | 'tool' | 'final';
  x: number;
  y: number;
  tokens: number;
  latencyMs: number;
  isGuilty?: boolean;
  isContaminated?: boolean;
  suspectRank?: number;
  alarmScore: number;
  checkerTier: string;
  inputPayload: string;
  outputPayload: string;
  evidence: string;
}

const GRAPH_NODES: GraphNodeData[] = [
  {
    id: 0,
    label: 'TASK DISPATCH',
    kind: 'input',
    x: 80,
    y: 80,
    tokens: 65,
    latencyMs: 14,
    alarmScore: 0.0,
    checkerTier: 'system',
    inputPayload: '{"task": "Analyze Q3 APAC margins across customer tiers and emit settlement schedule"}',
    outputPayload: '{"status": "dispatched", "task_id": "apac-fin-9982"}',
    evidence: 'Initial prompt entered cleanly. No anomalies in initial context window.',
  },
  {
    id: 1,
    kind: 'retrieval',
    label: 'VECTOR KNOWLEDGE',
    x: 280,
    y: 80,
    tokens: 380,
    latencyMs: 110,
    alarmScore: 0.08,
    checkerTier: 'laya_local',
    inputPayload: '{"query": "APAC FX rates Q3 and tier margin thresholds"}',
    outputPayload: '{"chunks_returned": 4, "top_match": "doc_id_891: FX tables JPY/SGD/USD"}',
    evidence: 'Vector embeddings retrieved matching schema documentation and valid currency pegs.',
  },
  {
    id: 2,
    kind: 'llm',
    label: 'LLM PLANNER',
    x: 480,
    y: 80,
    tokens: 620,
    latencyMs: 440,
    alarmScore: 0.12,
    checkerTier: 'laya_local',
    inputPayload: '{"prompt": "Construct SQL query to extract all APAC settlement ledgers with FX rate normalization"}',
    outputPayload: '{"plan": "Call tool query_warehouse with generated SQL query string"}',
    evidence: 'Planner correctly outlined SQL joining requirements and target columns.',
  },
  {
    id: 3,
    kind: 'tool',
    label: 'WAREHOUSE SQL',
    x: 480,
    y: 220,
    tokens: 210,
    latencyMs: 310,
    isGuilty: true,
    suspectRank: 1,
    alarmScore: 0.94,
    checkerTier: 'laya_local',
    inputPayload: '{"sql": "SELECT account_id, currency, raw_amount FROM apac_ledger WHERE qtr = \'Q3\'"}',
    outputPayload: '{"rows": [{"account_id": "A1", "raw_amount": 140000}], "columns_missing": ["currency"]}',
    evidence: 'GUILTY ROOT CAUSE: SQL statement omitted the currency column. Returned rows cannot be converted.',
  },
  {
    id: 4,
    kind: 'llm',
    label: 'LLM PARSER',
    x: 680,
    y: 220,
    tokens: 580,
    latencyMs: 390,
    isContaminated: true,
    suspectRank: 2,
    alarmScore: 0.76,
    checkerTier: 'jev_sdk',
    inputPayload: '{"rows": [{"account_id": "A1", "raw_amount": 140000}], "instruction": "Apply FX conversion"}',
    outputPayload: '{"converted": [{"account_id": "A1", "usd_amount": 0.0}], "warning": "null currency assumed zero"}',
    evidence: 'CONTAMINATED: Silent fallback. Rather than failing, parser assumed 0.0 exchange rate.',
  },
  {
    id: 5,
    kind: 'tool',
    label: 'CALCULATE MARGINS',
    x: 880,
    y: 220,
    tokens: 140,
    latencyMs: 65,
    isContaminated: true,
    alarmScore: 0.82,
    checkerTier: 'laya_local',
    inputPayload: '{"usd_amount": 0.0, "tier_rate": 0.15}',
    outputPayload: '{"margin": 0.0, "pnl": 0.0}',
    evidence: 'CONTAMINATED: Downstream mathematical module calculated 0 margin based on zeroed inputs.',
  },
  {
    id: 6,
    kind: 'final',
    label: 'EMIT SCHEDULE',
    x: 880,
    y: 80,
    tokens: 95,
    latencyMs: 25,
    isContaminated: true,
    alarmScore: 1.0,
    checkerTier: 'system',
    inputPayload: '{"margin": 0.0, "pnl": 0.0}',
    outputPayload: '{"status": "crashed", "error": "ZeroRevenueThresholdException: cannot emit zero report"}',
    evidence: 'CRASH LOCATION: Terminal stage rejected zero revenue. Symptom of upstream tool error #3.',
  },
];

export const ForensicGraphSection: React.FC = () => {
  const [selectedNode, setSelectedNode] = useState<GraphNodeData>(GRAPH_NODES[3]);
  const [filterMode, setFilterMode] = useState<'all' | 'guilty' | 'path'>('all');

  const handleFilterClick = (mode: 'all' | 'guilty' | 'path') => {
    setFilterMode(mode);
    if (mode === 'guilty') setSelectedNode(GRAPH_NODES[3]);
    if (mode === 'path') setSelectedNode(GRAPH_NODES[4]);
    if (mode === 'all') setSelectedNode(GRAPH_NODES[2]);
  };

  return (
    <section id="forensics" className="relative py-20 md:py-32 border-t border-[#1f2937]/80 bg-[#05070b]">
      <div className="max-w-[1400px] mx-auto px-6 font-sans">
        {/* Section Eyebrow */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-2 mb-3 font-mono text-xs text-cyan-400"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          <span className="tracking-widest uppercase font-semibold">04 // EXECUTION TOPOLOGY</span>
        </motion.div>

        {/* Section Headline */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div className="max-w-2xl">
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-[1.1] uppercase">
              THE FORENSIC GRAPH.
              <br />
              <span className="text-zinc-400">EVERY STEP. EVERY LINK. PROVEN.</span>
            </h2>
            <p className="text-sm sm:text-base text-zinc-400 mt-4 leading-relaxed">
              Explore the actual execution DAG. Black Box tracks data-flow and causal dependencies
              across tools, LLMs, and memory checkpoints to pinpoint exactly where state mutated.
            </p>
          </div>

          {/* Filter Mode Selector & Scroll Scrub Badge */}
          <div className="flex flex-col items-end gap-2 self-start md:self-end">
            <div className="flex items-center gap-1 bg-[#0b0f17] p-1 rounded border border-[#1f2937] text-xs font-mono">
              <button
                onClick={() => handleFilterClick('all')}
                className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                  filterMode === 'all' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                All Steps
              </button>
              <button
                onClick={() => handleFilterClick('guilty')}
                className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                  filterMode === 'guilty' ? 'bg-red-950 text-red-300 font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Guilty (#3)
              </button>
              <button
                onClick={() => handleFilterClick('path')}
                className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                  filterMode === 'path' ? 'bg-amber-950 text-amber-300 font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Contamination Trail
              </button>
            </div>

            <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500">
              <span>{GRAPH_NODES.length} IMMUTABLE SAVE-POINTS</span>
            </div>
          </div>
        </div>

        {/* Graph Instrument Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-[#070a10] border border-[#1f2937] rounded-lg p-4 md:p-6 shadow-2xl">
          {/* Main Visual Topology Area (8 cols) */}
          <div className="lg:col-span-8 relative min-h-[380px] bg-[#0b0f17] border border-[#1f2937] rounded-lg p-4 md:p-6 overflow-x-auto overflow-y-hidden">
            <div className="relative min-w-[620px] w-full min-h-[320px]">
              {/* Background Dot Matrix */}
              <div className="absolute inset-0 bg-[radial-gradient(#1f2937_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none opacity-40" />

              {/* SVG Connecting Edges */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#374151" />
                </marker>
                <marker id="arrow-guilty" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
                </marker>
              </defs>

              {/* Edge 0 -> 1 */}
              <line x1="16%" y1="28%" x2="30%" y2="28%" stroke="#374151" strokeWidth="1.5" />
              {/* Edge 1 -> 2 */}
              <line x1="38%" y1="28%" x2="52%" y2="28%" stroke="#374151" strokeWidth="1.5" />
              {/* Edge 2 -> 3 (to guilty) */}
              <line
                x1="57%"
                y1="36%"
                x2="57%"
                y2="66%"
                stroke={filterMode === 'guilty' || filterMode === 'path' ? '#ef4444' : '#ef4444'}
                strokeWidth="2"
                strokeDasharray="4 4"
                className="animate-pulse"
              />
              {/* Edge 3 -> 4 (contamination) */}
              <line
                x1="62%"
                y1="72%"
                x2="73%"
                y2="72%"
                stroke="#f59e0b"
                strokeWidth="2"
              />
              {/* Edge 4 -> 5 */}
              <line
                x1="81%"
                y1="72%"
                x2="90%"
                y2="72%"
                stroke="#f59e0b"
                strokeWidth="2"
              />
              {/* Edge 5 -> 6 (to crash) */}
              <line
                x1="94%"
                y1="66%"
                x2="94%"
                y2="36%"
                stroke="#f59e0b"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              {/* Edge 2 -> 6 (intended path bypassed) */}
              <line
                x1="62%"
                y1="28%"
                x2="88%"
                y2="28%"
                stroke="#1f2937"
                strokeWidth="1"
                strokeDasharray="5 5"
              />

              {/* Animated Normal Pulse traveling 0 -> 1 -> 2 */}
              <motion.circle
                r="3"
                fill="#38bdf8"
                animate={{ cx: ['16%', '52%'], cy: ['28%', '28%'], opacity: [0, 1, 1, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
              />

              {/* Animated Fault Injection Beam traveling 2 -> 3 (Guilty Root) */}
              <motion.circle
                r="4"
                fill="#ef4444"
                animate={{ cx: ['57%', '57%'], cy: ['36%', '66%'], opacity: [0, 1, 1, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
              />

              {/* Animated Contamination Stream traveling 3 -> 4 */}
              <motion.circle
                r="3.5"
                fill="#f59e0b"
                animate={{ cx: ['62%', '73%'], cy: ['72%', '72%'], opacity: [0, 1, 1, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear', delay: 1.0 }}
              />

              {/* Animated Contamination Stream traveling 4 -> 5 */}
              <motion.circle
                r="3.5"
                fill="#f59e0b"
                animate={{ cx: ['81%', '90%'], cy: ['72%', '72%'], opacity: [0, 1, 1, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear', delay: 1.4 }}
              />

              {/* Crash Impact Pulse traveling 5 -> 6 */}
              <motion.circle
                r="4"
                fill="#ef4444"
                animate={{ cx: ['94%', '94%'], cy: ['66%', '36%'], opacity: [0, 1, 1, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeIn', delay: 1.8 }}
              />
            </svg>

            {/* Interactive Graph Nodes */}
            <div className="relative z-10 w-full h-full flex flex-col justify-between py-2">
              {/* Top Row: Steps 0, 1, 2, 6 */}
              <div className="flex items-center justify-between">
                {[GRAPH_NODES[0], GRAPH_NODES[1], GRAPH_NODES[2], GRAPH_NODES[6]].map((node) => {
                  const isSelected = selectedNode.id === node.id;
                  const isDimmed =
                    (filterMode === 'guilty' && !node.isGuilty) ||
                    (filterMode === 'path' && !node.isGuilty && !node.isContaminated);

                  return (
                    <div
                      key={node.id}
                      onClick={() => setSelectedNode(node)}
                      className={`p-3 rounded border text-left cursor-pointer transition-all duration-200 w-32 md:w-36 ${
                        isDimmed ? 'opacity-30' : 'opacity-100'
                      } ${
                        isSelected
                          ? 'border-cyan-400 bg-cyan-950/40 shadow-lg shadow-cyan-950/40 ring-1 ring-cyan-400'
                          : node.isContaminated
                          ? 'border-amber-800 bg-amber-950/30 hover:border-amber-600'
                          : 'border-[#1f2937] hover:border-zinc-500 bg-[#0b0f17]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                        <span className="text-zinc-500">#{node.id}</span>
                        <span className="text-zinc-400 uppercase">{node.kind}</span>
                      </div>
                      <p className="text-xs font-bold text-white truncate">{node.label}</p>
                      <p className="text-[10px] font-mono text-zinc-500 mt-1">{node.latencyMs}ms</p>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Row: Steps 3 (GUILTY), 4, 5 */}
              <div className="flex items-center justify-center gap-6 md:gap-12 mt-12 pl-24">
                {[GRAPH_NODES[3], GRAPH_NODES[4], GRAPH_NODES[5]].map((node) => {
                  const isSelected = selectedNode.id === node.id;
                  const isDimmed =
                    (filterMode === 'guilty' && !node.isGuilty) ||
                    (filterMode === 'path' && !node.isGuilty && !node.isContaminated);

                  return (
                    <div
                      key={node.id}
                      onClick={() => setSelectedNode(node)}
                      className={`p-3 rounded border text-left cursor-pointer transition-all duration-200 w-32 md:w-36 ${
                        isDimmed ? 'opacity-30' : 'opacity-100'
                      } ${
                        isSelected
                          ? node.isGuilty
                            ? 'border-red-500 bg-red-950/70 shadow-lg shadow-red-950/60 ring-2 ring-red-400'
                            : 'border-amber-500 bg-amber-950/60 ring-1 ring-amber-400'
                          : node.isGuilty
                          ? 'border-red-600/80 bg-red-950/40 hover:border-red-500'
                          : 'border-amber-800/80 bg-amber-950/20 hover:border-amber-600'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                        <span className={node.isGuilty ? 'text-red-400 font-bold' : 'text-amber-400'}>
                          #{node.id}
                        </span>
                        {node.isGuilty ? (
                          <span className="px-1 py-0.2 rounded bg-red-600 text-white text-[8px] font-bold">
                            GUILTY
                          </span>
                        ) : (
                          <span className="text-amber-400 uppercase text-[9px]">CONTAMINATED</span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-white truncate">{node.label}</p>
                      <p className="text-[10px] font-mono text-zinc-400 mt-1">
                        ALARM: {(node.alarmScore * 100).toFixed(0)}%
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Status Ticker */}
            <div className="absolute bottom-2 left-4 text-[10px] font-mono text-zinc-500">
              CLICK ANY NODE TO LOAD LIVE SAVE-POINT & CHECKER LOGS
            </div>
          </div>
          </div>

          {/* Right Column: Step Inspector Drawer (4 cols) */}
          <div className="lg:col-span-4 bg-[#0b0f17] border border-[#1f2937] rounded-lg p-5 flex flex-col justify-between font-mono text-xs">
            <div className="space-y-4">
              {/* Drawer Title Bar */}
              <div className="flex items-center justify-between pb-3 border-b border-[#1f2937]">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-zinc-800 text-cyan-300 text-[10px] font-bold">
                    STEP #{selectedNode.id}
                  </span>
                  <span className="text-white font-bold text-xs">{selectedNode.label}</span>
                </div>
                <span className="text-[10px] text-zinc-500 uppercase">{selectedNode.kind}</span>
              </div>

              {/* Status Badges */}
              <div className="flex flex-wrap items-center gap-2">
                {selectedNode.isGuilty && (
                  <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> RANK 1 GUILTY CAUSE
                  </span>
                )}
                {selectedNode.isContaminated && (
                  <span className="px-2 py-0.5 rounded bg-amber-600/30 text-amber-300 text-[10px] border border-amber-600/40">
                    CONTAMINATED DOWNSTREAM
                  </span>
                )}
                <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px]">
                  CHECKER: {selectedNode.checkerTier}
                </span>
              </div>

              {/* Forensic Evidence Note */}
              <div className="p-3 rounded bg-black/50 border border-[#1f2937] text-zinc-300 text-[11px] leading-relaxed font-sans">
                <p className="text-[10px] font-mono text-zinc-500 uppercase mb-1 font-bold">
                  FORENSIC ATTRIBUTION EVIDENCE:
                </p>
                {selectedNode.evidence}
              </div>

              {/* Input JSON */}
              <div>
                <p className="text-[10px] text-zinc-500 uppercase mb-1">INPUT PAYLOAD:</p>
                <pre className="p-2 rounded bg-black/60 border border-zinc-900 text-[10px] text-zinc-300 overflow-x-auto whitespace-pre">
                  {selectedNode.inputPayload}
                </pre>
              </div>

              {/* Output JSON */}
              <div>
                <p className="text-[10px] text-zinc-500 uppercase mb-1">OUTPUT SAVE-POINT:</p>
                <pre className="p-2 rounded bg-black/60 border border-zinc-900 text-[10px] text-emerald-300 overflow-x-auto whitespace-pre">
                  {selectedNode.outputPayload}
                </pre>
              </div>
            </div>

            {/* Bottom Metrics Footnote */}
            <div className="pt-3 border-t border-[#1f2937] flex items-center justify-between text-[10px] text-zinc-500">
              <span>LATENCY: {selectedNode.latencyMs}ms</span>
              <span>TOKENS: {selectedNode.tokens}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
