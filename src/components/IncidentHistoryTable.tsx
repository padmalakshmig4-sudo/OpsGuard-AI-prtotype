import React, { useState } from "react";
import { Incident } from "../types";
import { FileText, Search, CheckCircle2, AlertOctagon, Clock, ShieldCheck, Activity } from "lucide-react";

interface IncidentHistoryTableProps {
  incidents: Incident[];
  kpis: {
    totalIncidents: number;
    resolvedCount: number;
    mttdSeconds: number;
    mttrSeconds: number;
    successRate: number;
  };
  onOpenPostMortem: (incidentId: string) => void;
}

export function IncidentHistoryTable({ incidents, kpis, onOpenPostMortem }: IncidentHistoryTableProps) {
  const [filterQuery, setFilterQuery] = useState("");

  const formatClock = (t: number) => {
    const sec = t * 5;
    const hh = String(Math.floor(sec / 3600)).padStart(2, "0");
    const mm = String(Math.floor(sec / 60) % 60).padStart(2, "0");
    const ss = String(sec % 60).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  };

  const filtered = incidents.filter((inc) => {
    const q = filterQuery.toLowerCase();
    return (
      inc.id.toLowerCase().includes(q) ||
      inc.svcName.toLowerCase().includes(q) ||
      (inc.ranked?.[0]?.cause?.label || "").toLowerCase().includes(q) ||
      inc.state.toLowerCase().includes(q)
    );
  });

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5 shadow-sm space-y-4">
      {/* Header & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/90 pb-3">
        <div>
          <h3 className="font-semibold text-white text-base">Incident History & Audit Ledger</h3>
          <p className="text-xs text-slate-400">Chronological track record of autonomous detections and recovery outcomes</p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter by service, cause, ID..."
            className="w-full rounded-lg border border-slate-700 bg-slate-950 py-1.5 pl-8 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-sans"
          />
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <div className="rounded-lg border border-slate-800/90 bg-slate-950/60 p-3">
          <span className="text-[10.5px] font-mono text-slate-400 uppercase tracking-wider block">Incidents</span>
          <span className="font-mono text-xl font-bold text-white mt-1 block">{kpis.totalIncidents}</span>
          <span className="text-[10px] text-slate-500">Recorded this session</span>
        </div>

        <div className="rounded-lg border border-slate-800/90 bg-slate-950/60 p-3">
          <span className="text-[10.5px] font-mono text-slate-400 uppercase tracking-wider block">Resolved</span>
          <span className="font-mono text-xl font-bold text-emerald-400 mt-1 block">{kpis.resolvedCount}</span>
          <span className="text-[10px] text-slate-500">Verified SLA restored</span>
        </div>

        <div className="rounded-lg border border-slate-800/90 bg-slate-950/60 p-3">
          <span className="text-[10.5px] font-mono text-slate-400 uppercase tracking-wider block">Mean MTTD</span>
          <span className="font-mono text-xl font-bold text-cyan-400 mt-1 block">
            {kpis.mttdSeconds ? `${kpis.mttdSeconds}s` : "—"}
          </span>
          <span className="text-[10px] text-slate-500">Onset to detection</span>
        </div>

        <div className="rounded-lg border border-slate-800/90 bg-slate-950/60 p-3">
          <span className="text-[10.5px] font-mono text-slate-400 uppercase tracking-wider block">Mean MTTR</span>
          <span className="font-mono text-xl font-bold text-indigo-400 mt-1 block">
            {kpis.mttrSeconds ? `${kpis.mttrSeconds}s` : "—"}
          </span>
          <span className="text-[10px] text-slate-500">Detection to verified</span>
        </div>

        <div className="rounded-lg border border-slate-800/90 bg-slate-950/60 p-3 col-span-2 sm:col-span-1">
          <span className="text-[10.5px] font-mono text-slate-400 uppercase tracking-wider block">First-Action Success</span>
          <span className="font-mono text-xl font-bold text-emerald-400 mt-1 block">
            {kpis.successRate ? `${kpis.successRate}%` : "—"}
          </span>
          <span className="text-[10px] text-slate-500">Accurate runbook rate</span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-950/80 text-[11px] font-mono text-slate-400 uppercase tracking-wider border-b border-slate-800">
            <tr>
              <th className="px-3.5 py-2.5">Time</th>
              <th className="px-3.5 py-2.5">ID</th>
              <th className="px-3.5 py-2.5">Service</th>
              <th className="px-3.5 py-2.5">Diagnosis</th>
              <th className="px-3.5 py-2.5">Action Executed</th>
              <th className="px-3.5 py-2.5">MTTD</th>
              <th className="px-3.5 py-2.5">MTTR</th>
              <th className="px-3.5 py-2.5">Status</th>
              <th className="px-3.5 py-2.5 text-right">Post-Mortem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80 font-sans">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500 font-mono">
                  No incidents recorded matching query. Use the Chaos Lab to inject a failure scenario.
                </td>
              </tr>
            ) : (
              filtered.map((inc) => {
                const isResolved = inc.state === "resolved";
                const isEscalated = inc.state === "escalated";
                const mttd = (inc.detectTick - inc.startTick) * 5;
                const mttr = inc.resolvedTick ? (inc.resolvedTick - inc.detectTick) * 5 : null;

                return (
                  <tr key={inc.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-3.5 py-3 font-mono text-slate-400 text-[11.5px]">
                      {formatClock(inc.detectTick)}
                    </td>
                    <td className="px-3.5 py-3 font-mono font-semibold text-cyan-300">{inc.id}</td>
                    <td className="px-3.5 py-3 font-medium text-slate-200">{inc.svcName}</td>
                    <td className="px-3.5 py-3 text-slate-300 max-w-xs truncate" title={inc.ranked?.[0]?.cause?.label}>
                      {inc.ranked?.[0]?.cause?.label || "Correlating signature..."}
                    </td>
                    <td className="px-3.5 py-3 font-mono text-slate-400 text-[11px]">
                      {inc.chosen || inc.action ? inc.chosen || inc.action : "—"}
                    </td>
                    <td className="px-3.5 py-3 font-mono text-slate-300">{mttd}s</td>
                    <td className="px-3.5 py-3 font-mono text-slate-300">{mttr !== null ? `${mttr}s` : "In flight"}</td>
                    <td className="px-3.5 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-mono font-medium ${
                          isResolved
                            ? "bg-emerald-950/60 border border-emerald-600/40 text-emerald-300"
                            : isEscalated
                            ? "bg-rose-950/60 border border-rose-600/40 text-rose-300"
                            : "bg-amber-950/60 border border-amber-600/40 text-amber-300"
                        }`}
                      >
                        {isResolved ? "Resolved" : isEscalated ? "Escalated" : "In Progress"}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 text-right">
                      <button
                        onClick={() => onOpenPostMortem(inc.id)}
                        className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition"
                        title="Generate or view incident post-mortem"
                      >
                        <FileText className="h-3 w-3 text-cyan-400" />
                        <span>Report</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
