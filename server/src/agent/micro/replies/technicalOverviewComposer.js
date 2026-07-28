/**
 * Composer — aperçus techniques (concept / techno, local generative).
 */
import {
  isTechnicalOverviewRequest,
  parseTechnicalOverview,
} from "../../utils/technicalOverviewIntentGuards.js";
import { INSUFFICIENT_SIGNAL_REFUSAL } from "../../config/modeResponseContracts.js";

export const TECHNICAL_OVERVIEW_COMPOSER_RULE =
  "technical_overview_local_generative";

const SCOPE_LABELS = {
  intro: "notions de base",
  architecture: "architecture et rôle dans un système",
  standard: "vue d'ensemble équilibrée",
  deep: "approfondissement technique",
};

const AUDIENCE_LABELS = {
  general: "public technique général",
  junior: "profil junior / découverte",
  senior: "profil expérimenté",
};

/**
 * @param {import("../../utils/technicalOverviewIntentGuards.js").TechnicalOverviewSlots} slots
 * @returns {string}
 */
export function buildTechnicalOverviewSystemAddonFromSlots(slots) {
  const parts = [
    slots.techLabel || slots.tech || "la techno demandée",
    SCOPE_LABELS[slots.scope] || SCOPE_LABELS.standard,
    AUDIENCE_LABELS[slots.audience] || AUDIENCE_LABELS.general,
  ].filter(Boolean);

  return [
    "VARIANTE APERÇU TECHNIQUE (compréhension conceptuelle, pas debug ni procédure) :",
    `- Sujet : **${parts.join(" · ")}**.`,
    "FORMAT OBLIGATOIRE :",
    "1) Définition claire en 1–2 phrases (à quoi ça sert, dans quel contexte).",
    "2) 3 à 5 points : concepts clés, composants ou mécanismes importants.",
    "3) Cas d'usage typiques et limites / pièges courants.",
    "4) Lien avec l'écosystème adjacent (1–2 références utiles, sans liste exhaustive).",
    "INTERDIT :",
    `- « ${INSUFFICIENT_SIGNAL_REFUSAL} » ou clarification prématurée si le sujet est nommé.`,
    "- Mode debug (stack trace, correction d'erreur) — ce n'est PAS un diagnostic.",
    "- Tutoriel pas-à-pas install/config/deploy — rester sur la compréhension.",
    "- Réponse tronquée à 2 phrases.",
  ].join("\n");
}

/**
 * @param {string} query
 * @returns {string}
 */
export function buildTechnicalOverviewSystemAddon(query = "") {
  const slots = parseTechnicalOverview(query);
  if (slots) return buildTechnicalOverviewSystemAddonFromSlots(slots);
  return buildTechnicalOverviewSystemAddonFromSlots({
    intent: "technical_overview",
    tech: null,
    techLabel: "la techno demandée",
    scope: "standard",
    audience: "general",
    confidence: "low",
  });
}

/**
 * @param {string} query
 * @returns {{ path: string, deferToLlm: boolean, reflectiveHint: string, technicalOverview: boolean, slots?: import("../../utils/technicalOverviewIntentGuards.js").TechnicalOverviewSlots }|null}
 */
export function resolveTechnicalOverviewShortCircuit(query = "") {
  if (!isTechnicalOverviewRequest(query)) return null;

  const slots = parseTechnicalOverview(query);

  return {
    path: "technical_overview",
    deferToLlm: true,
    reflectiveHint: buildTechnicalOverviewSystemAddon(query),
    technicalOverview: true,
    slots,
  };
}
