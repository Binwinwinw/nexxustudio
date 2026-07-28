import React, { useState } from "react";
import { Shield, Sliders } from "lucide-react";
import SecurityTelemetryDashboard from "./Dashboard/SecurityTelemetryDashboard";
import SecurityHooks from "./SecurityHooks";

export default function SecurityPanel() {
  const [tab, setTab] = useState("telemetry");

  return (
    <div className="h-full flex flex-col bg-slate-950">
      <div className="flex gap-1 p-2 border-b border-white/10 bg-black/40">
        <button
          type="button"
          onClick={() => setTab("telemetry")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest ${
            tab === "telemetry"
              ? "bg-red-600/80 text-white"
              : "text-slate-400 hover:bg-white/5"
          }`}
        >
          <Shield size={12} />
          Télémétrie
        </button>
        <button
          type="button"
          onClick={() => setTab("hooks")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest ${
            tab === "hooks"
              ? "bg-red-600/80 text-white"
              : "text-slate-400 hover:bg-white/5"
          }`}
        >
          <Sliders size={12} />
          Hooks
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        {tab === "telemetry" ? (
          <SecurityTelemetryDashboard />
        ) : (
          <SecurityHooks />
        )}
      </div>
    </div>
  );
}
