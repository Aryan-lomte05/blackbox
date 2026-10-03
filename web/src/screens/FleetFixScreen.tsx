import React, { useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { VerdictBadge } from '../components/common/VerdictBadge';
import { KPI } from '../components/common/KPI';
import {
  ShieldCheck,
  ShieldAlert,
  Play,
  RotateCw,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  Terminal,
  ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface FleetRunRow {
  n?: number;
  of?: number;
  run_id: string;
  family?: string;
  before?: boolean | string;
  after?: boolean | string;
  verdict: 'fixed' | 'still failing' | 'regression' | 'held' | string;
  new_run?: string;
  answer?: string;
  savings?: {
    steps_reused: number;
    steps_total: number;
  };
}

export const FleetFixScreen: React.FC = () => {
  const [searchParams] = useSearchParams();
  const runIdFromUrl = searchParams.get('run_id') || '37452fc329e1498f';

  const [targetRunId, setTargetRunId] = useState(runIdFromUrl);
  const [ruleInput, setRuleInput] = useState('');
  const [nFail, setNFail] = useState(3);
  const [nPass, setNPass] = useState(2);

  const [isRunning, setIsRunning] = useState(false);
  const [activeRule, setActiveRule] = useState<string | null>(null);
  const [rows, setRows] = useState<FleetRunRow[]>([]);
  const [verdict, setVerdict] = useState<'APPROVE' | 'BLOCK' | 'NO EFFECT' | null>(null);
  const [whyText, setWhyText] = useState<string | null>(null);
  const [stats, setStats] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  const handleStartFleetFix = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setErrorMsg(null);
    setRows([]);
    setVerdict(null);
    setWhyText(null);
    setStats(null);

    try {
      const resp = await api.post<{ job_id: string; events: string; result: string }>(
        `/api/runs/${targetRunId}/fleet-fix`,
        {
          rule: ruleInput.trim() || undefined,
          n_fail: nFail,
          n_pass: nPass,
        }
      );

      const es = api.createEventSource(resp.events);
      eventSourceRef.current = es;

      es.addEventListener('rule', (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed.rule) setActiveRule(parsed.rule);
        } catch (err) {
          console.error(err);
        }
      });

      es.addEventListener('run', (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          setRows((prev) => {
            const existingIdx = prev.findIndex((r) => r.run_id === parsed.run_id);
            if (existingIdx >= 0) {
              const updated = [...prev];
              updated[existingIdx] = { ...updated[existingIdx], ...parsed };
              return updated;
            }
            return [...prev, parsed];
          });
        } catch (err) {
          console.error(err);
        }
      });

      es.addEventListener('done', (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed.decision) setVerdict(parsed.decision);
          if (parsed.why) setWhyText(parsed.why);
          if (parsed.result) {
            setStats(parsed.result);
            if (parsed.result.decision) setVerdict(parsed.result.decision);
            if (parsed.result.why) setWhyText(parsed.result.why);
            if (parsed.result.rows && parsed.result.rows.length > 0) {
              setRows(parsed.result.rows);
            }
          }
        } catch (err) {
          console.error(err);
        }
        setIsRunning(false);
        es.close();
      });

      es.addEventListener('error', (e: any) => {
        console.error('SSE Error:', e);
        setIsRunning(false);
        es.close();
      });
    } catch (err: any) {
      setIsRunning(false);
      setErrorMsg(err.detail || err.message || 'Failed to start fleet fix job');
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
              DEMO SCREEN 4
            </span>
            <span className="text-xs font-mono text-zinc-400">One Fix for Many & Regression Firewall</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight mt-1 flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            Regression Firewall
          </h2>
          <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
            Test a candidate fix or rule against a fleet of historical failures <em>and</em> passing runs.
            Only <strong>APPROVE</strong> if it fixes past failures without breaking existing passing runs.
          </p>
        </div>

        {/* Trigger Button */}
        <div>
          <button
            onClick={handleStartFleetFix}
            disabled={isRunning}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 text-white font-medium text-xs rounded-lg shadow-lg shadow-emerald-950/50 transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            {isRunning ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin text-white" />
                <span>Testing Across Fleet...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Run Firewall Evaluation</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Inputs Configuration Bar */}
      <div className="p-6 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div>
            <label className="text-zinc-400 uppercase text-[10px] block mb-1">Target Failure Run ID</label>
            <input
              type="text"
              value={targetRunId}
              onChange={(e) => setTargetRunId(e.target.value)}
              disabled={isRunning}
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-zinc-400 uppercase text-[10px] block mb-1">Failures to Test (n_fail)</label>
            <input
              type="number"
              min={1}
              max={10}
              value={nFail}
              onChange={(e) => setNFail(parseInt(e.target.value, 10))}
              disabled={isRunning}
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-zinc-400 uppercase text-[10px] block mb-1">Passing Runs to Guard (n_pass)</label>
            <input
              type="number"
              min={1}
              max={10}
              value={nPass}
              onChange={(e) => setNPass(parseInt(e.target.value, 10))}
              disabled={isRunning}
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div>
          <label className="text-zinc-400 uppercase text-[10px] font-mono block mb-1">
            General Rule / Instruction (leave blank for GenAI to synthesize from this failure)
          </label>
          <input
            type="text"
            value={ruleInput}
            onChange={(e) => setRuleInput(e.target.value)}
            disabled={isRunning}
            placeholder="e.g. Never trust a single search result: if a paragraph does not clearly answer, search again with a more specific query."
            className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Error state */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs font-mono flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Big Firewall Verdict Banner */}
      {verdict && (
        <div
          className={`p-6 rounded-xl border flex flex-col md:flex-row items-center justify-between gap-6 transition-all ${
            verdict === 'APPROVE'
              ? 'bg-emerald-950/50 border-emerald-500 shadow-xl shadow-emerald-950/60 text-emerald-100'
              : verdict === 'BLOCK'
              ? 'bg-rose-950/50 border-rose-500 shadow-xl shadow-rose-950/60 text-rose-100'
              : 'bg-zinc-900 border-zinc-700 text-zinc-200'
          }`}
        >
          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-2xl font-mono shadow-md ${
                verdict === 'APPROVE'
                  ? 'bg-emerald-500 text-black'
                  : verdict === 'BLOCK'
                  ? 'bg-rose-600 text-white'
                  : 'bg-zinc-700 text-white'
              }`}
            >
              {verdict === 'APPROVE' ? '✓' : verdict === 'BLOCK' ? '✗' : '—'}
            </div>
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                FIREWALL DECISION
              </div>
              <div className="text-3xl font-extrabold font-mono tracking-tight">{verdict}</div>
              {whyText && <div className="text-xs font-mono mt-1 text-zinc-300">{whyText}</div>}
            </div>
          </div>

          {/* Failure rate reduction KPI */}
          {stats && (
            <div className="flex items-center gap-6 font-mono text-center">
              <div className="p-3 rounded-lg bg-zinc-950/70 border border-zinc-800">
                <span className="text-[10px] text-zinc-400 uppercase block">Failure Rate Before</span>
                <span className="text-xl font-bold text-rose-400">
                  {Math.round((stats.failure_rate_before ?? 0) * 100)}%
                </span>
              </div>
              <ArrowRight className="w-5 h-5 text-zinc-500" />
              <div className="p-3 rounded-lg bg-zinc-950/70 border border-zinc-800">
                <span className="text-[10px] text-zinc-400 uppercase block">Failure Rate After</span>
                <span className="text-xl font-bold text-emerald-400">
                  {Math.round((stats.failure_rate_after ?? 0) * 100)}%
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Active Rule Display */}
      {activeRule && (
        <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 text-xs font-mono space-y-1">
          <span className="text-zinc-500 uppercase text-[10px] block font-bold">Rule Tested Across Fleet:</span>
          <div className="text-zinc-200 italic">"{activeRule}"</div>
        </div>
      )}

      {/* Fleet Re-run Table */}
      <div className="p-6 rounded-xl bg-zinc-900/60 border border-zinc-800/80 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-zinc-200 uppercase tracking-wider">
            <Terminal className="w-4 h-4 text-emerald-400" />
            Fleet Evaluation Runs ({rows.length})
          </div>
          <span className="text-[11px] font-mono text-zinc-500">Live Replay Matrix</span>
        </div>

        {rows.length === 0 && !isRunning && (
          <div className="p-12 text-center text-zinc-500 font-mono text-xs">
            Click "Run Firewall Evaluation" to stream fleet re-runs live.
          </div>
        )}

        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="text-zinc-500 border-b border-zinc-800">
                  <th className="pb-2.5">#</th>
                  <th className="pb-2.5">ORIGINAL RUN ID</th>
                  <th className="pb-2.5">BEFORE</th>
                  <th className="pb-2.5">AFTER</th>
                  <th className="pb-2.5">FIREWALL VERDICT</th>
                  <th className="pb-2.5">REPLAYED FORK ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-zinc-800/30">
                    <td className="py-3 text-zinc-500">{idx + 1}</td>
                    <td className="py-3 font-bold text-zinc-200">
                      <Link
                        to={`/runs/${row.run_id}`}
                        className="hover:text-rose-400 flex items-center gap-1"
                      >
                        {row.run_id.slice(0, 12)}
                        <ExternalLink className="w-3 h-3 text-zinc-500" />
                      </Link>
                    </td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          row.before === true || row.before === 'pass'
                            ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-950/60 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {row.before === true || row.before === 'pass' ? 'PASS' : 'FAIL'}
                      </span>
                    </td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          row.after === true || row.after === 'pass'
                            ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-950/60 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {row.after === true || row.after === 'pass' ? 'PASS' : 'FAIL'}
                      </span>
                    </td>
                    <td className="py-3">
                      <VerdictBadge verdict={row.verdict} size="sm" />
                    </td>
                    <td className="py-3 text-zinc-400">
                      {row.new_run ? (
                        <Link
                          to={`/runs/${row.new_run}`}
                          className="text-zinc-300 hover:text-white flex items-center gap-1"
                        >
                          {row.new_run.slice(0, 10)}
                          <ExternalLink className="w-3 h-3 text-zinc-500" />
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
        )}
      </div>
    </div>
  );
};
