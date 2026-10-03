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
    const es = api.createEventSource(path);
    esRef.current = es;

    const eventTypes = [
      'stage',
      'step',
      'checker',
      'attempt',
      'result',
      'verdict',
      'sufficiency',
      'rule',
      'run',
      'test',
      'incident',
      'done',
      'error',
    ];

    eventTypes.forEach((type) => {
      es.addEventListener(type, (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          setEvents((prev) => [...prev, { type, data: parsed, timestamp: Date.now() }]);

          if (type === 'done') {
            setIsStreaming(false);
            setIsDone(true);
            es.close();
          } else if (type === 'error') {
            setIsStreaming(false);
            setError(parsed.detail || parsed.message || 'Stream error occurred');
            es.close();
          }
        } catch {
          setEvents((prev) => [...prev, { type, data: e.data, timestamp: Date.now() }]);
        }
      });
    });

    es.onerror = () => {
      setIsStreaming(false);
      es.close();
    };

    return () => {
      es.close();
    };
  }, [jobId]);

  return { events, isStreaming, isDone, error };
}
