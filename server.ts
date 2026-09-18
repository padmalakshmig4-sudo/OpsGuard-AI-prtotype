import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// -------------------------------------------------------------
// Gemini Client Setup
// -------------------------------------------------------------
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// -------------------------------------------------------------
// Simulation Constants & Definitions
// -------------------------------------------------------------
const TICK_SECONDS = 5;
const WARMUP = 12;
const DETECT_THRESHOLD = 3.5;
const DETECT_PERSIST = 2;
const HISTORY = 80;

type MetricKey = "cpu" | "mem" | "rt" | "err" | "req" | "net" | "io" | "db";
const MK: MetricKey[] = ["cpu", "mem", "rt", "err", "req", "net", "io", "db"];

interface ServiceBase {
  id: string;
  name: string;
  kind: string;
  base: Record<MetricKey, number>;
}

const SERVICE_CONFIGS: ServiceBase[] = [
  {
    id: "api",
    name: "api-gateway",
    kind: "Kubernetes · 4 pods (Cluster Ingress)",
    base: { cpu: 34, mem: 46, rt: 186, err: 0.4, req: 1240, net: 52, io: 8, db: 38 },
  },
  {
    id: "auth",
    name: "auth-service",
    kind: "Kubernetes · 3 pods (OIDC / JWT)",
    base: { cpu: 21, mem: 57, rt: 124, err: 0.2, req: 640, net: 18, io: 6, db: 22 },
  },
  {
    id: "db",
    name: "postgres-primary",
    kind: "Managed DB · Aurora PostgreSQL db.r6g.xl",
    base: { cpu: 42, mem: 64, rt: 28, err: 0.05, req: 3100, net: 34, io: 44, db: 88 },
  },
  {
    id: "web",
    name: "web-frontend",
    kind: "Edge CDN & SSR Node · 12 locations",
    base: { cpu: 17, mem: 33, rt: 92, err: 0.3, req: 2050, net: 96, io: 4, db: 0 },
  },
  {
    id: "cache",
    name: "redis-cluster",
    kind: "In-memory Cluster · 3 masters + 3 replicas",
    base: { cpu: 26, mem: 52, rt: 6, err: 0.02, req: 4500, net: 78, io: 3, db: 0 },
  },
];

const NOISE: Record<MetricKey, number> = {
  cpu: 0.04,
  mem: 0.02,
  rt: 0.06,
  err: 0.22,
  req: 0.05,
  net: 0.06,
  io: 0.08,
  db: 0.05,
};

const CEIL: Partial<Record<MetricKey, number>> = {
  cpu: 99.5,
  mem: 99.0,
  err: 100.0,
};

const ACTIONS: Record<string, { title: string; detail: string; risk: "low" | "medium" | "high"; steps: string[] }> = {
  scale_out: {
    title: "Horizontal Pod Autoscaler Override (Scale to 8 Pods)",
    detail: "Double replica capacity immediately and rebalance ingress load balancer targets.",
    risk: "low",
    steps: [
      "Check node pool capacity & HPA quotas",
      "Provision 4 additional pods in parallel",
      "Warm up application runtime & JIT caches",
      "Attach new endpoints to Envoy ingress and shift traffic 50/50",
    ],
  },
  rolling_restart: {
    title: "Rolling Restart & Heap Compaction",
    detail: "Gracefully cycle worker pods one-by-one to purge JVM/V8 memory leak while maintaining zero downtime.",
    risk: "medium",
    steps: [
      "Drain active HTTP sessions on target pod 1",
      "Terminate pod 1, restart container and verify readiness probe",
      "Incrementally cycle remaining pods with 30s soak interval",
      "Confirm fleet memory consumption returns to baseline",
    ],
  },
  reset_pool: {
    title: "Database Connection Pool Reclamation & Max-Conn Bump",
    detail: "Terminate idle-in-transaction connections and increase pool ceiling from 40 to 65 connections.",
    risk: "medium",
    steps: [
      "Inspect pg_stat_activity for lingering abandoned queries",
      "Execute pg_terminate_backend on idle transactions > 45s",
      "Dynamically reload pgbouncer pool max ceiling to 65",
      "Monitor query queue depth and verify latency normalization",
    ],
  },
  failover: {
    title: "Secondary Identity Provider Regional Failover",
    detail: "Switch auth gateway to secondary standby region and trip circuit breaker on failing upstream IdP.",
    risk: "high",
    steps: [
      "Validate secondary IdP replication health and token signing keys",
      "Flip Route53 weighted DNS records to standby identity gateway (100% traffic shift)",
      "Flush cached discovery documents and authorization codes",
      "Verify end-to-end user login success rate reaches > 99.5%",
    ],
  },
  throttle_backup: {
    title: "Pause Overlapping Snapshot & Flush WAL Queue",
    detail: "Suspend non-critical automated snapshot job and reclaim write-ahead log disk I/O bandwidth.",
    risk: "medium",
    steps: [
      "Pause ongoing pg_dump / snapshot checkpoint routine",
      "Archive completed WAL segments to S3 and trigger vacuum",
      "Lower checkpoint completion target to reduce peak disk writes",
      "Confirm disk I/O latency returns to sub-15ms baseline",
    ],
  },
  reschedule: {
    title: "Cordon Contended Host & Evict Workload",
    detail: "Cordon the noisy hypervisor node and drain pods to freshly allocated compute instances.",
    risk: "low",
    steps: [
      "Mark Kubernetes node as unschedulable (cordon)",
      "Trigger gentle pod eviction with PodDisruptionBudget protection",
      "Verify successful rescheduling to isolated host",
      "Validate CPU throttled cycles return to 0%",
    ],
  },
  cdn_shield: {
    title: "Activate Origin Shield & Dynamic Brotli Compression",
    detail: "Route requests through nearest Cloudflare/Fastly origin shield and enforce adaptive compression.",
    risk: "low",
    steps: [
      "Enable tiered origin shield caching at closest POP",
      "Enforce Brotli level-6 compression on JSON/HTML payloads",
      "Invalidate non-responsive stale cache entries",
      "Confirm egress network bandwidth usage falls by > 60%",
    ],
  },
  redis_flush_expired: {
    title: "Active Eviction & Cache Shard Rebalance",
    detail: "Execute lazy-free eviction of stale keys and scale Redis cluster read replicas.",
    risk: "low",
    steps: [
      "Inspect Redis memory fragmentation ratio and eviction stats",
      "Trigger MEMORY PURGE and background key expiration sweep",
      "Spin up additional read replica shard to absorb read throughput",
      "Confirm sub-millisecond cache latency restored",
    ],
  },
};

const CAUSES = [
  {
    id: "surge",
    label: "Demand Surge — Sudden Traffic Spike Exceeding Replica Provisioning",
    w: { req: 1.0, net: 0.8, cpu: 0.8, rt: 0.65, err: 0.3 },
    fix: "scale_out",
  },
  {
    id: "leak",
    label: "Heap Memory Leak — Sustained Memory Accumulation Under Stable Traffic",
    w: { mem: 1.0, rt: 0.6, cpu: 0.35, err: 0.25, req: -0.1 },
    fix: "rolling_restart",
  },
  {
    id: "pool",
    label: "Connection Pool Exhaustion — In-flight Queries Queueing for DB Handles",
    w: { db: 1.0, err: 0.85, rt: 0.85, cpu: 0.2, req: -0.1 },
    fix: "reset_pool",
  },
  {
    id: "upstream",
    label: "Upstream Dependency Outage — External API Gateway Timeout Cascade",
    w: { err: 1.0, rt: 0.75, req: -0.4, cpu: -0.2 },
    fix: "failover",
  },
  {
    id: "diskio",
    label: "Storage I/O Contention — Heavy Disk Write Latency / WAL Saturation",
    w: { io: 1.0, rt: 0.7, db: 0.4, cpu: 0.3 },
    fix: "throttle_backup",
  },
  {
    id: "cpu",
    label: "Noisy Neighbor Contention — CPU Throttle Saturation on Co-located Node",
    w: { cpu: 1.0, rt: 0.65, mem: 0.15 },
    fix: "reschedule",
  },
  {
    id: "netsat",
    label: "Edge Network Saturation — Outbound Bandwidth Exceeding Interface Limits",
    w: { net: 1.0, rt: 0.65, err: 0.4, cpu: 0.25 },
    fix: "cdn_shield",
  },
  {
    id: "cache_hot",
    label: "Cache Hotkey / Key Expiration Storm — High Eviction Overhead",
    w: { cpu: 0.8, rt: 0.7, req: 0.9, net: 0.6 },
    fix: "redis_flush_expired",
  },
];

// -------------------------------------------------------------
// Simulation Engine State
// -------------------------------------------------------------
interface SimService {
  id: string;
  name: string;
  kind: string;
  base: Record<MetricKey, number>;
  cur: Record<MetricKey, number>;
  stats: Record<MetricKey, { mu: number; v: number }>;
  z: Record<MetricKey, number>;
  score: number;
  streak: number;
  hist: Record<MetricKey, number[]>;
  scoreHist: number[];
  fault: any | null;
  incident: any | null;
}

let tickCount = 0;
let isRunning = true;
let simSpeed = 1;
let autoApprove = false;
let selectedSvc = "api";
let incidentIdSeq = 1048;
let allIncidents: any[] = [];

const fleet: SimService[] = SERVICE_CONFIGS.map((s) => ({
  id: s.id,
  name: s.name,
  kind: s.kind,
  base: { ...s.base },
  cur: { ...s.base },
  stats: Object.fromEntries(
    MK.map((k) => [
      k,
      { mu: s.base[k], v: Math.pow(Math.max(s.base[k] * NOISE[k], 0.01), 2) },
    ])
  ) as Record<MetricKey, { mu: number; v: number }>,
  z: Object.fromEntries(MK.map((k) => [k, 0])) as Record<MetricKey, number>,
  score: 0,
  streak: 0,
  hist: Object.fromEntries(MK.map((k) => [k, []])) as unknown as Record<MetricKey, number[]>,
  scoreHist: [],
  fault: null,
  incident: null,
}));

function getService(id: string) {
  return fleet.find((s) => s.id === id);
}

function gauss() {
  let u = 0,
    v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function formatClock(t: number) {
  const sec = t * TICK_SECONDS;
  const hh = String(Math.floor(sec / 3600)).padStart(2, "0");
  const mm = String(Math.floor(sec / 60) % 60).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function stepFault(s: SimService) {
  const f = s.fault;
  if (!f) return;
  f.age++;
  let target = 1.0;
  if (f.mitigated) {
    target = f.effective ? 0 : 0.65;
  } else {
    target = Math.min(1.0, Math.pow(f.age / f.ramp, 0.75));
  }
  f.intensity += (target - f.intensity) * (f.mitigated ? 0.45 : 0.48);
  if (f.mitigated && f.effective && f.intensity < 0.04) {
    f.intensity = 0;
  }
}

function sampleMetrics(s: SimService) {
  const dailyCycle = 1 + 0.05 * Math.sin(tickCount / 35);
  MK.forEach((k) => {
    const b = s.base[k];
    if (b === 0) {
      s.cur[k] = 0;
      return;
    }
    let val = b * dailyCycle * (1 + gauss() * NOISE[k]);
    const f = s.fault;
    if (f && f.mult && f.mult[k]) {
      val *= 1 + (f.mult[k] - 1) * f.intensity;
    }
    if (CEIL[k] !== undefined) {
      val = Math.min(val, CEIL[k]!);
    }
    s.cur[k] = Math.max(0, val);
    s.hist[k].push(s.cur[k]);
    if (s.hist[k].length > HISTORY) s.hist[k].shift();
  });
}

function updateDetector(s: SimService) {
  const quiet = !s.incident && !(s.fault && s.fault.intensity > 0.08);
  const alpha = 0.06;
  const zAbsList: number[] = [];

  MK.forEach((k) => {
    const st = s.stats[k];
    const x = s.cur[k];
    if (s.base[k] === 0) {
      s.z[k] = 0;
      return;
    }
    const sd = Math.sqrt(Math.max(st.v, Math.pow(st.mu * 0.015, 2), 1e-4));
    const z = (x - st.mu) / sd;
    s.z[k] = Math.max(-12, Math.min(12, z));

    if (quiet || tickCount < WARMUP) {
      const diff = x - st.mu;
      st.mu += alpha * diff;
      st.v = (1 - alpha) * (st.v + alpha * diff * diff);
    }
    zAbsList.push(Math.abs(s.z[k]));
  });

  zAbsList.sort((a, b) => b - a);
  const top3 = zAbsList.slice(0, 3);
  s.score = Math.sqrt(top3.reduce((a, b) => a + b * b, 0) / top3.length);
  s.scoreHist.push(s.score);
  if (s.scoreHist.length > HISTORY) s.scoreHist.shift();

  if (tickCount < WARMUP) return;

  if (!s.incident) {
    s.streak = s.score > DETECT_THRESHOLD ? s.streak + 1 : 0;
    if (s.streak >= DETECT_PERSIST) {
      openIncident(s);
    }
  }
}

function diagnoseSignature(sig: Record<MetricKey, number>) {
  const norm = (v: Partial<Record<MetricKey, number>>) =>
    Math.sqrt(MK.reduce((acc, k) => acc + Math.pow(v[k] || 0, 2), 0)) || 1;
  const sn = norm(sig);

  const scored = CAUSES.map((c) => {
    const cn = norm(c.w);
    let dot = 0;
    MK.forEach((k) => {
      dot += (sig[k] || 0) * (c.w[k as MetricKey] || 0);
    });
    return {
      cause: c,
      sim: dot / (sn * cn),
    };
  });

  const T = 7.5;
  const maxSim = Math.max(...scored.map((o) => o.sim));
  const exps = scored.map((o) => Math.exp((o.sim - maxSim) * T));
  const sum = exps.reduce((a, b) => a + b, 0);

  return scored
    .map((o, i) => ({
      ...o,
      p: exps[i] / sum,
    }))
    .sort((a, b) => b.p - a.p);
}

function explainAnomaly(s: SimService, sig: Record<MetricKey, number>, ranked: any[]) {
  const top = MK.map((k) => ({ k, z: sig[k] || 0 }))
    .filter((o) => Math.abs(o.z) > 1.6)
    .sort((a, b) => Math.abs(b.z) - Math.abs(a.z))
    .slice(0, 3);

  if (!top.length) {
    return `On ${s.name}, telemetry drifted beyond standard baselines without a single dominant driver.`;
  }

  const labelMap: Record<MetricKey, string> = {
    cpu: "CPU utilization",
    mem: "Memory usage",
    rt: "Response time",
    err: "Error rate",
    req: "Request throughput",
    net: "Network egress",
    io: "Disk I/O latency",
    db: "Database connections",
  };

  const phrases = top.map((o) => {
    const ratio = (s.cur[o.k] / Math.max(s.stats[o.k].mu, 0.001)).toFixed(1);
    return `${labelMap[o.k]} jumped to ${ratio}× baseline (z=${o.z > 0 ? "+" : ""}${o.z.toFixed(1)})`;
  });

  const causeId = ranked[0]?.cause?.id;
  const explanations: Record<string, string> = {
    surge: "Inbound requests and CPU escalated synchronously while error rates remained manageable, pointing to an organic traffic surge requiring horizontal scaling.",
    leak: "Memory consumption exhibited a continuous monotonic slope while request traffic remained flat, characteristic of an internal heap leak.",
    pool: "Response times and error rates surged dramatically alongside connection count while ingress traffic remained level, indicating queries are blocked waiting for DB handles.",
    upstream: "Error rates surged while ingress traffic declined, indicating the failure originated downstream from external authorization timeouts.",
    diskio: "Disk write latency spiked ahead of API latency, demonstrating that storage I/O contention is causing request backlog.",
    cpu: "CPU pegged at peak capacity without a matching surge in requests, indicating CPU throttling or noisy neighbor contention on the host node.",
    netsat: "Network throughput saturated interface thresholds first, followed by latency degradation.",
    cache_hot: "High cache CPU and latency without network drop indicate hotkey hash eviction storms.",
  };

  return `On ${s.name}, ${phrases.join(", ")}. ${explanations[causeId] || ""}`;
}

function openIncident(s: SimService) {
  const inc = {
    id: `INC-${incidentIdSeq++}`,
    svc: s.id,
    svcName: s.name,
    startTick: s.fault ? tickCount - s.fault.age : tickCount,
    detectTick: tickCount,
    state: "diagnosing",
    log: [
      {
        t: tickCount,
        timeStr: formatClock(tickCount),
        text: `Anomaly detected on ${s.name} — anomaly score ${s.score.toFixed(1)} exceeded threshold ${DETECT_THRESHOLD}`,
      },
    ],
    sig: null as Record<MetricKey, number> | null,
    ranked: null as any[] | null,
    explanation: "",
    action: "",
    chosen: null as string | null,
    stepIx: 0,
    verifyTicks: 0,
    samples: [] as any[],
    verify: null as any,
    resolvedTick: null as number | null,
    approvedTick: null as number | null,
    peakRt: s.cur.rt,
    baseRt: s.stats.rt.mu,
  };

  s.incident = inc;
  s.streak = 0;
  allIncidents.unshift(inc);
  selectedSvc = s.id;
}

function advanceIncident(s: SimService) {
  const inc = s.incident;
  if (!inc) return;
  inc.peakRt = Math.max(inc.peakRt, s.cur.rt);

  if (inc.state === "diagnosing") {
    inc.sig = Object.fromEntries(MK.map((k) => [k, s.z[k]])) as Record<MetricKey, number>;
    inc.ranked = diagnoseSignature(inc.sig);
    inc.explanation = explainAnomaly(s, inc.sig, inc.ranked);
    inc.action = inc.ranked[0]?.cause?.fix || "scale_out";

    inc.log.push({
      t: tickCount,
      timeStr: formatClock(tickCount),
      text: `Root-cause isolated: ${inc.ranked[0]?.cause?.label} (${Math.round(inc.ranked[0]?.p * 100)}% confidence)`,
    });
    inc.log.push({
      t: tickCount,
      timeStr: formatClock(tickCount),
      text: `Recommended runbook: ${ACTIONS[inc.action]?.title}`,
    });

    inc.state = "approval";

    // Auto-approve if policy enabled and risk is low
    if (autoApprove && ACTIONS[inc.action]?.risk === "low") {
      inc.log.push({
        t: tickCount,
        timeStr: formatClock(tickCount),
        text: "Auto-approved execution under low-risk autonomous policy",
      });
      approveAction(inc, inc.action, true);
    }
    return;
  }

  if (inc.state === "remediating") {
    const actionDef = ACTIONS[inc.chosen || inc.action];
    const steps = actionDef?.steps || [];
    if (inc.stepIx < steps.length) {
      inc.log.push({
        t: tickCount,
        timeStr: formatClock(tickCount),
        text: steps[inc.stepIx],
        done: true,
      });
      inc.stepIx++;

      if (inc.stepIx === 1 && s.fault) {
        s.fault.mitigated = true;
        s.fault.effective = inc.chosen === s.fault.fix;
      }
    } else {
      inc.log.push({
        t: tickCount,
        timeStr: formatClock(tickCount),
        text: "Runbook execution sequence completed — commencing telemetry verification window",
      });
      inc.state = "verifying";
      inc.verifyTicks = 0;
      inc.samples = [];
    }
    return;
  }

  if (inc.state === "verifying") {
    inc.verifyTicks++;
    if (inc.verifyTicks > 2) {
      inc.samples.push({ rt: s.cur.rt, err: s.cur.err, score: s.score });
    }

    if (inc.verifyTicks >= 6) {
      const avg = (k: "rt" | "err" | "score") =>
        inc.samples.reduce((a: number, b: any) => a + b[k], 0) / (inc.samples.length || 1);
      const avgRt = avg("rt");
      const avgScore = avg("score");
      const avgErr = avg("err");

      const pass = avgRt <= inc.baseRt * 1.35 && avgScore < 2.8;
      inc.verify = {
        rt: avgRt,
        score: avgScore,
        err: avgErr,
        pass,
        baseRt: inc.baseRt,
        peakRt: inc.peakRt,
      };

      inc.resolvedTick = tickCount;
      if (pass) {
        inc.state = "resolved";
        inc.log.push({
          t: tickCount,
          timeStr: formatClock(tickCount),
          text: `Verification passed: response latency restored to ${Math.round(avgRt)}ms (baseline ${Math.round(inc.baseRt)}ms) — incident resolved`,
          done: true,
        });
        s.fault = null;
        s.incident = null;
      } else {
        inc.state = "escalated";
        inc.log.push({
          t: tickCount,
          timeStr: formatClock(tickCount),
          text: `Verification failed: response latency remains elevated at ${Math.round(avgRt)}ms against ${Math.round(inc.baseRt)}ms baseline — escalating for manual operator intervention`,
        });
      }
    }
  }
}

function approveAction(inc: any, actionId: string, silent = false) {
  inc.chosen = actionId;
  inc.stepIx = 0;
  inc.state = "remediating";
  inc.approvedTick = tickCount;
  if (!silent) {
    inc.log.push({
      t: tickCount,
      timeStr: formatClock(tickCount),
      text: `Approved by SRE Operator: ${ACTIONS[actionId]?.title}`,
    });
  }
}

function rejectAction(inc: any) {
  inc.state = "held";
  inc.log.push({
    t: tickCount,
    timeStr: formatClock(tickCount),
    text: "Operator held the runbook — remaining in telemetry observation mode",
  });
}

function reDiagnoseIncident(inc: any) {
  const s = getService(inc.svc);
  if (!s) return;
  inc.sig = Object.fromEntries(MK.map((k) => [k, s.z[k]])) as Record<MetricKey, number>;
  inc.ranked = diagnoseSignature(inc.sig);
  inc.explanation = explainAnomaly(s, inc.sig, inc.ranked);

  const prev = inc.chosen;
  const next = inc.ranked.find((r: any) => r.cause.fix !== prev) || inc.ranked[0];
  inc.action = next.cause.fix;
  inc.state = "approval";
  inc.chosen = null;
  inc.verify = null;
  inc.stepIx = 0;
  inc.log.push({
    t: tickCount,
    timeStr: formatClock(tickCount),
    text: `Re-analyzed post-action telemetry signature: ${next.cause.label} (${Math.round(next.p * 100)}% confidence)`,
  });
}

function simulateTick() {
  tickCount++;
  fleet.forEach((s) => {
    stepFault(s);
    sampleMetrics(s);
    updateDetector(s);
    advanceIncident(s);
  });
}

// Seed baseline warmup so app loads with realistic historical graphs
for (let i = 0; i < 28; i++) {
  simulateTick();
}

// Interval timer
let timer = setInterval(() => {
  if (isRunning) {
    simulateTick();
  }
}, 1000 / simSpeed);

function resetTimer() {
  clearInterval(timer);
  timer = setInterval(() => {
    if (isRunning) {
      simulateTick();
    }
  }, 1000 / simSpeed);
}

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), tick: tickCount });
});

app.get("/api/fleet", (_req, res) => {
  const activeInc = allIncidents.find((i) =>
    ["diagnosing", "approval", "remediating", "verifying", "escalated", "held"].includes(i.state)
  );
  const doneIncidents = allIncidents.filter((i) => i.resolvedTick);
  const resolved = doneIncidents.filter((i) => i.state === "resolved");

  const mttd = allIncidents.length
    ? (allIncidents.reduce((a, b) => a + (b.detectTick - b.startTick), 0) / allIncidents.length) * TICK_SECONDS
    : 0;

  const mttr = doneIncidents.length
    ? (doneIncidents.reduce((a, b) => a + (b.resolvedTick - b.detectTick), 0) / doneIncidents.length) * TICK_SECONDS
    : 0;

  const successRate = doneIncidents.length ? Math.round((resolved.length / doneIncidents.length) * 100) : 100;

  res.json({
    tick: tickCount,
    running: isRunning,
    speed: simSpeed,
    autoApprove,
    selectedSvc,
    fleet,
    activeIncident: activeInc || null,
    history: allIncidents,
    kpis: {
      totalIncidents: allIncidents.length,
      resolvedCount: resolved.length,
      mttdSeconds: Math.round(mttd),
      mttrSeconds: Math.round(mttr),
      successRate,
    },
  });
});

app.post("/api/fleet/select", (req, res) => {
  const { serviceId } = req.body;
  if (serviceId && fleet.some((s) => s.id === serviceId)) {
    selectedSvc = serviceId;
  }
  res.json({ success: true, selectedSvc });
});

app.post("/api/fleet/controls", (req, res) => {
  const { running, speed, autoApprove: autoApp } = req.body;
  if (typeof running === "boolean") isRunning = running;
  if (typeof speed === "number" && [1, 2, 4].includes(speed)) {
    simSpeed = speed;
    resetTimer();
  }
  if (typeof autoApp === "boolean") autoApprove = autoApp;

  res.json({ isRunning, simSpeed, autoApprove });
});

app.post("/api/fleet/tick", (_req, res) => {
  simulateTick();
  res.json({ success: true, tick: tickCount });
});

app.post("/api/faults/inject", (req, res) => {
  const { faultId, serviceId, customMult } = req.body;

  const FAULT_PRESETS: Record<string, any> = {
    surge: {
      id: "surge",
      service: "api",
      label: "API Traffic Surge (3.3× ingress load)",
      mult: { req: 3.3, cpu: 2.5, net: 2.9, rt: 4.6, err: 3.2 },
      ramp: 5,
      fix: "scale_out",
    },
    leak: {
      id: "leak",
      service: "auth",
      label: "Auth Service Heap Memory Leak",
      mult: { mem: 1.75, rt: 2.8, cpu: 1.45, err: 2.5 },
      ramp: 8,
      fix: "rolling_restart",
    },
    pool: {
      id: "pool",
      service: "api",
      label: "PostgreSQL Connection Pool Exhaustion",
      mult: { db: 2.6, rt: 5.4, err: 12.0, cpu: 1.15, req: 0.92 },
      ramp: 4,
      fix: "reset_pool",
    },
    upstream: {
      id: "upstream",
      service: "auth",
      label: "Upstream OIDC / Identity Provider Failure",
      mult: { err: 28.0, rt: 3.6, req: 0.55, cpu: 0.8 },
      ramp: 3,
      fix: "failover",
    },
    diskio: {
      id: "diskio",
      service: "db",
      label: "Primary DB Storage I/O Contention (WAL Backlog)",
      mult: { io: 4.5, rt: 6.8, cpu: 1.6, db: 1.5 },
      ramp: 6,
      fix: "throttle_backup",
    },
    cpu: {
      id: "cpu",
      service: "db",
      label: "Noisy Neighbor Host CPU Saturation",
      mult: { cpu: 2.3, rt: 2.7 },
      ramp: 4,
      fix: "reschedule",
    },
    netsat: {
      id: "netsat",
      service: "web",
      label: "Edge Network Egress Saturation",
      mult: { net: 3.6, rt: 3.0, err: 2.8, cpu: 1.35 },
      ramp: 5,
      fix: "cdn_shield",
    },
    cache_hot: {
      id: "cache_hot",
      service: "cache",
      label: "Redis Cache Key Eviction Thundering Herd",
      mult: { cpu: 2.8, rt: 5.5, req: 1.6, err: 2.2 },
      ramp: 4,
      fix: "redis_flush_expired",
    },
  };

  let targetFault = FAULT_PRESETS[faultId];
  if (!targetFault && customMult && serviceId) {
    targetFault = {
      id: `custom_${Date.now()}`,
      service: serviceId,
      label: `Custom Chaos Experiment on ${serviceId}`,
      mult: customMult,
      ramp: 4,
      fix: "scale_out",
    };
  }

  if (!targetFault) {
    return res.status(400).json({ error: "Invalid fault scenario specified." });
  }

  const s = getService(targetFault.service);
  if (!s) {
    return res.status(404).json({ error: `Service ${targetFault.service} not found.` });
  }

  if (s.fault || s.incident) {
    return res.status(409).json({ error: `Service ${s.name} already has an active anomaly in progress.` });
  }

  s.fault = {
    ...targetFault,
    age: 0,
    intensity: 0.02,
    mitigated: false,
    effective: false,
  };
  selectedSvc = s.id;

  res.json({ success: true, fault: s.fault, service: s.name });
});

app.post("/api/incidents/:id/approve", (req, res) => {
  const { id } = req.params;
  const { actionId } = req.body;
  const inc = allIncidents.find((i) => i.id === id);
  if (!inc) return res.status(404).json({ error: "Incident not found" });

  const chosenAction = actionId || inc.action;
  approveAction(inc, chosenAction);
  res.json({ success: true, incident: inc });
});

app.post("/api/incidents/:id/reject", (req, res) => {
  const { id } = req.params;
  const inc = allIncidents.find((i) => i.id === id);
  if (!inc) return res.status(404).json({ error: "Incident not found" });

  rejectAction(inc);
  res.json({ success: true, incident: inc });
});

app.post("/api/incidents/:id/rediagnose", (req, res) => {
  const { id } = req.params;
  const inc = allIncidents.find((i) => i.id === id);
  if (!inc) return res.status(404).json({ error: "Incident not found" });

  reDiagnoseIncident(inc);
  res.json({ success: true, incident: inc });
});

// -------------------------------------------------------------
// Gemini AI Endpoints
// -------------------------------------------------------------
app.post("/api/ai/diagnose", async (req, res) => {
  const { incidentId } = req.body;
  const inc = allIncidents.find((i) => i.id === incidentId) || allIncidents[0];

  if (!inc) {
    return res.status(404).json({ error: "No incident available for diagnosis" });
  }

  const s = getService(inc.svc);
  const prompt = `You are OpsGuard AI, a Principal Site Reliability Engineer (SRE) and Autonomous Incident Response Engine.
Analyze the following live incident telemetry from production:
- Incident ID: ${inc.id}
- Service: ${inc.svcName} (${s?.kind || "Microservice"})
- Anomaly Score: ${s?.score.toFixed(2) || "3.9"} (Threshold: ${DETECT_THRESHOLD})
- Metrics at trigger:
  * Latency: ${s?.cur.rt.toFixed(0)} ms (Baseline: ${inc.baseRt.toFixed(0)} ms)
  * CPU: ${s?.cur.cpu.toFixed(1)}% (Baseline: ${s?.base.cpu}%)
  * Memory: ${s?.cur.mem.toFixed(1)}% (Baseline: ${s?.base.mem}%)
  * Error Rate: ${s?.cur.err.toFixed(2)}% (Baseline: ${s?.base.err}%)
  * Ingress Throughput: ${s?.cur.req.toFixed(0)} req/min
  * DB Connections: ${s?.cur.db.toFixed(0)}
  * Disk I/O Latency: ${s?.cur.io.toFixed(1)} ms
- Statistical Anomaly Z-scores: ${JSON.stringify(inc.sig || s?.z || {})}
- Preliminary Classified Cause: ${inc.ranked?.[0]?.cause?.label || "Resource Drift"}
- Recommended Runbook: ${ACTIONS[inc.action]?.title || "Auto-remediation"}

Return a JSON object with this exact structure:
{
  "executiveSummary": "Concise 2-sentence summary of the outage for leadership",
  "rootCause": "Deep technical deduction explaining the underlying mechanism",
  "blastRadius": "Description of upstream/downstream user impact across the microservice topology",
  "confidenceScore": 94,
  "actionableFix": "Specific immediate remedial runbook action with parameters",
  "verificationCommand": "kubectl or psql verification command to validate fix",
  "preventativeMeasures": ["bullet 1", "bullet 2", "bullet 3"]
}`;

  try {
    const ai = getAI();
    if (!ai) {
      // Fallback if no API key
      return res.json({
        executiveSummary: `${inc.svcName} is experiencing performance degradation due to ${inc.ranked?.[0]?.cause?.label || "elevated load"}. Telemetry shows response time at ${s?.cur.rt.toFixed(0)}ms against a ${inc.baseRt.toFixed(0)}ms baseline.`,
        rootCause: inc.explanation || "Resource metrics drifted beyond 3.5 standard deviations from the learned empirical baseline.",
        blastRadius: `Ingress traffic routing through ${inc.svcName} is experiencing increased latency and minor packet retransmission. Downstream services are at risk of cascading timeouts.`,
        confidenceScore: Math.round((inc.ranked?.[0]?.p || 0.88) * 100),
        actionableFix: ACTIONS[inc.action]?.title || "Scale out replica set and recycle connection handles",
        verificationCommand: `kubectl top pods -l app=${inc.svcName} && curl -w "@curl-format.txt" -o /dev/null -s https://${inc.svcName}.internal/healthz`,
        preventativeMeasures: [
          "Tune Horizontal Pod Autoscaler targetCPUUtilizationPercentage to 65%",
          "Configure circuit-breaker trip thresholds with 1500ms timeout ceilings",
          "Implement connection pool max idle lifetime pruning",
        ],
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    inc.aiReport = parsed;
    res.json(parsed);
  } catch (error: any) {
    console.warn("Gemini diagnose error or high demand, using fallback SRE analysis:", error?.message);
    const fallbackReport = {
      executiveSummary: `${inc.svcName} is experiencing performance degradation due to ${inc.ranked?.[0]?.cause?.label || "elevated load"}. Telemetry shows response time at ${s?.cur.rt.toFixed(0)}ms against a ${inc.baseRt.toFixed(0)}ms baseline.`,
      rootCause: inc.explanation || "Resource metrics drifted beyond 3.5 standard deviations from the learned empirical baseline.",
      blastRadius: `Ingress traffic routing through ${inc.svcName} is experiencing increased latency and minor packet retransmission. Downstream services are at risk of cascading timeouts.`,
      confidenceScore: Math.round((inc.ranked?.[0]?.p || 0.88) * 100),
      actionableFix: ACTIONS[inc.action]?.title || "Scale out replica set and recycle connection handles",
      verificationCommand: `kubectl top pods -l app=${inc.svcName} && curl -w "@curl-format.txt" -o /dev/null -s https://${inc.svcName}.internal/healthz`,
      preventativeMeasures: [
        "Tune Horizontal Pod Autoscaler targetCPUUtilizationPercentage to 65%",
        "Configure circuit-breaker trip thresholds with 1500ms timeout ceilings",
        "Implement connection pool max idle lifetime pruning",
      ],
    };
    inc.aiReport = fallbackReport;
    res.json(fallbackReport);
  }
});

app.post("/api/ai/copilot", async (req, res) => {
  const { query, history = [] } = req.body;

  const fleetOverview = fleet.map((s) => ({
    name: s.name,
    cpu: `${s.cur.cpu.toFixed(0)}%`,
    latency: `${s.cur.rt.toFixed(0)}ms`,
    errorRate: `${s.cur.err.toFixed(2)}%`,
    score: s.score.toFixed(1),
    status: s.incident ? "INCIDENT_ACTIVE" : s.score > 2.5 ? "ELEVATED" : "HEALTHY",
  }));

  const activeInc = allIncidents.find((i) =>
    ["diagnosing", "approval", "remediating", "verifying", "escalated", "held"].includes(i.state)
  );

  const systemContext = `You are OpsGuard Copilot, an expert AI Site Reliability Engineer integrated directly into the infrastructure telemetry cluster.
Current live fleet state:
${JSON.stringify(fleetOverview, null, 2)}

Active Incident:
${activeInc ? JSON.stringify({ id: activeInc.id, service: activeInc.svcName, state: activeInc.state, rootCause: activeInc.ranked?.[0]?.cause?.label, action: activeInc.action }, null, 2) : "None (All systems nominal)"}

Available Runbooks:
${Object.keys(ACTIONS).map((k) => `- ${k}: ${ACTIONS[k].title}`).join("\n")}

Respond to the user's operational query in a direct, crisp, and authoritative SRE tone. Use markdown code snippets, bullet points, and specific metric numbers. Keep explanations concise and actionable.`;

  try {
    const ai = getAI();
    if (!ai) {
      return res.json({
        reply: `**[OpsGuard Offline SRE Engine]**\n\nI am monitoring **${fleet.length} microservices** in real time.\n\n` +
          (activeInc
            ? `⚠️ **Active Incident ${activeInc.id} on ${activeInc.svcName}**:\n- **Status:** \`${activeInc.state}\`\n- **Diagnosis:** ${activeInc.ranked?.[0]?.cause?.label || "Elevated anomaly score"}\n- **Recommended Action:** ${ACTIONS[activeInc.action]?.title}\n\nYou can approve this runbook directly in the Incident Workspace.`
            : `✅ **Fleet Health:** All systems nominal. Current telemetry readings are well within the learned empirical baselines across CPU, memory, and latency.\n\n*Tip: Configure \`GEMINI_API_KEY\` in Settings to activate the live Gemini 3.8 Flash intelligence copilot.*`),
      });
    }

    const contents = [
      { role: "user", parts: [{ text: `${systemContext}\n\nUser Question: ${query}` }] },
    ];

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents,
    });

    res.json({ reply: response.text || "OpsGuard Copilot was unable to formulate a response." });
  } catch (error: any) {
    console.warn("Gemini Copilot fallback:", error?.message);
    res.json({
      reply: `**[OpsGuard SRE Autonomous Intelligence]**\n\n` +
        (activeInc
          ? `### ⚠️ Active Incident: ${activeInc.id} (${activeInc.svcName})\n` +
            `- **Identified Issue:** ${activeInc.ranked?.[0]?.cause?.label || "Telemetry Deviation"}\n` +
            `- **Recommended Runbook:** \`${ACTIONS[activeInc.action]?.title}\`\n` +
            `- **Current State:** \`${activeInc.state.toUpperCase()}\`\n` +
            `- **Peak Latency:** ${Math.round(activeInc.peakRt)}ms vs ${Math.round(activeInc.baseRt)}ms baseline\n\n` +
            `**Immediate Actions:**\n1. Review the execution steps in the **Incident Room**.\n2. Click **Approve & Execute Runbook** to trigger mitigation.\n3. The detector will autonomously verify post-recovery metrics.`
          : `### ✅ Fleet Status: Nominal\n` +
            `All ${fleet.length} microservices are operating inside their learned Gaussian envelopes.\n` +
            `- **api-gateway:** ${Math.round(fleet.find(s=>s.id==='api')?.cur.rt || 186)}ms latency (Healthy)\n` +
            `- **auth-service:** ${Math.round(fleet.find(s=>s.id==='auth')?.cur.rt || 124)}ms latency (Healthy)\n` +
            `- **postgres-primary:** ${Math.round(fleet.find(s=>s.id==='db')?.cur.rt || 28)}ms latency (Healthy)\n\n` +
            `To simulate a production outage, open the **Chaos Lab** and trigger an API traffic surge or memory leak.`),
    });
  }
});

app.post("/api/ai/postmortem", async (req, res) => {
  const { incidentId } = req.body;
  const inc = allIncidents.find((i) => i.id === incidentId) || allIncidents[0];

  if (!inc) {
    return res.status(404).json({ error: "Incident not found for post-mortem generation" });
  }

  const prompt = `Generate an industry-standard blameless Post-Mortem Incident Report for:
Incident ID: ${inc.id}
Service: ${inc.svcName}
Triggered: Tick ${inc.startTick} (${formatClock(inc.startTick)})
Detected: Tick ${inc.detectTick} (${formatClock(inc.detectTick)})
Resolved: ${inc.resolvedTick ? `Tick ${inc.resolvedTick} (${formatClock(inc.resolvedTick)})` : "Still in progress"}
Mean Time to Detect (MTTD): ${(inc.detectTick - inc.startTick) * TICK_SECONDS} seconds
Mean Time to Resolve (MTTR): ${inc.resolvedTick ? (inc.resolvedTick - inc.detectTick) * TICK_SECONDS : 45} seconds
Peak Response Latency: ${inc.peakRt.toFixed(0)} ms (Baseline: ${inc.baseRt.toFixed(0)} ms)
Probable Root Cause: ${inc.ranked?.[0]?.cause?.label || "Resource Saturation"}
Action Executed: ${ACTIONS[inc.chosen || inc.action]?.title || "Runbook mitigation"}
Timeline entries:
${inc.log.map((l: any) => `- [${l.timeStr}] ${l.text}`).join("\n")}

Format output in rich GitHub-flavored Markdown containing:
1. # Incident Post-Mortem: ${inc.id} - ${inc.svcName}
2. Executive Summary
3. Impact Analysis & SLO Budget Depletion
4. Chronological Incident Timeline
5. Five Whys (Root Cause Analysis)
6. What Went Well vs. Where We Got Lucky
7. Action Items & Corrective Prevention (P0, P1, P2 table)`;

  try {
    const ai = getAI();
    if (!ai) {
      return res.json({
        markdown: `# Incident Post-Mortem: ${inc.id} — ${inc.svcName}
## Executive Summary
On ${new Date().toLocaleDateString()}, **${inc.svcName}** experienced an automated Sev-2 anomaly incident. The autonomous OpsGuard detection engine flagged the deviation within **${(inc.detectTick - inc.startTick) * TICK_SECONDS}s** of onset. Response latency reached **${inc.peakRt.toFixed(0)}ms** against a normal **${inc.baseRt.toFixed(0)}ms** baseline.

## Root Cause
${inc.ranked?.[0]?.cause?.label || "Resource exhaustion and latency spike"}.
${inc.explanation || "Metrics deviated significantly from the learned empirical envelope."}

## Action Executed
- **Runbook:** ${ACTIONS[inc.chosen || inc.action]?.title}
- **Resolution Status:** Verified resolved back within SLA limits.

## Action Items
| Priority | Action | Owner | Target |
|---|---|---|---|
| P0 | Audit HPA thresholds and burst quotas | SRE Core | Sprint +1 |
| P1 | Implement proactive anomaly alerting webhook | DevOps | Sprint +1 |
| P2 | Enhance circuit breaker fallback telemetry | App Team | Sprint +2 |
`,
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
    });

    res.json({ markdown: response.text });
  } catch (error: any) {
    console.warn("Gemini postmortem fallback:", error?.message);
    res.json({
      markdown: `# Incident Post-Mortem: ${inc.id} — ${inc.svcName}
## Executive Summary
On ${new Date().toLocaleDateString()}, **${inc.svcName}** experienced an automated Sev-2 anomaly incident. The autonomous OpsGuard detection engine flagged the deviation within **${(inc.detectTick - inc.startTick) * TICK_SECONDS}s** of onset. Response latency reached **${inc.peakRt.toFixed(0)}ms** against a normal **${inc.baseRt.toFixed(0)}ms** baseline.

## Root Cause Analysis
- **Primary Mechanism:** ${inc.ranked?.[0]?.cause?.label || "Resource exhaustion and latency spike"}.
- **Telemetry Correlation:** ${inc.explanation || "Metrics deviated significantly from the learned empirical envelope."}

## Mitigation & Runbook Executed
- **Runbook:** ${ACTIONS[inc.chosen || inc.action]?.title || "Automated Remediation"}
- **Outcome:** ${inc.verify?.pass ? "Verified SLA restored back within baseline envelope." : "Runbook completed; operational observation continued."}

## Action Items & Preventative Hardening
| Priority | Action Item | Assignee | Timeline |
|---|---|---|---|
| P0 | Verify autoscaling min/max replica boundaries | Platform SRE | 24 Hours |
| P1 | Tune dynamic anomaly detection sensitivity (z-score threshold 3.5) | Observability | 3 Days |
| P2 | Run load chaos test in staging cluster | QA / DevOps | 1 Week |
`,
    });
  }
});

// -------------------------------------------------------------
// Vite Middleware / Static Serving Setup
// -------------------------------------------------------------
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[OpsGuard AI] Server running on http://0.0.0.0:${PORT}`);
  });
}

start();
