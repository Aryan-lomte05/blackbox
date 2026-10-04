import React, { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Node,
  Edge,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { StepNode, StepNodeData } from './StepNode';
import { RunGraphNode, RunGraphEdge, StepKind } from '../../types/api';

const nodeTypes = {
  step: StepNode,
};

interface RunGraphProps {
  nodes: (RunGraphNode | any)[];
  edges: (RunGraphEdge | any)[];
  guiltyStep?: number | null;
  trailSteps?: number[];
  reusedSteps?: number[];
  selectedStep?: number | null;
  onSelectStep?: (idx: number) => void;
  className?: string;
  mini?: boolean;
}

const NODE_WIDTH = 220;
const NODE_HEIGHT = 64;

export const RunGraph: React.FC<RunGraphProps> = ({
  nodes: rawNodes,
  edges: rawEdges,
  guiltyStep,
  trailSteps = [],
  reusedSteps = [],
  selectedStep,
  onSelectStep,
  className = '',
  mini = false,
}) => {
  // Layout using dagre (left to right)
  const { layoutedNodes, layoutedEdges } = useMemo(() => {
    const g = new dagre.graphlib.Graph();
    g.setGraph({
      rankdir: 'LR',
      nodesep: mini ? 24 : 36,
      ranksep: mini ? 48 : 64,
      marginx: 20,
      marginy: 20,
    });
    g.setDefaultEdgeLabel(() => ({}));

    // Register nodes
    rawNodes.forEach((node) => {
      g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    });

    // Register edges
    rawEdges.forEach((edge) => {
      g.setEdge(edge.source, edge.target);
    });

    dagre.layout(g);

    // Build React Flow nodes
    const rfNodes: Node<StepNodeData>[] = rawNodes.map((rn) => {
      const nodeWithPos = g.node(rn.id);
      const d = rn.data || rn; // handle both nested data and flat fixture
      const idx = typeof d.idx === 'number' ? d.idx : parseInt(rn.id.replace('step_', ''), 10) || 0;
      const isGuilty = idx === guiltyStep || !!d.is_guilty;
      const isTrail = trailSteps.includes(idx) || !!d.is_contaminated;
      const isReused = reusedSteps.includes(idx) || !!d.reused;

      return {
        id: rn.id,
        type: 'step',
        position: {
          x: nodeWithPos ? nodeWithPos.x - NODE_WIDTH / 2 : 0,
          y: nodeWithPos ? nodeWithPos.y - NODE_HEIGHT / 2 : 0,
        },
        data: {
          idx,
          kind: (d.kind as StepKind) || 'tool',
          name: d.name || d.node || `step_${idx}`,
          node: d.node || 'execution',
          label: d.label || '',
          preview: d.preview || '',
          error: d.error || null,
          reused: isReused,
          latency_ms: d.latency_ms,
          tokens: d.tokens,
          suspect_rank: d.suspect_rank,
          suspect_p: d.suspect_p,
          is_guilty: isGuilty,
          is_planted: d.is_planted,
          is_contaminated: isTrail,
        },
        selected: idx === selectedStep,
      };
    });

    // Build React Flow edges
    const rfEdges: Edge[] = rawEdges.map((re, index) => {
      const sourceIdx = parseInt(re.source.replace('step_', ''), 10);
      const targetIdx = parseInt(re.target.replace('step_', ''), 10);

      const isTrailEdge =
        re.is_trail ||
        (trailSteps.includes(sourceIdx) && trailSteps.includes(targetIdx));

      const isDataFlow =
        re.type === 'dataflow' ||
        re.kind === 'data' ||
        re.kind === undefined;

      let strokeColor = 'var(--line-strong)';
      let strokeDash = undefined;
      let animated = false;
      let className = '';

      if (isTrailEdge) {
        strokeColor = 'var(--trail)';
        strokeDash = '6 6';
        animated = true;
        className = 'animate-dash-flow';
      } else if (!isDataFlow) {
        // Order edge: dashed --ghost
        strokeColor = 'var(--ghost)';
        strokeDash = '4 4';
      }

      return {
        id: re.id || `e-${re.source}-${re.target}-${index}`,
        source: re.source,
        target: re.target,
        type: 'smoothstep',
        animated,
        className,
        style: {
          stroke: strokeColor,
          strokeWidth: isTrailEdge ? 2 : 1.5,
          strokeDasharray: strokeDash,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 12,
          height: 12,
          color: strokeColor,
        },
      };
    });

    return { layoutedNodes: rfNodes, layoutedEdges: rfEdges };
  }, [rawNodes, rawEdges, guiltyStep, trailSteps, reusedSteps, selectedStep, mini]);

  const handleNodeClick = (_: React.MouseEvent, node: Node) => {
    if (onSelectStep && node.data && typeof (node.data as any).idx === 'number') {
      onSelectStep((node.data as any).idx);
    }
  };

  return (
    <div
      data-lenis-prevent
      className={`w-full h-full relative bg-[var(--bg)] border border-[var(--line)] rounded-[var(--radius)] overflow-hidden ${className}`}
    >
      <ReactFlow
        nodes={layoutedNodes}
        edges={layoutedEdges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: mini ? 0.1 : 0.2 }}
        minZoom={0.2}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--line)" gap={20} size={1} />
        {!mini && <Controls className="!bg-[var(--panel)] !border-[var(--line)] !fill-[var(--text)]" />}
      </ReactFlow>
    </div>
  );
};
