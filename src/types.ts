export type MetricKey = 'cpu' | 'mem' | 'rt' | 'err' | 'req' | 'net' | 'io' | 'db';

export interface MetricDef {
  k: MetricKey;
  label: string;
  unit: string;
  dec: number;
  description: string;
}

export interface MetricStats {
  mu: number;
  v: number;
}

export interface ServiceBaseMetrics {
  cpu: number;
  mem: number;
  rt: number;
  err: number;
  req: number;
  net: number;
  io: number;
  db: number;
}

export interface ActiveFault {
  id: string;
  service: string;
  label: string;
  mult: Partial<Record<MetricKey, number>>;
  ramp: number;
  fix: string;
  age: number;
  intensity: number;
  mitigated: boolean;
  effective: boolean;
}

export type IncidentStage = 
  | 'diagnosing'
  | 'approval'
  | 'held'
  | 'remediating'
  | 'verifying'
  | 'resolved'
  | 'escalated';

export interface CauseDiagnosis {
  cause: {
    id: string;
    label: string;
    fix: string;
    w: Partial<Record<MetricKey, number>>;
  };
  sim: number;
  p: number;
}

export interface VerificationResult {
  rt: number;
  score: number;
  err: number;
  pass: boolean;
  baseRt: number;
  peakRt: number;
}

export interface IncidentLogEntry {
  t: number;
  timeStr: string;
  text: string;
  done?: boolean;
}

export interface Incident {
  id: string;
  svc: string;
  svcName: string;
  startTick: number;
  detectTick: number;
  state: IncidentStage;
  log: IncidentLogEntry[];
  sig: Record<MetricKey, number> | null;
  ranked: CauseDiagnosis[] | null;
  explanation?: string;
  action: string;
  chosen: string | null;
  stepIx?: number;
  verifyTicks?: number;
  samples?: Array<{ rt: number; err: number; score: number }>;
  verify: VerificationResult | null;
  resolvedTick: number | null;
  approvedTick?: number | null;
  peakRt: number;
  baseRt: number;
  aiReport?: {
    rootCause: string;
    blastRadius: string;
    executiveSummary: string;
    actionableFix: string;
    verificationCommand?: string;
    preventativeMeasures: string[];
  };
}

export interface ServiceState {
  id: string;
  name: string;
  kind: string;
  base: ServiceBaseMetrics;
  cur: ServiceBaseMetrics;
  stats: Record<MetricKey, MetricStats>;
  z: Record<MetricKey, number>;
  score: number;
  streak: number;
  hist: Record<MetricKey, number[]>;
  scoreHist: number[];
  fault: ActiveFault | null;
  incident: Incident | null;
}

export interface RunbookAction {
  id: string;
  title: string;
  detail: string;
  risk: 'low' | 'medium' | 'high';
  steps: string[];
}

export interface FleetApiResponse {
  tick: number;
  running: boolean;
  speed: number;
  autoApprove: boolean;
  selectedSvc: string;
  fleet: ServiceState[];
  activeIncident: Incident | null;
  history: Incident[];
  kpis: {
    totalIncidents: number;
    resolvedCount: number;
    mttdSeconds: number;
    mttrSeconds: number;
    successRate: number;
  };
}

export interface AiCopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  contextIncidentId?: string;
}
