import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

interface MasterForensicStageProps {
  progress: number; // 0.0 to 1.0
  mousePos: { x: number; y: number };
}

export const MasterForensicStage: React.FC<MasterForensicStageProps> = ({ progress, mousePos }) => {
  const p = Math.max(0, Math.min(1, progress));

  // Act ranges
  // Act 1: The Trace (0.00 - 0.12)
  // Act 2: The Run (0.12 - 0.26)
  // Act 3 & 4: The Cause (0.26 - 0.52)
  // Act 5: The Proof (0.52 - 0.66)
  // Act 6: The Pattern (0.66 - 0.79)
  // Act 7: The Control (0.79 - 0.91)
  // Act 8: Enter Black Box (0.91 - 1.00)

  const op1 = Math.max(0, Math.min(1, p <= 0.12 ? 1 - p / 0.12 : 0));
  const op2 = Math.max(0, Math.min(1, p >= 0.10 && p <= 0.28 ? (p < 0.14 ? (p - 0.10) / 0.04 : p > 0.24 ? 1 - (p - 0.24) / 0.04 : 1) : 0));
  const op4 = Math.max(0, Math.min(1, p >= 0.26 && p <= 0.52 ? (p < 0.30 ? (p - 0.26) / 0.04 : p > 0.48 ? 1 - (p - 0.48) / 0.04 : 1) : 0));
  const op5 = Math.max(0, Math.min(1, p >= 0.50 && p <= 0.68 ? (p < 0.54 ? (p - 0.50) / 0.04 : p > 0.64 ? 1 - (p - 0.64) / 0.04 : 1) : 0));
  const op6 = Math.max(0, Math.min(1, p >= 0.66 && p <= 0.81 ? (p < 0.70 ? (p - 0.66) / 0.04 : p > 0.77 ? 1 - (p - 0.77) / 0.04 : 1) : 0));
  const op7 = Math.max(0, Math.min(1, p >= 0.79 && p <= 0.92 ? (p < 0.82 ? (p - 0.79) / 0.03 : p > 0.89 ? 1 - (p - 0.89) / 0.03 : 1) : 0));
  const op8 = Math.max(0, Math.min(1, p >= 0.90 ? (p - 0.90) / 0.06 : 0));

  // Parallax offsets
  const mx = mousePos.x * 12;
  const my = mousePos.y * 8;

  // Starfield background
  const stars = useMemo(() => {
    const list = [];
    for (let i = 0; i < 90; i++) {
      list.push({
        x: (i * 137.5) % 1440,
        y: (i * 93.7) % 850,
        r: (i % 3 === 0 ? 1.5 : 0.8),
        opacity: 0.15 + ((i % 5) * 0.12),
      });
    }
    return list;
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden select-none">
      <svg
        viewBox="0 0 1440 850"
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full"
      >
        <defs>
          {/* Cyan Glow Filter */}
          <filter id="cyan-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Amber Glow Filter */}
          <filter id="amber-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Red Glow Filter */}
          <filter id="red-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Emerald Glow Filter */}
          <filter id="emerald-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Linear Gradients */}
          <linearGradient id="trace-cyan" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.2" />
          </linearGradient>

          <linearGradient id="globe-glow" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#0284c7" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#05070b" stopOpacity="0.0" />
          </linearGradient>

          <radialGradient id="cluster-radial-blue" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="cluster-radial-amber" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="cluster-radial-purple" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Universal Ambient Subtle Stars */}
        <g opacity="0.4">
          {stars.map((s, idx) => (
            <circle key={idx} cx={s.x} cy={s.y} r={s.r} fill="#7dd3fc" opacity={s.opacity} />
          ))}
        </g>

        {/* =====================================================================
            ACT I: THE TRACE — ISOMETRIC 3D BLACK BOX WITH SWIRLING TRACES
            ===================================================================== */}
        {op1 > 0.01 && (
          <g
            opacity={op1}
            transform={`translate(${mx * 0.5}, ${my * 0.5})`}
            className="transition-opacity duration-150"
          >
            {/* Ambient Cyan Core Glow behind Box */}
            <circle cx="1020" cy="380" r="180" fill="url(#cluster-radial-blue)" opacity="0.6" />

            {/* Swirling Fiber-Optic Trace Curves */}
            <path
              d="M 640 560 C 740 640, 940 600, 1020 500 C 1100 400, 1160 300, 1040 240 C 920 180, 840 260, 900 350 C 960 440, 1120 440, 1220 380"
              fill="none"
              stroke="#22d3ee"
              strokeWidth="2"
              strokeDasharray="6 3"
              opacity="0.7"
              filter="url(#cyan-glow)"
            />
            <path
              d="M 680 520 C 780 440, 900 480, 960 420 C 1020 360, 1080 320, 1180 340"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1.5"
              opacity="0.5"
            />
            <path
              d="M 720 580 C 820 620, 1000 580, 1060 480 C 1120 380, 1060 280, 980 260 C 900 240, 860 320, 920 380"
              fill="none"
              stroke="#0284c7"
              strokeWidth="1.2"
              opacity="0.4"
            />

            {/* Glowing Traveling Photon Packets */}
            <circle cx="1020" cy="500" r="4" fill="#ffffff" filter="url(#cyan-glow)" />
            <circle cx="900" cy="350" r="3.5" fill="#22d3ee" filter="url(#cyan-glow)" />
            <circle cx="1040" cy="240" r="3" fill="#67e8f9" />
            <circle cx="740" cy="540" r="3" fill="#38bdf8" />

            {/* Radiating Isometric Starburst Points */}
            <circle cx="920" cy="360" r="2" fill="#ffffff" opacity="0.9" />
            <circle cx="1060" cy="290" r="2" fill="#ffffff" opacity="0.9" />
            <circle cx="780" cy="290" r="2" fill="#ffffff" opacity="0.9" />
            <circle cx="920" cy="520" r="2" fill="#ffffff" opacity="0.9" />
            <circle cx="1060" cy="450" r="2" fill="#ffffff" opacity="0.9" />
            <circle cx="780" cy="450" r="2" fill="#ffffff" opacity="0.9" />

            {/* Isometric 3D "BLACK BOX" Machine Chassis */}
            <g transform="translate(100, 20)">
              {/* Box Top Face */}
              <polygon
                points="920,220 1060,290 920,360 780,290"
                fill="#0b1323"
                stroke="#38bdf8"
                strokeWidth="1.8"
                opacity="0.85"
              />
              {/* Box Left Face */}
              <polygon
                points="780,290 920,360 920,520 780,450"
                fill="#080d16"
                stroke="#1e3a5f"
                strokeWidth="1.8"
                opacity="0.95"
              />
              {/* Box Right Face (Front Facing View) */}
              <polygon
                points="920,360 1060,290 1060,450 920,520"
                fill="#0a101d"
                stroke="#38bdf8"
                strokeWidth="1.8"
                opacity="0.95"
              />

              {/* Top Face Internal Grid Mesh */}
              <line x1="850" y1="255" x2="990" y2="325" stroke="#1f2937" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="850" y1="325" x2="990" y2="255" stroke="#1f2937" strokeWidth="1" strokeDasharray="3 3" />

              {/* Right Face "BLACK BOX" Text Engraving */}
              <g transform="translate(950, 420) skewY(-26.5) scale(0.9, 1)">
                <text
                  x="0"
                  y="0"
                  fill="#38bdf8"
                  fontSize="18"
                  fontWeight="900"
                  fontFamily="monospace"
                  letterSpacing="4"
                  opacity="0.85"
                >
                  BLACK BOX
                </text>
                <text
                  x="2"
                  y="16"
                  fill="#64748b"
                  fontSize="9"
                  fontFamily="monospace"
                  letterSpacing="2"
                  opacity="0.7"
                >
                  FLIGHT RECORDER // v2.4
                </text>
              </g>

              {/* Chassis Corner Crosshair HUD Brackets */}
              <path d="M 770 285 L 770 275 L 780 275" stroke="#38bdf8" strokeWidth="1.5" fill="none" />
              <path d="M 1070 285 L 1070 275 L 1060 275" stroke="#38bdf8" strokeWidth="1.5" fill="none" />
              <path d="M 920 210 L 920 200" stroke="#38bdf8" strokeWidth="1.5" />
              <path d="M 920 530 L 920 540" stroke="#38bdf8" strokeWidth="1.5" />
            </g>
          </g>
        )}

        {/* =====================================================================
            ACT II: THE RUN — HORIZONTAL 7-NODE DAG PIPELINE
            ===================================================================== */}
        {op2 > 0.01 && (
          <g opacity={op2} className="transition-opacity duration-150">
            {/* Connecting Bezier Trace Wires */}
            <path
              d="M 400 240 L 520 240 L 660 240 L 820 240 L 980 240 L 1120 240 L 1240 240"
              fill="none"
              stroke="#1e293b"
              strokeWidth="4"
            />
            {/* Active Cyan Glow Wire */}
            <path
              d="M 400 240 L 520 240 L 660 240 L 820 240"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2.5"
              filter="url(#cyan-glow)"
            />

            {/* Node 01: Input */}
            <g transform="translate(370, 205)">
              <rect width="60" height="70" rx="8" fill="#080e18" stroke="#38bdf8" strokeWidth="1.5" />
              <text x="30" y="24" textAnchor="middle" fill="#64748b" fontSize="10" fontFamily="monospace">01</text>
              <text x="30" y="42" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">Input</text>
              <text x="30" y="58" textAnchor="middle" fill="#38bdf8" fontSize="9" fontFamily="monospace">12ms</text>
            </g>

            {/* Node 02: LLM */}
            <g transform="translate(490, 205)">
              <rect width="60" height="70" rx="8" fill="#080e18" stroke="#38bdf8" strokeWidth="1.5" />
              <text x="30" y="24" textAnchor="middle" fill="#64748b" fontSize="10" fontFamily="monospace">02</text>
              <text x="30" y="42" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">LLM</text>
              <text x="30" y="58" textAnchor="middle" fill="#38bdf8" fontSize="9" fontFamily="monospace">1.2s</text>
            </g>

            {/* Node 03: Retrieval */}
            <g transform="translate(620, 205)">
              <rect width="80" height="70" rx="8" fill="#0c1524" stroke="#38bdf8" strokeWidth="2" filter="url(#cyan-glow)" />
              <text x="40" y="24" textAnchor="middle" fill="#38bdf8" fontSize="10" fontFamily="monospace" fontWeight="bold">03</text>
              <text x="40" y="42" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">Retrieval</text>
              <text x="40" y="58" textAnchor="middle" fill="#22d3ee" fontSize="9" fontFamily="monospace">642ms</text>
            </g>

            {/* Node 04: Search [GUILTY STEP] with Red Glow & Double Border */}
            <g transform="translate(770, 195)">
              {/* Outer pulsing glow frame */}
              <rect x="-8" y="-8" width="106" height="96" rx="12" fill="none" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="4 2" opacity="0.8" />
              <rect width="90" height="80" rx="8" fill="#18070d" stroke="#f43f5e" strokeWidth="2" filter="url(#red-glow)" />
              <text x="45" y="24" textAnchor="middle" fill="#f43f5e" fontSize="10" fontFamily="monospace" fontWeight="bold">04</text>
              <text x="45" y="45" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="bold">Search</text>
              <text x="45" y="64" textAnchor="middle" fill="#fb7185" fontSize="9" fontFamily="monospace">1.8s</text>

              {/* "GUILTY STEP" Badge */}
              <g transform="translate(8, 88)">
                <rect width="74" height="18" rx="4" fill="#881337" stroke="#f43f5e" strokeWidth="1" />
                <text x="37" y="12" textAnchor="middle" fill="#ffffff" fontSize="9" fontFamily="monospace" fontWeight="bold" letterSpacing="1">
                  GUILTY STEP
                </text>
              </g>
            </g>

            {/* Node 05: LLM */}
            <g transform="translate(950, 205)">
              <rect width="60" height="70" rx="8" fill="#080e18" stroke="#1f2937" strokeWidth="1.5" />
              <text x="30" y="24" textAnchor="middle" fill="#64748b" fontSize="10" fontFamily="monospace">05</text>
              <text x="30" y="42" textAnchor="middle" fill="#94a3b8" fontSize="11">LLM</text>
              <text x="30" y="58" textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="monospace">2.1s</text>
            </g>

            {/* Node 06: State */}
            <g transform="translate(1080, 205)">
              <rect width="65" height="70" rx="8" fill="#12080a" stroke="#f43f5e" strokeWidth="1.5" opacity="0.85" />
              <text x="32" y="24" textAnchor="middle" fill="#f43f5e" fontSize="10" fontFamily="monospace">06</text>
              <text x="32" y="42" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">State</text>
              <text x="32" y="58" textAnchor="middle" fill="#fda4af" fontSize="9" fontFamily="monospace">320ms</text>
            </g>

            {/* Node 07: Final */}
            <g transform="translate(1210, 205)">
              <rect width="60" height="70" rx="8" fill="#080e18" stroke="#1f2937" strokeWidth="1.5" />
              <text x="30" y="24" textAnchor="middle" fill="#64748b" fontSize="10" fontFamily="monospace">07</text>
              <text x="30" y="42" textAnchor="middle" fill="#64748b" fontSize="11">Final</text>
              <text x="30" y="58" textAnchor="middle" fill="#475569" fontSize="9" fontFamily="monospace">120ms</text>
            </g>
          </g>
        )}

        {/* =====================================================================
            ACT IV: THE CAUSE — 3D ISOMETRIC MULTI-LAYER GRID STACK & HUD CUBE
            ===================================================================== */}
        {op4 > 0.01 && (
          <g
            opacity={op4}
            transform={`translate(${mx * 0.4}, ${my * 0.4})`}
            className="transition-opacity duration-150"
          >
            {/* Top Grid Plane (Layer 1) */}
            <g opacity="0.25">
              <polygon points="720,160 980,220 720,280 460,220" fill="none" stroke="#38bdf8" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="590" y1="190" x2="850" y2="250" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2 2" />
              <line x1="850" y1="190" x2="590" y2="250" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2 2" />
            </g>

            {/* Middle Grid Plane (Layer 2 - Active Focal Stage) */}
            <g opacity="0.55">
              <polygon points="720,300 1020,370 720,440 420,370" fill="none" stroke="#38bdf8" strokeWidth="1.5" />
              <line x1="570" y1="335" x2="870" y2="405" stroke="#38bdf8" strokeWidth="1" />
              <line x1="870" y1="335" x2="570" y2="405" stroke="#38bdf8" strokeWidth="1" />
            </g>

            {/* Bottom Grid Plane (Layer 3) */}
            <g opacity="0.25">
              <polygon points="720,440 980,500 720,560 460,500" fill="none" stroke="#38bdf8" strokeWidth="1" strokeDasharray="3 3" />
            </g>

            {/* Vertical Projection Rays connecting the 3 layers */}
            <line x1="720" y1="160" x2="720" y2="560" stroke="#38bdf8" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
            <line x1="460" y1="220" x2="420" y2="370" stroke="#38bdf8" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />
            <line x1="980" y1="220" x2="1020" y2="370" stroke="#38bdf8" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />

            {/* Centered Luminous Amber/Orange Isometric Cube: STEP 04 */}
            <g transform="translate(0, 0)">
              {/* Cube Top Face */}
              <polygon
                points="720,290 770,315 720,340 670,315"
                fill="#3a1e05"
                stroke="#f59e0b"
                strokeWidth="2"
                filter="url(#amber-glow)"
              />
              {/* Cube Left Face */}
              <polygon
                points="670,315 720,340 720,400 670,375"
                fill="#241203"
                stroke="#f59e0b"
                strokeWidth="2"
              />
              {/* Cube Right Face */}
              <polygon
                points="720,340 770,315 770,375 720,400"
                fill="#2e1704"
                stroke="#f59e0b"
                strokeWidth="2"
              />

              {/* Cube Label "STEP 04" */}
              <text
                x="720"
                y="275"
                textAnchor="middle"
                fill="#fbbf24"
                fontSize="12"
                fontFamily="monospace"
                fontWeight="900"
                letterSpacing="2"
              >
                STEP 04
              </text>

              {/* Targeting HUD Reticle Crosshairs */}
              <circle cx="720" cy="345" r="75" fill="none" stroke="#f59e0b" strokeWidth="1" strokeDasharray="6 4" opacity="0.7" />
              <path d="M 720 250 L 720 265" stroke="#f59e0b" strokeWidth="2" />
              <path d="M 720 425 L 720 440" stroke="#f59e0b" strokeWidth="2" />
              <path d="M 625 345 L 640 345" stroke="#f59e0b" strokeWidth="2" />
              <path d="M 800 345 L 815 345" stroke="#f59e0b" strokeWidth="2" />
            </g>
          </g>
        )}

        {/* =====================================================================
            ACT V: THE PROOF — COUNTERFACTUAL FORK & DUAL EXECUTION LANES
            ===================================================================== */}
        {op5 > 0.01 && (
          <g opacity={op5} className="transition-opacity duration-150">
            {/* Glowing Connecting Fork Bezier Arrow */}
            <path
              d="M 520 380 C 620 380, 680 430, 780 430"
              fill="none"
              stroke="#10b981"
              strokeWidth="2.5"
              strokeDasharray="4 2"
              filter="url(#emerald-glow)"
            />
            {/* "FORK HERE" Pill Badge */}
            <g transform="translate(620, 395)">
              <rect width="86" height="22" rx="4" fill="#042f2e" stroke="#10b981" strokeWidth="1.2" />
              <text x="43" y="15" textAnchor="middle" fill="#34d399" fontSize="10" fontFamily="monospace" fontWeight="bold">
                FORK HERE →
              </text>
            </g>
          </g>
        )}

        {/* =====================================================================
            ACT VI: THE PATTERN — FLEET FAILURE ATLAS CONSTELLATION GRAPH
            ===================================================================== */}
        {op6 > 0.01 && (
          <g
            opacity={op6}
            transform={`translate(${mx * 0.3}, ${my * 0.3})`}
            className="transition-opacity duration-150"
          >
            {/* Cluster 1: Search Contamination (Blue/Cyan) */}
            <g transform="translate(520, 330)">
              <circle cx="0" cy="0" r="110" fill="url(#cluster-radial-blue)" />
              {/* Internal constellation lines */}
              <line x1="-30" y1="-20" x2="20" y2="-40" stroke="#38bdf8" strokeWidth="1" opacity="0.6" />
              <line x1="20" y1="-40" x2="40" y2="10" stroke="#38bdf8" strokeWidth="1" opacity="0.6" />
              <line x1="40" y1="10" x2="-10" y2="30" stroke="#38bdf8" strokeWidth="1" opacity="0.6" />
              <line x1="-10" y1="30" x2="-30" y2="-20" stroke="#38bdf8" strokeWidth="1" opacity="0.6" />
              {/* Points */}
              <circle cx="-30" cy="-20" r="3" fill="#38bdf8" />
              <circle cx="20" cy="-40" r="4" fill="#ffffff" filter="url(#cyan-glow)" />
              <circle cx="40" cy="10" r="3.5" fill="#38bdf8" />
              <circle cx="-10" cy="30" r="3" fill="#0284c7" />
              <circle cx="0" cy="0" r="6" fill="#38bdf8" filter="url(#cyan-glow)" />
            </g>

            {/* Cluster 2: Tool Misuse (Cyan) */}
            <g transform="translate(860, 300)">
              <circle cx="0" cy="0" r="90" fill="url(#cluster-radial-blue)" opacity="0.7" />
              <line x1="-20" y1="-30" x2="30" y2="-10" stroke="#22d3ee" strokeWidth="1" opacity="0.5" />
              <line x1="30" y1="-10" x2="10" y2="30" stroke="#22d3ee" strokeWidth="1" opacity="0.5" />
              <circle cx="-20" cy="-30" r="3" fill="#22d3ee" />
              <circle cx="30" cy="-10" r="4" fill="#ffffff" />
              <circle cx="10" cy="30" r="3" fill="#0891b2" />
            </g>

            {/* Cluster 3: Calculator Error (Amber) */}
            <g transform="translate(960, 420)">
              <circle cx="0" cy="0" r="80" fill="url(#cluster-radial-amber)" opacity="0.7" />
              <line x1="-20" y1="-10" x2="20" y2="-20" stroke="#f59e0b" strokeWidth="1" opacity="0.5" />
              <line x1="20" y1="-20" x2="10" y2="20" stroke="#f59e0b" strokeWidth="1" opacity="0.5" />
              <circle cx="-20" cy="-10" r="3" fill="#f59e0b" />
              <circle cx="20" cy="-20" r="4" fill="#fbbf24" filter="url(#amber-glow)" />
              <circle cx="10" cy="20" r="3" fill="#d97706" />
            </g>

            {/* Cluster 4: Memory Overwrite (Purple) */}
            <g transform="translate(560, 490)">
              <circle cx="0" cy="0" r="85" fill="url(#cluster-radial-purple)" opacity="0.7" />
              <line x1="-20" y1="10" x2="20" y2="-20" stroke="#a855f7" strokeWidth="1" opacity="0.5" />
              <circle cx="-20" cy="10" r="3.5" fill="#a855f7" />
              <circle cx="20" cy="-20" r="4" fill="#c084fc" />
            </g>

            {/* Cluster 5: Retrieval Mismatch (Emerald) */}
            <g transform="translate(800, 470)">
              <circle cx="0" cy="0" r="85" fill="#064e3b" opacity="0.3" />
              <line x1="-15" y1="-20" x2="25" y2="10" stroke="#10b981" strokeWidth="1" opacity="0.5" />
              <circle cx="-15" cy="-20" r="3.5" fill="#10b981" />
              <circle cx="25" cy="10" r="4" fill="#34d399" />
            </g>
          </g>
        )}

        {/* =====================================================================
            ACT VIII: ENTER BLACK BOX — LUMINOUS CYBERNETIC GLOBE / EARTH HORIZON
            ===================================================================== */}
        {op8 > 0.01 && (
          <g
            opacity={op8}
            transform={`translate(${mx * 0.2}, ${my * 0.2})`}
            className="transition-opacity duration-200"
          >
            {/* Atmospheric Rim Glow */}
            <ellipse cx="720" cy="880" rx="650" ry="420" fill="url(#globe-glow)" />

            {/* Cybernetic Wireframe Latitude / Longitude Arcs */}
            <g opacity="0.6">
              {/* Outer Perimeter Rim */}
              <ellipse cx="720" cy="880" rx="580" ry="380" fill="#040812" stroke="#38bdf8" strokeWidth="2" filter="url(#cyan-glow)" />

              {/* Concentric Latitude Arcs */}
              <ellipse cx="720" cy="880" rx="540" ry="340" fill="none" stroke="#0284c7" strokeWidth="1" strokeDasharray="4 4" />
              <ellipse cx="720" cy="880" rx="460" ry="280" fill="none" stroke="#0369a1" strokeWidth="1" />
              <ellipse cx="720" cy="880" rx="360" ry="210" fill="none" stroke="#0284c7" strokeWidth="1" strokeDasharray="3 3" />
              <ellipse cx="720" cy="880" rx="240" ry="140" fill="none" stroke="#38bdf8" strokeWidth="1" />

              {/* Longitude Curved Arcs */}
              <path d="M 140 880 C 340 600, 520 540, 720 540 C 920 540, 1100 600, 1300 880" fill="none" stroke="#0ea5e9" strokeWidth="1.2" />
              <path d="M 260 880 C 440 650, 580 600, 720 600 C 860 600, 1000 650, 1180 880" fill="none" stroke="#0284c7" strokeWidth="1" strokeDasharray="4 2" />
              <path d="M 400 880 C 520 700, 620 660, 720 660 C 820 660, 920 700, 1040 880" fill="none" stroke="#0284c7" strokeWidth="1" />

              {/* Glowing Distributed Orbital Network Nodes */}
              <circle cx="520" cy="620" r="3" fill="#ffffff" filter="url(#cyan-glow)" />
              <circle cx="680" cy="560" r="3.5" fill="#38bdf8" filter="url(#cyan-glow)" />
              <circle cx="840" cy="590" r="3" fill="#ffffff" filter="url(#cyan-glow)" />
              <circle cx="980" cy="680" r="3" fill="#38bdf8" />
              <circle cx="420" cy="710" r="2.5" fill="#38bdf8" />
              <circle cx="610" cy="680" r="3" fill="#7dd3fc" />
              <circle cx="790" cy="670" r="3" fill="#ffffff" />
            </g>
          </g>
        )}
      </svg>
    </div>
  );
};
