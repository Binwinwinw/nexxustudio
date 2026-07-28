/**
 * Subject Intelligence Layer — résolution pure (état du monde, pas de texte ni routage).
 */
import { normalizeText } from "../../utils/normalizationGuards.js";
import { lookupKnownEntity, lookupKnownEntityCandidates } from "./knownEntityQuickLookup.js";
import { lookupInternalEntity } from "./internalEntityRegistry.js";
import { normalizeSubject } from "./subjectNormalizer.js";
import { confidenceFromSource, SUBJECT_CONFIDENCE } from "./subjectConfidence.js";
import { inferImplicitUsage, USAGE_INTENTS } from "./subjectUsageIntent.js";
import { classifyInstallUsage } from "./subjectInstallUsage.js";
import { buildSubjectSessionContext } from "./subjectSessionContext.js";
import { sessionProjectEntityId } from "./subjectEntityIds.js";
import { detectMixedDomainSignals } from "./subjectDomainSignals.js";
import {
  isReferentialEntityMention,
} from "../classifiers/conversationTurnType.js";

export const SUBJECT_NATURES = {
  INTERNAL_STUDIO: "internal_studio_operation",
  PUBLIC_KNOWN: "public_known_entity",
  COMPOSITE_MIXED: "composite_mixed_domain",
  UNRESOLVED_PROPER: "unresolved_proper_name",
  GENERIC_OPERATIONAL: "generic_operational",
};

const PROCEDURE_TARGET_PATTERNS = [
  /\bcomment\s+faire\s+pour\s+(?:lancer|demarrer|démarrer|declench|déclench|declencher|déclencher|creer|créer|envoyer|transmettre|installer|jouer\s+a?\s*)\s+(?:un\s+|une\s+|le\s+|la\s+|les\s+)?(.+?)(?:\s*\?|$)/i,
  /\bfaire\s+pour\s+(?:lancer|demarrer|démarrer|declench|déclench|creer|créer|envoyer|transmettre)\s+(?:un\s+|une\s+)?(.+?)(?:\s*\?|$)/i,
  /\b(?:lancer|demarrer|démarrer|declench|déclench|declencher|déclencher)\s+(?:un\s+|une\s+)?(.+?)(?:\s+qui\s+|\s+pour\s+|\s+sur\s+|\s*\?|$)/i,
  /\bcomment\s+(?:lancer|demarrer|démarrer|ouvrir|installer)\s+(?:un\s+|une\s+|le\s+|la\s+)?(.+?)(?:\s*\?|$)/i,
];

const INTERNAL_SUBJECT_MARKERS =
  /\b(projet|forge|handoff|buildproject|citadelle|nexxus|studio|session|livrables|cadrage|pipeline\s+forge|document\s+joint)\b/i;

const GENERIC_OPERATIONAL_SUBJECT =
  /^(un\s+|une\s+)?(projet|forge|handoff|build|generation|document|session)\b/i;

/** @param {string} query @param {object} partial @param {object} [usageCtx] */
function withUsage(query, partial, usageCtx = {}) {
  const installKind = classifyInstallUsage(query);
  return finalizeState({
    ...partial,
    installKind,
    usage: inferImplicitUsage(query, {
      nature: partial.nature,
      metaTurn: usageCtx.metaTurn,
      installKind,
    }),
  });
}

/** @param {object} partial */
function finalizeState(partial) {
  const entity = partial.entity ?? null;
  const resolvedEntityId =
    partial.resolvedEntityId ??
    entity?.resolvedEntityId ??
    (partial.source === "session_project_match" || partial.source === "project_anchor"
      ? sessionProjectEntityId(partial.canonical)
      : null);

  return {
    ...partial,
    resolvedEntityId,
    relations: partial.relations ?? entity?.relations ?? [],
    canonical: partial.canonical ?? null,
    normalizedKey: partial.normalizedKey ?? partial.canonical,
  };
}

export function extractProcedureTargetSubject(query = "") {
  const raw = String(query || "").trim();
  for (const pattern of PROCEDURE_TARGET_PATTERNS) {
    const match = raw.match(pattern);
    if (match?.[1]) {
      return match[1].trim().replace(/\s*[,.]\s*$/, "");
    }
  }
  return null;
}

export function looksLikeProperNamePhrase(query = "", subject = "") {
  const raw = String(query || "");
  if (/\b[A-Z][a-z]+(?:\s+(?:for|of|the|du|de|la|le))?\s+[A-Z][a-z]+/.test(raw)) {
    return true;
  }
  if (/\b[A-Z]{2,}(?:\s+[A-Z][a-z]+)+\b/.test(raw)) {
    return true;
  }
  const norm = normalizeText(subject).toLowerCase();
  const words = norm.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && !GENERIC_OPERATIONAL_SUBJECT.test(norm)) {
    const frenchGeneric = /^(un|une|le|la|les|projet|forge|document|session|fichier)$/;
    if (!words.every((w) => frenchGeneric.test(w))) {
      return true;
    }
  }
  return false;
}

function isInternalStudioSubject(subject = "", query = "") {
  const blob = `${subject} ${query}`.toLowerCase();
  if (!INTERNAL_SUBJECT_MARKERS.test(blob)) return false;
  if (
    looksLikeProperNamePhrase(query, subject) &&
    !/\b(forge|projet|nexxus|citadelle)\b/i.test(subject)
  ) {
    return false;
  }
  return true;
}

/**
 * @param {{ query?: string, extractedSubject?: string|null, sessionId?: string|null, sessionContext?: object }} input
 */
export function resolveSubjectIntelligence(input = {}) {
  const query = String(input.query || "");
  const turn = input.turn || null;
  const sessionContext = buildSubjectSessionContext(input);

  if (turn?.disableBusinessSubjectResolution) {
    return withUsage(
      query,
      {
        nature: SUBJECT_NATURES.GENERIC_OPERATIONAL,
        target: null,
        canonical: null,
        entity: null,
        confidence: SUBJECT_CONFIDENCE.LOW,
        ambiguous: false,
        candidates: [],
        source: "meta_turn_skip_resolution",
        relations: ["is_meta_feedback"],
      },
      { metaTurn: true },
    );
  }

  const skipProcedureExtract =
    isReferentialEntityMention(query) || turn?.disableBusinessSubjectResolution;
  const rawTarget =
    input.extractedSubject ??
    (skipProcedureExtract ? "" : extractProcedureTargetSubject(query)) ??
    "";

  if (!rawTarget) {
    return withUsage(query, {
      nature: SUBJECT_NATURES.GENERIC_OPERATIONAL,
      target: null,
      canonical: null,
      entity: null,
      confidence: SUBJECT_CONFIDENCE.LOW,
      ambiguous: false,
      candidates: [],
      source: "generic",
    });
  }

  const { raw, canonical, normalizedKey } = normalizeSubject(rawTarget);

  const mixed = detectMixedDomainSignals(query);
  if (mixed.mixedDomain) {
    const primaryPublic = mixed.publicEntities[0] ?? null;
    return withUsage(query, {
      nature: SUBJECT_NATURES.COMPOSITE_MIXED,
      target: raw,
      canonical,
      normalizedKey,
      entity: primaryPublic,
      confidence: SUBJECT_CONFIDENCE.MEDIUM,
      ambiguous: false,
      candidates: mixed.publicEntities,
      source: "mixed_domain_query",
      relations: ["is_composite", "is_internal_signal", "is_public_entity"],
      mixedDomain: mixed,
    });
  }

  const internal = lookupInternalEntity(raw, sessionContext);
  if (internal) {
    return withUsage(query, {
      nature: SUBJECT_NATURES.INTERNAL_STUDIO,
      target: raw,
      canonical,
      normalizedKey,
      entity: internal,
      confidence: internal.confidence,
      ambiguous: false,
      candidates: [internal],
      source: internal.source,
      relations: internal.relations,
    });
  }

  if (isInternalStudioSubject(raw, query)) {
    return withUsage(query, {
      nature: SUBJECT_NATURES.INTERNAL_STUDIO,
      target: raw,
      canonical,
      normalizedKey,
      entity: null,
      confidence: confidenceFromSource("query_markers_internal"),
      ambiguous: false,
      candidates: [],
      source: "query_markers_internal",
      relations: ["is_internal_operation"],
    });
  }

  if (isReferentialEntityMention(query)) {
    return withUsage(query, {
      nature: SUBJECT_NATURES.GENERIC_OPERATIONAL,
      target: raw,
      canonical,
      normalizedKey,
      entity: null,
      confidence: SUBJECT_CONFIDENCE.LOW,
      ambiguous: false,
      candidates: [],
      source: "referential_entity_mention",
      relations: ["is_meta_feedback"],
    }, { metaTurn: true });
  }

  const entity = lookupKnownEntity(raw);
  if (entity) {
    const candidates = lookupKnownEntityCandidates(raw);
    return withUsage(query, {
      nature: SUBJECT_NATURES.PUBLIC_KNOWN,
      target: raw,
      canonical,
      normalizedKey,
      entity,
      confidence: entity.confidence,
      ambiguous: Boolean(entity.ambiguous),
      alternateSenses: entity.alternateSenses || null,
      candidates,
      source: entity.source,
      relations: entity.relations,
    });
  }

  if (
    looksLikeProperNamePhrase(query, raw) ||
    (canonical.length >= 3 && /^[a-z]+$/.test(canonical) && canonical.length <= 12)
  ) {
    return withUsage(query, {
      nature: SUBJECT_NATURES.UNRESOLVED_PROPER,
      target: raw,
      canonical,
      normalizedKey,
      entity: null,
      confidence: confidenceFromSource("proper_name_unresolved"),
      ambiguous: false,
      candidates: [],
      source: "proper_name_unresolved",
      resolvedEntityId: `unresolved:proper:${canonical}`,
      relations: [],
    });
  }

  return withUsage(query, {
    nature: SUBJECT_NATURES.GENERIC_OPERATIONAL,
    target: raw,
    canonical,
    normalizedKey,
    entity: null,
    confidence: confidenceFromSource("generic"),
    ambiguous: false,
    candidates: [],
    source: "generic",
  });
}

export function isProcedureFormWithResolvableSubject(query = "") {
  const target = extractProcedureTargetSubject(query);
  if (!target || target.length < 2) return false;
  const q = normalizeText(query).toLowerCase();
  const hasHowForm =
    /\b(comment\s+faire|faire\s+pour|comment\s+(?:lancer|demarrer|démarrer|ouvrir|installer))\b/.test(
      q,
    );
  const hasLaunchVerb =
    /\b(lancer|demarrer|démarrer|declench|déclench|declencher|déclencher|creer|créer|installer|envoyer|transmettre|ouvrir)\b/.test(
      q,
    );
  return hasHowForm && hasLaunchVerb;
}
