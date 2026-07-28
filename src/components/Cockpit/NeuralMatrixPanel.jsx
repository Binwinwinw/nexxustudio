import React from 'react';
import { Layers, Zap, Brain, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

const PROFILE_LABELS = {
  reactive: 'REACTIVE',
  fast: 'FAST',
  aggressive: 'AGGRESSIVE',
};

const STATE_STYLES = {
  done: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
  active: 'text-blue-300 border-blue-500/40 bg-blue-500/10 animate-pulse',
  pending: 'text-slate-400 border-slate-500/30 bg-white/5',
  error: 'text-red-300 border-red-500/40 bg-red-500/10',
};

const TIER2_BADGE = {
  deferred: 'text-slate-300 border-slate-500/40 bg-slate-500/10',
  idle: 'text-slate-300 border-slate-500/40 bg-slate-500/10',
  warming: 'text-blue-300 border-blue-500/40 bg-blue-500/10 animate-pulse',
  ready: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
  failed: 'text-red-300 border-red-500/40 bg-red-500/10',
  timeout: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
};

function TimelineStep({ step }) {
  const style = STATE_STYLES[step.status] || STATE_STYLES.pending;
  return (
    <div className={`flex items-start gap-3 p-2 rounded-lg border ${style}`}>
      <div className="mt-0.5 shrink-0">
        {step.status === 'done' && <CheckCircle2 size={14} />}
        {step.status === 'active' && <Clock size={14} className="animate-spin" />}
        {step.status === 'error' && <AlertTriangle size={14} />}
        {step.status === 'pending' && <div className="w-3.5 h-3.5 rounded-full border border-current opacity-40" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold uppercase tracking-wide">{step.label}</div>
        {step.sublabel && (
          <div className="text-[9px] opacity-70 mt-0.5">{step.sublabel}</div>
        )}
        {step.duration_ms != null && step.duration_ms > 0 && (
          <div className="text-[9px] font-mono opacity-50 mt-0.5">{step.duration_ms} ms</div>
        )}
      </div>
    </div>
  );
}

/**
 * Panneau Neural Matrix — tempo warm-up Tier 1 / Tier 2 (doctrine reactive).
 */
export default function NeuralMatrixPanel({ neuralMatrix }) {
  if (!neuralMatrix) {
    return (
      <div className="cockpit-card col-span-2">
        <div className="card-header">
          <Layers size={14} className="text-blue-400" />
          <span>NEURAL MATRIX — TEMPO</span>
        </div>
        <p className="text-[11px] opacity-50 italic px-2">Warm-up non initialisé.</p>
      </div>
    );
  }

  const profile = PROFILE_LABELS[neuralMatrix.boot_profile] || neuralMatrix.boot_profile?.toUpperCase();
  const tier2Style = TIER2_BADGE[neuralMatrix.tier2?.state] || TIER2_BADGE.deferred;

  return (
    <div className="cockpit-card col-span-2">
      <div className="card-header">
        <Layers size={14} className="text-blue-400" />
        <span>NEURAL MATRIX — TEMPO</span>
        <span className="ml-auto text-[9px] font-black px-2 py-0.5 rounded border border-blue-500/30 text-blue-300">
          {profile}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-4 px-1">
        <div>
          <div className="text-[9px] uppercase opacity-50 font-black">Statut</div>
          <div className="text-lg font-black text-white tracking-tight">{neuralMatrix.headline}</div>
        </div>
        <div className={`text-[10px] font-black px-3 py-1.5 rounded-lg border ${tier2Style}`}>
          Tier 2 · {neuralMatrix.tier2?.label || '—'}
        </div>
        {neuralMatrix.latency_ms?.tier1 != null && (
          <div className="text-[10px] opacity-60">
            <span className="font-mono">T1 {neuralMatrix.latency_ms.tier1}ms</span>
            {neuralMatrix.latency_ms.tier2 != null && (
              <span className="font-mono ml-2">· T2 {neuralMatrix.latency_ms.tier2}ms</span>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-[9px] font-black uppercase opacity-40 mb-2 flex items-center gap-1">
            <Zap size={10} /> Tier 1
          </div>
          <div className="space-y-1 text-[10px] font-mono">
            <div className="flex justify-between gap-2">
              <span className="opacity-50 truncate">{neuralMatrix.tier1?.chat_model}</span>
              <span className={neuralMatrix.tier1?.chat_state === 'ready' ? 'text-emerald-400' : 'text-blue-400'}>
                {(neuralMatrix.tier1?.chat_state || '—').toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="opacity-50 truncate">{neuralMatrix.tier1?.embed_model}</span>
              <span className={['ready', 'lazy'].includes(neuralMatrix.tier1?.embed_state) ? 'text-emerald-400' : 'text-blue-400'}>
                {(neuralMatrix.tier1?.embed_state || '—').toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        <div>
          <div className="text-[9px] font-black uppercase opacity-40 mb-2 flex items-center gap-1">
            <Brain size={10} /> Tier 2 — {neuralMatrix.tier2?.model}
          </div>
          <div className="text-[10px] opacity-70 leading-relaxed">
            {neuralMatrix.tier2?.policy === 'background_at_boot'
              ? 'Profil aggressive : priming en arrière-plan après Tier 1.'
              : 'Profil reactive : chargé au premier trafic ou intent raisonnement.'}
          </div>
          <div className="text-[9px] opacity-40 mt-1 font-mono truncate" title={neuralMatrix.boot_trace_id}>
            trace {neuralMatrix.boot_trace_id?.slice(0, 8)}…
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-white/5">
        <div className="text-[9px] font-black uppercase opacity-40 mb-2">Timeline warm-up</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(neuralMatrix.timeline || []).map((step) => (
            <TimelineStep key={step.id} step={step} />
          ))}
        </div>
      </div>
    </div>
  );
}
