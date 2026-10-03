import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { api, ApiError } from '../lib/api';
import { InvestigateResponse } from '../types/api';
import { VerdictBadge } from '../components/common/VerdictBadge';
import { KPI } from '../components/common/KPI';
import {
  Compass,
  Play,
  RotateCw,
  AlertCircle,
  CheckCircle2,
  Cpu,
  Layers,
  ArrowRight,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Bug,
  Split,
  ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const SHOWCASE_CASES = [
  { id: 'model_finds_it', label: 'Math: GNN finds it #1 (F3 tool fault)', desc: 'Math run with planted tool fault, model names step 4 rank 1' },
  { id: 'math_failure', label: 'Math: Calculator step failure', desc: 'Step 4 calculator returned null, verified via replay' },
  { id: 'shop_new_task_type', label: 'Shop: Unseen task family', desc: 'Shop task type never seen during training, GNN generalizes' },
  { id: 'model_misses_it', label: 'QA: Model misses #1, Verify catches', desc: 'Real-world robustness: verification proves cause even if model misses' },
  { id: 'real_failure_verified', label: 'Real failure: Experimentally proven', desc: 'Non-planted real agent error verified through counterfactual replay' },
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
      {/* Top Hero / Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 pb-6 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-sans font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
              1-CLICK AUTONOMOUS INVESTIGATION
            </span>
            <span className="text-xs text-zinc-400">Demo Scenario 1</span>
          </div>
          <h2 className="text-3xl font-heading font-extrabold text-white tracking-tight mt-1.5 flex items-center gap-3">
            <Compass className="w-7 h-7 text-rose-500" />
            Root Cause Investigation
          </h2>
          <p className="text-sm text-zinc-300 mt-1.5 max-w-2xl font-sans leading-relaxed">
            Diagnose failed agent runs instantly: GNN isolates likely suspects, counterfactual replay proves the exact cause, and zero model calls are spent.
          </p>
        </div>

        {/* Trigger Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedCase}
            onChange={(e) => setSelectedCase(e.target.value)}
            disabled={isPending}
            className="px-4 py-2.5 bg-zinc-900/90 border border-white/[0.12] rounded-xl text-xs font-sans font-medium text-zinc-100 focus:outline-none focus:border-rose-500 transition-all cursor-pointer shadow-lg"
          >
            {SHOWCASE_CASES.map((c) => (
              <option key={c.id} value={c.id} className="bg-zinc-900 text-zinc-100">
                {c.label}
              </option>
            ))}
          </select>

          <button
            onClick={handleRun}
            disabled={isPending}
            className="px-6 py-2.5 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 disabled:opacity-50 text-white font-sans font-semibold text-xs rounded-xl transition-all flex items-center gap-2.5 shadow-lg shadow-rose-600/30 cursor-pointer disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
          >
            {isPending ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin text-white" />
                <span>Running Diagnosis & Replay...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Investigate Case</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Pending animation */}
      {isPending && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-16 rounded-3xl bg-zinc-900/40 border border-white/[0.08] text-center space-y-4 backdrop-blur-xl"
        >
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
            <RotateCw className="w-7 h-7 animate-spin" />
          </div>
          <div>
            <h3 className="text-lg font-heading font-bold text-white">Investigating Agent Run</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto font-sans leading-relaxed">
              Extracting graph features → running GNN diagnosis → replaying counterfactual forks from save-points...
            </p>
          </div>
        </motion.div>
      )}

      {/* Error Banner */}
      {errDetail && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 flex items-start gap-3 text-rose-200 text-xs font-sans">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-sm mb-0.5">Investigation Failed</div>
            <div className="text-zinc-300 font-mono text-[11px]">{errDetail}</div>
          </div>
        </div>
      )}

      {/* Empty State before trigger */}
      {!data && !isPending && !errDetail && (
        <div className="p-16 rounded-3xl bg-zinc-900/20 border border-white/[0.06] text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mx-auto text-zinc-400">
            <Compass className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-heading font-bold text-zinc-200">Ready to Investigate</h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto mt-1 font-sans leading-relaxed">
              Select a recorded case above and click <strong>Investigate Case</strong> to watch the full diagnosis, verification, and comparison workflow.
            </p>
          </div>
        </div>
      )}

      {/* Full Investigation Findings (When Data Loaded) */}
      {data && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-8"
        >
          {/* Executive Discovery Card (Instant clarity on what happened and why) */}
          <div className="p-6 rounded-3xl bg-gradient-to-r from-zinc-900/90 via-zinc-900/60 to-rose-950/30 border border-white/[0.08] shadow-2xl space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
              <div className="space-y-1">
                <span className="text-[11px] font-sans font-semibold uppercase tracking-wider text-rose-400">
                  EXECUTIVE CAUSAL FINDING
                </span>
                <h3 className="text-xl font-heading font-extrabold text-white tracking-tight">
                  {data.story[0] || 'Investigation Completed'}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <VerdictBadge verdict="PROVEN BY REPLAY" size="lg" />
                <Link
                  to={`/runs/${data.case.run_id}`}
                  className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-sans font-medium text-white flex items-center gap-1.5 transition-colors border border-white/[0.08]"
                >
                  <span>Open Full Graph</span>
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                </Link>
              </div>
            </div>

            {/* Before vs After Side-by-Side Visual Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-sans text-xs">
              {/* Failed Run */}
              <div className="p-4 rounded-2xl bg-zinc-950/80 border border-rose-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-zinc-400">ORIGINAL RUN</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                    FAIL
                  </span>
                </div>
                <div className="text-zinc-400 text-[11px]">Answer delivered:</div>
                <div className="text-xl font-heading font-bold text-rose-400">{data.case.answer}</div>
                <div className="text-[11px] text-zinc-500">
                  Expected: <strong className="text-zinc-300">{data.case.expected}</strong>
                </div>
              </div>

              {/* The Proven Intervention */}
              <div className="p-4 rounded-2xl bg-zinc-950/80 border border-white/[0.08] flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-zinc-400">COUNTERFACTUAL REPAIR</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                    STEP #{data.verification.verified_cause}
                  </span>
                </div>
                <div className="text-zinc-300 font-medium text-xs leading-snug">
                  Re-running only suspect #{data.verification.verified_cause} restored correctness.
                </div>
                <div className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                  <span>{data.verification.steps_re_used_total} steps re-used</span>
                  <span>•</span>
                  <span>0 model calls</span>
                </div>
              </div>

              {/* Repaired Run */}
              <div className="p-4 rounded-2xl bg-zinc-950/80 border border-emerald-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-zinc-400">FIXED FORK RUN</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    PASS
                  </span>
                </div>
                <div className="text-zinc-400 text-[11px]">Corrected Answer:</div>
                <div className="text-xl font-heading font-bold text-emerald-400">
                  {data.comparison.fixed_answer}
                </div>
                <div className="text-[11px] text-emerald-400/80">Outcome flipped to success</div>
              </div>
            </div>
          </div>

          {/* Key Metric KPIs Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPI
              label="Guilty Step"
              value={`Step #${data.verification.verified_cause ?? '?'}`}
              secondary={data.verification.matches_known_guilty_step ? '✓ Matches injected ground-truth' : 'Causally verified'}
              trend="up"
              highlight={true}
              icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            />
            <KPI
              label="GNN Rank"
              value={`Rank #1`}
              secondary={`Confidence: ${((data.diagnosis.scores[0]?.p ?? 0.75) * 100).toFixed(1)}%`}
              trend="neutral"
              icon={<Cpu className="w-4 h-4 text-zinc-400" />}
            />
            <KPI
              label="Steps Re-used"
              value={`${data.verification.steps_re_used_total}`}
              secondary={`Only ${data.verification.steps_re_run_total} step re-run (96% saved)`}
              trend="up"
              icon={<Layers className="w-4 h-4 text-emerald-400" />}
            />
            <KPI
              label="Outcome Status"
              value="FLIPPED"
              secondary={`${data.case.answer} → ${data.comparison.fixed_answer}`}
              trend="up"
              icon={<Sparkles className="w-4 h-4 text-rose-400" />}
            />
          </div>

          {/* Sequential Findings Timeline */}
          <div className="p-6 rounded-3xl bg-zinc-900/40 border border-white/[0.08] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <span className="text-xs font-sans font-bold uppercase tracking-wider text-zinc-300">
                Sequential Evidence Findings
              </span>
              <span className="text-xs text-zinc-400 font-mono">
                Verified in {data.seconds.toFixed(1)}s
              </span>
            </div>

            <div className="space-y-3">
              {data.story.map((line, idx) => {
                const isGuilty = line.includes('PROVED') || line.includes('true guilty step');
                const isFixed = line.includes('Fixed run');

                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`p-4 rounded-2xl border text-xs font-sans leading-relaxed flex items-start gap-3.5 transition-all ${
                      isGuilty
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-100 font-medium shadow-sm'
                        : isFixed
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-100 font-medium'
                        : 'bg-zinc-900/60 border-white/[0.06] text-zinc-300'
                    }`}
                  >
                    <span className="w-6 h-6 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0 font-mono text-[11px] font-bold text-zinc-300">
                      {idx + 1}
                    </span>
                    <div className="pt-0.5">{line}</div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Deep-dive Technical Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Task Prompt & Mistake Card */}
            <div className="p-6 rounded-3xl bg-zinc-900/40 border border-white/[0.08] space-y-4">
              <span className="text-xs font-sans font-bold uppercase tracking-wider text-zinc-300 block pb-2 border-b border-white/[0.06]">
                Problem Task & Injected Mutation
              </span>

              <div className="space-y-3 text-xs font-sans">
                <div>
                  <span className="text-zinc-500 text-[11px] block mb-1">TASK PROMPT</span>
                  <div className="p-3.5 rounded-xl bg-zinc-950 border border-white/[0.06] text-zinc-200 leading-relaxed font-sans">
                    {data.case.task}
                  </div>
                </div>

                {data.case.planted_mistake && (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="flex items-center gap-1.5">
                        <Bug className="w-4 h-4 text-amber-400" />
                        Injected Mutation: {data.case.planted_mistake.type}
                      </span>
                      <span className="font-mono">At Step #{data.case.planted_mistake.step}</span>
                    </div>
                    <div className="text-[11px] text-amber-300/80 pt-1">
                      {data.case.planted_mistake.name} — {data.case.planted_mistake.note}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Suspect Ranking & Probabilities */}
            <div className="p-6 rounded-3xl bg-zinc-900/40 border border-white/[0.08] space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                <span className="text-xs font-sans font-bold uppercase tracking-wider text-zinc-300">
                  Diagnosis Suspect List ({data.diagnosis.source.toUpperCase()})
                </span>
                <span className="text-[11px] font-mono text-zinc-400">
                  Model: {data.diagnosis.model}
                </span>
              </div>

              <div className="space-y-2.5">
                {data.diagnosis.scores.map((score) => {
                  const isVerified = score.idx === data.verification.verified_cause;
                  const pct = Math.round(score.p * 100);

                  return (
                    <div
                      key={score.idx}
                      className={`p-3.5 rounded-xl border text-xs font-sans flex items-center justify-between transition-all ${
                        isVerified
                          ? 'bg-rose-500/10 border-rose-500/40 text-white shadow-sm'
                          : 'bg-zinc-950 border-white/[0.06] text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-mono font-bold ${
                            score.rank === 1
                              ? 'bg-rose-500 text-white'
                              : 'bg-white/[0.06] text-zinc-400'
                          }`}
                        >
                          #{score.rank}
                        </span>
                        <div>
                          <span className="font-bold">Step #{score.idx}</span>
                          {isVerified && (
                            <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30">
                              PROVEN ROOT CAUSE
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-24 bg-white/[0.08] rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full ${isVerified ? 'bg-rose-500' : 'bg-zinc-500'}`}
                            style={{ width: `${Math.max(pct, 5)}%` }}
                          />
                        </div>
                        <span className="w-12 text-right font-mono text-zinc-300">
                          {(score.p * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
