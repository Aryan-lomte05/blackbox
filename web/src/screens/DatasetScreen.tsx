import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Database, Layers, HardDrive, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

export const DatasetScreen: React.FC = () => {
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ['dataset-metrics'],
    queryFn: async () => {
      return await api.get<any>('/api/dataset');
    },
  });

  const totalRuns = data?.summary?.runs || 0;
  const totalSteps = data?.storage?.save_points || 0;
  const totalLabelled = data?.storage?.labelled_failures || 0;
  const blobMb = data?.storage?.blob_mb || 0;
  const dedupPct = Math.round((data?.storage?.save_point_dedup || 0) * 100);
  const injectedCount = data?.summary?.labelled_by_source?.injected || 0;
  const verifiedCount = data?.summary?.labelled_by_source?.verified || 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Top Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            RECORDED TRACES
          </span>
          <span className="text-xs text-zinc-500 font-mono">Telemetry Partition & Split Health</span>
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight font-heading flex items-center gap-2.5">
          <Database className="w-5 h-5 text-zinc-300" />
          <span>Dataset & Provenance</span>
        </h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          {isLoading
            ? 'Loading dataset provenance from flight recorder database...'
            : `Comprehensive accounting of ${totalRuns.toLocaleString()} recorded agent executions, ${totalSteps.toLocaleString()} states, and ${totalLabelled.toLocaleString()} ground-truth root causes.`}
        </p>
      </div>

      {isLoading && (
        <div className="p-12 text-center text-zinc-500 text-xs font-mono">
          Computing dataset health statistics from store...
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>Failed to load dataset metrics: {(error as any)?.detail || error.message}</span>
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Top KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-[#0c0d10] border border-white/[0.06] space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">TOTAL RECORDED RUNS</span>
              <div className="text-2xl font-bold font-mono text-white">
                {totalRuns.toLocaleString()}
              </div>
              <div className="text-[11px] text-zinc-400">
                {Object.keys(data.summary?.by_family || {}).join(', ').toUpperCase()}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#0c0d10] border border-white/[0.06] space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">SAVE-POINTS</span>
              <div className="text-2xl font-bold font-mono text-white">
                {totalSteps.toLocaleString()}
              </div>
              <div className="text-[11px] text-zinc-400">{blobMb} MB stored</div>
            </div>

            <div className="p-4 rounded-xl bg-[#0c0d10] border border-white/[0.06] space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">LABELLED ROOT CAUSES</span>
              <div className="text-2xl font-bold font-mono text-white">
                {totalLabelled.toLocaleString()}
              </div>
              <div className="text-[11px] text-rose-400">
                {injectedCount} injected, {verifiedCount} verified
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#0c0d10] border border-white/[0.06] space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">SAVE-POINT DEDUP</span>
              <div className="text-2xl font-bold font-mono text-cyan-400">{dedupPct}%</div>
              <div className="text-[11px] text-zinc-400">Content-addressed storage</div>
            </div>
          </div>

          {/* Breakdown Grids */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Task Families */}
            <div className="p-5 rounded-xl bg-[#0c0d10] border border-white/[0.06] space-y-3 shadow-xl">
              <span className="text-xs uppercase font-bold text-white font-mono tracking-wider block pb-2 border-b border-white/[0.04]">
                Runs by Task Family
              </span>

              <div className="space-y-2 text-xs">
                {data.summary?.by_family &&
                  Object.entries(data.summary.by_family).map(([fam, count]: any) => (
                    <div key={fam} className="p-3 rounded-lg bg-[#08090a] border border-white/[0.04] flex items-center justify-between">
                      <span className="capitalize font-bold text-zinc-200">{fam}</span>
                      <span className="text-zinc-400 font-mono">{count} runs</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Generalization Splits */}
            <div className="p-5 rounded-xl bg-[#0c0d10] border border-white/[0.06] space-y-3 shadow-xl">
              <span className="text-xs uppercase font-bold text-white font-mono tracking-wider block pb-2 border-b border-white/[0.04]">
                Generalization Splits (Partitioned by task hash)
              </span>

              <div className="space-y-2 text-xs">
                {data.summary?.by_split &&
                  Object.entries(data.summary.by_split).map(([split, count]: any) => (
                    <div key={split} className="p-3 rounded-lg bg-[#08090a] border border-white/[0.04] flex items-center justify-between">
                      <span className="font-bold text-zinc-200 uppercase font-mono text-[11px]">{split}</span>
                      <div className="flex items-center gap-3 font-mono">
                        <span className="text-zinc-400">{count} runs</span>
                        {data.summary?.labelled_by_split?.[split] && (
                          <span className="text-rose-400 text-[11px]">
                            ({data.summary.labelled_by_split[split]} labelled)
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Planted Mistakes Catalog */}
          <div className="p-5 rounded-xl bg-[#0c0d10] border border-white/[0.06] space-y-3 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
              <span className="text-xs uppercase font-bold text-white font-mono tracking-wider">
                Planted Mistakes Catalog (F1–F10)
              </span>
              <span className="text-xs text-amber-400 font-mono">
                Held out from training: [{data.kept_out_of_training?.join(', ') || 'F7, F8, F9, F10'}]
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
              {data.mistakes &&
                Object.entries(data.mistakes).map(([code, name]: any) => {
                  const isHeldOut = data.kept_out_of_training?.includes(code);
                  return (
                    <div
                      key={code}
                      className={`p-3 rounded-lg border space-y-1 ${
                        isHeldOut
                          ? 'bg-amber-950/20 border-amber-500/40 text-amber-200'
                          : 'bg-[#08090a] border-white/[0.04] text-zinc-300'
                      }`}
                    >
                      <div className="flex justify-between items-center font-mono">
                        <span className="font-bold">{code}</span>
                        {isHeldOut && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-amber-500/20 text-amber-300 uppercase">
                            HELD OUT
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-400 truncate">{name}</div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
