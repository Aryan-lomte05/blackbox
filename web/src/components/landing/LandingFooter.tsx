import React from 'react';
import { NavLink } from 'react-router-dom';

export const LandingFooter: React.FC = () => {
  return (
    <footer className="border-t border-[#1f2937] bg-[#05070b] py-14 select-none font-sans">
      <div className="max-w-[1400px] mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-[#1f2937]">
          {/* Brand Info (4 cols) */}
          <div className="md:col-span-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] animate-pulse" />
              <span className="font-mono font-bold text-sm tracking-wider text-white">
                BLACK BOX
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-mono">
              AI AGENT FLIGHT RECORDER
            </p>
            <p className="text-xs text-zinc-500 leading-relaxed font-sans max-w-sm pt-1">
              Record every step, find the step that caused a failure, prove it by replay,
              and fix it without regressions.
            </p>
          </div>

          {/* Links (8 cols in 3 sub-columns) */}
          <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-6 text-xs font-mono">
            {/* Column 1: Core Exploration */}
            <div className="space-y-2.5">
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">FLIGHT RECORDER</p>
              <ul className="space-y-1.5 text-zinc-500">
                <li>
                  <NavLink to="/overview" className="hover:text-cyan-400 transition-colors">Overview</NavLink>
                </li>
                <li>
                  <NavLink to="/runs" className="hover:text-cyan-400 transition-colors">Recorded Runs</NavLink>
                </li>
                <li>
                  <NavLink to="/investigate" className="hover:text-cyan-400 transition-colors">Investigate Run</NavLink>
                </li>
                <li>
                  <NavLink to="/lab" className="hover:text-cyan-400 transition-colors">Live Lab</NavLink>
                </li>
              </ul>
            </div>

            {/* Column 2: Forensics & Verification */}
            <div className="space-y-2.5">
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">VERIFICATION</p>
              <ul className="space-y-1.5 text-zinc-500">
                <li>
                  <NavLink to="/causal" className="hover:text-cyan-400 transition-colors">Causal Report</NavLink>
                </li>
                <li>
                  <NavLink to="/fleet" className="hover:text-cyan-400 transition-colors">Fleet Fix</NavLink>
                </li>
                <li>
                  <NavLink to="/crash-test" className="hover:text-cyan-400 transition-colors">Crash Test</NavLink>
                </li>
                <li>
                  <NavLink to="/similar" className="hover:text-cyan-400 transition-colors">Seen Before?</NavLink>
                </li>
              </ul>
            </div>

            {/* Column 3: Safety & Telemetry */}
            <div className="space-y-2.5">
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">SYSTEM</p>
              <ul className="space-y-1.5 text-zinc-500">
                <li>
                  <NavLink to="/incidents" className="hover:text-cyan-400 transition-colors">Guardian Incidents</NavLink>
                </li>
                <li>
                  <NavLink to="/atlas" className="hover:text-cyan-400 transition-colors">Failure Atlas</NavLink>
                </li>
                <li>
                  <NavLink to="/dataset" className="hover:text-cyan-400 transition-colors">Dataset</NavLink>
                </li>
                <li>
                  <NavLink to="/api-status" className="hover:text-cyan-400 transition-colors">API & Machine</NavLink>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Metadata & Copyright */}
        <div className="pt-6 flex flex-wrap items-center justify-between text-[11px] font-mono text-zinc-600 gap-4">
          <div>
            BLACK BOX FLIGHT RECORDER © 2026 HALF A BYTE · MIT LICENSE
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-emerald-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> API READY
            </span>
            <span>SQLITE SHARDS + MONGODB</span>
            <span>v0.1.0</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
