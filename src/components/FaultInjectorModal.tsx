import React, { useState } from "react";
import { X, Flame, Sliders, Zap, AlertTriangle, ShieldCheck, Sparkles } from "lucide-react";
import { ServiceState } from "../types";

interface FaultInjectorModalProps {
  isOpen: boolean;
  fleet: ServiceState[];
  onClose: () => void;
  onInject: (faultId: string, serviceId?: string, customMult?: any) => void;
}

const FAULT_CARDS = [
  {
    id: "surge",
    service: "api-gateway",
    label: "Inbound Traffic Spike",
    description: "Multiplies ingress requests by 3.3× and network egress by 2.9× to trigger horizontal pod scaling.",
    badge: "API Gateway",
    color: "from-blue-600/20 to-cyan-600/20 border-cyan-500/40",
  },
  {
    id: "leak",
    service: "auth-service",
    label: "Heap Memory Leak",
    description: "Simulates memory retention without request growth to test memory anomaly slope detection.",
    badge: "Auth Service",
    color: "from-amber-600/20 to-orange-600/20 border-amber-500/40",
  },
  {
    id: "pool",
    service: "api-gateway",
    label: "Connection Pool Exhaustion",
    description: "Postgres connection pool maxes out; queries queue and error rates surge to 12%.",
    badge: "DB Pool",
    color: "from-rose-600/20 to-red-600/20 border-rose-500/40",
  },
  {
    id: "upstream",
    service: "auth-service",
    label: "Upstream IdP Failure",
    description: "External authentication provider times out, sending error rates to 28% without server load.",
    badge: "Third-Party Outage",
    color: "from-purple-600/20 to-indigo-600/20 border-purple-500/40",
  },
  {
    id: "diskio",
    service: "postgres-primary",
    label: "Storage I/O Contention",
    description: "Heavy write operations bottleneck disk writes, spiking query latency to 6.5× normal.",
    badge: "Postgres Primary",
    color: "from-yellow-600/20 to-amber-600/20 border-yellow-500/40",
  },
  {
    id: "cpu",
    service: "postgres-primary",
    label: "Noisy Neighbor Saturation",
    description: "Co-located process consumes compute quota, saturating CPU without matching query volume.",
    badge: "Hypervisor Node",
    color: "from-emerald-600/20 to-teal-600/20 border-emerald-500/40",
  },
  {
    id: "netsat",
    service: "web-frontend",
    label: "Edge Network Saturation",
    description: "Outbound egress bandwidth hits 3.5× baseline, triggering origin shield cache runbooks.",
    badge: "CDN Edge",
    color: "from-cyan-600/20 to-blue-600/20 border-blue-500/40",
  },
  {
    id: "cache_hot",
    service: "redis-cluster",
    label: "Cache Thundering Herd",
    description: "High-traffic keys expire simultaneously, causing cache misses and latency spikes.",
    badge: "Redis Cluster",
    color: "from-pink-600/20 to-rose-600/20 border-pink-500/40",
  },
];

export function FaultInjectorModal({ isOpen, fleet, onClose, onInject }: FaultInjectorModalProps) {
  const [tab, setTab] = useState<"presets" | "custom">("presets");

  // Custom Chaos State
  const [customSvc, setCustomSvc] = useState(fleet[0]?.id || "api");
  const [rtMult, setRtMult] = useState(3.5);
  const [cpuMult, setCpuMult] = useState(2.0);
  const [errMult, setErrMult] = useState(5.0);
  const [reqMult, setReqMult] = useState(2.0);

  if (!isOpen) return null;

  const handleCustomInject = () => {
    onInject("custom", customSvc, {
      rt: rtMult,
      cpu: cpuMult,
      err: errMult,
      req: reqMult,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl rounded-xl border border-slate-800 bg-slate-950 p-5 sm:p-6 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-950/80 border border-rose-700/60">
              <Flame className="h-4 w-4 text-rose-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">Chaos Engineering & Fault Injection</h3>
              <p className="text-xs text-slate-400">
                Simulate production anomalies to test OpsGuard's detection and autonomous response loop.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab selector */}
        <div className="flex items-center gap-2 pt-3 pb-2">
          <button
            onClick={() => setTab("presets")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              tab === "presets"
                ? "bg-cyan-500 text-slate-950 shadow-sm"
                : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            <span>Preset Chaos Scenarios</span>
          </button>

          <button
            onClick={() => setTab("custom")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              tab === "custom"
                ? "bg-cyan-500 text-slate-950 shadow-sm"
                : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>Custom Anomaly Synthesizer</span>
          </button>
        </div>

        {/* Modal content */}
        <div className="flex-1 overflow-y-auto py-3 pr-1 space-y-3">
          {tab === "presets" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {FAULT_CARDS.map((card) => (
                <button
                  key={card.id}
                  onClick={() => {
                    onInject(card.id);
                    onClose();
                  }}
                  className={`text-left rounded-lg border p-3 bg-gradient-to-br ${card.color} hover:brightness-110 hover:border-slate-500 transition group`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-white group-hover:text-cyan-300">
                      {card.label}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900/80 border border-slate-800 text-slate-300">
                      {card.badge}
                    </span>
                  </div>
                  <p className="text-[11.5px] text-slate-300 mt-1.5 leading-relaxed">{card.description}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-900/50 p-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Target Microservice</label>
                <select
                  value={customSvc}
                  onChange={(e) => setCustomSvc(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-white focus:ring-1 focus:ring-cyan-500"
                >
                  {fleet.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.kind})
                    </option>
                  ))}
                </select>
              </div>

              {/* Sliders */}
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Latency Multiplier:</span>
                    <span className="font-mono text-cyan-400 font-bold">{rtMult}×</span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="8.0"
                    step="0.5"
                    value={rtMult}
                    onChange={(e) => setRtMult(parseFloat(e.target.value))}
                    className="w-full accent-cyan-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">CPU Saturation Multiplier:</span>
                    <span className="font-mono text-cyan-400 font-bold">{cpuMult}×</span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="3.0"
                    step="0.2"
                    value={cpuMult}
                    onChange={(e) => setCpuMult(parseFloat(e.target.value))}
                    className="w-full accent-cyan-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Error Rate Multiplier:</span>
                    <span className="font-mono text-cyan-400 font-bold">{errMult}×</span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="30.0"
                    step="1.0"
                    value={errMult}
                    onChange={(e) => setErrMult(parseFloat(e.target.value))}
                    className="w-full accent-cyan-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Request Ingress Traffic:</span>
                    <span className="font-mono text-cyan-400 font-bold">{reqMult}×</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="4.0"
                    step="0.5"
                    value={reqMult}
                    onChange={(e) => setReqMult(parseFloat(e.target.value))}
                    className="w-full accent-cyan-500"
                  />
                </div>
              </div>

              <button
                onClick={handleCustomInject}
                className="w-full rounded-lg bg-rose-600 py-2 text-xs font-semibold text-white hover:bg-rose-500 shadow-sm transition mt-2"
              >
                Synthesize & Inject Chaos Anomaly
              </button>
            </div>
          )}
        </div>

        {/* Footer info note */}
        <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <span>The detector operates with zero advance knowledge of injected faults.</span>
          <button
            onClick={() => {
              const free = FAULT_CARDS.filter((f) => {
                const s = fleet.find((x) => x.name === f.service);
                return s && !s.fault && !s.incident;
              });
              if (free.length) {
                const pick = free[Math.floor(Math.random() * free.length)];
                onInject(pick.id);
                onClose();
              }
            }}
            className="text-cyan-400 hover:text-cyan-300 font-semibold"
          >
            Surprise Me (Random) →
          </button>
        </div>
      </div>
    </div>
  );
}
