/* src/components/PerformanceMonitor.jsx */
import React from 'react';
import { Activity, Zap } from 'lucide-react';
import { getReadinessUi } from '../services/readinessUi';

const PerformanceMonitor = ({ stats, readyStatus = 'starting', variant = 'drawer' }) => {
  const isSidebar = variant === 'sidebar';
  const vramPercent =
    stats?.vram?.percent ?? (typeof stats?.vram === 'number' ? stats.vram : 0);
  const vramHigh = vramPercent > 80;
  const tps = stats?.tps || 0;

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
        {/* VRAM Usage (depuis Efficience Opérationnelle) */}
        <div className="p-3 bg-black/30 rounded-xl border border-white/5">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">
              VRAM Usage
            </span>
            <span
              className={`text-xs font-mono font-black ${vramHigh ? 'text-red-400' : 'text-emerald-400'}`}
            >
              {vramPercent}%
            </span>
          </div>
          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ${vramHigh ? 'bg-red-500' : 'bg-emerald-500'}`}
              style={{ width: `${vramPercent}%` }}
            />
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
