import React from 'react';
import { ArrowUpRight, Github } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const AerospaceFooter: React.FC = () => {
  const navigate = useNavigate();

  return (
    <footer className="relative z-30 border-t border-white/[0.08] bg-[#020305] py-20 px-6 sm:px-12 md:px-20 font-sans text-xs">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
        {/* Brand & Mission */}
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.9)]" />
            <span className="font-mono font-bold tracking-widest text-sm text-white uppercase">
              BLACK BOX
            </span>
          </div>
          <p className="text-zinc-400 leading-relaxed font-light">
            The deterministic flight recorder for autonomous agent swarms.
            Record immutable execution traces, mathematically isolate causal anomalies,
            and verify fixes with counterfactual replay.
          </p>
          <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Recorder Runtime: Operational (v2.4.0)</span>
          </div>
        </div>

        {/* Technical Specs */}
        <div className="space-y-3 font-mono">
          <h4 className="text-zinc-300 font-bold tracking-wider text-[11px] uppercase">
            Specification
          </h4>
          <ul className="space-y-2 text-zinc-500 text-[11px]">
            <li className="flex items-center justify-between border-b border-white/[0.06] pb-1.5">
              <span>Ingestion Protocol</span>
              <span className="text-zinc-300">OpenTelemetry / JSON-RPC</span>
            </li>
            <li className="flex items-center justify-between border-b border-white/[0.06] pb-1.5">
              <span>Recording Delay</span>
              <span className="text-amber-400">&lt; 0.2ms / step</span>
            </li>
            <li className="flex items-center justify-between border-b border-white/[0.06] pb-1.5">
              <span>Cryptographic Hash</span>
              <span className="text-zinc-300">SHA-256 Merkle DAG</span>
            </li>
            <li className="flex items-center justify-between border-b border-white/[0.06] pb-1.5">
              <span>Causal Attribution</span>
              <span className="text-emerald-400">GNN & Shapley</span>
            </li>
          </ul>
        </div>

        {/* System Navigation Modules */}
        <div className="space-y-3 font-mono">
          <h4 className="text-zinc-300 font-bold tracking-wider text-[11px] uppercase">
            System Modules
          </h4>
          <ul className="space-y-2 text-zinc-400 text-[11px]">
            <li>
              <button
                onClick={() => navigate('/overview')}
                className="hover:text-cyan-400 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>Forensic Overview</span>
                <ArrowUpRight className="w-3 h-3 text-zinc-600" />
              </button>
            </li>
            <li>
              <button
                onClick={() => navigate('/runs')}
                className="hover:text-cyan-400 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>Execution DAG Runs</span>
                <ArrowUpRight className="w-3 h-3 text-zinc-600" />
              </button>
            </li>
            <li>
              <button
                onClick={() => navigate('/causal')}
                className="hover:text-cyan-400 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>Causal Root Analyzer</span>
                <ArrowUpRight className="w-3 h-3 text-zinc-600" />
              </button>
            </li>
            <li>
              <button
                onClick={() => navigate('/atlas')}
                className="hover:text-cyan-400 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>Fleet Failure Atlas</span>
                <ArrowUpRight className="w-3 h-3 text-zinc-600" />
              </button>
            </li>
            <li>
              <button
                onClick={() => navigate('/lab')}
                className="hover:text-cyan-400 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>Live Interactive Lab</span>
                <ArrowUpRight className="w-3 h-3 text-zinc-600" />
              </button>
            </li>
          </ul>
        </div>

        {/* Integration Command */}
        <div className="space-y-3 font-mono">
          <h4 className="text-zinc-300 font-bold tracking-wider text-[11px] uppercase">
            Integration
          </h4>
          <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-[11px] space-y-2">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-zinc-500">pip install</span>
              <span className="text-amber-300">halfabyte-blackbox</span>
            </div>
            <p className="text-[10px] text-zinc-400 font-sans leading-relaxed">
              Connect your LangGraph, CrewAI, AutoGen, or custom Python agent pipeline via OpenTelemetry or SDK.
            </p>
          </div>
          <div className="pt-2 flex items-center gap-3">
            <a
              href="https://github.com/Aryan-lomte05/Half_a_Byte_maharashtra_round"
              target="_blank"
              rel="noreferrer"
              className="text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <Github className="w-4 h-4" />
              <span>GitHub Repository</span>
            </a>
          </div>
        </div>
      </div>

      {/* Baseline Copyright & Compliance */}
      <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-zinc-500 gap-4">
        <p>© 2026 Black Box Flight Recorder Systems • Team Half a Byte</p>
        <div className="flex items-center gap-6 text-zinc-500">
          <span>RFC-9122 Compliant</span>
          <span>•</span>
          <span>Deterministic Merkle DAG</span>
          <span>•</span>
          <span className="text-amber-400">v2.4.0</span>
        </div>
      </div>
    </footer>
  );
};
