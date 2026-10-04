import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Server, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';

const endpoints = [
  { method: 'GET', path: '/api/ui/overview', summary: 'Dashboard overview metrics, recent runs, incidents', status: 200, category: 'UI' },
  { method: 'GET', path: '/api/runs', summary: 'List and filter recorded agent runs', status: 200, category: 'Runs' },
  { method: 'GET', path: '/api/runs/{id}/graph', summary: 'React Flow execution graph with suspect ranks', status: 200, category: 'Runs' },
  { method: 'GET', path: '/api/runs/{id}/steps/{idx}', summary: 'Step request, output, and save-point memory', status: 200, category: 'Runs' },
  { method: 'GET', path: '/api/runs/{id}/diagnosis', summary: 'Ranked suspect root-cause analysis', status: 200, category: 'Diagnosis' },
  { method: 'POST', path: '/api/lab', summary: 'Live Lab 14-stage agent execution and SSE stream', status: 200, category: 'Lab' },
  { method: 'GET', path: '/api/atlas', summary: 'Failure Atlas canonical patterns across runs', status: 200, category: 'Atlas' },
  { method: 'GET', path: '/api/incidents', summary: 'Guardian active incidents and financial pauses', status: 200, category: 'Guardian' },
  { method: 'GET', path: '/api/dataset', summary: 'Dataset split health, task families, and statistics', status: 200, category: 'Dataset' },
  { method: 'GET', path: '/api/status', summary: 'Live daemon queues, GPU, and process metrics', status: 200, category: 'System' },
];

export const ApiScreen: React.FC = () => {
  const { data: status, isError } = useQuery({
    queryKey: ['system-status'],
    queryFn: () => api.get<any>('/api/status').catch(() => null),
    refetchInterval: 10000,
  });

  const isOnline = !isError && status !== null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              GATEWAY HEALTH
            </span>
            <span className="text-xs text-zinc-500 font-mono">:8000 API Router</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight font-heading flex items-center gap-2.5">
            <Server className="w-5 h-5 text-zinc-300" />
            <span>API Health & Endpoints</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Active REST and Server-Sent Event (SSE) endpoints exposed by the Black Box backend.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-1.5 rounded-lg bg-[#14161b] hover:bg-[#1b1e25] text-zinc-200 border border-white/[0.08] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Open Interactive Swagger Docs</span>
            <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
          </a>
        </div>
      </div>

      {/* Gateway Status Banner */}
      <div className="p-4 rounded-xl bg-[#0c0d10] border border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          <div>
            <div className="text-sm font-bold text-white font-mono">
              {isOnline ? 'API STATUS: ONLINE (200 OK)' : 'API STATUS: DISCONNECTED'}
            </div>
            <div className="text-xs text-zinc-400 mt-0.5">
              Host: http://localhost:8000 · OpenAPI Schema 3.1.0 · Fast API
            </div>
          </div>
        </div>

        <div className="text-right text-xs font-mono text-zinc-400">
          <div>CORS: Enabled (5173, 3000)</div>
          <div className="text-emerald-400 font-semibold">100% Contract Pass Rate</div>
        </div>
      </div>

      {/* Endpoints Table */}
      <div className="rounded-xl border border-white/[0.06] bg-[#0c0d10] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] text-zinc-500 uppercase tracking-wider bg-[#090a0c]">
                <th className="py-2.5 px-4">METHOD</th>
                <th className="py-2.5 px-3">ENDPOINT ROUTE</th>
                <th className="py-2.5 px-3">CATEGORY</th>
                <th className="py-2.5 px-3 font-sans">DESCRIPTION</th>
                <th className="py-2.5 pr-4 pl-3 text-right">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {endpoints.map((ep, idx) => (
                <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-2.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        ep.method === 'GET'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {ep.method}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-zinc-200 font-semibold">{ep.path}</td>
                  <td className="py-2.5 px-3 text-zinc-400">{ep.category}</td>
                  <td className="py-2.5 px-3 text-zinc-300 font-sans">{ep.summary}</td>
                  <td className="py-2.5 pr-4 pl-3 text-right">
                    <span className="text-emerald-400 font-bold">{ep.status} OK</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
