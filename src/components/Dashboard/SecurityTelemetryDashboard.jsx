import React, { useState, useEffect, useCallback } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  Shield,
  RefreshCw,
  CheckCircle2,
  XCircle,
  GitCommit,
  AlertTriangle,
  Activity,
} from "lucide-react";
import GlassCard from "../GlassCard";

const COLORS = ["#ef4444", "#f59e0b", "#8b5cf6", "#3b82f6", "#10b981", "#ec4899"];

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

export default function SecurityTelemetryDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTelemetry = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/security/telemetry`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTelemetry();
    const id = setInterval(fetchTelemetry, 15000);
    return () => clearInterval(id);
  }, [fetchTelemetry]);

  const passRate = data?.audit?.passRate;
  const trendData = (data?.audit?.recentRuns || [])
    .slice()
    .reverse()
    .map((r, i) => ({
      i: i + 1,
      pass: r.pass ? 1 : 0,
      ts: new Date(r.ts).toLocaleTimeString(),
    }));

  const motifData = data?.charts?.topMotifs?.length
    ? data.charts.topMotifs
    : [{ name: "Aucun", value: 1 }];

  return (
    <div className="p-6 h-full overflow-y-auto space-y-6 bg-slate-950/90">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Shield className="w-6 h-6 text-red-400" />
            Télémétrie Sécurité
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Incidents Mémoire des Erreurs · historique audits · motifs
          </p>
        </div>
        <button
          type="button"
          onClick={fetchTelemetry}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </button>
      </div>

      {error && (
        <div className="text-red-400 text-sm flex items-center gap-2">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GlassCard className="p-4 border-l-4 border-l-red-500">
          <p className="text-slate-400 text-xs uppercase">Incidents sécurité</p>
          <p className="text-3xl font-bold text-white">
            {data?.memoire?.securityIncidents ?? "—"}
          </p>
        </GlassCard>
        <GlassCard className="p-4 border-l-4 border-l-amber-500">
          <p className="text-slate-400 text-xs uppercase">Incidents totaux</p>
          <p className="text-3xl font-bold text-white">
            {data?.memoire?.totalIncidents ?? "—"}
          </p>
        </GlassCard>
        <GlassCard className="p-4 border-l-4 border-l-emerald-500">
          <p className="text-slate-400 text-xs uppercase">Taux réussite audits</p>
          <p className="text-3xl font-bold text-white">
            {passRate != null ? `${passRate}%` : "—"}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">
            {data?.audit?.totalRuns ?? 0} exécutions enregistrées
          </p>
        </GlassCard>
        <GlassCard className="p-4 border-l-4 border-l-blue-500">
          <p className="text-slate-400 text-xs uppercase">Dernier commit audité</p>
          <p className="text-lg font-mono font-bold text-white flex items-center gap-1">
            <GitCommit size={14} />
            {data?.audit?.lastPass?.git?.sha ||
              data?.audit?.lastFail?.git?.sha ||
              "—"}
          </p>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard className="p-4">
          <h3 className="text-sm font-bold text-slate-300 uppercase mb-4 flex items-center gap-2">
            <Activity size={14} /> Tendance audits (récent)
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="ts" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <YAxis domain={[0, 1]} ticks={[0, 1]} tick={{ fill: "#94a3b8" }} />
                <Tooltip />
                <Line
                  type="stepAfter"
                  dataKey="pass"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <h3 className="text-sm font-bold text-slate-300 uppercase mb-4">
            Motifs (Mémoire des Erreurs)
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={motifData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {motifData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-4">
        <h3 className="text-sm font-bold text-slate-300 uppercase mb-3">
          Derniers runs audit (security:feedback)
        </h3>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {(data?.audit?.recentRuns || []).length === 0 && (
            <p className="text-slate-500 text-sm">
              Aucun historique — lancez{" "}
              <code className="text-red-300">npm run security:feedback</code>
            </p>
          )}
          {(data?.audit?.recentRuns || []).map((run) => (
            <div
              key={run.ts}
              className="flex items-center justify-between text-xs border border-white/5 rounded-lg px-3 py-2"
            >
              <span className="flex items-center gap-2 text-slate-300">
                {run.pass ? (
                  <CheckCircle2 size={14} className="text-emerald-400" />
                ) : (
                  <XCircle size={14} className="text-red-400" />
                )}
                {run.git?.sha || "?"} · {run.git?.branch || "?"}
              </span>
              <span className="text-slate-500">
                {new Date(run.ts).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="p-4">
        <h3 className="text-sm font-bold text-slate-300 uppercase mb-3">
          Incidents récents (vault)
        </h3>
        <ul className="space-y-2 text-sm text-slate-400 max-h-48 overflow-y-auto">
          {(data?.memoire?.recentIncidents || []).map((inc, idx) => (
            <li
              key={idx}
              className={`border-l-2 pl-3 ${
                inc.isSecurity ? "border-red-500" : "border-slate-600"
              }`}
            >
              <span className="text-slate-200">{inc.title}</span>
              {inc.commit && (
                <span className="ml-2 font-mono text-[10px] text-slate-500">
                  {inc.commit}
                </span>
              )}
            </li>
          ))}
        </ul>
      </GlassCard>
    </div>
  );
}
