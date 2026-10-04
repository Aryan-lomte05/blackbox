import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { StepKind } from '../../types/api';
import { Cpu, Wrench, Search, CheckCircle, Database } from 'lucide-react';
import { StepChip } from '../common/StepChip';

export interface StepNodeData {
  [key: string]: unknown;
  idx: number;
  kind: StepKind;
  name: string;
  node?: string;
  label?: string;
  preview?: string;
  error?: string | null;
  reused?: boolean;
  latency_ms?: number;
  tokens?: number;
  suspect_rank?: number | null;
  suspect_p?: number | null;
  is_guilty?: boolean;
  is_planted?: boolean;
  is_contaminated?: boolean;
}

const kindIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  llm: Cpu,
  tool: Wrench,
  retrieval: Search,
  final: CheckCircle,
  state: Database,
};

export const StepNode = memo(({ data, selected }: { data: StepNodeData; selected?: boolean }) => {
  const Icon = kindIcons[data.kind?.toLowerCase()] || Cpu;

  // Variant styling strictly from tokens
  let borderBgStyle = 'border-[var(--line)] bg-[var(--panel)] text-[var(--text)]';
  let chipVariant: 'guilty' | 'trail' | 'suspect' | 'reused' | 'default' = 'default';

  if (data.is_guilty) {
    borderBgStyle = 'border-[var(--guilty)] bg-[var(--guilty-bg)] text-[var(--text-strong)]';
    chipVariant = 'guilty';
  } else if (data.is_contaminated) {
    borderBgStyle = 'border-[var(--trail)] bg-[var(--trail-bg)] text-[var(--text-strong)]';
    chipVariant = 'trail';
  } else if (data.suspect_rank) {
    borderBgStyle = 'border-[var(--trail)]/60 bg-[var(--trail-bg)]/80 text-[var(--text-strong)]';
    chipVariant = 'suspect';
  } else if (data.reused) {
    borderBgStyle = 'border-[var(--line-strong)] ring-1 ring-[var(--info)] bg-[var(--panel)] text-[var(--text)]';
    chipVariant = 'reused';
  }

  if (selected) {
    borderBgStyle += ' ring-2 ring-[var(--accent)]';
  }

  return (
    <div
      style={{ width: '220px', height: '64px' }}
      className={`rounded-[var(--radius-sm)] border p-2 flex flex-col justify-between transition-colors cursor-pointer select-none font-sans relative ${borderBgStyle}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-[var(--line-strong)] !border !border-[var(--bg)]"
      />

      {/* Top row: kind icon + step name + step chip */}
      <div className="flex items-center justify-between gap-1.5 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />
          <span className="font-mono text-xs font-semibold text-[var(--text-strong)] truncate">
            {data.name || data.node || `step_${data.idx}`}
          </span>
        </div>
        <StepChip
          step={data.idx}
          variant={chipVariant}
          suspectRank={data.suspect_rank ?? undefined}
          className="shrink-0 text-[10px] px-1.5 py-0"
        />
      </div>

      {/* Bottom row: 1-line preview */}
      <div className="text-[11px] font-sans text-[var(--muted)] truncate leading-tight">
        {data.preview || data.error || (data.latency_ms ? `${data.latency_ms}ms` : '—')}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-[var(--line-strong)] !border !border-[var(--bg)]"
      />
    </div>
  );
});

StepNode.displayName = 'StepNode';
