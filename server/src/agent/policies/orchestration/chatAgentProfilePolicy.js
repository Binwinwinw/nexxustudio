/**
 * Profil chat outillé — table de déclenchement des capacités Nexxus.
 *
 * Doctrine :
 * - Par défaut : conversation directe (profil chat, orchestrateur léger).
 * - Outils activés par nécessité (web, code, fichier, raisonnement expert).
 * - Profil plateforme réservé aux scénarios métier lourds.
 */
import { RESPONSE_STRATEGIES, QUERY_DOMAINS } from "../queryUnderstandingDomainRegistry.js";
import {
  isCodeIntentRequest,
  classifyCodeIntent,
  hasExecutableSnippet,
} from "../codeIntentPolicy.js";
import { isHtmlProjectDeliverable } from "../htmlProjectDeliveryPolicy.js";
import { deriveGuidedProductWebSearchQuery } from "../guidedProductRecommendationPolicy.js";
import {
  deriveResearchThenSummarizeWebQuery,
  isResearchThenSummarizeRequest,
} from "../researchThenSummarizePolicy.js";
import { isFormalLetterTemplateRequest } from "../formalLetterTemplatePolicy.js";
import { hasTextAttachments } from "../../utils/conversationGuards.js";

export const CHAT_AGENT_PROFILE_RULE = "chat_agent_profile_v1";

export const NEXXUS_PROFILES = Object.freeze({
  CHAT: "chat",
  PLATFORM: "platform",
});

/** Modes orchestrateur — direct = pas de souverain lourd ; light = composer+contexte ; full = experts */
export const ORCHESTRATOR_MODES = Object.freeze({
  DIRECT: "direct",
  LIGHT: "light",
  FULL: "full",
});

const PLATFORM_INTENT_CONTRACTS = new Set([
  "GUIDED_PRODUCT_RECOMMENDATION",
  "PRESENTATION_OUTLINE",
  "FORGE_WEBAPP_BUILD",
  "INLINE_FILE_ANALYSIS_V4_1",
  "IDEATION_OPEN",
]);

const FILE_DELIVERY_RE =
  /\b(?:excel|xlsx|csv|pdf|fichier|fichiers|\.xlsx|\.csv|télécharg|telecharg|export(?:er)?|artifact|artefact|page\s+html|site\s+web|webapp|web\s+app)\b/i;

const CODE_CREATE_RE =
  /\b(?:script|python|javascript|typescript|php|fonction|programme|code|snippet|refactor|debug|corrige|api|endpoint|composant|component)\b/i;

/**
 * Table de déclenchement — capacités activables.
 * @typedef {{
 *   directReply: boolean,
 *   web: boolean,
 *   code: boolean,
 *   file: boolean,
 *   memory: boolean,
 *   expertReasoning: boolean,
 * }} CapabilityFlags
 */

/**
 * @param {string} query
 * @param {{ attachments?: unknown[], forgeProduction?: boolean, intentContractId?: string|null }} options
 */
function detectPlatformSignals(query = "", options = {}) {
  const q = String(query || "");
  const attachments = options.attachments || [];
  const hasAttachments = attachments.length > 0;
  const hasTextFiles = hasTextAttachments(attachments);

  return {
    forgeProduction: options.forgeProduction === true,
    heavyContract: PLATFORM_INTENT_CONTRACTS.has(options.intentContractId || ""),
    attachedAnalysis: hasTextFiles && /\b(analys|audit|review|lis|lire|résume|résumer|resume|summarize)\b/i.test(q),
    attachedCreation:
      hasAttachments &&
      /\b(cree|créer|creer|generer|générer|genere|fais|fait|produis|construis|developpe|développe)\b/i.test(q),
    documentSynthesis: /\b(synthèse|synthese|rapport|document|mémo|memo|dossier)\b/i.test(q) && hasAttachments,
  };
}

/**
 * @param {string} query
 */
function detectCodeCapability(query = "") {
  if (isCodeIntentRequest(query)) return { active: true, why: "code_intent_request" };
  const classified = classifyCodeIntent(query);
  if (classified?.kind) return { active: true, why: `code_intent:${classified.kind}` };
  if (hasExecutableSnippet(query)) return { active: true, why: "executable_snippet" };
  if (CODE_CREATE_RE.test(query) && /\b(cree|créer|creer|generer|générer|genere|fais|fait|ecris|écris|developpe|développe)\b/i.test(query)) {
    return { active: true, why: "code_creation_request" };
  }
  return { active: false, why: null };
}

/**
 * @param {string} query
 * @param {{ attachments?: unknown[] }} options
 */
function detectFileCapability(query = "", options = {}) {
  if (isHtmlProjectDeliverable(query)) {
    return { active: true, why: "html_project_deliverable" };
  }
  if (FILE_DELIVERY_RE.test(query)) {
    return { active: true, why: "file_delivery_request" };
  }
  if ((options.attachments || []).length > 0 && detectPlatformSignals(query, options).attachedCreation) {
    return { active: true, why: "file_from_attachment_work" };
  }
  return { active: false, why: null };
}

/**
 * Bloc action — profil chat vs plateforme + capacités activables.
 *
 * @param {string} query
 * @param {ReturnType<import("./conversationQueryUnderstanding.js").understandQuery>} understanding
 * @param {ReturnType<import("./conversationQueryUnderstanding.js").buildRequestWorkup>["intent_assessment"]} intentAssessment
 * @param {ReturnType<import("./conversationQueryUnderstanding.js").buildRequestWorkup>["evidence_requirement"]} evidenceRequirement
 * @param {{ attachments?: unknown[], forgeProduction?: boolean, intentContractId?: string|null }} [options]
 */
export function resolveActionDecision(
  query = "",
  understanding,
  intentAssessment,
  evidenceRequirement,
  options = {},
) {
  const platformSignals = detectPlatformSignals(query, {
    ...options,
    intentContractId: intentAssessment.intentContractId || options.intentContractId,
  });
  const codeCap = detectCodeCapability(query);
  const fileCap = detectFileCapability(query, options);
  const isFormalLetter =
    intentAssessment.intentContractId === "FORMAL_LETTER_TEMPLATE" ||
    isFormalLetterTemplateRequest(query, options);

  const isDeterministic =
    understanding.responseStrategy === RESPONSE_STRATEGIES.DETERMINISTIC ||
    understanding.primaryDomain === QUERY_DOMAINS.SOCIAL ||
    understanding.primaryDomain === QUERY_DOMAINS.DATETIME;

  const webByEvidence =
    evidenceRequirement.level === "high" ||
    (evidenceRequirement.level === "medium" &&
      (evidenceRequirement.explicitWebRequested || evidenceRequirement.freshnessSensitive));

  const expertReasoning =
    !isFormalLetter &&
    (platformSignals.forgeProduction ||
      platformSignals.heavyContract ||
      platformSignals.attachedAnalysis ||
      platformSignals.documentSynthesis ||
      codeCap.active ||
      fileCap.active ||
      understanding.responseStrategy === RESPONSE_STRATEGIES.FULL_PIPELINE ||
      intentAssessment.intentContractId === "GUIDED_PRODUCT_RECOMMENDATION");

  const profile =
    isFormalLetter ||
    (!platformSignals.forgeProduction &&
      !platformSignals.heavyContract &&
      !platformSignals.documentSynthesis &&
      !(platformSignals.attachedAnalysis && !isDeterministic))
      ? NEXXUS_PROFILES.CHAT
      : NEXXUS_PROFILES.PLATFORM;

  /** @type {CapabilityFlags} */
  const capabilities = {
    directReply: true,
    web: !isDeterministic && webByEvidence && !codeCap.active,
    code: codeCap.active,
    file: fileCap.active,
    memory: true,
    expertReasoning: expertReasoning && !isDeterministic,
  };

  let orchestratorMode = ORCHESTRATOR_MODES.LIGHT;
  if (isDeterministic || isFormalLetter) {
    orchestratorMode = ORCHESTRATOR_MODES.DIRECT;
  } else if (
    profile === NEXXUS_PROFILES.PLATFORM ||
    capabilities.expertReasoning ||
    capabilities.file ||
    capabilities.web
  ) {
    orchestratorMode = ORCHESTRATOR_MODES.FULL;
  }

  const why = [];
  if (isDeterministic) why.push("deterministic_chat");
  if (capabilities.web) why.push("evidence_web");
  if (capabilities.code) why.push(codeCap.why);
  if (capabilities.file) why.push(fileCap.why);
  if (capabilities.expertReasoning) why.push("expert_reasoning");
  if (profile === NEXXUS_PROFILES.PLATFORM) why.push("platform_profile");

  let webQuery = null;
  if (capabilities.web) {
    if (intentAssessment.intentContractId === "GUIDED_PRODUCT_RECOMMENDATION") {
      webQuery = deriveGuidedProductWebSearchQuery(query);
    } else if (
      intentAssessment.constraints?.researchThenSummarize ||
      isResearchThenSummarizeRequest(query)
    ) {
      webQuery = deriveResearchThenSummarizeWebQuery(query);
    }
  }

  return {
    profile,
    orchestratorMode,
    capabilities,
    why,
    webQuery,
    platformSignals,
  };
}

/**
 * Table de référence (documentation exécutable) — exemples canoniques.
 * @readonly
 */
export const CAPABILITY_TRIGGER_EXAMPLES = Object.freeze([
  {
    query: "bonjour ornith",
    profile: NEXXUS_PROFILES.CHAT,
    capabilities: { directReply: true, web: false, code: false, file: false },
    orchestratorMode: ORCHESTRATOR_MODES.DIRECT,
  },
  {
    query: "explique le ray tracing",
    profile: NEXXUS_PROFILES.CHAT,
    capabilities: { directReply: true, web: false, code: false, file: false },
    orchestratorMode: ORCHESTRATOR_MODES.LIGHT,
  },
  {
    query: "fais-moi un script Python pour renommer 500 fichiers",
    profile: NEXXUS_PROFILES.CHAT,
    capabilities: { code: true, expertReasoning: true },
    orchestratorMode: ORCHESTRATOR_MODES.FULL,
  },
  {
    query: "compare 3 GPU qualité/prix avec recherche web",
    profile: NEXXUS_PROFILES.PLATFORM,
    capabilities: { web: true, expertReasoning: true },
    orchestratorMode: ORCHESTRATOR_MODES.FULL,
  },
  {
    query: "crée-moi un fichier Excel pour suivre mes dépenses",
    profile: NEXXUS_PROFILES.CHAT,
    capabilities: { file: true, expertReasoning: true },
    orchestratorMode: ORCHESTRATOR_MODES.FULL,
  },
]);

/**
 * @param {object} [requestWorkup]
 * @param {{
 *   forgeProduction?: boolean,
 *   attachments?: unknown[],
 *   deferToFullPipeline?: boolean,
 *   forcedExpertKey?: string|null,
 *   wantsAnalysis?: boolean,
 * }} [options]
 */
export function shouldUseChatLightComposerPath(requestWorkup, options = {}) {
  const action = requestWorkup?.action_decision;
  if (!action) return false;
  if (options.forgeProduction) return false;
  if (options.wantsAnalysis) return false;
  if (options.deferToFullPipeline) return false;
  if (options.forcedExpertKey) return false;
  if ((options.attachments || []).length > 0) return false;

  if (action.profile !== NEXXUS_PROFILES.CHAT) return false;
  if (action.orchestratorMode !== ORCHESTRATOR_MODES.LIGHT) return false;

  const caps = action.capabilities || {};
  if (caps.web || caps.code || caps.file || caps.expertReasoning) return false;

  return true;
}

/**
 * Packet minimal pour composer direct (sans souverain).
 * @param {string} query
 * @param {object} requestWorkup
 * @param {ReturnType<import("./conversationQueryUnderstanding.js").understandQuery>} queryUnderstanding
 * @param {{ guidedIntentContractId?: string|null }} [options]
 */
export function buildLightChatOrchestratorPacket(
  query = "",
  requestWorkup = {},
  queryUnderstanding = {},
  options = {},
) {
  const primaryDomain = queryUnderstanding.primaryDomain || "unknown";
  const userIntent =
    primaryDomain === "social" ? "social_chit_chat" : "factual_light";

  return {
    user_query: query,
    user_intent: userIntent,
    mode: "CHAT_LIGHT",
    expert_outputs: [],
    evidence: [],
    quick_answer: null,
    meta: {
      chat_light_path: true,
      resolution_path: "chat_light_composer",
      intent_contract_id: options.guidedIntentContractId || null,
      cognitive_cycle: {
        rule: requestWorkup.rule,
        profile: requestWorkup.action_decision?.profile,
        orchestratorMode: requestWorkup.action_decision?.orchestratorMode,
        intent_assessment: requestWorkup.intent_assessment,
        evidence_requirement: requestWorkup.evidence_requirement,
        action_decision: requestWorkup.action_decision,
        retrieval_decision: requestWorkup.retrieval_decision,
        response_commitment: requestWorkup.response_commitment,
      },
      query_understanding: {
        primaryDomain: queryUnderstanding.primaryDomain,
        responseStrategy: queryUnderstanding.responseStrategy,
        domains: queryUnderstanding.domains,
        workIntentCount: queryUnderstanding.workIntentCount,
      },
    },
  };
}
