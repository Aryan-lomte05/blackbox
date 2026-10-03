export type StepKind = 'llm' | 'tool' | 'retrieval' | 'final' | 'state';

export interface StepSummary {
  idx: number;
  kind: StepKind;
  name: string;
  node: string;
  used?: string;
  output?: string;
}

export interface PlantedMistake {
  type: string;
  name: string;
  step: number;
  note: string;
}

export interface CaseDetails {
  run_id: string;
  family: string;
  agent: string;
  model: string;
  task: string;
  answer: string;
  expected: string;
  outcome: string;
  planted_mistake?: PlantedMistake | null;
  known_guilty_step?: number | null;
  known_from?: string;
  test_set?: string;
  why_this_case?: string;
}

export interface DiagnosisScore {
  idx: number;
  p: number;
  rank: number;
}

export interface DiagnosisDetails {
  source: string;
  model: string;
  top3: number[];
  scores: DiagnosisScore[];
  known_guilty_in_top3?: boolean;
  known_guilty_is_first?: boolean;
}

export interface SuspectTest {
  suspect: number;
  verdict: 'verified' | 'not the cause' | 'flaky' | string;
  cause_step: number | null;
  causal_effect: number;
  attempts: Array<{
    repair: string;
    at_step: number;
    passed: string;
    re_ran: number[];
    re_used: number[];
  }>;
}

export interface VerificationDetails {
  verified_cause: number | null;
  matches_known_guilty_step?: boolean;
  suspects_tested: SuspectTest[];
  steps_re_run_total: number;
  steps_re_used_total: number;
}

export interface ComparisonDetails {
  fixed_run_id: string;
  fixed_answer: string;
  first_difference_at: number;
  pairs_changed: number;
  outcome_flipped: boolean;
}

export interface InvestigateResponse {
  story: string[];
  case: CaseDetails;
  diagnosis: DiagnosisDetails;
  verification: VerificationDetails;
  comparison: ComparisonDetails;
  repair?: any | null;
  steps: StepSummary[];
  seconds: number;
}

export interface RunGraphNode {
  id: string;
  position: { x: number; y: number };
  data: {
    idx: number;
    kind: StepKind;
    name: string;
    node: string;
    label: string;
    preview: string;
    error?: string | null;
    reused?: boolean;
    latency_ms?: number;
    tokens?: number;
    suspect_rank?: number | null;
    suspect_p?: number | null;
    is_guilty?: boolean;
    is_planted?: boolean;
    is_contaminated?: boolean;
    checker?: {
      on_track?: boolean;
      consistent?: boolean;
      alarm?: boolean;
      tier?: string;
    } | null;
  };
}

export interface RunGraphEdge {
  id: string;
  source: string;
  target: string;
  type?: 'dataflow' | 'order' | string;
  animated?: boolean;
  style?: Record<string, any>;
}

export interface RunGraphResponse {
  run_id: string;
  outcome: string;
  planted?: string | null;
  guilty_step?: number | null;
  nodes: RunGraphNode[];
  edges: RunGraphEdge[];
  contamination_trail?: number[];
  suspects?: number[];
}

export interface StepDetail {
  idx: number;
  kind: StepKind;
  name: string;
  node: string;
  request: any;
  output: any;
  memory_after: Record<string, any>;
  checker?: Record<string, any> | null;
  latency_ms?: number;
  tokens?: number;
}

export interface RunCard {
  run_id: string;
  family: string;
  family_label?: string;
  task_id: string;
  agent: string;
  model: string;
  outcome: 'pass' | 'fail' | 'crashed' | 'rewound' | 'no verdict' | string;
  planted?: string | null;
  guilty_step?: number | null;
  label_source?: string;
  steps: number;
  split: string;
  created_at: string;
  parent_run_id?: string | null;
}

export interface OverviewResponse {
  kpis: {
    total_runs?: number;
    failures_diagnosed?: number;
    top1_accuracy?: number;
    top3_accuracy?: number;
    steps_reused_pct?: number;
    savepoints_bytes?: number;
    savepoints_dedup_pct?: number;
    [key: string]: any;
  };
  model?: {
    name?: string;
    version?: string;
    metrics?: Record<string, any>;
    headline?: string;
  };
  recent_runs: RunCard[];
  recent_failures: RunCard[];
  incidents: IncidentSummary[];
  queue: any[];
}

export interface IncidentSummary {
  incident_id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  status: 'open' | 'approved' | 'rejected' | 'resolved';
  created_at: string;
  run_id: string;
  needs_approval: boolean;
  repeats: number;
}

export interface IncidentDetail extends IncidentSummary {
  what: string;
  why: string;
  fix_proposed: string;
  channel_notifications?: Array<{
    channel: 'email' | 'whatsapp' | 'slack' | 'telegram' | 'phone';
    status: 'sent' | 'pending';
    preview: string;
  }>;
  evidence_steps?: number[];
  cost_at_stake?: string;
}

export interface SimilarFailure {
  run_id: string;
  similarity: number;
  task: string;
  outcome: string;
  guilty_step?: number;
  known_fix?: string;
}

export interface SimilarResponse {
  run_id: string;
  fingerprint: string[];
  is_novel: boolean;
  look_alikes: SimilarFailure[];
  known_fixes: Array<{
    rule: string;
    success_rate: string;
    applied_count: number;
  }>;
}

export interface CausalSuspectRow {
  step: number;
  necessary: boolean;
  sufficient: boolean | null;
  verdict: string;
  causal_effect?: number;
}

export interface CausalReportResponse {
  cause: number | null;
  steps: CausalSuspectRow[];
  joint?: number[];
  recovery_paths: Array<{
    step: number;
    how: string;
    run_id: string;
  }>;
  blast_radius: {
    contaminated: number[];
    reaches_answer: boolean;
    money_moving_steps: number[];
    severity: string;
  };
  summary: string;
}

export interface FleetFixRunRow {
  run_id: string;
  family: string;
  before: 'fail' | 'pass';
  after: 'fail' | 'pass';
  verdict: 'fixed' | 'still failing' | 'regression' | 'held';
  new_run: string;
  answer?: string;
  savings?: {
    steps_reused: number;
    steps_total: number;
  };
}

export interface FleetFixResponse {
  decision: 'APPROVE' | 'BLOCK' | 'NO EFFECT';
  why: string;
  counts: {
    fixed: number;
    still_failing: number;
    regression: number;
    held: number;
  };
  fix_rate: string;
  failure_rate_before: number;
  failure_rate_after: number;
  rows: FleetFixRunRow[];
}

export interface CrashTestRow {
  fault: string;
  fault_name: string;
  step: number;
  verdict: 'robust' | 'failed safely' | 'failed silently' | 'unsafe';
  run_id: string;
  answer?: string;
}

export interface CrashTestResponse {
  stars: number;
  score: number;
  counts: {
    robust: number;
    failed_safely: number;
    failed_silently: number;
    unsafe: number;
  };
  weak_against: string[];
  new_labelled_failures: number;
  rows: CrashTestRow[];
}

export interface LabStageEvent {
  n: number;
  title: string;
  detail: string;
  data?: any;
  t: number;
}

export interface LabStepEvent {
  phase: string;
  step: {
    idx: number;
    kind: StepKind;
    name: string;
    node: string;
    used?: string;
    output?: string;
  };
}
