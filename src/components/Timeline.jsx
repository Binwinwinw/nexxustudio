/* src/components/Timeline.jsx */
import React from 'react';
import { Briefcase, Layout, Code2, ShieldCheck } from 'lucide-react';

const phases = [
  { id: 'expert_pm', label: 'Analyse (PM)', Icon: Briefcase },
  { id: 'expert_architect', label: 'Plan (Architecte)', Icon: Layout },
  { id: 'expert_developer', label: 'Code (Dev)', Icon: Code2 },
  { id: 'expert_qa', label: 'Audit (QA)', Icon: ShieldCheck },
];

const Timeline = ({ currentPhase, completedPhases = [] }) => {
  return (
    <div className="flex justify-between items-center w-full max-w-5xl mx-auto px-8 py-2 overflow-x-auto nexxus-scroll">
      {phases.map((phase, index) => {
        const isActive = currentPhase === phase.id;
        const isDone = completedPhases.includes(phase.id);
        const { Icon } = phase;

        return (
          <React.Fragment key={phase.id}>
            <div 
              className={`flex items-center gap-4 transition-all duration-700 ${
                isActive ? 'opacity-100' : (isDone ? 'opacity-90' : 'opacity-30')
              }`}
            >
              <div 
                className={`w-12 h-12 rounded-xl flex items-center justify-center border-2 transition-all duration-500 relative
                  ${isDone ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'border-white/10 bg-black/40'}
                  ${isActive ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_25px_rgba(59,130,246,0.3)]' : ''}
                `}
              >
                <Icon size={20} className={isActive ? 'animate-pulse text-blue-400' : ''} />
                
                {isActive && (
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-slate-950 animate-ping" />
                )}
              </div>
              <div className="flex flex-col">
                <span className={`text-[9px] font-black tracking-widest uppercase transition-all duration-300 ${isActive ? 'text-blue-400' : (isDone ? 'text-emerald-400' : 'text-slate-500')}`}>
                  {phase.label}
                </span>
                <span className={`text-[7px] font-bold uppercase tracking-tighter ${isActive ? 'text-blue-300/60' : 'text-slate-600'}`}>
                  {isActive ? 'Active Task' : (isDone ? 'Validated' : 'Pending')}
                </span>
              </div>
            </div>
            {index < phases.length - 1 && (
              <div className="flex-1 mx-4 h-0.5 relative min-w-[40px]">
                <div className="absolute inset-0 bg-white/5 rounded-full" />
                <div 
                  className={`absolute inset-0 transition-all duration-1000 rounded-full ${
                    isDone ? 'bg-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-transparent'
                  }`} 
                  style={{ width: isDone ? '100%' : '0%' }}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default Timeline;
