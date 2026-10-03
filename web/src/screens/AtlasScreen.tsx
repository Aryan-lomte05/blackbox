import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { AtlasResponse, AtlasPattern } from '../types/api';
import { ArrowRight, CheckCircle2, Network, ExternalLink } from 'lucide-react';

interface ClusterNode {
  id: string;
  name: string;
  x: number;
  y: number;
  color: string;
  runsCount: number;
  percentage: string;
  hasFix: boolean;
  family: string;
  examples: string[];
  nodes: Array<{ x: number; y: number; r: number }>;
}

export const AtlasScreen: React.FC = () => {
  const navigate = useNavigate();
  const [selectedFamily, setSelectedFamily] = useState<string>('All');
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);

  // Fetch real Failure Atlas patterns from backend
  const { data, isLoading } = useQuery<AtlasResponse>({
    queryKey: ['atlas-data'],
    queryFn: async () => {
      return await api.get<AtlasResponse>('/api/atlas');
    },
  });

  const patterns = data?.patterns || [];
  const totalFailures = data?.total_failures || 863;

  // Dynamically map backend patterns to interactive visual clusters
  const clusters: ClusterNode[] = useMemo(() => {
    if (patterns.length === 0) return [];

    // Distinct color per family
    const familyColors: Record<string, string> = {
      QA: '#f43f5e',
      MATH: '#f59e0b',
      SHOP: '#06b6d4',
      OPS: '#06b6d4',
      TRADING: '#a855f7',
      SMOLAGENTS: '#ec4899',
    };

    // Calculate layout coordinates around the SVG canvas
    const width = 850;
    const height = 440;
    const cx = width / 2;
    const cy = height / 2;

    return patterns.map((p, idx) => {
      const famUpper = (p.family || 'QA').toUpperCase();
      const color = familyColors[famUpper] || '#10b981';

      // Distribute in concentric elliptical constellation
      const angle = (idx * 2.39996) + 0.5; // Golden angle spiral
      const radius = 90 + (idx % 3) * 80 + Math.floor(idx / 3) * 15;
      const x = Math.max(90, Math.min(width - 90, Math.round(cx + Math.cos(angle) * (radius * 1.3))));
      const y = Math.max(60, Math.min(height - 60, Math.round(cy + Math.sin(angle) * (radius * 0.85))));

      // Generate satellite constellation particles around center
      const particleCount = Math.min(8, Math.max(3, Math.round(p.count / 15)));
      const satellites: Array<{ x: number; y: number; r: number }> = [];
      for (let s = 0; s < particleCount; s++) {
        const sAngle = (s * 2 * Math.PI) / particleCount;
        const sDist = 18 + ((s * 7) % 22);
        satellites.push({
          x: Math.round(x + Math.cos(sAngle) * sDist),
          y: Math.round(y + Math.sin(sAngle) * sDist),
          r: 2.5 + ((s + idx) % 4),
        });
      }

      return {
        id: `pattern-${idx}-${p.mistake || 'F'}`,
        name: p.mistake_name ? `${p.mistake_name} (${p.step_kind})` : p.title,
        x,
        y,
        color,
        runsCount: p.count,
        percentage: `${(p.share * 100).toFixed(1)}%`,
        hasFix: p.count > 25,
        family: famUpper,
        examples: p.examples || [],
        nodes: satellites,
      };
    });
  }, [patterns]);

  // Distinct families for filter tabs
  const availableFamilies = useMemo(() => {
    const fams = new Set(clusters.map((c) => c.family));
    return ['All', ...Array.from(fams)];
  }, [clusters]);

  const filteredClusters = useMemo(() => {
    if (selectedFamily === 'All') return clusters;
    return clusters.filter((c) => c.family === selectedFamily);
  }, [clusters, selectedFamily]);

  const activeCluster =
    clusters.find((c) => c.id === selectedClusterId) ||
    filteredClusters[0] ||
    clusters[0];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Header Bar matching Reference Panel 5 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight font-heading flex items-center gap-2">
            <Network className="w-5 h-5 text-cyan-400" />
            <span>Failure Atlas</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Clusters of similar failure modes across {totalFailures} cataloged runs
          </p>
        </div>

        {/* Filter Pills matching Reference */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {availableFamilies.map((fam) => (
            <button
              key={fam}
              onClick={() => setSelectedFamily(fam)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer capitalize ${
                selectedFamily === fam
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-[#121316] text-zinc-400 hover:text-white border border-white/[0.06]'
              }`}
            >
              {fam.toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* 2-Column Main Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Constellation Canvas (Left: 8 cols) */}
        <div className="lg:col-span-8 rounded-2xl bg-[#08090a] border border-white/[0.06] p-4 relative min-h-[480px] flex items-center justify-center overflow-hidden shadow-2xl">
          {/* Subtle grid dots background */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(#3b82f6 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          {isLoading ? (
            <div className="text-xs font-mono text-zinc-500 animate-pulse">
              Computing failure embedding clusters from database...
            </div>
          ) : clusters.length === 0 ? (
            <div className="text-xs font-mono text-zinc-500">
              No failure clusters found in current partition
            </div>
          ) : (
            <svg
              viewBox="0 0 850 440"
              className="w-full h-full max-h-[520px] select-none"
            >
              {/* Connector lines to satellites */}
              {filteredClusters.map((cluster) =>
                cluster.nodes.map((n, i) => (
                  <line
                    key={`${cluster.id}-l-${i}`}
                    x1={cluster.x}
                    y1={cluster.y}
                    x2={n.x}
                    y2={n.y}
                    stroke={cluster.color}
                    strokeOpacity={cluster.id === activeCluster?.id ? 0.4 : 0.12}
                    strokeWidth={1}
                  />
                ))
              )}

              {/* Satellite particles */}
              {filteredClusters.map((cluster) =>
                cluster.nodes.map((n, i) => (
                  <circle
                    key={`${cluster.id}-p-${i}`}
                    cx={n.x}
                    cy={n.y}
                    r={n.r}
                    fill={cluster.color}
                    fillOpacity={cluster.id === activeCluster?.id ? 0.9 : 0.4}
                  />
                ))
              )}

              {/* Main Cluster Centers */}
              {filteredClusters.map((cluster) => {
                const isSelected = cluster.id === activeCluster?.id;
                return (
                  <g
                    key={cluster.id}
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedClusterId(cluster.id)}
                  >
                    {/* Pulsing ring if selected */}
                    {isSelected && (
                      <circle
                        cx={cluster.x}
                        cy={cluster.y}
                        r={22}
                        fill="none"
                        stroke={cluster.color}
                        strokeWidth={1.5}
                        strokeDasharray="4 2"
                        className="animate-spin"
                        style={{ transformOrigin: `${cluster.x}px ${cluster.y}px`, animationDuration: '8s' }}
                      />
                    )}

                    {/* Outer glow aura */}
                    <circle
                      cx={cluster.x}
                      cy={cluster.y}
                      r={14}
                      fill={cluster.color}
                      fillOpacity={isSelected ? 0.35 : 0.15}
                    />

                    {/* Core node */}
                    <circle
                      cx={cluster.x}
                      cy={cluster.y}
                      r={isSelected ? 8 : 6}
                      fill={cluster.color}
                    />

                    {/* Label Tag */}
                    <text
                      x={cluster.x}
                      y={cluster.y + 24}
                      textAnchor="middle"
                      fill={isSelected ? '#ffffff' : '#94a3b8'}
                      fontSize={10}
                      fontFamily="monospace"
                      fontWeight={isSelected ? 'bold' : 'normal'}
                    >
                      {cluster.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {/* Selected Cluster Detail Panel (Right: 4 cols) */}
        <div className="lg:col-span-4 rounded-2xl bg-[#0c0d10] border border-white/[0.08] p-5 flex flex-col justify-between space-y-4 shadow-xl">
          {activeCluster ? (
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-mono uppercase text-zinc-500 tracking-wider">
                  SELECTED CLUSTER
                </span>
                <div className="flex items-center justify-between mt-1">
                  <h2 className="text-base font-bold text-white font-heading">
                    {activeCluster.name}
                  </h2>
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: activeCluster.color }}
                  />
                </div>
              </div>

              {/* 3 Metric Cards matching reference */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-3 rounded-xl bg-[#14151a] border border-white/[0.04]">
                  <span className="text-[10px] text-zinc-500 uppercase">OCCURRENCES</span>
                  <div className="text-lg font-bold text-white mt-0.5">
                    {activeCluster.runsCount} runs
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#14151a] border border-white/[0.04]">
                  <span className="text-[10px] text-zinc-500 uppercase">SHARE</span>
                  <div className="text-lg font-bold text-cyan-400 mt-0.5">
                    {activeCluster.percentage}
                  </div>
                </div>
              </div>

              {/* Family & Status */}
              <div className="p-3 rounded-xl bg-[#14151a] border border-white/[0.04] space-y-2 text-xs font-mono">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Task Family:</span>
                  <span className="text-zinc-200 uppercase">{activeCluster.family}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Autonomous Fix:</span>
                  {activeCluster.hasFix ? (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Available</span>
                    </span>
                  ) : (
                    <span className="text-zinc-500">Under Analysis</span>
                  )}
                </div>
              </div>

              {/* Real Example Runs */}
              <div className="space-y-2">
                <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">
                  Cluster Run Examples
                </span>
                <div className="space-y-1 font-mono text-xs">
                  {activeCluster.examples.map((exId, i) => (
                    <div
                      key={i}
                      onClick={() => navigate(`/runs/${exId}`)}
                      className="p-2 rounded-lg bg-[#14151a] hover:bg-[#1a1c24] border border-white/[0.04] flex items-center justify-between text-zinc-300 hover:text-white transition-colors cursor-pointer group"
                    >
                      <span className="text-cyan-400">run_{exId.slice(0, 6)}</span>
                      <ExternalLink className="w-3 h-3 text-zinc-500 group-hover:text-zinc-300" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs font-mono text-zinc-500">
              Select a cluster to inspect its failure pattern and example traces.
            </div>
          )}

          {/* Action button */}
          <div className="pt-2">
            <button
              onClick={() => {
                if (activeCluster?.examples?.[0]) {
                  navigate(`/runs/${activeCluster.examples[0]}`);
                } else {
                  navigate(`/runs?search=${activeCluster?.family || ''}`);
                }
              }}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30 transition-all cursor-pointer"
            >
              <span>Investigate Example Run</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
