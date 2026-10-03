import React from 'react';
import { MonoLabel } from './MonoLabel';

export interface KPIProps {
  label: string;
  value: string | number | undefined | null;
  context?: string;
  secondary?: string; // backwards compatibility
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
  highlight?: boolean;
  variant?: 'default' | 'guilty' | 'ok' | 'trail' | 'accent';
  className?: string;
}

export const KPI: React.FC<KPIProps> = ({
  label,
  value,
  context,
  secondary,
  unit,
  trend,
  icon,
  highlight = false,
  variant = 'default',
  className = '',
}) => {
  const displayValue = value === undefined || value === null ? '—' : value;
  const detailText = context || secondary;

  let valueColor = 'text-[var(--text-strong)]';
  if (variant === 'guilty' || highlight) valueColor = 'text-[var(--guilty)]';
  else if (variant === 'ok') valueColor = 'text-[var(--ok)]';
  else if (variant === 'trail') valueColor = 'text-[var(--trail)]';
  else if (variant === 'accent') valueColor = 'text-[var(--accent)]';

  let detailColor = 'text-[var(--muted)]';
  if (trend === 'up') detailColor = 'text-[var(--ok)]';
  else if (trend === 'down') detailColor = 'text-[var(--guilty)]';

  return (
    <div
      className={`panel p-4 flex flex-col justify-between select-none ${
        highlight ? 'border-[var(--guilty)]/30 bg-[var(--guilty-bg)]/20' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <MonoLabel label={label} />
        {icon && <div className="text-[var(--faint)] shrink-0">{icon}</div>}
      </div>

      <div className="flex items-baseline gap-1.5 my-1">
        <span
          className={`font-mono text-2xl lg:text-3xl font-semibold tracking-tight tabular-nums ${valueColor}`}
        >
          {displayValue}
        </span>
        {unit && (
          <span className="font-mono text-xs text-[var(--muted)]">
            {unit}
          </span>
        )}
      </div>

      {detailText && (
        <div className={`mt-1 text-xs font-sans truncate ${detailColor}`}>
          {detailText}
        </div>
      )}
    </div>
  );
};
