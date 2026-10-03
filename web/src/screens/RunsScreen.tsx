import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { RunsResponse, OverviewResponse } from '../types/api';
import { formatRelativeTime, formatDurationMs } from '../lib/time';
import { Search, SlidersHorizontal, CheckCircle2, ChevronRight, ChevronLeft, AlertCircle } from 'lucide-react';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'all' | 'failed' | 'passed' | 'crashed'>('all');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Authoritative overview KPIs for tab counts
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
      const mistake = r.fault?.type || r.planted || (statusText === 'FAILED' ? (r.has_label ? 'Identified defect' : 'Unlabelled failure') : '—');

      return {
        status: statusText,
        run_id: r.run_id.slice(0, 4).toUpperCase(),
        task: taskName,
        agent: r.agent || 'agent-small',
        steps: stepsCount,
        duration: durationStr,
        mistake_type: mistake,
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
          item.run_id.toLowerCase().includes(q) ||
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

  const startRecord = filteredRuns.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, filteredRuns.length);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Top Header */}
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight font-heading">
          Runs
        </h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          Browse and filter recorded agent executions from the database
        </p>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Filter Pills matching reference */}
        <div className="flex items-center gap-1.5">
          {/* All */}
          <button
            onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-[#121316] text-zinc-300 hover:text-white border border-white/[0.06]'
            }`}
          >
            <span>All</span>
            <span className="font-mono text-[11px] opacity-80">{totalRunsCount.toLocaleString()}</span>
          </button>

          {/* Failed */}
          <button
            onClick={() => { setActiveTab('failed'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'failed'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-[#121316] text-zinc-300 hover:text-white border border-white/[0.06]'
            }`}
          >
            <span>Failed</span>
            <span className="font-mono text-[11px] opacity-80">{failedRunsCount.toLocaleString()}</span>
          </button>

          {/* Passed */}
          <button
            onClick={() => { setActiveTab('passed'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'passed'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-[#121316] text-zinc-300 hover:text-white border border-white/[0.06]'
            }`}
          >
            <span>Passed</span>
            <span className="font-mono text-[11px] opacity-80">{passedRunsCount.toLocaleString()}</span>
          </button>

          {/* Crashed */}
          <button
            onClick={() => { setActiveTab('crashed'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'crashed'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'bg-[#121316] text-zinc-300 hover:text-white border border-white/[0.06]'
            }`}
          >
            <span>Crashed</span>
            <span className="font-mono text-[11px] opacity-80">{crashedRunsCount.toLocaleString()}</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by ID, task, fault..."
            className="w-full bg-[#121316] text-xs text-zinc-200 placeholder:text-zinc-500 pl-8 pr-3 py-1.5 rounded-lg border border-white/[0.06] focus:outline-none focus:border-blue-500/50 transition-all font-sans"
          />
        </div>
      </div>

      {/* Main Runs Table */}
      <div className="rounded-xl border border-white/[0.06] bg-[#0c0d10] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] text-zinc-500 uppercase tracking-wider bg-[#090a0c]">
                <th className="py-2.5 px-4">STATUS</th>
                <th className="py-2.5 px-3">RUN</th>
                <th className="py-2.5 px-3">TASK</th>
                <th className="py-2.5 px-3">AGENT</th>
                <th className="py-2.5 px-3 text-right">STEPS</th>
                <th className="py-2.5 px-3 text-right">DURATION</th>
                <th className="py-2.5 px-3">MISTAKE TYPE</th>
                <th className="py-2.5 px-3 text-center">LABELLED</th>
                <th className="py-2.5 pr-4 pl-3 text-right">TIME</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-zinc-500 text-xs font-sans">
                    Loading recorded runs from flight recorder...
                  </td>
                </tr>
              ) : pagedRuns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-zinc-500 text-xs font-sans">
                    No runs match the current criteria
                  </td>
                </tr>
              ) : (
                pagedRuns.map((r, idx) => (
                  <tr
                    key={idx}
                    onClick={() => navigate(`/runs/${r.full_id}`)}
                    className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                  >
                    {/* STATUS */}
                    <td className="py-2.5 px-4">
                      {r.status === 'FAILED' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                          FAILED
                        </span>
                      ) : r.status === 'CRASHED' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                          CRASHED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          PASSED
                        </span>
                      )}
                    </td>

                    {/* RUN ID */}
                    <td className="py-2.5 px-3 text-zinc-200 font-bold group-hover:text-blue-400 transition-colors">
                      {r.run_id}
                    </td>

                    {/* TASK */}
                    <td className="py-2.5 px-3 text-zinc-400">{r.task}</td>

                    {/* AGENT */}
                    <td className="py-2.5 px-3 text-zinc-400">{r.agent}</td>

                    {/* STEPS */}
                    <td className="py-2.5 px-3 text-right text-zinc-300">{r.steps}</td>

                    {/* DURATION */}
                    <td className="py-2.5 px-3 text-right text-zinc-400">{r.duration}</td>

                    {/* MISTAKE TYPE */}
                    <td className="py-2.5 px-3">
                      <span className={r.mistake_type !== '—' && r.mistake_type !== '-' ? 'text-zinc-200' : 'text-zinc-600'}>
                        {r.mistake_type}
                      </span>
                    </td>

                    {/* LABELLED */}
                    <td className="py-2.5 px-3 text-center">
                      {r.labelled ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 inline" />
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>

                    {/* TIME */}
                    <td className="py-2.5 pr-4 pl-3 text-right text-zinc-500">
                      {r.time}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with real pagination */}
        <div className="p-3 border-t border-white/[0.04] bg-[#090a0c] flex items-center justify-between text-xs text-zinc-500 font-mono">
          <div>
            Showing {startRecord}-{endRecord} of {filteredRuns.length} runs
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-lg bg-[#121316] hover:bg-[#18191d] text-zinc-300 disabled:opacity-30 disabled:hover:bg-[#121316] transition-colors cursor-pointer disabled:cursor-not-allowed border border-white/[0.04]"
              aria-label="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-zinc-400">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-lg bg-[#121316] hover:bg-[#18191d] text-zinc-300 disabled:opacity-30 disabled:hover:bg-[#121316] transition-colors cursor-pointer disabled:cursor-not-allowed border border-white/[0.04]"
              aria-label="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
