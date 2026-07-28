/**
 * Contrat composer « arbitrage direct » — critère explicite → pas de clarify-first.
 */
import { normalizeFamiliarityQuery } from "../../utils/familiarityIntentGuards.js";
import {
  classifySelectiveDecisionIntent,
  SELECTIVE_DECISION_TASKS,
} from "../../utils/selectiveDecisionIntentGuards.js";

export const DIRECT_ARBITRATION_COMPOSER_RULE =
  "explicit_criterion_direct_arbitration_no_clarify_first";

const EXPLICIT_CRITERION_PATTERNS = [
  {
    id: "speed",
    pattern:
      /\b(?:le|la|les)\s+plus\s+(?:rapide|vite)\b|\bplus\s+rapide\s+(?:a|à)\s+servir\b|\brapidite de service\b|\brapidité de service\b/,
    label: "rapidité de service",
  },
  {
    id: "simplicity",
    pattern: /\b(?:le|la|les)\s+plus\s+simple\b|\bplus\s+simple\b/,
    label: "simplicité",
  },
  {
    id: "reliability",
    pattern: /\b(?:le|la|les)\s+plus\s+fiable\b|\bplus\s+fiable\b/,
    label: "fiabilité",
  },
  {
    id: "fit",
    pattern: /\b(?:le|la|les)\s+plus\s+adapt[ée]\b|\badapt[ée]\s+(?:a|à|pour)\b/,
    label: "adéquation au besoin",
  },
  {
    id: "best",
    pattern: /\b(?:le|la|les)\s+meilleur(?:e|es|s)?\b/,
    label: "meilleur choix global",
  },
  {
    id: "economy",
    pattern: /\b(?:le|la|les)\s+plus\s+(?:economique|économique)\b|\bbon\s+rapport\s+qualite\b|\bbon\s+rapport\s+qualité\b/,
    label: "économie / rapport qualité-prix",
  },
];

const CLARIFY_FIRST_VIOLATION_PATTERN =
  /\b(?:precisez|précisez|preciser|préciser)\b.{0,80}\b(?:preference|préférence|choix|option)\b|\bune\s+fois\s+que\s+je\s+connaitrai\s+votre\s+choix\b/i;

function normalizeQuery(query = "") {
  return normalizeFamiliarityQuery(query);
}

/**
 * @param {string} query
 * @returns {{ id: string, label: string }|null}
 */
export function extractExplicitDecisionCriterion(query = "") {
  const q = normalizeQuery(query);
  if (!q) return null;

  for (const entry of EXPLICIT_CRITERION_PATTERNS) {
    if (entry.pattern.test(q)) {
      return { id: entry.id, label: entry.label };
    }
  }
  return null;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function hasExplicitDecisionCriterion(query = "") {
  return extractExplicitDecisionCriterion(query) !== null;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function requiresDirectArbitrationContract(query = "") {
  const classification = classifySelectiveDecisionIntent(query);
  if (!classification.detected) return false;
  return hasExplicitDecisionCriterion(query);
}

/**
 * @param {string} query
 * @returns {string}
 */
export function buildDirectArbitrationSystemAddon(query = "") {
  const criterion = extractExplicitDecisionCriterion(query);
  const classification = classifySelectiveDecisionIntent(query);
  const criterionLabel = criterion?.label || "critère explicite de la demande";

  return [
    "VARIANTE ARBITRAGE DIRECT (charge décisionnelle — critère déjà fourni) :",
    `- Critère utilisateur : **${criterionLabel}**.`,
    `- Tâches détectées : ${classification.tasks.join(", ") || "sélection"}.`,
    "FORMAT OBLIGATOIRE en un seul message :",
    "1) Rappeler le critère en une phrase.",
    "2) Comparer 2 à 4 options plausibles (même sans contexte expert riche).",
    "3) Recommander UNE option principale avec justification courte.",
    "4) Donner un détail opérationnel optionnel (étapes/quantités/conseil) si pertinent.",
    "INTERDIT :",
    "- « Je n'ai pas assez d'éléments fiables » pour du savoir général ou des classiques connus.",
    "- Demander une préférence utilisateur si le critère est déjà dans la question (pas de clarify-first).",
    "- Promettre webSearch, webSummarize ou un outil non exécuté dans ce tour.",
    "- Lister des options puis s'arrêter sans trancher.",
  ].join("\n");
}

/**
 * @param {string} query
 * @param {{ expertSynthesis?: string, quickAnswer?: string }} [ctx]
 * @returns {string}
 */
export function buildDirectArbitrationUserPrompt(query = "", ctx = {}) {
  const criterion = extractExplicitDecisionCriterion(query);
  const expertSynthesis = String(ctx.expertSynthesis || "").trim();
  const quickAnswer = String(ctx.quickAnswer || "").trim();
  const contextBlock =
    expertSynthesis || quickAnswer
      ? `Contexte expert (si utile) :\n${expertSynthesis || quickAnswer}\n\n`
      : "Contexte expert : vide — tu peux arbitrer avec des classiques plausibles et le critère explicite.\n\n";

  return `${contextBlock}Demande utilisateur :
"${String(query || "").trim()}"

CONSIGNE ARBITRAGE DIRECT :
- Critère : ${criterion?.label || "celui de la question"}.
- Compare puis tranche. Pas de question de clarification préalable.
- Réponse structurée, utile, en français.`;
}

export function isClarifyFirstViolation(text = "") {
  return CLARIFY_FIRST_VIOLATION_PATTERN.test(String(text || ""));
}

export function isDirectArbitrationContractViolation(query = "", text = "") {
  if (!requiresDirectArbitrationContract(query)) return false;
  const body = String(text || "");
  if (!body.trim()) return true;
  if (/je n['']?ai pas assez d['']?elements fiables/i.test(body)) return true;
  if (isClarifyFirstViolation(body)) return true;
  if (/\bwebSummarize\b/i.test(body) && !/\bwebSummarize\b.*\b(execut|exécut|utilisé|utilise|preuve|source)\b/i.test(body)) {
    return true;
  }
  return false;
}
