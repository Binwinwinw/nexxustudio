import React from 'react';
import { GlassCard } from '@moncoachscolaire/ui-v3';

const LegacyButton = ({ label, onClick }) => {
  return (
    <GlassCard>
      <button className="bg-eduBlue hover:bg-eduGreen text-white font-bold py-2 px-4 rounded" onClick={onClick}>
        {label}
      </button>
    </GlassCard>
  );
};

export default LegacyButton;