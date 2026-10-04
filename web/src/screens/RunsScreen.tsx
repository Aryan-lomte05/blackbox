import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { RunsResponse, OverviewResponse } from '../types/api';
import { formatRelativeTime, formatDurationMs } from '../lib/time';
import { MonoLabel } from '../components/common/MonoLabel';
import { StepChip } from '../components/common/StepChip';
import { EmptyState } from '../components/common/EmptyState';
import { Search, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';

interface RunItem {
  run_id: string;
  task_family: string;
  task_id: string;
  agent: string;
  model_id?: string;
  outcome?: any;
  status: string;
  stats?: any;
  created_at: string;
  planted?: string;
  has_label?: boolean;
  label?: any;
  fault?: any;
}

export const RunsScreen: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'all' | 'failed' | 'passed' | 'crashed'>('all');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Overview KPIs for tab counts
  const { data: overviewData } = useQuery<OverviewResponse>({
    queryKey: ['overview-data'],
    queryFn: async () => {
      return await api.get<OverviewResponse>('/api/ui/overview');
    },
  });

  // Fetch runs from real backend
  const { data, isLoading, error } = useQuery<RunsResponse>({
    queryKey: ['runs-list'],
    queryFn: async () => {
      return await api.get<RunsResponse>('/api/runs?limit=150');
    },
  });

  const rawRuns: RunItem[] = data?.runs || [];

  // Map backend runs to table rows
  const mappedRuns = useMemo(() => {
    return rawRuns.map((r) => {
      let statusText: 'FAILED' | 'PASSED' | 'CRASHED' = 'PASSED';
      if (r.status === 'crashed' || r.status === 'error') {
        statusText = 'CRASHED';
      } else if (r.outcome && typeof r.outcome === 'object' && r.outcome.success === false) {
        statusText = 'FAILED';
      } else if (r.outcome === 'fail' || r.fault) {
        statusText = 'FAILED';
      }

      const taskName = (r.task_family || 'QA').toUpperCase();
      const stepsCount = r.stats?.n_steps ?? 0;
      const durationStr = formatDurationMs(r.stats?.latency_ms);
      const mistake = r.fault?.type || r.planted || (statusText === 'FAILED' ? (r.has_label ? 'Identified defect' : 'Unlabelled') : '—');
      const rootCauseStep = r.label?.root_cause_step;

      return {
        status: statusText,
        run_id: r.run_id,
        task: taskName,
        agent: r.agent || r.model_id || '—',
        steps: stepsCount,
        duration: durationStr,
        mistake_type: mistake,
        root_cause_step: rootCauseStep,
        labelled: !!r.has_label || !!r.label,
        time: formatRelativeTime(r.created_at),
        full_id: r.run_id,
      };
    });
  }, [rawRuns]);

  // Filter based on active tab and search query
  const filteredRuns = useMemo(() => {
    return mappedRuns.filter((item) => {
      if (activeTab === 'failed' && item.status !== 'FAILED') return false;
      if (activeTab === 'passed' && item.status !== 'PASSED') return false;
      if (activeTab === 'crashed' && item.status !== 'CRASHED') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.full_id.toLowerCase().includes(q) ||
          item.task.toLowerCase().includes(q) ||
          item.agent.toLowerCase().includes(q) ||
          item.mistake_type.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [mappedRuns, activeTab, searchQuery]);

  const totalRunsCount = overviewData?.kpis?.runs ?? mappedRuns.length;
  const failedRunsCount = overviewData?.kpis?.failed ?? overviewData?.kpis?.labelled_failures ?? mappedRuns.filter(r => r.status === 'FAILED').length;
  const passedRunsCount = overviewData?.kpis?.passed ?? mappedRuns.filter(r => r.status === 'PASSED').length;
  const crashedRunsCount = overviewData?.kpis?.crashed ?? mappedRuns.filter(r => r.status === 'CRASHED').length;

  const totalPages = Math.max(1, Math.ceil(filteredRuns.length / pageSize));
  const pagedRuns = filteredRuns.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-8 pb-24">
      {/* Top Header */}
      <div className="border-b border-[var(--line)] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <MonoLabel index="LIST" label="RECORDED FLIGHT EXECUTION ARCHIVE" className="mb-2" />
          <h1 className="text-2xl font-bold font-sans text-[var(--text-strong)] tracking-tight">
            Recorded Runs
          </h1>
          <p className="text-xs font-sans text-[var(--muted)] mt-1 max-w-2xl leading-relaxed">
            Index of agent runs saved to the flight recorder DAG. Filter by outcome, search by run ID, or jump to trace replay.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-[var(--faint)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search run id, task, mistake..."
            className="w-full bg-[var(--raised)] text-xs text-[var(--text)] placeholder:text-[var(--faint)] pl-8 pr-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--line)] focus:outline-none focus:border-[var(--accent)] transition-colors font-sans"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 bg-[var(--raised)] p-1 rounded-[var(--radius-sm)] border border-[var(--line)]">
          {[
            { id: 'all', label: 'All Runs', count: totalRunsCount },
            { id: 'failed', label: 'Failed', count: failedRunsCount },
            { id: 'passed', label: 'Passed', count: passedRunsCount },
            { id: 'crashed', label: 'Crashed', count: crashedRunsCount },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-sans rounded-[var(--radius-sm)] transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'bg-[var(--panel)] text-[var(--text-strong)] border border-[var(--line-strong)] font-semibold'
                  : 'text-[var(--faint)] hover:text-[var(--text)]'
              }`}
            >
              <span>{tab.label}</span>
              <span className="font-mono text-[11px] opacity-75 tabular-nums">
                {tab.count.toLocaleString()}
              </span>
            </button>
          ))}
        </div>

        <div className="text-xs font-mono text-[var(--faint)]">
          Showing {filteredRuns.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, filteredRuns.length)} of {filteredRuns.length}
        </div>
      </div>

      {/* Main Dense Runs Table */}
      {isLoading ? (
        <div className="panel p-12 text-center text-xs font-mono text-[var(--faint)]">
          Loading recorded runs from flight recorder store...
        </div>
      ) : filteredRuns.length === 0 ? (
        <EmptyState
          title="No Matching Runs"
          description={`No runs matching filter "${activeTab}" with search "${searchQuery}".`}
          endpoint="GET /api/runs"
          actionText="Clear Filters"
          onAction={() => {
            setActiveTab('all');
            setSearchQuery('');
          }}
        />
      ) : (
        <div className="space-y-4">
          <div className="panel overflow-hidden">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[var(--raised)] border-b border-[var(--line)] text-[10px] font-mono text-[var(--faint)] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4 w-24">Status</th>
                  <th className="py-2.5 px-4">Run ID</th>
                  <th className="py-2.5 px-4">Task Family</th>
                  <th className="py-2.5 px-4">Agent Model</th>
                  <th className="py-2.5 px-4 text-right">Steps</th>
                  <th className="py-2.5 px-4">Planted / Defect</th>
                  <th className="py-2.5 px-4">Guilty Step</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)] font-mono text-xs">
                {pagedRuns.map((r) => {
                  const isFail = r.status === 'FAILED';
                  const isPass = r.status === 'PASSED';

                  return (
                    <tr key={r.full_id} className="hover:bg-[var(--raised)]/40 transition-colors">
                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-[var(--radius-sm)] text-[10px] font-bold uppercase ${
                            isPass
                              ? 'bg-[var(--ok-bg)] text-[var(--ok)] border border-[var(--ok)]/30'
                              : 'bg-[var(--guilty-bg)] text-[var(--guilty)] border border-[var(--guilty)]/30'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>

                      <td className="py-2.5 px-4 font-semibold text-[var(--text-strong)]">
                        <Link to={`/runs/${r.full_id}`} className="hover:underline">
                          {r.full_id.slice(0, 12)}
                        </Link>
                      </td>

                      <td className="py-2.5 px-4 font-sans text-xs text-[var(--text)] uppercase">
                        {r.task}
                      </td>

                      <td className="py-2.5 px-4 text-[var(--faint)] font-mono text-[11px]">
                        {r.agent}
                      </td>

                      <td className="py-2.5 px-4 text-right tabular-nums text-[var(--muted)]">
                        {r.steps}
                      </td>

                      <td className="py-2.5 px-4">
                        {r.mistake_type !== '—' && r.mistake_type !== 'Unlabelled' ? (
                          <span className="px-1.5 py-0.5 rounded bg-[var(--guilty-bg)] text-[var(--guilty)] border border-[var(--guilty)]/30 font-bold text-[10px]">
                            {r.mistake_type}
                          </span>
                        ) : (
                          <span className="text-[var(--faint)]">{r.mistake_type}</span>
                        )}
                      </td>

                      <td className="py-2.5 px-4">
                        {r.root_cause_step !== undefined && r.root_cause_step !== null ? (
                          <StepChip step={r.root_cause_step} variant="guilty" />
                        ) : (
                          <span className="text-[var(--ghost)]">—</span>
                        )}
                      </td>

                      <td className="py-2.5 px-4 text-right">
                        <Link
                          to={`/runs/${r.full_id}`}
                          className="inline-flex items-center gap-1 text-xs font-sans text-[var(--accent)] hover:underline"
                        >
                          <span>Trace</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs font-mono text-[var(--faint)] pt-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--panel)] text-[var(--text)] disabled:opacity-30 hover:border-[var(--line-strong)] cursor-pointer flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>

              <span>
                Page {currentPage} of {totalPages}
              </span>

              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--panel)] text-[var(--text)] disabled:opacity-30 hover:border-[var(--line-strong)] cursor-pointer flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
