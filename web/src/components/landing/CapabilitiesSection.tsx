import React from 'react';
import { motion } from 'framer-motion';
import { Database, Cpu, GitFork, ShieldCheck, Network, Flame, CheckCircle2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Capability {
  icon: React.ComponentType<{ className?: string }>;
  tag: string;
  title: string;
  description: string;
  badge: string;
  route: string;
}

const CAPABILITIES: Capability[] = [
  {
    icon: Database,
    tag: 'CORE ENGINE',
    title: 'Deterministic Flight Recording',
    description:
      'Captures every LLM completion, tool payload, retrieval chunk, and state mutation as an immutable SQLite save-point with zero in-loop overhead.',
    badge: 'ZERO DIVERGENCE',
    route: '/runs',
  },
  {
    icon: Cpu,
    tag: 'ATTRIBUTION',
    title: 'GNN & LightGBM Step Diagnosis',
    description:
      'Mathematical root-cause isolation powered by graph neural networks, LightGBM rankers, and SHAP attribution grounded in concrete step citations.',
    badge: 'TOP-3 ACCURACY',
    route: '/investigate',
  },
  {
    icon: GitFork,
    tag: 'VERIFICATION',
    title: 'Counterfactual Replay & Fork',
    description:
      'Tests candidate repairs by branching directly from the suspect save-point. Re-executes only affected downstream nodes while reusing up to 80% of steps.',
    badge: 'TOKEN SAVINGS',
    route: '/causal',
  },
  {
    icon: ShieldCheck,
    tag: 'REGRESSION PREVENTION',
    title: 'Fleet-Wide Regression Firewall',
    description:
      'Validates candidate prompt rules or model swaps across hundreds of historical runs. Delivers binary APPROVE / BLOCK verdicts before production deployment.',
    badge: 'APPROVE / BLOCK',
    route: '/fleet',
  },
  {
    icon: Network,
    tag: 'PATTERN DISCOVERY',
    title: 'Failure Atlas Clustering',
    description:
      'Groups recurrent failure fingerprints into topological clusters. Maps error patterns to canonical, battle-tested counterfactual repairs.',
    badge: 'CATALOGED PATTERNS',
    route: '/atlas',
  },
  {
    icon: Flame,
    tag: 'SAFETY & COMPLIANCE',
    title: 'Guardian Autonomous Incident Brake',
    description:
      'Intercepts in-flight execution when critical anomalies or high-stakes money-moving actions fire. Suspends execution and alerts operators via Slack and Twilio.',
    badge: 'SAFETY INTERCEPT',
    route: '/incidents',
  },
];

export const CapabilitiesSection: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section id="capabilities" className="relative py-20 md:py-32 border-t border-[#1f2937]/80 bg-[#05070b]">
      <div className="max-w-[1400px] mx-auto px-6 font-sans">
        {/* Section Eyebrow */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-2 mb-3 font-mono text-xs text-cyan-400"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          <span className="tracking-widest uppercase font-semibold">10 // SYSTEM ARCHITECTURE</span>
        </motion.div>

        {/* Section Headline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mb-12"
        >
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-[1.1] uppercase">
            ENGINEERED FOR
            <br />
            <span className="text-zinc-400">PRODUCTION AUTONOMOUS AGENTS.</span>
          </h2>
          <p className="text-sm sm:text-base text-zinc-400 mt-4 leading-relaxed">
            Every capability is grounded directly in the Black Box runtime and tested against thousands of
            recorded execution shards.
          </p>
        </motion.div>

        {/* 6 High-Impact Capability Cards with Micro-interactions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {CAPABILITIES.map((cap, i) => {
            const Icon = cap.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                whileHover={{ y: -4, scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => navigate(cap.route)}
                className="p-6 rounded-lg bg-[#0b0f17] border border-[#1f2937] hover:border-cyan-500/50 hover:bg-[#0e1420] transition-all flex flex-col justify-between group cursor-pointer shadow-lg hover:shadow-cyan-950/30"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded bg-[#070a10] border border-[#1f2937] group-hover:border-cyan-500/40 flex items-center justify-center text-cyan-400 group-hover:text-white transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-400 group-hover:text-zinc-300">
                      {cap.badge}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-semibold">
                      {cap.tag}
                    </span>
                    <h3 className="text-base font-bold text-white mt-1 group-hover:text-cyan-400 transition-colors">
                      {cap.title}
                    </h3>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                    {cap.description}
                  </p>
                </div>

                <div className="pt-6 border-t border-[#1f2937] flex items-center justify-between text-xs font-mono text-zinc-500 group-hover:text-cyan-300 transition-colors">
                  <span>LAUNCH MODULE</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
