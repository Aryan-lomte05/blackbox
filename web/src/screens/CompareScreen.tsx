import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useDemoRuns } from '../lib/demoRuns';
import { GitCompare, ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react';

export const CompareScreen: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const demo = useDemoRuns();
  // no runs in the URL: the API's showcase pair (an original run vs its copy with a planted mistake)
  const runA = searchParams.get('a') || demo.compare?.a || '';
  const runB = searchParams.get('b') || demo.compare?.b || '';

  const { data, isLoading } = useQuery<any>({
    queryKey: ['compare-runs', runA, runB],
    queryFn: async () => {
      return await api.get<any>(`/api/compare?a=${runA}&b=${runB}`);
    },
    enabled: !!runA && !!runB,
  });

  const pairs: any[] = data?.pairs || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              CAUSAL DIFF
            </span>
            <span className="text-xs text-zinc-500 font-mono">Step-by-Step State Divergence</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight font-heading flex items-center gap-2.5">
            <GitCompare className="w-5 h-5 text-zinc-300" />
            <span>Compare Runs</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Align two runs step by step to identify the exact save-point where outputs diverge.
          </p>
        </div>

        {/* Selected runs header */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="px-3 py-1.5 rounded-lg bg-[#0c0d10] border border-white/[0.06] text-zinc-300">
            <span className="text-zinc-500 mr-2">RUN A (BASELINE):</span>
            <span className="text-emerald-400 font-bold">#{runA.slice(0, 8)}</span>
          </div>
          <span className="text-zinc-600 font-sans">vs</span>
          <div className="px-3 py-1.5 rounded-lg bg-[#0c0d10] border border-white/[0.06] text-zinc-300">
            <span className="text-zinc-500 mr-2">RUN B (EXPERIMENT):</span>
            <span className="text-rose-400 font-bold">#{runB.slice(0, 8)}</span>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="p-12 text-center text-zinc-500 text-xs">
          Computing step alignment and state diff...
        </div>
      )}

      {/* Diff Table */}
      <div className="rounded-xl border border-white/[0.06] bg-[#0c0d10] overflow-hidden shadow-2xl">
        <div className="p-3 border-b border-white/[0.06] bg-[#090a0c] flex items-center justify-between text-xs text-zinc-400 font-mono">
          <span>ALIGNED STEP TIMELINE</span>
          <span>{pairs.filter((p) => p.status === 'changed').length} Divergent Steps Detected</span>
        </div>

        <div className="divide-y divide-white/[0.03]">
          {pairs.map((p, idx) => {
            const isChanged = p.status === 'changed';
            return (
              <div key={idx} className={`p-4 transition-colors ${isChanged ? 'bg-amber-950/10' : 'hover:bg-white/[0.02]'}`}>
                <div className="flex items-center justify-between text-xs font-mono mb-2">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded bg-[#15171c] border border-white/[0.06] flex items-center justify-center font-bold text-zinc-300 text-[11px]">
                      {p.a !== undefined ? p.a : p.b}
                    </span>
                    <span className="text-zinc-400">Step {p.a}</span>
                    {isChanged ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        OUTPUT DIVERGED
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-400">
                        IDENTICAL
                      </span>
                    )}
                  </div>
                </div>

                {isChanged && p.state_diff && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pt-3 border-t border-white/[0.04] text-xs font-mono">
                    <div className="p-3 rounded-lg bg-[#08090a] border border-emerald-500/20 text-emerald-300">
                      <div className="text-[10px] uppercase text-emerald-400 font-bold mb-1">Baseline Output (Run A)</div>
                      <pre className="text-[11px] whitespace-pre-wrap overflow-x-auto">
                        {JSON.stringify(p.state_diff.expr?.a || p.state_diff.results?.a || p.state_diff, null, 2)}
                      </pre>
                    </div>

                    <div className="p-3 rounded-lg bg-[#08090a] border border-rose-500/20 text-rose-300">
                      <div className="text-[10px] uppercase text-rose-400 font-bold mb-1">Experiment Output (Run B)</div>
                      <pre className="text-[11px] whitespace-pre-wrap overflow-x-auto">
                        {JSON.stringify(p.state_diff.expr?.b || p.state_diff.results?.b || p.state_diff, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
