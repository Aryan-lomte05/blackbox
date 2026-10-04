import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { MonoLabel } from '../components/common/MonoLabel';
import { StepChip } from '../components/common/StepChip';
import { KPI } from '../components/common/KPI';
import { EmptyState } from '../components/common/EmptyState';
import { Fingerprint, ArrowRight, ShieldCheck, Search, Sparkles } from 'lucide-react';

export const SimilarScreen: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialRunId = searchParams.get('run') || searchParams.get('run_id') || '37452fc329e1498f';

  const [runId, setRunId] = useState(initialRunId);

  const { data, isLoading, error, refetch } = useQuery<any>({
    queryKey: ['similar-failures', runId],
    queryFn: async () => {
      return await api.get<any>(`/api/runs/${runId.trim()}/similar?k=5`);
    },
    enabled: !!runId.trim(),
  });

  const fingerprint = data?.fingerprint;
  const isNovel = data?.novel === true;
  const sameCount = data?.same_fingerprint !== undefined ? data.same_fingerprint : (isLoading ? '—' : 0);
  const libSize = data?.library_size !== undefined ? data.library_size : (isLoading ? '—' : 0);
  const causesMap = data?.same_fingerprint_causes || {};
  const primaryFault = Object.keys(causesMap)[0] || '—';

  return (
    <div className="space-y-8 pb-24">
      {/* Top Header */}
      <div className="border-b border-[var(--line)] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <MonoLabel index="07" label="CAUSAL FINGERPRINT & SIMILAR FAILURES" />
            {isNovel && (
              <span className="px-2 py-0.5 rounded-[var(--radius-sm)] text-[10px] font-mono font-bold uppercase bg-[var(--guilty-bg)] text-[var(--guilty)] border border-[var(--guilty)]/30">
                NOVEL BUG
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold font-sans text-[var(--text-strong)] tracking-tight">
            Seen Before? (Failure Fingerprints)
          </h1>
          <p className="text-xs font-sans text-[var(--muted)] mt-1 max-w-2xl leading-relaxed">
            Every failure receives a causal fingerprint. Historical fleet failures cluster into recognized failure archetypes, novel errors are flagged immediately, and known fixes are retrieved.
          </p>
        </div>

        {/* Run Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-[var(--faint)]">RUN:</span>
          <input
            type="text"
            value={runId}
            onChange={(e) => setRunId(e.target.value)}
            placeholder="run id..."
            className="px-2.5 py-1.5 bg-[var(--raised)] border border-[var(--line)] rounded-[var(--radius-sm)] text-xs font-mono text-[var(--text)] w-44 focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
      </div>

      {/* Loading & Error States */}
      {isLoading && (
        <div className="panel p-12 text-center text-xs font-mono text-[var(--faint)]">
          Searching failure fingerprint catalog across fleet runs...
        </div>
      )}

      {error && (
        <div className="p-4 rounded-[var(--radius)] border border-[var(--guilty)]/40 bg-[var(--guilty-bg)] text-[var(--guilty)] text-xs font-mono">
          Failed to load similar failures: {(error as any)?.detail || (error as Error).message}
        </div>
      )}

      {/* Main Content when loaded */}
      {data && !isLoading && (
        <div className="space-y-6">
          {/* Fingerprint ID & Tokens Banner */}
          <div className="panel p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Fingerprint className="w-5 h-5 text-[var(--accent)]" />
                <span className="font-mono text-base font-bold text-[var(--text-strong)]">
                  {fingerprint?.id || 'FP-34b120'}
                </span>
                {isNovel ? (
                  <span className="px-2 py-0.5 rounded-[var(--radius-sm)] text-[10px] font-mono font-bold uppercase bg-[var(--guilty-bg)] text-[var(--guilty)] border border-[var(--guilty)]/30">
                    NOVEL
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-[var(--radius-sm)] text-[10px] font-mono font-bold uppercase bg-[var(--ok-bg)] text-[var(--ok)] border border-[var(--ok)]/30">
                    KNOWN PATTERN
                  </span>
                )}
              </div>

              {/* Share count summary */}
              <div className="font-mono text-xs text-[var(--muted)]">
                <span className="font-bold text-[var(--text-strong)]">{sameCount}</span> of{' '}
                <span className="tabular-nums">{libSize}</span> failures share this fingerprint (all{' '}
                <span className="text-[var(--accent)] font-semibold">{primaryFault}</span>)
              </div>
            </div>

            {/* Fingerprint Tokens Chips */}
            <div className="space-y-1.5 pt-2 border-t border-[var(--line)]">
              <div className="text-[10px] font-mono text-[var(--faint)] uppercase tracking-wider">
                Fingerprint Tokens:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(fingerprint?.tokens || []).map((token: string, idx: number) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--raised)] border border-[var(--line)] text-[var(--text)] font-mono text-[11px]"
                  >
                    {token}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Known Fixes (if available) */}
          {(data.known_fixes || []).length > 0 && (
            <div className="space-y-3">
              <MonoLabel index="FIXES" label="KNOWN HISTORICAL FIXES & FIREWALL RULES" />

              <div className="space-y-3">
                {data.known_fixes.map((kf: any, idx: number) => (
                  <div key={idx} className="panel p-4 space-y-2 border-l-2 border-l-[var(--ok)]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--ok-bg)] text-[var(--ok)] border border-[var(--ok)]/30 font-mono text-[10px] font-bold uppercase">
                          FIXED {kf.fixed}/{kf.of}
                        </span>
                        <span className="font-mono text-[11px] text-[var(--muted)]">
                          Similarity: {Math.round((kf.similarity ?? 1) * 100)}%
                        </span>
                      </div>

                      <Link
                        to={`/fleet?run=${runId}`}
                        className="inline-flex items-center gap-1 text-xs font-sans text-[var(--accent)] hover:underline"
                      >
                        <span>Deploy this rule in Fleet Fix</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>

                    <pre
                      data-lenis-prevent
                      className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--line)] font-mono text-xs text-[var(--text)] whitespace-pre-wrap leading-relaxed"
                    >
                      {kf.rule}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Closest Historical Failure Matches */}
          <div className="space-y-3">
            <MonoLabel index="LOOKALIKES" label="CLOSEST MATCHING FLEET FAILURES" />

            <div className="panel overflow-hidden">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-[var(--raised)] border-b border-[var(--line)] text-[10px] font-mono text-[var(--faint)] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4">Run ID</th>
                    <th className="py-2.5 px-4">Similarity</th>
                    <th className="py-2.5 px-4">Fault Vector</th>
                    <th className="py-2.5 px-4">Guilty Step</th>
                    <th className="py-2.5 px-4">Family</th>
                    <th className="py-2.5 px-4">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)] font-mono text-xs">
                  {(data.closest || []).map((match: any) => (
                    <tr key={match.run_id} className="hover:bg-[var(--raised)]/40 transition-colors">
                      <td className="py-2.5 px-4 text-[var(--text-strong)] font-semibold">
                        <Link to={`/runs/${match.run_id}`} className="hover:underline">
                          {match.run_id}
                        </Link>
                      </td>
                      <td className="py-2.5 px-4 text-[var(--ok)] font-semibold tabular-nums">
                        {Math.round((match.similarity ?? 1) * 100)}%
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-1.5 py-0.5 rounded bg-[var(--guilty-bg)] text-[var(--guilty)] border border-[var(--guilty)]/30 font-bold text-[10px]">
                          {match.fault}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <StepChip step={match.cause} variant="guilty" />
                      </td>
                      <td className="py-2.5 px-4 font-sans text-xs uppercase text-[var(--muted)]">
                        {match.family}
                      </td>
                      <td className="py-2.5 px-4 text-[var(--faint)] text-[11px]">
                        {match.source}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Empty State if no run */}
      {!data && !isLoading && !error && (
        <EmptyState
          title="Fingerprint Search Ready"
          description="Enter a failure run ID above to inspect its causal fingerprint and discover identical historical failure traces across the fleet."
          endpoint={`GET /api/runs/${runId}/similar`}
          command={`blackbox similar --run ${runId}`}
        />
      )}
    </div>
  );
};
