import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { HardDrive, Activity, Radio, Cpu, Sparkles } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle }) => {
  const { data: status } = useQuery({
    queryKey: ['system-status'],
    queryFn: () => api.get<any>('/api/status').catch(() => null),
    refetchInterval: 10000,
  });

  return (
    <header className="h-16 border-b border-white/[0.06] bg-[#08090a]/80 backdrop-blur-xl sticky top-0 z-20 px-8 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-sm font-heading font-bold text-white tracking-tight flex items-center gap-2">
            {title}
          </h1>
          {subtitle && <p className="text-xs text-zinc-400 font-sans mt-0.5">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs">
        {/* Storage deduplication chip (USP U3) */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-zinc-300">
          <HardDrive className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-zinc-400 text-xs">Save-points:</span>
          <span className="text-white font-mono font-medium">10.4 MB</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
            80% saved
          </span>
        </div>

        {/* Live jobs badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-zinc-300">
          <Radio className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
          <span className="text-zinc-400 text-xs">Jobs:</span>
          <span className="font-mono text-zinc-100 font-medium">
            {status?.running?.length || 0} active
          </span>
        </div>

        {/* Local model chip */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
          <Sparkles className="w-3.5 h-3.5 text-rose-400" />
          <span className="font-medium">qwen2.5:7b</span>
        </div>
      </div>
    </header>
  );
};
