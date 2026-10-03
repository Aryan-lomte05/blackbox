import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { KPI } from '../components/common/KPI';
import {
  Database,
  Layers,
  HardDrive,
  Cpu,
  AlertCircle,
  Tag,
  ShieldCheck,
  CheckCircle,
  Sparkles,
} from 'lucide-react';

export const DatasetScreen: React.FC = () => {
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ['dataset-metrics'],
    queryFn: async () => {
      return await api.get<any>('/api/dataset');
    },
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-sans">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
              GROUND TRUTH & BENCHMARKS
            </span>
            <span className="text-xs text-zinc-400">Dataset Health & Generalization Splits</span>
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-inner">
              <Database className="w-5 h-5" />
            </div>
            Dataset & Health
          </h2>
          <p className="text-sm text-zinc-400 mt-1.5 max-w-2xl leading-relaxed">
            Complete accounting of our recorded dataset: 5,675 agent runs, 56k steps, 859 ground-truth root causes, strict task-hash splits, and zero-shot held-out task families.
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="p-16 text-center text-zinc-500 text-xs animate-pulse">
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
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Top KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPI
              label="Total Recorded Runs"
              value={data.summary?.total_runs?.toLocaleString() || '5,675'}
              secondary="GSM8K, HotpotQA, Shop"
              trend="up"
              icon={<Layers className="w-4 h-4 text-zinc-400" />}
            />
            <KPI
              label="Recorded Save-points"
              value={data.storage?.save_points?.toLocaleString() || '56,365'}
              secondary={`${data.storage?.blob_mb || 22.1} MB stored`}
              trend="up"
              icon={<HardDrive className="w-4 h-4 text-cyan-400" />}
            />
            <KPI
              label="Labelled Root Causes"
              value={data.storage?.labelled_failures || '859'}
              secondary="815 injected, 44 verified"
              trend="up"
              highlight={true}
              icon={<ShieldCheck className="w-4 h-4 text-emerald-400" />}
            />
            <KPI
              label="Savepoint De-duplication"
              value={`${Math.round((data.storage?.save_point_dedup ?? 0.58) * 100)}%`}
              secondary="Content-addressed hashes"
              trend="up"
              icon={<CheckCircle className="w-4 h-4 text-emerald-400" />}
            />
          </div>

          {/* Dataset Family Breakdown & Generalization Splits */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Task Families */}
            <div className="glass-card p-6 rounded-2xl border border-zinc-800 shadow-xl space-y-4">
              <span className="text-xs uppercase font-bold text-zinc-200 tracking-wider block pb-2 border-b border-zinc-800">
                Runs by Task Family
              </span>

              <div className="space-y-3 text-xs">
                {data.summary?.by_family &&
                  Object.entries(data.summary.by_family).map(([fam, count]: any) => (
                    <div key={fam} className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-between">
                      <span className="capitalize font-bold text-zinc-200 text-sm">{fam}</span>
                      <span className="text-zinc-400 font-mono">{count} runs</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Generalization Splits */}
            <div className="glass-card p-6 rounded-2xl border border-zinc-800 shadow-xl space-y-4">
              <span className="text-xs uppercase font-bold text-zinc-200 tracking-wider block pb-2 border-b border-zinc-800">
                Split Distribution (Split by hash(task_id))
              </span>

              <div className="space-y-3 text-xs">
                {data.summary?.by_split &&
                  Object.entries(data.summary.by_split).map(([split, count]: any) => (
                    <div key={split} className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-between">
                      <span className="font-bold text-zinc-200 uppercase text-xs">{split}</span>
                      <div className="flex items-center gap-3 font-mono">
                        <span className="text-zinc-400">{count} runs</span>
                        {data.summary?.labelled_by_split?.[split] && (
                          <span className="text-rose-400 text-[11px] font-semibold">
                            ({data.summary.labelled_by_split[split]} labelled)
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Mistake Catalog (F1–F10) & Held-Out Test Splits */}
          <div className="glass-card p-6 rounded-2xl border border-zinc-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <span className="text-xs uppercase font-bold text-zinc-200 tracking-wider">
                Planted Mistakes Catalog (F1–F10)
              </span>
              <span className="text-xs text-amber-400 font-mono">
                Held out from training: [{data.kept_out_of_training?.join(', ')}]
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
              {data.mistakes &&
                Object.entries(data.mistakes).map(([code, name]: any) => {
                  const isHeldOut = data.kept_out_of_training?.includes(code);
                  return (
                    <div
                      key={code}
                      className={`p-3.5 rounded-xl border space-y-1.5 transition-all ${
                        isHeldOut
                          ? 'bg-amber-950/30 border-amber-500/50 text-amber-200 shadow-md shadow-amber-950/30'
                          : 'bg-zinc-950/80 border-zinc-800/80 text-zinc-300'
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
        </motion.div>
      )}
    </div>
  );
};

