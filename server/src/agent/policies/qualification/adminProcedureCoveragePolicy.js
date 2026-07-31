/**
 * Politique de couverture — procédures administratives (sources officielles prioritaires).
 */
import { parseAdminProcedure } from "../../utils/adminProcedureIntentGuards.js";

export const ADMIN_PROCEDURE_COVERAGE_POLICY_V1 =
  "admin_procedure_coverage_policy_v1";

export const ADMIN_DELIVERY_MODES = {
  WEB_RAG_GROUNDED: "web_rag_grounded",
  FULL_PIPELINE_GUIDED: "full_pipeline_guided",
};

export const ADMIN_PROVENANCE = {
  OFFICIAL_WEB: "official_web",
  GUIDED_LLM: "guided_llm",
};

const DOMAIN_SOURCE_HINTS = {
  tax: "impots.gouv.fr, service-public.fr",
  social: "caf.fr, service-public.fr",
  employment: "francetravail.fr, service-public.fr",
  health: "ameli.fr, service-public.fr",
  identity: "service-public.fr, ANTS, préfecture",
  transport: "ants.gouv.fr, service-public.fr",
  housing: "service-public.fr, site du bailleur ou de l'organisme",
  legal: "service-public.fr, justice.fr",
  business: "inpi.fr, urssaf.fr, service-public.fr",
  general_admin: "service-public.fr et site officiel de l'organisme concerné",
};

/**
 * @param {string} query
 * @param {import("../utils/adminProcedureIntentGuards.js").AdminProcedureSlots|null} [slots]
 */
export function resolveAdminProcedureCoverage(query = "", slots = null) {
  const resolved = slots || parseAdminProcedure(query);
  if (!resolved) {
    return {
      mode: ADMIN_DELIVERY_MODES.FULL_PIPELINE_GUIDED,
      provenance: ADMIN_PROVENANCE.GUIDED_LLM,
      preferWebResearch: true,
      reason: "admin_procedure_unparsed",
    };
  }

  return {
    mode: ADMIN_DELIVERY_MODES.WEB_RAG_GROUNDED,
    provenance: ADMIN_PROVENANCE.OFFICIAL_WEB,
    preferWebResearch: true,
    reason: "official_administrative_procedure",
    domain: resolved.domain,
    sourceHints: DOMAIN_SOURCE_HINTS[resolved.domain] || DOMAIN_SOURCE_HINTS.general_admin,
    freshnessRisk: resolved.freshnessRisk,
  };
}

/**
 * @param {import("../utils/adminProcedureIntentGuards.js").AdminProcedureSlots} slots
 * @param {{ sourceHints?: string }} [coverage]
 * @returns {string}
 */
export function buildAdminProcedureWebGroundedAddon(slots, coverage = {}) {
  const parts = [
    slots.topicLabel || slots.topic || "la démarche demandée",
    slots.jurisdiction === "fr" ? "France" : slots.jurisdiction,
    slots.domain,
  ].filter(Boolean);

  const sources =
    coverage.sourceHints ||
    DOMAIN_SOURCE_HINTS[slots.domain] ||
    DOMAIN_SOURCE_HINTS.general_admin;

  return [
    "VARIANTE PROCÉDURE ADMINISTRATIVE — RECHERCHE DOCUMENTÉE (web/RAG) :",
    `- Démarche visée : **${parts.join(" · ")}**.`,
    `- Sources officielles attendues : ${sources}.`,
    "FORMAT OBLIGATOIRE :",
    "1) Reformuler la démarche et le profil supposé (particulier, entreprise…) si identifiable.",
    "2) Étapes ordonnées : prérequis, documents, dépôt, délais — sans inventer de règle non sourcée.",
    "3) Distinguer clairement consigne pratique (comment faire) et information officielle (droits, conditions).",
    "4) Signaler les variations fréquentes (région, statut, année) et ce qui doit être vérifié sur le site officiel.",
    "INTERDIT :",
    "- Inventer URL, montant, date limite ou formulaire sans source vérifiable.",
    "- Répondre comme une fiche explicative « c'est quoi X » sans étapes actionnables.",
    "- Tutoriel technique (install/config logiciel) — ce n'est PAS une procédure admin.",
    "- Affirmer une procédure obsolète sans mentionner le risque de changement réglementaire.",
  ].join("\n");
}
