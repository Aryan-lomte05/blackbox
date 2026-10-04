import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Cpu, HardDrive, Terminal, Activity, Server, Radio } from 'lucide-react';

export const MachineScreen: React.FC = () => {
  const { data: status, isLoading } = useQuery<any>({
    queryKey: ['system-status'],
    queryFn: () => api.get<any>('/api/status'),
    refetchInterval: 5000,
  });

  const machineLines: string[] = status?.machine || [];
  const runningProcs: string[] = status?.running || [];
  const counts = status?.counts || {};
  const logs: string[] = status?.logs?.slice(0, 15) || [];

  // Parse GPU accelerator info dynamically from backend
  const gpuLine = machineLines.find((l) => l.toLowerCase().includes('gpu')) || '';
  const ollamaLine = machineLines.find((l) => l.toLowerCase().includes('ollama')) || '';

  // Extract VRAM string (e.g. "1.4/6.0 GB" or "4.7/8.0 GB")
  const vramMatch = gpuLine.match(/([\d.]+)\/([\d.]+)\s*GB/i);
  const vramUsed = vramMatch ? parseFloat(vramMatch[1]) : 0;
  const vramTotal = vramMatch ? parseFloat(vramMatch[2]) : 8.0;
  const vramPct = vramTotal > 0 ? Math.min(100, Math.round((vramUsed / vramTotal) * 100)) : 0;

  // Extract GPU model name
  const gpuNameMatch = gpuLine.match(/GPU\s+([^:]+):/i);
  const gpuName = gpuNameMatch ? gpuNameMatch[1] : (gpuLine || 'Standard Hardware Node');

  // Extract Ollama status
  const isOllamaLoaded = ollamaLine.includes('loaded') && !ollamaLine.includes('none');
  const ollamaModelMatch = ollamaLine.match(/loaded:\s*([^\s(]+)/i);
  const ollamaModel = ollamaModelMatch ? ollamaModelMatch[1] : (isOllamaLoaded ? 'Loaded' : 'None active');

  // Storage and deduplication
  const totalVolumeMb = counts.blob_mb ? `${counts.blob_mb} MB` : '—';
  const savePoints = counts.save_points || 0;
  const uniqueSavePoints = counts.unique_save_points || 0;
  const dedupPct = savePoints > 0 ? Math.round((1 - uniqueSavePoints / savePoints) * 100) : 0;

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
          <div className="text-sm font-bold text-white truncate" title={gpuName}>
            {isLoading ? 'Detecting GPU...' : gpuName}
          </div>
          <div className="space-y-1.5 text-xs font-mono text-zinc-400">
            <div className="flex justify-between">
              <span>VRAM Used:</span>
              <span className="text-zinc-200">
                {vramMatch ? `${vramUsed} / ${vramTotal} GB` : 'Dynamic allocation'}
              </span>
            </div>
            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all"
                style={{ width: `${vramPct || 10}%` }}
              />
            </div>
            <div className="flex justify-between pt-1">
              <span>Status:</span>
              <span className="text-emerald-400 font-semibold">
                {gpuLine.includes('busy') ? gpuLine.split(':')[1]?.trim() : 'Operational'}
              </span>
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
              <span className="text-cyan-400 font-semibold">{ollamaModel}</span>
            </div>
            <div className="flex justify-between">
              <span>State:</span>
              <span className="text-zinc-200">{isOllamaLoaded ? 'Active in memory' : 'Standby / On-demand'}</span>
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
              <span className="text-white font-semibold">{totalVolumeMb}</span>
            </div>
            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-cyan-500 h-full rounded-full transition-all"
                style={{ width: `${dedupPct}%` }}
              />
            </div>
            <div className="flex justify-between pt-1">
              <span>Ratio:</span>
              <span className="text-cyan-400 font-semibold">
                {dedupPct}% de-duplicated ({uniqueSavePoints.toLocaleString()} files)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Running Background Workers / Processes */}
      <div className="rounded-xl border border-white/[0.06] bg-[#0c0d10] p-5 space-y-3 shadow-xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-white font-mono">
              Running Daemons & Workers
            </span>
          </div>
          <span className="text-[11px] font-mono text-zinc-500">
            {runningProcs.length} active tasks
          </span>
        </div>

        <div className="space-y-2 font-mono text-xs">
          {runningProcs.map((proc, idx) => (
            <div
              key={idx}
              className="p-3 rounded-lg bg-[#08090a] border border-white/[0.04] text-zinc-300 flex items-center justify-between"
            >
              <span>{proc}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400">
                ACTIVE
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Daemon Log Stream */}
      <div className="rounded-xl border border-white/[0.06] bg-[#0c0d10] p-5 space-y-3 shadow-xl">
        <div className="flex items-center gap-2 border-b border-white/[0.06] pb-3">
          <Terminal className="w-4 h-4 text-zinc-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-white font-mono">
            System Log Output (:8000)
          </span>
        </div>

        <div className="bg-[#07080a] border border-white/[0.04] rounded-lg p-3 font-mono text-xs text-zinc-400 space-y-1 max-h-60 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="text-zinc-600">No system events logged recently.</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-zinc-600 select-none">[{i + 1}]</span>
                <span className="text-zinc-300">{log}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
