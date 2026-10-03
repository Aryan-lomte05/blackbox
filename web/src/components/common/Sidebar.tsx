import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Compass,
  GitGraph,
  FlaskConical,
  ShieldCheck,
  Split,
  Flame,
  Fingerprint,
  ShieldAlert,
  LayoutDashboard,
  Map,
  Database,
  Terminal,
} from 'lucide-react';

interface NavItem {
  name: string;
  path: string;
  icon: any;
  badge?: string;
}

interface NavGroup {
  category: string;
  items: NavItem[];
}

const navigationItems: NavGroup[] = [
  {
    category: 'DEMO PATH (PRIORITY)',
    items: [
      { name: 'Investigate', path: '/investigate', icon: Compass, badge: 'Demo 1' },
      { name: 'Run Graph', path: '/runs/37452fc329e1498f', icon: GitGraph, badge: 'Demo 2' },
      { name: 'Live Lab', path: '/lab', icon: FlaskConical, badge: 'Demo 3' },
      { name: 'Fleet Firewall', path: '/fleet', icon: ShieldCheck, badge: 'Demo 4' },
      { name: 'Causal Report', path: '/causal', icon: Split, badge: 'Demo 5' },
      { name: 'Crash Test', path: '/crash-test', icon: Flame, badge: 'Demo 6' },
      { name: 'Seen This Before?', path: '/similar', icon: Fingerprint, badge: 'Demo 7' },
      { name: 'Guardian Incidents', path: '/incidents', icon: ShieldAlert, badge: 'Demo 8' },
    ],
  },
  {
    category: 'OBSERVABILITY & DATA',
    items: [
      { name: 'Overview', path: '/', icon: LayoutDashboard },
      { name: 'Failure Atlas', path: '/atlas', icon: Map },
      { name: 'Dataset & Health', path: '/dataset', icon: Database },
    ],
  },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-zinc-950 border-r border-zinc-800/80 flex flex-col h-screen fixed left-0 top-0 z-30 select-none">
      {/* Brand header */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center shadow-lg shadow-rose-950/50">
          <Terminal className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
            BLACK BOX
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
              v0.1
            </span>
          </div>
          <div className="text-[11px] text-zinc-400 font-mono">Flight Recorder</div>
        </div>
      </div>

      {/* Nav list */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {navigationItems.map((group, idx) => (
          <div key={idx} className="space-y-1">
            <div className="px-3 text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold mb-2">
              {group.category}
            </div>
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all group ${
                      isActive
                        ? 'bg-rose-950/40 text-rose-200 border border-rose-500/30 shadow-sm shadow-rose-950/40 font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                    }`
                  }
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 transition-transform group-hover:scale-105" />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800 group-hover:border-zinc-700">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer status */}
      <div className="p-3 border-t border-zinc-800/80 bg-zinc-900/30 text-xs">
        <div className="flex items-center justify-between px-2 py-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-mono text-[11px] text-zinc-400">API :8000</span>
          </div>
          <span className="font-mono text-[10px] text-emerald-400 font-semibold">LIVE</span>
        </div>
      </div>
    </aside>
  );
};
