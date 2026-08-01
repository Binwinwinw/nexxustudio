/**
 * Chemin partagé SIMPLE_FAST — lot 3 (un seul passage LLM par tour).
 */
import {
  enforceModeContract,
  RESPONSE_MODES,
} from "../config/modeResponseContracts.js";
import { shouldBlockGenericInsufficientRefusal } from "../policies/posture/index.js";
import { isSimpleFactualQuestion } from "../policies/justIntentDetectionPolicy.js";
import { isPedagogicalOverviewRequest } from "../utils/pedagogicalOverviewIntentGuards.js";
import { isBeginnerTopicOverviewRequest } from "../utils/beginnerTopicOverviewIntentGuards.js";
import { isPedagogySoftOverviewRequest } from "../utils/pedagogySoftOverviewIntentGuards.js";
import { isTechnicalOverviewRequest } from "../utils/technicalOverviewIntentGuards.js";
import { isDebugDiagnosticRequest } from "../utils/debugDiagnosticIntentGuards.js";
import { isCareerLearningPathRequest } from "../utils/careerLearningPathIntentGuards.js";
import { isTechnicalLearningPathRequest } from "../utils/technicalLearningPathIntentGuards.js";
import { isPresentationOutlineRequest } from "../utils/presentationOutlineIntentGuards.js";
import { isCodeConceptExplainRequest } from "../policies/code/codeConceptExplainPolicy.js";
import {
  finalizeSimpleFactualAnswer,
  resolveLocalSimpleFactualAnswer,
} from "../micro/replies/simpleFactualComposer.js";
import { resolveLocalDeterministicFallback, resolvePipelineFallback } from "../utils/genericGreetingGuards.js";
import {
  resolveMathSimpleShortCircuit,
  resolveMathRootShortCircuit,
  resolveMathGeometryShortCircuit,
  resolveMathExplainLocalFallback,
  resolveMathPercentShortCircuit,
} from "../policies/math/index.js";
import { applySurfaceMicroContract } from "../micro/parsing/surfaceMicroContract.js";
import {
  buildTranslationReflectiveHint,
  validateMultiTargetTranslationOutput,
} from "../utils/translationRequestPlan.js";
import { enforceHowToProceduralDirectness } from "../policies/qualification/howToQualificationPolicy.js";
import { enforceSimpleFactualDirectness } from "../micro/replies/simpleFactualComposer.js";
import { enforceDebugDiagnosticDirectness } from "../micro/replies/debugDiagnosticComposer.js";

export const SIMPLE_FAST_ORIGINS = Object.freeze({
  SHORT_CIRCUIT: "short_circuit",
  WORD_GUARD: "word_guard",
});

/**
 * @param {{
 *   simpleFactual?: boolean,
 *   pedagogicalOverview?: boolean,
 *   beginnerTopicOverview?: boolean,
 *   debugDiagnostic?: boolean,
 *   query?: string,
 * }} params
 */
export function resolveSimpleFastResponseMode({
  simpleFactual = false,
  pedagogicalOverview = false,
  beginnerTopicOverview = false,
  pedagogySoftOverview = false,
  technicalOverview = false,
  codeConceptExplain = false,
  lexiconSchoolScienceExplain = false,
  pedagogicalStructuredExplain = false,
  guidedCreationScoping = false,
  debugDiagnostic = false,
  careerLearningPath = false,
  technicalLearningPath = false,
  presentationOutline = false,
  translation = false,
  howToProcedural = false,
  documentSynthesis = false,
  culturalContentSummary = false,
} = {}) {
  if (howToProcedural) return RESPONSE_MODES.HOW_TO_PROCEDURAL;
  if (translation) return RESPONSE_MODES.TRANSLATION;
  if (simpleFactual) return RESPONSE_MODES.SIMPLE_FACTUAL;
  if (debugDiagnostic) return RESPONSE_MODES.DEBUG_DIAGNOSTIC;
  if (
    pedagogicalOverview ||
    beginnerTopicOverview ||
    pedagogySoftOverview ||
    technicalOverview ||
    guidedCreationScoping ||
    careerLearningPath ||
    technicalLearningPath ||
    presentationOutline ||
    lexiconSchoolScienceExplain ||
    pedagogicalStructuredExplain ||
    documentSynthesis ||
    culturalContentSummary
  ) {
    return RESPONSE_MODES.OPEN_PROPOSITION;
  }
  return RESPONSE_MODES.SIMPLE_FAST;
}

/**
 * @param {{
 *   simpleFactual?: boolean,
 *   pedagogicalOverview?: boolean,
 *   beginnerTopicOverview?: boolean,
 * }} params
 */
export function resolveSimpleFastAllowRefusal({
  simpleFactual = false,
  pedagogicalOverview = false,
  beginnerTopicOverview = false,
  pedagogySoftOverview = false,
  technicalOverview = false,
  codeConceptExplain = false,
  lexiconExplainLight = false,
  pedagogicalStructuredExplain = false,
  guidedCreationScoping = false,
  debugDiagnostic = false,
  careerLearningPath = false,
  technicalLearningPath = false,
  presentationOutline = false,
  translation = false,
  howToProcedural = false,
  metaAssistantTrust = false,
  documentSynthesis = false,
  culturalContentSummary = false,
  query = "",
} = {}) {
  if (metaAssistantTrust) return false;
  if (documentSynthesis || culturalContentSummary) return false;
  // Définition / « tu connais X ? » déjà ancré → jamais le refus « piste/destination »
  if (codeConceptExplain || isCodeConceptExplainRequest(query)) return false;
  if (lexiconExplainLight || pedagogicalStructuredExplain) return false;
  // R1 — ancrage voix (sujet/format) même hors flags métier
  if (
    shouldBlockGenericInsufficientRefusal(query, {
      simpleFactual,
      translation,
      howToProcedural,
      debugDiagnostic,
      codeConceptExplain,
      lexiconExplainLight,
      pedagogicalStructured: pedagogicalStructuredExplain,
    })
  ) {
    return false;
  }
  return !(
    simpleFactual ||
    translation ||
    howToProcedural ||
    pedagogicalOverview ||
    beginnerTopicOverview ||
    pedagogySoftOverview ||
    technicalOverview ||
    guidedCreationScoping ||
    debugDiagnostic ||
    careerLearningPath ||
    technicalLearningPath ||
    presentationOutline ||
    documentSynthesis ||
    culturalContentSummary
  );
}

/**
 * @param {string} query
 * @param {{ simpleFactual?: boolean, pedagogicalOverview?: boolean, beginnerTopicOverview?: boolean, technicalOverview?: boolean, debugDiagnostic?: boolean }} flags
 */
export function resolveSimpleFastIntentFlags(query = "", flags = {}) {
  const simpleFactual =
    flags.simpleFactual ?? Boolean(isSimpleFactualQuestion(query));
  const pedagogicalOverview =
    flags.pedagogicalOverview ?? Boolean(isPedagogicalOverviewRequest(query));
  const beginnerTopicOverview =
    flags.beginnerTopicOverview ?? Boolean(isBeginnerTopicOverviewRequest(query));
  const pedagogySoftOverview =
    flags.pedagogySoftOverview ?? Boolean(isPedagogySoftOverviewRequest(query));
  const technicalOverview =
    flags.technicalOverview ?? Boolean(isTechnicalOverviewRequest(query));
  const debugDiagnostic =
    flags.debugDiagnostic ?? Boolean(isDebugDiagnosticRequest(query));
  const careerLearningPath =
    flags.careerLearningPath ?? Boolean(isCareerLearningPathRequest(query));
  const technicalLearningPath =
    flags.technicalLearningPath ?? Boolean(isTechnicalLearningPathRequest(query));
  const presentationOutline =
    flags.presentationOutline ?? Boolean(isPresentationOutlineRequest(query));
  const codeConceptExplain =
    flags.codeConceptExplain ?? Boolean(isCodeConceptExplainRequest(query));
  const guidedCreationScoping = Boolean(flags.guidedCreationScoping);
  return {
    simpleFactual,
    pedagogicalOverview,
    beginnerTopicOverview,
    pedagogySoftOverview,
    technicalOverview,
    codeConceptExplain,
    guidedCreationScoping,
    debugDiagnostic,
    careerLearningPath,
    technicalLearningPath,
    presentationOutline,
  };
}

/**
 * Post-traitement partagé : contrat de mode + fallback hiérarchisé.
 * @param {{
 *   query: string,
 *   history?: object[],
 *   rawResult?: string,
 *   simpleFactual?: boolean,
 *   pedagogicalOverview?: boolean,
 *   beginnerTopicOverview?: boolean,
 *   fallbackReason?: string,
 * }} params
 */
export async function applySimpleFastDeliveryPipeline({
  query,
  history = [],
  rawResult = "",
  simpleFactual = false,
  pedagogicalOverview = false,
  beginnerTopicOverview = false,
  pedagogySoftOverview = false,
  technicalOverview = false,
  codeConceptExplain = false,
  lexiconExplainLight = false,
  lexiconSchoolScienceExplain = false,
  pedagogicalStructuredExplain = false,
  responseContract = null,
  pedagogicalHybridPrefix = "",
  pedagogicalBatchFooter = "",
  guidedCreationScoping = false,
  debugDiagnostic = false,
  careerLearningPath = false,
  technicalLearningPath = false,
  presentationOutline = false,
  translation = false,
  howToProcedural = false,
  metaAssistantTrust = false,
  documentSynthesis = false,
  culturalContentSummary = false,
  fallbackReason = "empty_simple_fast",
} = {}) {
  const overviewMode =
    pedagogicalOverview ||
    beginnerTopicOverview ||
    pedagogySoftOverview ||
    technicalOverview ||
    guidedCreationScoping ||
    careerLearningPath ||
    technicalLearningPath;
  const responseMode = resolveSimpleFastResponseMode({
    simpleFactual,
    pedagogicalOverview: overviewMode,
    beginnerTopicOverview,
    pedagogySoftOverview,
    technicalOverview,
    codeConceptExplain,
    lexiconSchoolScienceExplain,
    pedagogicalStructuredExplain,
    guidedCreationScoping,
    debugDiagnostic,
    careerLearningPath,
    technicalLearningPath,
    presentationOutline,
    translation,
    howToProcedural,
    documentSynthesis,
    culturalContentSummary,
  });

  const allowRefusal = resolveSimpleFastAllowRefusal({
    simpleFactual,
    translation,
    howToProcedural,
    pedagogicalOverview: overviewMode,
    beginnerTopicOverview,
    pedagogySoftOverview,
    technicalOverview,
    codeConceptExplain,
    lexiconExplainLight,
    pedagogicalStructuredExplain,
    guidedCreationScoping,
    debugDiagnostic,
    careerLearningPath,
    technicalLearningPath,
    presentationOutline,
    documentSynthesis,
    culturalContentSummary,
    query,
    metaAssistantTrust,
  });
  let fastOut = enforceModeContract(responseMode, rawResult, {
    allowRefusal,
    query,
    blockGenericRefusal: !allowRefusal,
    howToProcedural,
    debugDiagnostic,
    pedagogicalStructuredExplain,
    lexiconExplainLight,
    codeConceptExplain,
    sectionedComposite: Boolean(pedagogicalStructuredExplain),
  });

  if (metaAssistantTrust) {
    const { finalizeAssistantTrustLlmOutput } = await import(
      "../micro/replies/metaConversationReplyBuilder.js"
    );
    fastOut = finalizeAssistantTrustLlmOutput(fastOut, query, { history });
  }

  if (howToProcedural) {
    fastOut = enforceHowToProceduralDirectness(fastOut, query);
  }

  if (simpleFactual) {
    fastOut = finalizeSimpleFactualAnswer(fastOut, query);
    fastOut = enforceSimpleFactualDirectness(fastOut, query);
  }

  if (debugDiagnostic) {
    fastOut = enforceDebugDiagnosticDirectness(fastOut, query);
  }

  if (!String(fastOut || "").trim()) {
    if (debugDiagnostic) {
      const { buildDebugDiagnosticDirectFallback } = await import(
        "../micro/replies/debugDiagnosticComposer.js"
      );
      fastOut = buildDebugDiagnosticDirectFallback(query) || "";
    }
  }

  if (!String(fastOut || "").trim()) {
    if (translation) {
      fastOut =
        "Je n'ai pas pu produire les traductions dans ce tour. Reformule langue par langue, ou réessaie avec moins de langues cibles.";
    }
  }

  if (!String(fastOut || "").trim()) {
    if (technicalLearningPath) {
      const { resolveTechnicalLearningPathLocalFallback } = await import(
        "../micro/replies/technicalLearningPathComposer.js"
      );
      fastOut = resolveTechnicalLearningPathLocalFallback(query) || "";
    }
  }

  if (!String(fastOut || "").trim()) {
    if (codeConceptExplain && technicalOverview) {
      const { resolveCodeConceptGlossaryFallback } = await import(
        "../policies/code/codeConceptGlossaryPolicy.js"
      );
      const glossaryHit = resolveCodeConceptGlossaryFallback(query, {
        history,
        preferDirect: true,
      });
      if (glossaryHit?.text) {
        fastOut = glossaryHit.text;
      }
    }
  }

  if (lexiconExplainLight) {
    const {
      buildLexiconRecognitionFallbackReply,
      buildLexiconConceptExplainFallbackReply,
      isLexiconAngleMenuLeak,
    } = await import("../policies/pedagogical/index.js");
    const empty = !String(fastOut || "").trim();
    const menuLeak =
      lexiconSchoolScienceExplain && isLexiconAngleMenuLeak(fastOut);
    if (empty || menuLeak) {
      fastOut = lexiconSchoolScienceExplain
        ? buildLexiconConceptExplainFallbackReply(query)
        : buildLexiconRecognitionFallbackReply(query);
    }
  }

  // Table/schéma sous contrat : valider unité par unité ; hybride = préfixe local + LLM.
  if (pedagogicalStructuredExplain) {
    const {
      buildLexiconPedagogicalSchemaReply,
      extractPedagogicalScienceSubject,
      validatePedagogicalTableResponse,
    } = await import("../policies/pedagogical/index.js");
    const { splitPedagogicalMarkdownBlocks } = await import(
      "../../../../shared/pedagogicalTableContract.js"
    );

    const subject =
      responseContract?.subject || extractPedagogicalScienceSubject(query);
    const wantsTable = (responseContract?.type || "table") === "table";
    const local = subject
      ? buildLexiconPedagogicalSchemaReply(subject, {
          format: wantsTable ? "table" : "schema",
          detail: !wantsTable && responseContract?.depth === "detailed",
        })
      : null;

    const empty = !String(fastOut || "").trim();
    if (wantsTable && !empty && responseContract?.multi) {
      // Validation par bloc : on garde les blocs valides, on drop les invalides.
      const blocks = splitPedagogicalMarkdownBlocks(fastOut);
      if (blocks.blocks?.length) {
        const kept = [];
        for (const block of blocks.blocks) {
          const chunk = [
            block.intro,
            block.tableMd,
            block.note ? `Note : ${block.note}` : "",
            block.takeaway ? `**À retenir** : ${block.takeaway}` : "",
          ]
            .filter(Boolean)
            .join("\n\n");
          const ok = validatePedagogicalTableResponse(chunk, {
            minRows: responseContract?.minRows || 5,
            headers: responseContract?.headers,
          }).ok;
          if (ok) kept.push(chunk);
        }
        if (kept.length) {
          fastOut = kept.join("\n\n---\n\n");
        } else if (local) {
          fastOut = local;
        }
      }
    } else {
      let contractOk = !wantsTable;
      if (wantsTable && !empty) {
        contractOk = validatePedagogicalTableResponse(fastOut, {
          minRows: responseContract?.minRows || 5,
          headers: responseContract?.headers,
        }).ok;
      }
      if ((empty || !contractOk) && local) {
        fastOut = local;
      }
    }

    const prefix = String(pedagogicalHybridPrefix || "").trim();
    if (prefix) {
      const llmPart = String(fastOut || "").trim();
      fastOut = llmPart ? `${prefix}\n\n---\n\n${llmPart}` : prefix;
    }
    const footer = String(pedagogicalBatchFooter || "").trim();
    if (footer && String(fastOut || "").trim()) {
      fastOut = `${String(fastOut).trim()}\n${footer}`;
    }
  }

  if (!String(fastOut || "").trim() && documentSynthesis) {
    const { buildDocumentSynthesisRecoveryMessage } = await import(
      "../policies/document/index.js"
    );
    fastOut =
      buildDocumentSynthesisRecoveryMessage(
        query,
        history,
        [],
        fallbackReason,
      ) || "";
  }

  if (!String(fastOut || "").trim()) {
    if (technicalOverview || guidedCreationScoping) {
      const { resolveCodeCreateLocalFallback, isCodeCreateRequest } =
        await import("../policies/code/codeCreateFallbackPolicy.js");
      if (isCodeCreateRequest(query)) {
        fastOut = resolveCodeCreateLocalFallback(query) || "";
      }
    }
  }

  if (!String(fastOut || "").trim()) {
    const { buildFamiliarityReply } = await import(
      "../micro/replies/familiarityReplyBuilder.js"
    );
    fastOut =
      resolveMathSimpleShortCircuit(query)?.reply ||
      resolveMathRootShortCircuit(query)?.reply ||
      resolveMathGeometryShortCircuit(query)?.reply ||
      resolveMathExplainLocalFallback(query) ||
      resolveMathPercentShortCircuit(query)?.reply ||
      resolveLocalDeterministicFallback(query) ||
      buildFamiliarityReply(query) ||
      resolvePipelineFallback({
        query,
        history,
        rawResponse: rawResult,
        reason: fallbackReason,
      });
    return {
      text: applySurfaceMicroContract(query, fastOut),
      usedRecoveryFallback: true,
      fallbackReason,
    };
  }

  return {
    text: applySurfaceMicroContract(query, fastOut),
    usedRecoveryFallback: false,
    fallbackReason: null,
  };
}

/**
 * @param {{
 *   query: string,
 *   history?: object[],
 *   origin?: string,
 *   pipelinePath?: string,
 *   structuredRequestHint?: string,
 *   structuredRequest?: object|null,
 *   shortCircuit?: object|null,
 *   onStep?: Function,
 * }} params
 */
export async function invokeSimpleFastLlm({
  query,
  history = [],
  origin = SIMPLE_FAST_ORIGINS.WORD_GUARD,
  pipelinePath = "simple_fast",
  structuredRequestHint = "",
  structuredRequest = null,
  shortCircuit = null,
  onStep,
} = {}) {
  const flags = resolveSimpleFastIntentFlags(query, {
    simpleFactual: shortCircuit?.simpleFactual,
    pedagogicalOverview: shortCircuit?.pedagogicalOverview,
    beginnerTopicOverview: shortCircuit?.beginnerTopicOverview,
    pedagogySoftOverview: shortCircuit?.pedagogySoftOverview,
    technicalOverview: shortCircuit?.technicalOverview,
    debugDiagnostic: shortCircuit?.debugDiagnostic,
    careerLearningPath: shortCircuit?.careerLearningPath,
    technicalLearningPath: shortCircuit?.technicalLearningPath,
    presentationOutline: shortCircuit?.presentationOutline,
    guidedCreationScoping: shortCircuit?.guidedCreationScoping,
    codeConceptExplain: shortCircuit?.codeConceptExplain,
  });
  const lexiconExplainLight = Boolean(shortCircuit?.lexiconExplainLight);
  const lexiconSchoolScienceExplain = Boolean(
    shortCircuit?.lexiconSchoolScienceExplain,
  );
  const pedagogicalStructuredExplain = Boolean(
    shortCircuit?.pedagogicalStructuredExplain,
  );
  const responseContract = shortCircuit?.responseContract || null;

  const fallbackReason =
    origin === SIMPLE_FAST_ORIGINS.SHORT_CIRCUIT
      ? "empty_short_circuit_llm"
      : "empty_simple_fast";

  const isTranslation = Boolean(shortCircuit?.translation);
  const translationPlan = shortCircuit?.translationPlan || null;
  const translationLanguageCount =
    translationPlan?.targetLanguageCount ||
    shortCircuit?.translationLanguageCount ||
    (isTranslation ? 1 : 0);

  const reflectiveHint = [
    structuredRequestHint,
    shortCircuit?.reflectiveHint,
    isTranslation
      ? buildTranslationReflectiveHint(translationPlan || { ready: true, multiTarget: shortCircuit?.translationMultiTarget })
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const pipelineQuery =
    translationPlan?.effectiveQuery ||
    shortCircuit?.translationEffectiveQuery ||
    query;

  const { simpleFast } = await import(
    "../../../../citadelle-vault/Citadelle/01-Architecture/03-Forge/simple-fast.js"
  );

  const startTime = performance.now();
  const fastResult = await simpleFast(
    pipelineQuery,
    {
      metaReflectiveHint: reflectiveHint,
      translation: isTranslation,
      translationLanguageCount,
      translationMultiTarget: Boolean(translationPlan?.multiTarget),
      translationExecutionMode: translationPlan?.executionMode || null,
      structuredRequest,
      segmentPlan: shortCircuit?.segmentPlan,
      simpleFactual: flags.simpleFactual,
      debugDiagnostic: flags.debugDiagnostic,
      pedagogicalOverview:
        flags.pedagogicalOverview ||
        flags.beginnerTopicOverview ||
        flags.pedagogySoftOverview ||
        flags.technicalOverview ||
        flags.careerLearningPath ||
        flags.technicalLearningPath ||
        flags.presentationOutline,
      howToProcedural: Boolean(shortCircuit?.howToProcedural),
      guidedCreationScoping: Boolean(shortCircuit?.guidedCreationScoping),
      generalKnowledge: Boolean(shortCircuit?.generalKnowledge),
      culturalContentSummary: Boolean(shortCircuit?.culturalContentSummary),
      documentSynthesis: Boolean(shortCircuit?.documentSynthesis),
      summaryExecutionMode: shortCircuit?.summaryExecutionMode || null,
    },
    { onStep },
  );

  const delivery = await applySimpleFastDeliveryPipeline({
    query,
    history,
    rawResult: fastResult.result,
    simpleFactual: flags.simpleFactual,
    pedagogicalOverview: flags.pedagogicalOverview,
    beginnerTopicOverview: flags.beginnerTopicOverview,
    pedagogySoftOverview: flags.pedagogySoftOverview,
    technicalOverview: flags.technicalOverview,
    codeConceptExplain: Boolean(shortCircuit?.codeConceptExplain),
    lexiconExplainLight,
    lexiconSchoolScienceExplain,
    pedagogicalStructuredExplain,
    responseContract,
    pedagogicalHybridPrefix: shortCircuit?.pedagogicalHybridPrefix || "",
    pedagogicalBatchFooter: shortCircuit?.pedagogicalBatchFooter || "",
    debugDiagnostic: flags.debugDiagnostic,
    careerLearningPath: flags.careerLearningPath,
    technicalLearningPath: flags.technicalLearningPath,
    presentationOutline: flags.presentationOutline,
    guidedCreationScoping: flags.guidedCreationScoping,
    translation: isTranslation,
    howToProcedural: Boolean(shortCircuit?.howToProcedural),
    metaAssistantTrust: shortCircuit?.metaSubKind === "assistant_trust",
    documentSynthesis: Boolean(shortCircuit?.documentSynthesis),
    culturalContentSummary: Boolean(shortCircuit?.culturalContentSummary),
    fallbackReason,
  });

  const effectiveFallbackReason = delivery.usedRecoveryFallback
    ? delivery.fallbackReason || fallbackReason
    : null;

  let adaptedFastOut = delivery.text;
  if (
    translationPlan?.multiTarget &&
    !delivery.usedRecoveryFallback &&
    !validateMultiTargetTranslationOutput(
      adaptedFastOut,
      translationPlan.targetLanguages,
    )
  ) {
    adaptedFastOut = applySurfaceMicroContract(
      query,
      "Je n'ai pas obtenu toutes les traductions structurées dans ce tour. Réessaie avec deux langues à la fois, ou une langue par message.",
    );
  }

  return {
    adaptedFastOut,
    fastResult,
    flags,
    ttft: performance.now() - startTime,
    pipelinePath: pipelinePath || shortCircuit?.path || "simple_fast",
    fallbackReason: effectiveFallbackReason,
    origin,
  };
}

/**
 * @param {{
 *   shortCircuitEvaluated?: boolean,
 *   simpleFastConsumed?: boolean,
 *   shortCircuitDeferredFull?: boolean,
 *   wordsCount?: number,
 *   bypassSimpleFast?: boolean,
 *   isForgeProductionRun?: boolean,
 * }} ctx
 */
export function shouldRunWordGuardSimpleFast({
  shortCircuitEvaluated = false,
  simpleFastConsumed = false,
  shortCircuitDeferredFull = false,
  wordsCount = 0,
  bypassSimpleFast = false,
  isForgeProductionRun = false,
} = {}) {
  if (isForgeProductionRun || bypassSimpleFast || simpleFastConsumed) {
    return false;
  }
  if (shortCircuitEvaluated && shortCircuitDeferredFull) {
    return false;
  }
  return wordsCount < 15;
}

/**
 * Fallback local factuel après échec LLM short-circuit.
 * @param {string} query
 */
export function resolveSimpleFastLocalCatchFallback(query = "") {
  return (
    resolveMathExplainLocalFallback(query) ||
    resolveLocalSimpleFactualAnswer(query)
  );
}
