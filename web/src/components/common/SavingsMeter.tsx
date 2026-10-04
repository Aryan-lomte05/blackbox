import React from 'react';
import { Zap } from 'lucide-react';

interface SavingsMeterProps {
  reranSteps?: number;
  totalSteps?: number;
  modelCalls?: number;
  tokensSaved?: number;
  rawText?: string;
  className?: string;
}

export const SavingsMeter: React.FC<SavingsMeterProps> = ({
  reranSteps = 1,
  totalSteps = 9,
  modelCalls = 0,
  tokensSaved = 1526,
  rawText,
  className = '',
}) => {
  const formatTokens = (num: number) => {
    return num.toLocaleString();
  };

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--info)]/20 bg-[var(--panel)] text-[var(--info)] font-mono text-xs select-none ${className}`}
    >
      <Zap className="w-3.5 h-3.5 shrink-0 opacity-80" />
      <span>
        {rawText || (
          <>
            re-ran {reranSteps} of {totalSteps} steps · {modelCalls} model calls ·{' '}
            <span className="font-semibold">{formatTokens(tokensSaved)}</span> tokens saved
          </>
        )}
      </span>
    </div>
  );
};
