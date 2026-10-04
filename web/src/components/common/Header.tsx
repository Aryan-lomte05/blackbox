import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Search, Settings, Radio } from 'lucide-react';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  onOpenPalette?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenPalette }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const { data: status, isError } = useQuery({
    queryKey: ['system-status'],
    queryFn: () => api.get<any>('/api/status').catch(() => null),
    refetchInterval: 10000,
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onOpenPalette) {
      onOpenPalette();
      return;
    }
    if (searchQuery.trim()) {
      navigate(`/runs?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const isOnline = !isError && status !== null;

  return (
    <header className="h-14 border-b border-[var(--line)] bg-[var(--bg)]/90 backdrop-blur-md sticky top-0 z-20 px-6 flex items-center justify-between select-none">
      {/* Search Input Bar */}
      <div
        onClick={onOpenPalette}
        className="relative flex-1 max-w-md cursor-pointer group"
      >
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-[var(--faint)] absolute left-3 pointer-events-none group-hover:text-[var(--text)] transition-colors" />
          <input
            type="text"
            readOnly
            onClick={onOpenPalette}
            placeholder="Search runs, screens, cases... (⌘K)"
            className="w-full bg-[var(--raised)] text-xs text-[var(--text)] placeholder:text-[var(--faint)] pl-8 pr-12 py-1.5 rounded-[var(--radius-sm)] border border-[var(--line)] hover:border-[var(--line-strong)] cursor-pointer focus:outline-none transition-colors font-sans"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[var(--faint)] bg-[var(--panel)] px-1.5 py-0.5 rounded border border-[var(--line)] pointer-events-none">
            ⌘K
          </kbd>
        </div>
      </div>

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
