import React, { useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { SimilarResponse } from '../types/api';
import { KPI } from '../components/common/KPI';
import {
  Fingerprint,
  Sparkles,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Tag,
  Search,
  CheckCircle,
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
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-mono">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
              DEMO SCREEN 7
            </span>
            <span className="text-xs text-zinc-400">Failure Fingerprints & Knowledge Base</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight mt-1 flex items-center gap-2.5">
            <Fingerprint className="w-6 h-6 text-cyan-400" />
            Seen This Before?
          </h2>
          <p className="text-sm text-zinc-400 mt-1 max-w-2xl font-sans">
            Every failure gets a causal fingerprint. 859 cataloged failures collapse into ~30 canonical failure patterns;
            brand-new bugs are flagged as <strong>NOVEL</strong>, and known approved fixes are recommended instantly.
          </p>
        </div>
      </div>

      {/* Target Run Input */}
      <div className="flex items-center gap-3 text-xs bg-zinc-900/60 p-3.5 rounded-xl border border-zinc-800/80">
        <span className="text-zinc-400 uppercase text-[10px]">Target Run ID:</span>
        <input
          type="text"
          value={targetRunId}
          onChange={(e) => setTargetRunId(e.target.value)}
          className="bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-zinc-200 w-72 focus:outline-none focus:border-cyan-500"
        />
        <button
          onClick={() => refetch()}
          className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs transition-colors cursor-pointer"
        >
          Lookup Fingerprint
        </button>
        <Link
          to={`/runs/${targetRunId}`}
          className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px] ml-auto"
        >
          View Graph <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {/* Loading & Error States */}
      {isLoading && (
        <div className="p-12 text-center text-zinc-500 text-xs animate-pulse">
          Querying failure fingerprint library (859 cataloged runs)...
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>Failed to query similar failures: {(error as any)?.detail || error.message}</span>
        </div>
      )}

      {/* Main Results View */}
      {data && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Fingerprint Hero Card */}
          <div className="p-6 rounded-xl bg-gradient-to-r from-zinc-900/90 via-zinc-900 to-cyan-950/20 border border-zinc-800 shadow-xl space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                    FAILURE FINGERPRINT IDENTIFIER
                  </span>
                  {data.novel ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-950/90 text-purple-300 border border-purple-500/60 shadow-lg shadow-purple-950/80 animate-pulse">
                      ★ NOVEL FAILURE PATTERN
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                      SEEN {data.same_fingerprint || 'MULTIPLE'} TIMES IN FLEET
                    </span>
                  )}
                </div>
                <div className="text-2xl font-extrabold text-white tracking-tight">
                  {data.fingerprint?.id || 'FP-UNKNOWN'}
                </div>
              </div>

              <div className="text-right text-xs text-zinc-400 font-mono">
                <div>Library: <span className="text-zinc-200 font-bold">{data.library_size || 859}</span> failures</div>
                <div>Match Similarity: <span className="text-cyan-400 font-bold">{((data.best_similarity ?? 1) * 100).toFixed(0)}%</span></div>
              </div>
            </div>

            {/* Fingerprint Token Chips */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">
                Causal Signature Attributes:
              </span>
              <div className="flex flex-wrap gap-2">
                {data.fingerprint?.tokens?.map((token: string, idx: number) => {
                  const isCause = token.startsWith('cause:');
                  const isSpread = token.startsWith('spread:');
                  const isSignal = token.startsWith('signal:');

                  return (
                    <span
                      key={idx}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono border transition-all ${
                        isCause
                          ? 'bg-rose-950/50 text-rose-300 border-rose-500/40 font-bold'
                          : isSpread
                          ? 'bg-amber-950/50 text-amber-300 border-amber-500/40 font-medium'
                          : isSignal
                          ? 'bg-cyan-950/50 text-cyan-300 border-cyan-500/40 font-medium'
                          : 'bg-zinc-800/80 text-zinc-300 border-zinc-700/60'
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
            <div className="p-6 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-emerald-500/20">
                <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Recommended Fleet Fix (Proven on Look-alikes)
                </div>
                <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                  Ready to Deploy
                </span>
              </div>

              {data.known_fixes.map((fix: any, idx: number) => (
                <div key={idx} className="space-y-3">
                  <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 italic">
                    "{fix.rule}"
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-4 text-zinc-400">
                      <span>Fixed: <strong className="text-emerald-400">{fix.fixed} of {fix.of}</strong> runs</span>
                      <span>Similarity: <strong className="text-white">{(fix.similarity * 100).toFixed(0)}%</strong></span>
                    </div>

                    <button
                      onClick={() => navigate(`/fleet?run_id=${targetRunId}`)}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>Test This Fix on Run</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Closest Look-alike Failures Table */}
          <div className="p-6 rounded-xl bg-zinc-900/60 border border-zinc-800/80 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                Historical Look-alike Failures ({data.closest?.length || 0})
              </span>
              <span className="text-[11px] text-zinc-500">Ranked by Jaccard Token Overlap</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="text-zinc-500 border-b border-zinc-800">
                    <th className="pb-3">RUN ID</th>
                    <th className="pb-3">FAMILY</th>
                    <th className="pb-3">FAULT KIND</th>
                    <th className="pb-3">GUILTY STEP</th>
                    <th className="pb-3">SIMILARITY</th>
                    <th className="pb-3">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {data.closest?.map((match: any, idx: number) => (
                    <tr key={idx} className="hover:bg-zinc-800/30">
                      <td className="py-3 font-bold text-zinc-200">
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
                          <div className="w-16 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-cyan-400 h-full"
                              style={{ width: `${(match.similarity ?? 1) * 100}%` }}
                            />
                          </div>
                          <span className="text-zinc-300 font-bold">
                            {((match.similarity ?? 1) * 100).toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3">
                        <Link
                          to={`/runs/${match.run_id}`}
                          className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                        >
                          Inspect <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
