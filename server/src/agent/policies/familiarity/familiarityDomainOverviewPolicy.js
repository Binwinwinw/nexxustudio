/**
 * familiarity_domain_overview — disponibilité sur domaine identifiable (lot #34).
 * Patron #30–#33 : détection → can_answer_now → short-circuit avant simple_factual_lookup.
 */
import {
  getFamiliarityDeterministicReply,
  isFamiliarityDomainOverviewRequest,
  parseFamiliarityQuery,
} from "../../utils/familiarityIntentGuards.js";
import { isMetaCapabilitiesIntent } from "../metaCapabilitiesPolicy.js";

export const FAMILIARITY_DOMAIN_OVERVIEW_RULE =
  "familiarity_domain_overview_policy_v1";

/** Batterie #34 — politique française (shell t'y connais). */
export const FAMILIARITY_DOMAIN_CANONICAL_POLITIQUE_QUERY =
  "Est-ce que tu t'y connais en politique française ?";

/** Batterie #34 — variante tu connais. */
export const FAMILIARITY_DOMAIN_CANONICAL_POLITIQUE_ALT_QUERY =
  "Tu connais la politique française ?";

/** Batterie #34 — domaine technique. */
export const FAMILIARITY_DOMAIN_CANONICAL_PHP_QUERY =
  "Est-ce que tu t'y connais en PHP ?";

/** Batterie #34 — marque / mode. */
export const FAMILIARITY_DOMAIN_CANONICAL_DIOR_QUERY =
  "Tu t'y connais en Dior ?";

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isFamiliarityDomainOverviewSatisfiable(query = "") {
  return isFamiliarityDomainOverviewRequest(query);
}

/**
 * @param {string} query
 * @param {object} [options]
 * @returns {{ path: string, kind: string, reply: string, rawSubject: string|null }|null}
 */
export function resolveFamiliarityDomainOverviewShortCircuit(
  query = "",
  options = {},
) {
  if (isMetaCapabilitiesIntent(query, options)) return null;
  if (!isFamiliarityDomainOverviewRequest(query)) return null;
  const reply = getFamiliarityDeterministicReply(query, options);
  if (!reply) return null;
  const parsed = parseFamiliarityQuery(query);
  return {
    path: "familiarity_domain_overview_deterministic",
    kind: parsed?.kind || "domain_readiness",
    reply,
    rawSubject: parsed?.rawSubject || null,
  };
}

/**
 * @param {string} query
 * @param {object} [options]
 * @returns {string}
 */
export function resolveFamiliarityDomainOverviewBypassReply(
  query = "",
  options = {},
) {
  return resolveFamiliarityDomainOverviewShortCircuit(query, options)?.reply || "";
}

/**
 * @param {string} query
 * @param {string} [reason]
 * @returns {string}
 */
export function buildFamiliarityDomainOverviewRecoveryMessage(
  query = "",
  reason = "empty_output",
) {
  const canned = getFamiliarityDeterministicReply(query);
  if (canned) return canned;
  return (
    "Oui, je peux t'aider sur ce sujet. " +
    "Tu veux un aperçu général ou une question précise ?"
  );
}
