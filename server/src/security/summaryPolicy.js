
/**
 * SummaryPolicy - L'interprète conceptuel de l'Assistant Nexxus.
 * Transforme les métadonnées techniques en résumés architecturaux sûrs.
 */
class SummaryPolicy {
  /**
   * Génère un résumé pour un chunk de la zone SENSITIVE-INTERNAL
   */
  generateSensitiveSummary(chunk) {
    const meta = chunk.metadata || chunk;
    const { kind, symbol, path, tags, relations, security } = meta;
    
    const role = this.determineRole(kind, tags);
    const impact = this.assessImpact(path, tags);
    const dependencies = relations?.imports?.length > 0 
      ? `Ce module interagit avec : ${relations.imports.join(', ')}.` 
      : "Ce module opère de manière autonome au sein de sa division.";

    return `
[FICHE STRUCTURELLE SÉCURISÉE]
- COMPOSANT : ${symbol || path}
- RÔLE : ${role}
- CONTEXTE : ${dependencies}
- RISQUE : Une modification de ce module peut altérer ${impact}.
- POLITIQUE : L'implémentation brute est scellée pour préserver l'intégrité du noyau.
    `.trim();
  }

  determineRole(kind, tags) {
    if (kind === 'route') return "Point d'entrée de communication (API/Streaming).";
    
    // Protection contre tags indéfinis
    const safeTags = Array.isArray(tags) ? tags : [];
    
    if (kind === 'class' || kind === 'function') {
      if (safeTags.includes('routing')) return "Orchestrateur de flux et aiguillage des requêtes.";
      if (safeTags.includes('security')) return "Sentinelle de validation et de protection.";
      if (safeTags.includes('memory')) return "Gestionnaire de la persistance et du contexte.";
      return "Logique de traitement interne spécialisée.";
    }
    return "Composant de configuration ou de structure.";
  }

  assessImpact(path, tags) {
    // Protection contre path indéfini
    if (typeof path !== 'string') return "la stabilité générale du pipeline d'exécution";
    
    const lowerPath = path.toLowerCase();
    if (lowerPath.includes('router')) return "la navigation logique et la distribution des tâches aux experts";
    if (lowerPath.includes('security')) return "le bouclier de protection contre les injections et la fuite de données";
    if (lowerPath.includes('memory')) return "la continuité conversationnelle et l'historique des projets";
    if (lowerPath.includes('prompt')) return "l'identité fondamentale et le comportement de l'assistant";
    return "la stabilité générale du pipeline d'exécution";
  }

  /**
   * Résumé pour la zone SEALED-CORE (encore plus abstrait)
   */
  generateSealedSummary(path) {
    return `Ce module fait partie du [SEALED-CORE]. Il définit les constantes de sécurité, les politiques de souveraineté et les protections anti-subversion de La Citadelle. Son accès est strictement restreint au niveau conceptuel.`;
  }
}

export default new SummaryPolicy();
