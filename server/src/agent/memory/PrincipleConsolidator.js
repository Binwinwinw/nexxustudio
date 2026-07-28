import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEMORY_ROOT = path.resolve(__dirname, '../../../../server/data/memory');

export class PrincipleConsolidator {
  constructor(threshold = 3) {
    this.threshold = threshold;
  }

  /**
   * Analyse les épisodes pour détecter des récurrences
   */
  async analyzeEpisodes() {
    const episodicDir = path.join(MEMORY_ROOT, 'episodic');
    const files = await fs.readdir(episodicDir);
    const patternCounter = {};
    const episodesByPattern = {};

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const ep = JSON.parse(await fs.readFile(path.join(episodicDir, file), 'utf-8'));
      
      const pattern = ep.validationResult || 'unknown';
      patternCounter[pattern] = (patternCounter[pattern] || 0) + 1;
      
      if (!episodesByPattern[pattern]) episodesByPattern[pattern] = [];
      episodesByPattern[pattern].push(ep.id);
    }

    const proposals = [];
    for (const [pattern, count] of Object.entries(patternCounter)) {
      if (count >= this.threshold && pattern !== 'unknown') {
        proposals.push({
          pattern,
          count,
          sources: episodesByPattern[pattern]
        });
      }
    }

    return proposals;
  }

  /**
   * Génère une proposition de principe
   */
  async proposePrinciple(proposal) {
    const nextIndex = await this.getNextIndex();
    const prId = `PR-${nextIndex.toString().padStart(3, '0')}`;
    const fileName = `${prId}_AUTO_PROPOSAL_${proposal.pattern}.json`;
    const prPath = path.join(MEMORY_ROOT, 'procedural', fileName);

    const principle = {
      id: prId,
      title: `Protection Automatique contre ${proposal.pattern}`,
      description: `Règle de sécurité générée par récurrence d'incidents (${proposal.count} occurrences).`,
      guidelines: [
        `Détection systématique du motif ${proposal.pattern}.`,
        `Blocage ou surveillance accrue lors des phases critiques.`,
        `Journalisation obligatoire dans drafts/ pour audit.`
      ],
      source_incidents: proposal.sources,
      createdAt: new Date().toISOString(),
      status: 'proposed', // Nécessite une validation humaine
      confidence: 0.85
    };

    await fs.writeFile(prPath, JSON.stringify(principle, null, 2));
    return prId;
  }

  async getNextIndex() {
    const files = await fs.readdir(path.join(MEMORY_ROOT, 'procedural'));
    const indices = files
      .map(f => parseInt(f.match(/PR-(\d+)/)?.[1] || '0'))
      .filter(n => n > 0);
    return indices.length > 0 ? Math.max(...indices) + 1 : 10;
  }
}

export const principleConsolidator = new PrincipleConsolidator();
