import React from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Database,
  Cpu,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  GitFork,
  Crosshair,
  ShieldCheck,
  Pause,
  Terminal,
} from 'lucide-react';

interface MasterForensicStageProps {
  progress: number; // 0.0 to 1.0 (continuous normalized whole-page scroll)
  mousePos: { x: number; y: number };
}

export const MasterForensicStage: React.FC<MasterForensicStageProps> = ({ progress, mousePos }) => {
  // Clamped progress
  const p = Math.max(0, Math.min(1, progress));

  // Determine active visual phase based on progress
  // Act 1: The Trace (0.00 - 0.12)
  // Act 2: The Run (0.12 - 0.25)
  // Act 3: The Failure (0.25 - 0.38)
  // Act 4: The Cause (0.38 - 0.52)
  // Act 5: The Proof (0.52 - 0.66)
  // Act 6: The Pattern (0.66 - 0.79)
  // Act 7: The Control (0.79 - 0.91)
  // Act 8: Open Black Box (0.91 - 1.00)

  // Trace Convergence factor (0 at p=0, 1 at p>=0.12)
  const traceConvergence = Math.min(1, p / 0.10);

  // Execution Packet Progress (moves from node 1 to node 5 during 0.12 to 0.25)
  const runProgress = Math.max(0, Math.min(1, (p - 0.12) / 0.13));

  // Failure Contamination Progress (detonates at step 4, spreads to 5 and 6 during 0.25 to 0.38)
  const failureProgress = Math.max(0, Math.min(1, (p - 0.25) / 0.13));

  // Causal Isolation Progress (zooms onto step 4 during 0.38 to 0.52)
  const causeProgress = Math.max(0, Math.min(1, (p - 0.38) / 0.14));

  // Replay Fork Progress (rewinds and draws green fork during 0.52 to 0.66)
  const proofProgress = Math.max(0, Math.min(1, (p - 0.52) / 0.14));

  // Atlas Clustering Progress (expands into 4 cluster centroids during 0.66 to 0.79)
  const atlasProgress = Math.max(0, Math.min(1, (p - 0.66) / 0.13));

  // Guardian Intercept Progress (intercepts and pauses during 0.79 to 0.91)
  const guardianProgress = Math.max(0, Math.min(1, (p - 0.79) / 0.12));

  // Destination Collapse Progress (clears canvas during 0.91 to 1.00)
  const destinationProgress = Math.max(0, Math.min(1, (p - 0.91) / 0.09));

  // Canonical Nodes Definition along horizontal baseline
  const NODES = [
    { id: 1, label: '01 INPUT', kind: 'input', x: 10, y: 50, lat: '12ms', tok: '42t' },
    { id: 2, label: '02 RETRIEVAL', kind: 'retrieval', x: 26, y: 50, lat: '84ms', tok: '340t' },
    { id: 3, label: '03 PLANNER', kind: 'llm', x: 42, y: 50, lat: '410ms', tok: '520t' },
    { id: 4, label: '04 SQL_EXEC', kind: 'tool', x: 58, y: 50, lat: '290ms', tok: '180t' },
    { id: 5, label: '05 SYNTHESIZE', kind: 'llm', x: 74, y: 50, lat: '512ms', tok: '680t' },
    { id: 6, label: '06 FINAL', kind: 'final', x: 90, y: 50, lat: '24ms', tok: '95t' },
  ];

  // Atlas Cluster Centroids
  const CLUSTERS = [
    { id: 'F-01', name: 'SCHEMA DRIFT', x: 30, y: 35, count: 142, color: '#ef4444' },
    { id: 'F-02', name: 'TOOL TIMEOUTS', x: 70, y: 30, count: 118, color: '#f59e0b' },
    { id: 'F-03', name: 'SQL SYNTAX ERROR', x: 38, y: 70, count: 94, color: '#a855f7' },
    { id: 'F-04', name: 'CONTEXT OVERFLOW', x: 72, y: 68, count: 68, color: '#38bdf8' },
  ];

  // Overall Stage Opacity (fades out at final destination)
  const stageOpacity = 1 - destinationProgress;

  return (
    <div
      style={{ opacity: stageOpacity }}
      className="relative w-full h-full flex items-center justify-center pointer-events-none select-none"
    >
      {/* Background Architectural Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#1f293735_1px,transparent_1px)] bg-[size:32px_32px] opacity-60" />

      {/* Main SVG Vector Canvas */}
      <svg className="w-full h-full max-w-6xl max-h-[580px] overflow-visible">
        <defs>
          <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-red" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-green" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ============================================================ */}
        {/* ACT 1: FINE TRAJECTORY WIRE HARNESS (CONVERGING ON SCROLL)   */}
        {/* ============================================================ */}
        {traceConvergence < 1 && (
          <g opacity={1 - traceConvergence}>
            {Array.from({ length: 24 }).map((_, i) => {
              const spread = (i / 23 - 0.5) * 280;
              const yStart = 300 + spread;
              const yEnd = 300 + spread * (1 - traceConvergence * 0.8);
              return (
                <line
                  key={`wire-${i}`}
                  x1="2%"
                  y1={yStart}
                  x2="98%"
                  y2={yEnd}
                  stroke={i === 12 ? '#38bdf8' : '#27272a'}
                  strokeWidth={i === 12 ? 1.5 : 0.75}
                  opacity={i === 12 ? 0.8 : 0.3}
                />
              );
            })}
          </g>
        )}

        {/* ============================================================ */}
        {/* ACT 2 & 3: PRIMARY TRACE EDGE LINE (CONVERGED & RUNNING)     */}
        {/* ============================================================ */}
        {atlasProgress < 0.2 && (
          <g opacity={Math.min(1, traceConvergence * 1.5)}>
            {/* Background Base Bus Wire */}
            <line x1="10%" y1="50%" x2="90%" y2="50%" stroke="#1f2937" strokeWidth="2.5" />

            {/* Cyan Healthy Execution Wire (Advances with runProgress) */}
            <line
              x1="10%"
              y1="50%"
              x2={`${10 + runProgress * 80}%`}
              y2="50%"
              stroke={failureProgress > 0.4 ? '#ef4444' : '#38bdf8'}
              strokeWidth="2.5"
              filter={failureProgress > 0.4 ? 'url(#glow-red)' : 'url(#glow-cyan)'}
              className="transition-colors duration-300"
            />

            {/* Blood-Red Contamination Wavefront (Shoots from Node 4 -> Node 6 during failure) */}
            {failureProgress > 0.2 && (
              <line
                x1="58%"
                y1="50%"
                x2={`${58 + Math.min(1, (failureProgress - 0.2) / 0.6) * 32}%`}
                y2="50%"
                stroke="#ef4444"
                strokeWidth="3.5"
                strokeDasharray="6 4"
                filter="url(#glow-red)"
                className="animate-pulse"
              />
            )}

            {/* Traveling Execution Photon Packet (Act 2) */}
            {runProgress > 0.05 && runProgress < 0.98 && failureProgress < 0.2 && (
              <circle
                cx={`${10 + runProgress * 80}%`}
                cy="50%"
                r="4.5"
                fill="#38bdf8"
                filter="url(#glow-cyan)"
              />
            )}
          </g>
        )}

        {/* ============================================================ */}
        {/* ACT 4: CAUSAL ISOLATION FOCUS RETICLE AROUND NODE 4          */}
        {/* ============================================================ */}
        {causeProgress > 0.1 && proofProgress < 0.3 && (
          <g
            transform="translate(580, 300)"
            opacity={Math.min(1, causeProgress * 2) * (1 - proofProgress * 1.5)}
          >
            {/* Rotating Targeting Brackets */}
            <circle
              r="34"
              fill="none"
              stroke="#ef4444"
              strokeWidth="1.5"
              strokeDasharray="16 8"
              className="animate-spin"
              style={{ animationDuration: '8s' }}
            />
            <circle
              r="44"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="1"
              strokeDasharray="4 6"
            />
            {/* Crosshairs */}
            <line x1="-50" y1="0" x2="-38" y2="0" stroke="#ef4444" strokeWidth="2" />
            <line x1="38" y1="0" x2="50" y2="0" stroke="#ef4444" strokeWidth="2" />
            <line x1="0" y1="-50" x2="0" y2="-38" stroke="#ef4444" strokeWidth="2" />
            <line x1="0" y1="38" x2="0" y2="50" stroke="#ef4444" strokeWidth="2" />

            {/* SHAP Feature Attribution Line Callouts */}
            <g opacity={Math.min(1, (causeProgress - 0.3) * 2)}>
              <path d="M 0 -44 L 0 -85 L 60 -85" fill="none" stroke="#ef4444" strokeWidth="1" />
              <text x="68" y="-81" fill="#ef4444" fontSize="10" fontFamily="monospace" fontWeight="bold">
                SHAP: schema_drift (+0.48)
              </text>

              <path d="M 0 44 L 0 85 L 60 85" fill="none" stroke="#f59e0b" strokeWidth="1" />
              <text x="68" y="89" fill="#f59e0b" fontSize="10" fontFamily="monospace">
                unhandled_null (+0.32)
              </text>
            </g>
          </g>
        )}

        {/* ============================================================ */}
        {/* ACT 5: COUNTERFACTUAL FORK (GREEN ARC REPLAY FROM NODE 3)    */}
        {/* ============================================================ */}
        {proofProgress > 0.1 && atlasProgress < 0.2 && (
          <g opacity={Math.min(1, proofProgress * 1.5)}>
            {/* Green Fiber-Optic Arc branching down from Node 3 (42% X, 50% Y) to 70% Y */}
            <path
              d="M 420 300 C 470 300, 500 420, 580 420"
              fill="none"
              stroke="#22c55e"
              strokeWidth="2.5"
              strokeDasharray="6 4"
              filter="url(#glow-green)"
              className="animate-pulse"
            />
            {/* Replayed Horizontal Lower Lane (580 to 900) */}
            <line
              x1="580"
              y1="420"
              x2={`${580 + Math.min(1, proofProgress * 1.2) * 320}`}
              y2="420"
              stroke="#22c55e"
              strokeWidth="2.5"
              filter="url(#glow-green)"
            />

            {/* Repaired Node 04' */}
            <circle cx="580" cy="420" r="14" fill="#081e13" stroke="#22c55e" strokeWidth="2" />
            <text x="580" y="424" fill="#4ade80" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
              04&apos;
            </text>
            <text x="580" y="445" fill="#22c55e" fontSize="9" fontFamily="monospace" textAnchor="middle">
              PATCHED
            </text>

            {/* Clean Node 05' */}
            <circle cx="740" cy="420" r="14" fill="#081e13" stroke="#22c55e" strokeWidth="1.5" />
            <text x="740" y="424" fill="#4ade80" fontSize="9" fontFamily="monospace" textAnchor="middle">
              05&apos;
            </text>
            <text x="740" y="445" fill="#86efac" fontSize="9" fontFamily="monospace" textAnchor="middle">
              CLEAN
            </text>

            {/* Verified Pass Node 06' */}
            <circle cx="900" cy="420" r="16" fill="#22c55e" stroke="#ffffff" strokeWidth="2" filter="url(#glow-green)" />
            <text x="900" y="424" fill="#000000" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
              PASS
            </text>
            <text x="900" y="450" fill="#4ade80" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
              100% VERIFIED
            </text>
          </g>
        )}

        {/* ============================================================ */}
        {/* ACT 6: FLEET FAILURE ATLAS CONSTELLATION CLUSTERS            */}
        {/* ============================================================ */}
        {atlasProgress > 0.1 && (
          <g opacity={Math.min(1, atlasProgress * 2)}>
            {/* Coordinate Crosshairs */}
            <line x1="500" y1="120" x2="500" y2="480" stroke="#1f2937" strokeWidth="1" strokeDasharray="4 4" />
            <line x1="200" y1="300" x2="800" y2="300" stroke="#1f2937" strokeWidth="1" strokeDasharray="4 4" />

            {/* Cluster Circles & Fingerprint Centroids */}
            {CLUSTERS.map((cl) => {
              const cx = cl.x * 10;
              const cy = cl.y * 6;
              return (
                <g key={cl.id}>
                  {/* Outer radius halo */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={38 + Math.sin(p * 20) * 4}
                    fill={`${cl.color}10`}
                    stroke={cl.color}
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                  {/* Centroid core */}
                  <circle cx={cx} cy={cy} r="10" fill={cl.color} />
                  <text
                    x={cx}
                    y={cy + 3}
                    fill="#ffffff"
                    fontSize="9"
                    fontFamily="monospace"
                    textAnchor="middle"
                    fontWeight="bold"
                  >
                    {cl.id.split('-')[1]}
                  </text>
                  <text
                    x={cx}
                    y={cy - 18}
                    fill={cl.color}
                    fontSize="10"
                    fontFamily="monospace"
                    textAnchor="middle"
                    fontWeight="bold"
                  >
                    {cl.name} ({cl.count})
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {/* ============================================================ */}
        {/* ACT 7: GUARDIAN RUNTIME BRAKE INTERCEPTOR GATE               */}
        {/* ============================================================ */}
        {guardianProgress > 0.1 && (
          <g
            transform="translate(580, 300)"
            opacity={Math.min(1, guardianProgress * 2)}
          >
            {/* Guardian Security Gate Barrier */}
            <line x1="0" y1="-80" x2="0" y2="80" stroke="#38bdf8" strokeWidth="3" filter="url(#glow-cyan)" />
            <circle r="22" fill="#08121f" stroke="#38bdf8" strokeWidth="2" />
            <text x="0" y="4" fill="#38bdf8" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
              HALT
            </text>
            <text x="0" y="-30" fill="#38bdf8" fontSize="9" fontFamily="monospace" textAnchor="middle">
              GUARDIAN BRAKE TRIGGERED
            </text>
            <text x="0" y="40" fill="#ef4444" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
              IN-FLIGHT ANOMALY PAUSED
            </text>
          </g>
        )}

        {/* ============================================================ */}
        {/* CANONICAL EXECUTION NODES (1 to 6) — SHARED TOPOLOGY SPINE   */}
        {/* ============================================================ */}
        {atlasProgress < 0.2 && (
          <g opacity={Math.min(1, traceConvergence * 1.5)}>
            {NODES.map((node) => {
              const nodeCompleted = runProgress >= (node.id - 1) / 5;
              const isNode4 = node.id === 4;
              const isNode5or6 = node.id >= 5;

              // Node Color Logic based on scroll state
              let strokeColor = '#1f2937';
              let fillColor = '#06090f';
              let textColor = '#71717a';

              if (nodeCompleted) {
                strokeColor = '#38bdf8';
                fillColor = '#08121f';
                textColor = '#38bdf8';
              }

              // Failure State Overrides (Act 3 & 4)
              if (failureProgress > 0.3) {
                if (isNode4) {
                  strokeColor = '#ef4444';
                  fillColor = '#450a0a';
                  textColor = '#ef4444';
                } else if (isNode5or6) {
                  strokeColor = '#f59e0b';
                  fillColor = '#2a1a06';
                  textColor = '#f59e0b';
                }
              }

              // Proof State Overrides (Act 5: Upstream nodes reused)
              if (proofProgress > 0.2 && node.id <= 3) {
                strokeColor = '#38bdf8';
                fillColor = '#0b1d33';
                textColor = '#7dd3fc';
              }

              // Node Scale: Zooms up on node 4 during causal isolation
              const scale = isNode4 && causeProgress > 0.2 && proofProgress < 0.3 ? 1.4 : 1.0;

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x * 10}, 300) scale(${scale})`}
                  className="transition-transform duration-300"
                >
                  {/* Shockwave Radar Ring for Node 4 in Failure */}
                  {isNode4 && failureProgress > 0.4 && proofProgress < 0.2 && (
                    <circle
                      r="26"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="2"
                      className="animate-ping"
                    />
                  )}

                  {/* Node Circle */}
                  <circle
                    r="15"
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={nodeCompleted ? 2.5 : 1.5}
                    filter={nodeCompleted ? (strokeColor === '#ef4444' ? 'url(#glow-red)' : 'url(#glow-cyan)') : undefined}
                  />

                  {/* Node ID */}
                  <text
                    x="0"
                    y="4"
                    fill={textColor}
                    fontSize="10"
                    fontFamily="monospace"
                    textAnchor="middle"
                    fontWeight="bold"
                  >
                    0{node.id}
                  </text>

                  {/* Top Label */}
                  <text
                    x="0"
                    y="-22"
                    fill="#e4e4e7"
                    fontSize="9"
                    fontFamily="monospace"
                    textAnchor="middle"
                    fontWeight={isNode4 && failureProgress > 0.3 ? 'bold' : 'normal'}
                  >
                    {node.label}
                  </text>

                  {/* Bottom Metadata (Latency / Tokens / Reused) */}
                  <text
                    x="0"
                    y="25"
                    fill="#71717a"
                    fontSize="8"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {proofProgress > 0.2 && node.id <= 3
                      ? 'REUSED'
                      : isNode4 && failureProgress > 0.4
                      ? 'ROOT CAUSE'
                      : `${node.lat} · ${node.tok}`}
                  </text>
                </g>
              );
            })}
          </g>
        )}
      </svg>
    </div>
  );
};
