/* server/src/agent/stages/SecurityStage.js */
import queryGuard from "../../security/queryGuard.js";
import * as injectionRadar from "../harness/injectionRadar.js";
import { memoryOrchestrator } from "../memory/MemoryOrchestrator.js";

export class SecurityStage {
  static async run(query, { onStep }) {
    // 1. Analyse de risque de la requête
    const queryRisk = queryGuard.classify(query);
    if (queryRisk.level === 'DENY') {
      if (onStep) onStep("🛡️ SÉCURITÉ : Tentative de subversion détectée et bloquée.");
      return { 
        blocked: true, 
        reason: "🛡️ SÉCURITÉ : Cette requête contrevient aux protocoles de souveraineté de La Citadelle. Votre intention a été journalisée dans les archives de sécurité." 
      };
    }

    // 2. Scan de Prompt Injection
    const radarResult = injectionRadar.scan(query);
    if (radarResult.isAttack) {
      await memoryOrchestrator.recordIncident({
        trigger: query,
        scope: 'security',
        validationResult: `injection_detected_${radarResult.matchedPatterns.join('_')}`,
        evidenceLogs: `Risk Score: ${radarResult.riskScore} | Action: ${radarResult.action}`,
        finalOutcome: radarResult.action
      });

      if (radarResult.action === 'block') {
        if (onStep) onStep("🛡️ SÉCURITÉ : Tentative d'injection bloquée.");
        return { 
          blocked: true, 
          reason: "🛡️ SÉCURITÉ : Ta requête a été interceptée par le bouclier souverain Nexxus. Toute tentative de subversion est journalisée. Reformule ta demande de manière légitime." 
        };
      }
    }

    return { blocked: false, queryRisk, radarResult };
  }
}
