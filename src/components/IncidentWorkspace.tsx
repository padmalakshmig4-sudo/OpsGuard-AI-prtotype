import React, { useState } from "react";
import { Incident, ServiceState } from "../types";
import {
  AlertOctagon,
  CheckCircle2,
  Clock,
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  Check,
  ChevronRight,
  ShieldAlert,
  Terminal,
  FileText,
  HelpCircle,
  Loader2,
} from "lucide-react";

interface IncidentWorkspaceProps {
  incident: Incident | null;
  service: ServiceState | null;
  onApprove: (actionId: string) => void;
  onReject: () => void;
  onRediagnose: () => void;
  onRequestAiReport: (incidentId: string) => void;
  onOpenPostMortem: (incidentId: string) => void;
  isAiDiagnosing: boolean;
}

const STAGES = ["Monitor", "Detect", "Diagnose", "Explain", "Recommend", "Approve", "Remediate", "Verify"];

const STAGE_MAP: Record<string, number> = {
  diagnosing: 2,
  approval: 5,
  held: 5,
  remediating: 6,
  verifying: 7,
  resolved: 8,
  escalated: 7,
};

const RUNBOOK_TITLES: Record<string, { title: string; detail: string; risk: "low" | "medium" | "high"; steps: string[] }> = {
  scale_out: {
    title: "Horizontal Pod Autoscaler (Scale to 8 Pods)",
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
    detail: "Gracefully cycle worker pods one-by-one to purge JVM/V8 memory leak with zero downtime.",
    risk: "medium",
    steps: [
      "Drain active HTTP sessions on target pod 1",
      "Terminate pod 1, restart container and verify readiness probe",
      "Incrementally cycle remaining pods with 30s soak interval",
      "Confirm fleet memory consumption returns to baseline",
    ],
  },
  reset_pool: {
    title: "Database Connection Pool Reclamation",
    detail: "Terminate idle-in-transaction connections and raise pool ceiling from 40 to 65 connections.",
    risk: "medium",
    steps: [
      "Inspect pg_stat_activity for lingering abandoned queries",
      "Execute pg_terminate_backend on idle transactions > 45s",
      "Dynamically reload pgbouncer pool max ceiling to 65",
      "Monitor query queue depth and verify latency normalization",
    ],
  },
  failover: {
    title: "Secondary Identity Provider Failover",
    detail: "Switch auth gateway to secondary standby region and trip circuit breaker on failing upstream IdP.",
    risk: "high",
    steps: [
      "Validate secondary IdP replication health and token signing keys",
      "Flip Route53 weighted DNS records to standby identity gateway",
      "Flush cached discovery documents and authorization codes",
      "Verify end-to-end user login success rate reaches > 99.5%",
    ],
  },
  throttle_backup: {
    title: "Throttle Backup & Flush WAL Queue",
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
    title: "Activate Origin Shield & Dynamic Compression",
    detail: "Route requests through nearest origin shield and enforce adaptive Brotli compression.",
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

export function IncidentWorkspace({
  incident,
  service,
  onApprove,
  onReject,
  onRediagnose,
  onRequestAiReport,
  onOpenPostMortem,
  isAiDiagnosing,
}: IncidentWorkspaceProps) {
  const [selectedAltAction, setSelectedAltAction] = useState<string | null>(null);

  const currentStageIndex = incident ? STAGE_MAP[incident.state] || 1 : 0;
  const actionKey = selectedAltAction || incident?.chosen || incident?.action || "scale_out";
  const actionDef = RUNBOOK_TITLES[actionKey] || {
    title: "Automated Microservice Remediation",
    detail: "Execute cluster-level recovery procedure.",
    risk: "low" as const,
    steps: ["Execute health validation", "Drain and recover instance", "Validate SLA adherence"],
  };

  const riskBadgeClass = {
    low: "bg-emerald-950/70 border-emerald-600/50 text-emerald-300",
    medium: "bg-amber-950/70 border-amber-600/50 text-amber-300",
    high: "bg-rose-950/70 border-rose-600/50 text-rose-300",
  }[actionDef.risk];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 shadow-sm flex flex-col h-full">
      {/* Workspace Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/90 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-950/80 border border-cyan-800/50">
            <ShieldAlert className="h-4 w-4 text-cyan-400" />
          </div>
          <div>
            <h2 className="font-semibold text-sm sm:text-base text-white">Autonomous Incident Room</h2>
            <p className="text-[11px] text-slate-400">
              {incident ? (
                <>
                  Tracking <span className="font-mono text-cyan-300 font-medium">{incident.id}</span> on{" "}
                  <span className="text-slate-200 font-medium">{incident.svcName}</span>
                </>
              ) : (
                "Continuous monitoring & autonomous loop"
              )}
            </p>
          </div>
        </div>

        {incident && (
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-mono font-medium border ${
                incident.state === "resolved"
                  ? "bg-emerald-950/80 border-emerald-600/60 text-emerald-300"
                  : incident.state === "escalated"
                  ? "bg-rose-950/80 border-rose-600/60 text-rose-300"
                  : "bg-cyan-950/80 border-cyan-600/60 text-cyan-300"
              }`}
            >
              State: {incident.state.toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* 8-Stage Pipeline Stepper */}
      <div className="border-b border-slate-800/90 bg-slate-950/50 px-4 py-2 sm:px-5 overflow-x-auto">
        <div className="flex items-center gap-1 sm:gap-1.5 min-w-max">
          {STAGES.map((st, i) => {
            const isPassed = !incident ? i === 0 : i < currentStageIndex;
            const isCurrent = !incident ? false : i === currentStageIndex;
            return (
              <React.Fragment key={st}>
                <div
                  className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium border transition ${
                    isCurrent
                      ? "bg-cyan-950/80 border-cyan-500 text-cyan-300 font-semibold shadow-sm shadow-cyan-500/20"
                      : isPassed
                      ? "bg-emerald-950/40 border-emerald-700/50 text-emerald-400"
                      : "bg-slate-900/40 border-slate-800/70 text-slate-400"
                  }`}
                >
                  <span className="font-mono text-[9.5px] opacity-70">{i + 1}</span>
                  <span>{st}</span>
                </div>
                {i < STAGES.length - 1 && <div className="h-0.5 w-2 sm:w-3 bg-slate-800" />}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Body Area */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4 overflow-y-auto">
        {!incident ? (
          <div className="flex flex-col items-center justify-center py-12 text-center my-auto">
            <div className="relative mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-800/60 border border-slate-700">
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              <div className="absolute -inset-1 rounded-full border border-emerald-500/30 animate-ping opacity-40" />
            </div>
            <h3 className="text-base font-semibold text-white">All Microservices Healthy</h3>
            <p className="mt-1 max-w-md text-xs text-slate-400">
              OpsGuard is running continuous empirical Gaussian surveillance across CPU, memory, latency, and error
              rates. Use the <strong className="text-rose-400">Chaos Lab</strong> above to simulate real-world incidents.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Detection Summary */}
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
                  1. Detection Telemetry
                </span>
                <span className="text-[11px] font-mono text-cyan-400">
                  Peak Latency: {Math.round(incident.peakRt)}ms (Baseline: {Math.round(incident.baseRt)}ms)
                </span>
              </div>
              <p className="mt-1.5 text-xs text-slate-200">
                Service <strong className="text-white">{incident.svcName}</strong> deviated beyond the standard
                threshold ({incident.sig ? Object.entries(incident.sig).filter(([_, z]) => Math.abs(z) > 2).length : 0} metrics elevated). Anomaly score reached{" "}
                <strong className="text-cyan-400 font-mono">
                  {service?.score.toFixed(1) || "3.8"}
                </strong>
                .
              </p>
            </div>

            {/* Root Cause Diagnosis & Probabilities */}
            {incident.ranked && incident.ranked.length > 0 && (
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono block mb-2">
                  2. Root Cause Classifier Probabilities
                </span>
                <div className="space-y-2">
                  {incident.ranked.slice(0, 3).map((item, idx) => {
                    const pct = Math.round(item.p * 100);
                    return (
                      <div key={item.cause.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-200 font-medium truncate max-w-[80%]">
                            {idx + 1}. {item.cause.label}
                          </span>
                          <span className="font-mono text-cyan-300 font-semibold">{pct}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              idx === 0 ? "bg-gradient-to-r from-cyan-500 to-blue-500" : "bg-slate-600"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Narrative Explanation */}
            {incident.explanation && (
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono block mb-1">
                  3. Autonomous Analysis
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">{incident.explanation}</p>
              </div>
            )}

            {/* Recommended Runbook & Approval Card */}
            {["approval", "held"].includes(incident.state) && (
              <div className="rounded-lg border border-cyan-800/60 bg-gradient-to-br from-cyan-950/30 to-slate-950 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400 font-mono">
                    4. Recommended Remediation Runbook
                  </span>
                  <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${riskBadgeClass}`}>
                    {actionDef.risk.toUpperCase()} RISK
                  </span>
                </div>

                <div>
                  <h4 className="font-semibold text-white text-sm">{actionDef.title}</h4>
                  <p className="text-xs text-slate-300 mt-1">{actionDef.detail}</p>
                </div>

                {/* Steps preview */}
                <div className="rounded bg-slate-900/80 border border-slate-800 p-2.5 text-xs text-slate-400 space-y-1 font-mono">
                  <span className="text-[10.5px] uppercase tracking-wider text-slate-400 block mb-1">Execution Steps:</span>
                  {actionDef.steps.map((st, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <span className="text-cyan-400 flex-shrink-0">{i + 1}.</span>
                      <span className="text-slate-300">{st}</span>
                    </div>
                  ))}
                </div>

                {/* Alternative Runbooks */}
                {incident.ranked && incident.ranked.length > 1 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-slate-400 font-medium">Alternative Runbooks:</span>
                    {incident.ranked.slice(1, 3).map((r) => {
                      const altFix = r.cause.fix;
                      const altTitle = RUNBOOK_TITLES[altFix]?.title || altFix;
                      const isSelected = selectedAltAction === altFix;
                      return (
                        <button
                          key={altFix}
                          onClick={() => setSelectedAltAction(isSelected ? null : altFix)}
                          className={`text-[11px] rounded px-2 py-1 border transition ${
                            isSelected
                              ? "bg-cyan-950 border-cyan-500 text-cyan-300"
                              : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          Switch: {altTitle.split("(")[0]}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Execution Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
                  <button
                    onClick={() => onApprove(actionKey)}
                    className="flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 shadow-sm shadow-cyan-500/20 transition"
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>Approve & Execute Runbook</span>
                  </button>

                  <button
                    onClick={onReject}
                    className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition"
                  >
                    Hold & Observe
                  </button>

                  <button
                    onClick={() => onRequestAiReport(incident.id)}
                    disabled={isAiDiagnosing}
                    className="flex items-center gap-1.5 rounded-lg border border-indigo-700/60 bg-indigo-950/40 px-3 py-2 text-xs font-medium text-indigo-300 hover:bg-indigo-900/50 transition ml-auto"
                  >
                    {isAiDiagnosing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    <span>Deep Gemini AI Audit</span>
                  </button>
                </div>
              </div>
            )}

            {/* In-Flight Remediation Progress */}
            {["remediating", "verifying"].includes(incident.state) && (
              <div className="rounded-lg border border-cyan-800/60 bg-slate-950/80 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                    <span className="text-xs font-semibold text-cyan-300 uppercase tracking-wider font-mono">
                      Remediation Sequence In Progress
                    </span>
                  </div>
                  <span className="text-xs font-mono text-slate-400">{incident.state.toUpperCase()}</span>
                </div>

                <div className="space-y-1.5 font-mono text-xs">
                  {incident.log
                    .filter((l) => l.done)
                    .map((l, i) => (
                      <div key={i} className="flex items-center gap-2 text-slate-200">
                        <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                        <span className="text-slate-400 text-[10.5px]">{l.timeStr}</span>
                        <span>{l.text}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Verification Result Banner */}
            {incident.verify && (
              <div
                className={`rounded-lg border p-4 space-y-2 ${
                  incident.verify.pass
                    ? "border-emerald-500/60 bg-emerald-950/20 text-emerald-300"
                    : "border-rose-500/60 bg-rose-950/20 text-rose-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    {incident.verify.pass ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        <span>Verification Passed — Baseline SLA Restored</span>
                      </>
                    ) : (
                      <>
                        <AlertOctagon className="h-4 w-4 text-rose-400" />
                        <span>Verification Failed — Residual Latency Remains Elevated</span>
                      </>
                    )}
                  </div>
                  <span className="font-mono text-xs">
                    Score: {incident.verify.score.toFixed(2)} / Latency: {Math.round(incident.verify.rt)}ms
                  </span>
                </div>

                <p className="text-xs text-slate-300">
                  {incident.verify.pass
                    ? `Post-remediation response latency dropped from peak ${Math.round(
                        incident.verify.peakRt
                      )}ms back to ${Math.round(incident.verify.rt)}ms (normal baseline ${Math.round(
                        incident.verify.baseRt
                      )}ms).`
                    : `Telemetry remained outside acceptable empirical limits after runbook conclusion. Escalating to human SRE on-call.`}
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  {!incident.verify.pass && (
                    <button
                      onClick={onRediagnose}
                      className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 transition"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Re-diagnose on Fresh Telemetry</span>
                    </button>
                  )}

                  <button
                    onClick={() => onOpenPostMortem(incident.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
                  >
                    <FileText className="h-3.5 w-3.5 text-cyan-400" />
                    <span>View AI Post-Mortem Report</span>
                  </button>
                </div>
              </div>
            )}

            {/* AI Deep Diagnostic Report (if generated) */}
            {incident.aiReport && (
              <div className="rounded-lg border border-indigo-700/60 bg-indigo-950/20 p-4 space-y-2">
                <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold uppercase tracking-wider font-mono">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Gemini 3.8 Flash Deep Root Cause Deduction</span>
                </div>
                <div className="text-xs text-slate-200 space-y-2">
                  <div>
                    <span className="font-semibold text-indigo-200">Executive Summary: </span>
                    {incident.aiReport.executiveSummary}
                  </div>
                  <div>
                    <span className="font-semibold text-indigo-200">Blast Radius: </span>
                    {incident.aiReport.blastRadius}
                  </div>
                  {incident.aiReport.verificationCommand && (
                    <div>
                      <span className="font-semibold text-indigo-200 block mb-1">Suggested Verification Command:</span>
                      <pre className="rounded bg-slate-950 p-2 font-mono text-[11px] text-cyan-300 overflow-x-auto border border-slate-800">
                        {incident.aiReport.verificationCommand}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Incident Chronological Timeline */}
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3.5 space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono block">
                Event Log & Telemetry Timeline
              </span>
              <div className="max-h-40 overflow-y-auto space-y-1.5 font-mono text-xs pr-1">
                {incident.log.map((l, i) => (
                  <div key={i} className="flex items-start gap-2 text-slate-300">
                    <span className="text-[11px] text-slate-500 flex-shrink-0">{l.timeStr}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-200">{l.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
