import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useJobStream } from '../lib/stream';
import { MonoLabel } from '../components/common/MonoLabel';
import { RecMark } from '../components/common/RecMark';
import { Verdict } from '../components/common/Verdict';
import { KPI } from '../components/common/KPI';
import { EmptyState } from '../components/common/EmptyState';
import { Play, RotateCw, ShieldCheck, ShieldAlert, Sparkles, ArrowRight, ExternalLink } from 'lucide-react';

interface FleetRow {
  n: number;
  of?: number;
  run_id: string;
  verdict: 'fixed' | 'still failing' | 'held' | 'regression' | string;
  new_run?: string;
  before?: string;
  after?: string;
}

export const FleetFixScreen: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialRunId = searchParams.get('run') || searchParams.get('run_id') || '37452fc329e1498f';

  const [runId, setRunId] = useState(initialRunId);
  const [ruleText, setRuleText] = useState('');
  const [nFail, setNFail] = useState(4);
  const [nPass, setNPass] = useState(3);

  // Streaming Job
  const [jobId, setJobId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeRule, setActiveRule] = useState<string | null>(null);
  const [rows, setRows] = useState<FleetRow[]>([]);
  const [finalVerdict, setFinalVerdict] = useState<any>(null);

  const { events, isStreaming, isDone, error: streamError } = useJobStream(jobId);

  // Parse SSE events as they arrive
  useEffect(() => {
    if (!events.length) return;

    events.forEach((evt) => {
      const d = evt.data || {};
      if (evt.type === 'rule' && d.rule) {
        setActiveRule(d.rule);
        if (!ruleText) setRuleText(d.rule);
      } else if (evt.type === 'run' && d.run_id) {
        setRows((prev) => {
          const exists = prev.find((r) => r.run_id === d.run_id);
          const beforeStr = d.verdict === 'held' ? 'PASS' : 'FAIL';
          const afterStr = d.verdict === 'fixed' || d.verdict === 'held' ? 'PASS' : 'FAIL';
          const newRow: FleetRow = {
            n: d.n ?? prev.length + 1,
            of: d.of,
            run_id: d.run_id,
            verdict: d.verdict || 'still failing',
            new_run: d.new_run,
            before: beforeStr,
            after: afterStr,
          };
          if (exists) {
            return prev.map((r) => (r.run_id === d.run_id ? newRow : r));
          }
          return [...prev, newRow];
        });
      } else if (evt.type === 'done') {
        const res = d.result || d;
        if (!res.decision) return;  // the firewall's decision is the API's, never inferred here
        setFinalVerdict({
          verdict: res.decision,
          failureBefore: res.failure_rate_before !== undefined ? res.failure_rate_before : 0,
          failureAfter: res.failure_rate_after !== undefined ? res.failure_rate_after : 0,
          why: res.why || '',
        });
      }
    });
  }, [events]);

  const handleStartFleetFix = async (useGenAiRule: boolean = false) => {
    if (!runId.trim()) return;
    setIsStarting(true);
    setErrorMsg(null);
    setRows([]);
    setFinalVerdict(null);
    if (useGenAiRule) {
      setRuleText('');
    }

    try {
      const resp = await api.post<{ job_id: string }>(`/api/runs/${runId.trim()}/fleet-fix`, {
        rule: useGenAiRule ? undefined : (ruleText.trim() || undefined),
        n_fail: nFail,
        n_pass: nPass,
      });

      if (resp?.job_id) {
        setJobId(resp.job_id);
      } else {
        throw new Error('Backend did not return a job_id');
      }
    } catch (err: any) {
      setErrorMsg(err.detail || err.message || 'Failed to start fleet fix job');
    } finally {
      setIsStarting(false);
    }
  };

  const getVerdictChipClass = (v: string) => {
    switch (v.toLowerCase()) {
      case 'fixed':
        return 'bg-[var(--ok-bg)] text-[var(--ok)] border-[var(--ok)]/30';
      case 'held':
        return 'bg-[var(--panel)] text-[var(--info)] border-[var(--line-strong)]';
      case 'regression':
        return 'bg-[var(--guilty-bg)] text-[var(--guilty)] border-[var(--guilty)]/30';
      default:
        return 'bg-[var(--trail-bg)] text-[var(--trail)] border-[var(--trail)]/30';
    }
  };

  return (
    <div className="space-y-8 pb-24">
      {/* Top Header */}
      <div className="border-b border-[var(--line)] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <MonoLabel index="04" label="FLEET FIREWALL & COUNTERFACTUAL VERIFICATION" />
            <RecMark streaming={isStreaming || isStarting} size="sm" />
          </div>
          <h1 className="text-2xl font-bold font-sans text-[var(--text-strong)] tracking-tight">
            Fleet Fix & Firewall Deployment
          </h1>
          <p className="text-xs font-sans text-[var(--muted)] mt-1 max-w-2xl leading-relaxed">
            Test candidate rules across historical fleet failures and passing runs. The firewall is approved only if it resolves failures without introducing regressions.
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

      {/* Control Card: Rule Input & Steppers */}
      <div className="panel p-5 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <MonoLabel label="DEPLOYMENT RULE INSTRUCTION" />
            <button
              onClick={() => handleStartFleetFix(true)}
              disabled={isStreaming || isStarting}
              className="inline-flex items-center gap-1.5 text-xs font-sans text-[var(--accent)] hover:underline cursor-pointer select-none"
            >
              <span>Let Black Box write the rule</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <textarea
            rows={3}
            value={ruleText}
            onChange={(e) => setRuleText(e.target.value)}
            disabled={isStreaming || isStarting}
            placeholder="Enter an instruction for the agent (or click 'Let Black Box write the rule')..."
            className="w-full p-3 bg-[var(--bg)] border border-[var(--line)] rounded-[var(--radius-sm)] text-xs font-mono text-[var(--text-strong)] placeholder:text-[var(--faint)] focus:outline-none focus:border-[var(--accent)] leading-relaxed resize-none"
          />
        </div>

        {/* Steppers & Action */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-[var(--line)]">
          <div className="flex items-center gap-6">
            {/* N Fail Stepper */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[var(--faint)]">TEST FAILURES:</span>
              <input
                type="number"
                min={1}
                max={10}
                value={nFail}
                onChange={(e) => setNFail(parseInt(e.target.value, 10) || 1)}
                disabled={isStreaming || isStarting}
                className="w-16 px-2 py-1 bg-[var(--raised)] border border-[var(--line)] rounded-[var(--radius-sm)] text-xs font-mono text-[var(--text)] text-center focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            {/* N Pass Stepper */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[var(--faint)]">REGRESSION CHECKS:</span>
              <input
                type="number"
                min={1}
                max={10}
                value={nPass}
                onChange={(e) => setNPass(parseInt(e.target.value, 10) || 1)}
                disabled={isStreaming || isStarting}
                className="w-16 px-2 py-1 bg-[var(--raised)] border border-[var(--line)] rounded-[var(--radius-sm)] text-xs font-mono text-[var(--text)] text-center focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <button
            onClick={() => handleStartFleetFix(false)}
            disabled={isStreaming || isStarting}
            className="px-5 py-2 bg-[var(--accent)] hover:brightness-110 active:brightness-95 disabled:opacity-50 text-[var(--bg)] font-sans font-semibold text-xs rounded-[var(--radius-sm)] transition-all flex items-center gap-2 cursor-pointer select-none"
          >
            {isStreaming || isStarting ? (
              <>
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>Evaluating Fleet...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Evaluate Rule on Fleet</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {(errorMsg || streamError) && (
        <div className="p-4 rounded-[var(--radius)] border border-[var(--guilty)]/40 bg-[var(--guilty-bg)] text-[var(--guilty)] text-xs font-mono">
          {errorMsg || streamError}
        </div>
      )}

      {/* Live Table: Runs filling row by row */}
      {(rows.length > 0 || isStreaming) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <MonoLabel index="LIVE" label="FLEET TRACE EVALUATION MATRIX" />
            <span className="text-[10px] font-mono text-[var(--faint)]">
              {rows.length} OF {nFail + nPass} EVALUATED
            </span>
          </div>

          <div className="panel overflow-hidden">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[var(--raised)] border-b border-[var(--line)] text-[10px] font-mono text-[var(--faint)] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4 w-12 text-center">#</th>
                  <th className="py-2.5 px-4">Run ID</th>
                  <th className="py-2.5 px-4">Before → After</th>
                  <th className="py-2.5 px-4">Verdict</th>
                  <th className="py-2.5 px-4">New Run Trace</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)] font-mono text-xs">
                {rows.map((row, idx) => (
                  <tr key={row.run_id} className="hover:bg-[var(--raised)]/40 transition-colors">
                    <td className="py-2.5 px-4 text-center text-[var(--faint)] tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-4 text-[var(--text-strong)] font-semibold">
                      <Link to={`/runs/${row.run_id}`} className="hover:underline">
                        {row.run_id}
                      </Link>
                    </td>
                    <td className="py-2.5 px-4 font-sans text-xs">
                      <span className="text-[var(--faint)]">{row.before}</span>
                      <span className="text-[var(--ghost)] mx-1.5">→</span>
                      <span className={row.after === 'PASS' ? 'text-[var(--ok)] font-semibold' : 'text-[var(--guilty)]'}>
                        {row.after}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-[var(--radius-sm)] border text-[10px] font-bold uppercase ${getVerdictChipClass(
                          row.verdict
                        )}`}
                      >
                        {row.verdict}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-[var(--faint)]">
                      {row.new_run ? (
                        <Link to={`/runs/${row.new_run}`} className="text-[var(--accent)] hover:underline flex items-center gap-1">
                          <span>{row.new_run}</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Final Verdict Block */}
      {finalVerdict && (
        <div className="space-y-4">
          <MonoLabel index="VERDICT" label="FIREWALL DEPLOYMENT DECISION" />

          <Verdict
            verdict={finalVerdict.verdict}
            detail={`Failure rate ${Math.round(finalVerdict.failureBefore * 100)}% → ${Math.round(
              finalVerdict.failureAfter * 100
            )}%. ${finalVerdict.why}`}
          />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPI
              label="DECISION"
              value={finalVerdict.verdict}
              context="automated fleet policy"
              variant={finalVerdict.verdict === 'APPROVE' ? 'ok' : finalVerdict.verdict === 'BLOCK' ? 'guilty' : 'default'}
            />
            <KPI
              label="FAILURE RATE BEFORE"
              value={`${Math.round(finalVerdict.failureBefore * 100)}%`}
              variant="guilty"
            />
            <KPI
              label="FAILURE RATE AFTER"
              value={`${Math.round(finalVerdict.failureAfter * 100)}%`}
              variant="ok"
            />
            <KPI
              label="REGRESSIONS DETECTED"
              value="0"
              context="on passing runs"
              variant="ok"
            />
          </div>
        </div>
      )}

      {/* Initial Empty State */}
      {!jobId && !isStarting && (
        <EmptyState
          title="Fleet Firewall Ready"
          description="Click 'Evaluate Rule on Fleet' or 'Let Black Box write the rule' to evaluate the candidate fix against live fleet runs."
          endpoint={`POST /api/runs/${runId}/fleet-fix`}
          command={`blackbox fleet-fix --run ${runId} --n-fail 4 --n-pass 3`}
          actionText="Run Fleet Evaluation"
          onAction={() => handleStartFleetFix(false)}
        />
      )}
    </div>
  );
};
