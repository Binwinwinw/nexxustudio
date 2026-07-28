import React, { useState, useEffect, useCallback } from "react";
import {
  Activity,
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  Zap,
} from "lucide-react";
import GlassCard from "./GlassCard";
import CitadelleModuleShell from "./layout/CitadelleModuleShell";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
const SESSION_STORAGE_KEY = "nexxus_current_session_id";

function getSpeedTone(ttft) {
  if (ttft == null || ttft === 0) return "text-emerald-400";
  if (ttft < 2000) return "text-emerald-400";
  if (ttft < 16000) return "text-amber-400";
  return "text-red-400";
}

function DataTable({ columns, rows, emptyLabel = "Aucune donnée" }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-white/10 text-slate-500 uppercase tracking-widest text-[9px]">
            {columns.map((col) => (
              <th key={col.key} className="py-3 pr-4 font-black">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="py-8 text-center text-slate-500 italic"
              >
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-white/5 hover:bg-white/5 transition-colors"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`py-3 pr-4 ${col.className || "text-slate-300"}`}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function TelemetryDashboard({ onClose, sessionId: sessionIdProp }) {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const resolveSessionId = useCallback(() => {
    if (sessionIdProp) return sessionIdProp;
    try {
      return localStorage.getItem(SESSION_STORAGE_KEY) || "";
    } catch {
      return "";
    }
  }, [sessionIdProp]);

  const fetchTelemetry = useCallback(async () => {
    const sessionId = resolveSessionId();
    if (!sessionId) {
      setError("Aucune session active — ouvrez ou créez une conversation.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const url = new URL(`${API_BASE}/api/telemetry/cockpit`);
      url.searchParams.set("sessionId", sessionId);
      const response = await fetch(url.toString(), {
        credentials: "include",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${response.status}`);
      }
      const data = await response.json();
      setStats(data.pipeline_metrics);
      setRecent(data.recent_requests || []);
    } catch (err) {
      console.error("Erreur fetching telemetry:", err);
      setError(err.message || "Impossible de charger la télémétrie");
    } finally {
      setLoading(false);
    }
  }, [resolveSessionId]);

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 5000);
    return () => clearInterval(interval);
  }, [fetchTelemetry]);

  const modeRows = Object.entries(stats?.modes || {}).map(([mode, data]) => ({
    id: mode,
    mode,
    pct: data.pct,
    avgTTFT: data.avgTTFT,
    avgTokens: data.avgTokens,
    failRate: data.failRate,
  }));

  const recentRows = (recent || []).slice(0, 10).map((req) => ({
    id: req.id,
    time: new Date(req.timestamp).toLocaleTimeString(),
    mode: req.mode,
    ttft: req.ttft,
    tokens: req.tokens,
    success: req.success,
  }));

  return (
    <CitadelleModuleShell
      icon={Activity}
      title="Télémétrie Pipeline"
      subtitle="Pipeline épistémique · modes · latence TTFT · requêtes récentes"
      onRefresh={fetchTelemetry}
      loading={loading}
      error={error}
      actions={
        onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-white/10 text-slate-400 hover:text-white text-[10px] font-bold uppercase tracking-wider"
          >
            Fermer
          </button>
        ) : null
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <GlassCard className="p-4 !rounded-2xl border-l-4 border-l-blue-500">
          <p className="text-slate-400 text-[9px] uppercase tracking-widest font-black flex items-center gap-1">
            <BarChart3 size={12} /> Requêtes totales
          </p>
          <p className="text-3xl font-black text-white mt-2">
            {loading && !stats ? "—" : (stats?.totalRequests ?? 0)}
          </p>
        </GlassCard>
        <GlassCard className="p-4 !rounded-2xl border-l-4 border-l-emerald-500">
          <p className="text-slate-400 text-[9px] uppercase tracking-widest font-black flex items-center gap-1">
            <Clock size={12} /> Dernières 24h
          </p>
          <p className="text-3xl font-black text-white mt-2">
            {loading && !stats ? "—" : (stats?.last24h ?? 0)}
          </p>
        </GlassCard>
        <GlassCard className="p-4 !rounded-2xl border-l-4 border-l-violet-500">
          <p className="text-slate-400 text-[9px] uppercase tracking-widest font-black flex items-center gap-1">
            <Zap size={12} /> Modes actifs
          </p>
          <p className="text-3xl font-black text-white mt-2">
            {loading && !stats ? "—" : modeRows.length}
          </p>
        </GlassCard>
      </div>

      <GlassCard className="p-4 !rounded-2xl">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Activity size={14} className="text-blue-400" />
          Répartition par mode
        </h3>
        <DataTable
          columns={[
            {
              key: "mode",
              label: "Mode",
              render: (row) => (
                <span className="font-bold text-slate-100">{row.mode}</span>
              ),
            },
            { key: "pct", label: "% Requêtes", render: (r) => `${r.pct}%` },
            {
              key: "avgTTFT",
              label: "TTFT moyen",
              className: "",
              render: (r) => (
                <span className={getSpeedTone(r.avgTTFT)}>{r.avgTTFT}ms</span>
              ),
            },
            { key: "avgTokens", label: "Tokens moyen" },
            {
              key: "failRate",
              label: "Taux d'échec",
              render: (r) => (
                <span className={r.failRate > 0 ? "text-red-400" : "text-emerald-400"}>
                  {r.failRate}%
                </span>
              ),
            },
          ]}
          rows={modeRows}
          emptyLabel="Aucun mode enregistré pour l'instant"
        />
      </GlassCard>

      <GlassCard className="p-4 !rounded-2xl">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Clock size={14} className="text-blue-400" />
          10 dernières requêtes
        </h3>
        <DataTable
          columns={[
            { key: "time", label: "Heure" },
            {
              key: "mode",
              label: "Mode",
              render: (r) => (
                <span className="font-mono text-[11px] text-slate-200">{r.mode}</span>
              ),
            },
            {
              key: "ttft",
              label: "TTFT",
              render: (r) => (
                <span className={getSpeedTone(r.ttft)}>{r.ttft}ms</span>
              ),
            },
            { key: "tokens", label: "Tokens" },
            {
              key: "success",
              label: "Statut",
              render: (r) =>
                r.success ? (
                  <CheckCircle2 size={16} className="text-emerald-400" />
                ) : (
                  <XCircle size={16} className="text-red-400" />
                ),
            },
          ]}
          rows={recentRows}
          emptyLabel="Aucune requête récente"
        />
      </GlassCard>
    </CitadelleModuleShell>
  );
}
