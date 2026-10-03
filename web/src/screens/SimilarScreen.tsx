import React, { useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';
import { SimilarResponse } from '../types/api';
import {
  Fingerprint,
  Sparkles,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Tag,
  Search,
  CheckCircle,
  Layers,
  ArrowRight,
} from 'lucide-react';

export const SimilarScreen: React.FC = () => {
  const [searchParams] = useSearchParams();
  const runIdFromUrl = searchParams.get('run_id') || '37452fc329e1498f';
  const navigate = useNavigate();

  const [targetRunId, setTargetRunId] = useState(runIdFromUrl);

  const { data, isLoading, error, refetch } = useQuery<any>({
    queryKey: ['similar-failures', targetRunId],
    queryFn: async () => {
      return await api.get<any>(`/api/runs/${targetRunId}/similar?k=5`);
    },
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-sans">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              DEMO 7 • KNOWLEDGE BASE
            </span>
            <span className="text-xs text-zinc-400">Failure Fingerprints & Look-alikes</span>
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
              <Fingerprint className="w-5 h-5" />
            </div>
            Seen This Before?
          </h2>
          <p className="text-sm text-zinc-400 mt-1.5 max-w-2xl leading-relaxed">
            Every failure gets a causal fingerprint. Cataloged fleet failures collapse into canonical failure patterns; brand-new bugs are flagged as <strong>NOVEL</strong>, and known approved fixes are recommended instantly.
          </p>
        </div>
      </div>

      {/* Target Run Input */}
      <div className="glass-card flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-zinc-800/80">
        <div className="flex items-center gap-3 text-xs">
          <span className="text-zinc-400 font-medium">Target Failure Run:</span>
          <input
            type="text"
            value={targetRunId}
            onChange={(e) => setTargetRunId(e.target.value)}
            className="bg-zinc-950/80 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-200 w-64 focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={() => refetch()}
            className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
          >
            Lookup Fingerprint
          </button>
        </div>
        <Link
          to={`/runs/${targetRunId}`}
          className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 text-xs font-medium transition-colors"
        >
          <span>View Failure Graph</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Loading & Error States */}
      {isLoading && (
        <div className="p-16 text-center text-zinc-500 text-xs animate-pulse">
          Querying failure fingerprint catalog index...
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>Failed to query similar failures: {(error as any)?.detail || error.message}</span>
        </div>
      )}

      {/* Main Results View */}
      <AnimatePresence>
        {data && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Fingerprint Hero Card */}
            <div className="p-6 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-900 to-cyan-950/30 border border-zinc-800 shadow-2xl space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                      CAUSAL FINGERPRINT SIGNATURE
                    </span>
                    {data.novel ? (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-950/90 text-purple-300 border border-purple-500/60 shadow-lg shadow-purple-950/80 animate-pulse font-mono">
                        ★ NOVEL BUG PATTERN
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 font-mono">
                        SEEN {data.same_fingerprint || 'MULTIPLE'} TIMES IN FLEET
                      </span>
                    )}
                  </div>
                  <div className="text-3xl font-extrabold text-white font-mono tracking-tight">
                    {data.fingerprint?.id || 'FP-UNKNOWN'}
                  </div>
                </div>

                <div className="text-right text-xs text-zinc-400 font-mono space-y-1">
                  <div>Catalog Size: <strong className="text-zinc-100">{data.library_size ?? (data.look_alikes ? data.look_alikes.length : '—')} runs</strong></div>
                  <div>Best Match Similarity: <strong className="text-cyan-400 font-bold">{((data.best_similarity ?? 1) * 100).toFixed(0)}%</strong></div>
                </div>
              </div>

              {/* Fingerprint Token Chips */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">
                  Invariant Token Signature:
                </span>
                <div className="flex flex-wrap gap-2">
                  {data.fingerprint?.tokens?.map((token: string, idx: number) => {
                    const isCause = token.startsWith('cause:');
                    const isSpread = token.startsWith('spread:');
                    const isSignal = token.startsWith('signal:');

                    return (
                      <span
                        key={idx}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono border transition-all ${
                          isCause
                            ? 'bg-rose-950/60 text-rose-300 border-rose-500/40 font-bold'
                            : isSpread
                            ? 'bg-amber-950/60 text-amber-300 border-amber-500/40 font-medium'
                            : isSignal
                            ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40 font-medium'
                            : 'bg-zinc-900 text-zinc-300 border-zinc-800'
                        }`}
                      >
                        <Tag className="w-3 h-3 opacity-60" />
                        <span>{token}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Known Approved Fixes (if any) */}
            {data.known_fixes && data.known_fixes.length > 0 && (
              <div className="glass-card p-6 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/20 via-zinc-900 to-zinc-900 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-emerald-500/20">
                  <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-wider">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Recommended Fleet Fix (Proven on Historical Look-alikes)</span>
                  </div>
                  <span className="text-[10px] text-emerald-300 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-500/40 font-mono font-semibold">
                    READY TO DEPLOY
                  </span>
                </div>

                {data.known_fixes.map((fix: any, idx: number) => (
                  <div key={idx} className="space-y-3">
                    <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs text-zinc-200 italic leading-relaxed font-mono">
                      "{fix.rule}"
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-4 text-zinc-400">
                        <span>Fixed: <strong className="text-emerald-400 font-mono">{fix.fixed} of {fix.of}</strong> runs</span>
                        <span>Similarity: <strong className="text-white font-mono">{(fix.similarity * 100).toFixed(0)}%</strong></span>
                      </div>

                      <button
                        onClick={() => navigate(`/fleet?run_id=${targetRunId}`)}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs flex items-center gap-2 transition-all shadow-md shadow-emerald-950/50 cursor-pointer"
                      >
                        <span>Test This Fix on Fleet Firewall</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Closest Look-alike Failures Table */}
            <div className="glass-card p-6 rounded-2xl border border-zinc-800/80 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                  Historical Look-alike Incidents ({data.closest?.length || 0})
                </span>
                <span className="text-[11px] font-mono text-zinc-500">Ranked by Jaccard Token Overlap</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="text-zinc-500 border-b border-zinc-800/80 text-[11px]">
                      <th className="pb-3 pl-2">RUN ID</th>
                      <th className="pb-3">FAMILY</th>
                      <th className="pb-3">FAULT KIND</th>
                      <th className="pb-3">GUILTY STEP</th>
                      <th className="pb-3">SIMILARITY</th>
                      <th className="pb-3">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40">
                    {data.closest?.map((match: any, idx: number) => (
                      <tr key={idx} className="hover:bg-zinc-800/20 transition-colors">
                        <td className="py-3 pl-2 font-bold text-zinc-200">
                          {match.run_id?.slice(0, 12)}
                        </td>
                        <td className="py-3 uppercase text-zinc-400">{match.family || 'math'}</td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/60 text-amber-300 border border-amber-500/30">
                            {match.fault || 'F3'}
                          </span>
                        </td>
                        <td className="py-3 text-rose-400 font-bold">Step #{match.cause}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-zinc-950 rounded-full h-2 overflow-hidden border border-zinc-800">
                              <div
                                className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full"
                                style={{ width: `${(match.similarity ?? 1) * 100}%` }}
                              />
                            </div>
                            <span className="text-zinc-200 font-bold text-[11px]">
                              {((match.similarity ?? 1) * 100).toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3">
                          <Link
                            to={`/runs/${match.run_id}`}
                            className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium transition-colors"
                          >
                            <span>Inspect</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

