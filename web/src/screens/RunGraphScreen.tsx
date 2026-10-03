import React, { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ReactFlow,
  MiniMap,
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
import { StepDrawer } from '../components/run/StepDrawer';
import { VerdictBadge } from '../components/common/VerdictBadge';
import {
  GitGraph,
  ShieldCheck,
  Split,
  FileCode,
  Fingerprint,
  RefreshCw,
  AlertTriangle,
  Flame,
  ArrowRight,
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

  const [selectedStepIdx, setSelectedStepIdx] = useState<number | null>(null);

  // Fetch run graph
  const {
    data: graphData,
    isLoading,
    error,
    refetch,
  } = useQuery<RunGraphResponse>({
    queryKey: ['run-graph', runId],
    queryFn: async () => {
      return await api.get<RunGraphResponse>(`/api/runs/${runId}/graph`);
    },
  });

  // Calculate contamination trail using downstream reachability along dataflow edges
  const contaminationSet = useMemo(() => {
    if (!graphData) return new Set<number>();
    const guiltyIdx = graphData.guilty_step;
    if (guiltyIdx === null || guiltyIdx === undefined) return new Set<number>();

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
    if (!graphData?.nodes) return [];
    return graphData.nodes.map((node) => {
      const idx = node.data.idx;
      const isGuilty = node.data.is_guilty || idx === graphData.guilty_step;
      const isContaminated = !isGuilty && contaminationSet.has(idx);

      return {
        id: String(node.id),
        type: 'step',
        position: node.position || { x: idx * 280, y: 100 },
        data: {
          ...node.data,
          is_guilty: isGuilty,
          is_contaminated: isContaminated,
        },
      };
    });
  }, [graphData, contaminationSet]);

  // Transform edges
  const initialEdges: Edge[] = useMemo(() => {
    if (!graphData?.edges) return [];
    return graphData.edges.map((edge) => {
      const isDataflow = edge.type === 'dataflow';
      const srcIdx = parseInt(edge.source, 10);
      const isContaminatedEdge =
        (srcIdx === graphData.guilty_step || contaminationSet.has(srcIdx)) && isDataflow;

      return {
        ...edge,
        id: String(edge.id),
        type: 'smoothstep',
        animated: isContaminatedEdge,
        style: {
          stroke: isContaminatedEdge ? '#f59e0b' : isDataflow ? '#3b82f6' : '#52525b',
          strokeWidth: isContaminatedEdge ? 2.5 : 1.5,
          strokeDasharray: isDataflow ? undefined : '5,5',
        },
      };
    });
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

  const handleExportTest = async () => {
    try {
      const text = await api.get<string>(`/api/runs/${runId}/export-test`);
      const blob = new Blob([typeof text === 'string' ? text : JSON.stringify(text)], {
        type: 'text/plain',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `test_regression_${runId.slice(0, 8)}.py`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err.detail || err.message}`);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] relative select-none">
      {/* Top Cockpit Header */}
      <div className="p-4 border-b border-white/[0.08] bg-[#0c0d10] flex flex-wrap items-center justify-between gap-4 z-10 backdrop-blur-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-rose-400 shadow-inner">
            <GitGraph className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-heading font-extrabold text-sm text-white tracking-tight">
                Execution Graph
              </span>
              <span className="font-mono text-xs text-zinc-400">#{runId.slice(0, 10)}</span>
              <VerdictBadge verdict={graphData?.outcome || 'FAIL'} size="sm" />
              {graphData?.guilty_step !== null && graphData?.guilty_step !== undefined && (
                <span className="text-[11px] font-sans px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                  Guilty Step: #{graphData.guilty_step}
                </span>
              )}
            </div>
            <div className="text-xs text-zinc-400 font-sans flex items-center gap-2 mt-0.5">
              <span>{nodes.length} Recorded Steps</span>
              <span>•</span>
              <span className="text-amber-400">
                {contaminationSet.size} Downstream Contaminated Steps
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/causal?run_id=${runId}`)}
            className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-sans text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Split className="w-3.5 h-3.5 text-indigo-400" />
            <span>Causal Report</span>
          </button>

          <button
            onClick={() => navigate(`/fleet?run_id=${runId}`)}
            className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-sans text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Fleet Firewall</span>
          </button>

          <button
            onClick={() => navigate(`/crash-test?run_id=${runId}`)}
            className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-sans text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>Crash Test</span>
          </button>

          <button
            onClick={() => navigate(`/similar?run_id=${runId}`)}
            className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-sans text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Fingerprint className="w-3.5 h-3.5 text-cyan-400" />
            <span>Look-alikes</span>
          </button>

          <button
            onClick={handleExportTest}
            className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-sans text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileCode className="w-3.5 h-3.5 text-rose-400" />
            <span>Export Pytest</span>
          </button>

          <button
            onClick={() => refetch()}
            className="p-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-400 hover:text-zinc-200"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* React Flow Canvas */}
      <div className="flex-1 w-full h-full bg-[#08090a] relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20 font-sans text-sm text-zinc-400 backdrop-blur-sm">
            <RefreshCw className="w-5 h-5 animate-spin mr-2.5 text-rose-500" />
            Rendering step graph...
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20 p-8 text-center backdrop-blur-sm">
            <div className="max-w-md p-6 rounded-2xl bg-rose-950/40 border border-rose-500/50 space-y-3 font-sans">
              <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
              <h3 className="text-base font-bold text-white">Failed to load run graph</h3>
              <p className="text-xs text-zinc-300">{(error as any)?.detail || error.message}</p>
            </div>
          </div>
        )}

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
          <Background variant={BackgroundVariant.Dots} gap={28} size={1.2} color="#1c1d22" />
          <Controls className="!bg-[#121318] !border-white/[0.08] !fill-zinc-300 !text-zinc-300 rounded-xl overflow-hidden shadow-2xl" />
          <MiniMap
            className="!bg-[#0c0d10] !border-white/[0.08] rounded-xl overflow-hidden shadow-2xl"
            nodeColor={(node: any) => {
              if (node.data?.is_guilty) return '#f43f5e';
              if (node.data?.is_contaminated) return '#f59e0b';
              return '#3f3f46';
            }}
          />
        </ReactFlow>

        {/* Floating Minimal Legend */}
        <div className="absolute bottom-6 left-6 p-4 rounded-2xl bg-[#0c0d10]/90 border border-white/[0.08] backdrop-blur-xl text-xs font-sans space-y-2.5 z-10 shadow-2xl pointer-events-none">
          <div className="font-heading font-bold text-white uppercase tracking-wider text-[10px]">
            Causal Graph Legend
          </div>
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-rose-500 shadow-md shadow-rose-500/80"></span>
            <span className="text-zinc-200">Guilty Step (Proven Root Cause)</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-amber-500 shadow-md shadow-amber-500/80"></span>
            <span className="text-zinc-200">Contamination Trail (Damaged State)</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="w-4 h-0.5 bg-blue-500 rounded-full"></span>
            <span className="text-zinc-400">Dataflow edge (Used output)</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="w-4 h-0.5 bg-zinc-600 border-b border-dashed border-zinc-400"></span>
            <span className="text-zinc-400">Execution order edge</span>
          </div>
        </div>
      </div>

      {/* Step Drawer */}
      <StepDrawer
        runId={runId}
        stepIdx={selectedStepIdx}
        onClose={() => setSelectedStepIdx(null)}
        onSelectStep={(idx) => setSelectedStepIdx(idx)}
      />
    </div>
  );
};
