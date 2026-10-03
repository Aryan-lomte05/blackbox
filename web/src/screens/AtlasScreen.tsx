import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';
import { Map, AlertCircle, ExternalLink, Filter, Layers, Tag, Sparkles } from 'lucide-react';
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
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-sans">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
              KNOWLEDGE ATLAS
            </span>
            <span className="text-xs text-zinc-400">Canonical Failure Topologies</span>
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-inner">
              <Map className="w-5 h-5" />
            </div>
            Failure Pattern Atlas
          </h2>
          <p className="text-sm text-zinc-400 mt-1.5 max-w-2xl leading-relaxed">
            859 labelled agent failures condensed into canonical causal archetypes by task family, step kind, and mistake vector.
          </p>
        </div>

        {/* Filter Controls (Pills) */}
        <div className="flex items-center gap-2">
          {['all', 'math', 'qa', 'shop'].map((fam) => (
            <button
              key={fam}
              onClick={() => setSelectedFamily(fam)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium capitalize transition-all cursor-pointer ${
                selectedFamily === fam
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/50'
                  : 'glass-card text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              {fam === 'all' ? 'All Families' : fam}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="p-16 text-center text-zinc-500 text-xs animate-pulse">
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
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>
              Cataloged: <strong className="text-white font-mono">{data.total_labelled || 859}</strong> failures across{' '}
              <strong className="text-white font-mono">{data.clusters || 27}</strong> archetypal patterns
            </span>
            <span className="font-mono text-[11px] text-zinc-500">Showing {filtered.length} archetypes</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((pat, idx) => {
              const examples = pat.examples ? pat.examples.split(' ') : [];
              const pct = (pat.share * 100).toFixed(1);

              return (
                <motion.div
                  key={idx}
                  whileHover={{ y: -2 }}
                  className="glass-card p-5 rounded-2xl border border-zinc-800/80 hover:border-zinc-700 transition-all space-y-3"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {pat.family}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-950/60 text-amber-300 border border-amber-500/30">
                        {pat.mistake}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-zinc-400">{pat.count} runs</span>
                      <span className="text-rose-400 font-bold">({pct}%)</span>
                    </div>
                  </div>

                  <div className="font-bold text-sm text-zinc-100 leading-snug">
                    {pat.title}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-zinc-400 pt-1">
                    <span>Kind: <strong className="text-zinc-200 font-mono text-[11px]">{pat.step_kind}</strong></span>
                    <span>Node: <strong className="text-zinc-200 font-mono text-[11px]">{pat.agent_node}</strong></span>
                  </div>

                  {/* Representative Traces */}
                  {examples.length > 0 && (
                    <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-xs">
                      <span className="text-zinc-500 text-[11px]">Representative Traces:</span>
                      <div className="flex items-center gap-2">
                        {examples.slice(0, 3).map((ex: string, i: number) => (
                          <Link
                            key={i}
                            to={`/runs/${ex}`}
                            className="text-rose-400 hover:text-rose-300 flex items-center gap-1 font-mono text-[11px] transition-colors"
                          >
                            <span>{ex.slice(0, 8)}</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
};

