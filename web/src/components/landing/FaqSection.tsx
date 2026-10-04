import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
}

const FAQS: FaqItem[] = [
  {
    question: 'What does Black Box actually record?',
    answer:
      'Black Box records every model call, tool payload, vector retrieval chunk, memory mutation, and random seed through RunContext into an immutable SQLite save-point. Agents are structured as resumable state machines where all state lives in ctx.state, ensuring any step can be resumed identically without execution divergence.',
  },
  {
    question: 'How does the diagnosis engine isolate the root cause?',
    answer:
      'Rather than relying on post-hoc LLM guesses, Black Box uses a dual-engine architecture: a Graph Neural Network and a LightGBM step ranker trained on thousands of labelled execution runs. It analyzes graph topology, token anomalies, and three-tier step-checker alarms (Laya local -> Jev -> LLM) to compute mathematical SHAP attribution scores for every step.',
  },
  {
    question: 'What happens during a counterfactual replay fork?',
    answer:
      'When testing a hypothesis or repair for Step N, Black Box branches a new run directly from Step N-1\'s save-point. Unchanged upstream steps (0 through N-1) are reused instantly with zero model calls, and only downstream dependent nodes are re-executed. This cuts verification latency and token expenditure by up to 80%.',
  },
  {
    question: 'What is the Failure Atlas?',
    answer:
      'The Failure Atlas clusters high-dimensional failure embeddings and graph structures into topological groupings. Recurrent errors—such as tool schema drifts, hallucinated constraints, or infinite retry loops—are mapped to proven, counterfactually-verified patches so teams don\'t debug identical issues repeatedly.',
  },
  {
    question: 'How does Guardian intervene in production?',
    answer:
      'Guardian acts as an autonomous in-flight circuit breaker. When an agent enters an unrecoverable loop or attempts a critical money-moving action (needs_approval: true), Guardian freezes execution in memory and dispatches immediate alerts across Slack, Email, and Twilio, allowing human operators to approve, keep paused, or abort.',
  },
  {
    question: 'Where does Black Box run and store telemetry?',
    answer:
      'Black Box runs on your infrastructure. The backend is a lightweight FastAPI service that serializes execution traces and blobs to local or networked SQLite shards. User profiles and authentication sessions are securely persisted in MongoDB, ensuring your proprietary prompts and data never leave your environment.',
  },
];

export const FaqSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (i: number) => {
    setOpenIndex(openIndex === i ? null : i);
  };

  return (
    <section id="faq" className="relative py-20 md:py-32 border-t border-[#1f2937]/80 bg-[#070a10]">
      <div className="max-w-[1400px] mx-auto px-6 font-sans">
        {/* Section Eyebrow */}
        <div className="flex items-center gap-2 mb-3 font-mono text-xs text-zinc-400">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
          <span className="tracking-widest uppercase font-semibold">11 // TECHNICAL SPECIFICATIONS</span>
        </div>

        {/* Section Headline */}
        <div className="max-w-3xl mb-12">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-[1.1] uppercase">
            FREQUENTLY ANSWERED
            <br />
            <span className="text-zinc-400">TECHNICAL QUESTIONS.</span>
          </h2>
        </div>

        {/* Accordion List */}
        <div className="max-w-3xl mx-auto space-y-3 font-sans">
          {FAQS.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={i}
                className="border border-[#1f2937] rounded-lg bg-[#0b0f17] overflow-hidden transition-colors"
              >
                <button
                  onClick={() => toggle(i)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                >
                  <span className="text-sm sm:text-base font-semibold text-white tracking-tight">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-cyan-400' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-zinc-400 leading-relaxed border-t border-[#1f2937]/60">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
