/**
 * Politique de couverture pédagogique — décide comment livrer selon slots + couverture locale.
 *
 * Doctrine :
 * - local_deterministic : famille stable + module KB fiable
 * - local_generative    : slots clairs, pas de module local → LLM ancré (simpleFast)
 * - web_rag_grounded    : hors couverture, supérieur, fraîcheur ou source officielle
 */
import { requiresPedagogicalOfficialProgramEscalation } from "../../utils/pedagogicalOverviewIntentGuards.js";
import {
  resolvePedagogicalRenderLevel,
} from "../../utils/pedagogicalOverviewParser.js";
import {
  getPedagogicalTopicKnowledge,
} from "../../micro/replies/pedagogicalOverviewKnowledge.js";
import {
  COVERAGE_TIERS,
  isRegisteredPedagogicalTopic,
  resolveExpectedCoverageTier,
} from "./pedagogicalCoverageRegistry.js";

export { PEDAGOGICAL_COVERAGE_REGISTRY } from "./pedagogicalCoverageRegistry.js";

export const PEDAGOGICAL_COVERAGE_POLICY_V1 = "pedagogical_coverage_policy_v1";

export const PEDAGOGICAL_DELIVERY_MODES = {
  LOCAL_DETERMINISTIC: "local_deterministic",
  LOCAL_GENERATIVE: "local_generative",
  WEB_RAG_GROUNDED: "web_rag_grounded",
};

export const PEDAGOGICAL_PROVENANCE = {
  LOCAL_KB: "local_kb",
  LOCAL_LLM: "local_llm",
  WEB_RAG: "web_rag",
};

const VALID_COLLEGE_LEVELS = new Set(["3", "4", "5", "6"]);

const FRESHNESS_ESCALATION_RE =
  /\b(?:a\s+jour|à\s+jour|derniere\s+reforme|dernière\s+réforme|reforme\s+recente|réforme\s+récente|programme\s+202[0-9]|nouveau\s+programme|actualise|actualisé)\b/i;

/**
 * @param {import("../utils/pedagogicalOverviewParser.js").PedagogicalOverviewSlots} slots
 * @returns {boolean}
 */
export function hasLocalDeterministicModule(slots) {
  if (!slots?.topic) return false;
  const knowledge = getPedagogicalTopicKnowledge(slots.topic);
  if (!knowledge) return false;
  const renderLevel = resolvePedagogicalRenderLevel(slots, knowledge);
  if (!renderLevel || !knowledge.levelModules[renderLevel]) return false;

  const tier = resolveExpectedCoverageTier(
    slots.topic,
    VALID_COLLEGE_LEVELS.has(renderLevel) ? renderLevel : null,
    slots.educationBand ?? (slots.lyceeGrade ? "lycee" : null),
  );
  return tier === COVERAGE_TIERS.KB_DETERMINISTIC;
}

/**
 * @param {import("../utils/pedagogicalOverviewParser.js").PedagogicalOverviewSlots} slots
 * @returns {boolean}
 */
export function isStablePedagogicalFamily(slots) {
  return isRegisteredPedagogicalTopic(slots?.topic);
}

/**
 * @param {import("../utils/pedagogicalOverviewParser.js").PedagogicalOverviewSlots} slots
 * @returns {import("./pedagogicalCoverageRegistry.js").CoverageTier|null}
 */
export function getExpectedCoverageTier(slots) {
  if (!slots?.topic) return null;
  const band =
    slots.educationBand ?? (slots.lyceeGrade ? "lycee" : null);
  return resolveExpectedCoverageTier(slots.topic, slots.level || null, band);
}

/**
 * @param {string} query
 * @param {import("../utils/pedagogicalOverviewParser.js").PedagogicalOverviewSlots} slots
 * @returns {{
 *   mode: string,
 *   provenance: string,
 *   reason: string,
 *   confidence: import("../utils/pedagogicalOverviewParser.js").SlotConfidence,
 *   policy: string,
 * }}
 */
export function resolvePedagogicalCoverage(query = "", slots) {
  if (!slots) {
    return {
      mode: PEDAGOGICAL_DELIVERY_MODES.WEB_RAG_GROUNDED,
      provenance: PEDAGOGICAL_PROVENANCE.WEB_RAG,
      reason: "slots_missing",
      confidence: "low",
      policy: PEDAGOGICAL_COVERAGE_POLICY_V1,
    };
  }

  if (requiresPedagogicalOfficialProgramEscalation(query)) {
    return {
      mode: PEDAGOGICAL_DELIVERY_MODES.WEB_RAG_GROUNDED,
      provenance: PEDAGOGICAL_PROVENANCE.WEB_RAG,
      reason: "official_program_requested",
      confidence: slots.confidence,
      policy: PEDAGOGICAL_COVERAGE_POLICY_V1,
    };
  }

  if (slots.educationBand === "superieur") {
    return {
      mode: PEDAGOGICAL_DELIVERY_MODES.WEB_RAG_GROUNDED,
      provenance: PEDAGOGICAL_PROVENANCE.WEB_RAG,
      reason: "superieur_out_of_local_kb",
      confidence: slots.confidence,
      policy: PEDAGOGICAL_COVERAGE_POLICY_V1,
    };
  }

  if (FRESHNESS_ESCALATION_RE.test(String(query || ""))) {
    return {
      mode: PEDAGOGICAL_DELIVERY_MODES.WEB_RAG_GROUNDED,
      provenance: PEDAGOGICAL_PROVENANCE.WEB_RAG,
      reason: "freshness_required",
      confidence: slots.confidence,
      policy: PEDAGOGICAL_COVERAGE_POLICY_V1,
    };
  }

  if (hasLocalDeterministicModule(slots)) {
    return {
      mode: PEDAGOGICAL_DELIVERY_MODES.LOCAL_DETERMINISTIC,
      provenance: PEDAGOGICAL_PROVENANCE.LOCAL_KB,
      reason: "local_kb_module_available",
      confidence: "high",
      policy: PEDAGOGICAL_COVERAGE_POLICY_V1,
      expectedTier: COVERAGE_TIERS.KB_DETERMINISTIC,
    };
  }

  const expectedTier = getExpectedCoverageTier(slots);
  if (expectedTier === COVERAGE_TIERS.WEB_ONLY) {
    return {
      mode: PEDAGOGICAL_DELIVERY_MODES.WEB_RAG_GROUNDED,
      provenance: PEDAGOGICAL_PROVENANCE.WEB_RAG,
      reason: "registry_web_only_tier",
      confidence: slots.confidence,
      policy: PEDAGOGICAL_COVERAGE_POLICY_V1,
      expectedTier,
    };
  }

  const hasTopicAnchor = Boolean(slots.topic || slots.topicLabel);
  const hasLevelAnchor = Boolean(
    slots.level || slots.lyceeGrade || slots.depth || slots.educationBand,
  );

  if (isStablePedagogicalFamily(slots) && hasLevelAnchor) {
    return {
      mode: PEDAGOGICAL_DELIVERY_MODES.LOCAL_GENERATIVE,
      provenance: PEDAGOGICAL_PROVENANCE.LOCAL_LLM,
      reason: "stable_family_pending_kb_module",
      confidence: slots.confidence === "low" ? "medium" : slots.confidence,
      policy: PEDAGOGICAL_COVERAGE_POLICY_V1,
    };
  }

  if (hasTopicAnchor && hasLevelAnchor && slots.confidence !== "low") {
    return {
      mode: PEDAGOGICAL_DELIVERY_MODES.LOCAL_GENERATIVE,
      provenance: PEDAGOGICAL_PROVENANCE.LOCAL_LLM,
      reason: "slots_clear_no_local_module",
      confidence: slots.confidence,
      policy: PEDAGOGICAL_COVERAGE_POLICY_V1,
    };
  }

  if (hasTopicAnchor && slots.confidence === "medium") {
    return {
      mode: PEDAGOGICAL_DELIVERY_MODES.LOCAL_GENERATIVE,
      provenance: PEDAGOGICAL_PROVENANCE.LOCAL_LLM,
      reason: "partial_slots_local_first",
      confidence: "medium",
      policy: PEDAGOGICAL_COVERAGE_POLICY_V1,
    };
  }

  return {
    mode: PEDAGOGICAL_DELIVERY_MODES.WEB_RAG_GROUNDED,
    provenance: PEDAGOGICAL_PROVENANCE.WEB_RAG,
    reason: "insufficient_local_coverage",
    confidence: "low",
    policy: PEDAGOGICAL_COVERAGE_POLICY_V1,
  };
}

/**
 * @param {import("../utils/pedagogicalOverviewParser.js").PedagogicalOverviewSlots} slots
 * @returns {string}
 */
export function buildPedagogicalWebGroundedAddon(slots) {
  const parts = [
    slots.topicLabel || slots.topic || "le sujet demandé",
    slots.levelLabel || slots.educationBand || null,
  ].filter(Boolean);

  return [
    "VARIANTE APERÇU PÉDAGOGIQUE — RECHERCHE DOCUMENTÉE (web/RAG) :",
    `- Sujet / niveau : **${parts.join(" · ")}**.`,
    "Le socle local ne couvre pas assez ce cas — appuyer la réponse sur des sources fiables.",
    "FORMAT OBLIGATOIRE :",
    "1) Réponse structurée (notions, compétences, ordre logique).",
    "2) Adapter au niveau demandé (primaire → supérieur).",
    "3) Citer ou indiquer la nature des sources (programme, BO, site institutionnel) quand pertinent.",
    "4) Distinguer socle classique et éventuelle réforme récente si les sources divergent.",
    "INTERDIT : inventer un programme officiel ; répondre comme une fiche locale figée sans source.",
  ].join("\n");
}
