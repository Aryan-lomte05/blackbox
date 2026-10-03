import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Map, AlertCircle, ExternalLink, Filter, Layers, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';

export const AtlasScreen: React.FC = () => {
  const [selectedFamily, setSelectedFamily] = useState<string>('all');

  const { data, isLoading, error } = useQuery<any>({
    queryKey: ['failure-atlas'],
    queryFn: async () => {
      return await api.get<any>('/api/atlas');
    },
  });

  const patterns: any[] = data?.patterns || [];
  const filtered = selectedFamily === 'all'
    ? patterns
    : patterns.filter((p) => p.family?.toLowerCase() === selectedFamily.toLowerCase());

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-mono">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
              KNOWLEDGE ATLAS
            </span>
            <span className="text-xs text-zinc-400">Canonical Failure Topologies</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight mt-1 flex items-center gap-2.5">
            <Map className="w-6 h-6 text-rose-500" />
            Failure Pattern Atlas
          </h2>
          <p className="text-sm text-zinc-400 mt-1 max-w-2xl font-sans">
            859 labelled agent failures condensed into canonical causal archetypes by task family, step kind, and mistake vector.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400">Filter Family:</span>
          <select
            value={selectedFamily}
            onChange={(e) => setSelectedFamily(e.target.value)}
            className="bg-zinc-900 border border-zinc-700/80 rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-rose-500"
          >
            <option value="all">All Families</option>
            <option value="math">Math</option>
            <option value="qa">QA</option>
            <option value="shop">Shop</option>
          </select>
        </div>
      </div>

      {isLoading && (
        <div className="p-12 text-center text-zinc-500 text-xs">
          Loading failure atlas clusters...
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>Failed to load failure atlas: {(error as any)?.detail || error.message}</span>
        </div>
      )}

      {data && (
        <div className="space-y-6">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>
              Cataloged: <strong className="text-white">{data.total_labelled || 859}</strong> failures across{' '}
              <strong className="text-white">{data.clusters || 27}</strong> patterns
            </span>
            <span>Showing {filtered.length} archetypes</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((pat, idx) => {
              const examples = pat.examples ? pat.examples.split(' ') : [];
              const pct = (pat.share * 100).toFixed(1);

              return (
                <div
                  key={idx}
                  className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 transition-all space-y-3"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {pat.family}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/60 text-amber-300 border border-amber-500/30">
                        {pat.mistake}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-zinc-400">{pat.count} runs</span>
                      <span className="text-rose-400 font-bold">({pct}%)</span>
                    </div>
                  </div>

                  <div className="font-bold text-sm text-zinc-100 font-sans">
                    {pat.title}
                  </div>

                  <div className="flex items-center gap-4 text-[11px] text-zinc-400 pt-1">
                    <span>Kind: <strong className="text-zinc-200">{pat.step_kind}</strong></span>
                    <span>Node: <strong className="text-zinc-200">{pat.agent_node}</strong></span>
                  </div>

                  {/* Example Run Links */}
                  {examples.length > 0 && (
                    <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px]">
                      <span className="text-zinc-500">Representative Traces:</span>
                      <div className="flex items-center gap-2">
                        {examples.slice(0, 3).map((ex: string, i: number) => (
                          <Link
                            key={i}
                            to={`/runs/${ex}`}
                            className="text-rose-400 hover:text-rose-300 flex items-center gap-0.5"
                          >
                            <span>{ex.slice(0, 8)}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
