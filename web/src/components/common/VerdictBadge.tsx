import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, ShieldAlert, MinusCircle, HelpCircle } from 'lucide-react';

interface VerdictBadgeProps {
  verdict: string | undefined | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const VerdictBadge: React.FC<VerdictBadgeProps> = ({ verdict, size = 'md', className = '' }) => {
  if (!verdict) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 ${className}`}>
        <HelpCircle className="w-3.5 h-3.5 text-zinc-500" />
        NO VERDICT
      </span>
    );
  }

  const v = verdict.toUpperCase().trim();

  let styles = 'bg-zinc-800 text-zinc-300 border-zinc-700';
  let Icon = HelpCircle;

  if (v.includes('APPROVE') || v.includes('VERIFIED') || v === 'PASS' || v === 'ROBUST' || v === 'FIXED') {
    styles = 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-950/50';
    Icon = v.includes('APPROVE') || v === 'ROBUST' ? ShieldCheck : CheckCircle2;
  } else if (v.includes('BLOCK') || v === 'FAIL' || v.includes('NOT THE CAUSE') || v === 'UNSAFE' || v === 'REGRESSION') {
    styles = 'bg-rose-950/70 text-rose-300 border-rose-500/40 shadow-sm shadow-rose-950/50';
    Icon = v.includes('BLOCK') || v === 'UNSAFE' ? ShieldAlert : XCircle;
  } else if (v.includes('FLAKY') || v.includes('FAILED SAFELY') || v.includes('HELD') || v.includes('SILENTLY')) {
    styles = 'bg-amber-950/70 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-950/50';
    Icon = AlertTriangle;
  } else if (v.includes('NO EFFECT') || v.includes('STILL FAILING')) {
    styles = 'bg-zinc-800/80 text-zinc-400 border-zinc-700/60';
    Icon = MinusCircle;
  }

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-4 py-2 text-sm font-semibold tracking-wide',
  }[size];

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  }[size];

  return (
    <span className={`inline-flex items-center gap-1.5 font-mono font-medium rounded-md border tracking-tight ${sizeClasses} ${styles} ${className}`}>
      <Icon className={iconSizes} />
      <span>{verdict}</span>
    </span>
  );
};
