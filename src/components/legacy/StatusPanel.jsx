/* src/components/legacy/StatusPanel.jsx */
import React from 'react';
import { GlassCard } from '../GlassCard';
import { AlertCircle, CheckCircle } from 'lucide-react';

/**
 * StatusPanel - Composant de retour d'état système.
 * Refactoré par Sentinel : Migration vers GlassCard + Tailwind + Lucide Icons.
 */
const StatusPanel = ({ status, message }) => {
  const isError = status === 'error';

  return (
    <GlassCard 
      className={`border-l-4 ${isError ? 'border-red-500 bg-red-500/5' : 'border-emerald-500 bg-emerald-500/5'}`}
    >
      <div className="flex items-start gap-4">
        <div className={`mt-1 ${isError ? 'text-red-400' : 'text-emerald-400'}`}>
          {isError ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
        </div>
        <div>
          <h4 className={`text-xs font-black uppercase tracking-widest mb-1 ${isError ? 'text-red-300' : 'text-emerald-300'}`}>
            {isError ? 'Échec de Souveraineté' : 'Intégrité Confirmée'}
          </h4>
          <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
            {message || 'Aucun message de statut disponible.'}
          </p>
        </div>
      </div>
    </GlassCard>
  );
};

export default StatusPanel;
