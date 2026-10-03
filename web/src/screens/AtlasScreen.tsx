import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

interface ClusterNode {
  id: string;
  name: string;
  x: number;
  y: number;
  color: string;
  runsCount: number;
  percentage: string;
  hasFix: boolean;
  family: 'QA' | 'Math' | 'Shop' | 'Novel' | 'All';
  nodes: Array<{ x: number; y: number; r: number }>;
}

const CLUSTERS: ClusterNode[] = [
  {
    id: 'search-distractor',
    name: 'Search Distractor',
    x: 320,
    y: 140,
    color: '#f43f5e', // red
    runsCount: 43,
    percentage: '12.7%',
    hasFix: true,
    family: 'QA',
    nodes: [
      { x: 300, y: 120, r: 4 },
      { x: 340, y: 110, r: 6 },
      { x: 310, y: 160, r: 3 },
      { x: 350, y: 155, r: 5 },
      { x: 280, y: 145, r: 3 },
      { x: 360, y: 130, r: 4 },
    ],
  },
  {
    id: 'tool-misuse',
    name: 'Tool Misuse',
    x: 620,
    y: 110,
    color: '#06b6d4', // cyan
    runsCount: 38,
    percentage: '11.2%',
    hasFix: true,
    family: 'Shop',
    nodes: [
      { x: 600, y: 90, r: 5 },
      { x: 640, y: 100, r: 6 },
      { x: 610, y: 130, r: 4 },
      { x: 650, y: 125, r: 3 },
      { x: 580, y: 115, r: 4 },
    ],
  },
  {
    id: 'calculator-error',
    name: 'Calculator Error',
    x: 740,
    y: 220,
    color: '#f59e0b', // amber
    runsCount: 52,
    percentage: '15.4%',
    hasFix: false,
    family: 'Math',
    nodes: [
      { x: 720, y: 200, r: 5 },
      { x: 760, y: 210, r: 4 },
      { x: 730, y: 240, r: 6 },
      { x: 770, y: 235, r: 3 },
    ],
  },
  {
    id: 'memory-overwrite',
    name: 'Memory Overwrite',
    x: 480,
    y: 280,
    color: '#a855f7', // purple
    runsCount: 29,
    percentage: '8.6%',
    hasFix: true,
    family: 'Shop',
    nodes: [
      { x: 460, y: 260, r: 4 },
      { x: 500, y: 270, r: 6 },
      { x: 470, y: 300, r: 5 },
      { x: 510, y: 295, r: 3 },
    ],
  },
  {
    id: 'retrieval-mismatch',
    name: 'Retrieval Mismatch',
    x: 660,
    y: 330,
    color: '#10b981', // green
    runsCount: 47,
    percentage: '13.9%',
    hasFix: false,
    family: 'QA',
    nodes: [
      { x: 640, y: 310, r: 5 },
      { x: 680, y: 320, r: 6 },
      { x: 650, y: 350, r: 3 },
      { x: 690, y: 345, r: 4 },
    ],
  },
  {
    id: 'novel',
    name: 'Novel',
    x: 540,
    y: 380,
    color: '#e4e4e7', // silver
    runsCount: 14,
    percentage: '4.1%',
    hasFix: false,
    family: 'Novel',
    nodes: [
      { x: 525, y: 370, r: 4 },
      { x: 555, y: 375, r: 5 },
      { x: 540, y: 395, r: 3 },
    ],
  },
];

export const AtlasScreen: React.FC = () => {
  const navigate = useNavigate();
  const [selectedFamily, setSelectedFamily] = useState<string>('All');
  const [activeClusterId, setActiveClusterId] = useState<string>('search-distractor');

  const { data } = useQuery<any>({
    queryKey: ['failure-atlas'],
    queryFn: async () => {
      return await api.get<any>('/api/atlas');
    },
  });

  const filteredClusters = CLUSTERS.filter((c) => {
    if (selectedFamily === 'All') return true;
    return c.family === selectedFamily;
  });

  const activeCluster = CLUSTERS.find((c) => c.id === activeClusterId) || CLUSTERS[0];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Top Header matching Reference Panel 5 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight font-heading">
            Failure Atlas
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            859 labelled failures grouped into ~30 patterns
          </p>
        </div>

        {/* Filter Pills matching Reference */}
        <div className="flex items-center gap-1.5">
          {['All', 'QA', 'Math', 'Shop', 'Novel'].map((fam) => (
            <button
              key={fam}
              onClick={() => setSelectedFamily(fam)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                selectedFamily === fam
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-[#121316] text-zinc-300 hover:text-white border border-white/[0.06]'
              }`}
            >
              {fam}
            </button>
          ))}
        </div>
      </div>

      {/* Constellation Starfield Canvas matching Reference Panel 5 */}
      <div className="relative rounded-2xl bg-[#07080a] border border-white/[0.08] h-[480px] overflow-hidden select-none shadow-2xl flex items-center justify-center">
        {/* Faint distant starfield particles */}
        <div className="absolute inset-0 pointer-events-none opacity-40">
          {[...Array(60)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                width: i % 5 === 0 ? 2 : 1,
                height: i % 5 === 0 ? 2 : 1,
                top: `${(i * 19) % 100}%`,
                left: `${(i * 31) % 100}%`,
                opacity: (i % 7 + 3) / 10,
              }}
            />
          ))}
        </div>

        {/* SVG Galaxy & Constellation Links */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {filteredClusters.map((cluster) => {
            return (
              <g key={cluster.id}>
                {/* Connect central cluster to its sub-nodes */}
                {cluster.nodes.map((node, i) => (
                  <line
                    key={i}
                    x1={cluster.x}
                    y1={cluster.y}
                    x2={node.x}
                    y2={node.y}
                    stroke={cluster.color}
                    strokeWidth={1}
                    strokeOpacity={0.35}
                    strokeDasharray="2,2"
                  />
                ))}
                {/* Connect sub-nodes to each other */}
                {cluster.nodes.map((node, i) => {
                  const next = cluster.nodes[(i + 1) % cluster.nodes.length];
                  return (
                    <line
                      key={`sub-${i}`}
                      x1={node.x}
                      y1={node.y}
                      x2={next.x}
                      y2={next.y}
                      stroke={cluster.color}
                      strokeWidth={1}
                      strokeOpacity={0.2}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>

        {/* Render Clusters & Sub-nodes */}
        {filteredClusters.map((cluster) => {
          const isSelected = cluster.id === activeClusterId;
          return (
            <div key={cluster.id}>
              {/* Sub-node dots */}
              {cluster.nodes.map((n, i) => (
                <div
                  key={i}
                  className="absolute rounded-full transition-transform"
                  style={{
                    left: n.x,
                    top: n.y,
                    width: n.r * 2,
                    height: n.r * 2,
                    backgroundColor: cluster.color,
                    boxShadow: `0 0 8px ${cluster.color}`,
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              ))}

              {/* Central Glowing Core */}
              <div
                onClick={() => setActiveClusterId(cluster.id)}
                className="absolute cursor-pointer flex flex-col items-center group -translate-x-1/2 -translate-y-1/2"
                style={{ left: cluster.x, top: cluster.y }}
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300"
                  style={{
                    backgroundColor: cluster.color,
                    boxShadow: `0 0 24px ${cluster.color}, 0 0 12px ${cluster.color}`,
                    transform: isSelected ? 'scale(1.2)' : 'scale(1)',
                  }}
                >
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>

                {/* Cluster Label below node */}
                <div
                  className="mt-2 text-xs font-mono font-bold tracking-tight whitespace-nowrap px-2 py-0.5 rounded bg-black/60 border border-white/[0.08] backdrop-blur-md"
                  style={{ color: cluster.color }}
                >
                  {cluster.name}
                </div>
              </div>
            </div>
          );
        })}

        {/* Selected Cluster Info Card matching Reference Image popup */}
        {activeCluster && (
          <div
            className="absolute z-20 p-3.5 rounded-xl bg-[#0c0d10]/95 border border-white/[0.12] shadow-2xl backdrop-blur-xl w-52 space-y-2 pointer-events-auto"
            style={{
              left: Math.min(activeCluster.x + 20, 800),
              top: Math.max(activeCluster.y - 60, 40),
            }}
          >
            <div>
              <div className="text-xs font-bold text-white font-heading">
                {activeCluster.name}
              </div>
              <div className="text-[11px] font-mono text-zinc-400 mt-0.5">
                {activeCluster.runsCount} runs · {activeCluster.percentage}
              </div>
            </div>

            {activeCluster.hasFix && (
              <div className="text-[10px] font-mono font-semibold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Known fix available</span>
              </div>
            )}

            <button
              onClick={() => navigate('/runs')}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium pt-1 cursor-pointer"
            >
              <span>View</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
