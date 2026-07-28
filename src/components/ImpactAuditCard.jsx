
import React from 'react';
import { AlertTriangle, Shield, CheckCircle, FileCode, Layers, Activity } from 'lucide-react';

const ImpactAuditCard = ({ report }) => {
  if (!report) return null;

  const getLevelColor = (level) => {
    switch (level) {
      case 'CRITIQUE': return 'text-red-500 border-red-500/30 bg-red-500/5';
      case 'HAUTE': return 'text-amber-500 border-amber-500/30 bg-amber-500/5';
      default: return 'text-emerald-500 border-emerald-500/30 bg-emerald-500/5';
    }
  };

  const getLevelIcon = (level) => {
    switch (level) {
      case 'CRITIQUE': return <AlertTriangle className="text-red-500" size={20} />;
      case 'HAUTE': return <Shield className="text-amber-500" size={20} />;
      default: return <CheckCircle className="text-emerald-500" size={20} />;
    }
  };

  return (
    <div className={`p-6 rounded-2xl border backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-500 ${getLevelColor(report.level)}`}>
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          {getLevelIcon(report.level)}
          <div>
            <h3 className="font-black tracking-widest uppercase text-xs">Rapport d'Impact Sécurisé</h3>
            <p className="text-[10px] opacity-70 font-mono">{report.target}</p>
          </div>
        </div>
        <span className="px-3 py-1 rounded-full text-[9px] font-black tracking-tighter border border-current uppercase">
          Niveau : {report.level}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Zones Impactées */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase opacity-80">
            <Layers size={14} /> Zones de Souveraineté
          </div>
          <div className="flex flex-wrap gap-2">
            {report.zones.map(zone => (
              <span key={zone} className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-mono">
                {zone}
              </span>
            ))}
          </div>
        </div>

        {/* Modules Dépendants */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase opacity-80">
            <Activity size={14} /> Propagation Probable
          </div>
          <div className="text-[10px] space-y-1">
            {report.affectedModules.length > 0 ? (
              report.affectedModules.map(mod => (
                <div key={mod} className="flex items-center gap-2 opacity-70">
                  <FileCode size={10} /> {mod}
                </div>
              ))
            ) : (
              <span className="italic opacity-50 italic">Aucune propagation directe détectée.</span>
            )}
          </div>
        </div>
      </div>

      {/* Risques et Recommandations */}
      <div className="mt-6 pt-6 border-t border-white/10 space-y-4">
        <div>
          <h4 className="text-[10px] font-black uppercase tracking-widest mb-2 opacity-60">Analyse de Risque</h4>
          <ul className="text-xs space-y-1 list-disc list-inside opacity-90">
            {report.risks.map((risk, i) => <li key={i}>{risk}</li>)}
          </ul>
        </div>
        
        <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-[10px] italic leading-relaxed">
          <span className="font-bold uppercase not-italic mr-2">Nexxus :</span>
          {report.recommendation}
        </div>
      </div>
    </div>
  );
};

export default ImpactAuditCard;
