/**
 * Composer — aperçus pédagogiques paramétrés (intent + slots + rendu).
 * La fiche locale n'est plus une réponse brute figée : slots → modules par niveau.
 */
import {
  isPedagogicalOverviewRequest,
  extractPedagogicalSubject,
} from "../../utils/pedagogicalOverviewIntentGuards.js";
import {
  parsePedagogicalOverview,
  resolvePedagogicalRenderLevel,
} from "../../utils/pedagogicalOverviewParser.js";
import {
  getPedagogicalTopicKnowledge,
} from "./pedagogicalOverviewKnowledge.js";
import { INSUFFICIENT_SIGNAL_REFUSAL } from "../../config/modeResponseContracts.js";
import {
  PEDAGOGICAL_DELIVERY_MODES,
  resolvePedagogicalCoverage,
  buildPedagogicalWebGroundedAddon,
} from "../../policies/pedagogicalCoveragePolicy.js";

export const PEDAGOGICAL_OVERVIEW_COMPOSER_RULE =
  "answerable_overview_pedagogic_local_first";

const FOOTER_DISCLAIMER =
  "C'est un aperçu de socle cycle 3 — pas le programme officiel BO complet. Si tu veux le référentiel officiel ou des exercices ciblés, dis-le.";

/**
 * @param {import("../../utils/pedagogicalOverviewParser.js").PedagogicalOverviewSlots} slots
 * @param {import("./pedagogicalOverviewKnowledge.js").PedagogicalLevelModule} module
 * @returns {string}
 */
export function renderPedagogicalOverview(slots, module) {
  const levelPart = module.levelLabel || slots.levelLabel || "niveau indiqué";
  const topicPart =
    slots.topicLabel ||
    module.headlineQualifier ||
    slots.topic ||
    "le thème demandé";

  const lines = [
    `Voici le **socle attendu en ${levelPart}** pour **${topicPart}** :`,
    "",
  ];

  for (const section of module.sections) {
    lines.push(`- **${section.title}** : ${section.bullets.join(" ; ")}.`);
  }

  lines.push("", FOOTER_DISCLAIMER);
  return lines.join("\n");
}

/**
 * @param {import("../../utils/pedagogicalOverviewParser.js").PedagogicalOverviewSlots} slots
 * @returns {string|null}
 */
export function renderPedagogicalOverviewFromSlots(slots) {
  if (!slots?.topic) return null;

  const knowledge = getPedagogicalTopicKnowledge(slots.topic);
  if (!knowledge) return null;

  const renderLevel = resolvePedagogicalRenderLevel(slots, knowledge);
  if (!renderLevel) return null;

  const module = knowledge.levelModules[renderLevel];
  if (!module) return null;

  return renderPedagogicalOverview(slots, module);
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function resolvePedagogicalOverviewReply(query = "") {
  if (!isPedagogicalOverviewRequest(query)) return null;

  const slots = parsePedagogicalOverview(query);
  if (!slots) return null;

  return renderPedagogicalOverviewFromSlots(slots);
}

/**
 * @param {import("../../utils/pedagogicalOverviewParser.js").PedagogicalOverviewSlots} slots
 * @returns {string}
 */
export function buildPedagogicalOverviewSystemAddonFromSlots(slots) {
  const parts = [
    slots.topicLabel || slots.topic || "le sujet demandé",
    slots.levelLabel ? `niveau ${slots.levelLabel}` : null,
    slots.lyceeGrade && !slots.levelLabel ? `niveau ${slots.lyceeGrade}` : null,
    slots.depth === "advanced"
      ? "profondeur avancée"
      : slots.depth === "intro"
        ? "notions introductives"
        : null,
  ].filter(Boolean);

  const subjectLine = parts.join(" · ") || "le sujet demandé";

  return [
    "VARIANTE APERÇU PÉDAGOGIQUE (réponse directe, sans clarify-first) :",
    `- Sujet / niveau visé : **${subjectLine}**.`,
    "FORMAT OBLIGATOIRE :",
    "1) Réponse directe en 3 à 5 puces (notions de base, vocabulaire, compétences attendues).",
    "2) Adapter strictement au niveau scolaire mentionné (6e, 5e, 4e, 3e) si présent.",
    "3) Si le niveau ou la difficulté change (simples vs complexes), adapter le contenu — ne pas répéter un aperçu d'un autre niveau.",
    "4) Rester sur le socle classique — pas de recherche web ni de programme officiel BO sauf demande explicite.",
    "INTERDIT :",
    `- « ${INSUFFICIENT_SIGNAL_REFUSAL} » ou toute demande d'objectif/format.`,
    "- Orchestration lourde, menu d'options vide, ou refus faute de contexte.",
    "- Réponse tronquée à 2 phrases.",
  ].join("\n");
}

/**
 * @param {string} query
 * @returns {string}
 */
export function buildPedagogicalOverviewSystemAddon(query = "") {
  const slots = parsePedagogicalOverview(query);
  if (slots) {
    return buildPedagogicalOverviewSystemAddonFromSlots(slots);
  }
  const subject = extractPedagogicalSubject(query) || "le sujet demandé";
  return buildPedagogicalOverviewSystemAddonFromSlots({
    intent: "pedagogical_overview",
    topic: null,
    topicLabel: subject,
    matiere: null,
    level: null,
    levelLabel: null,
    depth: null,
    educationBand: null,
    scope: "overview",
    confidence: "low",
    missingSlots: ["topic", "level"],
  });
}

/**
 * @param {string} query
 * @returns {{ path: string, reply?: string, deferToLlm?: boolean, deferToFullPipeline?: boolean, reflectiveHint?: string, slots?: import("../../utils/pedagogicalOverviewParser.js").PedagogicalOverviewSlots, coverage?: ReturnType<typeof resolvePedagogicalCoverage> }|null}
 */
export function resolvePedagogicalOverviewShortCircuit(query = "") {
  if (!isPedagogicalOverviewRequest(query)) return null;

  const slots = parsePedagogicalOverview(query);
  if (!slots) return null;

  const coverage = resolvePedagogicalCoverage(query, slots);

  if (coverage.mode === PEDAGOGICAL_DELIVERY_MODES.WEB_RAG_GROUNDED) {
    return {
      path: "pedagogical_overview_web",
      deferToFullPipeline: true,
      deferToLlm: true,
      reflectiveHint: buildPedagogicalWebGroundedAddon(slots),
      slots,
      coverage,
    };
  }

  if (coverage.mode === PEDAGOGICAL_DELIVERY_MODES.LOCAL_DETERMINISTIC) {
    const local = renderPedagogicalOverviewFromSlots(slots);
    if (local) {
      return {
        path: "pedagogical_overview_deterministic",
        reply: local,
        slots,
        coverage,
      };
    }
  }

  return {
    path: "pedagogical_overview",
    deferToLlm: true,
    reflectiveHint: buildPedagogicalOverviewSystemAddonFromSlots(slots),
    slots,
    coverage,
  };
}
