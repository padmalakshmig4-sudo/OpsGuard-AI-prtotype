import React from "react";
import { Shield, Play, Pause, FastForward, Bot, Flame, CheckCircle2, AlertTriangle, AlertOctagon, RefreshCw } from "lucide-react";

interface TopbarProps {
  tick: number;
  running: boolean;
  speed: number;
  autoApprove: boolean;
  activeIncidentsCount: number;
  elevatedCount: number;
  onToggleRunning: () => void;
  onChangeSpeed: () => void;
  onToggleAutoApprove: (val: boolean) => void;
  onOpenCopilot: () => void;
  onOpenChaos: () => void;
  onManualTick: () => void;
}

export function Topbar({
  tick,
  running,
  speed,
  autoApprove,
  activeIncidentsCount,
  elevatedCount,
  onToggleRunning,
  onChangeSpeed,
  onToggleAutoApprove,
  onOpenCopilot,
  onOpenChaos,
  onManualTick,
}: TopbarProps) {
  const formatClock = (t: number) => {
    const sec = t * 5;
    const hh = String(Math.floor(sec / 3600)).padStart(2, "0");
    const mm = String(Math.floor(sec / 60) % 60).padStart(2, "0");
    const ss = String(sec % 60).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/90 bg-slate-950/80 backdrop-blur-md px-4 sm:px-6 py-3 transition-colors">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 shadow-md shadow-cyan-500/20">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold tracking-tight text-white sm:text-lg">
                OpsGuard <span className="text-cyan-400">AI</span>
              </span>
              <span className="hidden sm:inline-flex items-center rounded-full bg-cyan-950/80 border border-cyan-800/60 px-2 py-0.5 text-[11px] font-medium text-cyan-300">
                Autonomous SRE
              </span>
            </div>
            <p className="hidden text-xs text-slate-400 md:block">
              Intelligent telemetry surveillance & zero-touch remediation
            </p>
          </div>
        </div>

        {/* Live system state chips */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/90 px-3 py-1 text-xs font-mono text-slate-300">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>{formatClock(tick)}</span>
          </div>

          {activeIncidentsCount > 0 ? (
            <div className="flex items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-950/40 px-3 py-1 text-xs font-medium text-rose-300 shadow-sm shadow-rose-900/30">
              <AlertOctagon className="h-3.5 w-3.5 text-rose-400 animate-bounce" />
              <span>{activeIncidentsCount} active incident{activeIncidentsCount > 1 ? "s" : ""}</span>
            </div>
          ) : elevatedCount > 0 ? (
            <div className="flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-950/40 px-3 py-1 text-xs font-medium text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              <span>{elevatedCount} elevated service{elevatedCount > 1 ? "s" : ""}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-950/30 px-3 py-1 text-xs font-medium text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>All systems nominal</span>
            </div>
          )}
        </div>

        {/* Action controls & tools */}
        <div className="flex items-center gap-2">
          {/* Auto-approve policy */}
          <label
            title="Automatically trigger remediation for low-risk runbooks without human confirmation"
            className="hidden lg:flex cursor-pointer items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 text-xs text-slate-300 hover:border-slate-700 transition"
          >
            <input
              type="checkbox"
              checked={autoApprove}
              onChange={(e) => onToggleAutoApprove(e.target.checked)}
              className="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500/30"
            />
            <span className="font-medium">Auto-approve low risk</span>
          </label>

          {/* Speed switch */}
          <button
            onClick={onChangeSpeed}
            className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 text-xs font-mono font-medium text-slate-300 hover:border-slate-700 hover:text-white transition"
            title="Cycle simulation speed (1x, 2x, 4x)"
          >
            <FastForward className="h-3.5 w-3.5 text-cyan-400" />
            <span>{speed}×</span>
          </button>

          {/* Pause / Resume */}
          <button
            onClick={onToggleRunning}
            className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-700 hover:text-white transition"
            title={running ? "Pause simulation stream" : "Resume simulation stream"}
          >
            {running ? <Pause className="h-3.5 w-3.5 text-amber-400" /> : <Play className="h-3.5 w-3.5 text-emerald-400" />}
            <span className="hidden sm:inline">{running ? "Pause" : "Resume"}</span>
          </button>

          {/* Step tick */}
          <button
            onClick={onManualTick}
            className="rounded-lg border border-slate-800 bg-slate-900/80 p-1.5 text-slate-400 hover:border-slate-700 hover:text-white transition"
            title="Advance 1 simulation step"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>

          {/* Chaos Injection Center */}
          <button
            onClick={onOpenChaos}
            className="flex items-center gap-1.5 rounded-lg border border-rose-800/60 bg-rose-950/40 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-900/50 hover:border-rose-700 transition"
          >
            <Flame className="h-3.5 w-3.5 text-rose-400" />
            <span className="hidden sm:inline">Chaos Lab</span>
          </button>

          {/* Gemini AI Copilot */}
          <button
            onClick={onOpenCopilot}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm shadow-cyan-500/20 hover:from-cyan-500 hover:to-blue-500 transition"
          >
            <Bot className="h-3.5 w-3.5" />
            <span>AI Copilot</span>
          </button>
        </div>
      </div>
    </header>
  );
}
