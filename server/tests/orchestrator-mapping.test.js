import { describe, it, expect } from 'vitest';
import SovereignOrchestrator from '../src/agent/orchestrator/SovereignOrchestrator.js';

describe('orchestrator intent mapping', () => {
  it('routes social_chit_chat to fast social path without executing planner', async () => {
    const orchestrator = new SovereignOrchestrator({});
    
    // Simulate what the router does when receiving social_chit_chat intent
    const result = await orchestrator.orchestrate("on peut discuter ?", [], { intent: "social_chit_chat" });
    
    // The fast path should return the direct string immediately, not an object with rawResponse
    expect(result).toBe("Oui bien sûr, on discute de quoi ?");
  });

  it('verifies that social_chit_chat is recognized by the intent classifier integration', () => {
    const orchestrator = new SovereignOrchestrator({});
    
    const intent = orchestrator._classifyIntent("on peut discuter ?");
    expect(intent).toBe("social_chit_chat");
  });
});
