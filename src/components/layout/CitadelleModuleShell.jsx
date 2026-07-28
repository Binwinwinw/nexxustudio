import React from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";

/**
 * Enveloppe visuelle standard pour les modules ops de La Citadelle.
 */
export default function CitadelleModuleShell({
  icon: Icon,
  title,
  subtitle,
  onRefresh,
  loading = false,
  error = null,
  children,
  actions = null,
}) {
  return (
    <div className="p-6 h-full overflow-y-auto space-y-6 bg-slate-950/40">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-100 flex items-center gap-2 uppercase tracking-tight">
            {Icon && <Icon className="w-6 h-6 text-blue-400 shrink-0" />}
            {title}
          </h1>
          {subtitle && (
            <p className="text-slate-400 text-xs mt-1 tracking-wide">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {actions}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-xl border border-white/10 text-[10px] font-bold uppercase tracking-wider transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Actualiser
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="text-red-400 text-sm flex items-center gap-2 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {children}
    </div>
  );
}
