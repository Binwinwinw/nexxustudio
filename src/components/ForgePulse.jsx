/* src/components/ForgePulse.jsx */
import React from 'react';
import { User, Shield, FileCode, Search, Brain } from 'lucide-react';
import './ForgePulse.css';

const EXPERTS = [
  { id: 'expert_pm', label: 'Analyse', icon: <Search size={20} />, title: 'Product Manager' },
  { id: 'expert_architect', label: 'Plan', icon: <Brain size={20} />, title: 'Architecte' },
  { id: 'expert_developer', label: 'Code', icon: <FileCode size={20} />, title: 'Développeur' },
  { id: 'expert_qa', label: 'Audit', icon: <Shield size={20} />, title: 'QA Engineer' }
];

const ForgePulse = ({ currentPhase }) => {
  return (
    <div className="forge-pulse-container animate-in fade-in zoom-in duration-700">
      {EXPERTS.map((expert, index) => (
        <React.Fragment key={expert.id}>
          <div 
            className={`expert-node ${currentPhase === expert.id ? 'active' : ''}`}
            data-expert={expert.id}
          >
            <div className="expert-avatar" title={expert.title}>
              {expert.icon}
              {currentPhase === expert.id && (
                 <div className="absolute inset-0 rounded-xl animate-ping border border-current opacity-20" />
              )}
            </div>
            <span className="expert-label">{expert.label}</span>
          </div>
          
          {index < EXPERTS.length - 1 && (
            <div className="forge-flow-line" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default ForgePulse;
