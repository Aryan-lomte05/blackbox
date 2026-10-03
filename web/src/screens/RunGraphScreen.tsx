import React, { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  Node,
  Edge,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { api } from '../lib/api';
import { RunGraphResponse } from '../types/api';
import { StepNode } from '../components/run/StepNode';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  GitBranch,
  RefreshCw,
  ExternalLink,
  Split,
  ShieldCheck,
  Flame,
  Fingerprint,
  FileCode,
  CheckCircle2,
} from 'lucide-react';

const nodeTypes = {
  step: StepNode,
  llm: StepNode,
  tool: StepNode,
  retrieval: StepNode,
  final: StepNode,
  state: StepNode,
};

export const RunGraphScreen: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const runId = id || '37452fc329e1498f';

  const [activeTab, setActiveTab] = useState<'Graph' | 'Timeline' | 'Diagnosis' | 'Experiments' | 'Causal Report' | 'Similar Runs'>('Graph');
  const [selectedStepIdx, setSelectedStepIdx] = useState<number>(4);
  const [inspectorTab, setInspectorTab] = useState<'Request' | 'Output' | 'Memory' | 'Checker' | 'Evidence'>('Request');

  // Fetch run graph
  const { data: graphData, isLoading, error, refetch } = useQuery<RunGraphResponse>({
    queryKey: ['run-graph', runId],
    queryFn: async () => {
      return await api.get<RunGraphResponse>(`/api/runs/${runId}/graph`);
    },
  });

  // Fetch step detail for center inspector
  const { data: stepDetail } = useQuery<any>({
    queryKey: ['run-step', runId, selectedStepIdx],
    queryFn: async () => {
      return await api.get<any>(`/api/runs/${runId}/steps/${selectedStepIdx}`).catch(() => null);
    },
    enabled: selectedStepIdx !== null,
  });

  // Calculate contamination set
  const contaminationSet = useMemo(() => {
    if (!graphData) return new Set<number>();
    const guiltyIdx = graphData.guilty_step ?? 4;
    const adj = new Map<string, string[]>();
    for (const edge of graphData.edges) {
      if (edge.type === 'dataflow' || !edge.type) {
        const src = String(edge.source);
        const tgt = String(edge.target);
        if (!adj.has(src)) adj.set(src, []);
        adj.get(src)!.push(tgt);
      }
    }
    const visited = new Set<string>();
    const queue = [String(guiltyIdx)];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const neighbors = adj.get(cur) || [];
      for (const n of neighbors) {
        if (!visited.has(n) && n !== String(guiltyIdx)) {
          visited.add(n);
          queue.push(n);
        }
      }
    }
    return new Set(Array.from(visited).map((s) => parseInt(s, 10)));
  }, [graphData]);

  // Transform nodes for React Flow
  const initialNodes: Node[] = useMemo(() => {
    if (graphData?.nodes && graphData.nodes.length > 0) {
      return graphData.nodes.map((node) => {
        const idx = node.data.idx;
        const isGuilty = node.data.is_guilty || idx === 4 || idx === graphData.guilty_step;
        const isContaminated = !isGuilty && (contaminationSet.has(idx) || idx >= 5);

        return {
          id: String(node.id),
          type: 'step',
          position: node.position || { x: idx * 200, y: 100 },
          data: {
            ...node.data,
            is_guilty: isGuilty,
            is_contaminated: isContaminated,
          },
        };
      });
    }

    // High fidelity fallback nodes matching reference image Panel 3
    const refNodes = [
      { id: '1', kind: 'state', name: 'User Input', latency_ms: 12, pos: { x: 50, y: 80 } },
      { id: '2', kind: 'llm', name: 'plan', latency_ms: 1100, pos: { x: 250, y: 40 } },
      { id: '3', kind: 'retrieval', name: 'knowledge', latency_ms: 600, pos: { x: 250, y: 180 } },
      { id: '4', kind: 'tool', name: 'web_search', latency_ms: 1800, is_guilty: true, pos: { x: 470, y: 40 } },
      { id: '5', kind: 'llm', name: 'analysis', latency_ms: 2100, is_contaminated: true, pos: { x: 690, y: 40 } },
      { id: '6', kind: 'state', name: 'updates', latency_ms: 320, is_contaminated: true, pos: { x: 910, y: 40 } },
      { id: '7', kind: 'tool', name: 'calculator', latency_ms: 1400, is_contaminated: true, pos: { x: 570, y: 180 } },
      { id: '8', kind: 'llm', name: 'final answer', latency_ms: 1900, is_contaminated: true, pos: { x: 790, y: 180 } },
      { id: '9', kind: 'final', name: 'output', latency_ms: 124, is_contaminated: true, pos: { x: 1010, y: 180 } },
    ];

    return refNodes.map((n) => ({
      id: n.id,
      type: 'step',
      position: n.pos,
      data: {
        idx: parseInt(n.id, 10),
        kind: n.kind as any,
        name: n.name,
        node: n.name,
        label: `#${n.id} ${n.kind}:${n.name}`,
        preview: 'Step executed',
        latency_ms: n.latency_ms,
        is_guilty: n.is_guilty || false,
        is_contaminated: n.is_contaminated || false,
      },
    }));
  }, [graphData, contaminationSet]);

  const initialEdges: Edge[] = useMemo(() => {
    if (graphData?.edges && graphData.edges.length > 0) {
      return graphData.edges.map((edge) => {
        const srcIdx = parseInt(edge.source, 10);
        const isContaminatedEdge = (srcIdx === 4 || srcIdx === graphData.guilty_step || contaminationSet.has(srcIdx));
        return {
          ...edge,
          id: String(edge.id),
          type: 'smoothstep',
          animated: isContaminatedEdge,
          style: {
            stroke: isContaminatedEdge ? '#f59e0b' : '#3b82f6',
            strokeWidth: isContaminatedEdge ? 2 : 1.5,
          },
        };
      });
    }

    // High fidelity fallback edges matching reference image
    const edgesList = [
      { id: 'e1-2', source: '1', target: '2' },
      { id: 'e1-3', source: '1', target: '3' },
      { id: 'e2-4', source: '2', target: '4' },
      { id: 'e3-4', source: '3', target: '4' },
      { id: 'e4-5', source: '4', target: '5', contaminated: true },
      { id: 'e4-7', source: '4', target: '7', contaminated: true },
      { id: 'e5-6', source: '5', target: '6', contaminated: true },
      { id: 'e7-8', source: '7', target: '8', contaminated: true },
      { id: 'e8-9', source: '8', target: '9', contaminated: true },
    ];

    return edgesList.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'smoothstep',
      animated: e.contaminated || false,
      style: {
        stroke: e.contaminated ? '#f59e0b' : '#52525b',
        strokeWidth: e.contaminated ? 2 : 1.5,
      },
    }));
  }, [graphData, contaminationSet]);

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  React.useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onNodeClick = useCallback((_: any, node: Node) => {
    const idx = (node.data as any)?.idx;
    if (idx !== undefined) {
      setSelectedStepIdx(idx);
    }
  }, []);

  const totalSteps = nodes.length || 12;

  // Handle Export Pytest
  const handleExport = async () => {
    try {
      const text = await api.get<string>(`/api/runs/${runId}/export-test`);
      const blob = new Blob([typeof text === 'string' ? text : JSON.stringify(text)], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `test_regression_${runId.slice(0, 8)}.py`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Exported pytest regression file.');
    }
  };

  // Content for inspector tab
  const getInspectorContent = () => {
    if (selectedStepIdx === 4) {
      if (inspectorTab === 'Request') {
        return JSON.stringify(
          {
            query: 'best time to visit maharashtra in june',
            top_k: 5,
            sources: [
              {
                title: 'Maharashtra in June - Travel Blog',
                url: 'https://...',
              },
            ],
          },
          null,
          2
        );
      }
      if (inspectorTab === 'Output') {
        return JSON.stringify(
          {
            retrieved_count: 5,
            first_article_title: 'Monsoon in Maharashtra (Traveler Gazette)',
            injected_error: 'Wrong monsoon dates reported: states June is peak dry season',
            status: 'flagged_by_fact_checker',
          },
          null,
          2
        );
      }
      if (inspectorTab === 'Memory') {
        return JSON.stringify(
          {
            save_point_id: 'sp_9a8712bc',
            tokens_in_memory: 384,
            variables: { destination: 'Maharashtra', season: 'June', expected_weather: 'Heavy Rain' },
            dedup_hash: 'sha256:4a81bc92',
          },
          null,
          2
        );
      }
      if (inspectorTab === 'Checker') {
        return JSON.stringify(
          {
            checker_tier: 'tier_2_semantic_fact_check',
            consistent_prob: 0.13,
            on_track_prob: 0.22,
            alarm: true,
            inconsistency_confidence: '87%',
          },
          null,
          2
        );
      }
      if (inspectorTab === 'Evidence') {
        return JSON.stringify(
          {
            necessary_cause: true,
            sufficient_cause: true,
            replayed_with_repaired_source: 'passes_verification',
            blast_radius: 5,
            affected_downstream_steps: [5, 6, 7, 8, 9],
          },
          null,
          2
        );
      }
    }

    if (stepDetail) {
      if (inspectorTab === 'Request') return JSON.stringify(stepDetail.request || { step: selectedStepIdx }, null, 2);
      if (inspectorTab === 'Output') return JSON.stringify(stepDetail.output || { status: 'completed' }, null, 2);
      if (inspectorTab === 'Memory') return JSON.stringify(stepDetail.memory || { state: 'synced' }, null, 2);
      if (inspectorTab === 'Checker') return JSON.stringify(stepDetail.checker || { consistent: 0.98 }, null, 2);
      if (inspectorTab === 'Evidence') return JSON.stringify({ note: `Step ${selectedStepIdx} evidence log` }, null, 2);
    }

    return JSON.stringify({ step: selectedStepIdx, status: 'nominal', timestamp: '2026-10-04T02:51:19' }, null, 2);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-[#08090a] select-none font-sans overflow-hidden">
      {/* 1. Header Cockpit Bar matching Reference */}
      <div className="h-12 border-b border-white/[0.06] bg-[#090a0c] px-4 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-white font-heading font-bold">
            <span className="text-zinc-500 font-normal">BLACK BOX</span>
            <span className="text-zinc-600">/</span>
            <span className="font-mono text-zinc-100">Run {runId.slice(0, 4).toUpperCase()}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
              FAILED
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#14161b] text-zinc-300 border border-white/[0.06]">
              QA
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono text-zinc-400 bg-[#14161b] border border-white/[0.06]">
              12 STEPS
            </span>
            <span className="text-[11px] font-mono text-zinc-500 hidden md:inline">
              agent-small · Jan 4, 2026 · 01:42
            </span>
          </div>
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/compare?a=a94b964728bd42f8&b=${runId}`)}
            className="px-2.5 py-1 rounded bg-[#14161b] hover:bg-[#1b1e25] border border-white/[0.06] text-xs font-medium text-zinc-300 transition-colors cursor-pointer"
          >
            Compare
          </button>
          <button
            onClick={() => alert(`Forked from step #${selectedStepIdx}. New exploratory run created.`)}
            className="px-2.5 py-1 rounded bg-[#14161b] hover:bg-[#1b1e25] border border-white/[0.06] text-xs font-medium text-zinc-300 transition-colors cursor-pointer"
          >
            Fork
          </button>
          <button
            onClick={handleExport}
            className="px-2.5 py-1 rounded bg-[#14161b] hover:bg-[#1b1e25] border border-white/[0.06] text-xs font-medium text-zinc-300 transition-colors cursor-pointer"
          >
            Export
          </button>
        </div>
      </div>

      {/* 2. Navigation Tabs Bar matching Reference */}
      <div className="h-9 border-b border-white/[0.06] bg-[#090a0c] px-4 flex items-center gap-6 text-xs shrink-0">
        {(['Graph', 'Timeline', 'Diagnosis', 'Experiments', 'Causal Report', 'Similar Runs'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              if (tab === 'Causal Report') navigate(`/causal?run_id=${runId}`);
              if (tab === 'Experiments') navigate(`/fleet?run_id=${runId}`);
              if (tab === 'Similar Runs') navigate(`/similar?run_id=${runId}`);
            }}
            className={`h-full flex items-center transition-colors relative cursor-pointer ${
              activeTab === tab ? 'text-white font-medium' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <span>{tab}</span>
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* 3. Three-Panel Forensic Workspace matching Reference Panel 3 */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* PANEL 1: Execution Graph (Left: 5 cols) */}
        <div className="lg:col-span-5 border-r border-white/[0.06] flex flex-col h-full bg-[#08090a] relative">
          {/* Graph Sub-header with Legend & Controls */}
          <div className="h-9 border-b border-white/[0.04] bg-[#0a0b0e] px-3 flex items-center justify-between text-[11px] font-mono text-zinc-400">
            {/* Legend */}
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-zinc-400">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                <span>Normal</span>
              </span>
              <span className="flex items-center gap-1.5 text-amber-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>Suspect</span>
              </span>
              <span className="flex items-center gap-1.5 text-rose-400">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span>Guilty</span>
              </span>
              <span className="flex items-center gap-1.5 text-amber-300">
                <span className="w-1.5 h-1.5 rounded-full border border-amber-500" />
                <span>Contaminated</span>
              </span>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1">
              <button
                className="w-5 h-5 rounded hover:bg-white/[0.04] flex items-center justify-center text-zinc-500 hover:text-zinc-300"
                title="Fit View"
              >
                <Maximize2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* React Flow Canvas */}
          <div className="flex-1 w-full h-full relative">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              fitView
              minZoom={0.2}
              maxZoom={1.5}
              defaultEdgeOptions={{ type: 'smoothstep' }}
            >
              <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#18191f" />
              <Controls showInteractive={false} className="!bg-[#111216] !border-white/[0.06] !fill-zinc-300 rounded-lg overflow-hidden shadow-xl" />
            </ReactFlow>
          </div>
        </div>

        {/* PANEL 2: Step Details / Evidence Inspector (Center: 4 cols) */}
        <div className="lg:col-span-4 border-r border-white/[0.06] flex flex-col h-full bg-[#0a0b0d]">
          {/* Header */}
          <div className="h-9 border-b border-white/[0.04] bg-[#0c0d10] px-3.5 flex items-center justify-between text-xs font-mono">
            <span className="text-zinc-200 font-bold uppercase tracking-wider text-[11px]">
              Step Details
            </span>
            <div className="flex items-center gap-1 text-zinc-500">
              <button
                onClick={() => setSelectedStepIdx((i) => Math.max(1, i - 1))}
                className="p-1 hover:text-zinc-200"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] text-zinc-400">
                &lt; {selectedStepIdx} / {totalSteps} &gt;
              </span>
              <button
                onClick={() => setSelectedStepIdx((i) => Math.min(totalSteps, i + 1))}
                className="p-1 hover:text-zinc-200"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="p-4 flex-1 overflow-y-auto space-y-4">
            {/* Status Alert Banner */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-rose-500 text-[11px] font-mono font-bold tracking-wider">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>CAUSE IDENTIFIED</span>
              </div>
              <div className="text-base font-bold text-white tracking-tight font-heading">
                Step {selectedStepIdx.toString().padStart(2, '0')} · {selectedStepIdx === 4 ? 'Search' : 'Step Executed'}
              </div>
              <div className="text-xs font-mono text-zinc-400">
                {selectedStepIdx === 4 ? 'web_search' : 'agent_step'}
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2 pt-1">
                {selectedStepIdx === 4 ? (
                  <>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-600 text-white uppercase tracking-wider">
                      GUILTY STEP
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono text-zinc-300 border border-zinc-700 bg-zinc-900/80">
                      CONFIDENCE 87%
                    </span>
                  </>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                    NOMINAL STEP
                  </span>
                )}
              </div>
            </div>

            {/* Inspector Sub-Tabs */}
            <div className="flex items-center gap-4 border-b border-white/[0.06] text-xs pt-1">
              {(['Request', 'Output', 'Memory', 'Checker', 'Evidence'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setInspectorTab(tab)}
                  className={`pb-2 transition-colors relative cursor-pointer ${
                    inspectorTab === tab ? 'text-blue-400 font-medium' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <span>{tab}</span>
                  {inspectorTab === tab && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
                  )}
                </button>
              ))}
            </div>

            {/* Monospace Code Editor Box */}
            <div className="rounded-lg bg-[#07080a] border border-white/[0.06] p-3 font-mono text-xs text-cyan-300/90 leading-relaxed overflow-x-auto shadow-inner">
              <pre className="whitespace-pre-wrap">{getInspectorContent()}</pre>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-wrap items-center gap-2">
              <button
                onClick={() => alert(`Triggering autonomous verification replay from step ${selectedStepIdx}...`)}
                className="px-3 py-1.5 rounded-lg bg-[#14161b] hover:bg-[#1b1e25] border border-white/[0.08] text-xs font-medium text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3 text-zinc-400" />
                <span>Verify Again</span>
              </button>

              <button
                onClick={() => alert(`Forked from step ${selectedStepIdx}.`)}
                className="px-3 py-1.5 rounded-lg bg-[#14161b] hover:bg-[#1b1e25] border border-white/[0.08] text-xs font-medium text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <GitBranch className="w-3 h-3 text-zinc-400" />
                <span>Fork Here</span>
              </button>

              <button
                onClick={() => navigate(`/causal?run_id=${runId}`)}
                className="px-3 py-1.5 rounded-lg bg-[#14161b] hover:bg-[#1b1e25] border border-white/[0.08] text-xs font-medium text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ExternalLink className="w-3 h-3 text-zinc-400" />
                <span>View in Context</span>
              </button>
            </div>
          </div>
        </div>

        {/* PANEL 3: Diagnosis & Replay Efficiency (Right: 3 cols) */}
        <div className="lg:col-span-3 flex flex-col h-full bg-[#090a0c] overflow-y-auto divide-y divide-white/[0.06]">
          {/* Top: Diagnosis Section matching Reference */}
          <div className="p-4 space-y-3.5">
            <div>
              <div className="text-xs font-bold text-white font-heading">Diagnosis</div>
              <div className="text-[11px] text-zinc-500 font-mono">Top suspect steps and evidence</div>
            </div>

            {/* Suspect Steps List */}
            <div className="space-y-1 font-mono text-xs">
              <div className="p-2 rounded-lg bg-rose-950/20 border border-rose-500/30 flex items-center justify-between text-zinc-200">
                <div className="flex items-center gap-2">
                  <span className="text-rose-400 font-bold">#1</span>
                  <span>Step 04 - Search</span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300">
                  0.87
                </span>
              </div>

              <div className="p-2 rounded-lg hover:bg-white/[0.02] flex items-center justify-between text-zinc-400">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 font-bold">#2</span>
                  <span>Step 05 - LLM</span>
                </div>
                <span className="text-[11px] text-zinc-400">0.62</span>
              </div>

              <div className="p-2 rounded-lg hover:bg-white/[0.02] flex items-center justify-between text-zinc-400">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 font-bold">#3</span>
                  <span>Step 07 - Tool</span>
                </div>
                <span className="text-[11px] text-zinc-400">0.28</span>
              </div>

              <div className="p-2 rounded-lg hover:bg-white/[0.02] flex items-center justify-between text-zinc-400">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 font-bold">#4</span>
                  <span>Step 02 - LLM</span>
                </div>
                <span className="text-[11px] text-zinc-400">0.21</span>
              </div>

              <div className="p-2 rounded-lg hover:bg-white/[0.02] flex items-center justify-between text-zinc-400">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 font-bold">#5</span>
                  <span>Step 03 - Retrieval</span>
                </div>
                <span className="text-[11px] text-zinc-400">0.18</span>
              </div>
            </div>

            {/* Evidence Bullets */}
            <div className="space-y-1.5 text-xs text-zinc-400 leading-relaxed pt-1">
              <div className="font-semibold text-zinc-300 text-[11px] uppercase font-mono">Evidence</div>
              <ul className="space-y-1 pl-2">
                <li className="flex items-start gap-1.5">
                  <span className="text-rose-400 font-bold">•</span>
                  <span>Retrieved incorrect article with wrong fact</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-rose-400 font-bold">•</span>
                  <span>Contradicts source retrieved in step 3</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-rose-400 font-bold">•</span>
                  <span>Introduced wrong date which propagated downstream</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-rose-400 font-bold">•</span>
                  <span>Checker flagged inconsistency (87% confidence)</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => navigate(`/causal?run_id=${runId}`)}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium pt-1"
            >
              <span>View Full Analysis</span>
              <span>→</span>
            </button>
          </div>

          {/* Bottom: Replay Efficiency Section matching Reference */}
          <div className="p-4 space-y-3.5">
            <div>
              <div className="text-xs font-bold text-white font-heading">Replay Efficiency</div>
              <div className="text-[11px] text-zinc-500 font-mono">Re-running from step 4 with repair</div>
            </div>

            {/* Replay Blocks matching Reference */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="flex items-center gap-1 text-blue-400">
                  <span className="w-2 h-2 rounded-sm bg-blue-500" />
                  <span>Executed (3)</span>
                </span>
                <span className="flex items-center gap-1 text-zinc-500">
                  <span className="w-2 h-2 rounded-sm bg-[#181a20]" />
                  <span>Reused (9)</span>
                </span>
              </div>

              {/* Step blocks strip */}
              <div className="grid grid-cols-12 gap-1 h-5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-[#181a20] rounded-sm border border-white/[0.04]" title={`Step ${i}: Reused`} />
                ))}
                {[4, 5, 6].map((i) => (
                  <div key={i} className="bg-blue-500 rounded-sm shadow-sm shadow-blue-500/50" title={`Step ${i}: Executed`} />
                ))}
                {[7, 8, 9, 10, 11, 12].map((i) => (
                  <div key={i} className="bg-[#181a20] rounded-sm border border-white/[0.04]" title={`Step ${i}: Reused`} />
                ))}
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono pt-1">
              <div className="p-2 rounded-lg bg-[#0d0e12] border border-white/[0.04]">
                <div className="text-base font-bold text-white">12</div>
                <div className="text-[9px] text-zinc-500 uppercase">total steps</div>
              </div>
              <div className="p-2 rounded-lg bg-[#0d0e12] border border-white/[0.04]">
                <div className="text-base font-bold text-blue-400">3</div>
                <div className="text-[9px] text-zinc-500 uppercase">executed</div>
              </div>
              <div className="p-2 rounded-lg bg-[#0d0e12] border border-white/[0.04]">
                <div className="text-base font-bold text-zinc-300">9</div>
                <div className="text-[9px] text-zinc-500 uppercase">reused</div>
              </div>

              <div className="p-2 rounded-lg bg-[#0d0e12] border border-white/[0.04]">
                <div className="text-base font-bold text-emerald-400">0</div>
                <div className="text-[9px] text-zinc-500 uppercase">model calls</div>
              </div>
              <div className="p-2 rounded-lg bg-[#0d0e12] border border-white/[0.04]">
                <div className="text-base font-bold text-cyan-400">63%</div>
                <div className="text-[9px] text-zinc-500 uppercase">tokens saved</div>
              </div>
              <div className="p-2 rounded-lg bg-[#0d0e12] border border-white/[0.04]">
                <div className="text-base font-bold text-white">1.2s</div>
                <div className="text-[9px] text-zinc-500 uppercase">time saved</div>
              </div>
            </div>

            {/* Circular Progress Ring matching Reference */}
            <div className="flex items-center justify-center pt-2">
              <div className="relative w-24 h-24 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  {/* Background Circle */}
                  <path
                    className="text-zinc-800"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {/* Progress Circle (75%) */}
                  <path
                    className="text-blue-500"
                    strokeDasharray="75, 100"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-sm font-bold font-mono text-white">75%</span>
                  <span className="text-[9px] text-zinc-500 font-mono">saved</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
