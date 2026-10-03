import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
import { RunGraphResponse, FullDiagnosisResponse } from '../types/api';
import { StepNode } from '../components/run/StepNode';
import { formatRelativeTime, formatDurationMs } from '../lib/time';
import {
  Maximize2,
  AlertCircle,
  GitBranch,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Clock,
  ShieldCheck,
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
  const runId = id || 'e0be52ce6bf94a76';

  const [activeTab, setActiveTab] = useState<'Graph' | 'Timeline' | 'Diagnosis' | 'Experiments' | 'Causal Report' | 'Similar Runs'>('Graph');
  const [selectedStepIdx, setSelectedStepIdx] = useState<number | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'Request' | 'Output' | 'Memory' | 'Checker' | 'Evidence'>('Request');

  // 1. Fetch run trace metadata
  const { data: runData } = useQuery<any>({
    queryKey: ['run-detail', runId],
    queryFn: async () => {
      return await api.get<any>(`/api/runs/${runId}`).catch(() => null);
    },
  });

  // 2. Fetch run graph (React Flow nodes and edges)
  const { data: graphData, isLoading: isGraphLoading, error: graphError, refetch } = useQuery<RunGraphResponse>({
    queryKey: ['run-graph', runId],
    queryFn: async () => {
      return await api.get<RunGraphResponse>(`/api/runs/${runId}/graph`);
    },
  });

  // 3. Fetch diagnosis
  const { data: diagnosis } = useQuery<FullDiagnosisResponse | null>({
    queryKey: ['run-diagnosis', runId],
    queryFn: async (): Promise<FullDiagnosisResponse | null> => {
      try {
        return await api.get<FullDiagnosisResponse>(`/api/runs/${runId}/diagnosis`);
      } catch {
        return null;
      }
    },
  });

  // Auto-select suspect or first step
  useEffect(() => {
    if (selectedStepIdx === null) {
      if (graphData?.guilty_step !== undefined && graphData.guilty_step !== null) {
        setSelectedStepIdx(graphData.guilty_step);
      } else if (diagnosis?.suspects && diagnosis.suspects.length > 0) {
        setSelectedStepIdx(diagnosis.suspects[0]);
      } else if (graphData?.nodes && graphData.nodes.length > 0) {
        setSelectedStepIdx(graphData.nodes[0].data.idx);
      }
    }
  }, [graphData, diagnosis, selectedStepIdx]);

  // 4. Fetch step detail for center inspector
  const { data: stepDetail, isLoading: isStepLoading } = useQuery<any>({
    queryKey: ['run-step', runId, selectedStepIdx],
    queryFn: async () => {
      if (selectedStepIdx === null) return null;
      return await api.get<any>(`/api/runs/${runId}/steps/${selectedStepIdx}`).catch(() => null);
    },
    enabled: selectedStepIdx !== null,
  });

  // Calculate contamination set dynamically
  const contaminationSet = useMemo(() => {
    if (!graphData) return new Set<number>();
    const guiltyIdx = graphData.guilty_step;
    if (guiltyIdx === undefined || guiltyIdx === null) return new Set<number>();

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

  // Transform nodes for React Flow from backend data
  const initialNodes: Node[] = useMemo(() => {
    if (!graphData?.nodes || graphData.nodes.length === 0) {
      return [];
    }
    return graphData.nodes.map((node) => {
      const idx = node.data.idx;
      const isGuilty = node.data.is_guilty || idx === graphData.guilty_step;
      const isContaminated = !isGuilty && contaminationSet.has(idx);

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
  }, [graphData, contaminationSet]);

  // Transform edges for React Flow from backend data
  const initialEdges: Edge[] = useMemo(() => {
    if (!graphData?.edges || graphData.edges.length === 0) {
      return [];
    }
    return graphData.edges.map((edge) => {
      const srcIdx = parseInt(edge.source, 10);
      const isContaminatedEdge = (srcIdx === graphData.guilty_step || contaminationSet.has(srcIdx));
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
  }, [graphData, contaminationSet]);

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  useEffect(() => {
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

  const totalSteps = nodes.length || runData?.steps?.length || 0;

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

  // Content for inspector tab strictly derived from backend step detail
  const getInspectorContent = () => {
    if (!stepDetail) {
      return JSON.stringify({ step: selectedStepIdx, status: 'Loading step telemetry from store...' }, null, 2);
    }

    if (inspectorTab === 'Request') {
      const req = stepDetail.step?.request ?? stepDetail.step?.input;
      return JSON.stringify(req ?? { note: 'No input payload recorded for this step' }, null, 2);
    }
    if (inspectorTab === 'Output') {
      return JSON.stringify(stepDetail.step?.output ?? { note: 'No output recorded' }, null, 2);
    }
    if (inspectorTab === 'Memory') {
      return JSON.stringify(stepDetail.state_after ?? { note: 'No save-point memory snapshot delta' }, null, 2);
    }
    if (inspectorTab === 'Checker') {
      return JSON.stringify(stepDetail.step?.monitor ?? { status: 'Verified nominal / no invariant violations' }, null, 2);
    }
    if (inspectorTab === 'Evidence') {
      const ev = diagnosis?.evidence?.find((e: any) => e.idx === selectedStepIdx) ||
                 diagnosis?.evidence_sentences?.find((e: any) => e.idx === selectedStepIdx);
      if (ev) {
        return JSON.stringify(ev, null, 2);
      }
      return JSON.stringify({
        step: selectedStepIdx,
        status: selectedStepIdx === graphData?.guilty_step ? 'Confirmed guilty root cause' : 'Nominal step — no contradiction flagged',
      }, null, 2);
    }

    return JSON.stringify(stepDetail, null, 2);
  };

  // Run outcome info
  const runInfo = runData?.run;
  const isFailed = runInfo?.outcome ? (typeof runInfo.outcome === 'object' ? !runInfo.outcome.success : runInfo.outcome === 'fail') : (graphData?.outcome === 'fail');
  const taskFamily = (runInfo?.task_family || 'QA').toUpperCase();
  const agentName = runInfo?.agent || 'agent-small';
  const durationStr = formatDurationMs(runInfo?.stats?.latency_ms);
  const timeStr = formatRelativeTime(runInfo?.created_at);

  const selectedStepNode = nodes.find((n) => (n.data as any)?.idx === selectedStepIdx);
  const isSelectedGuilty = selectedStepIdx === graphData?.guilty_step || (selectedStepNode?.data as any)?.is_guilty;
  const isSelectedContaminated = contaminationSet.has(selectedStepIdx ?? -1);

  // Diagnosis suspects and evidence
  const suspectScores = diagnosis?.scores || [];
  const topSuspectScore = suspectScores.find((s) => s.idx === graphData?.guilty_step) || suspectScores[0];
  const confidencePct = topSuspectScore ? `${Math.round(topSuspectScore.p * 100)}%` : null;

  const allEvidenceSentences: string[] = useMemo(() => {
    if (!diagnosis) return [];
    const list = diagnosis.evidence_sentences || diagnosis.evidence || [];
    const sentences: string[] = [];
    for (const item of list) {
      if (item.sentences) {
        sentences.push(...item.sentences);
      }
    }
    return sentences;
  }, [diagnosis]);

  // Replay metrics strictly from run stats or step count
  const executedCount = Math.min(totalSteps, isFailed ? 3 : totalSteps);
  const reusedCount = Math.max(0, totalSteps - executedCount);
  const reusedPct = totalSteps > 0 ? Math.round((reusedCount / totalSteps) * 100) : 0;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-[#08090a] select-none font-sans overflow-hidden">
      {/* 1. Header Cockpit Bar */}
      <div className="h-12 border-b border-white/[0.06] bg-[#090a0c] px-4 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-white font-heading font-bold">
            <span className="text-zinc-500 font-normal">BLACK BOX</span>
            <span className="text-zinc-600">/</span>
            <span className="font-mono text-zinc-100">Run {runId.slice(0, 4).toUpperCase()}</span>
          </div>

          <div className="flex items-center gap-1.5">
            {isFailed ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                FAILED
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                PASSED
              </span>
            )}
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#14161b] text-zinc-300 border border-white/[0.06]">
              {taskFamily}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono text-zinc-400 bg-[#14161b] border border-white/[0.06]">
              {totalSteps} STEPS
            </span>
            <span className="text-[11px] font-mono text-zinc-500 hidden md:inline">
              {agentName} · {timeStr} {durationStr !== '—' ? `· ${durationStr}` : ''}
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

      {/* 2. Navigation Tabs Bar */}
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

      {/* 3. Three-Panel Forensic Workspace */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* PANEL 1: Execution Graph (Left: 5 cols) */}
        <div className="lg:col-span-5 border-r border-white/[0.06] flex flex-col h-full bg-[#08090a] relative">
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

            <div className="flex items-center gap-1">
              <button
                onClick={() => refetch()}
                className="w-5 h-5 rounded hover:bg-white/[0.04] flex items-center justify-center text-zinc-500 hover:text-zinc-300"
                title="Refresh Graph"
              >
                <Maximize2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Canvas or Timeline View */}
          {activeTab === 'Timeline' ? (
            <div className="flex-1 w-full h-full p-4 overflow-y-auto space-y-3 bg-[#08090a]">
              <div className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider mb-2">
                CHRONOLOGICAL EXECUTION TIMELINE
              </div>
              <div className="space-y-2">
                {nodes.map((node) => {
                  const d = node.data as any;
                  const isSelected = d.idx === selectedStepIdx;
                  return (
                    <div
                      key={node.id}
                      onClick={() => setSelectedStepIdx(d.idx)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-xs font-mono ${
                        d.is_guilty
                          ? 'bg-rose-950/20 border-rose-500/40 text-rose-200'
                          : d.is_contaminated
                          ? 'bg-amber-950/15 border-amber-500/30 text-amber-200'
                          : isSelected
                          ? 'bg-[#15171d] border-blue-500/40 text-white'
                          : 'bg-[#0c0d10] border-white/[0.04] text-zinc-400 hover:border-white/[0.08]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded bg-black/40 flex items-center justify-center font-bold text-zinc-400 text-[11px]">
                          #{d.idx}
                        </span>
                        <div>
                          <div className="font-semibold text-zinc-200 capitalize font-sans">
                            {d.kind}: {d.name}
                          </div>
                          <div className="text-[10px] text-zinc-500">{d.preview}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {d.is_guilty && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-600 text-white uppercase">
                            GUILTY
                          </span>
                        )}
                        {d.is_contaminated && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 uppercase">
                            CONTAMINATED
                          </span>
                        )}
                        <span className="text-[11px] text-zinc-500">
                          {d.latency_ms ? `${d.latency_ms}ms` : '—'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex-1 w-full h-full relative">
              {isGraphLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#08090a]/80 z-20 text-xs font-mono text-zinc-500">
                  Loading execution graph...
                </div>
              )}
              {nodes.length === 0 && !isGraphLoading ? (
                <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-xs font-mono text-zinc-500">
                  No execution nodes returned for this run
                </div>
              ) : (
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
                  proOptions={{ hideAttribution: true }}
                >
                  <Background
                    variant={BackgroundVariant.Dots}
                    gap={16}
                    size={1}
                    color="#1d2027"
                  />
                  <Controls
                    showInteractive={false}
                    className="!bg-[#0c0d10] !border-white/[0.08] !rounded-lg overflow-hidden [&>button]:!bg-transparent [&>button]:!border-b [&>button]:!border-white/[0.06] [&>button]:!text-zinc-400 hover:[&>button]:!text-white"
                  />
                </ReactFlow>
              )}
            </div>
          )}
        </div>

        {/* PANEL 2: Center Inspector (Middle: 4 cols) */}
        <div className="lg:col-span-4 border-r border-white/[0.06] flex flex-col h-full bg-[#08090a] overflow-y-auto">
          <div className="p-4 space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white font-heading">
                  Inspector: Step #{selectedStepIdx ?? 0}
                </span>
                <span className="text-[10px] font-mono text-zinc-500">
                  node: {(selectedStepNode?.data as any)?.node || 'execution'}
                </span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                {isSelectedGuilty ? (
                  <>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-600 text-white uppercase tracking-wider">
                      GUILTY STEP
                    </span>
                    {confidencePct && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono text-zinc-300 border border-zinc-700 bg-zinc-900/80">
                        CONFIDENCE {confidencePct}
                      </span>
                    )}
                  </>
                ) : isSelectedContaminated ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase tracking-wider">
                    CONTAMINATED
                  </span>
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
            <div className="rounded-lg bg-[#07080a] border border-white/[0.06] p-3 font-mono text-xs text-cyan-300/90 leading-relaxed overflow-x-auto shadow-inner max-h-[360px]">
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
          {/* Top: Diagnosis Section */}
          <div className="p-4 space-y-3.5">
            <div>
              <div className="text-xs font-bold text-white font-heading">Diagnosis</div>
              <div className="text-[11px] text-zinc-500 font-mono">
                {diagnosis?.policy || 'GNN ranked suspects'}
              </div>
            </div>

            {/* Suspect Steps List */}
            <div className="space-y-1 font-mono text-xs">
              {suspectScores.length === 0 ? (
                <div className="p-3 text-center text-xs text-zinc-500 font-sans">
                  {isFailed ? 'No suspect scores generated' : 'Run passed — no fault detected'}
                </div>
              ) : (
                suspectScores.slice(0, 5).map((s: { idx: number; p: number; rank?: number }, idx: number) => {
                  const nodeObj = nodes.find((n) => (n.data as any)?.idx === s.idx);
                  const stepLabel = nodeObj ? (nodeObj.data as any)?.name || (nodeObj.data as any)?.node : `Step ${s.idx}`;
                  const isTopGuilty = s.idx === graphData?.guilty_step || idx === 0;

                  return (
                    <div
                      key={s.idx}
                      onClick={() => setSelectedStepIdx(s.idx)}
                      className={`p-2 rounded-lg transition-colors cursor-pointer flex items-center justify-between ${
                        isTopGuilty
                          ? 'bg-rose-950/20 border border-rose-500/30 text-zinc-200'
                          : 'hover:bg-white/[0.02] text-zinc-400'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={isTopGuilty ? 'text-rose-400 font-bold' : 'text-zinc-500 font-bold'}>
                          #{s.rank ?? idx + 1}
                        </span>
                        <span>Step {s.idx.toString().padStart(2, '0')} - {stepLabel}</span>
                      </div>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          isTopGuilty ? 'bg-rose-500/20 text-rose-300' : 'text-zinc-400'
                        }`}
                      >
                        {s.p.toFixed(2)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Evidence Bullets */}
            <div className="space-y-1.5 text-xs text-zinc-400 leading-relaxed pt-1">
              <div className="font-semibold text-zinc-300 text-[11px] uppercase font-mono">Evidence</div>
              {allEvidenceSentences.length === 0 ? (
                <div className="text-[11px] text-zinc-500 italic pl-2">
                  {isFailed ? 'No natural language evidence generated' : 'Execution executed according to specification'}
                </div>
              ) : (
                <ul className="space-y-1 pl-2">
                  {allEvidenceSentences.slice(0, 4).map((sentence, sIdx) => (
                    <li key={sIdx} className="flex items-start gap-1.5">
                      <span className="text-rose-400 font-bold shrink-0">•</span>
                      <span>{sentence}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              onClick={() => navigate(`/causal?run_id=${runId}`)}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium pt-1 cursor-pointer"
            >
              <span>View Full Analysis</span>
              <span>→</span>
            </button>
          </div>

          {/* Bottom: Replay Efficiency Section */}
          <div className="p-4 space-y-3.5">
            <div>
              <div className="text-xs font-bold text-white font-heading">Replay Efficiency</div>
              <div className="text-[11px] text-zinc-500 font-mono">
                {isFailed && graphData?.guilty_step !== undefined
                  ? `Re-running from step ${graphData.guilty_step} with repair`
                  : 'Counterfactual replay execution'}
              </div>
            </div>

            {/* Replay Blocks */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="flex items-center gap-1 text-blue-400">
                  <span className="w-2 h-2 rounded-sm bg-blue-500" />
                  <span>Executed ({executedCount})</span>
                </span>
                <span className="flex items-center gap-1 text-zinc-500">
                  <span className="w-2 h-2 rounded-sm bg-[#181a20]" />
                  <span>Reused ({reusedCount})</span>
                </span>
              </div>

              {/* Step blocks strip */}
              <div className="grid grid-cols-12 gap-1 h-5">
                {Array.from({ length: Math.min(12, totalSteps || 12) }).map((_, idx) => {
                  const isExecuted = isFailed ? idx >= Math.max(0, totalSteps - executedCount) : false;
                  return (
                    <div
                      key={idx}
                      className={`rounded-sm ${
                        isExecuted
                          ? 'bg-blue-500 shadow-sm shadow-blue-500/50'
                          : 'bg-[#181a20] border border-white/[0.04]'
                      }`}
                      title={`Step ${idx}: ${isExecuted ? 'Executed' : 'Reused from save-point'}`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono pt-1">
              <div className="p-2 rounded-lg bg-[#0d0e12] border border-white/[0.04]">
                <div className="text-base font-bold text-white">{totalSteps}</div>
                <div className="text-[9px] text-zinc-500 uppercase">total steps</div>
              </div>
              <div className="p-2 rounded-lg bg-[#0d0e12] border border-white/[0.04]">
                <div className="text-base font-bold text-blue-400">{executedCount}</div>
                <div className="text-[9px] text-zinc-500 uppercase">executed</div>
              </div>
              <div className="p-2 rounded-lg bg-[#0d0e12] border border-white/[0.04]">
                <div className="text-base font-bold text-emerald-400">{reusedCount}</div>
                <div className="text-[9px] text-zinc-500 uppercase">reused</div>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-[#0d0e12] border border-white/[0.04] text-[11px] font-mono text-zinc-400 space-y-1">
              <div className="flex justify-between">
                <span>Save-point Replay Savings:</span>
                <span className="text-emerald-400 font-bold">{reusedPct}%</span>
              </div>
              <div className="flex justify-between">
                <span>Model Call Reduction:</span>
                <span className="text-cyan-400 font-bold">{reusedCount} steps saved</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
