import React from "react";
import { ServiceState, MetricKey, MetricDef } from "../types";
import { Activity, Gauge, Cpu, Database, Network, HardDrive, AlertTriangle, ArrowUpRight } from "lucide-react";

interface TelemetryInspectorProps {
  service: ServiceState;
}

const METRIC_DEFS: MetricDef[] = [
  { k: "rt", label: "Response Latency", unit: "ms", dec: 0, description: "P95 end-to-end request response latency" },
  { k: "cpu", label: "CPU Utilization", unit: "%", dec: 1, description: "Host & pod compute cycle consumption" },
  { k: "mem", label: "Memory Footprint", unit: "%", dec: 1, description: "Resident set memory allocation vs container limit" },
  { k: "err", label: "Error Rate", unit: "%", dec: 2, description: "HTTP 5xx & connection drop percentage" },
  { k: "req", label: "Throughput", unit: "req/m", dec: 0, description: "Inbound HTTP request traffic frequency" },
  { k: "net", label: "Network Bandwidth", unit: "Mbps", dec: 0, description: "Ingress/egress data throughput" },
  { k: "io", label: "Storage I/O Latency", unit: "ms", dec: 1, description: "Disk write wait time & WAL queue latency" },
  { k: "db", label: "DB Connections", unit: "conns", dec: 0, description: "Active open postgres client connection handles" },
];

export function TelemetryInspector({ service }: TelemetryInspectorProps) {
  // Main telemetry chart (Anomaly score & Response time)
  const W = 680;
  const H = 150;
  const scores = service.scoreHist.slice(-70);
  const maxScore = Math.max(6, ...scores) * 1.15;
  const rtValues = service.hist.rt.slice(-70);
  const maxRt = Math.max(...rtValues, 1);
  const minRt = Math.min(...rtValues, 0);

  const getYScore = (v: number) => H - (v / maxScore) * (H - 12) - 6;
  const getYRt = (v: number) => H - ((v - minRt) / (maxRt - minRt || 1)) * (H - 30) - 12;

  // Grid lines
  const gridLevels = [0, 2, 4, 6, 8].filter((l) => l <= maxScore);

  // Score line & area
  const scorePts = scores.map((v, i) => {
    const x = (i / Math.max(scores.length - 1, 1)) * W;
    const y = getYScore(v);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const dScore = scorePts.length ? `M ${scorePts.join(" L ")}` : "";
  const fillScore = dScore ? `${dScore} L ${W},${H} L 0,${H} Z` : "";

  // Rt line
  const rtPts = rtValues.map((v, i) => {
    const x = (i / Math.max(rtValues.length - 1, 1)) * W;
    const y = getYRt(v);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const dRt = rtPts.length ? `M ${rtPts.join(" L ")}` : "";

  const renderMiniSpark = (values: number[], isAbnormal: boolean) => {
    if (!values || values.length < 2) return null;
    const w = 110;
    const h = 20;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const pts = values.map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const col = isAbnormal ? "#f43f5e" : "#06b6d4";
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-5 overflow-visible">
        <path d={`M ${pts.join(" L ")}`} fill="none" stroke={col} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/90 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-950/60 border border-cyan-800/50">
            <Activity className="h-4 w-4 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-white tracking-tight">{service.name}</h2>
              <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-mono text-slate-300">
                {service.kind.split("·")[0].trim()}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Anomaly score: <span className="font-mono font-semibold text-cyan-300">{service.score.toFixed(2)}</span>
              {" · "}Baseline status: <span className="text-emerald-400">Empirical Gaussian Envelope Active</span>
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-medium">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
            <span className="text-slate-300">Anomaly Score</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3.5 border-t-2 border-dashed border-rose-500" />
            <span className="text-rose-300 font-mono text-[11px]">Threshold (3.5)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1 w-3 bg-slate-500 rounded" />
            <span className="text-slate-400">Latency Trend</span>
          </span>
        </div>
      </div>

      {/* Main Multi-Metric Telemetry Chart */}
      <div className="my-4 rounded-lg bg-slate-950/80 border border-slate-800/80 p-3">
        <div className="w-full overflow-hidden">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-36 overflow-visible">
            {/* Grid lines */}
            {gridLevels.map((lvl) => {
              const y = getYScore(lvl);
              return (
                <g key={lvl}>
                  <line x1="0" y1={y} x2={W} y2={y} stroke="rgba(51, 65, 85, 0.4)" strokeWidth="1" />
                  <text x="4" y={y - 3} fontSize="9" fill="rgba(148, 163, 184, 0.6)" className="font-mono">
                    z={lvl}
                  </text>
                </g>
              );
            })}

            {/* Threshold line */}
            <line
              x1="0"
              y1={getYScore(3.5)}
              x2={W}
              y2={getYScore(3.5)}
              stroke="#f43f5e"
              strokeWidth="1.5"
              strokeDasharray="5 4"
            />

            {/* Latency line (secondary) */}
            {dRt && <path d={dRt} fill="none" stroke="rgba(148, 163, 184, 0.4)" strokeWidth="1.2" />}

            {/* Anomaly score fill & line */}
            {fillScore && <path d={fillScore} fill="rgba(6, 182, 212, 0.12)" />}
            {dScore && <path d={dScore} fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinejoin="round" />}

            {/* Current point */}
            {scorePts.length > 0 && (
              <circle
                cx={scorePts[scorePts.length - 1].split(",")[0]}
                cy={scorePts[scorePts.length - 1].split(",")[1]}
                r="4"
                fill="#22d3ee"
                className="animate-pulse"
              />
            )}
          </svg>
        </div>
      </div>

      {/* 8 Telemetry Metric Tiles Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {METRIC_DEFS.map((m) => {
          const val = service.cur[m.k];
          const z = service.z[m.k];
          const base = service.stats[m.k]?.mu || 0;
          const isHot = Math.abs(z) > 3.0;
          const isMild = !isHot && Math.abs(z) > 1.8;

          const cardBg = isHot
            ? "border-rose-500/50 bg-rose-950/20 text-rose-200"
            : isMild
            ? "border-amber-500/50 bg-amber-950/20 text-amber-200"
            : "border-slate-800/80 bg-slate-950/40 text-slate-300";

          return (
            <div key={m.k} className={`rounded-lg border p-2.5 transition ${cardBg}`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-400 truncate">{m.label}</span>
                <span
                  className={`text-[10px] font-mono font-semibold px-1 rounded ${
                    isHot ? "bg-rose-900/60 text-rose-300" : isMild ? "bg-amber-900/60 text-amber-300" : "text-slate-500"
                  }`}
                >
                  {z >= 0 ? `+${z.toFixed(1)}` : z.toFixed(1)}σ
                </span>
              </div>

              <div className="mt-1 flex items-baseline gap-1">
                <span className="font-mono text-base font-bold text-white tracking-tight">
                  {val.toFixed(m.dec)}
                </span>
                <span className="text-[10.5px] font-mono text-slate-400">{m.unit}</span>
              </div>

              <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                base: {base.toFixed(m.dec)}
              </div>

              <div className="mt-2">
                {renderMiniSpark(service.hist[m.k]?.slice(-30) || [], isHot || isMild)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
