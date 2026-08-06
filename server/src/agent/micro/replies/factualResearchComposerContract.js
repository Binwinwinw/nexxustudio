/**
 * P2/P3 — Template composer FACTUAL_RESEARCH / cluster web+citations+rapport.
 */
import {
  FACTUAL_RESEARCH_TARGET_SOURCES,
  isFactualResearchSourcedReportPath,
  countFactualResearchSources,
} from "../../policies/web/factualResearchDeliverablePolicy.js";
import { hasSuccessfulWebGrounding } from "../../policies/web/knowledgeFreshnessPolicy.js";

export const FACTUAL_RESEARCH_COMPOSER_RULE = "factual_research_structured_report_v1";

/** Titres canoniques P3 (une seule occurrence chacun). */
export const FACTUAL_RESEARCH_CANONICAL_HEADINGS = [
  "## Résumé",
  "## Analyse de marché",
  "## Analyse concurrentielle",
  "## Opportunités",
  "## Sources",
];

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
    "- Structure OBLIGATOIRE — titres markdown EXACTS, une seule fois chacun :",
    ...FACTUAL_RESEARCH_CANONICAL_HEADINGS.map((h) => `  ${h}`),
    "- Longueur : 1200–1800 mots (cible ~1400). Pas de remplissage, pas de préambule hors template.",
    "- INTERDIT : titres dupliqués, sous-sections redondantes, « ~5 pages » de padding.",
    "- Chaque donnée chiffrée DOIT être suivie immédiatement d'une citation [n] (ou URL) — sinon omets le chiffre.",
    "- Section Sources : liste numérotée Titre — URL (et date si visible dans la preuve).",
    "- INTERDIT : « je n'ai pas pu vérifier », « connaissances de base », rapport chiffré inventé.",
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
    .slice(0, 4500);

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
    "Rédige le rapport en 5 sections (titres canoniques exacts), ~1400 mots, ancré uniquement sur les preuves.",
    "Cite [n] juste après chaque chiffre. Une seule occurrence de chaque titre. Pas de doublon.",
  ];

  if (freshnessUserAddon) {
    parts.push("", freshnessUserAddon);
  }

  return parts.join("\n");
}
