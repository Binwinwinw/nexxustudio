/* src/components/PerformanceMonitor.jsx */
import React from 'react';
import { Activity, Cpu, Zap, Layers } from 'lucide-react';
import { getReadinessUi } from '../services/readinessUi';

const PerformanceMonitor = ({ stats, health, readyStatus = 'starting', variant = 'drawer' }) => {
  const isSidebar = variant === 'sidebar';
  const vramPercent = stats?.vram?.percent || 0;
  const vramUsed = (stats?.vram?.used / 1024).toFixed(1) || 0;
  const vramTotal = (stats?.vram?.total / 1024).toFixed(1) || 0;
  const tps = stats?.tps || 0;

  const getStatusColor = (status) => {
    switch(status) {
      case 'ready': return 'text-emerald-400';
      case 'warming': return 'text-blue-400 animate-pulse';
      case 'failed': return 'text-red-400';
      default: return 'text-slate-600';
    }
  };

  const readinessUi = getReadinessUi(readyStatus);

  return (
    <div
      className={
        isSidebar
          ? "p-3 bg-white/5"
          : "p-4 bg-white/10 backdrop-blur-md border-b border-white/10"
      }
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Activity size={12} className="text-blue-400 animate-pulse" />
          <span className="text-[10px] font-bold tracking-widest uppercase text-slate-400">Sentinel Monitor</span>
        </div>
        <span className={`text-[8px] uppercase font-bold tracking-[0.18em] px-2 py-1 rounded-full border ${readinessUi.badgeClass}`}>
          {readinessUi.label}
        </span>
      </div>

      <div className="space-y-4">
        {/* VRAM GAUGE */}
        <div>
          <div className="flex justify-between items-end mb-1">
            <div className="flex items-center gap-1.5">
              <Cpu size={10} className="text-blue-400" />
              <span className="text-[9px] text-slate-400 uppercase">VRAM GPU</span>
            </div>
            <span className="text-[10px] font-mono text-white">{vramUsed}G / {vramTotal}G</span>
          </div>
          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-500 ease-out"
              style={{ width: `${vramPercent}%` }}
            ></div>
          </div>
        </div>

        {/* NEURAL STATE (Warmup Status) */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Layers size={10} className="text-purple-400" />
            <span className="text-[9px] text-slate-400 uppercase">État Neural</span>
          </div>
          <div className="grid grid-cols-1 gap-1.5 pl-3 border-l border-white/5">
            {Object.entries(health?.warmup || {}).filter(([k]) => k !== 'isReady').map(([model, status]) => (
              <div key={model} className="flex justify-between items-center">
                <span className="text-[8px] text-slate-500 font-mono">{model}</span>
                <span className={`text-[8px] uppercase font-bold tracking-tighter ${getStatusColor(status)}`}>
                  {status}
                </span>
              </div>
            ))}
            {Object.keys(health?.warmup || {}).length === 0 && (
              <span className="text-[8px] text-slate-600 italic">Connexion au noyau...</span>
            )}
          </div>
        </div>

        {/* TPS GAUGE */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Zap size={10} className="text-emerald-400" />
            <span className="text-[9px] text-slate-400 uppercase">Vitesse Cognition</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-mono font-bold text-emerald-400">{tps}</span>
            <span className="text-[8px] text-emerald-400/50 uppercase font-bold tracking-tighter">t/s</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceMonitor;
