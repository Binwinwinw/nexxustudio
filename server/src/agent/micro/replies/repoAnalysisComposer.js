/**
 * Composer — revue de dépôt distant (REPO_ANALYSIS_V1).
 */
import responseThinkingCleaner from "../../utils/responseThinkingCleaner.js";
import {
  isRepoAnalysisRequest,
  extractRepoTarget,
} from "../../utils/repoAnalysisIntentGuards.js";
import {
  REPO_ANALYSIS_CONTRACT_ID,
  getRepoAnalysisSystemPrompt,
  REPO_REVIEW_GRADE_MINIMUMS,
} from "../../analysis/repoAnalysisContract.js";

const SOCIAL_VAGUE_RE =
  /\b(?:je (?:connais|sais) (?:ce|le) (?:d[eé]p[oô]t|repo)|voici (?:un )?r[eé]sum[eé] (?:g[eé]n[eé]ral|rapide)|en (?:gros|r[eé]sum[eé])\b)/i;

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isRepoAnalysisContractViolation(text = "") {
  const cleaned = String(text || "").trim();
  if (!cleaned || cleaned.length < 120) return true;
  const hasStructure =
    /langage|structure|points?\s+forts|risques?|tests?|documentation|inconnues?|actions?/i.test(
      cleaned,
    );
  if (!hasStructure) return true;
  if (SOCIAL_VAGUE_RE.test(cleaned) && cleaned.length < 400) return true;
  return false;
}

/**
 * @param {string} query
 * @param {{ meta?: object }} [packet]
 * @returns {boolean}
 */
export function requiresRepoAnalysisComposerContract(query = "", packet = {}) {
  if (packet?.meta?.intent_contract_id === "REPO_ANALYSIS") return true;
  if (packet?.meta?.intent_contract_id === REPO_ANALYSIS_CONTRACT_ID) return true;
  return isRepoAnalysisRequest(query);
}

/**
 * @param {object} packet
 * @param {{ freshnessUserAddon?: string }} [options]
 * @returns {string}
 */
export function buildRepoAnalysisComposerUserPrompt(
  packet = {},
  { freshnessUserAddon = "" } = {},
) {
  const query = packet.user_query || "";
  const target = extractRepoTarget(query);
  const expertSynthesis = (packet.expert_outputs || [])
    .filter((o) => o?.content && String(o.content).length > 10)
    .map((o) => responseThinkingCleaner.clean(String(o.content)).trim())
    .join("\n\n")
    .slice(0, 8000);

  const contextBlock = expertSynthesis || packet.quick_answer || "";
  const label = target?.label || "(dépôt)";

  const lines = [
    getRepoAnalysisSystemPrompt(),
    "",
    `Cible : ${label}${target?.url ? ` (${target.url})` : ""}`,
    "",
    `REQUÊTE UTILISATEUR :\n"${query}"`,
    "",
    contextBlock
      ? `PREUVES / CONTEXTE (web, README, configs) :\n${contextBlock}`
      : "PREUVES : limitées — base-toi sur ce qui est attesté ; marque le reste en inconnues.",
    "",
    `Respecte les minima : ≥${REPO_REVIEW_GRADE_MINIMUMS.strengths} forces, ≥${REPO_REVIEW_GRADE_MINIMUMS.findings} risques, ≥${REPO_REVIEW_GRADE_MINIMUMS.unknowns} inconnues, ≥${REPO_REVIEW_GRADE_MINIMUMS.recommendations} actions.`,
    "N'invente pas de fichiers absents des preuves.",
  ];

  if (freshnessUserAddon) lines.push("", freshnessUserAddon);
  return lines.join("\n");
}
