import ollama from '../../../../server/src/llm/ollama.js';
import {
  enforceModeContract,
  getModeSystemPrompt,
  getSimpleFactualSystemPrompt,
  getHowToProceduralSystemPrompt,
  getDebugDiagnosticSystemPrompt,
  RESPONSE_MODES,
} from '../../../../server/src/agent/config/modeResponseContracts.js';
import { enforceHowToProceduralDirectness } from '../../../../server/src/agent/policies/howToQualificationPolicy.js';
import {
  buildSimpleFactualSystemAddon,
  finalizeSimpleFactualAnswer,
  resolveLocalSimpleFactualAnswer,
  enforceSimpleFactualDirectness,
} from '../../../../server/src/agent/micro/replies/simpleFactualComposer.js';
import {
  buildDebugDiagnosticSystemAddon,
  enforceDebugDiagnosticDirectness,
} from '../../../../server/src/agent/micro/replies/debugDiagnosticComposer.js';

/**
 * Simple Fast Module
 * Mode léger (1 passe) pour les questions simples
 */
export async function simpleFast(query, context, { onStep } = {}) {
  try {
    if (onStep) onStep('⚡ Mode Rapide: Traitement de votre demande...', { step: 1, total: 1 });

    const simpleFactual = Boolean(context?.simpleFactual);
    const howToProcedural = Boolean(context?.howToProcedural);
    const debugDiagnostic = Boolean(context?.debugDiagnostic);
    const pedagogicalOverview = Boolean(context?.pedagogicalOverview);
    const guidedCreationScoping = Boolean(context?.guidedCreationScoping);
    const generalKnowledge = Boolean(context?.generalKnowledge);
    const culturalContentSummary = Boolean(context?.culturalContentSummary);
    const documentSynthesis = Boolean(context?.documentSynthesis);
    const summaryExecutionMode = context?.summaryExecutionMode || null;
    const analyticalCritique = Boolean(context?.analyticalCritique);
    const multiSegment = Boolean(context?.segmentPlan?.shouldDeferToPipeline);

    if (simpleFactual) {
      const local = resolveLocalSimpleFactualAnswer(query);
      if (local) {
        console.log('[SIMPLE FAST] Fiche locale simple factuelle.');
        return {
          result: local,
          metadata: {
            mode: 'SIMPLE_FACTUAL',
            steps: 0,
            source: 'local_fiche',
          },
        };
      }
    }

    const metaHint = String(context?.metaReflectiveHint || "").trim();
    const factualAddon = simpleFactual ? buildSimpleFactualSystemAddon(query) : "";
    const diagnosticAddon = debugDiagnostic ? buildDebugDiagnosticSystemAddon(query) : "";
    const reflectiveHint = [metaHint, factualAddon, diagnosticAddon].filter(Boolean).join("\n\n");
    const translation = Boolean(context?.translation);
    const translationLanguageCount = Number(context?.translationLanguageCount) || 1;

    const baseMode = howToProcedural
      ? RESPONSE_MODES.HOW_TO_PROCEDURAL
      : translation
      ? RESPONSE_MODES.TRANSLATION
      : debugDiagnostic
        ? RESPONSE_MODES.DEBUG_DIAGNOSTIC
        : analyticalCritique || pedagogicalOverview || guidedCreationScoping || culturalContentSummary || documentSynthesis
        ? RESPONSE_MODES.OPEN_PROPOSITION
        : simpleFactual
          ? RESPONSE_MODES.SIMPLE_FACTUAL
          : RESPONSE_MODES.SIMPLE_FAST;

    const systemPrompt = howToProcedural
      ? getHowToProceduralSystemPrompt(reflectiveHint)
      : debugDiagnostic
        ? getDebugDiagnosticSystemPrompt(reflectiveHint)
      : simpleFactual
      ? getSimpleFactualSystemPrompt(reflectiveHint)
      : translation
        ? getModeSystemPrompt(baseMode)
        : reflectiveHint
          ? `${getModeSystemPrompt(baseMode)}\n\n${reflectiveHint}`
          : getModeSystemPrompt(baseMode);

    const raw = await ollama.chat(
      [
        {
          role: 'system',
          content: systemPrompt,
        },
        { role: 'user', content: query },
      ],
      'deepseek-r1:8b',
      {
        temperature: 0.35,
        num_predict: howToProcedural
          ? 480
          : debugDiagnostic
            ? 480
          : translation
          ? Math.min(640, 120 + translationLanguageCount * 110)
          : analyticalCritique
            ? 420
            : guidedCreationScoping
              ? 420
            : culturalContentSummary
              ? 200
            : documentSynthesis
              ? summaryExecutionMode === "web"
                ? 520
                : 500
            : pedagogicalOverview
              ? 320
              : multiSegment
                ? 280
                : 150,
      },
    );

    let response = enforceModeContract(baseMode, raw, {
      allowRefusal: !(
        simpleFactual ||
        translation ||
        reflectiveHint ||
        howToProcedural ||
        debugDiagnostic ||
        analyticalCritique ||
        pedagogicalOverview ||
        guidedCreationScoping ||
        culturalContentSummary ||
        documentSynthesis ||
        generalKnowledge
      ),
      howToProcedural,
      debugDiagnostic,
    });

    if (howToProcedural) {
      response = enforceHowToProceduralDirectness(response, query);
    }

    if (simpleFactual) {
      response = finalizeSimpleFactualAnswer(response, query);
      response = enforceSimpleFactualDirectness(response, query);
    }

    if (debugDiagnostic) {
      response = enforceDebugDiagnosticDirectness(response, query);
    }

    console.log('[SIMPLE FAST] Requête courte traitée en 1 passe.');

    return {
      result: response,
      metadata: {
        mode: howToProcedural
          ? 'HOW_TO_PROCEDURAL'
          : debugDiagnostic
            ? 'DEBUG_DIAGNOSTIC'
          : translation
            ? 'TRANSLATION'
            : simpleFactual
              ? 'SIMPLE_FACTUAL'
              : 'SIMPLE_FAST',
        steps: 1,
      },
    };
  } catch (error) {
    console.error('[SIMPLE FAST] Échec:', error.message);
    throw new Error(`SIMPLE_FAST_FAILED: ${error.message}`);
  }
}
