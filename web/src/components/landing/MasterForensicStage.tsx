import React, { useMemo } from 'react';

interface MasterForensicStageProps {
  progress: number; // 0.0 to 1.0 continuous normalized scroll progress
  mousePos: { x: number; y: number };
}

// Cubic bezier point calculation for smooth curve interpolation
function getBezierPoint(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number
) {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
  };
}

export const MasterForensicStage: React.FC<MasterForensicStageProps> = ({ progress, mousePos }) => {
  const p = Math.max(0, Math.min(1, progress));

  // Parallax offsets from cursor
  const mx = mousePos.x * 10;
  const my = mousePos.y * 6;

  // Chapter Normalized Sub-progresses [0, 1]
  // Ch 1: The Trace    [0.00 - 0.12]
  // Ch 2: The Run      [0.12 - 0.25]
  // Ch 3: The Failure  [0.25 - 0.38]
  // Ch 4: The Cause    [0.38 - 0.52]
  // Ch 5: The Proof    [0.52 - 0.66]
  // Ch 6: The Pattern  [0.66 - 0.79]
  // Ch 7: The Control  [0.79 - 0.91]
  // Ch 8: Final Enter  [0.91 - 1.00]

  const pCh1 = Math.max(0, Math.min(1, p / 0.12));
  const pCh2 = Math.max(0, Math.min(1, (p - 0.12) / 0.13));
  const pCh3 = Math.max(0, Math.min(1, (p - 0.25) / 0.13));
  const pCh4 = Math.max(0, Math.min(1, (p - 0.38) / 0.14));
  const pCh5 = Math.max(0, Math.min(1, (p - 0.52) / 0.14));
  const pCh6 = Math.max(0, Math.min(1, (p - 0.66) / 0.13));
  const pCh7 = Math.max(0, Math.min(1, (p - 0.79) / 0.12));
  const pCh8 = Math.max(0, Math.min(1, (p - 0.91) / 0.09));

  // Ambient technical starfield / coordinate ticks
  const ambientGrid = useMemo(() => {
    const points = [];
    for (let i = 0; i < 48; i++) {
      points.push({
        x: (i * 197) % 1400 + 20,
        y: (i * 131) % 820 + 30,
        size: i % 4 === 0 ? 2 : 1,
        opacity: 0.12 + ((i % 5) * 0.08),
      });
    }
    return points;
  }, []);

  // Canonical node definitions for the 7 execution steps
  const nodes = useMemo(() => [
    { id: '01', name: 'Input', sub: '12ms', x: 230, y: 290, type: 'SYS', tag: 'INPUT' },
    { id: '02', name: 'LLM', sub: '1.2s', x: 380, y: 290, type: 'LLM', tag: 'PLANNER' },
    { id: '03', name: 'Retrieval', sub: '642ms', x: 540, y: 290, type: 'VEC', tag: 'VEC-DB' },
    { id: '04', name: 'Search', sub: '1.8s', x: 710, y: 290, type: 'TOOL', tag: 'GUILTY' },
    { id: '05', name: 'LLM', sub: '2.1s', x: 880, y: 290, type: 'LLM', tag: 'SYNTH' },
    { id: '06', name: 'State', sub: '320ms', x: 1040, y: 290, type: 'MEM', tag: 'MUTATE' },
    { id: '07', name: 'Final', sub: '120ms', x: 1200, y: 290, type: 'OUT', tag: 'ANSWER' },
  ], []);

  // Execution photon position in Chapter 2 (0.12 -> 0.25)
  const photonX = 230 + pCh2 * (1200 - 230);
  const photonNodeIdx = Math.min(6, Math.floor(pCh2 * 7));

  // Failure spread states in Chapter 3 (0.25 -> 0.38)
  // Anomaly starts at step 04, spreads to 05, then 06
  const isAnomalous = p >= 0.25;
  const guiltyActive = pCh3 >= 0.25 || (p >= 0.38 && p < 0.52);
  const contam05 = pCh3 >= 0.50 || (p >= 0.38 && p < 0.52);
  const crash06 = pCh3 >= 0.75 || (p >= 0.38 && p < 0.52);

  // Replay rewind & fork states in Chapter 5 (0.52 -> 0.66)
  const forkActive = p >= 0.52 && p < 0.66;
  const replayExecutionX = 710 + pCh5 * (1200 - 710);

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none select-none overflow-hidden">
      <svg
        viewBox="0 0 1440 850"
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full"
      >
        <defs>
          {/* Cyan Glow */}
          <filter id="glow-cyan" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Crimson Red Glow */}
          <filter id="glow-red" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Amber Causal Glow */}
          <filter id="glow-amber" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Emerald Verification Glow */}
          <filter id="glow-emerald" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Gradients */}
          <linearGradient id="grad-cyan-sky" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>

          <linearGradient id="grad-red-fail" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#e11d48" />
          </linearGradient>

          <linearGradient id="grad-emerald-verify" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>

          <radialGradient id="radial-cyber-cyan" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="radial-alert-crimson" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="radial-amber-reticle" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ambient Subtle Coordinate Grid & Crosshairs */}
        <g opacity="0.35">
          {ambientGrid.map((pt, i) => (
            <g key={i}>
              <line
                x1={pt.x - 3}
                y1={pt.y}
                x2={pt.x + 3}
                y2={pt.y}
                stroke="#38bdf8"
                strokeWidth="0.8"
                opacity={pt.opacity}
              />
              <line
                x1={pt.x}
                y1={pt.y - 3}
                x2={pt.x}
                y2={pt.y + 3}
                stroke="#38bdf8"
                strokeWidth="0.8"
                opacity={pt.opacity}
              />
            </g>
          ))}
        </g>

        {/* =====================================================================
            ACT 1: THE TRACE [0.00 - 0.12]
            LIVING EXECUTION TOPOLOGY FRAMED ON THE RIGHT
            ===================================================================== */}
        {p < 0.16 && (
          <g
            opacity={p <= 0.10 ? 1 : Math.max(0, 1 - (p - 0.10) / 0.06)}
            transform={`translate(${mx * 0.4}, ${my * 0.4})`}
            className="transition-opacity duration-150"
          >
            {/* Ambient Cyan Volumetric Core */}
            <circle cx="1060" cy="380" r="210" fill="url(#radial-cyber-cyan)" opacity="0.75" />

            {/* Living Flow Streams — Multitude of Fine Fiber Traces */}
            <path
              d="M 660 520 C 760 620, 920 600, 1020 500 C 1120 400, 1180 320, 1060 250 C 940 180, 840 260, 910 360 C 980 460, 1140 450, 1260 380"
              fill="none"
              stroke="#22d3ee"
              strokeWidth="2"
              strokeDasharray="8 4"
              opacity="0.8"
              filter="url(#glow-cyan)"
            />
            <path
              d="M 680 470 C 780 420, 900 480, 970 410 C 1040 340, 1100 310, 1220 330"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1.6"
              opacity="0.65"
            />
            <path
              d="M 720 560 C 820 600, 980 570, 1060 470 C 1140 370, 1080 270, 990 250 C 900 230, 860 310, 930 380"
              fill="none"
              stroke="#0284c7"
              strokeWidth="1.2"
              strokeDasharray="4 2"
              opacity="0.5"
            />
            <path
              d="M 760 340 C 860 300, 990 320, 1080 380 C 1170 440, 1240 400, 1310 320"
              fill="none"
              stroke="#0ea5e9"
              strokeWidth="1.2"
              opacity="0.45"
            />

            {/* Glowing Traveling Signal Packets */}
            <circle cx="1020" cy="500" r="4" fill="#ffffff" filter="url(#glow-cyan)" />
            <circle cx="910" cy="360" r="3.5" fill="#22d3ee" filter="url(#glow-cyan)" />
            <circle cx="1060" cy="250" r="3" fill="#67e8f9" />
            <circle cx="780" cy="420" r="2.5" fill="#38bdf8" />
            <circle cx="1220" cy="330" r="3" fill="#38bdf8" />

            {/* Semi-transparent 3D Isometric Machine Chassis */}
            <g transform="translate(130, 25)">
              {/* Isometric Top Face */}
              <polygon
                points="930,220 1070,290 930,360 790,290"
                fill="#0b1323"
                stroke="#38bdf8"
                strokeWidth="1.8"
                opacity="0.9"
              />
              {/* Isometric Left Face */}
              <polygon
                points="790,290 930,360 930,520 790,450"
                fill="#080e1a"
                stroke="#1e3a5f"
                strokeWidth="1.8"
                opacity="0.95"
              />
              {/* Isometric Right Face */}
              <polygon
                points="930,360 1070,290 1070,450 930,520"
                fill="#0a1222"
                stroke="#38bdf8"
                strokeWidth="1.8"
                opacity="0.95"
              />

              {/* Top Face Internal Grid Matrix */}
              <line x1="860" y1="255" x2="1000" y2="325" stroke="#1f2937" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="860" y1="325" x2="1000" y2="255" stroke="#1f2937" strokeWidth="1" strokeDasharray="3 3" />

              {/* Right Face Engraving "BLACK BOX" */}
              <g transform="translate(960, 420) skewY(-26.5) scale(0.9, 1)">
                <text
                  x="0"
                  y="0"
                  fill="#38bdf8"
                  fontSize="18"
                  fontWeight="900"
                  fontFamily="monospace"
                  letterSpacing="4"
                  opacity="0.9"
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
                  opacity="0.75"
                >
                  AI FLIGHT RECORDER // v2.4
                </text>
              </g>

              {/* Technical Corner Brackets */}
              <path d="M 780 285 L 780 275 L 790 275" stroke="#38bdf8" strokeWidth="1.5" fill="none" />
              <path d="M 1080 285 L 1080 275 L 1070 275" stroke="#38bdf8" strokeWidth="1.5" fill="none" />
              <path d="M 930 210 L 930 200" stroke="#38bdf8" strokeWidth="1.5" />
              <path d="M 930 530 L 930 540" stroke="#38bdf8" strokeWidth="1.5" />
            </g>
          </g>
        )}

        {/* =====================================================================
            ACTS 2, 3, 4: CONTINUOUS CANONICAL EXECUTION GRAPH [0.12 - 0.52]
            Horizontal 7-Node Directed Acyclic Graph (DAG)
            Transforms seamlessly: Normal Run -> Anomaly Spread -> Causal Isolation
            ===================================================================== */}
        {p >= 0.10 && p < 0.54 && (
          <g
            opacity={
              p < 0.13
                ? (p - 0.10) / 0.03
                : p > 0.50
                ? Math.max(0, 1 - (p - 0.50) / 0.04)
                : 1
            }
            className="transition-opacity duration-150"
          >
            {/* Connecting Bezier Transmission Cables between Nodes */}
            {/* Segment 01 -> 02 */}
            <path
              d="M 275 290 L 335 290"
              fill="none"
              stroke={p >= 0.14 ? '#38bdf8' : '#1e293b'}
              strokeWidth="2.5"
              filter={p >= 0.14 ? 'url(#glow-cyan)' : undefined}
            />
            {/* Segment 02 -> 03 */}
            <path
              d="M 425 290 L 495 290"
              fill="none"
              stroke={p >= 0.17 ? '#38bdf8' : '#1e293b'}
              strokeWidth="2.5"
              filter={p >= 0.17 ? 'url(#glow-cyan)' : undefined}
            />
            {/* Segment 03 -> 04 */}
            <path
              d="M 585 290 L 665 290"
              fill="none"
              stroke={guiltyActive ? '#f43f5e' : p >= 0.20 ? '#38bdf8' : '#1e293b'}
              strokeWidth={guiltyActive ? '3' : '2.5'}
              filter={guiltyActive ? 'url(#glow-red)' : p >= 0.20 ? 'url(#glow-cyan)' : undefined}
            />
            {/* Segment 04 -> 05 (Contamination vector) */}
            <path
              d="M 755 290 L 835 290"
              fill="none"
              stroke={contam05 ? '#f43f5e' : p >= 0.22 ? '#38bdf8' : '#1e293b'}
              strokeWidth={contam05 ? '3' : '2.5'}
              strokeDasharray={contam05 ? '6 3' : undefined}
              filter={contam05 ? 'url(#glow-red)' : p >= 0.22 ? 'url(#glow-cyan)' : undefined}
            />
            {/* Segment 05 -> 06 (Crash cascade) */}
            <path
              d="M 925 290 L 995 290"
              fill="none"
              stroke={crash06 ? '#f43f5e' : p >= 0.24 ? '#38bdf8' : '#1e293b'}
              strokeWidth={crash06 ? '3' : '2.5'}
              strokeDasharray={crash06 ? '6 3' : undefined}
              filter={crash06 ? 'url(#glow-red)' : p >= 0.24 ? 'url(#glow-cyan)' : undefined}
            />
            {/* Segment 06 -> 07 */}
            <path
              d="M 1085 290 L 1155 290"
              fill="none"
              stroke={crash06 ? '#334155' : p >= 0.24 ? '#38bdf8' : '#1e293b'}
              strokeWidth="2"
              strokeDasharray={crash06 ? '3 3' : undefined}
            />

            {/* Traveling Execution Photon (Active in Ch 2) */}
            {p >= 0.12 && p < 0.25 && (
              <g transform={`translate(${photonX}, 290)`}>
                <circle cx="0" cy="0" r="8" fill="#ffffff" filter="url(#glow-cyan)" />
                <circle cx="0" cy="0" r="14" fill="none" stroke="#38bdf8" strokeWidth="1.5" opacity="0.75" />
              </g>
            )}

            {/* Render 7 Canonical Execution Nodes */}
            {nodes.map((nd, idx) => {
              // Determine individual node status based on scroll stage
              let isGuiltyNode = nd.id === '04' && guiltyActive;
              let isContamNode = nd.id === '05' && contam05;
              let isCrashNode = nd.id === '06' && crash06;
              let isDimmed = (p >= 0.25 && (nd.id === '01' || nd.id === '02' || nd.id === '03')) || (crash06 && nd.id === '07');
              let isRunning = p >= 0.12 && p < 0.25 && idx === photonNodeIdx;
              let isComplete = p >= 0.12 && p < 0.25 && idx < photonNodeIdx;

              // Node box dimensions
              const w = nd.id === '04' ? 90 : nd.id === '03' || nd.id === '05' ? 85 : 70;
              const h = 76;
              const nx = nd.x - w / 2;
              const ny = nd.y - h / 2;

              return (
                <g
                  key={nd.id}
                  opacity={isDimmed ? 0.35 : 1}
                  className="transition-all duration-200"
                >
                  {/* Outer Glow Halo for Guilty Node */}
                  {isGuiltyNode && (
                    <rect
                      x={nx - 8}
                      y={ny - 8}
                      width={w + 16}
                      height={h + 16}
                      rx="12"
                      fill="none"
                      stroke="#f43f5e"
                      strokeWidth="1.5"
                      strokeDasharray="4 2"
                      opacity="0.85"
                    />
                  )}

                  {/* Main Node Background Card */}
                  <rect
                    x={nx}
                    y={ny}
                    width={w}
                    height={h}
                    rx="8"
                    fill={
                      isGuiltyNode
                        ? '#18070d'
                        : isContamNode
                        ? '#1f1305'
                        : isCrashNode
                        ? '#1e0a0f'
                        : isRunning
                        ? '#0c1b2f'
                        : '#080e18'
                    }
                    stroke={
                      isGuiltyNode
                        ? '#f43f5e'
                        : isContamNode
                        ? '#f59e0b'
                        : isCrashNode
                        ? '#f43f5e'
                        : isRunning
                        ? '#38bdf8'
                        : isComplete
                        ? '#0284c7'
                        : '#1e293b'
                    }
                    strokeWidth={isGuiltyNode || isRunning ? '2' : '1.5'}
                    filter={
                      isGuiltyNode
                        ? 'url(#glow-red)'
                        : isContamNode
                        ? 'url(#glow-amber)'
                        : isRunning
                        ? 'url(#glow-cyan)'
                        : undefined
                    }
                  />

                  {/* Node Step Number */}
                  <text
                    x={nd.x}
                    y={ny + 20}
                    textAnchor="middle"
                    fill={
                      isGuiltyNode
                        ? '#f43f5e'
                        : isContamNode
                        ? '#f59e0b'
                        : isRunning
                        ? '#38bdf8'
                        : '#64748b'
                    }
                    fontSize="10"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {nd.id}
                  </text>

                  {/* Node Title */}
                  <text
                    x={nd.x}
                    y={ny + 42}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize={nd.id === '04' ? '13' : '11'}
                    fontWeight="bold"
                  >
                    {nd.name}
                  </text>

                  {/* Node Sub-label / Timing */}
                  <text
                    x={nd.x}
                    y={ny + 62}
                    textAnchor="middle"
                    fill={
                      isGuiltyNode
                        ? '#fb7185'
                        : isContamNode
                        ? '#fcd34d'
                        : isCrashNode
                        ? '#fca5a5'
                        : isRunning
                        ? '#38bdf8'
                        : '#64748b'
                    }
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    {nd.sub}
                  </text>

                  {/* "GUILTY STEP" Badge directly below Node 04 */}
                  {isGuiltyNode && (
                    <g transform={`translate(${nd.x - 42}, ${ny + h + 8})`}>
                      <rect
                        width="84"
                        height="20"
                        rx="4"
                        fill="#881337"
                        stroke="#f43f5e"
                        strokeWidth="1"
                      />
                      <text
                        x="42"
                        y="14"
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="9"
                        fontFamily="monospace"
                        fontWeight="bold"
                        letterSpacing="1"
                      >
                        GUILTY STEP
                      </text>
                    </g>
                  )}

                  {/* "CONTAMINATED" Badge directly below Node 05 */}
                  {isContamNode && !isGuiltyNode && (
                    <g transform={`translate(${nd.x - 44}, ${ny + h + 8})`}>
                      <rect
                        width="88"
                        height="18"
                        rx="4"
                        fill="#451a03"
                        stroke="#f59e0b"
                        strokeWidth="1"
                      />
                      <text
                        x="44"
                        y="13"
                        textAnchor="middle"
                        fill="#fde68a"
                        fontSize="8"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        CONTAMINATED
                      </text>
                    </g>
                  )}

                  {/* "CRASH: NPE" Badge directly below Node 06 */}
                  {isCrashNode && (
                    <g transform={`translate(${nd.x - 40}, ${ny + h + 8})`}>
                      <rect
                        width="80"
                        height="18"
                        rx="4"
                        fill="#4c0519"
                        stroke="#f43f5e"
                        strokeWidth="1"
                      />
                      <text
                        x="40"
                        y="13"
                        textAnchor="middle"
                        fill="#fecdd3"
                        fontSize="8"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        CRASH: NPE
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Act 4 Causal Isolation Reticle: Locks onto Step 04 */}
            {p >= 0.38 && p < 0.52 && (
              <g transform="translate(710, 290)">
                {/* Radial Amber Attention Glow */}
                <circle cx="0" cy="0" r="160" fill="url(#radial-amber-reticle)" opacity="0.8" />

                {/* HUD Targeting Reticle Circles */}
                <circle
                  cx="0"
                  cy="0"
                  r="85"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="1.5"
                  strokeDasharray="6 3"
                  opacity="0.8"
                />
                <circle
                  cx="0"
                  cy="0"
                  r="110"
                  fill="none"
                  stroke="#d97706"
                  strokeWidth="1"
                  strokeDasharray="3 6"
                  opacity="0.4"
                />

                {/* Precision HUD Reticle Crosshairs */}
                <line x1="-95" y1="0" x2="-75" y2="0" stroke="#f59e0b" strokeWidth="2" />
                <line x1="75" y1="0" x2="95" y2="0" stroke="#f59e0b" strokeWidth="2" />
                <line x1="0" y1="-95" x2="0" y2="-75" stroke="#f59e0b" strokeWidth="2" />
                <line x1="0" y1="75" x2="0" y2="95" stroke="#f59e0b" strokeWidth="2" />

                {/* 3D Wireframe Depth Projections from Step 04 */}
                <line x1="45" y1="-38" x2="160" y2="-90" stroke="#f59e0b" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
                <line x1="45" y1="38" x2="160" y2="90" stroke="#f59e0b" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />

                {/* Callout Box: Step 04 Attribution */}
                <g transform="translate(160, -110)">
                  <rect width="180" height="48" rx="6" fill="#180e03" stroke="#f59e0b" strokeWidth="1.2" />
                  <text x="12" y="20" fill="#f59e0b" fontSize="10" fontFamily="monospace" fontWeight="bold">
                    ISOLATED ROOT CAUSE
                  </text>
                  <text x="12" y="36" fill="#cbd5e1" fontSize="10" fontFamily="monospace">
                    STEP 04: TOOL SEARCH
                  </text>
                </g>
              </g>
            )}
          </g>
        )}

        {/* =====================================================================
            ACT 5: THE PROOF [0.52 - 0.66]
            COUNTERFACTUAL FORK & DUAL EXECUTION LANES
            Rewinds to Step 04, branches downward, executes replay successfully
            ===================================================================== */}
        {p >= 0.50 && p < 0.68 && (
          <g
            opacity={
              p < 0.53
                ? (p - 0.50) / 0.03
                : p > 0.64
                ? Math.max(0, 1 - (p - 0.64) / 0.04)
                : 1
            }
            className="transition-opacity duration-150"
          >
            {/* Ambient Emerald Proof Glow */}
            <circle cx="860" cy="380" r="180" fill="url(#radial-cyber-cyan)" opacity="0.4" />

            {/* UPPER RAIL: ORIGINAL RUN [FAILED] */}
            <g transform="translate(0, -60)">
              {/* Rail Label */}
              <text x="180" y="275" fill="#f43f5e" fontSize="11" fontFamily="monospace" fontWeight="bold">
                [✕] ORIGINAL RUN — FAILED
              </text>

              {/* Connecting Cable */}
              <path
                d="M 180 300 L 1260 300"
                fill="none"
                stroke="#47101b"
                strokeWidth="2.5"
              />

              {/* Original Steps */}
              {nodes.map((nd) => (
                <g key={`orig-${nd.id}`} transform={`translate(${nd.x - 30}, 275)`}>
                  <rect
                    width="60"
                    height="50"
                    rx="6"
                    fill={nd.id === '04' ? '#3b0d18' : '#11070a'}
                    stroke={nd.id === '04' || nd.id === '05' || nd.id === '06' ? '#f43f5e' : '#334155'}
                    strokeWidth="1.2"
                  />
                  <text x="30" y="22" textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="monospace">
                    {nd.id}
                  </text>
                  <text x="30" y="38" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">
                    {nd.name}
                  </text>
                </g>
              ))}
            </g>

            {/* GREEN FORK CONNECTOR from Step 04 */}
            <path
              d="M 710 270 C 710 320, 710 330, 710 380"
              fill="none"
              stroke="#10b981"
              strokeWidth="3"
              strokeDasharray="6 3"
              filter="url(#glow-emerald)"
            />
            {/* "FORK HERE" Pill Badge */}
            <g transform="translate(668, 315)">
              <rect width="84" height="24" rx="4" fill="#022c22" stroke="#10b981" strokeWidth="1.5" />
              <text x="42" y="16" textAnchor="middle" fill="#34d399" fontSize="10" fontFamily="monospace" fontWeight="bold">
                FORK HERE →
              </text>
            </g>

            {/* LOWER RAIL: REPLAY RUN [VERIFIED] */}
            <g transform="translate(0, 100)">
              {/* Rail Label */}
              <text x="180" y="275" fill="#34d399" fontSize="11" fontFamily="monospace" fontWeight="bold">
                [✓] REPLAY RUN — COUNTERFACTUAL VERIFIED
              </text>

              {/* Connecting Cable */}
              <path
                d="M 180 300 L 1260 300"
                fill="none"
                stroke={pCh5 >= 0.5 ? '#10b981' : '#1e3a5f'}
                strokeWidth="2.5"
                filter={pCh5 >= 0.5 ? 'url(#glow-emerald)' : undefined}
              />

              {/* Replay Steps */}
              {nodes.map((nd) => {
                const isPatched = nd.id === '04';
                const isReused = nd.id === '01' || nd.id === '02' || nd.id === '03';
                const isExecuted = nd.id === '05' || nd.id === '06' || nd.id === '07';

                return (
                  <g key={`rep-${nd.id}`} transform={`translate(${nd.x - 32}, 275)`}>
                    <rect
                      width="64"
                      height="52"
                      rx="6"
                      fill={isPatched ? '#042f2e' : isReused ? '#071524' : '#06201b'}
                      stroke={isPatched ? '#22d3ee' : isExecuted ? '#10b981' : '#0284c7'}
                      strokeWidth={isPatched || isExecuted ? '1.8' : '1.2'}
                      filter={isPatched ? 'url(#glow-cyan)' : isExecuted ? 'url(#glow-emerald)' : undefined}
                    />
                    <text x="32" y="18" textAnchor="middle" fill="#38bdf8" fontSize="9" fontFamily="monospace">
                      {nd.id}
                    </text>
                    <text x="32" y="34" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">
                      {nd.name}
                    </text>
                    <text
                      x="32"
                      y="46"
                      textAnchor="middle"
                      fill={isPatched ? '#22d3ee' : isReused ? '#64748b' : '#34d399'}
                      fontSize="8"
                      fontFamily="monospace"
                    >
                      {isPatched ? '[PATCHED]' : isReused ? '[REUSED]' : '[EXEC]'}
                    </text>
                  </g>
                );
              })}
            </g>
          </g>
        )}

        {/* =====================================================================
            ACT 6: THE PATTERN [0.66 - 0.79]
            FLEET FAILURE ATLAS CONSTELLATION
            Multi-run traces collapse into semantic failure fingerprints
            ===================================================================== */}
        {p >= 0.64 && p < 0.81 && (
          <g
            opacity={
              p < 0.67
                ? (p - 0.64) / 0.03
                : p > 0.77
                ? Math.max(0, 1 - (p - 0.77) / 0.04)
                : 1
            }
            transform={`translate(${mx * 0.3}, ${my * 0.3})`}
            className="transition-opacity duration-150"
          >
            {/* Cluster 1: Search Contamination (Cyan / Blue, 43 runs · 12.7%) */}
            <g transform="translate(560, 360)">
              <circle cx="0" cy="0" r="120" fill="url(#radial-cyber-cyan)" opacity="0.9" />
              {/* Star-network lines */}
              <line x1="-35" y1="-25" x2="25" y2="-45" stroke="#38bdf8" strokeWidth="1.2" opacity="0.7" />
              <line x1="25" y1="-45" x2="45" y2="15" stroke="#38bdf8" strokeWidth="1.2" opacity="0.7" />
              <line x1="45" y1="15" x2="-15" y2="35" stroke="#38bdf8" strokeWidth="1.2" opacity="0.7" />
              <line x1="-15" y1="35" x2="-35" y2="-25" stroke="#38bdf8" strokeWidth="1.2" opacity="0.7" />
              {/* Nodes */}
              <circle cx="-35" cy="-25" r="3.5" fill="#38bdf8" />
              <circle cx="25" cy="-45" r="4.5" fill="#ffffff" filter="url(#glow-cyan)" />
              <circle cx="45" cy="15" r="4" fill="#38bdf8" />
              <circle cx="-15" cy="35" r="3.5" fill="#0284c7" />
              <circle cx="0" cy="0" r="7" fill="#22d3ee" filter="url(#glow-cyan)" />

              {/* Floating Tooltip Box from Reference */}
              <g transform="translate(-80, -95)">
                <rect width="160" height="42" rx="6" fill="#080e1a" stroke="#38bdf8" strokeWidth="1.2" />
                <text x="12" y="18" fill="#ffffff" fontSize="10" fontWeight="bold">
                  Search Contamination
                </text>
                <text x="12" y="32" fill="#38bdf8" fontSize="9" fontFamily="monospace">
                  43 runs · 12.7%  [View →]
                </text>
              </g>
            </g>

            {/* Cluster 2: Tool Misuse (Sky Blue) */}
            <g transform="translate(900, 310)">
              <circle cx="0" cy="0" r="95" fill="url(#radial-cyber-cyan)" opacity="0.7" />
              <line x1="-25" y1="-30" x2="35" y2="-10" stroke="#22d3ee" strokeWidth="1" opacity="0.6" />
              <line x1="35" y1="-10" x2="15" y2="35" stroke="#22d3ee" strokeWidth="1" opacity="0.6" />
              <circle cx="-25" cy="-30" r="3.5" fill="#22d3ee" />
              <circle cx="35" cy="-10" r="4" fill="#ffffff" />
              <circle cx="15" cy="35" r="3" fill="#0891b2" />
              <circle cx="0" cy="0" r="5" fill="#38bdf8" />
              <text x="0" y="55" textAnchor="middle" fill="#67e8f9" fontSize="10" fontFamily="monospace">
                Tool Misuse
              </text>
            </g>

            {/* Cluster 3: Calculator Error (Amber) */}
            <g transform="translate(1020, 440)">
              <circle cx="0" cy="0" r="85" fill="url(#radial-amber-reticle)" opacity="0.8" />
              <line x1="-20" y1="-20" x2="25" y2="-15" stroke="#f59e0b" strokeWidth="1" opacity="0.6" />
              <line x1="25" y1="-15" x2="15" y2="25" stroke="#f59e0b" strokeWidth="1" opacity="0.6" />
              <circle cx="-20" cy="-20" r="3" fill="#f59e0b" />
              <circle cx="25" cy="-15" r="4.5" fill="#fbbf24" filter="url(#glow-amber)" />
              <circle cx="15" cy="25" r="3" fill="#d97706" />
              <text x="0" y="48" textAnchor="middle" fill="#fbbf24" fontSize="10" fontFamily="monospace">
                Calculator Error
              </text>
            </g>

            {/* Cluster 4: Memory Overwrite (Purple) */}
            <g transform="translate(640, 520)">
              <circle cx="0" cy="0" r="75" fill="#581c87" opacity="0.25" />
              <line x1="-20" y1="10" x2="20" y2="-20" stroke="#a855f7" strokeWidth="1" opacity="0.6" />
              <circle cx="-20" cy="10" r="3.5" fill="#a855f7" />
              <circle cx="20" cy="-20" r="4" fill="#c084fc" />
              <text x="0" y="38" textAnchor="middle" fill="#c084fc" fontSize="10" fontFamily="monospace">
                Memory Overwrite
              </text>
            </g>

            {/* Cluster 5: Retrieval Mismatch (Emerald) */}
            <g transform="translate(820, 490)">
              <circle cx="0" cy="0" r="75" fill="#064e3b" opacity="0.3" />
              <line x1="-15" y1="-20" x2="25" y2="10" stroke="#10b981" strokeWidth="1" opacity="0.6" />
              <circle cx="-15" cy="-20" r="3.5" fill="#10b981" />
              <circle cx="25" cy="10" r="4" fill="#34d399" />
              <text x="0" y="36" textAnchor="middle" fill="#34d399" fontSize="10" fontFamily="monospace">
                Retrieval Mismatch
              </text>
            </g>
          </g>
        )}

        {/* =====================================================================
            ACT 7: THE CONTROL [0.79 - 0.91]
            GUARDIAN RUNTIME INTERCEPT
            Live execution line paused in mid-flight by active policy boundary
            ===================================================================== */}
        {p >= 0.77 && p < 0.93 && (
          <g
            opacity={
              p < 0.80
                ? (p - 0.77) / 0.03
                : p > 0.89
                ? Math.max(0, 1 - (p - 0.89) / 0.04)
                : 1
            }
            className="transition-opacity duration-150"
          >
            {/* Horizontal Intercept Transmission Line */}
            <path
              d="M 260 260 L 710 260"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="3"
              filter="url(#glow-cyan)"
            />
            <path
              d="M 710 260 L 1180 260"
              fill="none"
              stroke="#334155"
              strokeWidth="2"
              strokeDasharray="4 4"
            />

            {/* Pulsing Intercept Barrier Laser at x=710 */}
            <line
              x1="710"
              y1="160"
              x2="710"
              y2="360"
              stroke="#f43f5e"
              strokeWidth="3"
              strokeDasharray="6 3"
              filter="url(#glow-red)"
            />
            {/* Barrier Warning Crosshair */}
            <circle cx="710" cy="260" r="16" fill="#881337" stroke="#f43f5e" strokeWidth="2" filter="url(#glow-red)" />
            <text x="710" y="264" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="bold">
              ||
            </text>

            {/* Pipeline Stage Badges along the wire */}
            <g transform="translate(290, 240)">
              <rect width="100" height="40" rx="6" fill="#080e18" stroke="#38bdf8" strokeWidth="1.2" />
              <text x="50" y="24" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">
                01 Agent Run
              </text>
            </g>
            <g transform="translate(480, 240)">
              <rect width="120" height="40" rx="6" fill="#180e03" stroke="#f59e0b" strokeWidth="1.2" />
              <text x="60" y="24" textAnchor="middle" fill="#fde68a" fontSize="10" fontWeight="bold">
                02 Anomaly Detected
              </text>
            </g>
            <g transform="translate(660, 240)">
              <rect width="100" height="40" rx="6" fill="#3b0714" stroke="#f43f5e" strokeWidth="1.5" filter="url(#glow-red)" />
              <text x="50" y="24" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">
                Run Paused
              </text>
            </g>
            <g transform="translate(830, 240)">
              <rect width="120" height="40" rx="6" fill="#080e18" stroke="#334155" strokeWidth="1.2" opacity="0.6" />
              <text x="60" y="24" textAnchor="middle" fill="#94a3b8" fontSize="10">
                04 Cause Identified
              </text>
            </g>
            <g transform="translate(1010, 240)">
              <rect width="120" height="40" rx="6" fill="#080e18" stroke="#334155" strokeWidth="1.2" opacity="0.6" />
              <text x="60" y="24" textAnchor="middle" fill="#94a3b8" fontSize="10">
                05 Operator Decision
              </text>
            </g>
          </g>
        )}

        {/* =====================================================================
            ACT 8: ENTER BLACK BOX [0.91 - 1.00]
            CYBERNETIC PLANETARY HORIZON RESOLUTION
            Curving atmospheric rim with glowing orbital telemetry nodes
            ===================================================================== */}
        {p >= 0.88 && (
          <g
            opacity={Math.max(0, Math.min(1, (p - 0.88) / 0.08))}
            transform={`translate(${mx * 0.2}, ${my * 0.2})`}
            className="transition-opacity duration-200"
          >
            {/* Atmospheric Glow Rim */}
            <ellipse cx="720" cy="880" rx="640" ry="400" fill="url(#radial-cyber-cyan)" opacity="0.5" />

            {/* Globe Wireframe Horizon Rings */}
            <ellipse
              cx="720"
              cy="880"
              rx="580"
              ry="360"
              fill="#040812"
              stroke="#38bdf8"
              strokeWidth="2"
              filter="url(#glow-cyan)"
            />
            <ellipse cx="720" cy="880" rx="520" ry="320" fill="none" stroke="#0284c7" strokeWidth="1" strokeDasharray="4 4" />
            <ellipse cx="720" cy="880" rx="440" ry="260" fill="none" stroke="#0369a1" strokeWidth="1" />
            <ellipse cx="720" cy="880" rx="340" ry="190" fill="none" stroke="#0284c7" strokeWidth="1" strokeDasharray="3 3" />

            {/* Longitude Arcs */}
            <path d="M 160 880 C 340 620, 520 560, 720 560 C 920 560, 1100 620, 1280 880" fill="none" stroke="#0ea5e9" strokeWidth="1.2" />
            <path d="M 280 880 C 440 660, 580 620, 720 620 C 860 620, 1000 660, 1160 880" fill="none" stroke="#0284c7" strokeWidth="1" strokeDasharray="4 2" />

            {/* Glowing Satellite Nodes on Horizon */}
            <circle cx="520" cy="620" r="3.5" fill="#ffffff" filter="url(#glow-cyan)" />
            <circle cx="720" cy="560" r="4" fill="#38bdf8" filter="url(#glow-cyan)" />
            <circle cx="920" cy="620" r="3.5" fill="#ffffff" filter="url(#glow-cyan)" />
          </g>
        )}
      </svg>
    </div>
  );
};
