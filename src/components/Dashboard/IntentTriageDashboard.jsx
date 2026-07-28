import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  GitBranch,
  RefreshCw,
  Target,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import GlassCard from "../GlassCard";

const CONFIDENCE_COLORS = {
  high: "#10b981",
  medium: "#f59e0b",
  low: "#f43f5e",
};

const PRIORITY_STYLES = {
  high: "border-l-rose-500 bg-rose-500/5",
  medium: "border-l-amber-500 bg-amber-500/5",
  low: "border-l-slate-500 bg-slate-500/5",
  info: "border-l-cyan-500 bg-cyan-500/5",
};

export default function IntentTriageDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

  const fetchDashboard = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const qs = refresh ? "?refresh=1" : "";
      const res = await fetch(`${API_BASE}/api/intent-triage/dashboard${qs}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (err) {
      console.error("Intent triage dashboard", err);
      setError("Impossible de charger le dashboard de triage.");
    } finally {
      setLoading(false);
    }
  }, [API_BASE]);

  useEffect(() => {
    fetchDashboard(false);
  }, [fetchDashboard]);

  const confidenceChart = useMemo(() => {
    const dist = data?.confidence_distribution || {};
    return [
      { level: "high", label: "High", count: dist.high || 0 },
      { level: "medium", label: "Medium", count: dist.medium || 0 },
      { level: "low", label: "Low", count: dist.low || 0 },
    ];
  }, [data]);

  const summary = data?.summary || {};

  return (
    <div className="p-6 h-full overflow-y-auto space-y-6">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <GitBranch className="w-6 h-6 text-cyan-400" />
            Triage d&apos;intention
          </h1>
          <p className="text-slate-400 text-sm mt-1 max-w-2xl">
            {data?.question ||
              "Où enrichir les règles ensuite ?"} — lecture locale des clarifications et patterns ambigus.
          </p>
          {data?.report_date && (
            <p className="text-[10px] text-slate-500 font-mono mt-2 uppercase tracking-wider">
              Rapport {data.report_date}
              {data.source?.has_report ? " · fichier JSON" : " · calcul live"}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => fetchDashboard(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors border border-slate-700"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </button>
      </div>

      {error && (
        <GlassCard className="p-4 border-l-4 border-l-rose-500 text-rose-300 text-sm">
          {error}
        </GlassCard>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard label="Clarifications" value={summary.clarifications_total ?? 0} />
        <KpiCard
          label="Ambiguïté"
          value={`${summary.ambiguous_rate_pct ?? 0}%`}
          hint={`${summary.ambiguous_entries ?? 0} cas`}
        />
        <KpiCard label="Paires distinctes" value={summary.distinct_pairs ?? 0} />
        <KpiCard
          label="Tie-break LLM"
          value={summary.tiebreak_count ?? 0}
          icon={<Sparkles className="w-4 h-4 text-violet-400" />}
        />
        <KpiCard
          label="Résolus (replay)"
          value={summary.resolved_by_rules ?? 0}
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
        />
        <KpiCard
          label="Encore ambigus"
          value={summary.still_ambiguous ?? 0}
          icon={<AlertCircle className="w-4 h-4 text-amber-400" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard className="p-4 flex flex-col min-h-[280px]">
          <h3 className="text-lg font-medium text-slate-200 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-cyan-400" />
            Distribution confiance
          </h3>
          <div className="flex-1 min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={confidenceChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    borderColor: "#334155",
                    color: "#f8fafc",
                  }}
                />
                <Bar dataKey="count" name="Cas" radius={[4, 4, 0, 0]}>
                  {confidenceChart.map((entry) => (
                    <Cell
                      key={entry.level}
                      fill={CONFIDENCE_COLORS[entry.level] || "#64748b"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex flex-col">
          <h3 className="text-lg font-medium text-slate-200 mb-4">
            Recommandations
          </h3>
          <div className="space-y-3 flex-1 overflow-y-auto max-h-[280px]">
            {(data?.recommendations || []).map((reco, idx) => (
              <div
                key={`${reco.target}-${idx}`}
                className={`p-3 rounded-lg border-l-4 text-sm ${
                  PRIORITY_STYLES[reco.priority] || PRIORITY_STYLES.info
                }`}
              >
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-mono mb-1">
                  [{reco.priority}] {reco.target}
                </p>
                <p className="text-slate-200">{reco.hint}</p>
              </div>
            ))}
            {(!data?.recommendations || data.recommendations.length === 0) && (
              <p className="text-slate-500 italic text-sm">
                Aucune recommandation — collectez des clarifications terrain.
              </p>
            )}
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-4 overflow-hidden">
        <h3 className="text-lg font-medium text-slate-200 mb-4">
          Paires ambiguës récurrentes
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="p-3 text-slate-400 font-medium">Paire</th>
                <th className="p-3 text-slate-400 font-medium">Cas</th>
                <th className="p-3 text-slate-400 font-medium">Part</th>
                <th className="p-3 text-slate-400 font-medium">Signaux</th>
                <th className="p-3 text-slate-400 font-medium">Échantillon</th>
              </tr>
            </thead>
            <tbody>
              {(data?.ambiguous_pairs || []).map((pair) => (
                <tr
                  key={pair.pair}
                  className="border-b border-slate-800 hover:bg-slate-800/40"
                >
                  <td className="p-3 text-cyan-300 font-mono text-xs whitespace-nowrap">
                    {pair.pair}
                  </td>
                  <td className="p-3 text-slate-200">{pair.count}</td>
                  <td className="p-3 text-slate-300">{pair.share_pct}%</td>
                  <td className="p-3 text-slate-400 text-xs max-w-[200px] truncate">
                    {(pair.common_signals || []).map((s) => s.key).join(", ") || "—"}
                  </td>
                  <td
                    className="p-3 text-slate-500 text-xs italic max-w-md truncate"
                    title={pair.sample_queries?.[0]}
                  >
                    {pair.sample_queries?.[0] ? `« ${pair.sample_queries[0]} »` : "—"}
                  </td>
                </tr>
              ))}
              {(!data?.ambiguous_pairs || data.ambiguous_pairs.length === 0) && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500 italic">
                    Aucune paire ambiguë enregistrée pour l&apos;instant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard className="p-4">
          <h3 className="text-lg font-medium text-slate-200 mb-4">
            Signaux fréquents (ambigus)
          </h3>
          <ul className="space-y-2">
            {(data?.signal_frequency || []).slice(0, 8).map((item) => (
              <li
                key={item.signal}
                className="flex justify-between items-center text-sm border-b border-slate-800 pb-2"
              >
                <span className="text-slate-300 font-mono text-xs">{item.signal}</span>
                <span className="text-slate-400">{item.count}×</span>
              </li>
            ))}
            {(!data?.signal_frequency || data.signal_frequency.length === 0) && (
              <li className="text-slate-500 italic text-sm">—</li>
            )}
          </ul>
        </GlassCard>

        <GlassCard className="p-4 overflow-hidden">
          <h3 className="text-lg font-medium text-slate-200 mb-4">
            Dernières clarifications
          </h3>
          <div className="overflow-x-auto max-h-[240px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-900/90">
                <tr className="border-b border-slate-700">
                  <th className="p-2 text-slate-400">Date</th>
                  <th className="p-2 text-slate-400">Top</th>
                  <th className="p-2 text-slate-400">Conf.</th>
                  <th className="p-2 text-slate-400">Requête</th>
                </tr>
              </thead>
              <tbody>
                {(data?.recent_feedback || []).map((row, idx) => (
                  <tr key={idx} className="border-b border-slate-800">
                    <td className="p-2 text-slate-500 whitespace-nowrap">
                      {row.recorded_at
                        ? new Date(row.recorded_at).toLocaleDateString("fr-FR")
                        : "—"}
                    </td>
                    <td className="p-2 text-cyan-400 font-mono">{row.top_intent}</td>
                    <td className="p-2 text-slate-400">{row.confidence}</td>
                    <td
                      className="p-2 text-slate-500 italic truncate max-w-[200px]"
                      title={row.query}
                    >
                      {row.query || "—"}
                    </td>
                  </tr>
                ))}
                {(!data?.recent_feedback || data.recent_feedback.length === 0) && (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-slate-500 italic">
                      Aucune clarification journalisée.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function KpiCard({ label, value, hint, icon }) {
  return (
    <GlassCard className="p-4 border border-slate-800">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">
        {label}
      </p>
      <div className="flex items-center gap-2 mt-1">
        {icon}
        <h3 className="text-2xl font-bold text-slate-100">{value}</h3>
      </div>
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </GlassCard>
  );
}
