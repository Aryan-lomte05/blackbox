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
  'Search result',
  'Tool misuse',
  'Calculator error',
  'Memory overwrite',
  'Parsing error',
];

export const LiveLabScreen: React.FC = () => {
  const [prompt, setPrompt] = useState('Who directed the film Inception, and in what year was it released?');
  const [selectedMistake, setSelectedMistake] = useState('Search result');
  const [activeStage, setActiveStage] = useState(5);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<Array<{ text: string; color: 'green' | 'blue' | 'amber'; time?: string }>>([
    { text: 'Step 3: Running tool wikipedia_search...', color: 'green' },
    { text: 'Step 3: Retrieved 5 sources (1.2s)', color: 'green' },
    { text: 'Checker: Consistency 98%', color: 'green' },
    { text: 'Step 4: LLM generating analysis...', color: 'blue' },
    { text: 'Step 4: Completed (1.1s)', color: 'green' },
  ]);

  const eventSourceRef = useRef<EventSource | null>(null);

  const handleStartLab = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setActiveStage(1);
    setLogs([{ text: 'Starting Live Lab session...', color: 'blue' }]);

    try {
      // POST to real backend /api/lab
      const resp = await api.post<{ job_id: string }>('/api/lab', {
        question: prompt,
        family: 'qa',
        mistake: selectedMistake.toLowerCase().replace(' ', '_'),
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
                { text: `Stage ${data.n}: ${data.title || ''}`, color: 'blue' },
              ]);
            }
          } catch {}
        });

        es.addEventListener('step', (e: any) => {
          try {
            const data = JSON.parse(e.data);
            setLogs((prev) => [
              ...prev,
              { text: `Step ${data.step?.idx ?? ''}: ${data.step?.name ?? ''} (${data.step?.kind ?? ''})`, color: 'green' },
            ]);
          } catch {}
        });

        es.addEventListener('done', () => {
          setIsRunning(false);
          setActiveStage(14);
          es.close();
        });

        es.onerror = () => {
          setIsRunning(false);
          es.close();
        };
      }
    } catch {
      // Fallback simulated progress for interactive demo if backend lab stream is busy
      simulateProgress();
    }
  };

  const simulateProgress = () => {
    let cur = 5;
    const interval = setInterval(() => {
      cur += 1;
      if (cur <= 14) {
        setActiveStage(cur);
        setLogs((prev) => [
          ...prev,
          { text: `Stage ${cur}: ${STAGES[cur - 1].name} in progress...`, color: cur === 6 ? 'amber' : 'green' },
        ]);
      } else {
        clearInterval(interval);
        setIsRunning(false);
      }
    }, 1200);
  };

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
    };
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Header matching Reference */}
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight font-heading">
          Live Lab
        </h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          Run a live agent and watch Black Box investigate in real time
        </p>
      </div>

      {/* Prompt Input Box matching Reference */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask anything to the agent..."
            className="w-full bg-[#0c0d10] border border-white/[0.08] rounded-xl px-4 py-3 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 font-sans shadow-inner"
          />
        </div>
        <button
          onClick={handleStartLab}
          disabled={isRunning}
          className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-xs flex items-center justify-center transition-colors shadow-lg shadow-blue-900/30 cursor-pointer"
        >
          {isRunning ? <RotateCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
        </button>
      </div>

      {/* 14-Stage Horizontal Pipeline Rail matching Reference */}
      <div className="p-4 rounded-xl bg-[#0c0d10] border border-white/[0.06] overflow-x-auto">
        <div className="min-w-[840px] flex items-center justify-between relative py-2">
          {/* Connector Line behind stages */}
          <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-[1px] bg-zinc-800 -z-0" />

          {STAGES.map((s) => {
            const isActive = s.n === activeStage;
            const isCompleted = s.n < activeStage;

            return (
              <div
                key={s.n}
                onClick={() => setActiveStage(s.n)}
                className="relative z-10 flex flex-col items-center cursor-pointer group"
              >
                {/* Circle Number */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-mono font-bold transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/50 ring-4 ring-blue-500/20 scale-110'
                      : isCompleted
                      ? 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                      : 'bg-[#121316] text-zinc-500 border border-white/[0.06] group-hover:border-zinc-500'
                  }`}
                >
                  {s.n}
                </div>

                {/* Stage Name */}
                <div
                  className={`text-[10px] mt-2 font-medium tracking-tight whitespace-nowrap transition-colors ${
                    isActive
                      ? 'text-blue-400 font-bold'
                      : isCompleted
                      ? 'text-zinc-300'
                      : 'text-zinc-500'
                  }`}
                >
                  {s.name}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3 Bottom Cards Grid matching Reference Panel 4 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Live Execution */}
        <div className="p-4 rounded-xl bg-[#0c0d10] border border-white/[0.06] flex flex-col justify-between space-y-3 min-h-[220px]">
          <div className="text-xs font-bold text-white font-mono uppercase tracking-wider">
            Live Execution
          </div>

          <div className="space-y-2 font-mono text-[11px] text-zinc-300 flex-1">
            {logs.map((log, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 mt-1 ${
                    log.color === 'blue'
                      ? 'bg-blue-500 animate-pulse'
                      : log.color === 'amber'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                />
                <span className="leading-snug">{log.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Card 2: Current Stage */}
        <div className="p-4 rounded-xl bg-[#0c0d10] border border-white/[0.06] flex flex-col justify-between space-y-3 min-h-[220px]">
          <div>
            <div className="text-[10px] uppercase font-mono text-zinc-500 tracking-wider">
              Current Stage
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-6 h-6 rounded bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-mono font-bold text-xs text-blue-400">
                {activeStage.toString().padStart(2, '0')}
              </span>
              <span className="text-sm font-bold text-white font-heading">
                {STAGES[activeStage - 1]?.name || 'Choose Mistake'}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Selecting a mistake type to plant in this run.
            </p>
          </div>

          {/* Selectable Mistake Chips matching Reference */}
          <div className="flex flex-wrap gap-1.5 pt-2">
            {MISTAKE_OPTIONS.map((opt) => {
              const isSelected = opt === selectedMistake;
              return (
                <button
                  key={opt}
                  onClick={() => setSelectedMistake(opt)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-[#14161b] hover:bg-[#1b1e24] text-zinc-400 hover:text-zinc-200 border border-white/[0.06]'
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        {/* Card 3: Preview */}
        <div className="p-4 rounded-xl bg-[#0c0d10] border border-white/[0.06] flex flex-col justify-between space-y-3 min-h-[220px]">
          <div>
            <div className="text-[10px] uppercase font-mono text-zinc-500 tracking-wider">
              Preview
            </div>
            <p className="text-xs text-zinc-300 mt-2 leading-relaxed">
              A misleading search result will be injected into the next step to simulate a real failure scenario.
            </p>
          </div>

          <div className="pt-4">
            <button
              onClick={handleStartLab}
              className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30 transition-all cursor-pointer"
            >
              <span>Inject and Continue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
