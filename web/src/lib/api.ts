const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const USE_FIXTURES = import.meta.env.VITE_USE_FIXTURES === '1';

// Custom API Error with human readable detail from backend
export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `Request failed with status ${res.status}`;
    try {
      const errorJson = await res.json();
      if (errorJson && typeof errorJson.detail === 'string') {
        detail = errorJson.detail;
      } else if (errorJson && typeof errorJson.detail === 'object') {
        detail = JSON.stringify(errorJson.detail);
      }
    } catch {
      // Not JSON
      const text = await res.text().catch(() => '');
      if (text) detail = text;
    }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  baseUrl: BASE_URL,
  useFixtures: USE_FIXTURES,

  async get<T>(path: string): Promise<T> {
    if (USE_FIXTURES) {
      return this.getFixture<T>(path);
    }
    const url = `${BASE_URL}${path}`;
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
      });
      return await handleResponse<T>(res);
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(0, `Cannot connect to Black Box backend at ${BASE_URL}. Ensure 'blackbox ui' is running.`);
    }
  },

  async post<T>(path: string, body?: any): Promise<T> {
    if (USE_FIXTURES) {
      return this.getFixture<T>(path);
    }
    const url = `${BASE_URL}${path}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      return await handleResponse<T>(res);
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(0, `Cannot connect to Black Box backend at ${BASE_URL}. Ensure 'blackbox ui' is running.`);
    }
  },

  // Fixture loader for opt-in mode (VITE_USE_FIXTURES=1)
  async getFixture<T>(path: string): Promise<T> {
    const cleanPath = path.split('?')[0];
    if (cleanPath.startsWith('/api/investigate')) {
      const mod = await import('../../../fixtures/ui/investigate_model_finds_it.json');
      return mod.default as unknown as T;
    }
    if (cleanPath === '/api/ui/overview') {
      const mod = await import('../../../fixtures/ui/overview.json');
      return mod.default as unknown as T;
    }
    if (cleanPath.includes('/graph')) {
      const mod = await import('../../../fixtures/ui/run_graph.json');
      return mod.default as unknown as T;
    }
    if (cleanPath.includes('/steps/')) {
      const mod = await import('../../../fixtures/ui/run_step_0.json');
      return mod.default as unknown as T;
    }
    if (cleanPath.includes('/causal')) {
      const mod = await import('../../../fixtures/ui/causal_job.json');
      return mod.default as unknown as T;
    }
    if (cleanPath.includes('/fleet-fix') || cleanPath.includes('/time-machine')) {
      const mod = await import('../../../fixtures/ui/fleet_fix_job.json');
      return mod.default as unknown as T;
    }
    if (cleanPath.includes('/crash-test')) {
      const mod = await import('../../../fixtures/ui/crash_test_job.json');
      return mod.default as unknown as T;
    }
    if (cleanPath.includes('/similar')) {
      const mod = await import('../../../fixtures/ui/similar.json');
      return mod.default as unknown as T;
    }
    if (cleanPath === '/api/incidents') {
      const mod = await import('../../../fixtures/ui/incidents.json');
      return mod.default as unknown as T;
    }
    if (cleanPath.startsWith('/api/incidents/')) {
      const mod = await import('../../../fixtures/ui/incident_detail.json');
      return mod.default as unknown as T;
    }
    if (cleanPath === '/api/atlas') {
      const mod = await import('../../../fixtures/ui/atlas.json');
      return mod.default as unknown as T;
    }
    if (cleanPath === '/api/dataset') {
      const mod = await import('../../../fixtures/ui/dataset.json');
      return mod.default as unknown as T;
    }
    if (cleanPath === '/api/status') {
      const mod = await import('../../../fixtures/ui/status.json');
      return mod.default as unknown as T;
    }
    if (cleanPath === '/api/runs' || cleanPath.startsWith('/api/runs?')) {
      const mod = await import('../../../fixtures/ui/runs_failed_labelled.json');
      return mod.default as unknown as T;
    }
    if (cleanPath.includes('/diagnosis')) {
      const mod = await import('../../../fixtures/ui/diagnosis.json');
      return mod.default as unknown as T;
    }
    if (cleanPath === '/api/compare' || cleanPath.startsWith('/api/compare?')) {
      const mod = await import('../../../fixtures/ui/compare.json');
      return mod.default as unknown as T;
    }
    if (cleanPath.startsWith('/api/runs/')) {
      const mod = await import('../../../fixtures/ui/run_detail.json');
      return mod.default as unknown as T;
    }
    throw new ApiError(404, `No fixture found for route ${path}`);
  },

  // Stream EventSource helper for /api/jobs/{id}/events or /api/runs/{id}/events
  createEventSource(path: string): EventSource {
    const url = `${BASE_URL}${path}`;
    return new EventSource(url);
  },
};
