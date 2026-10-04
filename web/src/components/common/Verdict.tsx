import React from 'react';
import { motion } from 'motion/react';

export type VerdictType =
  | 'PROVED'
  | 'NOT THE CAUSE'
  | 'BAD LUCK'
  | 'APPROVE'
  | 'BLOCK'
  | 'NO EFFECT'
  | 'PASS'
  | 'FAIL'
  | string;

interface VerdictProps {
  verdict: VerdictType;
  step?: number | string;
  stars?: number; // 0 to 5
  detail?: string;
  className?: string;
}

export const Verdict: React.FC<VerdictProps> = ({
  verdict,
  step,
  stars,
  detail,
  className = '',
}) => {
  const norm = verdict.toUpperCase().trim();

  let colorClasses = 'border-[var(--line-strong)] bg-[var(--raised)] text-[var(--text)]';
  let dotColor = 'bg-[var(--faint)]';

  if (norm.includes('APPROVE') || norm.includes('PROVED') || norm.includes('PASS') || norm.includes('FIXED')) {
    colorClasses = 'border-[var(--ok)]/40 bg-[var(--ok-bg)] text-[var(--ok)]';
    dotColor = 'bg-[var(--ok)]';
  } else if (norm.includes('BLOCK') || norm.includes('FAIL') || norm.includes('GUILTY')) {
    colorClasses = 'border-[var(--guilty)]/40 bg-[var(--guilty-bg)] text-[var(--guilty)]';
    dotColor = 'bg-[var(--guilty)]';
  } else if (norm.includes('NOT THE CAUSE') || norm.includes('NO EFFECT') || norm.includes('BAD LUCK')) {
    colorClasses = 'border-[var(--line-strong)] bg-[var(--panel)] text-[var(--muted)]';
    dotColor = 'bg-[var(--faint)]';
  }

  // Render stars if provided
  const renderStars = (rating: number) => {
    const full = Math.min(5, Math.max(0, Math.round(rating)));
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  };

  return (
    <motion.div
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className={`border rounded-[var(--radius)] p-4 select-none ${colorClasses} ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
          <div className="font-mono text-base font-bold tracking-wider uppercase">
            {norm}
            {step !== undefined && (
              <span className="ml-2 font-normal text-sm opacity-90 lowercase font-sans">
                step <span className="font-mono font-bold uppercase">{step}</span>
              </span>
            )}
          </div>
        </div>

        {stars !== undefined && (
          <div className="font-mono text-sm tracking-widest text-[var(--text-strong)]">
            {renderStars(stars)}
          </div>
        )}
      </div>

      {detail && (
        <div className="mt-2 text-xs font-sans text-[var(--text)] opacity-90 pl-4 border-l border-current/20">
          {detail}
        </div>
      )}
    </motion.div>
  );
};
