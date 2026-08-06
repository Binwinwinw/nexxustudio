/**
 * P2 — Template composer FACTUAL_RESEARCH / cluster web+citations+rapport.
 */
import {
  FACTUAL_RESEARCH_TARGET_SOURCES,
  isFactualResearchSourcedReportPath,
  countFactualResearchSources,
} from "../../policies/web/factualResearchDeliverablePolicy.js";
import { hasSuccessfulWebGrounding } from "../../policies/web/knowledgeFreshnessPolicy.js";

export const FACTUAL_RESEARCH_COMPOSER_RULE = "factual_research_structured_report_v1";

/**
 * @param {string} query
 * @param {object} [packet]
 * @returns {boolean}
 */
export function requiresFactualResearchComposerContract(query = "", packet = {}) {
  if (!isFactualResearchSourcedReportPath(query, packet)) return false;
  return (
    hasSuccessfulWebGrounding(packet) ||
    countFactualResearchSources(packet) >= 1
  );
}

/**
 * @param {string} query
 * @param {object} [packet]
 * @returns {string}
 */
export function buildFactualResearchSystemAddon(query = "", packet = {}) {
  const n = countFactualResearchSources(packet);
  const today = new Date().toISOString().slice(0, 10);
  return [
    "VARIANTE RAPPORT FACTUEL SOURCÉ (FACTUAL_RESEARCH) :",
    `- Date de référence : ${today}.`,
    `- Sources web disponibles dans le paquet : ${n} (cible rédactionnelle ≥ ${FACTUAL_RESEARCH_TARGET_SOURCES}).`,
    "- Structure OBLIGATOIRE (titres markdown) :",
    "  ## Résumé exécutif",
    "  ## Analyse de marché",
    "  ## Analyse concurrentielle",
    "  ## Opportunités de croissance",
    "  ## Sources",
    "- Chaque donnée chiffrée doit être ancrée sur les preuves web fournies (citation [n] ou URL).",
    "- Section Sources : liste numérotée Titre — URL (et date si visible dans la preuve).",
    "- INTERDIT : « je n'ai pas pu vérifier », « connaissances de base », rapport chiffré inventé.",
    "- Vise un livrable type dossier (~5 pages) via ces 5 sections, sans remplissage hors preuves.",
  ].join("\n");
}

/**
 * @param {object} packet
 * @param {{ freshnessUserAddon?: string }} [options]
 * @returns {string}
 */
export function buildFactualResearchComposerUserPrompt(
  packet = {},
  { freshnessUserAddon = "" } = {},
) {
  const expertSynthesis = (packet.expert_outputs || [])
    .filter((o) => o?.content && String(o.content).length > 10)
    .map((o) => String(o.content || "").trim())
    .join("\n\n")
    .slice(0, 7000);

  const evidenceLines = (packet.evidence || [])
    .filter((e) => e?.source)
    .slice(0, 12)
    .map((e, i) => {
      const excerpt = e.excerpt
        ? String(e.excerpt).replace(/\s+/g, " ").trim().slice(0, 160)
        : "";
      return `[${i + 1}] ${e.source}${excerpt ? ` — ${excerpt}` : ""}`;
    })
    .join("\n");

  const parts = [
    `Demande utilisateur :
"${packet.user_query || ""}"`,
    "",
    "PREUVES WEB (grounding obligatoire pour chiffres / faits mouvants) :",
    expertSynthesis || "(synthèse web absente)",
    "",
    "URLs / extraits :",
    evidenceLines || "(aucune URL)",
    "",
    "CONSIGNE :",
    "Rédige le rapport structuré (5 sections) en français, ancré uniquement sur les preuves ci-dessus.",
    "Cite les sources dans le corps ([n]) et liste-les en fin de réponse.",
  ];

  if (freshnessUserAddon) {
    parts.push("", freshnessUserAddon);
  }

  return parts.join("\n");
}
