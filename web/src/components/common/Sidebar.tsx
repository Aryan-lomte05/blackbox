import React from 'react';
import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Home,
  ListFilter,
  Compass,
  FlaskConical,
  Sliders,
  Flame,
  Fingerprint,
  ShieldAlert,
  Network,
  Database,
  Cpu,
  Server,
  CheckCircle2,
  Boxes,
} from 'lucide-react';

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  badgeColor?: 'red' | 'neutral';
}

export const Sidebar: React.FC = () => {
  const { data: status } = useQuery({
    queryKey: ['system-status'],
    queryFn: () => api.get<any>('/api/status').catch(() => null),
    refetchInterval: 10000,
  });

  const { data: overview } = useQuery<any>({
    queryKey: ['overview-data'],
    queryFn: () => api.get<any>('/api/ui/overview').catch(() => null),
    refetchInterval: 10000,
  });

  const openIncidents = overview?.kpis?.open_incidents ?? 0;

  const investigateNav: NavItem[] = [
    { name: 'Overview', path: '/', icon: Home },
    { name: 'Runs', path: '/runs', icon: ListFilter },
    { name: 'Investigate', path: '/investigate', icon: Compass },
    { name: 'Live Lab', path: '/lab', icon: FlaskConical },
  ];

  const proveNav: NavItem[] = [
    { name: 'Causal report', path: '/causal', icon: Sliders },
    { name: 'Fleet fix', path: '/fleet', icon: Sliders },
    { name: 'Crash test', path: '/crash-test', icon: Flame },
    { name: 'Seen before?', path: '/similar', icon: Fingerprint },
  ];

  const operateNav: NavItem[] = [
    {
      name: 'Incidents',
      path: '/incidents',
      icon: ShieldAlert,
      badge: openIncidents > 0 ? openIncidents : undefined,
      badgeColor: 'red',
    },
    { name: 'Atlas', path: '/atlas', icon: Network },
    { name: 'Dataset', path: '/dataset', icon: Database },
  ];

  const systemNav: NavItem[] = [
    { name: 'Machine', path: '/machine', icon: Cpu },
    { name: 'API', path: '/api-status', icon: Server },
    { name: 'Checker', path: '/checker', icon: CheckCircle2 },
    { name: 'Models', path: '/models', icon: Boxes },
  ];

  // Extract GPU & data totals for sidebar bottom readout
  const machineLines: string[] = status?.machine || [];
  const gpuLine = machineLines.find((l) => l.toLowerCase().includes('gpu')) || '';
  const counts = status?.counts || overview?.kpis || {};
  const totalRuns = counts.runs ? Number(counts.runs).toLocaleString() : '—';
  const totalMb = counts.blob_mb ? `${counts.blob_mb}MB` : '—';
  const queueLen = status?.queue?.length ?? 0;

  return (
    <aside className="w-[232px] bg-[#05070b] border-r border-[#1f2937] flex flex-col h-screen fixed left-0 top-0 z-30 select-none font-sans">
      {/* Brand Header with ● REC wordmark */}
      <div className="h-14 flex items-center px-4 border-b border-[#1f2937] justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] animate-pulse shadow-xs shadow-[#ef4444]" />
          <span className="font-mono font-bold text-xs tracking-wider text-white">
            BLACK BOX
          </span>
        </div>
        <span className="text-[10px] font-mono text-[#6b7280] tracking-widest uppercase">
          REC
        </span>
      </div>

      {/* Main Navigation Groups */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {/* GROUP 1: INVESTIGATE */}
        <div className="space-y-0.5">
          <div className="px-2 text-[10px] font-mono uppercase tracking-wider text-[#6b7280] font-semibold mb-1">
            INVESTIGATE
          </div>
          {investigateNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors group ${
                    isActive
                      ? 'bg-[#111827] text-white border border-[#1f2937] font-medium'
                      : 'text-[#9ca3af] hover:text-white hover:bg-[#0b0f17] border border-transparent'
                  }`
                }
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="w-3.5 h-3.5 shrink-0 text-[#6b7280] group-hover:text-[#9ca3af]" />
                  <span className="truncate">{item.name}</span>
                </div>
              </NavLink>
            );
          })}
        </div>

        {/* GROUP 2: PROVE */}
        <div className="space-y-0.5">
          <div className="px-2 text-[10px] font-mono uppercase tracking-wider text-[#6b7280] font-semibold mb-1">
            PROVE
          </div>
          {proveNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors group ${
                    isActive
                      ? 'bg-[#111827] text-white border border-[#1f2937] font-medium'
                      : 'text-[#9ca3af] hover:text-white hover:bg-[#0b0f17] border border-transparent'
                  }`
                }
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="w-3.5 h-3.5 shrink-0 text-[#6b7280] group-hover:text-[#9ca3af]" />
                  <span className="truncate">{item.name}</span>
                </div>
              </NavLink>
            );
          })}
        </div>

        {/* GROUP 3: OPERATE */}
        <div className="space-y-0.5">
          <div className="px-2 text-[10px] font-mono uppercase tracking-wider text-[#6b7280] font-semibold mb-1">
            OPERATE
          </div>
          {operateNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors group ${
                    isActive
                      ? 'bg-[#111827] text-white border border-[#1f2937] font-medium'
                      : 'text-[#9ca3af] hover:text-white hover:bg-[#0b0f17] border border-transparent'
                  }`
                }
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="w-3.5 h-3.5 shrink-0 text-[#6b7280] group-hover:text-[#9ca3af]" />
                  <span className="truncate">{item.name}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/30">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* GROUP 4: SYSTEM */}
        <div className="space-y-0.5">
          <div className="px-2 text-[10px] font-mono uppercase tracking-wider text-[#6b7280] font-semibold mb-1">
            SYSTEM
          </div>
          {systemNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors group ${
                    isActive
                      ? 'bg-[#111827] text-white border border-[#1f2937] font-medium'
                      : 'text-[#9ca3af] hover:text-white hover:bg-[#0b0f17] border border-transparent'
                  }`
                }
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="w-3.5 h-3.5 shrink-0 text-[#6b7280] group-hover:text-[#9ca3af]" />
                  <span className="truncate">{item.name}</span>
                </div>
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Sidebar Bottom: Real Machine & Queue Telemetry in mono 11px */}
      <div className="p-3 border-t border-[#1f2937] bg-[#05070b] font-mono text-[11px] text-[#6b7280] space-y-1">
        <div className="flex justify-between items-center text-[#9ca3af]">
          <span>QUEUE</span>
          <span className="text-[#38bdf8]">{queueLen} jobs</span>
        </div>
        <div className="flex justify-between items-center">
          <span>STORE</span>
          <span>{totalRuns} runs ({totalMb})</span>
        </div>
        <div className="truncate text-[10px] text-[#4b5563]" title={gpuLine}>
          {gpuLine.split(':')[0] || 'GPU Active'}
        </div>
      </div>
    </aside>
  );
};
