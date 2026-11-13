import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Search, Settings, LogOut, User as UserIcon, LogIn } from 'lucide-react';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  onOpenPalette?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenPalette }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { user, isAuthenticated, logout, openAuthModal } = useAuth();

  const { data: status, isError } = useQuery({
    queryKey: ['system-status'],
    queryFn: () => api.get<any>('/api/status').catch(() => null),
    refetchInterval: 10000,
  });

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
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors cursor-pointer"
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

        {/* User Auth Control */}
        {isAuthenticated && user ? (
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 p-1 rounded hover:bg-zinc-800/60 transition-colors cursor-pointer"
            >
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-7 h-7 rounded-full border border-zinc-700 object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-mono font-semibold text-zinc-200">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-xs font-medium text-zinc-300 hidden md:inline">
                {user.name}
              </span>
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-[#0b0f17] border border-[#1f2937] rounded-lg shadow-xl p-2 z-50 animate-in fade-in slide-in-from-top-1 font-sans">
                <div className="px-2 py-1.5 border-b border-[#1f2937] mb-1">
                  <p className="text-xs font-medium text-white truncate">{user.name}</p>
                  <p className="text-[10px] text-zinc-500 font-mono truncate">{user.email}</p>
                </div>
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-red-400 hover:bg-red-950/40 rounded transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => openAuthModal()}
            className="flex items-center gap-1.5 px-3 py-1 rounded border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
          >
            <LogIn className="w-3 h-3 text-cyan-400" />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
};
