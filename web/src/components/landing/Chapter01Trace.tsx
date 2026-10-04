import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, ChevronDown } from 'lucide-react';

interface Chapter01Props {
  onOpenAuth: () => void;
  onExploreClick: () => void;
}

export const Chapter01Trace: React.FC<Chapter01Props> = ({ onOpenAuth, onExploreClick }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });

  const convergeProgress = useTransform(scrollYProgress, [0, 0.7], [0, 1]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.3]);

  // Subtle interactive particle & fine wire lines canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    // Number of fine technical vector lines in the field
    const lineCount = 36;
    const nodes = [
      { label: 'INPUT', xRatio: 0.12 },
      { label: 'RETRIEVAL', xRatio: 0.28 },
      { label: 'LLM: PLANNER', xRatio: 0.44 },
      { label: 'TOOL: SQL_EXEC', xRatio: 0.60 },
      { label: 'LLM: SYNTHESIZE', xRatio: 0.76 },
      { label: 'FINAL: EMIT', xRatio: 0.90 },
    ];

    let t = 0;

    const render = () => {
      t += 0.015;
      ctx.clearRect(0, 0, width, height);

      const conv = convergeProgress.get();
      const centerY = height * 0.72;

      // Draw subtle technical grid lines
      ctx.strokeStyle = 'rgba(31, 41, 55, 0.25)';
      ctx.lineWidth = 1;
      const step = 48;
      for (let x = 0; x < width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Draw converging field of fine technical trajectory lines
      for (let i = 0; i < lineCount; i++) {
        const spreadY = (i / (lineCount - 1) - 0.5) * height * 0.65;
        const baseY = height * 0.45 + spreadY;
        const targetY = centerY;

        // Current line Y blends from dispersed spread to converged central trajectory
        const currentY = baseY * (1 - conv) + targetY * conv;

        ctx.beginPath();
        ctx.moveTo(0, currentY);

        for (let seg = 1; seg <= 20; seg++) {
          const segX = (seg / 20) * width;

          // Wave offset
          const wave = Math.sin(t + seg * 0.4 + i * 0.2) * (8 * (1 - conv) + 2);

          // Cursor deflection (nearby lines deflect subtly)
          const dx = segX - mousePos.x;
          const dy = currentY - mousePos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const cursorDeflection = dist < 180 ? (1 - dist / 180) * 22 : 0;

          ctx.lineTo(segX, currentY + wave - cursorDeflection);
        }

        ctx.strokeStyle =
          i === Math.floor(lineCount / 2)
            ? `rgba(56, 189, 248, ${0.4 + conv * 0.5})`
            : `rgba(75, 85, 99, ${0.12 * (1 - conv * 0.6)})`;
        ctx.lineWidth = i === Math.floor(lineCount / 2) ? 2 : 0.8;
        ctx.stroke();
      }

      // Draw converged execution trace nodes when converging
      if (conv > 0.05) {
        nodes.forEach((node, idx) => {
          const nodeX = width * node.xRatio;
          const nodeY = centerY;
          const nodeAlpha = Math.min(1, conv * 1.5);

          // Connecting line between nodes
          if (idx < nodes.length - 1) {
            const nextX = width * nodes[idx + 1].xRatio;
            ctx.beginPath();
            ctx.moveTo(nodeX, nodeY);
            ctx.lineTo(nextX, nodeY);
            ctx.strokeStyle = `rgba(56, 189, 248, ${0.35 * nodeAlpha})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }

          // Node marker
          ctx.beginPath();
          ctx.arc(nodeX, nodeY, 4, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(56, 189, 248, ${nodeAlpha})`;
          ctx.fill();
          ctx.strokeStyle = '#05070b';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Node pulse ring
          ctx.beginPath();
          ctx.arc(nodeX, nodeY, 8 + Math.sin(t * 2 + idx) * 3, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(56, 189, 248, ${0.25 * nodeAlpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();

          // Label
          ctx.font = '10px "JetBrains Mono", monospace';
          ctx.fillStyle = `rgba(229, 231, 235, ${nodeAlpha * 0.85})`;
          ctx.textAlign = 'center';
          ctx.fillText(node.label, nodeX, nodeY - 14);

          // Step index
          ctx.font = '8px "JetBrains Mono", monospace';
          ctx.fillStyle = `rgba(156, 163, 175, ${nodeAlpha * 0.6})`;
          ctx.fillText(`0${idx + 1}`, nodeX, nodeY + 16);
        });
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
    };
  }, [convergeProgress, mousePos]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseLeave = () => {
    setMousePos({ x: -1000, y: -1000 });
  };

  return (
    <section
      ref={containerRef}
      id="ch-01"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative min-h-[120vh] flex flex-col justify-between pt-28 pb-16 px-6 sm:px-12 md:px-20 overflow-hidden font-sans border-b border-[#1f2937]/50"
    >
      {/* Background Interactive Wireframe Field Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* Top Editorial Identity & Negative Space */}
      <motion.div style={{ opacity: heroOpacity }} className="relative z-10 max-w-4xl pt-6 md:pt-12">
        {/* Subtle Technical Identifier */}
        <div className="inline-flex items-center gap-2 mb-6 text-xs font-mono text-zinc-400 tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          <span className="uppercase">CHAPTER 01 // THE TRACE</span>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-500">BIT-EXACT INGESTION</span>
        </div>

        {/* Strong Architectural Headline */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-light text-white tracking-tight uppercase leading-[1.06] mb-6">
          Record what the agent <br />
          <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-zinc-400">
            actually did.
          </span>
        </h1>

        {/* Restrained Explanatory Copy */}
        <p className="text-base sm:text-lg text-zinc-400 font-normal max-w-2xl leading-relaxed mb-8">
          Multi-step AI agents fail silently. Traditional loggers only capture the final crash, not the root error.
          Black Box records complete execution save-points with zero in-loop latency overhead.
        </p>

        {/* Primary Action Row */}
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={onOpenAuth}
            className="px-6 py-3 rounded bg-white hover:bg-zinc-200 text-black font-semibold text-xs font-mono tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/10 active:scale-[0.98]"
          >
            <span>OPEN BLACK BOX</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={onExploreClick}
            className="px-5 py-3 rounded border border-[#1f2937] hover:border-zinc-500 bg-[#090d15]/80 hover:bg-[#0f1523] text-zinc-300 text-xs font-mono tracking-wider transition-all flex items-center gap-2 cursor-pointer"
          >
            <span>WATCH THE TRACE</span>
            <ChevronDown className="w-4 h-4 text-cyan-400 animate-bounce" />
          </button>
        </div>
      </motion.div>

      {/* Dynamic Trace Convergence Indicator at Base */}
      <div className="relative z-10 flex items-center justify-between pt-12 border-t border-[#1f2937]/40 text-[10px] font-mono text-zinc-500">
        <span className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span>FIELD TRAJECTORIES: 36 CONVERGING INTO 6 DISCRETE NODES</span>
        </span>

        <span className="hidden sm:inline text-zinc-400">
          SCROLL TO EXECUTE RUN ↓
        </span>
      </div>
    </section>
  );
};
