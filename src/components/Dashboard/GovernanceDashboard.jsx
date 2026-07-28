import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Shield, AlertTriangle, Database, Activity, RefreshCw } from 'lucide-react';
import GlassCard from '../GlassCard';

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981'];

export default function GovernanceDashboard() {
  const [summary, setSummary] = useState({ total: 0 });
  const [timeseries, setTimeseries] = useState([]);
  const [domains, setDomains] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [sumRes, timeRes, domRes, recRes] = await Promise.all([
        fetch(`${API_BASE}/api/governance/summary`, { credentials: "include" }),
        fetch(`${API_BASE}/api/governance/timeseries?days=30`, { credentials: "include" }),
        fetch(`${API_BASE}/api/governance/domains`, { credentials: "include" }),
        fetch(`${API_BASE}/api/governance/recent-fail-closed?limit=10`, { credentials: "include" })
      ]);

      setSummary(await sumRes.json());
      setTimeseries(await timeRes.json());
      setDomains(await domRes.json());
      setRecent(await recRes.json());
    } catch (err) {
      console.error("Failed to fetch governance stats", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="p-6 h-full overflow-y-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Shield className="w-6 h-6 text-purple-400" /> 
            Gouvernance Épistémique
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Supervision de la doctrine Fail-Closed et des limites de connaissances de Nexxus.
          </p>
        </div>
        <button 
          onClick={fetchStats}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors border border-slate-700"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard className="p-6 flex items-center gap-4 border-l-4 border-l-purple-500">
          <div className="p-3 bg-purple-500/20 rounded-lg">
            <Shield className="w-8 h-8 text-purple-400" />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-medium uppercase">Total Fail-Closed</p>
            <h3 className="text-3xl font-bold text-slate-100">{summary.total || 0}</h3>
          </div>
        </GlassCard>
        
        <GlassCard className="p-6 flex items-center gap-4 border-l-4 border-l-blue-500">
          <div className="p-3 bg-blue-500/20 rounded-lg">
            <Database className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-medium uppercase">Domaines impactés</p>
            <h3 className="text-3xl font-bold text-slate-100">{domains.length || 0}</h3>
          </div>
        </GlassCard>

        <GlassCard className="p-6 flex items-center gap-4 border-l-4 border-l-rose-500">
          <div className="p-3 bg-rose-500/20 rounded-lg">
            <AlertTriangle className="w-8 h-8 text-rose-400" />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-medium uppercase">Tendances récentes</p>
            <h3 className="text-3xl font-bold text-slate-100">{recent.length || 0} <span className="text-base text-slate-400 font-normal">derniers jours</span></h3>
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[400px]">
        <GlassCard className="p-4 flex flex-col">
          <h3 className="text-lg font-medium text-slate-200 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" /> Évolution (30 jours)
          </h3>
          <div className="flex-1 w-full h-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeseries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickFormatter={(tick) => tick.slice(5)} />
                <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                  itemStyle={{ color: '#8b5cf6' }}
                />
                <Line type="monotone" dataKey="count" name="Blocages" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, fill: '#8b5cf6' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex flex-col">
          <h3 className="text-lg font-medium text-slate-200 mb-4">Répartition par Agent/Domaine</h3>
          <div className="flex-1 w-full h-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={domains}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {domains.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-4 overflow-hidden flex flex-col">
        <h3 className="text-lg font-medium text-slate-200 mb-4">Derniers Incidents (Fail-Closed)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="p-3 text-slate-400 font-medium text-sm">Date</th>
                <th className="p-3 text-slate-400 font-medium text-sm">Agent</th>
                <th className="p-3 text-slate-400 font-medium text-sm">Raison</th>
                <th className="p-3 text-slate-400 font-medium text-sm">Requête (Verrouillée)</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((evt, idx) => (
                <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                  <td className="p-3 text-slate-300 text-sm whitespace-nowrap">
                    {new Date(evt.timestamp).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="p-3 text-sm">
                    <span className="px-2 py-1 bg-slate-700 rounded text-slate-200 text-xs">
                      {evt.agent}
                    </span>
                  </td>
                  <td className="p-3 text-slate-300 text-sm max-w-xs truncate" title={evt.reason}>
                    {evt.reason}
                  </td>
                  <td className="p-3 text-slate-400 text-sm italic truncate max-w-md" title={evt.query}>
                    "{evt.query}"
                  </td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td colSpan="4" className="p-6 text-center text-slate-500 italic">
                    Aucun incident épistémique récent.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
