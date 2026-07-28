import ollama from '../../../../server/src/llm/ollama.js';
import {
  enforceModeContract,
  getModeSystemPrompt,
  RESPONSE_MODES,
} from '../../../../server/src/agent/config/modeResponseContracts.js';
import { buildMicroContractDirective } from '../../../../server/src/agent/micro/parsing/surfaceMicroContract.js';

/**
 * Sequential Consensus Module — Mode Haute Fidélité
 * Pipeline séquentiel : Generator (x2) → Critic → Chairman
 * Conforme à la doctrine La Citadelle : max 2 agents actifs, orchestration silencieuse
 */
export async function sequentialConsensus(query, context, { onStep } = {}) {
  const logs = [];
  
  try {
    // Étape 1: Generator — 2 solutions distinctes (séquentielles)
    logs.push('[SILENT] Generator: génération solution 1');
    if (onStep) onStep('⚖️ Génération de l\'hypothèse 1...', { step: 1, total: 4 });
    const systemPrompt = getModeSystemPrompt(
      RESPONSE_MODES.CRITICAL,
      `CONTEXTE URL EXTRAITE (fourni par le système, ne pas appeler fetch_url):\n${context.extractedUrls || 'Aucune URL extraite'}`,
    );

    const solution1 = await ollama.chatSafe([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query }
    ], 'deepseek-r1:8b', { temperature: 0.7 });
    
    logs.push('[SILENT] Generator: génération solution 2 (alternative)');
    if (onStep) onStep('⚖️ Génération de l\'hypothèse 2 (alternative)...', { step: 2, total: 4 });
    const solution2 = await ollama.chatSafe([
      { role: 'system', content: systemPrompt + "\n5. Propose une approche alternative et contradictoire." },
      { role: 'user', content: query }
    ], 'deepseek-r1:8b', { temperature: 0.8 });
    
    // Étape 2: Critic — Audit et sélection
    logs.push('[SILENT] Critic: audit des solutions');
    if (onStep) onStep('🔍 Audit critique en cours...', { step: 3, total: 4 });
    const critique = await ollama.chatSafe([
      { role: 'system', content: `Évalue ces solutions. Critères: ${context.criteria || 'quality, accuracy, alignment with AGENTS.md'}` },
      { role: 'user', content: `Question: ${query}\n\nSolution 1:\n${solution1}\n\nSolution 2:\n${solution2}` }
    ], 'deepseek-r1:8b', { temperature: 0.3 });
    
    // Étape 3: Chairman — Synthèse finale
    logs.push('[SILENT] Chairman: synthèse finale');
    if (onStep) onStep('📝 Synthèse finale...', { step: 4, total: 4 });
    
    const microContract = buildMicroContractDirective(query);
    
    const synthesis = await ollama.chatSafe([
      { role: 'system', content: getModeSystemPrompt(RESPONSE_MODES.CRITICAL) },
      { role: 'user', content: `Question: ${query}\n\nCritique:\n${critique}\n\nRédige la réponse finale adressée à l'utilisateur.${microContract}` }
    ], 'deepseek-r1:8b', { temperature: 0.5 });
    
    const finalResult = enforceModeContract(RESPONSE_MODES.CRITICAL, synthesis);
    
    // Logs internes uniquement (orchestration silencieuse)
    console.log('[SEQUENTIAL CONSENSUS] Orchestration terminée:', logs.length, 'étapes');
    
    return {
      result: finalResult,
      metadata: {
        mode: 'HAUTE_FIDELITÉ',
        steps: logs.length,
        critiqueIncluded: !!critique
      }
    };
  } catch (error) {
    console.error('[SEQUENTIAL CONSENSUS] Échec, fallback vers mode simple:', error.message);
    
    // Fail-closed : lève une exception contrôlée
    throw new Error(`SEQUENTIAL_CONSENSUS_FAILED: ${error.message}`);
  }
}
