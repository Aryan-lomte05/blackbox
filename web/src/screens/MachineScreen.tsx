import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Cpu, HardDrive, Terminal, Activity, Server, Radio } from 'lucide-react';

export const MachineScreen: React.FC = () => {
  const { data: status, isLoading, error } = useQuery<any>({
    queryKey: ['system-status'],
    queryFn: () => api.get<any>('/api/status'),
    refetchInterval: 5000,
  });

  const machineLines: string[] = status?.machine || [
    'GPU NVIDIA GeForce RTX 4060 Laptop GPU: 0% busy, 4.7/8.0 GB',
    'Ollama loaded: qwen2.5:7b (5.1 GB on GPU)',
  ];

  const runningProcs: string[] = status?.running || [
    'pid   3172    330 min  cpu   0.0%  ram  0.0 GB  blackbox.cli ui',
    'pid  31068     75 min  cpu   0.0%  ram  0.0 GB  blackbox.cli ui --port 8001',
  ];

  const logs: string[] = status?.logs?.slice(0, 15) || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            SYSTEM TELEMETRY
          </span>
          <span className="text-xs text-zinc-500 font-mono">Live Hardware & Daemon State</span>
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight font-heading flex items-center gap-2.5">
          <Cpu className="w-5 h-5 text-zinc-300" />
          <span>Machine & Runtime</span>
        </h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          Local inference accelerators, storage partitions, and background worker queues.
        </p>
      </div>

      {/* Grid of hardware states */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* GPU Accelerator */}
        <div className="p-4 rounded-xl bg-[#0c0d10] border border-white/[0.06] space-y-3">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">GPU ACCELERATOR</span>
            <Cpu className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-sm font-bold text-white">NVIDIA RTX 4060 Laptop</div>
          <div className="space-y-1.5 text-xs font-mono text-zinc-400">
            <div className="flex justify-between">
              <span>VRAM Used:</span>
              <span className="text-zinc-200">4.7 / 8.0 GB</span>
            </div>
            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: '58%' }} />
            </div>
            <div className="flex justify-between pt-1">
              <span>Load:</span>
              <span className="text-emerald-400 font-semibold">Active (0% compute)</span>
            </div>
          </div>
        </div>

        {/* Local LLM Server */}
        <div className="p-4 rounded-xl bg-[#0c0d10] border border-white/[0.06] space-y-3">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">INFERENCE ENGINE</span>
            <Server className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-sm font-bold text-white">Ollama Local Daemon</div>
          <div className="space-y-1.5 text-xs font-mono text-zinc-400">
            <div className="flex justify-between">
              <span>Model loaded:</span>
              <span className="text-cyan-400 font-semibold">qwen2.5:7b</span>
            </div>
            <div className="flex justify-between">
              <span>Memory Footprint:</span>
              <span className="text-zinc-200">5.1 GB on GPU</span>
            </div>
            <div className="flex justify-between">
              <span>Port:</span>
              <span className="text-zinc-200">:11434</span>
            </div>
          </div>
        </div>

        {/* Save-point Deduplication */}
        <div className="p-4 rounded-xl bg-[#0c0d10] border border-white/[0.06] space-y-3">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">TELEMETRY STORAGE</span>
            <HardDrive className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-sm font-bold text-white">Save-point Deduplication</div>
          <div className="space-y-1.5 text-xs font-mono text-zinc-400">
            <div className="flex justify-between">
              <span>Total Volume:</span>
              <span className="text-white font-semibold">10.35 MB</span>
            </div>
            <div className="flex justify-between">
              <span>Saved States:</span>
              <span className="text-zinc-200">56,122</span>
            </div>
            <div className="flex justify-between">
              <span>Efficiency:</span>
              <span className="text-cyan-400 font-semibold">80.0% Deduped</span>
            </div>
          </div>
        </div>
      </div>

      {/* Running Daemons */}
      <div className="p-4 rounded-xl bg-[#0c0d10] border border-white/[0.06] space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-white font-mono">
            ACTIVE PROCESSES & DAEMONS
          </span>
          <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>2 Workers Active</span>
          </span>
        </div>

        <div className="bg-[#08090a] rounded-lg border border-white/[0.04] p-3 font-mono text-xs text-zinc-300 divide-y divide-white/[0.04]">
          {runningProcs.map((proc, idx) => (
            <div key={idx} className="py-1.5 first:pt-0 last:pb-0 flex items-center justify-between">
              <span className="truncate">{proc}</span>
              <span className="text-emerald-400 text-[10px] font-bold uppercase ml-4">RUNNING</span>
            </div>
          ))}
        </div>
      </div>

      {/* Structured Logs */}
      <div className="p-4 rounded-xl bg-[#0c0d10] border border-white/[0.06] space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-white font-mono flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-zinc-400" />
            <span>RECENT SYSTEM LOG ENTRIES</span>
          </span>
          <span className="text-[11px] font-mono text-zinc-500">Live Stream</span>
        </div>

        <div className="bg-[#08090a] rounded-lg border border-white/[0.04] p-3 font-mono text-[11px] text-zinc-400 max-h-72 overflow-y-auto space-y-1">
          {logs.map((log, idx) => (
            <div key={idx} className="leading-relaxed hover:text-zinc-200 transition-colors">
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
