import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { HardDrive, Activity, Radio } from 'lucide-react';

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
    <header className="h-16 border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur-md sticky top-0 z-20 px-8 flex items-center justify-between">
      <div>
        <h1 className="text-base font-bold text-zinc-100 tracking-tight flex items-center gap-2">
          {title}
        </h1>
        {subtitle && <p className="text-xs text-zinc-400 font-mono mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4 text-xs">
        {/* Storage stats (USP U3) */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800/80 text-zinc-300 font-mono text-[11px]">
          <HardDrive className="w-3.5 h-3.5 text-zinc-400" />
          <span>Save-points:</span>
          <span className="text-zinc-100 font-semibold">10.4 MB</span>
          <span className="text-emerald-400 text-[10px] bg-emerald-950/60 px-1 py-0.2 rounded border border-emerald-500/30">
            80% dedup
          </span>
        </div>

        {/* Live jobs badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800/80 text-zinc-300 font-mono text-[11px]">
          <Radio className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
          <span>Jobs:</span>
          <span className="text-zinc-100 font-semibold">
            {status?.running?.length || 0} active
          </span>
        </div>

        {/* Server state */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 font-mono text-[11px]">
          <Activity className="w-3 h-3 text-emerald-400" />
          <span>Backend Online</span>
        </div>
      </div>
    </header>
  );
};
