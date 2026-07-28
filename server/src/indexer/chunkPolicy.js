
/**
 * ChunkPolicy - Le gardien des secrets de l'Assistant Nexxus.
 * Définit la sensibilité des zones du workspace.
 */
class ChunkPolicy {
  getSecurityMetadata(filePath) {
    const normalized = filePath.replace(/\\/g, '/');

    // SEALED-CORE: Le noyau atomique
    if (
      normalized.includes('server/src/security/') ||
      normalized.includes('server/src/agent/harness/injectionRadar.js') ||
      normalized.includes('server/src/agent/policies/') ||
      normalized.includes('.env')
    ) {
      return {
        zone: 'sealed-core',
        sensitivity: 'critical',
        exposable: false
      };
    }

    // SENSITIVE-INTERNAL: Les prompts et le routage
    if (
      normalized.includes('server/src/agent/prompts/') ||
      normalized.includes('server/src/agent/router/') ||
      normalized.includes('server/src/agent/agentPipeline.js') ||
      normalized.includes('server/data/memory/procedural/')
    ) {
      return {
        zone: 'sensitive-internal',
        sensitivity: 'high',
        exposable: false // On préfère des résumés abstraits
      };
    }

    // PROJECT-CODE: Le code métier
    if (normalized.startsWith('src/') || normalized.startsWith('server/src/')) {
      return {
        zone: 'project-code',
        sensitivity: 'medium',
        exposable: true
      };
    }

    // PUBLIC-DOCS
    if (normalized.endsWith('.md') || normalized.startsWith('docs/')) {
      return {
        zone: 'public-docs',
        sensitivity: 'low',
        exposable: true
      };
    }

    return {
      zone: 'general',
      sensitivity: 'low',
      exposable: true
    };
  }

  /**
   * Enrichit un chunk avec les métadonnées de sécurité et de contexte
   */
  enrich(chunk) {
    const security = this.getSecurityMetadata(chunk.path);
    return {
      ...chunk,
      security,
      hash: this.generateChunkHash(chunk.text),
      tags: this.generateTags(chunk),
      relations: this.extractRelations(chunk)
    };
  }

  generateChunkHash(text) {
    // Hash simplifié pour les chunks
    return text.length + '-' + text.substring(0, 20).replace(/\s/g, '');
  }

  generateTags(chunk) {
    const tags = [chunk.kind, chunk.language || 'code'];
    if (chunk.symbol) tags.push(chunk.symbol);
    return [...new Set(tags)];
  }

  extractRelations(chunk) {
    const relations = { imports: [], calls: [] };
    if (chunk.kind === 'function' || chunk.kind === 'class') {
      // Extraction très basique des dépendances
      const importMatches = chunk.text.match(/import\s+.*\s+from\s+['"]([^'"]+)['"]/g);
      if (importMatches) {
        relations.imports = importMatches.map(m => m.split(/['"]/)[1]);
      }
    }
    return relations;
  }
}

export default new ChunkPolicy();
