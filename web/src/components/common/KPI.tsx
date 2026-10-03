import React from 'react';

interface KPIProps {
  label: string;
  value: string | number | undefined | null;
  secondary?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
  highlight?: boolean;
}

export const KPI: React.FC<KPIProps> = ({
  label,
  value,
  secondary,
  trend,
  icon,
  highlight = false,
}) => {
  const displayValue = value === undefined || value === null ? '—' : value;

  return (
    <div className={`p-4 rounded-xl border transition-all ${
      highlight
        ? 'bg-rose-950/20 border-rose-500/30 shadow-lg shadow-rose-950/20'
        : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700/80'
    }`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
          {label}
        </span>
        {icon && <div className="text-zinc-500">{icon}</div>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold font-mono text-zinc-100 tracking-tight">
          {displayValue}
        </span>
        {secondary && (
          <span className={`text-xs font-mono font-medium ${
            trend === 'up'
              ? 'text-emerald-400'
              : trend === 'down'
              ? 'text-rose-400'
              : 'text-zinc-500'
          }`}>
            {secondary}
          </span>
        )}
      </div>
    </div>
  );
};
