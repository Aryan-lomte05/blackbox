import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { AtlasResponse, AtlasPattern } from '../types/api';
import { MonoLabel } from '../components/common/MonoLabel';
import { RecMark } from '../components/common/RecMark';
import { KPI } from '../components/common/KPI';
import { EmptyState } from '../components/common/EmptyState';
import { ArrowRight, Network, Layers, Filter } from 'lucide-react';

export const AtlasScreen: React.FC = () => {
  const [selectedFamily, setSelectedFamily] = useState<string>('all');

  const { data, isLoading, error } = useQuery<AtlasResponse | any>({
    queryKey: ['atlas-data'],
    queryFn: async () => {
      return await api.get<any>('/api/atlas');
    },
  });

  const patterns: AtlasPattern[] = data?.patterns || [];
  const totalFailures = data?.total_failures !== undefined ? data.total_failures : (isLoading ? '—' : 0);

  const families = useMemo(() => {
    const set = new Set<string>();
    patterns.forEach((p) => {
      if (p.family) set.add(p.family);
    });
    return ['all', ...Array.from(set)];
  }, [patterns]);

  const filteredPatterns = useMemo(() => {
    if (selectedFamily === 'all') return patterns;
    return patterns.filter((p) => p.family?.toLowerCase() === selectedFamily.toLowerCase());
  }, [patterns, selectedFamily]);

  const maxCount = useMemo(() => {
    return Math.max(1, ...patterns.map((p) => p.count));
  }, [patterns]);

  return (
    <div className="space-y-8 pb-24">
      {/* Top Header */}
      <div className="border-b border-[var(--line)] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <MonoLabel index="10" label="FAILURE PATTERNS & FREQUENCY ATLAS" />
            <span className="font-mono text-[10px] uppercase text-[var(--accent)] bg-[var(--raised)] px-2 py-0.5 rounded border border-[var(--line)]">
              FLEET RECURRENCE
            </span>
          </div>
          <h1 className="text-2xl font-bold font-sans text-[var(--text-strong)] tracking-tight">
            Failure Atlas
          </h1>
          <p className="text-xs font-sans text-[var(--muted)] mt-1 max-w-2xl leading-relaxed">
            Horizontal frequency distribution of failure patterns across agent task families. Discover which fault vectors and execution steps account for fleet failure density.
          </p>
        </div>

        {/* Family Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[var(--raised)] p-1 rounded-[var(--radius-sm)] border border-[var(--line)]">
          {families.map((fam) => (
            <button
              key={fam}
              onClick={() => setSelectedFamily(fam)}
              className={`px-2.5 py-1 text-xs font-mono rounded-[var(--radius-sm)] uppercase transition-colors cursor-pointer ${
                selectedFamily === fam
                  ? 'bg-[var(--panel)] text-[var(--text-strong)] border border-[var(--line-strong)] font-semibold'
                  : 'text-[var(--faint)] hover:text-[var(--text)]'
              }`}
            >
              {fam}
            </button>
          ))}
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI
          label="CATALOGED FAILURES"
          value={totalFailures.toLocaleString()}
          context="fleet ground-truth failures"
          variant="guilty"
        />
        <KPI
          label="RECURRENCE PATTERNS"
          value={patterns.length.toString()}
          context="distinct causal signatures"
        />
        <KPI
          label="TOP PATTERN SHARE"
          value={`${patterns[0] ? Math.round(patterns[0].share * 100) : 14}%`}
          context={patterns[0]?.title || 'wrong fact at check step'}
          variant="trail"
        />
        <KPI
          label="FILTERED SUBSET"
          value={filteredPatterns.length.toString()}
          context={`in family: ${selectedFamily.toUpperCase()}`}
        />
      </div>

      {/* Loading & Error */}
      {isLoading && (
        <div className="panel p-12 text-center text-xs font-mono text-[var(--faint)]">
          Computing failure pattern frequency distribution...
        </div>
      )}

      {error && (
        <div className="p-4 rounded-[var(--radius)] border border-[var(--guilty)]/40 bg-[var(--guilty-bg)] text-[var(--guilty)] text-xs font-mono">
          Failed to load failure atlas: {(error as any)?.detail || (error as Error).message}
        </div>
      )}

      {/* Horizontal Bars Breakdown */}
      {!isLoading && filteredPatterns.length > 0 && (
        <div className="space-y-4">
          <MonoLabel index="DISTRIBUTION" label="FAILURE PATTERNS (RANKED BY OCCURRENCE)" />

          <div className="space-y-3">
            {filteredPatterns.map((p, idx) => {
              const barWidth = Math.max(4, Math.round((p.count / maxCount) * 100));
              const sharePct = Math.round(p.share * 100);

              return (
                <div
                  key={idx}
                  className="panel p-4 space-y-2.5 hover:border-[var(--line-strong)] transition-all select-none"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono text-xs font-bold text-[var(--faint)] w-6 text-right tabular-nums">
                        #{idx + 1}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-[var(--guilty-bg)] text-[var(--guilty)] border border-[var(--guilty)]/30 font-mono text-[10px] font-bold">
                        {p.mistake}
                      </span>
                      <span className="font-sans font-semibold text-xs text-[var(--text-strong)] truncate">
                        {p.title || `${p.family}: ${p.mistake_name} at ${p.step_kind} (${p.agent_node})`}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 font-mono text-xs text-[var(--text)] shrink-0 pl-8 sm:pl-0">
                      <span className="tabular-nums font-semibold">{p.count} runs</span>
                      <span className="text-[var(--faint)]">({sharePct}%)</span>
                    </div>
                  </div>

                  {/* Horizontal Bar */}
                  <div className="w-full bg-[var(--bg)] h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent)] rounded-full transition-all duration-300"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>

                  {/* Examples and Component node tags */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] font-mono text-[var(--faint)]">
                    <div className="flex items-center gap-2">
                      <span>Node: <span className="text-[var(--text)]">{p.step_kind}:{p.agent_node}</span></span>
                      <span>·</span>
                      <span>Family: <span className="text-[var(--text)]">{p.family}</span></span>
                    </div>

                    {p.examples && p.examples.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span>Traces:</span>
                        <div className="flex items-center gap-1.5">
                          {p.examples.slice(0, 3).map((ex) => (
                            <Link
                              key={ex}
                              to={`/runs/${ex}`}
                              className="text-[var(--accent)] hover:underline hover:text-white"
                            >
                              {ex.slice(0, 6)}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredPatterns.length === 0 && (
        <EmptyState
          title="No Patterns for this Family"
          description={`No failure traces found matching category ${selectedFamily.toUpperCase()}.`}
          endpoint="GET /api/atlas"
        />
      )}
    </div>
  );
};
