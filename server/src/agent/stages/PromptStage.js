/* server/src/agent/stages/PromptStage.js */
import { buildSystemPrompt } from "../prompts/systemPromptBuilder.js";
import controlHarness from "../harness/controlHarness.js";
import skillLoader from "../utils/skillLoader.js";
import { getModelNature, MODEL_NATURE } from "../policies/core/index.js";
import turnTelemetry from "../telemetry/turnTelemetry.js";
import { OTEL_ATTRIBUTES, SPAN_NAMES } from '../telemetry/otelSemanticMap.js';

export class PromptStage {
  static async run(query, { 
    expertMatches, 
    isDiscussion, 
    projectState, 
    briefing, 
    userProfile, 
    bestModel, 
    longFormEnabled, 
    cavemanLevel, 
    isSocial,
    isIdeation,
    memoryContext,
    visionData,
    contextData,
    isContinuationSignal,
    onStep,
    intentContractId = null,
  }) {
    const score = projectState?.metrics?.score || 0;
    const phase = projectState?.current_phase || "DISCOVERY";

    // Chargement du Skill
    let activeSkill = null;
    const skillId = await skillLoader.identifyRelevantSkill(query, {
      intentContractId,
    });
    if (skillId) {
      activeSkill = await skillLoader.loadSkill(skillId);
      if (activeSkill && onStep) {
        onStep(`🧠 Skill activé : ${activeSkill.name}`);
      }
      turnTelemetry.setMetric(OTEL_ATTRIBUTES.SKILLS_COUNT, 1);
    } else {
      turnTelemetry.setMetric(OTEL_ATTRIBUTES.SKILLS_COUNT, 0);
    }

    // Si l'utilisateur fait une demande d'idéation, injecter le mode IDEATION
    // en surchargeant le styleMode habituel (qui viendrait de l'expert).
    const styleOverride = isIdeation ? 'IDEATION' : null;

    turnTelemetry.startSpan(SPAN_NAMES.PROMPT);
    let systemPrompt = buildSystemPrompt(
      expertMatches,
      isDiscussion,
      { isDiscovery: phase === 'DISCOVERY', isValidation: phase === 'VALIDATION', score },
      "BALANCED",
      briefing,
      userProfile,
      getModelNature(bestModel) === MODEL_NATURE.THINKER,
      longFormEnabled,
      activeSkill,
      cavemanLevel,
      isSocial,
      styleOverride,
      query,
    );

    systemPrompt += controlHarness.getRealityAnchor() + memoryContext + (visionData?.briefing || "") + (contextData?.briefing || "");

    if (isContinuationSignal) {
      systemPrompt += "\n\n⚠️ [PROTOCOLE CONTINUATION ACTIVÉ] : Reprenez EXACTEMENT là où vous vous êtes arrêté.";
    }

    turnTelemetry.endSpan(SPAN_NAMES.PROMPT);

    return { systemPrompt, activeSkill };
  }
}
