/**
 * Composer — recherche externe puis synthèse (GitHub, repo, etc.).
 */
import responseThinkingCleaner from "../../utils/responseThinkingCleaner.js";
import { isResearchThenSummarizeRequest } from "../../policies/routing/researchThenSummarizePolicy.js";
import { extractResearchThenSummarizeTarget } from "../../policies/routing/researchThenSummarizePolicy.js";

const DENIAL_RE =
  /\b(?:je n['']?ai pas trouv(?:é|e)|pas (?:de )?trace|aucun(?:e)? (?:projet|d[eé]p[oô]t|repo)|open[- ]source notable|rien trouv(?:é|e)|donn[eé]es insuffisantes)\b/i;

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isResearchThenSummarizeContractViolation(text = "") {
  const cleaned = String(text || "").trim();
  if (!cleaned) return true;
  return DENIAL_RE.test(cleaned);
}

/**
 * @param {string} query
 * @param {{ meta?: object }} [packet]
 * @returns {boolean}
 */
export function requiresResearchThenSummarizeComposerContract(
  query = "",
  packet = {},
) {
  if (packet?.meta?.intent_contract_id === "RESEARCH_THEN_SUMMARIZE") {
    return true;
  }
  return isResearchThenSummarizeRequest(query);
}

/**
 * @param {object} packet
 * @returns {boolean}
 */
function hasSuccessfulWebGrounding(packet = {}) {
  return (
    Boolean(packet?.meta?.web_consulted_at) ||
    (packet?.evidence || []).length > 0 ||
    (packet?.expert_outputs || []).some(
      (output) => output?.stage === "web_research" && output?.content,
    )
  );
}

/**
 * @param {object} packet
 * @param {{ freshnessUserAddon?: string }} [options]
 * @returns {string}
 */
export function buildResearchThenSummarizeComposerUserPrompt(
  packet = {},
  { freshnessUserAddon = "" } = {},
) {
  const query = packet.user_query || "";
  const target = extractResearchThenSummarizeTarget(query);
  const expertSynthesis = (packet.expert_outputs || [])
    .filter((o) => o?.content && String(o.content).length > 10)
    .map((o) => responseThinkingCleaner.clean(String(o.content)).trim())
    .join("\n\n")
    .slice(0, 6000);

  const contextBlock = expertSynthesis || packet.quick_answer || "";
  const hasWeb = hasSuccessfulWebGrounding(packet);

  const lines = [
    `REQUÊTE UTILISATEUR (priorité absolue) :\n"${query}"`,
    "",
    hasWeb
      ? "Des sources web ont été consultées — synthétise utilité et conception à partir du bloc ci-dessous."
      : "Pas de sources web fiables — explique ce qui manque sans prétendre avoir cherché.",
    "",
    contextBlock
      ? `CONTEXTE WEB / EXPERT :\n${contextBlock}`
      : "CONTEXTE : sujet et cible déjà dans la requête.",
    "",
    "CONSIGNE CRITIQUE — RECHERCHE PUIS SYNTHÈSE :",
    target
      ? `- La cible principale est **${target}** (repo / projet externe).`
      : "- Identifie la cible externe (repo, projet, outil) mentionnée par l'utilisateur.",
    "- Résume en 2–4 paragraphes : **utilité** (à quoi ça sert) et **conception** (comment c'est structuré / installé / intégré).",
    "- INTERDIT : « je n'ai pas trouvé », « pas de trace », « projet peu indexé » si le contexte web ci-dessus contient des éléments pertinents.",
    "- INTERDIT : plan de présentation, monologue sur le rôle de Nexxus, ou liste de pistes de projet.",
    "- Si les sources sont ambiguës, dis ce que tu vois et ce qui reste incertain — sans nier leur existence.",
  ];

  const base = lines.join("\n");
  return freshnessUserAddon ? `${base}\n\n${freshnessUserAddon}` : base;
}
