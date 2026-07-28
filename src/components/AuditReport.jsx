/* src/components/AuditReport.jsx */
import React from 'react';
import { X, ShieldCheck, Activity, Brain, Server, Clock, AlertTriangle } from 'lucide-react';

const AuditReport = ({ isOpen, onClose, session }) => {
  if (!isOpen || !session) return null;

  const { validation, metrics, signals } = session;
  const score = session.validation?.metrics?.score || 0;
  const missing = session.validation?.metrics?.missing || [];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-4xl max-h-[90vh] glass-panel bg-slate-900/90 border-white/10 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${session.validation?.forge_ready ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
              <ShieldCheck size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tighter uppercase">Audit de Session : {session.title}</h2>
              <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase mt-1">ID: {session.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* Top Grid: Score & Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Maturity Score Card */}
            <div className="col-span-1 glass-panel p-6 bg-white/5 flex flex-col items-center justify-center text-center relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                <Brain size={80} />
              </div>
              <div className="relative">
                <div className="text-5xl font-black mb-2 text-white">{score}%</div>
                <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Maturité du Projet</div>
              </div>
              <div className="w-full h-1.5 bg-white/5 rounded-full mt-6 overflow-hidden border border-white/5">
                <div 
                  className={`h-full transition-all duration-1000 ${session.validation?.forge_ready ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'bg-blue-500'}`}
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>

            {/* Status & Blocking Card */}
            <div className="col-span-1 md:col-span-2 glass-panel p-6 bg-white/5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Activity size={14} /> Diagnostic Nexxus 
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                  <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Status Forge</div>
                  <div className={`text-xs font-black uppercase ${session.validation?.forge_ready ? 'text-emerald-400' : 'text-orange-400'}`}>
                    {session.validation?.forge_ready ? 'VÉRIFIÉ & ARCHITECTURÉ' : 'EN COURS DE CÉLAGE'}
                  </div>
                </div>
                <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                  <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Signal [READY]</div>
                  <div className={`text-xs font-black uppercase ${session.validation?.signals?.ready_keyword ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {session.validation?.signals?.ready_keyword ? 'DÉTECTÉ' : 'EN ATTENTE'}
                  </div>
                </div>
              </div>

              {missing.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg">
                  <div className="flex items-center gap-2 text-red-400 text-[10px] font-bold uppercase tracking-widest mb-2">
                    <AlertTriangle size={14} /> Éléments Requises pour Forge
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {missing.map((item, i) => (
                      <span key={i} className="px-2 py-1 bg-red-500/20 text-red-200 text-[9px] rounded-md font-medium">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Details Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
               <Server size={14} /> Infrastructure de Session
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {/* Project Details */}
               <div className="glass-panel bg-black/20 p-4 space-y-3">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-[10px] text-slate-500 uppercase">Titre</span>
                    <span className="text-xs font-medium text-slate-300">{session.validation?.project?.project_title || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-[10px] text-slate-500 uppercase">Stack Technique</span>
                    <span className="text-xs font-medium text-blue-400">{(session.validation?.project?.technical_stack || []).join(', ') || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-[10px] text-slate-500 uppercase">Experts Mobilisés</span>
                    <span className="text-xs font-medium text-slate-300">{(session.validation?.project?.experts_required || []).join(', ') || 'N/A'}</span>
                  </div>
               </div>

               {/* Deliverables */}
               <div className="glass-panel bg-black/20 p-4">
                  <div className="text-[10px] text-slate-500 uppercase mb-3 font-bold">Livrables Définis</div>
                  <div className="space-y-2">
                    {(session.validation?.project?.deliverables || []).map((d, i) => (
                      <div key={i} className="text-xs text-slate-300 flex items-start gap-2">
                        <div className="mt-1.5 w-1 h-1 bg-blue-500 rounded-full shrink-0" />
                        {d}
                      </div>
                    ))}
                    {(!session.validation?.project?.deliverables || session.validation?.project?.deliverables.length ===0) && (
                      <span className="text-xs italic text-slate-600">Aucun livrable détecté</span>
                    )}
                  </div>
               </div>
            </div>
          </div>

        </div>

        {/* Footer with Satisfaction Feedback */}
        <div className="p-4 border-t border-white/5 bg-black/40 flex items-center justify-between">
          <div className="flex items-center gap-6 text-[9px] text-slate-600 uppercase tracking-[0.2em]">
            <span className="flex items-center gap-1.5"><Clock size={10} /> {new Date(session.timestamp).toLocaleDateString()}</span>
            <span className="hidden md:flex items-center gap-1.5 text-blue-500/60 font-black">Nexxus Runtime Protocol</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mr-2">Qualité du Diagnostic ?</span>
            <button 
              onClick={() => {
                fetch('http://localhost:3000/api/telemetry/feedback', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ sessionId: session.id, score: 5, comment: 'Audit Instantané' })
                });
                onClose();
              }}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 text-[10px] font-black transition-all"
            >
              PRÉCIS
            </button>
            <button 
              onClick={() => {
                fetch('http://localhost:3000/api/telemetry/feedback', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ sessionId: session.id, score: 1, comment: 'Latence ou erreur' })
                });
                onClose();
              }}
              className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 text-[10px] font-black transition-all"
            >
              IMPRÉCIS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditReport;
