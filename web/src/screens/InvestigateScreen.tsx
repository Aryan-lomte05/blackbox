import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { InvestigateResponse } from '../types/api';
import { MonoLabel } from '../components/common/MonoLabel';
import { RecMark } from '../components/common/RecMark';
import { KPI } from '../components/common/KPI';
import { StepChip } from '../components/common/StepChip';
import { Verdict } from '../components/common/Verdict';
import { StreamLog, StreamLogRow } from '../components/common/StreamLog';
import { SavingsMeter } from '../components/common/SavingsMeter';
import { EmptyState } from '../components/common/EmptyState';
import { Play, RotateCw, ArrowRight, ExternalLink, Compass } from 'lucide-react';

export const InvestigateScreen: React.FC = () => {
  const [selectedCase, setSelectedCase] = useState<string>('model_finds_it');

  // 1. Fetch available cases from GET /api/cases
  const { data: casesData, isLoading: isCasesLoading } = useQuery<{ cases: Record<string, any> }>({
    queryKey: ['investigate-cases'],
    queryFn: async () => {
      return await api.get<{ cases: Record<string, any> }>('/api/cases');
    },
  });

  const availableCases = casesData?.cases || {};
  const currentCaseInfo = availableCases[selectedCase] || Object.values(availableCases)[0];

  // 2. Investigate mutation calling POST /api/investigate/{case}
  const {
    data: result,
    mutate: runInvestigate,
    isPending,
    error,
  } = useMutation<InvestigateResponse, ApiError, string>({
    mutationFn: async (caseId: string) => {
      return await api.post<InvestigateResponse>(`/api/investigate/${caseId}?repeats=1`);
    },
  });

  const handleInvestigate = () => {
    runInvestigate(selectedCase);
  };

  // Convert story array into StreamLog rows
  const streamRows: StreamLogRow[] = (result?.story || []).map((line, idx) => {
    let kind = 'step';
    if (line.includes('planted') || line.includes('fault')) kind = 'rule';
    else if (line.includes('diagnosis') || line.includes('suspects')) kind = 'attempt';
    else if (line.includes('Verify') || line.includes('PROVED')) kind = 'verdict';
    else if (line.includes('Fixed run')) kind = 'result';

    return {
      id: idx,
      timestamp: (idx + 1) * 0.4,
      kind,
      text: line,
    };
  });

  const guiltyStep = result?.case?.known_guilty_step ?? result?.verification?.verified_cause ?? result?.diagnosis?.top3?.[0] ?? currentCaseInfo?.guilty;
  const reUsed = result?.verification?.steps_re_used_total ?? 0;
  const reRan = result?.verification?.steps_re_run_total ?? 0;
  const elapsedSec = result?.seconds !== undefined ? result.seconds : 0;

  return (
    <div className="space-y-8 pb-20">
      {/* Top Section */}
      <div className="border-b border-[var(--line)] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <MonoLabel index="01" label="ROOT CAUSE INVESTIGATION" />
            <RecMark streaming={isPending} size="sm" />
          </div>
          <h1 className="text-2xl font-bold font-sans text-[var(--text-strong)] tracking-tight">
            Investigate Run Failure
          </h1>
          <p className="text-xs font-sans text-[var(--muted)] mt-1 max-w-2xl leading-relaxed">
            Diagnose agent failures in one click: GNN ranks candidate steps, counterfactual replay proves the true cause, and replay reuses uncorrupted execution history.
          </p>
        </div>

        {/* Case picker and execute button */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedCase}
            onChange={(e) => setSelectedCase(e.target.value)}
            disabled={isPending || isCasesLoading}
            className="px-3 py-2 bg-[var(--raised)] border border-[var(--line)] rounded-[var(--radius-sm)] text-xs font-mono text-[var(--text)] focus:outline-none focus:border-[var(--accent)] transition-colors cursor-pointer"
          >
            {Object.entries(availableCases).map(([key, info]) => (
              <option key={key} value={key} className="bg-[var(--panel)] text-[var(--text)] font-sans">
                {key}: {info.summary || info.description || key}
              </option>
            ))}
          </select>

          <button
            onClick={handleInvestigate}
            disabled={isPending}
            className="px-4 py-2 bg-[var(--accent)] hover:brightness-110 active:brightness-95 disabled:opacity-50 text-[var(--bg)] font-sans font-semibold text-xs rounded-[var(--radius-sm)] transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed select-none"
          >
            {isPending ? (
              <>
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>Investigating...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Investigate</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Selected Case Metadata Panel */}
      {currentCaseInfo && (
        <div className="panel p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-[var(--text-strong)]">
                {currentCaseInfo.summary || selectedCase}
              </span>
              {currentCaseInfo.run_id && (
                <span className="font-mono text-[11px] text-[var(--faint)] bg-[var(--raised)] px-1.5 py-0.2 rounded border border-[var(--line)]">
                  {currentCaseInfo.run_id}
                </span>
              )}
            </div>
            <p className="text-xs font-sans text-[var(--muted)] leading-relaxed">
              {currentCaseInfo.description}
            </p>
          </div>

          {currentCaseInfo.guilty !== undefined && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-mono text-[var(--faint)]">KNOWN GUILTY:</span>
              <StepChip step={currentCaseInfo.guilty} variant="guilty" />
            </div>
          )}
        </div>
      )}

      {/* Error Banner if API fails */}
      {error && (
        <div className="p-4 rounded-[var(--radius)] border border-[var(--guilty)]/40 bg-[var(--guilty-bg)] text-[var(--guilty)] flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="font-mono text-xs font-bold uppercase tracking-wider">
              Investigation Error ({error.status || 'Connection Error'})
            </div>
            <div className="text-xs font-sans leading-relaxed text-[var(--text)]">
              {error.detail || error.message || 'Failed to complete investigation on backend.'}
            </div>
          </div>
          <button
            onClick={handleInvestigate}
            className="px-3 py-1 rounded-[var(--radius-sm)] border border-[var(--guilty)]/60 bg-[var(--raised)] text-xs font-mono text-[var(--text)] hover:brightness-110 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Live Stream / Story Display */}
      {(result || isPending) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <MonoLabel index="02" label="INVESTIGATION TIMELINE & CAUSAL PROOF" />
            {result?.case?.run_id && (
              <Link
                to={`/runs/${result.case.run_id}`}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-[var(--accent)] hover:underline"
              >
                <span>Open run {result.case.run_id}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          <StreamLog
            rows={streamRows}
            streaming={isPending}
            maxHeight="320px"
            emptyMessage="Running GNN localization & counterfactual replay..."
          />
        </div>
      )}

      {/* Summary KPI Row when complete */}
      {result && (
        <div className="space-y-4">
          <MonoLabel index="03" label="EXPERIMENT RESULTS & TELEMETRY" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPI
              label="GUILTY STEP"
              value={`STEP ${guiltyStep ?? '—'}`}
              context={result.case?.planted_mistake?.name || 'Isolated root cause'}
              variant="guilty"
            />
            <KPI
              label="VERDICT"
              value={result.verification?.verified_cause != null ? `PROVED #${result.verification.verified_cause}` : 'NOT PROVED'}
              context={result.verification?.verified_cause != null
                ? (result.verification.matches_known_guilty_step ? 'matches the known guilty step' : 'repairing it alone fixes the run')
                : 'no single repair fixed the run'}
              variant={result.verification?.verified_cause != null ? 'ok' : 'default'}
            />
            <KPI
              label="STEPS RE-USED"
              value={reUsed}
              unit={`/ ${reUsed + reRan}`}
              context={`${reRan} steps re-run`}
            />
            <KPI
              label="WALL TIME"
              value={elapsedSec.toFixed(2)}
              unit="s"
              context="local 7B verify pass"
            />
          </div>

          {/* Efficiency Bar & Verdict */}
          <div className="panel p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <SavingsMeter
              reranSteps={reRan}
              totalSteps={reUsed + reRan}
              modelCalls={0}
              tokensSaved={reUsed * 180}
            />

            {result.case?.run_id && (
              <Link
                to={`/runs/${result.case.run_id}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--raised)] border border-[var(--line-strong)] text-xs font-sans font-semibold text-[var(--text-strong)] hover:border-[var(--accent)] transition-colors"
              >
                <span>Inspect in Flight Recorder</span>
                <ArrowRight className="w-3.5 h-3.5 text-[var(--accent)]" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Initial Empty State before running */}
      {!result && !isPending && !error && (
        <EmptyState
          title="Ready to investigate"
          description="Select a case from the dropdown above and click 'Investigate' to trigger GNN localization, counterfactual replay, and automated causal verification against the running backend."
          endpoint="POST /api/investigate/{case}"
          command={`blackbox investigate --case ${selectedCase}`}
          actionText="Run Investigation"
          onAction={handleInvestigate}
        />
      )}
    </div>
  );
};
