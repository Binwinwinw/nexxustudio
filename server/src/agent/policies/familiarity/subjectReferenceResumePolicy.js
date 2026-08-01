/**
 * subject_reference_resume — résolution session + disponibilité domaine (lot #34b).
 * Couche amont avant familiarity_domain_overview et simple_factual_lookup.
 */
import {
  buildDomainAvailabilityReply,
  getFamiliarityDeterministicReply,
  isFamiliarityDomainOverviewRequest,
  resolveKnownOrUnknownSubject,
} from "../../utils/familiarityIntentGuards.js";
import {
  extractSubjectCandidate,
  isImplicitSubjectReferenceQuery,
  isSubjectReferenceAvailabilityRequest,
  resolveConversationSubjectReference,
  applyVirginSessionResumeGuard,
  SUBJECT_REFERENCE_RESOLUTION,
} from "../../micro/continuity/sessionSubjectReferenceGuards.js";
import { isMetaCapabilitiesIntent } from "../meta/metaCapabilitiesPolicy.js";

export const SUBJECT_REFERENCE_RESUME_POLICY =
  "subject_reference_resume_policy_v1";

/** Batterie #34b — nouveau sujet explicite via shell infos. */
export const SUBJECT_REFERENCE_CANONICAL_INFOS_POLITIQUE_QUERY =
  "Tu as des infos sur la politique française ?";

/** Batterie #34b — reprise explicite Dior (session). */
export const SUBJECT_REFERENCE_CANONICAL_RESUME_DIOR_QUERY =
  "Sinon, s'agissant de Dior";

/** Batterie #34b — parler de (nouveau sujet). */
export const SUBJECT_REFERENCE_CANONICAL_PARLER_PHP_QUERY =
  "Est-ce qu'on peut parler de PHP ?";

/** Batterie #34b — reprise Italie. */
export const SUBJECT_REFERENCE_CANONICAL_REVIENS_ITALIE_QUERY =
  "On peut revenir à l'Italie ?";

/** Batterie #34b — référence implicite non résolue. */
export const SUBJECT_REFERENCE_CANONICAL_IMPLICIT_QUERY =
  "Sinon, à ce sujet";

/**
 * @returns {string}
 */
export function buildSubjectReferenceClarifyReply() {
  return (
    "Je ne suis pas sûr du sujet que tu veux reprendre. " +
    "Redonne-moi le nom du sujet et je repars dessus."
  );
}

/**
 * Entité ambiguë introduite (« si je te dis X… ») — pas un rappel de fil.
 * @param {string} rawSubject
 * @returns {string}
 */
export function buildSubjectEntityIntroductionClarifyReply(rawSubject = "") {
  const label = String(rawSubject || "ce mot").trim() || "ce mot";
  return (
    `« ${label} » seul ne me dit pas encore de quoi tu veux parler. ` +
    "Tu vises un personnage, une marque, un projet, ou autre chose ? " +
    "Précise le contexte et je m'oriente."
  );
}

/**
 * @param {object} resolution
 * @param {object} parsed
 * @returns {string|null}
 */
export function buildSubjectReferenceAvailabilityReply(
  resolution = {},
  parsed = {},
) {
  const subject =
    resolution.subjectResolved ||
    resolveKnownOrUnknownSubject(
      resolution.subject || parsed?.rawSubject || "",
    );
  const reply = buildDomainAvailabilityReply(
    subject,
    {
      rawSubject: resolution.subject || parsed?.rawSubject || subject.label,
      kind: parsed?.kind || "subject_reference",
    },
    { contextual_resume: Boolean(resolution.contextual_resume) },
  );
  return reply || null;
}

/**
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 * @returns {boolean}
 */
export function isSubjectReferenceResumeSatisfiable(
  query = "",
  history = [],
) {
  if (!isSubjectReferenceAvailabilityRequest(query)) return false;
  if (isImplicitSubjectReferenceQuery(query)) {
    const resolution = resolveConversationSubjectReference("", history, query);
    return (
      resolution.resolution ===
        SUBJECT_REFERENCE_RESOLUTION.PREVIOUS_SESSION_SUBJECT ||
      resolution.resolution === SUBJECT_REFERENCE_RESOLUTION.AMBIGUOUS ||
      resolution.resolution === SUBJECT_REFERENCE_RESOLUTION.NONE
    );
  }
  return Boolean(extractSubjectCandidate(query)?.rawSubject);
}

/**
 * @param {string} query
 * @param {object} [options]
 * @returns {{
 *   path: string,
 *   kind: string,
 *   reply: string,
 *   resolution: object,
 *   contextual_resume: boolean,
 * }|null}
 */
export function resolveSubjectReferenceResumeShortCircuit(
  query = "",
  options = {},
) {
  const history = Array.isArray(options.history) ? options.history : [];

  // G47 — ne pas voler un tour méta-capacités (image/vidéo, self-read, etc.)
  // via « as tu des infos sur … ton propre fonctionnement ».
  if (isMetaCapabilitiesIntent(query, { history })) {
    return null;
  }

  const isImplicit = isImplicitSubjectReferenceQuery(query);

  if (!isSubjectReferenceAvailabilityRequest(query) && !isImplicit) {
    return null;
  }

  const parsed = extractSubjectCandidate(query);

  if (parsed?.shell === "si_je_te_dis" && parsed?.rawSubject) {
    return {
      path: "subject_reference_entity_clarify",
      kind: "subject_introduction",
      reply: buildSubjectEntityIntroductionClarifyReply(parsed.rawSubject),
      resolution: {
        resolution: SUBJECT_REFERENCE_RESOLUTION.CURRENT_TURN_SUBJECT,
        subject: parsed.rawSubject,
        contextual_resume: false,
        source: "entity_introduction",
      },
      contextual_resume: false,
    };
  }

  if (!parsed?.rawSubject && !isImplicitSubjectReferenceQuery(query)) {
    if (isFamiliarityDomainOverviewRequest(query)) {
      const legacy = getFamiliarityDeterministicReply(query, options);
      if (!legacy) return null;
      return {
        path: "familiarity_domain_overview_deterministic",
        kind: "domain_readiness",
        reply: legacy,
        resolution: {
          resolution: SUBJECT_REFERENCE_RESOLUTION.CURRENT_TURN_SUBJECT,
          contextual_resume: false,
          source: "familiarity_legacy",
        },
        contextual_resume: false,
      };
    }
    return null;
  }

  const resolution = applyVirginSessionResumeGuard(
    resolveConversationSubjectReference(
      parsed?.rawSubject || "",
      history,
      query,
    ),
    history,
  );

  if (resolution.resolution === SUBJECT_REFERENCE_RESOLUTION.AMBIGUOUS) {
    if (isImplicitSubjectReferenceQuery(query) || !parsed?.rawSubject) {
      return {
        path: "subject_reference_clarify",
        kind: "implicit_ambiguous",
        reply: buildSubjectReferenceClarifyReply(),
        resolution,
        contextual_resume: false,
      };
    }
  }

  if (resolution.resolution === SUBJECT_REFERENCE_RESOLUTION.NONE) {
    if (isImplicitSubjectReferenceQuery(query)) {
      return {
        path: "subject_reference_clarify",
        kind: "implicit_unresolved",
        reply: buildSubjectReferenceClarifyReply(),
        resolution,
        contextual_resume: false,
      };
    }
    return null;
  }

  const reply = buildSubjectReferenceAvailabilityReply(resolution, parsed);
  if (!reply) return null;

  const path = resolution.contextual_resume
    ? "subject_reference_resume_deterministic"
    : "familiarity_domain_overview_deterministic";

  return {
    path,
    kind: parsed?.kind || "subject_reference",
    reply,
    resolution,
    contextual_resume: Boolean(resolution.contextual_resume),
  };
}

/**
 * @param {string} query
 * @param {object} [options]
 * @returns {string}
 */
export function resolveSubjectReferenceResumeBypassReply(
  query = "",
  options = {},
) {
  return resolveSubjectReferenceResumeShortCircuit(query, options)?.reply || "";
}

/**
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 * @param {string} [reason]
 * @returns {string}
 */
export function buildSubjectReferenceResumeRecoveryMessage(
  query = "",
  history = [],
  reason = "empty_output",
) {
  const hit = resolveSubjectReferenceResumeShortCircuit(query, { history });
  if (hit?.reply) return hit.reply;
  const legacy = getFamiliarityDeterministicReply(query);
  if (legacy) return legacy;
  return buildSubjectReferenceClarifyReply();
}
