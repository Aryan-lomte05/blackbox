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

  // Calculate contamination trail using downstream dataflow reachability from guilty step
  const contaminationSet = useMemo(() => {
    if (!graphData) return new Set<number>();
    const guiltyIdx = graphData.guilty_step;
    if (guiltyIdx === null || guiltyIdx === undefined) return new Set<number>();

    // Build dataflow adjacency map
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

  // Transform nodes for React Flow with highlight attributes
  const initialNodes: Node[] = useMemo(() => {
    if (!graphData?.nodes) return [];
    return graphData.nodes.map((node) => {
      const idx = node.data.idx;
      const isGuilty = node.data.is_guilty || idx === graphData.guilty_step;
      const isContaminated = !isGuilty && contaminationSet.has(idx);

      return {
        id: String(node.id),
        type: 'step',
        position: node.position || { x: idx * 260, y: 100 },
        data: {
          ...node.data,
          is_guilty: isGuilty,
          is_contaminated: isContaminated,
        },
      };
    });
  }, [graphData, contaminationSet]);

  // Transform edges with styling
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

  // Update nodes when initial data changes
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
      {/* Top Run Cockpit Bar */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-950 flex flex-wrap items-center justify-between gap-4 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-rose-400">
            <GitGraph className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-white tracking-tight">
                Run #{runId.slice(0, 12)}
              </span>
              <VerdictBadge verdict={graphData?.outcome || 'FAIL'} size="sm" />
              {graphData?.guilty_step !== null && graphData?.guilty_step !== undefined && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950/80 border border-rose-500/40 text-rose-300 font-bold">
                  Guilty Step: #{graphData.guilty_step}
                </span>
              )}
            </div>
            <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-2 mt-0.5">
              <span>{nodes.length} Recorded Steps</span>
              <span>•</span>
              <span className="text-amber-400">
                {contaminationSet.size} Contaminated Steps
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/causal?run_id=${runId}`)}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-xs font-mono text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Split className="w-3.5 h-3.5 text-indigo-400" />
            <span>Causal Report</span>
          </button>

          <button
            onClick={() => navigate(`/fleet?run_id=${runId}`)}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-xs font-mono text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Fleet Firewall</span>
          </button>

          <button
            onClick={() => navigate(`/crash-test?run_id=${runId}`)}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-xs font-mono text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>Crash Test</span>
          </button>

          <button
            onClick={() => navigate(`/similar?run_id=${runId}`)}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-xs font-mono text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Fingerprint className="w-3.5 h-3.5 text-cyan-400" />
            <span>Look-alikes</span>
          </button>

          <button
            onClick={handleExportTest}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-xs font-mono text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileCode className="w-3.5 h-3.5 text-rose-400" />
            <span>Export Test</span>
          </button>

          <button
            onClick={() => refetch()}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Flow Canvas */}
      <div className="flex-1 w-full h-full bg-[#0a0a0c] relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 z-20 font-mono text-sm text-zinc-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2 text-rose-500" />
            Loading step graph...
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/90 z-20 p-8 text-center">
            <div className="max-w-md p-6 rounded-xl bg-rose-950/40 border border-rose-500/50 space-y-3">
              <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
              <h3 className="font-mono text-sm font-bold text-white">Failed to load run graph</h3>
              <p className="font-mono text-xs text-zinc-300">{(error as any)?.detail || error.message}</p>
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
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#27272a" />
          <Controls className="!bg-zinc-900 !border-zinc-800 !fill-zinc-300 !text-zinc-300 rounded-lg overflow-hidden" />
          <MiniMap
            className="!bg-zinc-950 !border-zinc-800 rounded-lg overflow-hidden"
            nodeColor={(node: any) => {
              if (node.data?.is_guilty) return '#f43f5e';
              if (node.data?.is_contaminated) return '#f59e0b';
              return '#3f3f46';
            }}
          />
        </ReactFlow>

        {/* Legend Overlay */}
        <div className="absolute bottom-6 left-6 p-3 rounded-xl bg-zinc-950/90 border border-zinc-800/80 backdrop-blur-md text-[11px] font-mono space-y-2 z-10 shadow-xl pointer-events-none">
          <div className="font-bold text-zinc-300 uppercase tracking-wider text-[10px]">Graph Legend</div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500 shadow-sm shadow-rose-500/80"></span>
            <span className="text-zinc-200">Guilty Step (Proved Root Cause)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500 shadow-sm shadow-amber-500/80"></span>
            <span className="text-zinc-200">Contamination Trail (Damaged Dataflow)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-1 bg-blue-500"></span>
            <span className="text-zinc-400">Dataflow edge (Used output)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-1 bg-zinc-600 border-b border-dashed border-zinc-400"></span>
            <span className="text-zinc-400">Order edge (Chronological)</span>
          </div>
        </div>
      </div>

      {/* Step Drawer */}
      <StepDrawer
        runId={runId}
        stepIdx={selectedStepIdx}
        onClose={() => setSelectedStepIdx(null)}
      />
    </div>
  );
};
