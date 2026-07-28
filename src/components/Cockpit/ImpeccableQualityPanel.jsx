import React from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';

/**
 * Panneau gate qualité Impeccable — score, merge_ok, checklist pre-merge (Phase E2).
 */
export default function ImpeccableQualityPanel({ designQuality }) {
  if (!designQuality) {
    return (
      <div className="cockpit-card col-span-2">
        <div className="card-header">
          <ShieldCheck size={14} className="text-violet-400" />
          <span>IMPECCABLE — QUALITÉ DESIGN</span>
        </div>
        <p className="text-[11px] opacity-50 italic px-2">
          Aucun audit récent. Lancez un job via pipeline D4 puis POST /api/impeccable/audit/jobs.
        </p>
      </div>
    );
  }

  const mergeOk = designQuality.merge_ok === true;
  const score = designQuality.score_global ?? '—';
  const checklist = designQuality.checklist_pre_merge || [];
  const requiredFailed = checklist.filter((item) => item.required && !item.ok);

  return (
    <div className="cockpit-card col-span-2">
      <div className="card-header">
        <ShieldCheck size={14} className="text-violet-400" />
        <span>IMPECCABLE — QUALITÉ DESIGN</span>
        <span
          className={`ml-auto text-[10px] font-black px-2 py-0.5 rounded ${
            mergeOk
              ? 'text-emerald-300 border border-emerald-500/40 bg-emerald-500/10'
              : 'text-red-300 border border-red-500/40 bg-red-500/10'
          }`}
        >
          {mergeOk ? 'MERGE OK' : 'BLOCKED'}
        </span>
      </div>

      <div className="flex gap-6 items-center mb-4 px-2">
        <div className="text-4xl font-mono text-violet-300">{score}</div>
        <div className="text-[10px] uppercase opacity-60">
          <div>Score global / 100</div>
          <div className="mt-1">
            Blockers : {designQuality.blockers_count ?? 0} · Pipeline :{' '}
            {designQuality.pipeline_job_id || '—'}
          </div>
        </div>
        {mergeOk ? (
          <CheckCircle2 className="text-emerald-400 ml-auto" size={28} />
        ) : (
          <AlertTriangle className="text-amber-400 ml-auto" size={28} />
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        {checklist.map((item) => (
          <div
            key={item.id}
            className={`flex items-center gap-2 p-2 rounded border ${
              item.ok ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'
            }`}
          >
            <span>{item.ok ? '✓' : '✗'}</span>
            <span className={item.required ? 'font-bold' : 'opacity-80'}>{item.label}</span>
          </div>
        ))}
      </div>

      {requiredFailed.length > 0 && (
        <p className="text-[10px] text-amber-300 mt-3 px-2 italic">
          {requiredFailed.length} critère(s) requis non satisfait(s) avant merge Forge.
        </p>
      )}
    </div>
  );
}
