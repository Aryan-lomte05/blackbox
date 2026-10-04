import React, { useState } from 'react';
import { Copy, Check, Terminal, Play, ChevronRight } from 'lucide-react';

const TABS = [
  {
    id: 'python',
    label: 'Python (3 Lines)',
    code: `import blackbox
from openai import OpenAI

# 1. Wrap your client — every model call is recorded
client = blackbox.wrap(OpenAI())

# 2. Decorate your tools — inputs & outputs are cached
@blackbox.tool
def get_stock_quote(ticker: str) -> dict:
    return fetch_market_data(ticker)

# 3. Run your agent — immutable cryptographic trace
trace = blackbox.run(my_financial_agent, "Audit portfolio risk")`,
  },
  {
    id: 'replay',
    label: 'Counterfactual Replay',
    code: `# Re-run from recording: exactly 0 model calls
blackbox.replay(trace)

# Hot-patch ONLY the broken tool step
child = blackbox.fork(
    trace,
    step_index=2,
    change=blackbox.Change(kind="output", value={"multiplier": 1.0})
)

# Telemetry on compute & tokens saved
print(blackbox.savings(child))
# >> 14,200 tokens saved • $0.00 model cost • 18ms runtime`,
  },
  {
    id: 'otel',
    label: 'OTel / Langfuse Import',
    code: `# Works with existing agent systems out of the box:
blackbox import otel production_traces.json
blackbox import langfuse trace_export.json

# Test one fix across similar past failures with a regression firewall
blackbox fleet run_108 --rule "sanitize_currency"`,
  },
  {
    id: 'cli',
    label: 'Command Line',
    code: `# Inspect failed flights & causal ranking
blackbox runs --fail
blackbox show run_108

# Deterministic flight replay
blackbox replay run_108

# CI/CD regression firewall for GitHub Actions
blackbox ci pin && blackbox ci run`,
  },
];

export const DeveloperTerminal: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);
  const [terminalRunning, setTerminalRunning] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([
    '[*] Black Box Core v2.4.0 (x86_64-darwin-metal)',
    '[*] Ready for flight trace ingestion.',
  ]);

  const handleCopy = () => {
    navigator.clipboard.writeText(TABS[activeTab].code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunCommand = () => {
    setTerminalRunning(true);
    setTerminalOutput([
      '[*] Loading flight recording [run_108.bbdag]...',
      '[+] Ingested 4 steps, 14,200 tokens (SHA-256: 7f8a9e...)',
      '[!] GNN attribution pinpointed culpable anomaly at Step 02',
      '[*] Injecting counterfactual repair: nominal_units=42,500',
      '[*] Replaying downstream steps from cached state memory...',
      '[✔] Deterministic replay: Passed (100% assertions satisfied)',
      '[✔] Model tokens burned: 0 (100% cache hit)',
      '[✔] Execution latency: 14.2ms • Regression status: Zero',
    ]);
    setTimeout(() => {
      setTerminalRunning(false);
    }, 600);
  };

  return (
    <section id="sdk" className="py-28 sm:py-36 bg-[#08090c] border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="max-w-3xl mb-16 sm:mb-20">
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 backdrop-blur-md mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[11px] font-mono tracking-widest text-cyan-300 uppercase">
              06 / Developer Integration
            </span>
          </div>

          <h2 className="font-serif text-4xl sm:text-6xl md:text-7xl font-light tracking-tight text-white leading-[1.05] mb-6">
            Add to your agent{' '}
            <span className="italic font-normal text-zinc-400">
              in three lines of Python.
            </span>
          </h2>

          <p className="text-base sm:text-lg text-zinc-400 font-light leading-relaxed">
            Zero architectural rewrites. Black Box wraps your OpenAI, Anthropic, LangGraph, or custom agent loop,
            preserving every state transition with negligible overhead.
          </p>
        </div>

        {/* Dual-Pane Code & Terminal Console */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Code Snippet with Tab Switcher */}
          <div className="lg:col-span-7 rounded-3xl apple-glass-card border border-white/10 overflow-hidden shadow-2xl">
            {/* Top Tab Bar */}
            <div className="p-3 bg-black/60 border-b border-white/[0.08] flex items-center justify-between gap-2 overflow-x-auto">
              <div className="flex items-center gap-1.5">
                {TABS.map((tab, idx) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(idx)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors whitespace-nowrap cursor-pointer ${
                      activeTab === idx
                        ? 'bg-white/10 text-white font-semibold'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 border border-white/[0.08] text-xs font-mono transition-colors cursor-pointer shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Code Body */}
            <div className="p-6 overflow-x-auto font-mono text-xs sm:text-[13px] leading-relaxed text-zinc-300 bg-[#06080d]/80">
              <pre className="whitespace-pre">
                {TABS[activeTab].code}
              </pre>
            </div>

            {/* Bottom PIP install pill */}
            <div className="px-6 py-4 bg-black/80 border-t border-white/[0.08] flex items-center justify-between text-xs font-mono text-zinc-400">
              <div className="flex items-center gap-2">
                <span className="text-zinc-600">$</span>
                <span className="text-zinc-200">pip install halfabyte-blackbox[all]</span>
              </div>
              <span className="text-[10px] text-zinc-500">v2.4.0</span>
            </div>
          </div>

          {/* Right: Live Interactive Terminal Console */}
          <div className="lg:col-span-5 rounded-3xl apple-glass-card border border-white/10 overflow-hidden shadow-2xl flex flex-col">
            {/* Terminal Window Header */}
            <div className="p-4 bg-black/80 border-b border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
                <span className="text-[11px] font-mono text-zinc-400 ml-2">
                  blackbox-cli
                </span>
              </div>

              <button
                onClick={handleRunCommand}
                disabled={terminalRunning}
                className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3 h-3 fill-emerald-300" />
                <span>Run Demo</span>
              </button>
            </div>

            {/* Terminal Screen */}
            <div className="p-5 font-mono text-xs text-zinc-300 bg-black/90 min-h-[300px] flex flex-col justify-between space-y-2">
              <div className="space-y-1.5">
                {terminalOutput.map((line, i) => {
                  let color = 'text-zinc-400';
                  if (line.startsWith('[✔]')) color = 'text-emerald-400 font-bold';
                  if (line.startsWith('[!]')) color = 'text-amber-400 font-bold';
                  if (line.startsWith('[+]')) color = 'text-cyan-400';
                  return (
                    <div key={i} className={`${color} leading-relaxed text-[11px]`}>
                      {line}
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 border-t border-white/[0.06] flex items-center gap-2 text-zinc-500 text-[11px]">
                <ChevronRight className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span className="text-zinc-400">ready for commands...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
