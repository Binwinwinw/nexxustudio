import knowledgeService from './knowledgeService.js';
import { memoryOrchestrator } from '../memory/MemoryOrchestrator.js';

/**
 * VaultConsultant
 * Utilitaire spécialisé pour extraire la "Vérité de Long Terme" du Vault Obsidian.
 * Précédents patrimoniaux : Knowledge Hub / Chroma (ADR-20260705 Option B).
 */
export class VaultConsultant {
  /**
   * Récupère les règles de gouvernance (ADR) pertinentes pour un sujet.
   */
  async consultGovernance(topic) {
    console.log(`[VaultConsultant] 🔍 Consultation de la gouvernance pour : ${topic}`);
    const context = await knowledgeService.resolveGovernedContext(topic);

    if (context.type === 'none' || context.type === 'governed_missing') {
      return [];
    }

    return [{
      id: context.topic.id,
      content: context.document,
      path: context.topic.fileName
    }];
  }

  /**
   * Cherche des précédents via Knowledge Hub / heritage (pas projectLibrary).
   */
  async consultPrecedents(intent) {
    console.log(`[VaultConsultant] 📜 Recherche d'héritage gouverné : ${intent}`);
    const memory = await memoryOrchestrator.getRelevantMemory(intent, { scope: 'heritage' });

    const fromSemantic = (memory.semanticMatches || []).map(m => ({
      projectName: m.metadata?.project || m.metadata?.source || 'knowledge',
      description: (m.text || '').substring(0, 200),
      files: m.metadata?.path || ''
    }));

    const fromEpisodic = (memory.episodicRecall || []).map(m => ({
      projectName: m.metadata?.project || 'episodic',
      description: (m.text || '').substring(0, 200),
      files: m.metadata?.path || ''
    }));

    return [...fromSemantic, ...fromEpisodic].slice(0, 3);
  }

  /**
   * Vérifie si un projet ou un domaine existe dans l'héritage indexé.
   */
  async verifyExistence(term) {
    const memory = await memoryOrchestrator.getRelevantMemory(term, { scope: 'heritage' });
    const matches = [...(memory.semanticMatches || []), ...(memory.episodicRecall || [])];
    const termLower = term.toLowerCase();
    const exactMatch = matches.find(
      m => (m.metadata?.project || '').toLowerCase() === termLower
    );

    return {
      exists: matches.length > 0,
      exactMatch: Boolean(exactMatch),
      projectName: exactMatch?.metadata?.project || matches[0]?.metadata?.project || null
    };
  }

  /**
   * Prépare le "Context Bundle" pour le Blueprint Generator.
   */
  async prepareGrounding(intent) {
    const [gov, history] = await Promise.all([
      this.consultGovernance(intent),
      this.consultPrecedents(intent)
    ]);

    return {
      verified_precedents: history,
      governance_constraints: gov,
      timestamp: new Date().toISOString()
    };
  }
}

export const vaultConsultant = new VaultConsultant();
