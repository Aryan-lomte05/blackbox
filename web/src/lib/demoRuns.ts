import { useQuery } from '@tanstack/react-query';
import { api } from './api';

/** Real runs to open a screen on, from the API's showcase (GET /api/cases). Never typed into the code:
 *  run ids differ on every machine. Undefined while loading or when the store has no cases. */
export interface DemoRuns {
  failed?: string;
  passing?: string;
  compare?: { a: string; b: string };
}

export function useDemoRuns(): DemoRuns {
  const { data } = useQuery<any>({
    queryKey: ['demo-cases'],
    queryFn: () => api.get<any>('/api/cases'),
    staleTime: 5 * 60_000,
  });
  const cases: Record<string, { run_id: string }> = data?.cases || {};
  const failed = (cases.model_finds_it || Object.values(cases)[0])?.run_id;
  return {
    failed,
    passing: data?.passing_run?.run_id,
    compare: data?.compare?.a && data?.compare?.b ? { a: data.compare.a, b: data.compare.b } : undefined,
  };
}
