/* src/components/Cockpit.jsx - VERSION ULTIMATE DÉCOUPLÉE */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Activity, Brain, ShieldCheck, RefreshCcw, AlertTriangle, Gauge, Cpu, Layers, CheckCircle2, Eye, BookOpen, Rocket, Database } from 'lucide-react';
import AsyncForgePanel from './AsyncForgePanel';
import TraceDebugPanel from './Cockpit/TraceDebugPanel';
import ImpeccableQualityPanel from './Cockpit/ImpeccableQualityPanel';
import NeuralMatrixPanel from './Cockpit/NeuralMatrixPanel';
import './Cockpit.css';

// --- CONFIGURATION ---
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const REFRESH_RATE = 3000;
const STALE_THRESHOLD = 7000;
const FETCH_TIMEOUT = 2500;

const THRESHOLDS = { 
  latency: { warn: 500, crit: 2000 }, 
  vram: { crit: 90 }, 
  tokens: { warn: 4000 } 
};

const PROTOCOLS = {
  latency: { label: "CONSEILLÉ", text: "Optimiser cache ou basculer sur modèle LITE.", type: "warn" },
  vram: { label: "URGENT", text: "Arrêt AirLLM recommandé. Libérer VRAM.", type: "crit" },
  tokens: { label: "CONSEILLÉ", text: "Réduire fenêtre contexte (Memory Flush).", type: "warn" },
  security: { label: "URGENT", text: "Révision des gardes-fous (Sentinel) requise.", type: "crit" },
  forge: { label: "STRATÉGIQUE", text: "Validation humaine requise pour scellement Forge.", type: "strategic" }
};

// --- HOOK DE TÉLÉMÉTRIE (LE MOTEUR) ---
const useCockpitTelemetry = (sessionId) => {
  const [data, setData] = useState(null);
  const [conversationHealth, setConversationHealth] = useState(null);
  const [memoryGovernance, setMemoryGovernance] = useState(null);
  const [error, setError] = useState(null);
  const [modeHistory, setModeHistory] = useState([]);
  const [lastSeen, setLastSeen] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  // Ticker pour la réactivité du signal de fraîcheur
  useEffect(() => {
    const ticker = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(ticker);
  }, []);

  const calculateMode = useCallback((d) => {
    if (!d) return 'OFFLINE';
    const score = d.maturity?.score || 0;
    if (score >= 80) return 'FORGE';
    if (d.governance?.blockedCount > 0) return 'AUDIT';
    return score < 40 ? 'PRUDENCE' : 'NORMAL';
  }, []);

  const fetchTelemetry = useCallback(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    try {
      const [cockpitResponse, conversationResponse, memoryResponse] = await Promise.all([
        fetch(`${API_BASE}/api/telemetry/cockpit?sessionId=${sessionId}`, {
          credentials: 'include',
          signal: controller.signal
        }),
        fetch(`${API_BASE}/api/conversation/health`, {
          credentials: 'include',
          signal: controller.signal
        }),
        fetch(`${API_BASE}/api/memory/governance`, {
          credentials: 'include',
          signal: controller.signal
        })
      ]);
      
      clearTimeout(timeoutId);
      if (!cockpitResponse.ok) throw new Error(`HTTP ${cockpitResponse.status}`);
      if (!conversationResponse.ok) throw new Error(`HTTP ${conversationResponse.status}`);

      const json = await cockpitResponse.json();
      const conversationJson = await conversationResponse.json();

      let memoryJson = null;
      if (memoryResponse.ok) {
        memoryJson = await memoryResponse.json();
      }

      const currentMode = calculateMode(json);
      setModeHistory(prev => (prev[0]?.mode !== currentMode ? [{ mode: currentMode, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 5) : prev));
      setData(json);
      setConversationHealth(conversationJson);
      setMemoryGovernance(memoryJson);
      setError(null);
      setLastSeen(Date.now());
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name !== 'AbortError') setError(err.message);
    }
  }, [sessionId, calculateMode]);

  useEffect(() => {
    fetchTelemetry();
    const timer = setInterval(fetchTelemetry, REFRESH_RATE);
    return () => clearInterval(timer);
  }, [fetchTelemetry]);

  const currentMode = calculateMode(data);

  return {
    data,
    conversationHealth,
    memoryGovernance,
    error,
    modeHistory,
    currentMode,
    isStale: (now - lastSeen) > STALE_THRESHOLD
  };
};

function getConversationStatus(conversationHealth) {
  const today = conversationHealth?.health?.today;
  if (!today) return { label: "INCONNU", style: "text-slate-400 border-slate-500/30" };
  if (today.streamErrorCount > 0 || today.noVisibleTokens > 0) {
    return { label: "INCIDENT", style: "text-red-300 border-red-500/40 bg-red-500/10" };
  }
  if (today.fallbackRatePct >= 1) {
    return { label: "DEGRADE", style: "text-amber-300 border-amber-500/40 bg-amber-500/10" };
  }
  return { label: "OK", style: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10" };
}

function getMemoryGovernanceStatus(memoryGovernance) {
  const kpis = memoryGovernance?.kpis;
  if (!kpis) return { label: "INCONNU", style: "text-slate-400 border-slate-500/30" };
  if (!kpis.memoryGateHealthy) {
    return { label: "VIOLATION", style: "text-red-300 border-red-500/40 bg-red-500/10" };
  }
  if (!kpis.noStaleActive) {
    return { label: "STALE", style: "text-amber-300 border-amber-500/40 bg-amber-500/10" };
  }
  if (kpis.governanceReady) {
    return { label: "OK", style: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10" };
  }
  return { label: "SURVEILLANCE", style: "text-blue-300 border-blue-500/40 bg-blue-500/10" };
}

// --- COMPOSANTS DE PRÉSENTATION ---
const MetricBar = ({ label, value, limits }) => {
  const status = value >= (limits?.crit || 999) ? 'status-crit' : value >= (limits?.warn || 999) ? 'status-warn' : 'status-healthy';
  return (
    <div className="mb-3">
      <div className="flex justify-between text-[11px] mb-1 font-bold">
        <span className="opacity-70">{label}</span>
        <span className={`font-mono ${status}`}>{value || 0}%</span>
      </div>
      <div className="h-2 bg-black/40 rounded-full overflow-hidden border border-white/10">
        <div className={`h-full transition-all duration-1000 bar-${status}`} style={{ width: `${value || 0}%` }} />
      </div>
    </div>
  );
};

const ActionProtocol = ({ alertType }) => {
  const p = PROTOCOLS[alertType];
  return (
    <div className={`action-protocol ${p.type} mt-auto`}>
      <span className="font-black">[{p.label}]</span>
      <span className="italic opacity-90"> {p.text}</span>
    </div>
  );
};

// --- COMPOSANT PRINCIPAL ---
const Cockpit = ({ sessionId }) => {
  const { data, conversationHealth, memoryGovernance, error, modeHistory, currentMode, isStale } = useCockpitTelemetry(sessionId);
  const [activeTab, setActiveTab] = useState(null); // null = auto (currentMode), else manual override
  const [isPromoting, setIsPromoting] = useState(false);
  const [promoteResult, setPromoteResult] = useState(null);

  const handlePromote = async (projectId) => {
    if (!projectId || projectId === "unknown") return alert("Identifiant de projet manquant.");
    setIsPromoting(true);
    try {
      const response = await fetch(`http://localhost:3000/api/projects/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId })
      });
      const result = await response.json();
      setPromoteResult(result);
      if (result.success) {
        alert(`Succès : Projet promu au score de ${result.score}/20`);
      } else {
        alert(`Échec : ${result.reason}`);
      }
    } catch (err) {
      console.error(err);
      alert("Erreur réseau lors de la promotion.");
    } finally {
      setIsPromoting(false);
    }
  };

  if (!data && !error) return (
    <div className="cockpit-loading-state">
      <RefreshCcw className="animate-spin text-blue-400" size={32} />
      <span className="text-xs uppercase tracking-widest mt-4">Liaison au Noyau...</span>
    </div>
  );

  const { health, routing, maturity, governance, incidents, warmup, reliability } = data || {};
  const displayScore = maturity?.score ? Math.min(100, maturity.score * 5) : 0;
  const convStatus = getConversationStatus(conversationHealth);
  const convToday = conversationHealth?.health?.today;
  const convRecent = conversationHealth?.health?.recentIncidents || [];
  const memGov = memoryGovernance?.governance;
  const memToday = memGov?.today;
  const memStatus = getMemoryGovernanceStatus(memoryGovernance);
  const memRecent = memGov?.recentEvents || [];
  const memRefusals = memGov?.refusalReasons || [];
  const memDist = memGov?.distribution;

  return (
    <div className={`cockpit-container ${isStale ? 'ui-stale' : ''}`}>
      {/* HEADER : IDENTITÉ & MODES */}
      <div className="cockpit-header">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-blue-400 animate-pulse" />
          <h2 className="text-sm font-black uppercase tracking-tighter text-white">Citadel Cockpit v3.4</h2>
        </div>
        
        <div className="mode-bar">
          {['PRUDENCE', 'NORMAL', 'AUDIT', 'FORGE'].map(m => (
            <div 
              key={m} 
              className={`mode-badge ${(activeTab || currentMode) === m ? 'active' : ''} cursor-pointer`}
              onClick={() => setActiveTab(m)}
            >
              {m}
            </div>
          ))}
          {activeTab && (
            <div 
              className="text-[9px] ml-2 opacity-50 hover:opacity-100 cursor-pointer underline" 
              onClick={() => setActiveTab(null)}
            >
              AUTO
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className={`latency-badge ${health?.latency > 500 ? 'status-warn' : 'status-healthy'}`}>
            {health?.latency || '--'}ms
          </div>
          {isStale && <div className="stale-warning animate-pulse">STALE DATA</div>}
          {error && <AlertTriangle size={16} className="text-red-500" title={error} />}
        </div>
      </div>

      {(activeTab || currentMode) === 'FORGE' ? (
        <div className="mt-6">
          <AsyncForgePanel sessionId={sessionId} />
        </div>
      ) : (
        <div className="cockpit-grid">
        {/* BLOC 1 : COGNITION & ROUTAGE */}
        <div className="cockpit-card">
          <div className="card-header"><Brain size={14} className="text-purple-400" /><span>ROUTING EXPLAINABILITY</span></div>
          <div className="expert-badge">{routing?.lastExpert || 'STANDBY'}</div>
          <div className="rationale-box">{routing?.rationale}</div>
          {routing?.tokens > THRESHOLDS.tokens.warn && <ActionProtocol alertType="tokens" />}
        </div>

        {/* BLOC 2 : GOUVERNANCE & RISQUES */}
        <div className="cockpit-card">
          <div className="card-header"><ShieldCheck size={14} className="text-blue-400" /><span>GOUVERNANCE</span></div>
          <div className="flex gap-4 mb-4">
            <div className="stat-box flex-1"><span className="label">BLOQUÉS</span><span className={`val ${governance?.blockedCount > 0 ? 'text-red-500' : ''}`}>{governance?.blockedCount}</span></div>
            <div className="stat-box flex-1"><span className="label">SOUVERAINETÉ</span><span className="val text-blue-400">{governance?.sovereigntyLevel}</span></div>
          </div>
          
          {/* Graph Health Indicator */}
          {governance?.graphHealth && (
            <div className="mt-2 p-3 bg-black/20 rounded-lg border border-white/5">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold opacity-50 uppercase tracking-wider">Graph Health</span>
                <span className={`text-[10px] font-black ${governance.graphHealth.status === 'Healthy' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {governance.graphHealth.status}
                </span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-[9px] opacity-40">Densité: {governance.graphHealth.density}</span>
                <span className="text-[9px] opacity-40">{governance.graphHealth.nodes} Noeuds / {governance.graphHealth.edges} Arêtes</span>
              </div>
            </div>
          )}

          {governance?.blockedCount > 0 && <ActionProtocol alertType="security" />}
        </div>

        <ImpeccableQualityPanel designQuality={data?.design_quality} />

        <NeuralMatrixPanel neuralMatrix={data?.neural_matrix} />

        {/* BLOC 3 : MATURATION (Full Width) */}
        <div className="cockpit-card col-span-2">
          <div className="card-header"><Gauge size={14} className="text-cyan-400" /><span>MATURATION FORGE</span></div>
          <div className="flex justify-between items-center px-6 py-4 bg-black/30 rounded-xl mb-4 border border-white/5">
            <div className="text-2xl font-black italic tracking-tighter">{maturity?.phase}</div>
            <div className="flex flex-col items-center">
               <div className="text-3xl font-mono text-cyan-400">{displayScore}%</div>
               <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest mt-1">Score: {maturity?.score}/20</div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex gap-1 justify-end">
                {modeHistory.map((h, i) => (
                  <span key={i} className="history-pill" title={h.time}>{h.mode}</span>
                ))}
              </div>
              {maturity?.score >= 18 && (
                <button 
                  onClick={() => handlePromote(maturity.projectId)}
                  disabled={isPromoting}
                  className={`px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all shadow-lg shadow-emerald-900/20 ${isPromoting ? 'animate-pulse' : ''}`}
                >
                  {isPromoting ? 'Promotion...' : 'Promouvoir en Mémoire'}
                </button>
              )}
            </div>
          </div>
          <div className="recommendation-box italic text-sm text-slate-400 text-center px-10">
            "{maturity?.recommendation}"
          </div>
          {maturity?.score >= 18 && <ActionProtocol alertType="forge" />}
        </div>

        {/* BLOC 4 : RESSOURCES RUNTIME */}
        <div className="cockpit-card">
          <div className="card-header"><Cpu size={14} className="text-emerald-400" /><span>RESOURCES</span></div>
          <MetricBar label="VRAM" value={health?.vram?.percent} limits={THRESHOLDS.vram} />
          {health?.vram?.percent > THRESHOLDS.vram.crit && <ActionProtocol alertType="vram" />}
        </div>

        {/* BLOC 4.7 : MULTIMODAL AWARENESS (V4) */}
        <div className="cockpit-card">
          <div className="card-header"><Eye size={14} className="text-cyan-400" /><span>MULTIMODAL AWARENESS</span></div>
          {data?.multimodal ? (
            <div className="space-y-2">
              <div className="flex justify-between text-[9px] uppercase font-bold opacity-60">
                <span>Vision Source</span>
                <span className="text-white truncate max-w-[80px]">{data.multimodal.rawAnalyses?.[0]?.filename || 'Stream'}</span>
              </div>
              <div className="vision-briefing-box text-[10px] bg-white/5 p-2 rounded border border-white/5 italic">
                {data.multimodal.rawAnalyses?.[0]?.analysis?.slice(0, 80)}...
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="stat-box-mini">
                  <span className="label">OCR STATUS</span>
                  <span className={`val ${data.multimodal.rawAnalyses?.[0]?.ocr ? 'text-emerald-400' : 'opacity-30'}`}>
                    {data.multimodal.rawAnalyses?.[0]?.ocr ? 'DETECTED' : 'NONE'}
                  </span>
                </div>
                <div className="stat-box-mini">
                  <span className="label">LATENCY</span>
                  <span className="val text-blue-400">{data.multimodal.duration}ms</span>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[8px] font-black opacity-30 uppercase">LTM Signal</span>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${data?.maturity?.score >= 18 ? 'bg-emerald-500 animate-pulse' : 'bg-white/10'}`}></div>
                  <span className="text-[9px] font-bold">EPISODIC READY</span>
                </div>
              </div>

              {/* JURISPRUDENCE SUB-SECTION */}
              <div className="mt-4 pt-3 border-t border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen size={10} className="text-purple-400" />
                  <span className="text-[9px] font-black uppercase opacity-60 tracking-wider">Jurisprudence Récente</span>
                </div>
                <div className="space-y-1">
                  {data?.jurisprudence?.length > 0 ? (
                    data.jurisprudence.slice(0, 3).map((p, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-white/5 px-2 py-1 rounded text-[8px] border border-white/5">
                        <span className="truncate max-w-[100px] opacity-80">{p.title || p.id}</span>
                        <span className="text-purple-400 font-bold">{(p.score * 100).toFixed(0)}%</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-[8px] italic opacity-30 text-center py-2">Aucun pattern gravé...</div>
                  )}
                </div>
                {data?.jurisprudence?.length > 0 && (
                  <div className="mt-2 flex justify-between text-[7px] font-black uppercase opacity-40">
                    <span>Maturité Globale</span>
                    <span className="text-emerald-400">{Math.min(100, data.jurisprudence.length * 20)}% Industrialisé</span>
                  </div>
                )}
              </div>

              {/* MEDIAFORGE SUB-SECTION (VAGUE 5) */}
              <div className="mt-4 pt-3 border-t border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Layers size={10} className="text-pink-400" />
                    <span className="text-[9px] font-black uppercase opacity-60 tracking-wider">MediaForge (V5)</span>
                  </div>
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse" title="Engine: Image Ready"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" title="Engine: Audio Ready"></div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/5 p-1 rounded border border-white/5 text-center">
                    <div className="text-[7px] opacity-40 uppercase">Visuals</div>
                    <div className="text-[9px] font-bold text-pink-400">ACTIVE</div>
                  </div>
                  <div className="bg-white/5 p-1 rounded border border-white/5 text-center">
                    <div className="text-[7px] opacity-40 uppercase">Audio</div>
                    <div className="text-[9px] font-bold text-blue-400">STANDBY</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 opacity-20 grayscale">
              <Eye size={24} className="mb-2" />
              <span className="text-[9px] uppercase font-black tracking-widest">Waiting for Vision...</span>
            </div>
          )}
        </div>

        {/* BLOC 5 : EFFICIENCE AUDIT */}
        <div className="cockpit-card">
          <div className="card-header"><ShieldCheck size={14} className="text-emerald-400" /><span>AUDIT EFFICIENCY</span></div>
          <div className="space-y-3">
            <div className="flex justify-between text-[11px]">
              <span className="opacity-70 uppercase">Latence Moy.</span>
              <span className="font-mono text-emerald-400">{data?.audit?.avgLatency || 0}ms</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="opacity-70 uppercase">Auto-Indexés</span>
              <span className="font-mono text-blue-400">{data?.audit?.autoIndexedCount || 0}</span>
            </div>
            <MetricBar label="SUCCESS RATE" value={data?.audit?.successRate || 0} />
          </div>
        </div>
        {/* BLOC 6 : FEEDBACK SIGNALS */}
        <div className="cockpit-card">
          <div className="card-header"><AlertTriangle size={14} className="text-amber-400" /><span>SIGNALS</span></div>
          <div className="incidents-list-compact">
            {incidents?.length ? incidents.slice(0, 3).map((inc, i) => (
              <div key={i} className="incident-row text-xs opacity-80 border-b border-white/5 py-1 truncate">
                {inc.summary || inc.content}
              </div>
            )) : <div className="text-center opacity-20 text-xs italic py-4">Aucun signal détecté</div>}
          </div>
        </div>

        {/* BLOC 7 : RELIABILITY HEALTH (VAGUE 2) */}
        <div className="cockpit-card col-span-2">
          <div className="card-header"><ShieldCheck size={14} className="text-emerald-400" /><span>RELIABILITY HEALTH (VAGUE 2)</span></div>
          <div className="grid grid-cols-4 gap-4 p-4">
            <div className="stat-box">
              <span className="label">PUBLICATION PRIMALE</span>
              <span className="val text-emerald-400">{Math.round(reliability?.Taux_Publication_Primal || 0)}%</span>
            </div>
            <div className="stat-box">
              <span className="label">REJET CRITIC</span>
              <span className="val text-red-400">{Math.round(reliability?.Taux_Rejet_Critic || 0)}%</span>
            </div>
            <div className="stat-box">
              <span className="label">HYPOTHÈSE PRUDENTE</span>
              <span className="val text-amber-400">{Math.round(reliability?.Taux_Hypothese_Prudente || 0)}%</span>
            </div>
            <div className="stat-box">
              <span className="label">SCORE SMAC MOY.</span>
              <span className="val text-blue-400">{(reliability?.Score_SMAC_Moyen || 0).toFixed(2)}</span>
            </div>
          </div>
          
          {/* CONFIDENCE CALIBRATION (Tâche 6 & 7) */}
          <div className="border-t border-white/5 p-4 bg-black/20">
            <div className="flex justify-between items-center mb-2">
               <div className="flex items-center gap-2">
                 <span className="text-[10px] font-black uppercase opacity-40">Confidence Calibration</span>
                 {reliability?.status && reliability?.status !== 'CALIBRATED' && (
                   <span className={`text-[8px] font-black px-1.5 py-0.5 rounded animate-pulse ${reliability?.status === 'CRITICAL_DRIFT' ? 'bg-red-600 text-white' : 'bg-amber-500 text-black'}`}>
                     DRIFT ALERT: {reliability?.status}
                   </span>
                 )}
               </div>
               <div className="flex items-center gap-2">
                  <span className="text-[9px] opacity-40 font-mono">TREND:</span>
                  <span className={`text-[10px] font-black ${reliability?.trend === 'drifting_up' ? 'text-red-400' : reliability?.trend === 'drifting_down' ? 'text-blue-400' : 'text-emerald-400'}`}>
                    {reliability?.trend === 'drifting_up' ? '↗️ SURSÉCURITÉ' : reliability?.trend === 'drifting_down' ? '↘️ OVER-CONFIDENCE' : '➡️ STABLE'}
                  </span>
               </div>
            </div>
            <div className="flex items-center gap-4">
               <div className="flex-1">
                 <div className="flex justify-between text-[9px] mb-1">
                   <span className="opacity-50 uppercase">Drift (Recent: {reliability?.recentDrift || '0.00'})</span>
                   <span className={`font-mono ${Math.abs(reliability?.driftDelta || 0) > 0.1 ? 'text-amber-400' : ''}`}>
                     Δ {reliability?.driftDelta > 0 ? '+' : ''}{reliability?.driftDelta || '0.00'}
                   </span>
                 </div>
                 <div className="h-1.5 bg-white/5 rounded-full overflow-hidden flex">
                    <div 
                      className={`h-full ${reliability?.recentDrift > 0 ? 'bg-red-500' : 'bg-blue-500'}`} 
                      style={{ 
                        width: `${Math.min(100, Math.abs(reliability?.recentDrift || 0) * 100)}%`,
                        marginLeft: reliability?.recentDrift < 0 ? 'auto' : '0' 
                      }} 
                    />
                 </div>
                 <div className="mt-1 flex justify-between text-[8px] font-bold">
                    <span className="opacity-30">AUTO-REGULATION:</span>
                    <span className={reliability?.drift < 0 ? 'text-red-400' : 'text-blue-400'}>
                       {reliability?.drift < 0 ? 'STRICT' : 'PERMISSIVE'} MODE ({reliability?.drift ? (-(reliability?.drift * 20)).toFixed(1) : '0.0'}% offset)
                    </span>
                 </div>
               </div>
               <div className="stat-box text-center min-w-[80px]">
                 <span className="label">JUSTESSE RÉELLE</span>
                 <span className="val text-white">{reliability?.accuracy || 0}%</span>
               </div>
            </div>
            <div className="mt-2 text-center">
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded bg-white/5 border border-white/10`}>
                Diagnostic: {reliability?.interpretation || 'EN ATTENTE'}
              </span>
            </div>
          </div>

          {reliability?.Taxonomie_Erreurs && (
            <div className="px-4 pb-4 mt-2">
              <div className="text-[10px] font-black uppercase opacity-40 mb-2">Top motifs de rejet</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(reliability.Taxonomie_Erreurs).map(([reason, count]) => (
                  <span key={reason} className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[9px] font-mono">
                    {reason}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* BLOC 8 : SANTE CONVERSATIONNELLE */}
        <div className="cockpit-card col-span-2">
          <div className="card-header">
            <Rocket size={14} className="text-cyan-400" />
            <span>SANTE CONVERSATIONNELLE</span>
          </div>

          <div className="flex items-center justify-between px-4 py-3 bg-black/20 rounded-lg border border-white/5 mb-3">
            <span className="text-[10px] uppercase font-black opacity-60">Etat global</span>
            <span className={`text-[10px] font-black px-2 py-1 rounded border ${convStatus.style}`}>
              {convStatus.label}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="stat-box">
              <span className="label">Fallback Rate</span>
              <span className="val text-blue-400">{convToday?.fallbackRatePct ?? 0}%</span>
            </div>
            <div className="stat-box">
              <span className="label">No Visible Tokens</span>
              <span className={`val ${(convToday?.noVisibleTokens || 0) > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {convToday?.noVisibleTokens ?? 0}
              </span>
            </div>
            <div className="stat-box">
              <span className="label">Stream Errors</span>
              <span className={`val ${(convToday?.streamErrorCount || 0) > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {convToday?.streamErrorCount ?? 0}
              </span>
            </div>
            <div className="stat-box">
              <span className="label">Last Failure Mode</span>
              <span className="val text-slate-200">{conversationHealth?.health?.lastFailureMode || "none"}</span>
            </div>
          </div>

          <div className="text-[10px] font-black uppercase opacity-50 mb-2">5 derniers incidents</div>
          <div className="space-y-1">
            {convRecent.length === 0 ? (
              <div className="text-[10px] italic opacity-40 py-2">Aucun incident recent.</div>
            ) : (
              convRecent.slice(0, 5).map((incident, idx) => (
                <div key={`${incident.at}-${idx}`} className="flex items-center justify-between text-[10px] px-2 py-1 rounded bg-white/5 border border-white/5">
                  <span className="font-mono opacity-80 truncate pr-2">
                    {incident.type} | {incident.mode || "unknown"} | {incident.reason || "n/a"}
                  </span>
                  <span className="opacity-50 whitespace-nowrap">
                    {new Date(incident.at).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* BLOC 9 : GOUVERNANCE MEMOIRE */}
        <div className="cockpit-card col-span-2">
          <div className="card-header">
            <Database size={14} className="text-purple-400" />
            <span>GOUVERNANCE MEMOIRE</span>
          </div>

          <div className="flex items-center justify-between px-4 py-3 bg-black/20 rounded-lg border border-white/5 mb-3">
            <span className="text-[10px] uppercase font-black opacity-60">Etat memoire</span>
            <span className={`text-[10px] font-black px-2 py-1 rounded border ${memStatus.style}`}>
              {memStatus.label}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="stat-box">
              <span className="label">Promotion Rate</span>
              <span className="val text-purple-400">{memToday?.promotionRatePct ?? 0}%</span>
            </div>
            <div className="stat-box">
              <span className="label">Refus precheck</span>
              <span className={`val ${(memToday?.precheckRefused || 0) > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {memToday?.precheckRefused ?? 0}
              </span>
            </div>
            <div className="stat-box">
              <span className="label">Stale actives</span>
              <span className={`val ${(memToday?.staleInStore || 0) > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {memToday?.staleInStore ?? 0}
              </span>
            </div>
            <div className="stat-box">
              <span className="label">Score gouvernance</span>
              <span className="val text-cyan-400">{memoryGovernance?.globalScore ?? '--'}</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { key: 'storeActive', label: 'Store', value: memDist?.storeActive },
              { key: 'episodic', label: 'Episodic', value: memDist?.episodicFiles },
              { key: 'semantic', label: 'Semantic', value: memDist?.semanticFacts },
              { key: 'heritage', label: 'Heritage', value: memDist?.heritageProposed },
            ].map((tier) => (
              <div key={tier.key} className="bg-white/5 border border-white/5 rounded px-2 py-2 text-center">
                <div className="text-[8px] uppercase opacity-40 font-black">{tier.label}</div>
                <div className="text-[11px] font-mono font-bold text-purple-300">{tier.value ?? 0}</div>
              </div>
            ))}
          </div>

          <div className="text-[10px] font-black uppercase opacity-50 mb-2">Top motifs de refus</div>
          <div className="flex flex-wrap gap-2 mb-3">
            {memRefusals.length === 0 ? (
              <span className="text-[10px] italic opacity-40">Aucun refus enregistre aujourd&apos;hui.</span>
            ) : (
              memRefusals.slice(0, 5).map((item) => (
                <span key={item.reason} className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[9px] font-mono">
                  {item.reason}: {item.count}
                </span>
              ))
            )}
          </div>

          <div className="text-[10px] font-black uppercase opacity-50 mb-2">Evenements recents</div>
          <div className="space-y-1">
            {memRecent.length === 0 ? (
              <div className="text-[10px] italic opacity-40 py-2">Aucun evenement memoire recent.</div>
            ) : (
              memRecent.slice(0, 5).map((event, idx) => (
                <div key={`${event.at}-${idx}`} className="flex items-center justify-between text-[10px] px-2 py-1 rounded bg-white/5 border border-white/5">
                  <span className="font-mono opacity-80 truncate pr-2">
                    {event.status}
                    {event.target ? ` → ${event.target}` : ''}
                    {event.reasons?.length ? ` | ${event.reasons.slice(0, 2).join(', ')}` : ''}
                  </span>
                  <span className="opacity-50 whitespace-nowrap">
                    {new Date(event.at).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <TraceDebugPanel sessionId={sessionId} />
      </div>
      )}
    </div>
  );
};

export default Cockpit;
