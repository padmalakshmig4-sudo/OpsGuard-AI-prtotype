import React from "react";
import { ServiceState } from "../types";
import { Activity, Server, AlertCircle, CheckCircle, Cpu, Zap } from "lucide-react";

interface FleetGridProps {
  fleet: ServiceState[];
  selectedId: string;
  onSelect: (id: string) => void;
  onInjectFast: (faultId: string) => void;
}

export function FleetGrid({ fleet, selectedId, onSelect, onInjectFast }: FleetGridProps) {
  const renderSparkline = (values: number[], color: string) => {
    if (!values || values.length < 2) return null;
    const w = 180;
    const h = 28;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const points = values.map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const d = `M ${points.join(" L ")}`;
    const fillD = `${d} L ${w},${h} L 0,${h} Z`;

    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-7 overflow-visible">
        <path d={fillD} fill={color} opacity="0.14" />
        <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
      {fleet.map((s) => {
        const isSelected = s.id === selectedId;
        const hasIncident = !!s.incident;
        const isElevated = !hasIncident && s.score > 2.4;

        const statusColor = hasIncident
          ? "border-rose-500/80 shadow-lg shadow-rose-950/40 bg-slate-900/90"
          : isElevated
          ? "border-amber-500/70 bg-slate-900/80"
          : isSelected
          ? "border-cyan-500/80 shadow-md shadow-cyan-950/40 bg-slate-900/80"
          : "border-slate-800/80 hover:border-slate-700 bg-slate-900/60";

        const accentColor = hasIncident
          ? "#f43f5e"
          : isElevated
          ? "#f59e0b"
          : "#06b6d4";

        return (
          <div
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`group relative flex flex-col justify-between rounded-xl border p-3.5 cursor-pointer transition-all duration-200 ${statusColor}`}
          >
            {/* Top header */}
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Server className="h-3.5 w-3.5 text-slate-400 group-hover:text-cyan-400 transition" />
                    <span className="truncate font-semibold text-sm text-slate-100 group-hover:text-white">
                      {s.name}
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-slate-400 mt-0.5">{s.kind}</p>
                </div>

                {hasIncident ? (
                  <span className="flex-shrink-0 inline-flex items-center gap-1 rounded-full bg-rose-950/70 border border-rose-600/60 px-2 py-0.5 text-[10.5px] font-medium text-rose-300 animate-pulse">
                    <AlertCircle className="h-3 w-3 text-rose-400" />
                    <span>ALARM</span>
                  </span>
                ) : isElevated ? (
                  <span className="flex-shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-950/70 border border-amber-600/60 px-2 py-0.5 text-[10.5px] font-medium text-amber-300">
                    <Activity className="h-3 w-3 text-amber-400" />
                    <span>Elevated</span>
                  </span>
                ) : (
                  <span className="flex-shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-950/50 border border-emerald-700/40 px-2 py-0.5 text-[10.5px] font-medium text-emerald-400">
                    <CheckCircle className="h-3 w-3 text-emerald-400" />
                    <span>Healthy</span>
                  </span>
                )}
              </div>

              {/* Sparkline chart */}
              <div className="mt-3">
                {renderSparkline(s.hist.rt.slice(-40), accentColor)}
              </div>
            </div>

            {/* Metrics row */}
            <div className="mt-3 border-t border-slate-800/80 pt-2.5">
              <div className="grid grid-cols-3 gap-1 text-center">
                <div className="rounded bg-slate-950/40 p-1">
                  <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-mono">Latency</span>
                  <span className="font-mono text-xs font-semibold text-slate-200">
                    {Math.round(s.cur.rt)}
                    <span className="text-[10px] text-slate-400 ml-0.5">ms</span>
                  </span>
                </div>

                <div className="rounded bg-slate-950/40 p-1">
                  <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-mono">CPU</span>
                  <span className={`font-mono text-xs font-semibold ${s.cur.cpu > 75 ? "text-rose-400" : "text-slate-200"}`}>
                    {s.cur.cpu.toFixed(0)}
                    <span className="text-[10px] text-slate-400">%</span>
                  </span>
                </div>

                <div className="rounded bg-slate-950/40 p-1">
                  <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-mono">Score</span>
                  <span className="font-mono text-xs font-bold" style={{ color: accentColor }}>
                    {s.score.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>

            {/* Selected indicator bar */}
            {isSelected && (
              <div className="absolute -bottom-[1px] left-4 right-4 h-0.5 bg-cyan-400 rounded-full shadow-sm shadow-cyan-400" />
            )}
          </div>
        );
      })}
    </div>
  );
}
