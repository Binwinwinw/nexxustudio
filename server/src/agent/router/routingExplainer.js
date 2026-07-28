/**
 * RoutingExplainer - Le narrateur de la décision cognitive.
 * Transforme les signaux techniques en une justification auditable.
 */
class RoutingExplainer {
  /**
   * Génère l'explication structurée d'un choix de routage.
   */
  explain(decision, telemetrySnapshot, auditReport = null) {
    const { selectedExpert, rationale, confidence } = decision;
    const feedback = telemetrySnapshot.feedbackRecords || [];
    
    // 1. Analyse de l'influence de la mémoire (R->N)
    const memoryImpact = feedback.length > 0 
      ? `Adapté selon ${feedback.length} incident(s) passé(s) détecté(s).`
      : "Aucun incident historique pertinent ; routage nominal.";

    // 2. Détection des contraintes (Audit/Guard)
    let constraints = "Aucune restriction majeure.";
    if (auditReport && auditReport.verdict.riskLevel !== 'LOW') {
      constraints = `Risque ${auditReport.verdict.riskLevel} détecté. Filtrage renforcé activé.`;
    }

    // 3. Synthèse de la doctrine
    const explainableLog = {
      expert: selectedExpert,
      rationale: rationale || "Correspondance sémantique optimale.",
      constraints,
      memoryImpact,
      confidenceScore: `${(confidence || 0.85) * 100}%`,
      maturityApplied: auditReport ? `${auditReport.verdict.maturityScore}%` : "Non audité"
    };

    return explainableLog;
  }

  /**
   * Formate l'explication pour l'affichage ou les logs système.
   */
  formatForOutput(explanation) {
    return [
      `🤖 EXPLICABILITÉ DU ROUTAGE :`,
      `   ├─ EXPERT : ${explanation.expert}`,
      `   ├─ RAISON : ${explanation.rationale}`,
      `   ├─ MÉMOIRE : ${explanation.memoryImpact}`,
      `   └─ CONFIANCE : ${explanation.confidenceScore}`
    ].join('\n');
  }
}

export default new RoutingExplainer();
