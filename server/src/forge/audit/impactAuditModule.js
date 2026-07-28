import ImpactAnalyzer from '../../security/impactAnalyzer.js';
import retrievalGuard from '../../security/retrievalGuard.js';
import knowledgeHub from '../../services/knowledgeHub.js';
import telemetryPersistor from '../../agent/telemetry/telemetryPersistor.js';
import turnTelemetry from '../../agent/telemetry/turnTelemetry.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.resolve(__dirname, '../../../cache/workspace_index.json');
const impactAnalyzer = new ImpactAnalyzer(indexPath);

/**
 * ImpactAuditModule - Le premier module de la Forge.
 * Transforme une intention en un plan d'action sécurisé et documenté.
 */
class ImpactAuditModule {
  /**
   * Exécute un audit complet avant de donner le feu vert à la Forge.
   */
  async runAudit(request, currentMaturityScore = 0) {
    console.log(`[Forge][ImpactAudit] Starting audit for request: "${request.substring(0, 50)}..."`);
    turnTelemetry.markLayer('FORGE_AUDIT');

    // 1. CIBLAGE SÉMANTIQUE : Quels fichiers sont concernés ?
    let targetFiles = [];
    try {
      const candidates = await knowledgeHub.query(request, 5); // Plus de candidats pour augmenter la précision
      targetFiles = [...new Set(candidates.map(c => {
        // On cherche le chemin dans les métadonnées
        return c.metadata?.path || c.metadata?.source || null;
      }).filter(Boolean))];
    } catch (e) {
      console.warn("[Forge][ImpactAudit] Semantic targeting failed.");
    }

    // 2. RÉCUPÉRATION DU FEEDBACK (R -> N)
    let performanceHistory = [];
    try {
      performanceHistory = await knowledgeHub.query(request, 3, { type: 'telemetry_feedback' });
      console.log(`[Forge][ImpactAudit] Debug History:`, JSON.stringify(performanceHistory));
    } catch (e) {
      console.warn("[Forge][ImpactAudit] Failed to fetch feedback history.");
    }

    // 3. ANALYSE D'IMPACT (Sécurité & Risque)
    let riskScore = 0;
    let securityZones = [];
    
    for (const file of targetFiles) {
      const analysis = await impactAnalyzer.analyze(file);
      if (!analysis.error) {
        riskScore = Math.max(riskScore, analysis.level === 'CRITIQUE' ? 90 : (analysis.level === 'HAUTE' ? 60 : 20));
        securityZones = [...new Set([...securityZones, ...(analysis.zones || [])])];
      }
    }
    
    // Si aucun fichier trouvé, risque par défaut basé sur les mots-clés
    if (targetFiles.length === 0) {
      riskScore = request.toLowerCase().includes('auth') || request.toLowerCase().includes('config') ? 50 : 10;
    }

    // 4. VÉRIFICATION DE LA MATURITÉ DYNAMIQUE
    const riskLevel = riskScore > 70 ? 'CRITICAL' : (riskScore > 30 ? 'MODERATE' : 'LOW');
    const maturityThreshold = riskLevel === 'CRITICAL' ? 80 : 40;
    const isMaturityReady = currentMaturityScore >= maturityThreshold;

    // 4. RÉDACTION DU RAPPORT FORGE-READY
    const needsIndexing = targetFiles.length === 0;
    const report = {
      timestamp: new Date().toISOString(),
      intent: request,
      verdict: {
        canProceed: !needsIndexing && isMaturityReady && riskLevel !== 'CRITICAL',
        riskLevel: needsIndexing ? 'UNKNOWN' : riskLevel,
        maturityScore: currentMaturityScore,
        requiredMaturity: maturityThreshold,
        needsIndexing
      },
      insights: {
        riskScore,
        securityZones,
        targetFiles,
        feedbackIncidents: performanceHistory.length
      },
      recommendations: needsIndexing 
        ? ["⚠️ Le projet n'est pas indexé sémantiquement. L'audit d'impact ne peut pas identifier de fichiers cibles.", "👉 Stratégie recommandée : Lancez une indexation complète du répertoire avant l'audit."]
        : this.generateRecommendations(isMaturityReady, riskLevel, performanceHistory)
    };

    console.log(`[Forge][ImpactAudit] Audit complete. Verdict: ${report.verdict.canProceed ? 'READY' : 'WAIT_FOR_MATURATION'}`);
    
    return report;
  }

  generateRecommendations(isReady, risk, history) {
    const recs = [];
    if (!isReady) recs.push("❌ Maturité insuffisante : le projet nécessite plus de documentation avant la Forge.");
    if (risk === 'CRITICAL') recs.push("⚠️ Risque élevé : une revue humaine ou une décomposition de la tâche est obligatoire.");
    
    // Détection robuste des incidents passés (lenteur ou échecs de routage)
    const hasIncidentsInHistory = history.some(h => 
      (h.content && (h.content.includes('SLOW_RESPONSE') || h.content.includes('INCIDENT_DETECTED'))) || 
      (h.metadata && (h.metadata.verdict === 'SLOW_RESPONSE' || h.metadata.verdict === 'INCIDENT_DETECTED'))
    );

    if (hasIncidentsInHistory) {
      recs.push("ℹ️ Attention : des incidents ou latences ont été observés sur ce type de tâche par le passé. Prudence recommandée.");
    }
    
    if (recs.length === 0) recs.push("✅ Feu vert : le plan est cohérent et prêt pour l'industrialisation.");
    
    return recs;
  }
}

export default new ImpactAuditModule();
