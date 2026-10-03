import React from 'react';
import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Home,
  ListFilter,
  FlaskConical,
  Sliders,
  Network,
  ShieldAlert,
  Database,
  Cpu,
  Server,
  CheckCircle2,
  Boxes,
  Box,
} from 'lucide-react';

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  badgeColor?: 'red' | 'neutral';
}

const primaryNavItems: NavItem[] = [
  { name: 'Overview', path: '/', icon: Home },
  { name: 'Runs', path: '/runs', icon: ListFilter },
  { name: 'Live Lab', path: '/lab', icon: FlaskConical },
  { name: 'Experiments', path: '/fleet', icon: Sliders },
  { name: 'Atlas', path: '/atlas', icon: Network },
  { name: 'Incidents', path: '/incidents', icon: ShieldAlert, badge: 3, badgeColor: 'red' },
  { name: 'Dataset', path: '/dataset', icon: Database },
];

const systemNavItems: NavItem[] = [
  { name: 'Machine', path: '/machine', icon: Cpu },
  { name: 'API', path: '/api-status', icon: Server },
  { name: 'Checker', path: '/checker', icon: CheckCircle2 },
  { name: 'Models', path: '/models', icon: Boxes },
];

export const Sidebar: React.FC = () => {
  const { data: status } = useQuery({
    queryKey: ['system-status'],
    queryFn: () => api.get<any>('/api/status').catch(() => null),
    refetchInterval: 10000,
  });

  const isOnline = !!status;

  return (
    <aside className="w-56 bg-[#090a0c] border-r border-white/[0.06] flex flex-col h-screen fixed left-0 top-0 z-30 select-none">
      {/* Brand Header matching reference image */}
      <div className="h-14 flex items-center px-4 border-b border-white/[0.06] gap-2.5">
        <div className="w-7 h-7 rounded-md bg-[#16181d] border border-white/[0.08] flex items-center justify-center text-zinc-200 shadow-sm">
          <Box className="w-4 h-4 text-zinc-100" />
        </div>
        <div>
          <div className="font-heading font-bold text-[13px] tracking-tight text-white flex items-center gap-1.5 leading-none">
            BLACK BOX
          </div>
          <div className="text-[9px] text-zinc-400 font-mono tracking-wider uppercase mt-1 leading-none">
            AI AGENT FLIGHT RECORDER
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
        {/* Primary Navigation List */}
        <div className="space-y-0.5">
          {primaryNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all font-medium group ${
                    isActive
                      ? 'bg-[#15171c] text-white border border-white/[0.08] shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] border border-transparent'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive ? 'text-zinc-100' : 'text-zinc-500 group-hover:text-zinc-300'
                        }`}
                      />
                      <span className="truncate">{item.name}</span>
                    </div>

                    {item.badge !== undefined && (
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold shrink-0 ${
                          item.badgeColor === 'red'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* SYSTEM Section matching reference image */}
        <div className="space-y-1">
          <div className="px-3 text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold mb-1">
            SYSTEM
          </div>

          <div className="space-y-0.5">
            {systemNavItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-all group ${
                    isActive
                      ? 'bg-[#15171c] text-white border border-white/[0.08] shadow-sm font-medium'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] border border-transparent'
                  }`
                }
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isOnline ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : 'bg-zinc-600'
                    }`}
                  />
                  <span className="truncate">{item.name}</span>
                </div>
              </NavLink>
            ))}
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className="p-3 border-t border-white/[0.06] bg-[#07080a] flex items-center justify-between text-[11px] text-zinc-500 font-mono">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>v0.1.0</span>
        </span>
        <span>:8000</span>
      </div>
    </aside>
  );
};
