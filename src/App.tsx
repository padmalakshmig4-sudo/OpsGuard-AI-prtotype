import React, { useState, useEffect, useCallback } from "react";
import { FleetApiResponse, ServiceState } from "./types";
import { Topbar } from "./components/Topbar";
import { FleetGrid } from "./components/FleetGrid";
import { TelemetryInspector } from "./components/TelemetryInspector";
import { IncidentWorkspace } from "./components/IncidentWorkspace";
import { IncidentHistoryTable } from "./components/IncidentHistoryTable";
import { FaultInjectorModal } from "./components/FaultInjectorModal";
import { AiCopilotDrawer } from "./components/AiCopilotDrawer";
import { PostMortemModal } from "./components/PostMortemModal";
import { Flame, Shield, Activity, RefreshCw } from "lucide-react";

export default function App() {
  const [data, setData] = useState<FleetApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("api");

  // Modals & Drawers
  const [isChaosOpen, setIsChaosOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isAiDiagnosing, setIsAiDiagnosing] = useState(false);

  const [postMortemState, setPostMortemState] = useState<{
    isOpen: boolean;
    incidentId: string | null;
    markdown: string | null;
    isLoading: boolean;
  }>({
    isOpen: false,
    incidentId: null,
    markdown: null,
    isLoading: false,
  });

  // Fetch cluster telemetry state
  const fetchFleet = useCallback(async () => {
    try {
      const res = await fetch("/api/fleet");
      if (!res.ok) return;
      const json: FleetApiResponse = await res.json();
      setData(json);
      if (json.selectedSvc) {
        setSelectedId((prev) => (prev ? prev : json.selectedSvc));
      }
      setLoading(false);
    } catch (err) {
      console.error("Telemetry fetch error:", err);
    }
  }, []);

  useEffect(() => {
    fetchFleet();
    const interval = setInterval(fetchFleet, 1000);
    return () => clearInterval(interval);
  }, [fetchFleet]);

  // Controls Handlers
  const handleToggleRunning = async () => {
    if (!data) return;
    try {
      await fetch("/api/fleet/controls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ running: !data.running }),
      });
      fetchFleet();
    } catch (e) {
      console.error(e);
    }
  };

  const handleChangeSpeed = async () => {
    if (!data) return;
    const nextSpeed = data.speed === 1 ? 2 : data.speed === 2 ? 4 : 1;
    try {
      await fetch("/api/fleet/controls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speed: nextSpeed }),
      });
      fetchFleet();
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleAutoApprove = async (val: boolean) => {
    try {
      await fetch("/api/fleet/controls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoApprove: val }),
      });
      fetchFleet();
    } catch (e) {
      console.error(e);
    }
  };

  const handleManualTick = async () => {
    try {
      await fetch("/api/fleet/tick", { method: "POST" });
      fetchFleet();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectService = async (id: string) => {
    setSelectedId(id);
    try {
      await fetch("/api/fleet/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId: id }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleInjectFault = async (faultId: string, serviceId?: string, customMult?: any) => {
    try {
      await fetch("/api/faults/inject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ faultId, serviceId, customMult }),
      });
      fetchFleet();
    } catch (e) {
      console.error(e);
    }
  };

  const handleApproveRunbook = async (actionId: string) => {
    if (!data?.activeIncident) return;
    try {
      await fetch(`/api/incidents/${data.activeIncident.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId }),
      });
      fetchFleet();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRejectRunbook = async () => {
    if (!data?.activeIncident) return;
    try {
      await fetch(`/api/incidents/${data.activeIncident.id}/reject`, { method: "POST" });
      fetchFleet();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRediagnose = async () => {
    if (!data?.activeIncident) return;
    try {
      await fetch(`/api/incidents/${data.activeIncident.id}/rediagnose`, { method: "POST" });
      fetchFleet();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRequestAiReport = async (incidentId: string) => {
    setIsAiDiagnosing(true);
    try {
      await fetch("/api/ai/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incidentId }),
      });
      fetchFleet();
    } catch (e) {
      console.error(e);
    } finally {
      setIsAiDiagnosing(false);
    }
  };

  const handleOpenPostMortem = async (incidentId: string) => {
    setPostMortemState({
      isOpen: true,
      incidentId,
      markdown: null,
      isLoading: true,
    });

    try {
      const res = await fetch("/api/ai/postmortem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incidentId }),
      });
      const json = await res.json();
      setPostMortemState((prev) => ({
        ...prev,
        markdown: json.markdown || "No report generated.",
        isLoading: false,
      }));
    } catch (e) {
      setPostMortemState((prev) => ({
        ...prev,
        markdown: "Failed to generate post-mortem report.",
        isLoading: false,
      }));
    }
  };

  if (loading || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-950 border border-cyan-700/60 shadow-lg shadow-cyan-900/30">
            <RefreshCw className="h-6 w-6 text-cyan-400 animate-spin" />
          </div>
          <p className="font-mono text-xs text-slate-400">Booting OpsGuard AI cluster surveillance...</p>
        </div>
      </div>
    );
  }

  const selectedService: ServiceState =
    data.fleet.find((s) => s.id === selectedId) || data.fleet[0];

  const activeIncidentsCount = data.fleet.filter((s) => s.incident).length;
  const elevatedCount = data.fleet.filter((s) => !s.incident && s.score > 2.4).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
      {/* Topbar Command Navigation */}
      <Topbar
        tick={data.tick}
        running={data.running}
        speed={data.speed}
        autoApprove={data.autoApprove}
        activeIncidentsCount={activeIncidentsCount}
        elevatedCount={elevatedCount}
        onToggleRunning={handleToggleRunning}
        onChangeSpeed={handleChangeSpeed}
        onToggleAutoApprove={handleToggleAutoApprove}
        onOpenCopilot={() => setIsCopilotOpen(true)}
        onOpenChaos={() => setIsChaosOpen(true)}
        onManualTick={handleManualTick}
      />

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* Fleet Microservices Grid */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider">
                Fleet Surveillance ({data.fleet.length} Microservices)
              </h2>
            </div>
            <span className="text-xs text-slate-400 hidden sm:inline">
              Click any service card to focus telemetry inspection
            </span>
          </div>

          <FleetGrid
            fleet={data.fleet}
            selectedId={selectedId}
            onSelect={handleSelectService}
            onInjectFast={(fId) => handleInjectFault(fId)}
          />
        </section>

        {/* Core Operations Split: Telemetry (Left) & Incident Workspace (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Live Telemetry & History */}
          <div className="lg:col-span-7 space-y-5">
            {/* Real-time Telemetry Inspector */}
            <TelemetryInspector service={selectedService} />

            {/* Historical Incident Ledger & MTTD/MTTR KPIs */}
            <IncidentHistoryTable
              incidents={data.history}
              kpis={data.kpis}
              onOpenPostMortem={handleOpenPostMortem}
            />
          </div>

          {/* Right Column: Autonomous Incident Workspace */}
          <div className="lg:col-span-5 space-y-5">
            <IncidentWorkspace
              incident={data.activeIncident}
              service={selectedService}
              onApprove={handleApproveRunbook}
              onReject={handleRejectRunbook}
              onRediagnose={handleRediagnose}
              onRequestAiReport={handleRequestAiReport}
              onOpenPostMortem={handleOpenPostMortem}
              isAiDiagnosing={isAiDiagnosing}
            />

            {/* Quick Chaos Injector Banner */}
            <div className="rounded-xl border border-rose-900/40 bg-gradient-to-r from-rose-950/30 to-slate-900/60 p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-950 border border-rose-800 text-rose-400 flex-shrink-0">
                  <Flame className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white">Production Chaos Simulator</h4>
                  <p className="text-[11.5px] text-slate-400">
                    Inject sudden surges, memory leaks, or connection starvation.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsChaosOpen(true)}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 shadow-sm transition flex-shrink-0"
              >
                Open Chaos Lab
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <span>OpsGuard AI · Autonomous Incident Response & Telemetry Surveillance Platform</span>
          <span className="font-mono text-slate-400">Powered by Gemini 3.8 Flash & Full-Stack SRE Engine</span>
        </div>
      </footer>

      {/* Chaos Engineering Modal */}
      <FaultInjectorModal
        isOpen={isChaosOpen}
        fleet={data.fleet}
        onClose={() => setIsChaosOpen(false)}
        onInject={handleInjectFault}
      />

      {/* Gemini AI Copilot Slide-over Drawer */}
      <AiCopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        activeIncident={data.activeIncident}
      />

      {/* Post-Mortem Markdown Modal */}
      <PostMortemModal
        isOpen={postMortemState.isOpen}
        incidentId={postMortemState.incidentId}
        markdown={postMortemState.markdown}
        isLoading={postMortemState.isLoading}
        onClose={() => setPostMortemState((prev) => ({ ...prev, isOpen: false }))}
        onRegenerate={() => {
          if (postMortemState.incidentId) {
            handleOpenPostMortem(postMortemState.incidentId);
          }
        }}
      />
    </div>
  );
}
