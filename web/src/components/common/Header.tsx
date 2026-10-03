import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Search, Settings, Radio } from 'lucide-react';

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const { data: status, isError } = useQuery({
    queryKey: ['system-status'],
    queryFn: () => api.get<any>('/api/status').catch(() => null),
    refetchInterval: 10000,
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/runs?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const isOnline = !isError && status !== null;

  return (
    <header className="h-14 border-b border-white/[0.06] bg-[#090a0c]/90 backdrop-blur-xl sticky top-0 z-20 px-6 flex items-center justify-between select-none">
      {/* Search Input Bar matching reference */}
      <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search runs, tasks, or anything..."
            className="w-full bg-[#111215] text-xs text-zinc-200 placeholder:text-zinc-500 pl-8 pr-12 py-1.5 rounded-lg border border-white/[0.07] focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all font-sans"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-zinc-500 bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.06] pointer-events-none">
            ⌘K
          </kbd>
        </div>
      </form>

      {/* Right Controls */}
      <div className="flex items-center gap-3.5 text-xs">
        {/* Settings button */}
        <button
          onClick={() => navigate('/api-status')}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors"
          title="System Settings"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* API: ONLINE badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-mono font-medium">
          <span className="relative flex h-2 w-2">
            {isOnline && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isOnline ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            ></span>
          </span>
          <span>{isOnline ? 'API: ONLINE' : 'API: OFFLINE'}</span>
        </div>

        {/* User Avatar */}
        <div
          className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700/80 flex items-center justify-center text-xs font-semibold text-zinc-200 shadow-sm cursor-pointer hover:border-zinc-500 transition-colors"
          title="User Advay (Demo Operator)"
        >
          A
        </div>
      </div>
    </header>
  );
};
