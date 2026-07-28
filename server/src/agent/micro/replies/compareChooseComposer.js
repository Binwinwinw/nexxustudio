/**
 * Composer — comparatif / choix / recommandation (pipeline complet, pas SIMPLE_FAST tronqué).
 */
import {
  isCompareChooseRequest,
  parseCompareChoose,
  SELECTIVE_DECISION_TASKS,
} from "../../utils/compareChooseIntentGuards.js";
import { buildDirectArbitrationSystemAddon } from "./directArbitrationComposerContract.js";
import { INSUFFICIENT_SIGNAL_REFUSAL } from "../../config/modeResponseContracts.js";
import { hasSuccessfulWebGrounding } from "../../policies/knowledgeFreshnessPolicy.js";
import { buildKnowledgeFreshnessUserAddon } from "./knowledgeFreshnessComposerContract.js";
import responseThinkingCleaner from "../../utils/responseThinkingCleaner.js";

export const GUIDED_PRODUCT_RECOMMENDATION_COMPOSER_RULE =
  "guided_product_recommendation_composer_g31_5";

const COMPARE_CHOOSE_REFUSAL_RE =
  /\b(?:je vois la piste|pas encore la destination|objectif en une phrase|donne[- ]moi l['']objectif)\b/i;

export const COMPARE_CHOOSE_COMPOSER_RULE =
  "compare_choose_full_pipeline_generative";

const TASK_LABELS = {
  [SELECTIVE_DECISION_TASKS.COMPARATIVE]: "comparatif",
  [SELECTIVE_DECISION_TASKS.RECOMMENDATION]: "recommandation",
  [SELECTIVE_DECISION_TASKS.ARBITRATION]: "arbitrage",
  [SELECTIVE_DECISION_TASKS.RANKING]: "classement",
  [SELECTIVE_DECISION_TASKS.CONSTRAINED_CHOICE]: "choix contraint",
};

const DOMAIN_LABELS = {
  tech: "technologie / infra",
  culinary: "culinaire",
  product: "produit / achat",
  general: "savoir général",
};

/**
 * @param {import("../../utils/compareChooseIntentGuards.js").CompareChooseSlots} slots
 * @returns {string}
 */
export function buildCompareChooseSystemAddonFromSlots(slots) {
  const taskLabel =
    TASK_LABELS[slots.primaryTask || ""] ||
    TASK_LABELS[SELECTIVE_DECISION_TASKS.COMPARATIVE];
  const optionsLine =
    slots.options.length >= 2
      ? slots.options.join(" · ")
      : "options à inférer depuis la demande";
  const criterionLine = slots.criterion
    ? `Critère explicite : **${slots.criterion.label}**.`
    : "Critère implicite — le déduire ou le nommer brièvement avant de trancher.";

  return [
    "VARIANTE COMPARE / CHOOSE (charge décisionnelle — pas aperçu conceptuel ni debug) :",
    `- Mode : **${taskLabel}** · domaine **${DOMAIN_LABELS[slots.domain] || DOMAIN_LABELS.general}**.`,
    `- Options visées : ${optionsLine}.`,
    criterionLine,
    "FORMAT OBLIGATOIRE :",
    "1) Reformuler la question de décision et le critère retenu.",
    "2) Comparer 2 à 4 options plausibles (forces / limites / compromis).",
    "3) Recommander UNE option principale avec justification — ou expliquer clairement pourquoi aucune option ne domine.",
    "4) Mentionner ce qui pourrait faire basculer la recommandation (contexte manquant).",
    "INTERDIT :",
    `- « ${INSUFFICIENT_SIGNAL_REFUSAL} » si des options ou un critère sont identifiables.`,
    "- Clarify-first si le critère est déjà dans la question.",
    "- Tutoriel pas-à-pas ou diagnostic d'incident — ce n'est PAS procedure ni debug.",
    "- Aperçu « c'est quoi X » sans trancher — ce n'est PAS un technical overview.",
    "- Réponse tronquée à 2 phrases ou liste d'options sans recommandation.",
  ].join("\n");
}

/**
 * @param {string} query
 * @returns {string}
 */
export function buildCompareChooseSystemAddon(query = "") {
  const slots = parseCompareChoose(query);
  if (!slots) {
    return buildCompareChooseSystemAddonFromSlots({
      intent: "compare_choose",
      primaryTask: SELECTIVE_DECISION_TASKS.COMPARATIVE,
      tasks: [SELECTIVE_DECISION_TASKS.COMPARATIVE],
      options: [],
      criterion: null,
      domain: "general",
      directArbitration: false,
      confidence: "low",
    });
  }

  const base = buildCompareChooseSystemAddonFromSlots(slots);
  if (slots.directArbitration) {
    return `${base}\n\n${buildDirectArbitrationSystemAddon(query)}`;
  }
  return base;
}

/**
 * @param {string} query
 * @param {{ meta?: object }} [packet]
 * @returns {boolean}
 */
export function requiresCompareChooseComposerContract(query = "", packet = {}) {
  if (packet?.meta?.intent_contract_id === "GUIDED_PRODUCT_RECOMMENDATION") {
    return true;
  }
  return isCompareChooseRequest(query);
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isCompareChooseContractViolation(text = "") {
  const cleaned = String(text || "").trim();
  if (!cleaned) return true;
  if (cleaned === INSUFFICIENT_SIGNAL_REFUSAL) return true;
  return COMPARE_CHOOSE_REFUSAL_RE.test(cleaned);
}

/**
 * @param {object} packet
 * @param {{ freshnessUserAddon?: string }} [options]
 * @returns {string}
 */
export function buildGuidedProductComposerUserPrompt(
  packet = {},
  { freshnessUserAddon = "" } = {},
) {
  const query =
    packet.meta?.product_reco_anchor_query || packet.user_query || "";
  const webAddon = buildKnowledgeFreshnessUserAddon(query, packet);
  const expertSynthesis = (packet.expert_outputs || [])
    .filter((o) => o?.content && String(o.content).length > 10)
    .map((o) => responseThinkingCleaner.clean(String(o.content)).trim())
    .join("\n\n")
    .slice(0, 6000);

  const contextBlock = webAddon || expertSynthesis || packet.quick_answer || "";
  const minModelsMatch = query.match(/\b(?:au\s+moins\s+)?(\d+)\s+mod[eè]les?\b/i);
  const minModels = minModelsMatch ? Number(minModelsMatch[1]) : 3;
  const hasWeb = hasSuccessfulWebGrounding(packet);
  const sourcesInsufficient = Boolean(packet?.meta?.product_sources_insufficient);
  const answerContract =
    packet?.meta?.cognitive_cycle?.response_commitment ||
    packet?.meta?.request_workup?.response_commitment ||
    packet?.meta?.request_workup?.answerContract ||
    packet?.meta?.request_workup?.answer_contract ||
    null;

  const lines = [
    `REQUÊTE UTILISATEUR (priorité absolue) :\n"${query}"`,
    "",
    hasWeb
      ? sourcesInsufficient
        ? "Les sources web trouvées ne contiennent pas de comparatif produit exploitable (guides procédure, pas modèles/prix). Explique-le clairement ; ne demande pas de précision sur l'objectif utilisateur."
        : "Des sources web ont été consultées — ancre modèles, gammes et compromis sur le bloc ci-dessous."
      : "Pas de sources web fiables — donne des repères généraux en signalant l'incertitude sur prix/modèles récents.",
    "",
    contextBlock
      ? `CONTEXTE WEB / EXPERT :\n${contextBlock}`
      : "CONTEXTE : critère et sujet déjà dans la requête (upgrade GPU, rapport qualité/prix).",
    "",
    "CONSIGNE CRITIQUE — RECOMMANDATION PRODUIT :",
    `- Propose **au moins ${minModels} modèles** pertinents avec forces/limites et rapport qualité/prix.`,
    "- Recommande UNE option principale en fin de réponse.",
    `- INTERDIT : « ${INSUFFICIENT_SIGNAL_REFUSAL} » et toute demande de précision sur l'objectif.`,
    "- INTERDIT : plan de présentation, slides, ou monologue sur le rôle de Nexxus.",
    "- Format : réponse utilisateur directe, 2–4 paragraphes ou liste courte par modèle.",
    "- OBLIGATOIRE si des URLs web sont dans le contexte : section finale **Sources** avec liens markdown `[titre](url)` (pas seulement des noms de sites).",
  ];

  if (answerContract?.kind === "guided_product_comparison") {
    lines.push(
      "",
      "FORMAT OBLIGATOIRE (4 points) :",
      `1. Intro — 1 phrase de cadrage (upgrade${answerContract.minItems ? `, ≥${answerContract.minItems} modèles` : ""}).`,
      "2. Pour chaque modèle : nom · positionnement · force · limite (rapport qualité/prix).",
      "3. Recommandation principale — un choix clair avec pourquoi.",
      "4. Note fraîcheur — prix/disponibilité peuvent bouger, à vérifier chez un revendeur.",
    );
  }

  if (sourcesInsufficient) {
    lines.push(
      "",
      "SOURCES WEB INSUFFISANTES — les pages trouvées sont procédurales (installation/changement), pas comparatif produit.",
      "Dis-le explicitement ; propose des repères offline marqués indicatifs si pertinent ; ne demande pas de reformuler l'objectif.",
    );
  }

  if (freshnessUserAddon) {
    lines.push("", freshnessUserAddon);
  }

  return lines.join("\n");
}

/**
 * @param {string} query
 * @returns {{ path: string, deferToLlm: boolean, deferToFullPipeline: boolean, reflectiveHint: string, compareChoose: boolean, slots?: import("../../utils/compareChooseIntentGuards.js").CompareChooseSlots }|null}
 */
export function resolveCompareChooseShortCircuit(query = "") {
  if (!isCompareChooseRequest(query)) return null;

  const slots = parseCompareChoose(query);

  return {
    path: "compare_choose",
    deferToLlm: true,
    deferToFullPipeline: true,
    reflectiveHint: buildCompareChooseSystemAddon(query),
    compareChoose: true,
    slots,
  };
}
