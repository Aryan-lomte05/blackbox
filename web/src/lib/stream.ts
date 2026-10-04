import { useState, useEffect, useRef } from 'react';
import { api } from './api';

export interface StreamEvent {
  type: string;
  data: any;
  timestamp: number;
}

export function useJobStream(jobId: string | null) {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!jobId) {
      setEvents([]);
      setIsStreaming(false);
      setIsDone(false);
      setError(null);
      return;
    }

    setIsStreaming(true);
    setIsDone(false);
    setError(null);
    setEvents([]);

    const path = `/api/jobs/${jobId}/events`;
    // Every event type the API sends (docs/API_FOR_UI.md). `done` is sent once, last, with the full result.
    const eventTypes = [
      'start', 'stage', 'step', 'checker', 'attempt', 'result', 'verdict', 'sufficiency', 'joint_search', 'pair',
      'plan', 'test', 'proposing', 'rule', 'fleet', 'run', 'advice', 'candidate', 'rejected', 'incident',
      'summary', 'done', 'error',
    ];
    const seen = new Set<number>();   // a reconnect replays the history: skip what we already have
    let finished = false;
    let retries = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      const es = api.createEventSource(path);
      esRef.current = es;
      eventTypes.forEach((type) => {
        es.addEventListener(type, (e: MessageEvent) => {
          let parsed: any;
          try {
            parsed = JSON.parse(e.data);
          } catch {
            parsed = e.data;
          }
          if (typeof parsed?.seq === 'number') {
            if (seen.has(parsed.seq)) return;
            seen.add(parsed.seq);
          }
          retries = 0;
          setEvents((prev) => [...prev, { type, data: parsed, timestamp: Date.now() }]);
          if (type === 'done') {
            finished = true;
            setIsStreaming(false);
            setIsDone(true);
            es.close();
          } else if (type === 'error') {
            finished = true;
            setIsStreaming(false);
            setError(parsed?.detail || parsed?.message || 'The job reported an error');
            es.close();
          }
        });
      });
      es.onerror = () => {
        // A long job can outlast one connection (busy server, sleep, proxy timeout): reconnect, never give up silently.
        es.close();
        if (finished) return;
        if (retries >= 20) {
          setIsStreaming(false);
          setError('Lost the connection to the job stream. The job keeps running on the server; reopen this page.');
          return;
        }
        retries += 1;
        retryTimer = setTimeout(connect, Math.min(1000 * retries, 5000));
      };
    };
    connect();

    return () => {
      finished = true;
      if (retryTimer) clearTimeout(retryTimer);
      esRef.current?.close();
    };
  }, [jobId]);

  return { events, isStreaming, isDone, error };
}
