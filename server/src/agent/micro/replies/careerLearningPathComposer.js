/**
 * Composer — parcours carrière / formation pro (local generative).
 */
import {
  isCareerLearningPathRequest,
  parseCareerLearningPath,
} from "../../utils/careerLearningPathIntentGuards.js";
import { INSUFFICIENT_SIGNAL_REFUSAL } from "../../config/modeResponseContracts.js";

export const CAREER_LEARNING_PATH_COMPOSER_RULE =
  "career_learning_path_local_generative";

const EXPERIENCE_LABELS = {
  none: "sans expérience supposée",
  junior: "profil junior / débutant pro",
  mid: "profil intermédiaire / confirmé",
  switcher: "reconversion",
  unknown: "point de départ à préciser",
};

const HORIZON_LABELS = {
  short: "horizon court (≈ 6–12 mois)",
  medium: "horizon moyen (≈ 1–2 ans)",
  long: "horizon long (plusieurs années)",
  unknown: "horizon non précisé",
};

const SCOPE_LABELS = {
  overview: "vue d'ensemble du parcours",
  roadmap: "roadmap par phases",
  skills: "compétences clés à acquérir",
  certifications: "diplômes / certifications possibles",
};

/**
 * @param {import("../../utils/careerLearningPathIntentGuards.js").CareerLearningPathSlots} slots
 * @returns {string}
 */
export function buildCareerLearningPathSystemAddonFromSlots(slots) {
  const parts = [
    slots.targetRoleLabel || slots.targetRole || "le métier visé",
    EXPERIENCE_LABELS[slots.experienceLevel] || EXPERIENCE_LABELS.unknown,
    HORIZON_LABELS[slots.horizon] || HORIZON_LABELS.unknown,
    SCOPE_LABELS[slots.scope] || SCOPE_LABELS.overview,
  ].filter(Boolean);

  return [
    "VARIANTE PARCOURS CARRIÈRE / FORMATION PRO (roadmap, pas cours scolaire ni admin) :",
    `- Cible : **${parts.join(" · ")}**.`,
    "FORMAT OBLIGATOIRE :",
    "1) Reformuler le métier visé et le point de départ supposé (débutant, reconversion…).",
    "2) Phases ordonnées : socle → compétences cœur → pratique/portfolio → employabilité.",
    "3) Compétences, outils et pratiques clés — sans catalogue exhaustif ni promesse de délai garanti.",
    "4) Diplômes/certifications **possibles** (pas obligatoires inventés) + prochaines étapes concrètes.",
    "INTERDIT :",
    `- « ${INSUFFICIENT_SIGNAL_REFUSAL} » si le métier ou objectif est identifiable.`,
    "- Programme scolaire 6e–terminale — ce n'est PAS du pédagogique scolaire.",
    "- Démarche administrative officielle (CAF, impôts…) — ce n'est PAS admin_procedure.",
    "- Aperçu technique pur « c'est quoi X » sans fil carrière.",
    "- Conseil salaire garanti, promesse d'embauche ou certificat obligatoire non vérifiable.",
    "- Réponse tronquée à 2 phrases.",
  ].join("\n");
}

/**
 * @param {string} query
 * @returns {string}
 */
export function buildCareerLearningPathSystemAddon(query = "") {
  const slots = parseCareerLearningPath(query);
  if (slots) return buildCareerLearningPathSystemAddonFromSlots(slots);
  return buildCareerLearningPathSystemAddonFromSlots({
    intent: "career_learning_path",
    targetRole: null,
    targetRoleLabel: "le métier visé",
    experienceLevel: "unknown",
    horizon: "unknown",
    domain: "general",
    scope: "overview",
    confidence: "low",
  });
}

/**
 * @param {string} query
 * @returns {{ path: string, deferToLlm: boolean, reflectiveHint: string, careerLearningPath: boolean, slots?: import("../../utils/careerLearningPathIntentGuards.js").CareerLearningPathSlots }|null}
 */
export function resolveCareerLearningPathShortCircuit(query = "") {
  if (!isCareerLearningPathRequest(query)) return null;

  const slots = parseCareerLearningPath(query);

  return {
    path: "career_learning_path",
    deferToLlm: true,
    reflectiveHint: buildCareerLearningPathSystemAddon(query),
    careerLearningPath: true,
    slots,
  };
}
