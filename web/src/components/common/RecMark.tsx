import React from 'react';

interface RecMarkProps {
  streaming?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export const RecMark: React.FC<RecMarkProps> = ({
  streaming = false,
  className = '',
  size = 'md',
}) => {
  return (
    <div className={`inline-flex items-center gap-2 select-none ${className}`}>
      <span
        className={`rounded-full shrink-0 ${
          size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2'
        } ${
          streaming
            ? 'bg-[var(--rec)] animate-rec-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]'
            : 'bg-[var(--rec)]'
        }`}
        aria-hidden="true"
      />
      <span
        className={`font-mono font-semibold tracking-[0.16em] uppercase text-[var(--text-strong)] ${
          size === 'sm' ? 'text-[10px]' : 'text-[11px]'
        }`}
      >
        BLACK BOX
      </span>
      {streaming && (
        <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-[var(--rec)] px-1 py-0.5 rounded bg-[var(--guilty-bg)] border border-[var(--guilty)]/30">
          REC
        </span>
      )}
    </div>
  );
};
