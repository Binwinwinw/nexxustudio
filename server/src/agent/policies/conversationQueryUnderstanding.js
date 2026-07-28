/**
 * Compréhension transversale de requête — avant short-circuits métiers.
 * Doctrine : comprendre la demande, puis router — le pattern n'est qu'un signal.
 *
 * Trois questions universelles :
 * 1. Quel domaine / combien d'intentions ?
 * 2. Quels sous-buts ?
 * 3. Quelle stratégie de réponse ?
 */
import { normalizeForParse } from "../micro/parsing/requestSegmentParser.js";
import { analyzeRequestIntentFrame } from "./requestIntentFrame.js";
import { decomposeRequest } from "./requestDecompositionPolicy.js";
import {
  detectDomainIntentInSegment,
  hasRecognizedDomainIntent,
  QUERY_DOMAINS,
  RESPONSE_STRATEGIES,
} from "./queryUnderstandingDomainRegistry.js";
import { refineSegmentsForGovernance } from "./governanceExplainPolicy.js";
import {
  isDatetimeCompoundSegment,
  splitNumberedTaskSegments,
  shouldAppendDatetimeToDocumentAnalysis,
  extractDocumentAnalysisQuery,
} from "./documentAnalysisCompositePolicy.js";
import {
  shouldAppendDatetimeToDocumentSynthesis,
  extractDocumentSynthesisQuery,
} from "./documentSynthesisCompositePolicy.js";
import {
  isExplicitWebSearchRequest,
  isFreshFactualCompareWithWebRequest,
} from "./explicitWebSearchRequestPolicy.js";
import {
  deriveGuidedProductWebSearchQuery,
  resolveGuidedProductIntentContractId,
} from "./guidedProductRecommendationPolicy.js";
import { extractProductRecommendationSlots } from "./compareChooseCompositePolicy.js";
import { assessKnowledgeFreshnessRisk } from "./knowledgeFreshnessPolicy.js";
import { resolveActionDecision } from "./chatAgentProfilePolicy.js";
import { isLightCulturalRecognitionRequest } from "./lexiconExplainLightPolicy.js";
import {
  deriveResearchThenSummarizeWebQuery,
  isResearchThenSummarizeRequest,
  resolveResearchThenSummarizeIntentContractId,
} from "./researchThenSummarizePolicy.js";
import {
  isFormalLetterTemplateRequest,
  resolveFormalLetterTemplateIntentContractId,
} from "./formalLetterTemplatePolicy.js";

export {
  shouldAppendDatetimeToDocumentAnalysis,
  extractDocumentAnalysisQuery,
} from "./documentAnalysisCompositePolicy.js";
export {
  shouldAppendDatetimeToDocumentSynthesis,
  extractDocumentSynthesisQuery,
} from "./documentSynthesisCompositePolicy.js";

export { QUERY_DOMAINS, RESPONSE_STRATEGIES } from "./queryUnderstandingDomainRegistry.js";

export const CONVERSATION_QUERY_UNDERSTANDING_RULE = "conversation_query_understanding_v1";

/** Cycle cognitif factorisé — intention → preuve → récupération → engagement de réponse. */
export const COGNITIVE_CYCLE_RULE = "cognitive_cycle_factorized_v2";

/** @deprecated Alias — préférer COGNITIVE_CYCLE_RULE */
export const REQUEST_WORKUP_RULE = COGNITIVE_CYCLE_RULE;

export const INTENT_MODES = Object.freeze({
  SINGLE: "single_intent",
  MULTI: "multi_intent",
});

/** Cas canonique — racine carrée + nombres premiers (math multi-intent). */
export const QUERY_UNDERSTANDING_CANONICAL_MATH_COMPOSITE =
  "bonjour tu peux m'aider à calculer la racine carré d'un nombre et aussi me donner la liste des nombres premiers";

const QUERY_COMPOSITE_STRONG_SPLIT_RE =
  /\s*(?:;\s+|\s+et\s+aussi\s+|\s+ainsi\s+que\s+|\s+puis\s+|\s+ensuite\s+|\s+et\s+puis\s+|\s+apres\s+ca\s+|\s+après\s+ça\s+)/i;

const SOCIAL_GREETING_RE =
  /(?:^|\s)(?:salut|bonjour|hello|coucou|hey|bonsoir|yo|yop)\b/i;

const SOCIAL_CHECKIN_RE =
  /(?:comment\s+(?:(?:ça|ca)\s+)?(?:va|se\s+passe|roule)|comment\s+(?:tu\s+)?vas|comment\s+vas[- ]?tu|(?:^|\s)(?:ça|ca)\s+va|tu\s+vas\s+bien)/i;

/**
 * @param {string} raw
 */
export function normalizeUnderstandingQuery(raw = "") {
  return normalizeForParse(String(raw || "").trim());
}

/**
 * @param {string} query
 * @returns {string[]}
 */
export function splitQuerySegments(query = "") {
  const raw = String(query || "").trim();
  if (!raw) return [];

  const numbered = splitNumberedTaskSegments(raw);
  if (numbered.length >= 2) return refineSegmentsForGovernance(numbered);

  if (isDatetimeCompoundSegment(raw)) {
    return refineSegmentsForGovernance([raw]);
  }

  const strongParts = raw
    .split(QUERY_COMPOSITE_STRONG_SPLIT_RE)
    .map((part) => part.trim())
    .filter(Boolean);

  if (strongParts.length >= 2) return refineSegmentsForGovernance(strongParts);

  const weakParts = raw
    .split(/\s+et\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);

  if (weakParts.length < 2) return [raw];

  const recognized = weakParts.filter((part) => hasRecognizedDomainIntent(part));
  if (recognized.length >= 2) return refineSegmentsForGovernance(weakParts);

  return refineSegmentsForGovernance([raw]);
}

/**
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 * @param {{ attachments?: unknown[] }} [options]
 * @returns {{
 *   rule: string,
 *   intentMode: string,
 *   intentCount: number,
 *   workIntentCount: number,
 *   primaryDomain: string,
 *   domains: string[],
 *   intents: ReturnType<typeof detectDomainIntentInSegment>[],
 *   segments: string[],
 *   responseStrategy: string,
 *   satisfiableCount: number,
 *   droppedSegmentCount: number,
 *   requestFrame: ReturnType<typeof analyzeRequestIntentFrame>,
 *   requestDecomposition: ReturnType<typeof decomposeRequest>,
 * }}
 */
export function understandQuery(query = "", history = [], options = {}) {
  const segments = splitQuerySegments(query);
  const intents = [];
  /** @type {boolean[]} */
  const segmentWorkMatched = segments.map(() => false);
  /** @type {{ shape: string, length: number, width: number, unit: string|null }|null} */
  let geometryCarryover = null;
  const segmentContext = {
    history,
    attachments: options.attachments || [],
  };

  for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
    const segment = segments[segmentIndex];
    let payload = segment;
    if (
      geometryCarryover &&
      /\b(?:son|sa|leur|meme|même)\s+(?:perimetre|périmètre|aire)\b/i.test(segment)
    ) {
      const unitSuffix = geometryCarryover.unit ? ` ${geometryCarryover.unit}` : "";
      payload =
        `rectangle ${segment} de ${geometryCarryover.length}${unitSuffix} sur ` +
        `${geometryCarryover.width}${unitSuffix}`;
    }

    const socialLead =
      SOCIAL_GREETING_RE.test(normalizeUnderstandingQuery(segment)) ||
      SOCIAL_CHECKIN_RE.test(normalizeUnderstandingQuery(segment));
    const intent = detectDomainIntentInSegment(payload, {
      geometryCarryover,
      ...segmentContext,
    });
    if (!intent) continue;

    if (!intent.absorbable) {
      segmentWorkMatched[segmentIndex] = true;
    }

    if (socialLead && !intent.absorbable) {
      intents.push({
        domain: QUERY_DOMAINS.SOCIAL,
        familyId: "social_deterministic",
        path: "social_deterministic",
        label: "Social",
        reply: null,
        satisfiable: true,
        strategy: RESPONSE_STRATEGIES.DETERMINISTIC,
        segment,
        absorbable: true,
        priority: 0,
        originalSegment: segment,
      });
    }

    intents.push({ ...intent, originalSegment: segment });

    if (
      intent.domain === QUERY_DOMAINS.DATETIME &&
      isDatetimeCompoundSegment(segment) &&
      !intents.some(
        (existing) =>
          existing.domain === QUERY_DOMAINS.DATETIME &&
          existing.originalSegment === segment &&
          existing.label === "Heure",
      )
    ) {
      segmentWorkMatched[segmentIndex] = true;
      intents.push({
        ...intent,
        label: "Heure",
        originalSegment: segment,
      });
    }

    if (
      intent.domain === QUERY_DOMAINS.MATH &&
      intent.task?.shape === "rectangle" &&
      intent.task?.dimensions?.length != null &&
      intent.task?.dimensions?.width != null
    ) {
      geometryCarryover = {
        shape: "rectangle",
        length: intent.task.dimensions.length,
        width: intent.task.dimensions.width,
        unit: intent.task.dimensions.unit || null,
      };
    }
  }

  const workIntents = intents.filter((intent) => !intent.absorbable);
  const domains = [...new Set(workIntents.map((intent) => intent.domain))];
  const satisfiable = workIntents.filter((intent) => intent.satisfiable && intent.reply);
  const intentMode =
    workIntents.length >= 2 ? INTENT_MODES.MULTI : INTENT_MODES.SINGLE;

  let responseStrategy = RESPONSE_STRATEGIES.DETERMINISTIC;
  if (workIntents.length >= 2 && satisfiable.length >= 2) {
    responseStrategy = RESPONSE_STRATEGIES.COMPOSITE_DETERMINISTIC;
  } else if (
    workIntents.length >= 2 &&
    (domains.includes(QUERY_DOMAINS.DOCUMENT_ANALYSIS) ||
      domains.includes(QUERY_DOMAINS.DOCUMENT_SYNTHESIS)) &&
    domains.includes(QUERY_DOMAINS.DATETIME)
  ) {
    responseStrategy = "document_datetime_hybrid";
  } else if (workIntents.length >= 2 && satisfiable.length < workIntents.length) {
    responseStrategy = RESPONSE_STRATEGIES.PARTIAL_CLARIFY;
  } else if (workIntents.length === 1) {
    responseStrategy = workIntents[0].strategy;
  } else if (intents.length === 1 && intents[0].absorbable) {
    responseStrategy = RESPONSE_STRATEGIES.DETERMINISTIC;
  } else {
    responseStrategy = RESPONSE_STRATEGIES.FULL_PIPELINE;
  }

  const requestFrame = analyzeRequestIntentFrame(query);
  const requestDecomposition = decomposeRequest(query, history);

  const frameDomain = mapFrameDomainToQueryDomain(requestFrame);
  const primaryDomain =
    domains[0] || frameDomain || QUERY_DOMAINS.UNKNOWN;

  const unqualifiedSegmentCount = segmentWorkMatched.filter((matched) => !matched).length;

  return {
    rule: CONVERSATION_QUERY_UNDERSTANDING_RULE,
    intentMode,
    intentCount: intents.length,
    workIntentCount: workIntents.length,
    primaryDomain,
    domains,
    intents,
    segments,
    responseStrategy,
    satisfiableCount: satisfiable.length,
    droppedSegmentCount: unqualifiedSegmentCount,
    unqualifiedSegmentCount,
    requestFrame,
    requestDecomposition,
  };
}

/**
 * @param {ReturnType<typeof analyzeRequestIntentFrame>} frame
 */
function mapFrameDomainToQueryDomain(frame) {
  if (frame?.conversation?.socialOnly) return QUERY_DOMAINS.SOCIAL;
  const familyId = frame?.familyHint?.id;
  if (familyId === "technical_learning_path" || familyId === "career_learning_path") {
    return QUERY_DOMAINS.TRAINING;
  }
  if (familyId === "technical_overview") return QUERY_DOMAINS.TRAINING;
  if (frame?.task?.kind === "translate") return QUERY_DOMAINS.TRANSLATION;
  if (frame?.domain?.kind === "technical") return QUERY_DOMAINS.TRAINING;
  return null;
}

/**
 * @param {ReturnType<typeof understandQuery>} understanding
 * @returns {{
 *   steps: Array<{ index: number, domain: string, familyId: string, path: string, strategy: string, segment: string }>,
 *   composite: boolean,
 *   primaryPath: string|null,
 *   executionHint: string,
 * }}
 */
export function buildExecutionPlan(understanding) {
  const workIntents = understanding.intents.filter((intent) => !intent.absorbable);
  const composite = understanding.workIntentCount >= 2;

  const steps = workIntents.map((intent, index) => ({
    index: index + 1,
    domain: intent.domain,
    familyId: intent.familyId,
    path: intent.path,
    strategy: intent.strategy,
    segment: intent.originalSegment || intent.segment,
    label: intent.label,
    satisfiable: intent.satisfiable,
  }));

  const primaryPath = steps[0]?.path || null;

  const lines = [
    composite
      ? "REQUÊTE MULTI-INTENT — réponds en sections distinctes, une par sous-demande reconnue."
      : "REQUÊTE SINGLE-INTENT — route vers la policy dominante identifiée.",
    `Domaines : ${understanding.domains.join(", ") || understanding.primaryDomain}`,
    "Sous-buts détectés :",
    ...steps.map(
      (step) =>
        `${step.index}. [${step.domain}/${step.familyId}] ${step.label} → ${step.strategy} (${step.path})`,
    ),
  ];

  if (understanding.droppedSegmentCount > 0) {
    lines.push(
      `⚠ ${understanding.droppedSegmentCount} segment(s) sans intention reconnue — ne pas ignorer silencieusement.`,
    );
  }

  return {
    steps,
    composite,
    primaryPath,
    executionHint: lines.join("\n"),
  };
}

function formatCurrentTimeFr() {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

function formatCurrentDateFr() {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

/**
 * @param {ReturnType<typeof understandQuery>} understanding
 * @returns {string|null}
 */
export function buildCompositeDeterministicReply(understanding) {
  const workIntents = understanding.intents.filter((intent) => !intent.absorbable);
  if (workIntents.length < 2) return null;

  const social = understanding.intents.find((intent) => intent.absorbable);
  const lines = [];

  if (social) {
    lines.push("Salut !");
  }

  for (const intent of workIntents) {
    if (intent.domain === QUERY_DOMAINS.DATETIME && !intent.reply) {
      const normalized = normalizeUnderstandingQuery(intent.segment);
      const hasDate = /\b(?:date|jour)\b/i.test(normalized);
      const hasTime = /\b(?:heure)\b/i.test(normalized);
      if (hasDate && hasTime) {
        lines.push(
          `**${intent.label} :** Nous sommes ${formatCurrentDateFr()} et il est ${formatCurrentTimeFr()}.`,
        );
      } else if (hasDate) {
        lines.push(`**${intent.label} :** Nous sommes ${formatCurrentDateFr()}.`);
      } else if (hasTime) {
        lines.push(`**${intent.label} :** Il est ${formatCurrentTimeFr()}.`);
      }
      continue;
    }

    if (intent.reply) {
      lines.push(`**${intent.label} :** ${intent.reply}`);
      continue;
    }

    lines.push(
      `**${intent.label} :** Je repère cette sous-demande (${intent.domain}) ; il me manque un élément pour y répondre précisément.`,
    );
  }

  if (understanding.droppedSegmentCount > 0) {
    lines.push(
      "*(Une partie de ta requête n'a pas été rattachée à une intention explicite — précise-la si besoin.)*",
    );
  }

  const reply = lines.filter(Boolean).join("\n\n").trim();
  return reply || null;
}

/**
 * @param {ReturnType<typeof understandQuery>} understanding
 * @returns {boolean}
 */
export function isCompositeDeterministicSatisfiable(understanding) {
  const workIntents = understanding.intents.filter((intent) => !intent.absorbable);
  if (workIntents.length < 2) return false;
  const replyable = workIntents.filter(
    (intent) =>
      Boolean(intent.reply) ||
      intent.domain === QUERY_DOMAINS.DATETIME,
  );
  return replyable.length >= 2;
}

/**
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 * @returns {{ path: string, reply: string, understanding: ReturnType<typeof understandQuery>, plan: ReturnType<typeof buildExecutionPlan> }|null}
 */
export function resolveQueryCompositeShortCircuit(query = "", history = []) {
  const understanding = understandQuery(query, history);
  if (!isCompositeDeterministicSatisfiable(understanding)) return null;

  const reply = buildCompositeDeterministicReply(understanding);
  if (!reply) return null;

  const plan = buildExecutionPlan(understanding);
  const allMath =
    understanding.domains.length > 0 &&
    understanding.domains.every((domain) => domain === QUERY_DOMAINS.MATH);

  return {
    path: allMath ? "math_composite_deterministic" : "query_composite_deterministic",
    reply,
    understanding,
    plan,
  };
}

/**
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 * @returns {boolean}
 */
export function isQueryCompositeRequest(query = "", history = []) {
  return understandQuery(query, history).workIntentCount >= 2;
}

/**
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 * @returns {boolean}
 */
export function isQueryCompositeSatisfiable(query = "", history = []) {
  return isCompositeDeterministicSatisfiable(understandQuery(query, history));
}

/**
 * @param {ReturnType<typeof understandQuery>} understanding
 * @returns {string}
 */
export function buildDatetimeSectionsFromUnderstanding(understanding) {
  const datetimeIntents = understanding?.intents?.filter(
    (intent) => intent.domain === QUERY_DOMAINS.DATETIME && !intent.absorbable,
  );
  if (!datetimeIntents?.length) return "";

  const labels = new Set(datetimeIntents.map((intent) => intent.label));
  const lines = [];

  if (labels.has("Date") || labels.has("Date et heure")) {
    lines.push(`**Date :** Nous sommes ${formatCurrentDateFr()}.`);
  }
  if (labels.has("Heure") || labels.has("Date et heure")) {
    lines.push(`**Heure :** Il est ${formatCurrentTimeFr()}.`);
  }
  if (!lines.length) {
    lines.push(
      `**Date et heure :** Nous sommes ${formatCurrentDateFr()} et il est ${formatCurrentTimeFr()}.`,
    );
  }

  return lines.join("\n");
}

export function shouldAppendDatetimeToDocumentWork(understanding) {
  return (
    shouldAppendDatetimeToDocumentAnalysis(understanding) ||
    shouldAppendDatetimeToDocumentSynthesis(understanding)
  );
}

/**
 * @param {string} documentReply
 * @param {ReturnType<typeof understandQuery>} understanding
 * @returns {string}
 */
export function mergeDocumentAnalysisWithDatetimeSections(
  documentReply = "",
  understanding,
) {
  const datetimeBlock = buildDatetimeSectionsFromUnderstanding(understanding);
  if (!datetimeBlock) return documentReply;
  const base = String(documentReply || "").trim();
  if (!base) return datetimeBlock;
  return `${base}\n\n${datetimeBlock}`;
}

/**
 * Contraintes explicites extraites de la requête (objets, critères, web).
 * @param {string} query
 */
function extractExplicitConstraints(query = "") {
  const q = String(query || "");
  const minModelsMatch = q.match(/\b(?:au\s+moins\s+)?(\d+)\s+mod[eè]les?\b/i);
  const productMatch = q.match(
    /\b(?:rtx|gtx|rx)\s*\d{3,4}(?:\s*(?:ti|super|xt|xtx))?\b/i,
  );
  const criterionQualityPrice = /qualit[eé][\s/-]*prix|rapport qualit[eé]/i.test(q);
  const currentProduct = productMatch?.[0] || null;
  // Upgrade GPU cadré : au moins 3 modèles même sans chiffre explicite
  const defaultMinModels =
    !minModelsMatch && currentProduct && criterionQualityPrice ? 3 : null;
  return {
    minModels: minModelsMatch ? Number(minModelsMatch[1]) : defaultMinModels,
    currentProduct,
    criterionQualityPrice,
    explicitWeb:
      isExplicitWebSearchRequest(q) || isResearchThenSummarizeRequest(q),
    freshFactualCompare: isFreshFactualCompareWithWebRequest(q),
    researchThenSummarize: isResearchThenSummarizeRequest(q),
  };
}

/**
 * Bloc 1 — intention dominante et contraintes réelles.
 * @param {ReturnType<typeof understandQuery>} understanding
 * @param {string} query
 * @param {{ intentContractId?: string|null }} options
 */
function resolveIntentAssessment(query, understanding, options = {}) {
  const constraints = extractExplicitConstraints(query);
  const workIntent =
    understanding.intents?.find((item) => !item.absorbable) || null;
  const compareIntent = understanding.intents?.find(
    (item) => item.domain === QUERY_DOMAINS.COMPARE_CHOOSE && !item.absorbable,
  );
  const intentContractId =
    options.intentContractId ||
    resolveFormalLetterTemplateIntentContractId(understanding, query) ||
    resolveResearchThenSummarizeIntentContractId(understanding, query) ||
    resolveGuidedProductIntentContractId(understanding) ||
    null;

  return {
    intentContractId,
    familyId: workIntent?.familyId || null,
    primaryDomain: understanding.primaryDomain,
    responseStrategy: understanding.responseStrategy,
    path: compareIntent?.path || workIntent?.path || null,
    intentMode: understanding.intentMode,
    workIntentCount: understanding.workIntentCount,
    slots:
      compareIntent?.task?.slots ||
      (intentContractId === "GUIDED_PRODUCT_RECOMMENDATION"
        ? extractProductRecommendationSlots(query)
        : null),
    constraints,
  };
}

/**
 * Bloc 2 — niveau de preuve nécessaire (factorisé, pas par cas).
 * @param {string} query
 * @param {ReturnType<typeof understandQuery>} understanding
 * @param {ReturnType<typeof resolveIntentAssessment>} intentAssessment
 */
function resolveEvidenceRequirement(query, understanding, intentAssessment) {
  const { constraints, intentContractId, primaryDomain, responseStrategy } =
    intentAssessment;
  const freshness = assessKnowledgeFreshnessRisk(query);

  // Prime sur deterministic : recherche externe obligatoire avant synthèse
  if (constraints.researchThenSummarize || isResearchThenSummarizeRequest(query)) {
    return {
      level: "high",
      why: ["research_then_summarize_external_source"],
      freshnessSensitive: true,
      comparative: false,
      explicitWebRequested: true,
    };
  }

  if (
    intentContractId === "FORMAL_LETTER_TEMPLATE" ||
    isFormalLetterTemplateRequest(query)
  ) {
    return {
      level: "none",
      why: ["formal_letter_template_local"],
      freshnessSensitive: false,
      comparative: false,
      explicitWebRequested: false,
    };
  }

  if (
    responseStrategy === RESPONSE_STRATEGIES.DETERMINISTIC ||
    primaryDomain === QUERY_DOMAINS.SOCIAL ||
    primaryDomain === QUERY_DOMAINS.DATETIME
  ) {
    return {
      level: "none",
      why: ["deterministic_or_social"],
      freshnessSensitive: false,
      comparative: false,
      explicitWebRequested: constraints.explicitWeb,
    };
  }

  if (responseStrategy === RESPONSE_STRATEGIES.PARTIAL_CLARIFY) {
    return {
      level: "none",
      why: ["user_clarification_required_first"],
      freshnessSensitive: false,
      comparative: false,
      explicitWebRequested: constraints.explicitWeb,
    };
  }

  if (isLightCulturalRecognitionRequest(query)) {
    return {
      level: "none",
      why: ["light_cultural_recognition_no_web"],
      freshnessSensitive: false,
      comparative: false,
      explicitWebRequested: false,
    };
  }

  const isGuidedProduct =
    intentContractId === "GUIDED_PRODUCT_RECOMMENDATION" ||
    (primaryDomain === QUERY_DOMAINS.COMPARE_CHOOSE &&
      responseStrategy === "guided_recommendation");

  if (isGuidedProduct || (constraints.freshFactualCompare && constraints.explicitWeb)) {
    return {
      level: "high",
      why: [
        constraints.explicitWeb
          ? "explicit_web_request"
          : "product_or_compare_freshness",
        "comparative_decision",
      ],
      freshnessSensitive: true,
      comparative: true,
      explicitWebRequested: constraints.explicitWeb,
    };
  }

  if (responseStrategy === RESPONSE_STRATEGIES.WEB_LOOKUP) {
    return {
      level: "high",
      why: ["web_lookup_strategy"],
      freshnessSensitive: true,
      comparative: false,
      explicitWebRequested: true,
    };
  }

  if (freshness.preferWebRefresh) {
    return {
      level: freshness.riskScore >= 0.65 ? "high" : "medium",
      why: [freshness.reason || "freshness_risk"],
      freshnessSensitive: true,
      comparative: /\b(?:comparatif|versus|\bvs\b|meilleur)\b/i.test(query),
      explicitWebRequested: constraints.explicitWeb,
    };
  }

  return {
    level: "low",
    why: ["static_or_explanatory_knowledge"],
    freshnessSensitive: false,
    comparative: false,
    explicitWebRequested: constraints.explicitWeb,
  };
}

/**
 * @param {string} query
 * @param {ReturnType<typeof understandQuery>} understanding
 * @param {ReturnType<typeof resolveIntentAssessment>} intentAssessment
 */
function deriveRetrievalWebQuery(query, understanding, intentAssessment) {
  const { intentContractId, primaryDomain, responseStrategy } = intentAssessment;
  if (
    intentAssessment.constraints.researchThenSummarize ||
    isResearchThenSummarizeRequest(query)
  ) {
    return deriveResearchThenSummarizeWebQuery(query);
  }
  const isGuidedProduct =
    intentContractId === "GUIDED_PRODUCT_RECOMMENDATION" ||
    (primaryDomain === QUERY_DOMAINS.COMPARE_CHOOSE &&
      responseStrategy === "guided_recommendation");
  if (isGuidedProduct || intentAssessment.constraints.freshFactualCompare) {
    return deriveGuidedProductWebSearchQuery(query);
  }
  return null;
}

/**
 * Bloc 3 — décision retrieval (alignée sur action_decision).
 * @param {ReturnType<typeof resolveActionDecision>} actionDecision
 * @param {string} query
 * @param {ReturnType<typeof understandQuery>} understanding
 * @param {ReturnType<typeof resolveIntentAssessment>} intentAssessment
 * @param {ReturnType<typeof resolveEvidenceRequirement>} evidenceRequirement
 */
function resolveRetrievalDecision(
  query,
  understanding,
  intentAssessment,
  evidenceRequirement,
  actionDecision,
) {
  if (actionDecision?.capabilities?.web) {
    return {
      needsExternalInfo: true,
      sourceKind: "web",
      why: actionDecision.why.filter((w) => w.includes("web") || w.includes("evidence")).join("+") || "action_web",
      webQuery:
        actionDecision.webQuery ||
        deriveRetrievalWebQuery(query, understanding, intentAssessment),
      riskIfSkipped:
        evidenceRequirement.level === "high"
          ? "high"
          : evidenceRequirement.level === "medium"
            ? "medium"
            : "low",
    };
  }

  if (evidenceRequirement.level === "none") {
    return {
      needsExternalInfo: false,
      sourceKind: "none",
      why: evidenceRequirement.why[0] || "no_evidence_needed",
      webQuery: null,
      riskIfSkipped: "low",
    };
  }

  if (
    evidenceRequirement.level === "high" ||
    evidenceRequirement.level === "medium"
  ) {
    return {
      needsExternalInfo: true,
      sourceKind: "web",
      why: evidenceRequirement.why.join("+"),
      webQuery: deriveRetrievalWebQuery(query, understanding, intentAssessment),
      riskIfSkipped: evidenceRequirement.level === "high" ? "high" : "medium",
    };
  }

  return {
    needsExternalInfo: false,
    sourceKind: "none",
    why: "low_evidence_llm_sufficient",
    webQuery: null,
    riskIfSkipped: "low",
  };
}

/**
 * Bloc 4 — engagement de rendu contractuel (composer = renderer, pas décideur).
 * @param {ReturnType<typeof understandQuery>} understanding
 * @param {ReturnType<typeof resolveIntentAssessment>} intentAssessment
 * @param {ReturnType<typeof resolveEvidenceRequirement>} evidenceRequirement
 */
function resolveResponseCommitment(
  understanding,
  intentAssessment,
  evidenceRequirement,
) {
  const { constraints, intentContractId, primaryDomain, responseStrategy } =
    intentAssessment;

  if (responseStrategy === RESPONSE_STRATEGIES.PARTIAL_CLARIFY) {
    return {
      kind: "clarify_missing_slots",
      renderMode: "clarify",
      minItems: null,
      sections: ["blocking_question"],
      forbidClarification: false,
      insufficientEvidenceBehavior: null,
      evidenceAdaptation: "blocked_until_user",
      tone: "direct",
    };
  }

  if (
    responseStrategy === RESPONSE_STRATEGIES.DETERMINISTIC ||
    primaryDomain === QUERY_DOMAINS.SOCIAL ||
    primaryDomain === QUERY_DOMAINS.DATETIME
  ) {
    return {
      kind: "deterministic",
      renderMode: "deterministic",
      minItems: null,
      sections: ["direct_answer"],
      forbidClarification: true,
      insufficientEvidenceBehavior: null,
      evidenceAdaptation: "not_applicable",
      tone: "direct",
    };
  }

  const isGuidedProduct =
    intentContractId === "GUIDED_PRODUCT_RECOMMENDATION" ||
    (primaryDomain === QUERY_DOMAINS.COMPARE_CHOOSE &&
      responseStrategy === "guided_recommendation");

  if (isGuidedProduct) {
    return {
      kind: "guided_product_comparison",
      renderMode: "contractual_llm",
      minItems: constraints.minModels || 3,
      sections: [
        "context_one_liner",
        "items_with_strengths_weaknesses",
        "primary_recommendation",
        "freshness_caveat",
      ],
      forbidClarification: true,
      insufficientEvidenceBehavior: "product_sources_insufficient",
      evidenceAdaptation: "partial_offline_marked",
      tone: "direct_nuanced",
    };
  }

  if (
    evidenceRequirement.level === "high" ||
    evidenceRequirement.level === "medium"
  ) {
    return {
      kind: evidenceRequirement.comparative
        ? "evidence_backed_comparison"
        : "evidence_backed_factual",
      renderMode: "contractual_llm",
      minItems: evidenceRequirement.comparative ? 2 : null,
      sections: ["answer", "freshness_caveat"],
      forbidClarification: evidenceRequirement.explicitWebRequested,
      insufficientEvidenceBehavior: "honest_evidence_gap",
      evidenceAdaptation: "honest_gap_or_offline_marked",
      tone: "direct_nuanced",
    };
  }

  return {
    kind: primaryDomain || "general_explain",
    renderMode: "llm_direct",
    minItems: null,
    sections: ["direct_answer"],
    forbidClarification: false,
    insufficientEvidenceBehavior: null,
    evidenceAdaptation: "knowledge_only",
    tone: "direct",
  };
}

/**
 * Cycle cognitif factorisé — objet unique de décision par tour.
 * Toutes les policies amont doivent affiner ces 4 blocs, jamais ouvrir un couloir parallèle.
 *
 * @param {string} query
 * @param {ReturnType<typeof understandQuery>} understanding
 * @param {{ intentContractId?: string|null }} [options]
 */
export function buildRequestWorkup(query = "", understanding, options = {}) {
  const intent_assessment = resolveIntentAssessment(
    query,
    understanding,
    options,
  );
  const evidence_requirement = resolveEvidenceRequirement(
    query,
    understanding,
    intent_assessment,
  );
  const action_decision = resolveActionDecision(
    query,
    understanding,
    intent_assessment,
    evidence_requirement,
    options,
  );
  const retrieval_decision = resolveRetrievalDecision(
    query,
    understanding,
    intent_assessment,
    evidence_requirement,
    action_decision,
  );
  const response_commitment = resolveResponseCommitment(
    understanding,
    intent_assessment,
    evidence_requirement,
  );

  return {
    rule: COGNITIVE_CYCLE_RULE,
    understanding,
    intent_assessment,
    evidence_requirement,
    action_decision,
    retrieval_decision,
    response_commitment,
    /** @deprecated */ deduction: intent_assessment,
    /** @deprecated */ retrieval: retrieval_decision,
    /** @deprecated */ answerContract: response_commitment,
    plan: buildExecutionPlan(understanding),
  };
}

/** Alias explicite du cycle cognitif factorisé. */
export const buildCognitiveCycle = buildRequestWorkup;

/**
 * Gate unique intent-first : le cycle cognitif prime sur l'enrichissement amont.
 * @param {ReturnType<typeof buildRequestWorkup>|null} requestWorkup
 * @param {string|null} proposedWebKey
 * @param {string|null} [fallbackWebQuery]
 */
export function applyWorkupRetrievalGate(
  requestWorkup,
  proposedWebKey = null,
  fallbackWebQuery = null,
) {
  if (!requestWorkup) {
    return {
      forcedExpertKey: proposedWebKey,
      webQuery: fallbackWebQuery,
      source: "enrichment",
    };
  }

  const retrieval =
    requestWorkup.retrieval_decision || requestWorkup.retrieval || null;
  const action = requestWorkup.action_decision || null;

  if (action?.capabilities?.web === false && action.profile === "chat") {
    return {
      forcedExpertKey: null,
      webQuery: null,
      source: "chat_profile_skip_web",
    };
  }

  if (action?.capabilities?.web) {
    return {
      forcedExpertKey: proposedWebKey || "expert_web_search",
      webQuery: action.webQuery || retrieval?.webQuery || fallbackWebQuery,
      source: "action_decision",
    };
  }

  if (!retrieval) {
    return {
      forcedExpertKey: proposedWebKey,
      webQuery: fallbackWebQuery,
      source: "enrichment",
    };
  }

  if (retrieval.needsExternalInfo && retrieval.sourceKind === "web") {
    return {
      forcedExpertKey: proposedWebKey || "expert_web_search",
      webQuery: retrieval.webQuery || fallbackWebQuery,
      source: "cognitive_cycle",
    };
  }

  if (!retrieval.needsExternalInfo) {
    return {
      forcedExpertKey: null,
      webQuery: null,
      source: "cognitive_cycle_skip",
    };
  }

  return {
    forcedExpertKey: proposedWebKey,
    webQuery: fallbackWebQuery,
    source: "enrichment_fallback",
  };
}
