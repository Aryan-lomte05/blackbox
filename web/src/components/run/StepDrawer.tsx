import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../lib/api';
import { X, Copy, Check, Terminal, Database, ShieldAlert, Cpu, ArrowLeft, ArrowRight } from 'lucide-react';

interface StepDrawerProps {
  runId: string;
  stepIdx: number | null;
  onClose: () => void;
  onSelectStep?: (idx: number) => void;
}

export const StepDrawer: React.FC<StepDrawerProps> = ({ runId, stepIdx, onClose, onSelectStep }) => {
  const [activeTab, setActiveTab] = useState<'output' | 'request' | 'memory' | 'checker'>('output');
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
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 240 }}
        className="fixed inset-y-0 right-0 w-full max-w-xl bg-[#0c0d10] border-l border-white/[0.08] shadow-2xl z-50 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center font-mono font-bold text-sm text-white">
              #{stepIdx}
            </span>
            <div>
              <div className="font-heading font-bold text-base text-white flex items-center gap-2">
                <span>{step?.name || `Step #${stepIdx}`}</span>
                {step?.kind && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.06] text-zinc-300 border border-white/[0.08] uppercase">
                    {step.kind}
                  </span>
                )}
              </div>
              <div className="text-xs text-zinc-400 font-sans mt-0.5">Node: <span className="font-mono text-zinc-300">{step?.node || 'execution'}</span></div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onSelectStep && (
              <div className="flex items-center gap-1 mr-2">
                <button
                  disabled={stepIdx <= 0}
                  onClick={() => onSelectStep(stepIdx - 1)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onSelectStep(stepIdx + 1)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/[0.08] bg-black/40 px-3">
          {[
            { id: 'output', label: 'Output Response', icon: Terminal },
            { id: 'request', label: 'Request Input', icon: Cpu },
            { id: 'memory', label: 'State & Memory', icon: Database },
            { id: 'checker', label: 'Checker Answers', icon: ShieldAlert },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-sans font-medium border-b-2 transition-all cursor-pointer ${
                  isActive
                    ? 'border-rose-500 text-white font-semibold'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-rose-400' : 'text-zinc-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs font-sans">
          {isLoading && (
            <div className="p-16 text-center text-zinc-500">
              <span className="animate-pulse">Loading step #{stepIdx} save-point snapshot...</span>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs">
              Failed to load step details: {(error as any)?.detail || error.message}
            </div>
          )}

          {step && !isLoading && (
            <>
              {/* TAB 1: OUTPUT */}
              {activeTab === 'output' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Output Delivered</span>
                    <button
                      onClick={() => handleCopy(step.output)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs text-zinc-300 transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy Output'}</span>
                    </button>
                  </div>

                  <div className="p-4 rounded-2xl bg-zinc-950 border border-white/[0.08] text-zinc-200 font-mono text-xs overflow-x-auto whitespace-pre-wrap break-all leading-relaxed shadow-inner">
                    {typeof step.output === 'object'
                      ? JSON.stringify(step.output, null, 2)
                      : String(step.output || '(No output recorded)')}
                  </div>

                  {step.error && (
                    <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-200 space-y-1">
                      <span className="font-bold block">Execution Error:</span>
                      <div className="font-mono text-[11px]">{step.error}</div>
                    </div>
                  )}

                  {step.meta?.fork_change && (
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-1">
                      <span className="font-bold block">Planted Mutation Applied:</span>
                      <div className="text-xs">{step.meta.fork_change.note}</div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: REQUEST */}
              {activeTab === 'request' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Arguments & Inputs</span>
                    <button
                      onClick={() => handleCopy(step.request)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs text-zinc-300 transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                  <div className="p-4 rounded-2xl bg-zinc-950 border border-white/[0.08] text-zinc-200 font-mono text-xs overflow-x-auto whitespace-pre-wrap break-all leading-relaxed shadow-inner">
                    {step.request ? JSON.stringify(step.request, null, 2) : '(No request parameters)'}
                  </div>

                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2 text-xs">
                    <div className="text-zinc-300 flex justify-between">
                      <span className="text-zinc-500">State variables read:</span>
                      <span className="font-mono text-zinc-200">{step.reads?.join(', ') || 'none'}</span>
                    </div>
                    <div className="text-zinc-300 flex justify-between">
                      <span className="text-zinc-500">State variables written:</span>
                      <span className="font-mono text-zinc-200">{step.writes?.join(', ') || 'none'}</span>
                    </div>
                    <div className="text-zinc-300 flex justify-between">
                      <span className="text-zinc-500">Parent step dependencies:</span>
                      <span className="font-mono text-zinc-200">{step.parents?.join(', ') || 'none'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: MEMORY & STATE */}
              {activeTab === 'memory' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Save-point State Snapshot</span>
                    <button
                      onClick={() => handleCopy(stateAfter)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs text-zinc-300 transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                  {step.state_diff && (
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                      <span className="text-[11px] uppercase font-bold text-amber-300 block">State Mutations (Diff)</span>
                      <pre className="text-xs font-mono text-amber-100 overflow-x-auto">
                        {JSON.stringify(step.state_diff, null, 2)}
                      </pre>
                    </div>
                  )}

                  <div className="p-4 rounded-2xl bg-zinc-950 border border-white/[0.08] text-zinc-200 font-mono text-xs overflow-x-auto whitespace-pre-wrap break-all leading-relaxed shadow-inner">
                    {stateAfter ? JSON.stringify(stateAfter, null, 2) : '(No memory recorded)'}
                  </div>
                </div>
              )}

              {/* TAB 4: CHECKER TELEMETRY */}
              {activeTab === 'checker' && (
                <div className="space-y-4">
                  <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block">
                    Live Step Checker (Laya / Jev)
                  </span>

                  {step.monitor ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-4 rounded-2xl bg-zinc-950 border border-white/[0.08]">
                          <span className="text-zinc-500 text-[10px] uppercase font-semibold block">On Track Score</span>
                          <span className="text-emerald-400 font-heading font-bold text-2xl">
                            {((step.monitor.on_track?.prob ?? 0) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="p-4 rounded-2xl bg-zinc-950 border border-white/[0.08]">
                          <span className="text-zinc-500 text-[10px] uppercase font-semibold block">Consistency</span>
                          <span className="text-zinc-200 font-heading font-bold text-2xl">
                            {((step.monitor.consistent?.prob ?? 0) * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-zinc-950 border border-white/[0.08] space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Checker Cascade Tier:</span>
                          <span className="font-mono text-white font-bold uppercase">{step.monitor.tier || 'laya'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Checker Latency:</span>
                          <span className="font-mono text-zinc-300">{step.monitor.latency_ms?.toFixed(1)}ms</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Alarm Status:</span>
                          <span className={`font-bold ${step.monitor.alarm ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {step.monitor.alarm ? 'ALARM TRIGGERED' : 'CLEAR'}
                          </span>
                        </div>
                      </div>

                      {step.monitor.answers?.mistake_type && (
                        <div className="p-4 rounded-2xl bg-zinc-950 border border-white/[0.08]">
                          <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Mistake Classifier Prediction</span>
                          <div className="font-bold text-amber-300 text-sm">
                            {step.monitor.answers.mistake_type.choice}
                          </div>
                          <div className="text-zinc-400 text-xs mt-1">
                            Confidence: {((step.monitor.answers.mistake_type.confidence ?? 0) * 100).toFixed(1)}%
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-12 text-center text-zinc-500 bg-zinc-950/40 rounded-2xl border border-white/[0.06]">
                      No checker telemetry answers recorded for this step.
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
