import React from 'react';
import { Terminal, ArrowRight, Database } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  command?: string;
  endpoint?: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  command,
  endpoint,
  actionText,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`panel p-8 text-center flex flex-col items-center justify-center max-w-lg mx-auto select-none ${className}`}
    >
      <div className="w-10 h-10 rounded-full bg-[var(--raised)] border border-[var(--line-strong)] flex items-center justify-center text-[var(--faint)] mb-4">
        <Database className="w-5 h-5" />
      </div>

      <h3 className="text-base font-semibold text-[var(--text-strong)] font-sans mb-1.5">
        {title}
      </h3>

      <p className="text-xs text-[var(--muted)] font-sans max-w-md mb-5 leading-relaxed">
        {description}
      </p>

      {(command || endpoint) && (
        <div className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-[var(--radius-sm)] p-3 text-left mb-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--faint)] mb-1 flex items-center gap-1.5">
            <Terminal className="w-3 h-3" />
            <span>To populate this view:</span>
          </div>

          {command && (
            <div className="font-mono text-xs text-[var(--accent)] select-all break-all">
              $ {command}
            </div>
          )}

          {endpoint && (
            <div className="font-mono text-[11px] text-[var(--muted)] select-all break-all mt-1">
              Endpoint: {endpoint}
            </div>
          )}
        </div>
      )}

      {actionText && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--line-strong)] bg-[var(--raised)] text-xs text-[var(--text-strong)] hover:border-[var(--accent)] transition-colors cursor-pointer"
        >
          <span>{actionText}</span>
          <ArrowRight className="w-3.5 h-3.5 text-[var(--accent)]" />
        </button>
      )}
    </div>
  );
};
