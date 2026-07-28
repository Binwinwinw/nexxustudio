import React from "react";
import { CITADELLE_VIEWS } from "../../context/citadelleViews.js";
import ChatBento from "../ChatBento";
import TelemetryDashboard from "../TelemetryDashboard";
import SecurityTelemetryDashboard from "../Dashboard/SecurityTelemetryDashboard";
import SecurityHooks from "../SecurityHooks";
import GlassCard from "../GlassCard";
import ImpactAuditCard from "../ImpactAuditCard";
import SessionsHistoryView from "../../views/SessionsHistoryView.jsx";

const Cockpit = React.lazy(() => import("../Cockpit"));
const GovernanceDashboard = React.lazy(
  () => import("../Dashboard/GovernanceDashboard"),
);
const IntentTriageDashboard = React.lazy(
  () => import("../Dashboard/IntentTriageDashboard"),
);
const ArtifactMonitor = React.lazy(() => import("../ArtifactMonitor"));
const AsyncForgePanel = React.lazy(() => import("../AsyncForgePanel"));

/**
 * Route le contenu central selon la vue active de la sidebar.
 */
export default function MainViewRouter({
  activeView,
  chatProps,
  impactAuditProps,
  sessionsProps,
  sessionId,
}) {
  const suspenseFallback = (
    <div className="h-full min-h-[400px] flex items-center justify-center text-[10px] text-slate-500 font-mono animate-pulse uppercase tracking-widest">
      Chargement du module...
    </div>
  );

  switch (activeView) {
    case CITADELLE_VIEWS.COCKPIT:
      return (
        <React.Suspense fallback={suspenseFallback}>
          <div className="h-full min-h-[560px]">
            <Cockpit sessionId={sessionId} />
          </div>
        </React.Suspense>
      );

    case CITADELLE_VIEWS.GOVERNANCE:
      return (
        <React.Suspense fallback={suspenseFallback}>
          <div className="h-full min-h-[560px] bg-slate-900 rounded-2xl border border-white/10 overflow-hidden">
            <GovernanceDashboard />
          </div>
        </React.Suspense>
      );

    case CITADELLE_VIEWS.INTENT_TRIAGE:
      return (
        <React.Suspense fallback={suspenseFallback}>
          <div className="h-full min-h-[560px] bg-slate-900 rounded-2xl border border-white/10 overflow-hidden">
            <IntentTriageDashboard />
          </div>
        </React.Suspense>
      );

    case CITADELLE_VIEWS.TELEMETRY:
      return (
        <div className="h-full min-h-[560px] rounded-2xl border border-white/10 overflow-hidden">
          <TelemetryDashboard sessionId={sessionId} />
        </div>
      );

    case CITADELLE_VIEWS.SECURITY_TELEMETRY:
      return (
        <div className="h-full min-h-[560px] rounded-2xl border border-white/10 overflow-hidden">
          <SecurityTelemetryDashboard />
        </div>
      );

    case CITADELLE_VIEWS.SECURITY_HOOKS:
      return (
        <div className="h-full min-h-[560px] rounded-2xl border border-white/10 overflow-hidden">
          <SecurityHooks />
        </div>
      );

    case CITADELLE_VIEWS.IMPACT_AUDIT:
      return (
        <div className="flex flex-col gap-6 h-full min-h-[560px] overflow-y-auto">
          <ImpactAuditPanel {...impactAuditProps} />
        </div>
      );

    case CITADELLE_VIEWS.PROJECT:
      return (
        <React.Suspense fallback={suspenseFallback}>
          <div className="h-full min-h-[560px]">
            <ArtifactMonitor sessionId={sessionId} />
          </div>
        </React.Suspense>
      );

    case CITADELLE_VIEWS.FORGE_ASYNC:
      return (
        <React.Suspense fallback={suspenseFallback}>
          <div className="h-full min-h-[560px] rounded-2xl border border-white/10 overflow-hidden">
            <AsyncForgePanel sessionId={sessionId} />
          </div>
        </React.Suspense>
      );

    case CITADELLE_VIEWS.DOCS:
      return <ChatBento {...chatProps} />;

    case CITADELLE_VIEWS.SESSIONS:
      return (
        <div className="h-full min-h-0 flex flex-col overflow-hidden">
          <SessionsHistoryView {...sessionsProps} />
        </div>
      );

    case CITADELLE_VIEWS.CHAT:
    default:
      return <ChatBento {...chatProps} />;
  }
}

function ImpactAuditPanel({
  auditMode,
  setAuditMode,
  auditTarget,
  setAuditTarget,
  isAuditing,
  runImpactAudit,
  impactReport,
  handleSendMessage,
}) {
  return (
    <>
      <GlassCard className="border-amber-500/20 bg-amber-500/5">
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-black text-amber-400 uppercase tracking-widest">
            Audit d&apos;impact
          </h2>
          <div className="flex gap-2 p-1 bg-black/40 rounded-xl border border-white/5">
            {[
              { id: "file", label: "Fichier" },
              { id: "module", label: "Module" },
              { id: "change", label: "Changement" },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setAuditMode(m.id)}
                className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase ${
                  auditMode === m.id
                    ? "bg-amber-600 text-white"
                    : "text-slate-500"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={auditTarget}
              onChange={(e) => setAuditTarget(e.target.value)}
              placeholder="Cible d'audit..."
              className="flex-1 bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-xs text-white"
            />
            <button
              type="button"
              onClick={() => runImpactAudit(auditTarget)}
              disabled={isAuditing || !auditTarget}
              className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-[10px] font-bold px-6 py-2 rounded-lg"
            >
              {isAuditing ? "ANALYSE..." : "AUDITER"}
            </button>
          </div>
        </div>
      </GlassCard>
      {impactReport && <ImpactAuditCard report={impactReport} />}
    </>
  );
}
