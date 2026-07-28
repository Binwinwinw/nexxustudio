/* server/src/agent/stages/RoutingStage.js */
import expertRouter from "../router/expertRouter.js";
import { AGENT_ROLES, MODEL_NATURE, getModelNature } from "../policies/agentRolePolicy.js";
import turnTelemetry from "../telemetry/turnTelemetry.js";
import { OTEL_ATTRIBUTES } from '../telemetry/otelSemanticMap.js';

export class RoutingStage {
  static async run(query, { onStep, projectState, isSocial, forcedExpertKey, reasoningBudget, isDiscussion, excludeExpertKeys = [] }) {
    const phase = projectState?.current_phase || "DISCOVERY";
    const score = projectState?.metrics?.score || 0;
    const excluded = new Set(
      (Array.isArray(excludeExpertKeys) ? excludeExpertKeys : [])
        .map((k) => String(k || "").trim())
        .filter(Boolean),
    );

    let expertMatches = [];
    let bestModel = AGENT_ROLES.ORCHESTRATOR;

    if (!isSocial && !forcedExpertKey) {
      if (onStep) onStep("📑 Hub [Planner]: Breaking down the task...");
      let identifiedExperts = await expertRouter.identify(query, onStep);
      identifiedExperts = identifiedExperts.filter((e) => e?.expert?.key);
      identifiedExperts = identifiedExperts.filter(
        (e) => !excluded.has(e.expert.key),
      );

      // Filtrage par phase (simplifié ici pour la modularité)
      // Note: On pourrait déléguer ce filtrage à expertRouter lui-même
      
      const { experts, explanation } = await expertRouter.cognitiveIdentify(query, identifiedExperts, onStep);
      expertMatches = (experts || []).filter(
        (m) => m?.expert?.key && !excluded.has(m.expert.key),
      );
      
      if (explanation) turnTelemetry.setMetric('routing_explanation', explanation);
      if (expertMatches.length > 0 && onStep) {
        onStep(`🎖️ Hub [Agents]: Specialized advisors aligned (${expertMatches.map(m => m.expert.name).join(", ")}).`);
      } else if (excluded.size > 0 && onStep) {
        onStep(
          `🎖️ Hub [Agents]: aucun advisor externe (exclus: ${[...excluded].join(", ")}).`,
        );
      }
    } else if (forcedExpertKey) {
      const forced = await expertRouter.getExpertByKey(forcedExpertKey, onStep);
      if (forced) {
        expertMatches = [{ expert: forced, score: 1.0 }];
        if (onStep) onStep(`🧠 Hub [Agents]: Expert forced [${forced.name}].`);
      }
    }

    // Sélection du modèle
    const topExpert = expertMatches[0]?.expert;
    if (reasoningBudget >= 3) {
      bestModel = AGENT_ROLES.FORGE_REASONER;
    } else if (reasoningBudget === 1 || isSocial) {
      bestModel = AGENT_ROLES.CHAT;
    } else {
      bestModel = topExpert?.model || AGENT_ROLES.CHAT;
    }

    turnTelemetry.setMetric('assignedModel', bestModel);
    
    return { expertMatches, bestModel, topExpert };
  }
}
