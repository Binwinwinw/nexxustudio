/**
 * P2–P5 — Template composer FACTUAL_RESEARCH / cluster web+citations+rapport.
 */
import {
  FACTUAL_RESEARCH_TARGET_SOURCES,
  isFactualResearchSourcedReportPath,
  countFactualResearchSources,
} from "../../policies/web/factualResearchDeliverablePolicy.js";
import { hasSuccessfulWebGrounding } from "../../policies/web/knowledgeFreshnessPolicy.js";
import {
  evidenceHasKeyFigures,
  FACTUAL_RESEARCH_METRICS_ADMISSION,
} from "../../policies/web/factualResearchSourceRankPolicy.js";
import { FACTUAL_RESEARCH_EXACT_HEADINGS } from "../../policies/web/factualResearchReplyValidator.js";

export const FACTUAL_RESEARCH_COMPOSER_RULE = "factual_research_structured_report_v1";

/** Titres canoniques P5 (exacts). */
export const FACTUAL_RESEARCH_CANONICAL_HEADINGS = FACTUAL_RESEARCH_EXACT_HEADINGS;

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
  const evidenceSources = (packet.evidence || []).map((e) => ({
    url: e.source,
    snippet: e.excerpt,
    title: "",
  }));
  const fromExperts = (packet.expert_outputs || [])
    .filter((o) => o?.stage === "web_research")
    .map((o) => ({ snippet: o.content, title: "", url: "" }));
  const hasFigures =
    packet?.meta?.factual_research_evidence_has_figures === true ||
    evidenceHasKeyFigures([...evidenceSources, ...fromExperts]);

  const figureLines = hasFigures
    ? [
        "- Exige **2–3 chiffres clés** (taille de marché, croissance/CAGR, parts) **uniquement** s'ils figurent dans les preuves — chaque chiffre suivi de [n].",
        "- INTERDIT d'inventer Mordor/Nielsen/Statista absents des preuves.",
      ]
    : [
        "- Les sources récupérées **ne contiennent pas** de métriques chiffrées exploitables.",
        `- Inclure EXACTEMENT cette phrase dans le Résumé Exécutif : « ${FACTUAL_RESEARCH_METRICS_ADMISSION} »`,
        "- INTERDIT d'inventer des chiffres marché.",
      ];

  return [
    "VARIANTE RAPPORT FACTUEL SOURCÉ (FACTUAL_RESEARCH) :",
    `- Date de référence : ${today}.`,
    `- Sources web disponibles dans le paquet : ${n} (cible rédactionnelle ≥ ${FACTUAL_RESEARCH_TARGET_SOURCES}).`,
    "- Structure OBLIGATOIRE — titres markdown EXACTS (casse incluse), une seule fois chacun :",
    ...FACTUAL_RESEARCH_CANONICAL_HEADINGS.map((h) => `  ${h}`),
    "- Longueur : 1200–1800 mots (cible ~1400). Pas de remplissage, pas de préambule hors template.",
    "- INTERDIT : titres paraphrasés, titres dupliqués, sous-sections redondantes.",
    ...figureLines,
    "- Section Sources : liste numérotée Titre — URL (et date si visible dans la preuve). Préférer rapports sectoriels aux blogs divertissement.",
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

  const evidenceSources = (packet.evidence || []).map((e) => ({
    url: e.source,
    snippet: e.excerpt,
    title: "",
  }));
  const hasFigures =
    packet?.meta?.factual_research_evidence_has_figures === true ||
    evidenceHasKeyFigures(evidenceSources);

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
    "Rédige le rapport avec les 5 titres canoniques P5 EXACTS, ~1400 mots, ancré uniquement sur les preuves.",
    hasFigures
      ? "Inclus 2–3 chiffres clés présents dans les preuves, chacun suivi de [n]."
      : `Aucune métrique chiffrée : inclus la phrase « ${FACTUAL_RESEARCH_METRICS_ADMISSION} » dans le Résumé Exécutif.`,
    "Une seule occurrence de chaque titre. Pas de doublon.",
  ];

  if (freshnessUserAddon) {
    parts.push("", freshnessUserAddon);
  }

  return parts.join("\n");
}
