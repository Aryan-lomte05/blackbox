import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../../lib/api';
import { X, Copy, Check, Terminal, Database, Cpu, ChevronRight, ChevronDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { MonoLabel } from '../common/MonoLabel';
import { StepChip } from '../common/StepChip';

interface StepDrawerProps {
  runId?: string;
  stepIdx: number | null;
  stepData?: any; // optional direct step data for dev/fixture mode
  onClose: () => void;
  onSelectStep?: (idx: number) => void;
}

export const StepDrawer: React.FC<StepDrawerProps> = ({
  runId,
  stepIdx,
  stepData: directStepData,
  onClose,
  onSelectStep,
}) => {
  const [activeTab, setActiveTab] = useState<'output' | 'request' | 'memory'>('output');
  const [copied, setCopied] = useState(false);

  const { data: fetchedData, isLoading, error } = useQuery({
    queryKey: ['step-detail', runId, stepIdx],
    queryFn: async () => {
      if (!runId || stepIdx === null) return null;
      return await api.get<any>(`/api/runs/${runId}/steps/${stepIdx}`);
    },
    enabled: !!runId && stepIdx !== null && !directStepData,
  });

  if (stepIdx === null && !directStepData) return null;

  const data = directStepData || fetchedData;
  const step = data?.step || data;
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
        transition={{ duration: 0.16 }}
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="fixed inset-y-0 right-0 w-full max-w-xl bg-[var(--panel)] border-l border-[var(--line)] shadow-2xl z-50 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-[var(--line)] flex items-center justify-between bg-[var(--bg)]">
          <div className="flex items-center gap-3">
            <StepChip step={step?.idx ?? stepIdx ?? 0} variant={step?.is_guilty ? 'guilty' : 'default'} />
            <div>
              <div className="font-mono text-sm font-semibold text-[var(--text-strong)] flex items-center gap-2">
                <span>{step?.name || `step_${stepIdx}`}</span>
                {step?.kind && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--raised)] text-[var(--muted)] border border-[var(--line)] uppercase">
                    {step.kind}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-[var(--faint)] font-sans">
                Node: <span className="font-mono text-[var(--text)]">{step?.node || 'execution'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onSelectStep && stepIdx !== null && (
              <div className="flex items-center gap-1 mr-2">
                <button
                  type="button"
                  disabled={stepIdx <= 0}
                  onClick={() => onSelectStep(stepIdx - 1)}
                  className="p-1 rounded text-[var(--faint)] hover:text-[var(--text)] hover:bg-[var(--raised)] disabled:opacity-20 cursor-pointer"
                  title="Previous step"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onSelectStep(stepIdx + 1)}
                  className="p-1 rounded text-[var(--faint)] hover:text-[var(--text)] hover:bg-[var(--raised)] cursor-pointer"
                  title="Next step"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded text-[var(--faint)] hover:text-[var(--text)] hover:bg-[var(--raised)] cursor-pointer"
              title="Close drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b border-[var(--line)] bg-[var(--bg)] px-3 text-xs">
          {[
            { id: 'output', label: 'Output', icon: Terminal },
            { id: 'request', label: 'Request', icon: Cpu },
            { id: 'memory', label: 'Memory After', icon: Database },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-2.5 font-sans text-xs border-b-2 transition-colors cursor-pointer ${
                  isActive
                    ? 'border-[var(--accent)] text-[var(--text-strong)] font-semibold'
                    : 'border-transparent text-[var(--faint)] hover:text-[var(--text)]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[var(--accent)]' : 'text-[var(--faint)]'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div data-lenis-prevent className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-sans">
          {isLoading && (
            <div className="p-12 text-center text-[var(--faint)] font-mono text-xs">
              Loading step snapshot...
            </div>
          )}

          {error && (
            <div className="p-3 rounded border border-[var(--guilty)]/40 bg-[var(--guilty-bg)] text-[var(--guilty)] text-xs">
              Failed to load step details: {(error as any)?.detail || (error as Error).message}
            </div>
          )}

          {step && !isLoading && (
            <>
              {/* Output Tab */}
              {activeTab === 'output' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <MonoLabel label="OUTPUT RESPONSE" />
                    <button
                      type="button"
                      onClick={() => handleCopy(step.output)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--raised)] text-[var(--text)] hover:text-[var(--text-strong)] hover:border-[var(--line-strong)] text-xs cursor-pointer font-mono"
                    >
                      {copied ? <Check className="w-3 h-3 text-[var(--ok)]" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? 'COPIED' : 'COPY'}</span>
                    </button>
                  </div>

                  <pre
                    data-lenis-prevent
                    className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] font-mono text-xs overflow-x-auto whitespace-pre-wrap break-all leading-relaxed"
                  >
                    {typeof step.output === 'object'
                      ? JSON.stringify(step.output, null, 2)
                      : String(step.output ?? '(No output recorded)')}
                  </pre>

                  {step.error && (
                    <div className="p-3 rounded-[var(--radius-sm)] border border-[var(--guilty)]/40 bg-[var(--guilty-bg)] text-[var(--guilty)]">
                      <div className="font-mono text-xs font-bold uppercase mb-1">Execution Error</div>
                      <div className="font-mono text-xs break-all">{step.error}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Request Tab */}
              {activeTab === 'request' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <MonoLabel label="INPUT ARGUMENTS" />
                    <button
                      type="button"
                      onClick={() => handleCopy(step.request)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--raised)] text-[var(--text)] hover:text-[var(--text-strong)] hover:border-[var(--line-strong)] text-xs cursor-pointer font-mono"
                    >
                      {copied ? <Check className="w-3 h-3 text-[var(--ok)]" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? 'COPIED' : 'COPY'}</span>
                    </button>
                  </div>

                  <pre
                    data-lenis-prevent
                    className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] font-mono text-xs overflow-x-auto whitespace-pre-wrap break-all leading-relaxed"
                  >
                    {step.request ? JSON.stringify(step.request, null, 2) : '(No request parameters)'}
                  </pre>

                  <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--line)] space-y-1.5 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-[var(--faint)]">reads:</span>
                      <span className="text-[var(--text)]">{step.reads?.join(', ') || 'none'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--faint)]">writes:</span>
                      <span className="text-[var(--text)]">{step.writes?.join(', ') || 'none'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--faint)]">parents:</span>
                      <span className="text-[var(--text)]">{step.parents?.join(', ') || 'none'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Memory Tab */}
              {activeTab === 'memory' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <MonoLabel label="STATE AFTER STEP" />
                    <button
                      type="button"
                      onClick={() => handleCopy(stateAfter || step.state_after)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--raised)] text-[var(--text)] hover:text-[var(--text-strong)] hover:border-[var(--line-strong)] text-xs cursor-pointer font-mono"
                    >
                      {copied ? <Check className="w-3 h-3 text-[var(--ok)]" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? 'COPIED' : 'COPY'}</span>
                    </button>
                  </div>

                  <pre
                    data-lenis-prevent
                    className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] font-mono text-xs overflow-x-auto whitespace-pre-wrap break-all leading-relaxed"
                  >
                    {JSON.stringify(stateAfter || step.state_after || {}, null, 2)}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
