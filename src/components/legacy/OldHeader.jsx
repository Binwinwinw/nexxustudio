import React from 'react';
import { GlassCard } from '@moncoachscolaire/ui-v3';

const OldHeader = ({ title }) => {
  return (
    <GlassCard>
      <h1 className="text-2xl font-bold text-center">{title}</h1>
    </GlassCard>
  );
};

export default OldHeader;