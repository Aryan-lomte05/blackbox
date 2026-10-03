import React, { useState, useRef, useEffect } from 'react';
import { api } from '../lib/api';
import { ArrowRight, Play, CheckCircle2, RotateCw, AlertTriangle, Bug } from 'lucide-react';

const STAGES = [
  { n: 1, name: 'Understand' },
  { n: 2, name: 'Knowledge' },
  { n: 3, name: 'Run Live' },
  { n: 4, name: 'Clean Answer' },
  { n: 5, name: 'Choose Mistake' },
  { n: 6, name: 'Plant' },
  { n: 7, name: 'Broken' },
  { n: 8, name: 'Check' },
  { n: 9, name: 'Diagnose' },
  { n: 10, name: 'Verify' },
  { n: 11, name: 'Explain' },
  { n: 12, name: 'Fix' },
  { n: 13, name: 'Test' },
  { n: 14, name: 'Report' },
];

const MISTAKE_OPTIONS = [
  { id: 'f1', label: 'Wrong tool argument (F1)' },
  { id: 'f2', label: 'Wrong tool result (F2)' },
  { id: 'f3', label: 'Tool returned nothing (F3)' },
  { id: 'f4', label: 'Misleading paragraph (F4)' },
  { id: 'f5', label: 'Missing paragraph (F5)' },
  { id: 'f6', label: 'Wrong fact (F6)' },
  { id: 'f8', label: 'Lost memory (F8)' },
];

export const LiveLabScreen: React.FC = () => {
  const [prompt, setPrompt] = useState('Who directed the film Inception, and in what year was it released?');
  const [selectedMistake, setSelectedMistake] = useState('f4');
  const [activeStage, setActiveStage] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [completedRunId, setCompletedRunId] = useState<string | null>(null);
  const [logs, setLogs] = useState<Array<{ text: string; color: 'green' | 'blue' | 'amber' | 'rose'; time?: string }>>([]);

  const eventSourceRef = useRef<EventSource | null>(null);

  const handleStartLab = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setErrorMsg(null);
    setActiveStage(1);
    setCompletedRunId(null);
    setLogs([{ text: 'Initiating Live Lab session with flight recorder telemetry...', color: 'blue' }]);

    try {
      // POST to real backend /api/lab
      const resp = await api.post<{ job_id: string }>('/api/lab', {
        question: prompt,
        family: 'qa',
        mistake: selectedMistake,
      });

      if (resp?.job_id) {
        const es = api.createEventSource(`/api/jobs/${resp.job_id}/events`);
        eventSourceRef.current = es;

        es.addEventListener('stage', (e: any) => {
          try {
            const data = JSON.parse(e.data);
            if (data.n) {
              setActiveStage(data.n);
              setLogs((prev) => [
                ...prev,
                { text: `[Stage ${data.n}/14] ${data.title || STAGES[data.n - 1]?.name || ''}`, color: 'blue' },
              ]);
            }
          } catch {}
        });

        es.addEventListener('step', (e: any) => {
          try {
            const data = JSON.parse(e.data);
            const s = data.step;
            setLogs((prev) => [
              ...prev,
              { text: `Step #${s?.idx ?? '?'}: ${s?.kind ?? 'step'}:${s?.name ?? ''} executed (${data.phase || 'run'})`, color: 'green' },
            ]);
          } catch {}
        });

        es.addEventListener('checker', (e: any) => {
          try {
            const data = JSON.parse(e.data);
            setLogs((prev) => [
              ...prev,
              { text: `Checker: Consistency ${Math.round((data.consistent_prob ?? 1) * 100)}% (Alarm: ${data.alarm ? 'YES' : 'NO'})`, color: data.alarm ? 'amber' : 'green' },
            ]);
          } catch {}
        });

        es.addEventListener('done', (e: any) => {
          setIsRunning(false);
          setActiveStage(14);
          try {
            const data = JSON.parse(e.data);
            if (data.run_id) {
              setCompletedRunId(data.run_id);
            }
          } catch {}
          setLogs((prev) => [...prev, { text: 'Live Lab completed. All 14 stages recorded and verified.', color: 'green' }]);
          es.close();
        });

        es.onerror = () => {
          setIsRunning(false);
          setErrorMsg('Live Lab SSE stream connection ended.');
          es.close();
        };
      }
    } catch (err: any) {
      setIsRunning(false);
      setErrorMsg(err?.detail || err?.message || 'Failed to start Live Lab run on backend.');
    }
  };

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Top Header matching reference */}
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight font-heading flex items-center gap-2">
          <span>Live Lab</span>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            DEMO 0 · 14 STAGES
          </span>
        </h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          Step through Black Box end-to-end: record a run, plant a fault, detect it, and verify the repair.
        </p>
      </div>

      {/* 14-Stage Progress Stepper Bar matching reference image */}
      <div className="p-4 rounded-xl bg-[#0c0d10] border border-white/[0.06] overflow-x-auto shadow-xl">
        <div className="flex items-center min-w-[700px] justify-between relative">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-[#1a1c22] -translate-y-1/2 z-0" />
          {STAGES.map((st) => {
            const isCompleted = activeStage > st.n;
            const isCurrent = activeStage === st.n;

            return (
              <div key={st.n} className="flex flex-col items-center gap-1.5 z-10 shrink-0">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-all ${
                    isCurrent
                      ? 'bg-blue-600 text-white ring-4 ring-blue-500/20 shadow-lg'
                      : isCompleted
                      ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                      : 'bg-[#14151a] border border-white/[0.08] text-zinc-500'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : st.n}
                </div>
                <span
                  className={`text-[10px] font-mono tracking-tight ${
                    isCurrent
                      ? 'text-blue-400 font-bold'
                      : isCompleted
                      ? 'text-zinc-300'
                      : 'text-zinc-600'
                  }`}
                >
                  {st.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5 font-mono">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main 2-Column Split: Controls + Execution Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Inputs (5 cols) */}
        <div className="lg:col-span-5 rounded-xl bg-[#0c0d10] border border-white/[0.06] p-5 space-y-4 shadow-xl">
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-zinc-400 uppercase tracking-wider block">
              Agent Question / Task
            </label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isRunning}
              className="w-full bg-[#14151a] border border-white/[0.08] rounded-lg p-3 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 resize-none font-sans"
              placeholder="Enter question for agent..."
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono text-zinc-400 uppercase tracking-wider block">
              Injected Failure Mode
            </label>
            <div className="space-y-1.5">
              {MISTAKE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSelectedMistake(opt.id)}
                  disabled={isRunning}
                  className={`w-full p-2.5 rounded-lg border text-left text-xs font-mono transition-colors flex items-center justify-between cursor-pointer ${
                    selectedMistake === opt.id
                      ? 'bg-blue-600/10 border-blue-500/50 text-blue-300'
                      : 'bg-[#14151a] border-white/[0.06] text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span>{opt.label}</span>
                  {selectedMistake === opt.id && (
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleStartLab}
              disabled={isRunning}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30 transition-all cursor-pointer"
            >
              {isRunning ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin text-white" />
                  <span>Executing 14 Stages in Live Lab...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current text-white" />
                  <span>Launch Live Lab Execution</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Console / Execution Feed (7 cols) */}
        <div className="lg:col-span-7 rounded-xl bg-[#0c0d10] border border-white/[0.06] flex flex-col justify-between overflow-hidden shadow-xl min-h-[400px]">
          <div className="p-3 border-b border-white/[0.06] bg-[#090a0c] flex items-center justify-between">
            <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
              Live Lab Telemetry Stream
            </span>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
              <span className="text-[10px] font-mono text-zinc-400">
                {isRunning ? 'STREAMING :8000' : 'IDLE'}
              </span>
            </div>
          </div>

          {/* Terminal output box */}
          <div className="p-4 flex-1 overflow-y-auto space-y-2 font-mono text-xs text-zinc-300 bg-[#08090a]">
            {logs.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-600 font-mono">
                Telemetry stream will display stage transitions, checker invariants, and counterfactual diagnosis once started.
              </div>
            ) : (
              logs.map((log, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2 ${
                    log.color === 'blue'
                      ? 'text-cyan-400'
                      : log.color === 'amber'
                      ? 'text-amber-400'
                      : log.color === 'rose'
                      ? 'text-rose-400'
                      : 'text-emerald-400'
                  }`}
                >
                  <span className="text-zinc-600 select-none">›</span>
                  <span>{log.text}</span>
                </div>
              ))
            )}
          </div>

          {/* Console footer */}
          <div className="p-3 border-t border-white/[0.04] bg-[#090a0c] flex items-center justify-between text-[11px] font-mono text-zinc-500">
            <span>Stage: {activeStage > 0 ? `${activeStage}/14 (${STAGES[activeStage - 1]?.name || ''})` : 'Awaiting launch'}</span>
            {completedRunId && (
              <a
                href={`/runs/${completedRunId}`}
                className="text-blue-400 hover:text-blue-300 font-semibold"
              >
                Inspect Recorded Run #{completedRunId.slice(0, 6)} →
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
