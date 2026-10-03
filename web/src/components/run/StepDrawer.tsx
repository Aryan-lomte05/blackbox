import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { X, Copy, Check, Terminal, Database, ShieldAlert, Cpu } from 'lucide-react';

interface StepDrawerProps {
  runId: string;
  stepIdx: number | null;
  onClose: () => void;
}

export const StepDrawer: React.FC<StepDrawerProps> = ({ runId, stepIdx, onClose }) => {
  const [activeTab, setActiveTab] = useState<'request' | 'output' | 'memory' | 'checker'>('output');
  const [copied, setCopied] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['step-detail', runId, stepIdx],
    queryFn: async () => {
      if (stepIdx === null) return null;
      return await api.get<any>(`/api/runs/${runId}/steps/${stepIdx}`);
    },
    enabled: stepIdx !== null,
  });

  if (stepIdx === null) return null;

  const step = data?.step;
  const stateAfter = data?.state_after;

  const handleCopy = (content: any) => {
    const text = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[520px] bg-zinc-950 border-l border-zinc-800 shadow-2xl z-40 flex flex-col backdrop-blur-xl animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center font-mono font-bold text-xs text-white">
            #{stepIdx}
          </span>
          <div>
            <div className="font-mono font-bold text-sm text-zinc-100 flex items-center gap-2">
              <span>{step?.name || `Step #${stepIdx}`}</span>
              {step?.kind && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 uppercase font-mono">
                  {step.kind}
                </span>
              )}
            </div>
            <div className="text-[11px] font-mono text-zinc-400">Node: {step?.node || 'execution'}</div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 bg-zinc-950/80 px-2">
        {[
          { id: 'output', label: 'Output', icon: Terminal },
          { id: 'request', label: 'Request', icon: Cpu },
          { id: 'memory', label: 'Memory / State', icon: Database },
          { id: 'checker', label: 'Checker Answers', icon: ShieldAlert },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-mono border-b-2 transition-all cursor-pointer ${
                isActive
                  ? 'border-rose-500 text-rose-300 font-bold bg-zinc-900/40'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs">
        {isLoading && (
          <div className="p-8 text-center text-zinc-500">
            <span className="animate-pulse">Loading step #{stepIdx} save-point...</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs">
            Failed to load step details: {(error as any)?.detail || error.message}
          </div>
        )}

        {step && !isLoading && (
          <>
            {/* TAB: OUTPUT */}
            {activeTab === 'output' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 text-[11px] uppercase tracking-wider">Step Execution Output</span>
                  <button
                    onClick={() => handleCopy(step.output)}
                    className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <div className="p-3.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                  {typeof step.output === 'object'
                    ? JSON.stringify(step.output, null, 2)
                    : String(step.output || '(No output)')}
                </div>

                {step.error && (
                  <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-500 text-rose-200">
                    <span className="font-bold block mb-1">Step Error:</span>
                    <span>{step.error}</span>
                  </div>
                )}

                {step.meta?.fork_change && (
                  <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-500/40 text-amber-200">
                    <span className="font-bold block mb-1">Planted Mutation:</span>
                    <div>{step.meta.fork_change.note}</div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: REQUEST */}
            {activeTab === 'request' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 text-[11px] uppercase tracking-wider">Request Inputs & Arguments</span>
                  <button
                    onClick={() => handleCopy(step.request)}
                    className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <div className="p-3.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                  {step.request ? JSON.stringify(step.request, null, 2) : '(No request payload)'}
                </div>

                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1.5 text-[11px]">
                  <div className="text-zinc-400">
                    <span className="text-zinc-500">Reads:</span> {step.reads?.join(', ') || 'none'}
                  </div>
                  <div className="text-zinc-400">
                    <span className="text-zinc-500">Writes:</span> {step.writes?.join(', ') || 'none'}
                  </div>
                  <div className="text-zinc-400">
                    <span className="text-zinc-500">Parents:</span> {step.parents?.join(', ') || 'none'}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: MEMORY / STATE */}
            {activeTab === 'memory' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 text-[11px] uppercase tracking-wider">Save-point State After Step</span>
                  <button
                    onClick={() => handleCopy(stateAfter)}
                    className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                {step.state_diff && (
                  <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2">
                    <span className="text-[10px] uppercase font-bold text-amber-400 block">State Mutations (Diff)</span>
                    <pre className="text-[11px] text-zinc-300 overflow-x-auto">
                      {JSON.stringify(step.state_diff, null, 2)}
                    </pre>
                  </div>
                )}

                <div className="p-3.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                  {stateAfter ? JSON.stringify(stateAfter, null, 2) : '(No state recorded)'}
                </div>
              </div>
            )}

            {/* TAB: CHECKER ANSWERS */}
            {activeTab === 'checker' && (
              <div className="space-y-4">
                <span className="text-zinc-400 text-[11px] uppercase tracking-wider block">
                  Live Step Checker Telemetry (Laya / Jev)
                </span>

                {step.monitor ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded bg-zinc-900 border border-zinc-800">
                        <span className="text-zinc-500 text-[10px] block">ON TRACK CONFIDENCE</span>
                        <span className="text-emerald-400 font-bold text-base">
                          {((step.monitor.on_track?.prob ?? 0) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="p-3 rounded bg-zinc-900 border border-zinc-800">
                        <span className="text-zinc-500 text-[10px] block">CONSISTENCY</span>
                        <span className="text-zinc-200 font-bold text-base">
                          {((step.monitor.consistent?.prob ?? 0) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded bg-zinc-900 border border-zinc-800 space-y-1">
                      <div className="flex justify-between text-zinc-400">
                        <span>Checker Tier:</span>
                        <span className="text-zinc-200 uppercase">{step.monitor.tier || 'laya'}</span>
                      </div>
                      <div className="flex justify-between text-zinc-400">
                        <span>Latency:</span>
                        <span className="text-zinc-200">{step.monitor.latency_ms?.toFixed(1)}ms</span>
                      </div>
                      <div className="flex justify-between text-zinc-400">
                        <span>Alarm Triggered:</span>
                        <span className={step.monitor.alarm ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                          {step.monitor.alarm ? 'ALARM ACTIVE' : 'NO ALARM'}
                        </span>
                      </div>
                    </div>

                    {step.monitor.answers?.mistake_type && (
                      <div className="p-3 rounded bg-zinc-900 border border-zinc-800">
                        <span className="text-[10px] uppercase text-zinc-500 block mb-1">Mistake Classifier Choice</span>
                        <span className="font-bold text-amber-300">
                          {step.monitor.answers.mistake_type.choice}
                        </span>
                        <div className="text-[10px] text-zinc-400 mt-1">
                          Confidence: {((step.monitor.answers.mistake_type.confidence ?? 0) * 100).toFixed(1)}%
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center text-zinc-500 bg-zinc-900/30 rounded-lg border border-zinc-800">
                    No step checker answers recorded for this step.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
