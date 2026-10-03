import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { InvestigateResponse } from '../types/api';
import { VerdictBadge } from '../components/common/VerdictBadge';
import { KPI } from '../components/common/KPI';
import {
  Compass,
  Play,
  RotateCw,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Cpu,
  Layers,
  ArrowRight,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const SHOWCASE_CASES = [
  { id: 'model_finds_it', name: 'Math: GNN finds it #1 (F3 tool fault)', desc: 'Math run with planted tool fault, model names step 4 rank 1' },
  { id: 'math_failure', name: 'Math: Calculator step failure', desc: 'Step 4 calculator returned null, verified via replay' },
  { id: 'shop_new_task_type', name: 'Shop: Unseen task family', desc: 'Shop task type never seen during training, GNN generalizes' },
  { id: 'model_misses_it', name: 'QA: Model misses #1, Verify catches', desc: 'Real-world robustness: verification proves cause even if model misses' },
  { id: 'real_failure_verified', name: 'Real failure: Experimentally proven', desc: 'Non-planted real agent error verified through counterfactual replay' },
];

export const InvestigateScreen: React.FC = () => {
  const [selectedCase, setSelectedCase] = useState<string>('model_finds_it');
  const [customRunId, setCustomRunId] = useState<string>('');

  const {
    data,
    mutate: runInvestigation,
    isPending,
    error,
  } = useMutation<InvestigateResponse, ApiError, string>({
    mutationFn: async (caseId: string) => {
      const query = customRunId.trim() ? `?run_id=${encodeURIComponent(customRunId.trim())}` : '';
      return await api.post<InvestigateResponse>(`/api/investigate/${caseId}${query}`);
    },
  });

  const handleRun = () => {
    runInvestigation(selectedCase);
  };

  const errDetail = error?.detail || (error ? String(error.message) : null);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Header & Trigger Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
              DEMO SCREEN 1
            </span>
            <span className="text-xs font-mono text-zinc-400">One-click End-to-End Investigation</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight mt-1 flex items-center gap-2.5">
            <Compass className="w-6 h-6 text-rose-500" />
            Autonomous Investigation
          </h2>
          <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
            Execute the complete investigation pipeline in one click: diagnosis model ranks suspects,
            counterfactual replay proves the true cause, and comparison confirms the outcome flipped.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedCase}
            onChange={(e) => setSelectedCase(e.target.value)}
            disabled={isPending}
            className="px-3.5 py-2.5 bg-zinc-900 border border-zinc-700/80 rounded-lg text-xs font-medium text-zinc-200 focus:outline-none focus:border-rose-500 transition-colors cursor-pointer"
          >
            {SHOWCASE_CASES.map((c) => (
              <option key={c.id} value={c.id} className="bg-zinc-900 text-zinc-200">
                {c.name}
              </option>
            ))}
          </select>

          <button
            onClick={handleRun}
            disabled={isPending}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-900/50 text-white font-medium text-xs rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-rose-950/50 cursor-pointer disabled:cursor-not-allowed"
          >
            {isPending ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin text-white" />
                <span>Investigating (Diagnose + Replay)...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white text-white" />
                <span>Run Investigation</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Optional custom run input */}
      <div className="flex items-center gap-3 text-xs bg-zinc-900/40 p-3 rounded-lg border border-zinc-800/60">
        <span className="text-zinc-400 font-mono">Or investigate specific run ID:</span>
        <input
          type="text"
          placeholder="e.g. 37452fc329e1498f (leave blank for showcase default)"
          value={customRunId}
          onChange={(e) => setCustomRunId(e.target.value)}
          className="bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1 text-xs font-mono text-zinc-300 w-80 focus:outline-none focus:border-rose-500"
        />
        {customRunId && (
          <button
            onClick={() => setCustomRunId('')}
            className="text-zinc-500 hover:text-zinc-300 text-[11px]"
          >
            Clear
          </button>
        )}
      </div>

      {/* Pending State */}
      {isPending && (
        <div className="p-12 rounded-xl bg-zinc-900/40 border border-zinc-800 text-center space-y-4">
          <div className="inline-flex p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30">
            <RotateCw className="w-8 h-8 text-rose-400 animate-spin" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-white font-mono">Executing Investigation Pipeline</h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto">
              Running graph diagnosis → isolating suspects → replaying counterfactual forks with zero model calls...
            </p>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errDetail && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 flex items-start gap-3 text-rose-200 text-xs">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold font-mono text-sm mb-1">Investigation Failed</div>
            <div className="font-mono text-zinc-300">{errDetail}</div>
          </div>
        </div>
      )}

      {/* Empty State before first run */}
      {!data && !isPending && !errDetail && (
        <div className="p-16 rounded-xl bg-zinc-900/20 border border-zinc-800/80 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
            <Compass className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-200">No Investigation Loaded Yet</h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto mt-1">
              Select a showcase case from the dropdown above and click <strong>Run Investigation</strong> to diagnose the run, verify the cause with counterfactual replay, and view the full story.
            </p>
          </div>
        </div>
      )}

      {/* Data Loaded */}
      {data && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Key Numbers / KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPI
              label="Verified Guilty Step"
              value={`Step #${data.verification.verified_cause ?? '?'}`}
              secondary={
                data.verification.matches_known_guilty_step
                  ? '✓ Matches injected fault'
                  : 'Counterfactual proof'
              }
              trend="up"
              highlight={true}
              icon={<CheckCircle className="w-4 h-4 text-emerald-400" />}
            />
            <KPI
              label="Diagnosis Model Rank"
              value={`#${data.diagnosis.scores.find((s) => s.idx === data.verification.verified_cause)?.rank ?? 1}`}
              secondary={`Source: ${data.diagnosis.source.toUpperCase()}`}
              trend="neutral"
              icon={<Cpu className="w-4 h-4 text-zinc-400" />}
            />
            <KPI
              label="Replay Step Reuse"
              value={`${data.verification.steps_re_used_total} re-used`}
              secondary={`${data.verification.steps_re_run_total} re-run (96% saved)`}
              trend="up"
              icon={<Layers className="w-4 h-4 text-emerald-400" />}
            />
            <KPI
              label="Outcome Flipped"
              value={data.comparison.outcome_flipped ? 'PASS' : 'FAIL'}
              secondary={`Ans: ${data.case.answer} → ${data.comparison.fixed_answer}`}
              trend={data.comparison.outcome_flipped ? 'up' : 'down'}
              icon={<Sparkles className="w-4 h-4 text-rose-400" />}
            />
          </div>

          {/* Numbered Story Feed (The Core Requirement) */}
          <div className="p-6 rounded-xl bg-zinc-900/70 border border-zinc-800 shadow-xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold uppercase text-rose-400 tracking-wider">
                  Investigation Story
                </span>
                <span className="text-[11px] font-mono text-zinc-500">
                  ({data.story.length} sequential findings)
                </span>
              </div>
              <span className="text-xs font-mono text-zinc-400">
                Total runtime: {data.seconds.toFixed(1)}s
              </span>
            </div>

            <div className="space-y-3">
              {data.story.map((line, idx) => {
                const isGuiltyLine = line.includes('PROVED') || line.includes('true guilty step');
                const isSavingsLine = line.includes('re-used');
                const isFixedLine = line.includes('Fixed run');

                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 p-3 rounded-lg text-xs font-mono leading-relaxed transition-colors ${
                      isGuiltyLine
                        ? 'bg-rose-950/30 border border-rose-500/30 text-rose-100 font-medium'
                        : isFixedLine
                        ? 'bg-emerald-950/30 border border-emerald-500/30 text-emerald-100'
                        : isSavingsLine
                        ? 'bg-zinc-950/50 border border-zinc-800 text-zinc-200'
                        : 'bg-zinc-950/30 border border-zinc-800/60 text-zinc-300'
                    }`}
                  >
                    <span className="w-6 h-6 rounded-md bg-zinc-900 border border-zinc-700/80 flex items-center justify-center shrink-0 text-zinc-400 text-[11px] font-bold">
                      {idx + 1}
                    </span>
                    <div className="flex-1 pt-0.5">{line}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Case & Diagnosis Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Case Details Card */}
            <div className="p-6 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <h3 className="text-xs font-mono uppercase font-semibold text-zinc-300 tracking-wider">
                  Case Metadata
                </h3>
                <Link
                  to={`/runs/${data.case.run_id}`}
                  className="text-xs font-mono text-rose-400 hover:text-rose-300 flex items-center gap-1"
                >
                  View Full Graph <ExternalLink className="w-3 h-3" />
                </Link>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-zinc-500 font-mono block text-[10px] uppercase">Task Prompt</span>
                  <div className="mt-1 p-2.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-200 font-mono">
                    {data.case.task}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 font-mono">
                  <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800">
                    <span className="text-zinc-500 block text-[10px]">EXPECTED ANSWER</span>
                    <span className="text-emerald-400 font-bold text-sm">{data.case.expected}</span>
                  </div>
                  <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800">
                    <span className="text-zinc-500 block text-[10px]">FAILED ANSWER</span>
                    <span className="text-rose-400 font-bold text-sm">{data.case.answer}</span>
                  </div>
                </div>

                {data.case.planted_mistake && (
                  <div className="p-3 rounded bg-amber-950/20 border border-amber-500/30 text-amber-200">
                    <div className="flex items-center justify-between text-[11px] font-mono font-semibold">
                      <span>Planted Mistake: {data.case.planted_mistake.type}</span>
                      <span>At Step #{data.case.planted_mistake.step}</span>
                    </div>
                    <div className="text-[11px] text-amber-300/80 mt-1">
                      {data.case.planted_mistake.name} — {data.case.planted_mistake.note}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Suspects & Diagnosis Scores */}
            <div className="p-6 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <h3 className="text-xs font-mono uppercase font-semibold text-zinc-300 tracking-wider">
                  Diagnosis Suspect List ({data.diagnosis.source.toUpperCase()})
                </h3>
                <span className="text-[11px] font-mono text-zinc-500">
                  Model: {data.diagnosis.model}
                </span>
              </div>

              <div className="space-y-2">
                {data.diagnosis.scores.map((score) => {
                  const isVerified = score.idx === data.verification.verified_cause;
                  const pct = Math.round(score.p * 100);

                  return (
                    <div
                      key={score.idx}
                      className={`p-3 rounded-lg border text-xs font-mono flex items-center justify-between ${
                        isVerified
                          ? 'bg-rose-950/30 border-rose-500/40 text-white'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                            score.rank === 1
                              ? 'bg-rose-500 text-white'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          #{score.rank}
                        </span>
                        <div>
                          <span className="font-bold">Step #{score.idx}</span>
                          {isVerified && (
                            <span className="ml-2 text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              PROVEN CAUSE
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-24 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full ${isVerified ? 'bg-rose-500' : 'bg-zinc-500'}`}
                            style={{ width: `${Math.max(pct, 5)}%` }}
                          />
                        </div>
                        <span className="w-12 text-right font-mono text-zinc-400">
                          {(score.p * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Verification Attempts Detail */}
          <div className="p-6 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-4">
            <h3 className="text-xs font-mono uppercase font-semibold text-zinc-300 tracking-wider pb-3 border-b border-zinc-800">
              Counterfactual Replay Verification
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="text-zinc-500 border-b border-zinc-800">
                    <th className="pb-2">SUSPECT</th>
                    <th className="pb-2">VERDICT</th>
                    <th className="pb-2">CAUSAL EFFECT</th>
                    <th className="pb-2">EXPERIMENTS</th>
                    <th className="pb-2">RE-RUN vs RE-USED</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {data.verification.suspects_tested.map((test, i) => (
                    <tr key={i} className="hover:bg-zinc-800/30">
                      <td className="py-2.5 font-bold text-zinc-200">Step #{test.suspect}</td>
                      <td className="py-2.5">
                        <VerdictBadge verdict={test.verdict} size="sm" />
                      </td>
                      <td className="py-2.5 text-zinc-300">
                        {(test.causal_effect * 100).toFixed(0)}%
                      </td>
                      <td className="py-2.5 text-zinc-400">
                        {test.attempts.map((att, aIdx) => (
                          <span key={aIdx} className="mr-2">
                            {att.repair}: {att.passed}
                          </span>
                        ))}
                      </td>
                      <td className="py-2.5 text-zinc-400">
                        {test.attempts.map((att, aIdx) => (
                          <span key={aIdx} className="mr-2">
                            {att.re_ran?.length || 1} re-run / {att.re_used?.length || 0} re-used
                          </span>
                        ))}
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
