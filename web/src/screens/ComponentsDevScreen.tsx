import React, { useState } from 'react';
import { RecMark } from '../components/common/RecMark';
import { MonoLabel } from '../components/common/MonoLabel';
import { StepChip } from '../components/common/StepChip';
import { Verdict } from '../components/common/Verdict';
import { StreamLog, StreamLogRow } from '../components/common/StreamLog';
import { KPI } from '../components/common/KPI';
import { SavingsMeter } from '../components/common/SavingsMeter';
import { EmptyState } from '../components/common/EmptyState';
import { RunGraph } from '../components/run/RunGraph';
import { StepDrawer } from '../components/run/StepDrawer';

// Import fixtures directly for dev showcase
import runGraphFixture from '../../../fixtures/ui/run_graph.json';
import runStep0Fixture from '../../../fixtures/ui/run_step_0.json';
import investigateFixture from '../../../fixtures/ui/investigate_model_finds_it.json';

export const ComponentsDevScreen: React.FC = () => {
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeStepData, setActiveStepData] = useState<any>(runStep0Fixture);
  const [isStreaming, setIsStreaming] = useState(false);

  // Convert fixture story into StreamLog rows
  const fixtureStreamRows: StreamLogRow[] = investigateFixture.story.map((text, idx) => ({
    id: idx,
    timestamp: idx * 1.8 + 0.4,
    kind: idx === 0 ? 'step' : idx === 1 ? 'rule' : idx === 2 ? 'attempt' : idx === 3 ? 'verdict' : 'stage',
    text,
  }));

  const handleNodeClick = (idx: number) => {
    setSelectedStep(idx);
    // If step 0, load runStep0Fixture, otherwise mock
    if (idx === 0) {
      setActiveStepData(runStep0Fixture);
    } else {
      const node = (runGraphFixture.nodes as any[]).find((n) => n.idx === idx);
      setActiveStepData({
        step: {
          idx,
          name: node?.name || `step_${idx}`,
          node: node?.node || 'agent_node',
          kind: node?.kind || 'tool',
          request: { action: 'execute', query: 'verify equation' },
          output: node?.preview || 'Execution completed with result.',
          error: node?.error || null,
          reads: ['env_state', 'prev_tokens'],
          writes: ['result_buffer'],
          parents: [0],
          is_guilty: node?.is_guilty || idx === 4,
        },
        state_after: {
          step_index: idx,
          status: 'completed',
          registers: { acc: 14, retries: 0 },
        },
      });
    }
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-12 pb-24">
      {/* Page Header */}
      <div className="border-b border-[var(--line)] pb-6">
        <div className="flex items-center justify-between mb-2">
          <MonoLabel index="DEV" label="SIGNATURE COMPONENTS CATALOG" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--accent)] bg-[var(--raised)] px-2 py-0.5 rounded border border-[var(--line)]">
            FIXTURE VERIFICATION
          </span>
        </div>
        <h1 className="text-2xl font-bold font-sans text-[var(--text-strong)] tracking-tight">
          Design System & Instrument Components
        </h1>
        <p className="text-xs font-sans text-[var(--muted)] mt-1 max-w-2xl leading-relaxed">
          Living visual audit matching <span className="font-mono text-[var(--text)]">UI_BRIEF.md</span> flight recorder specifications.
          No gradients, no AI glow, authentic data tokens only.
        </p>
      </div>

      {/* 1. RecMark */}
      <section className="space-y-4">
        <MonoLabel index="01" label="RECMARK (REC DOT + MONO WORDMARK)" />
        <div className="panel p-5 flex flex-wrap items-center gap-8">
          <div className="space-y-1.5">
            <div className="text-[10px] font-mono text-[var(--faint)]">IDLE STATE</div>
            <RecMark streaming={false} />
          </div>

          <div className="space-y-1.5">
            <div className="text-[10px] font-mono text-[var(--faint)]">STREAMING (PULSE 1.6S)</div>
            <RecMark streaming={true} />
          </div>

          <div className="space-y-1.5">
            <div className="text-[10px] font-mono text-[var(--faint)]">SMALL COMPACT</div>
            <RecMark streaming={true} size="sm" />
          </div>

          <button
            onClick={() => setIsStreaming(!isStreaming)}
            className="ml-auto px-3 py-1 rounded-[var(--radius-sm)] border border-[var(--line-strong)] bg-[var(--raised)] text-xs font-mono text-[var(--text-strong)] hover:border-[var(--accent)] cursor-pointer"
          >
            TOGGLE STREAMING: {isStreaming ? 'ON' : 'OFF'}
          </button>
        </div>
      </section>

      {/* 2. MonoLabel & StepChip */}
      <section className="space-y-4">
        <MonoLabel index="02" label="MONOLABEL & STEPCHIP VARIANTS" />
        <div className="panel p-5 space-y-6">
          <div className="space-y-2">
            <div className="text-[10px] font-mono text-[var(--faint)]">MONOLABEL FORMATS</div>
            <div className="flex flex-wrap items-center gap-6">
              <MonoLabel index="01" label="ROOT CAUSE" />
              <MonoLabel index="02" label="CONTAMINATION TRAIL" />
              <MonoLabel label="DIRECT UNINDEXED LABEL" />
              <MonoLabel index="LIVE" label="INCOMING STREAM" />
            </div>
          </div>

          <div className="border-t border-[var(--line)] pt-4 space-y-2">
            <div className="text-[10px] font-mono text-[var(--faint)]">STEPCHIP VARIANTS</div>
            <div className="flex flex-wrap items-center gap-3">
              <StepChip step={0} variant="default" />
              <StepChip step={4} variant="guilty" />
              <StepChip step={5} variant="trail" />
              <StepChip step={12} variant="suspect" suspectRank={2} />
              <StepChip step={1} variant="reused" />
            </div>
          </div>
        </div>
      </section>

      {/* 3. Verdict */}
      <section className="space-y-4">
        <MonoLabel index="03" label="VERDICT BLOCKS (SCALE 0.96 → 1, AUTHENTIC STATUS)" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Verdict
            verdict="PROVED"
            step={4}
            detail="Step 4 caused the failure. Repairing only this step makes the run pass."
          />
          <Verdict
            verdict="BLOCK"
            detail="Firewall blocked agent deployment: failure rate exceeded 5% threshold."
          />
          <Verdict
            verdict="APPROVE"
            detail="Rule validated across 64 historical failure traces without regression."
          />
          <Verdict
            verdict="NOT THE CAUSE"
            step={12}
            detail="Re-running step 12 with gold parameters produced identical failure outcome."
          />
          <Verdict
            verdict="CRASH TEST"
            stars={4}
            detail="Resilient against 8 of 10 perturbation vectors (F1–F10 suite)."
          />
          <Verdict
            verdict="BAD LUCK"
            detail="Non-deterministic tool response variance; underlying logic passed."
          />
        </div>
      </section>

      {/* 4. KPI & SavingsMeter */}
      <section className="space-y-4">
        <MonoLabel index="04" label="KPIS & SAVINGS METER" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPI
            label="LABELLED FAILURES"
            value="858"
            context="of 5,672 runs analyzed"
          />
          <KPI
            label="PROVED CAUSES"
            value="794"
            context="92.5% localization rate"
            variant="ok"
          />
          <KPI
            label="CRITICAL INCIDENTS"
            value="2"
            context="requiring human approval"
            variant="guilty"
          />
          <KPI
            label="MEAN LOCALIZATION"
            value="1.8"
            unit="sec"
            context="local 7B verify pass"
          />
        </div>

        <div className="panel p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs font-sans text-[var(--muted)]">
            Replay efficiency telemetry:
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SavingsMeter reranSteps={1} totalSteps={9} modelCalls={0} tokensSaved={1526} />
            <SavingsMeter reranSteps={3} totalSteps={32} modelCalls={1} tokensSaved={8420} />
          </div>
        </div>
      </section>

      {/* 5. StreamLog */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <MonoLabel index="05" label="STREAMLOG (SSE TIMELINE STREAM)" />
          <span className="text-[10px] font-mono text-[var(--faint)]">
            DATA: investigate_model_finds_it.json
          </span>
        </div>
        <StreamLog
          rows={fixtureStreamRows}
          streaming={isStreaming}
          maxHeight="240px"
        />
      </section>

      {/* 6. EmptyState */}
      <section className="space-y-4">
        <MonoLabel index="06" label="EMPTYSTATE (HONEST EXPLANATION + CLI POPULATE)" />
        <EmptyState
          title="No fleet-wide regressions detected"
          description="The active firewall rule has not caused any false-positive blocks across the current evaluation suite."
          command="blackbox fleet-fix --run 37452fc329e1498f --eval-all"
          endpoint="POST /api/runs/37452fc329e1498f/fleet-fix"
          actionText="Run Fleet Evaluation"
          onAction={() => alert('Triggering fleet evaluation')}
        />
      </section>

      {/* 7. RunGraph & StepDrawer */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <MonoLabel index="07" label="RUNGRAPH (REACT FLOW + DAGRE + STEPDRAWER)" />
          <span className="text-[10px] font-mono text-[var(--faint)]">
            CLICK A NODE TO OPEN STEP DRAWER
          </span>
        </div>

        <div className="h-[420px] w-full">
          <RunGraph
            nodes={runGraphFixture.nodes as any}
            edges={runGraphFixture.edges as any}
            guiltyStep={4}
            trailSteps={[5, 6, 7]}
            reusedSteps={[0, 1, 2, 3]}
            selectedStep={selectedStep}
            onSelectStep={handleNodeClick}
          />
        </div>
      </section>

      {/* StepDrawer rendered when a node is selected */}
      <StepDrawer
        stepIdx={selectedStep}
        stepData={activeStepData}
        onClose={() => setDrawerOpen(false)}
        onSelectStep={handleNodeClick}
      />
    </div>
  );
};
