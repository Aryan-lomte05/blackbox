import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  RotateCw,
  Terminal,
  Activity,
  Layers,
  Shield,
  FileCheck,
} from 'lucide-react';

export interface StreamLogRow {
  id?: string | number;
  timestamp?: number | string; // seconds from start or string like "+0.8s"
  kind?: string; // stage, step, attempt, result, verdict, checker, error, done
  text: string;
  data?: any;
}

interface StreamLogProps {
  rows: StreamLogRow[];
  streaming?: boolean;
  className?: string;
  maxHeight?: string;
  emptyMessage?: string;
}

export const StreamLog: React.FC<StreamLogProps> = ({
  rows,
  streaming = false,
  className = '',
  maxHeight = '360px',
  emptyMessage = 'Awaiting stream events...',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  // Detect user scroll
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 32;
    setUserScrolledUp(!isAtBottom);
  };

  // Auto-scroll when new rows arrive, unless user scrolled up
  useEffect(() => {
    if (!userScrolledUp && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [rows.length, userScrolledUp]);

  const getEventIcon = (kind?: string) => {
    switch (kind?.toLowerCase()) {
      case 'verdict':
      case 'result':
        return <CheckCircle2 className="w-3.5 h-3.5 text-[var(--ok)] shrink-0" />;
      case 'error':
        return <XCircle className="w-3.5 h-3.5 text-[var(--guilty)] shrink-0" />;
      case 'stage':
        return <Layers className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />;
      case 'attempt':
      case 'run':
        return <RotateCw className="w-3.5 h-3.5 text-[var(--info)] shrink-0" />;
      case 'rule':
      case 'checker':
        return <Shield className="w-3.5 h-3.5 text-[var(--trail)] shrink-0" />;
      case 'step':
        return <Activity className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />;
      default:
        return <Terminal className="w-3.5 h-3.5 text-[var(--faint)] shrink-0" />;
    }
  };

  const formatTimestamp = (ts?: number | string) => {
    if (ts === undefined || ts === null) return '';
    if (typeof ts === 'string') {
      return ts.startsWith('+') ? ts : `+${ts}`;
    }
    return `+${ts.toFixed(1)}s`;
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      data-lenis-prevent
      style={{ maxHeight }}
      className={`overflow-y-auto font-mono text-xs border border-[var(--line)] rounded-[var(--radius)] bg-[var(--panel)] p-3 space-y-1.5 ${className}`}
    >
      {rows.length === 0 ? (
        <div className="py-6 text-center text-[var(--faint)] font-sans text-xs">
          {emptyMessage}
        </div>
      ) : (
        <AnimatePresence initial={false}>
          {rows.map((row, idx) => {
            const rowKey = row.id ?? idx;
            return (
              <motion.div
                key={rowKey}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-start gap-2.5 py-1 px-1.5 rounded hover:bg-[var(--raised)]/50 transition-colors"
              >
                {/* Timestamp */}
                <span className="text-[11px] text-[var(--faint)] select-none shrink-0 w-14 text-right tabular-nums">
                  {formatTimestamp(row.timestamp)}
                </span>

                {/* Event Icon */}
                <div className="mt-0.5">{getEventIcon(row.kind)}</div>

                {/* Event Kind Tag if present */}
                {row.kind && (
                  <span className="text-[10px] uppercase font-bold text-[var(--faint)] bg-[var(--raised)] px-1 py-0.2 rounded border border-[var(--line)] shrink-0 select-none">
                    {row.kind}
                  </span>
                )}

                {/* Text Content */}
                <span className="text-[var(--text)] leading-relaxed break-all select-text font-sans">
                  {row.text}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      )}

      {streaming && (
        <div className="flex items-center gap-2 py-1 px-2 text-[var(--faint)] text-[11px]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
          <span>Stream active...</span>
        </div>
      )}
    </div>
  );
};
