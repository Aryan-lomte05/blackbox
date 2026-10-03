import React from 'react';

interface MonoLabelProps {
  index?: string | number;
  label?: string;
  children?: React.ReactNode;
  className?: string;
}

export const MonoLabel: React.FC<MonoLabelProps> = ({
  index,
  label,
  children,
  className = '',
}) => {
  const formattedIndex =
    typeof index === 'number'
      ? index.toString().padStart(2, '0')
      : index;

  return (
    <div
      className={`font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--faint)] select-none inline-flex items-center gap-1.5 ${className}`}
    >
      {formattedIndex && (
        <>
          <span className="text-[var(--muted)]">{formattedIndex}</span>
          <span className="text-[var(--ghost)]">·</span>
        </>
      )}
      <span>{label || children}</span>
    </div>
  );
};
