import React from 'react';

export type StepChipVariant = 'default' | 'guilty' | 'trail' | 'suspect' | 'reused';

interface StepChipProps {
  step: number | string;
  variant?: StepChipVariant;
  suspectRank?: number;
  className?: string;
  onClick?: () => void;
}

export const StepChip: React.FC<StepChipProps> = ({
  step,
  variant = 'default',
  suspectRank,
  className = '',
  onClick,
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'guilty':
        return 'bg-[var(--guilty-bg)] text-[var(--guilty)] border-[var(--guilty)]/40 font-semibold';
      case 'trail':
        return 'bg-[var(--trail-bg)] text-[var(--trail)] border-[var(--trail)]/40';
      case 'suspect':
        return 'bg-[var(--trail-bg)] text-[var(--trail)] border-[var(--trail)]/40';
      case 'reused':
        return 'bg-[var(--panel)] text-[var(--info)] border-[var(--line-strong)] ring-1 ring-[var(--info)]';
      case 'default':
      default:
        return 'bg-[var(--raised)] text-[var(--text)] border-[var(--line)]';
    }
  };

  const Component = onClick ? 'button' : 'span';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 font-mono text-[11px] px-2 py-0.5 rounded-[var(--radius-sm)] border select-none transition-colors ${getVariantStyles()} ${
        onClick ? 'cursor-pointer hover:brightness-110 active:brightness-95' : ''
      } ${className}`}
    >
      <span>STEP {step}</span>
      {variant === 'suspect' && suspectRank !== undefined && (
        <span className="opacity-75 text-[10px]">#{suspectRank}</span>
      )}
    </Component>
  );
};
