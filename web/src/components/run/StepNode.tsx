import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { StepKind } from '../../types/api';
import { Cpu, Wrench, Search, CheckCircle, Database } from 'lucide-react';

interface StepNodeData {
  idx: number;
  kind: StepKind;
  name: string;
  node: string;
  label: string;
  preview: string;
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

const kindIcons: Record<StepKind, React.ComponentType<{ className?: string }>> = {
  llm: Cpu,
  tool: Wrench,
  retrieval: Search,
  final: CheckCircle,
  state: Database,
};

export const StepNode = memo(({ data, selected }: { data: StepNodeData; selected?: boolean }) => {
  const Icon = kindIcons[data.kind] || Cpu;

  // Visual styling matching reference image
  let borderStyle = 'border-white/[0.08] bg-[#0f1013] text-zinc-200';
  let badge = null;

  if (data.is_guilty) {
    borderStyle = 'border-rose-500 bg-[#160d10] text-white shadow-lg shadow-rose-950/40 ring-1 ring-rose-500/50';
  } else if (data.is_contaminated || data.suspect_rank) {
    borderStyle = 'border-amber-500/60 bg-[#14100b] text-zinc-100 shadow-md shadow-amber-950/30';
  }

  if (selected) {
    borderStyle += ' ring-2 ring-cyan-400';
  }

  const durationStr = data.latency_ms
    ? data.latency_ms > 1000
      ? `${(data.latency_ms / 1000).toFixed(1)}s`
      : `${Math.round(data.latency_ms)}ms`
    : '12ms';

  return (
    <div className="relative group">
      <div
        className={`w-44 rounded-xl border p-3 transition-all duration-150 cursor-pointer select-none font-sans ${borderStyle}`}
      >
        <Handle
          type="target"
          position={Position.Left}
          className="!w-2 !h-2 !bg-zinc-600 !border !border-black"
        />

        {/* Top: Kind Icon + Step index */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono text-zinc-500 font-bold">
              {data.idx.toString().padStart(2, '0')}
            </span>
            <span className="text-xs font-bold text-white capitalize">{data.kind}</span>
          </div>
          {data.is_guilty && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          )}
        </div>

        {/* Step Name / Node */}
        <div className="text-[11px] text-zinc-400 truncate font-mono">
          {data.name || data.node}
        </div>

        {/* Latency */}
        <div className="text-[10px] text-zinc-500 font-mono mt-1">
          {durationStr}
        </div>

        <Handle
          type="source"
          position={Position.Right}
          className="!w-2 !h-2 !bg-zinc-600 !border !border-black"
        />
      </div>

      {/* GUILTY STEP badge tag below card matching reference */}
      {data.is_guilty && (
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-mono text-[9px] font-bold uppercase tracking-wider shadow-md">
            GUILTY STEP
          </span>
        </div>
      )}
    </div>
  );
});
