import React from 'react';
import { motion } from 'framer-motion';

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
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className={`p-5 rounded-2xl border transition-all relative overflow-hidden ${
        highlight
          ? 'bg-gradient-to-b from-rose-950/30 via-zinc-900/60 to-zinc-950 border-rose-500/30 shadow-lg shadow-rose-950/30'
          : 'bg-zinc-900/40 hover:bg-zinc-900/70 border-white/[0.07] hover:border-white/[0.12] backdrop-blur-xl'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-[11px] font-sans font-semibold uppercase tracking-wider text-zinc-400">
          {label}
        </span>
        {icon && (
          <div className={`p-1.5 rounded-lg ${highlight ? 'bg-rose-500/10 text-rose-400' : 'bg-white/[0.04] text-zinc-400'}`}>
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2.5">
        <span className="text-3xl font-heading font-extrabold text-white tracking-tight">
          {displayValue}
        </span>
      </div>

      {secondary && (
        <div className={`mt-2 text-xs font-sans font-medium flex items-center gap-1.5 ${
          trend === 'up'
            ? 'text-emerald-400'
            : trend === 'down'
            ? 'text-rose-400'
            : 'text-zinc-400'
        }`}>
          <span>{secondary}</span>
        </div>
      )}
    </motion.div>
  );
};
