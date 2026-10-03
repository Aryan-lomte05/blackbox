import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { StepKind } from '../../types/api';
import { AlertCircle, Bug, ShieldAlert, Cpu, Wrench, Search, CheckCircle, Database } from 'lucide-react';

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
  checker?: {
    on_track?: number;
    consistent?: number;
    alarm?: boolean;
    tier?: string;
  } | null;
}

const kindIcons: Record<StepKind, React.ComponentType<{ className?: string }>> = {
  llm: Cpu,
  tool: Wrench,
  retrieval: Search,
  final: CheckCircle,
  state: Database,
};

const kindStyles: Record<StepKind, { bg: string; text: string; border: string }> = {
  llm: { bg: 'bg-blue-950/40', text: 'text-blue-300', border: 'border-blue-500/30' },
  tool: { bg: 'bg-purple-950/40', text: 'text-purple-300', border: 'border-purple-500/30' },
  retrieval: { bg: 'bg-cyan-950/40', text: 'text-cyan-300', border: 'border-cyan-500/30' },
  final: { bg: 'bg-emerald-950/40', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  state: { bg: 'bg-zinc-800/40', text: 'text-zinc-300', border: 'border-zinc-700/30' },
};

export const StepNode = memo(({ data, selected }: { data: StepNodeData; selected?: boolean }) => {
  const Icon = kindIcons[data.kind] || Cpu;
  const style = kindStyles[data.kind] || kindStyles.llm;

  // Determine border and highlight styles based on status
  let borderStyle = 'border-zinc-800 hover:border-zinc-600';
  let glowStyle = '';

  if (data.is_guilty) {
    borderStyle = 'border-rose-500 shadow-lg shadow-rose-950/80 ring-2 ring-rose-500/50';
    glowStyle = 'bg-rose-950/20';
  } else if (data.is_contaminated) {
    borderStyle = 'border-amber-500 shadow-md shadow-amber-950/60 ring-1 ring-amber-500/40';
    glowStyle = 'bg-amber-950/15';
  } else if (data.suspect_rank) {
    borderStyle = 'border-indigo-500/80 shadow-md shadow-indigo-950/50';
  }

  if (selected) {
    borderStyle += ' ring-2 ring-white';
  }

  return (
    <div
      className={`w-64 rounded-xl border bg-zinc-900/90 text-zinc-100 p-3.5 transition-all cursor-pointer backdrop-blur-md ${borderStyle} ${glowStyle}`}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-zinc-500 !border-zinc-900" />

      {/* Top badges bar */}
      <div className="flex items-center justify-between gap-1 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-mono font-bold text-zinc-300">
            #{data.idx}
          </span>
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider font-semibold border ${style.bg} ${style.text} ${style.border}`}>
            <Icon className="w-2.5 h-2.5" />
            {data.kind}
          </span>
        </div>

        {/* Suspect rank / Guilty badge */}
        <div className="flex items-center gap-1">
          {data.is_guilty && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-rose-600 text-white uppercase tracking-tight flex items-center gap-0.5 animate-pulse">
              <AlertCircle className="w-2.5 h-2.5" />
              GUILTY
            </span>
          )}
          {data.is_planted && !data.is_guilty && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-600/90 text-white uppercase tracking-tight flex items-center gap-0.5">
              <Bug className="w-2.5 h-2.5" />
              PLANTED
            </span>
          )}
          {data.suspect_rank && !data.is_guilty && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-indigo-600 text-white uppercase tracking-tight flex items-center gap-0.5">
              <ShieldAlert className="w-2.5 h-2.5" />
              #{data.suspect_rank}
            </span>
          )}
          {data.is_contaminated && !data.is_guilty && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-tight">
              CONTAMINATED
            </span>
          )}
        </div>
      </div>

      {/* Node / tool name */}
      <div className="font-mono text-xs font-bold text-zinc-200 truncate flex items-center justify-between">
        <span>{data.name || data.node}</span>
        <span className="text-[10px] text-zinc-500 font-normal">:{data.node}</span>
      </div>

      {/* Preview text */}
      <div className="mt-2 p-2 rounded bg-zinc-950/80 border border-zinc-800/80 text-[11px] font-mono text-zinc-300 line-clamp-2 break-all">
        {data.preview || 'No preview'}
      </div>

      {/* Footer stats */}
      <div className="mt-2.5 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[10px] font-mono text-zinc-400">
        <div>
          {data.latency_ms !== undefined && data.latency_ms !== null ? (
            <span>{data.latency_ms.toFixed(0)}ms</span>
          ) : (
            <span>cached</span>
          )}
        </div>
        {data.checker && (
          <div className="flex items-center gap-1 text-[9px]">
            <span>track:</span>
            <span className={(data.checker.on_track ?? 1) < 0.6 ? 'text-amber-400' : 'text-emerald-400'}>
              {((data.checker.on_track ?? 0) * 100).toFixed(0)}%
            </span>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-zinc-500 !border-zinc-900" />
    </div>
  );
});
