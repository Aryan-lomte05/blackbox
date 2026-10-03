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
  Radio,
  ChevronRight,
} from 'lucide-react';

interface NavItem {
  name: string;
  path: string;
  icon: any;
  badge?: string;
  hint: string;
}

interface NavGroup {
  category: string;
  items: NavItem[];
}

const navigationItems: NavGroup[] = [
  {
    category: 'DEMO NARRATIVE',
    items: [
      { name: '1. Investigate', path: '/investigate', icon: Compass, badge: '1-Click', hint: 'Prove the root cause' },
      { name: '2. Run Graph', path: '/runs/37452fc329e1498f', icon: GitGraph, hint: 'Causal step graph' },
      { name: '3. Live Lab', path: '/lab', icon: FlaskConical, badge: 'Live SSE', hint: '14-stage stream' },
      { name: '4. Fleet Firewall', path: '/fleet', icon: ShieldCheck, hint: 'Test rule on history' },
      { name: '5. Causal Report', path: '/causal', icon: Split, hint: 'Pearl causality & blast' },
      { name: '6. Crash Test', path: '/crash-test', icon: Flame, badge: 'Red Team', hint: '1-5 star safety rating' },
      { name: '7. Look-alikes', path: '/similar', icon: Fingerprint, hint: 'Fingerprint catalog' },
      { name: '8. Guardian', path: '/incidents', icon: ShieldAlert, badge: 'Oversight', hint: 'Money protection' },
    ],
  },
  {
    category: 'DATA & TELEMETRY',
    items: [
      { name: 'Mission Overview', path: '/', icon: LayoutDashboard, hint: 'Fleet telemetry' },
      { name: 'Failure Atlas', path: '/atlas', icon: Map, hint: '27 archetypes' },
      { name: 'Dataset Health', path: '/dataset', icon: Database, hint: '5,675 recorded runs' },
    ],
  },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-[#0a0b0d]/90 backdrop-blur-2xl border-r border-white/[0.06] flex flex-col h-screen fixed left-0 top-0 z-30 select-none">
      {/* Brand header */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-600 via-rose-500 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-600/30">
            <Radio className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-heading font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5">
              BLACK BOX
            </div>
            <div className="text-[11px] text-zinc-400 font-sans tracking-normal">AI Flight Recorder</div>
          </div>
        </div>
      </div>

      {/* Nav groups */}
      <div className="flex-1 overflow-y-auto py-5 px-3 space-y-6">
        {navigationItems.map((group, idx) => (
          <div key={idx} className="space-y-1">
            <div className="px-3 text-[10px] font-mono uppercase tracking-widest text-zinc-400 font-semibold mb-2">
              {group.category}
            </div>
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all group relative ${
                      isActive
                        ? 'bg-rose-500/10 text-white border border-rose-500/30 shadow-sm font-semibold'
                        : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-rose-400' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
                        <div className="truncate">
                          <div className="truncate">{item.name}</div>
                          <div className="text-[10px] text-zinc-400 font-normal truncate">{item.hint}</div>
                        </div>
                      </div>
                      {item.badge && (
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-md border shrink-0 ${
                          isActive
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : 'bg-white/[0.04] text-zinc-400 border-white/[0.06] group-hover:border-white/10'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer system status */}
      <div className="p-3 border-t border-white/[0.06] bg-black/40">
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs text-zinc-300 font-medium">Backend Ready</span>
          </div>
          <span className="text-[10px] font-mono text-zinc-400">:8000</span>
        </div>
      </div>
    </aside>
  );
};
