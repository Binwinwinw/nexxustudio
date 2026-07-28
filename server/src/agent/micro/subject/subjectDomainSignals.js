import { normalizeText } from "../../utils/normalizationGuards.js";
import { normalizeSubject } from "./subjectNormalizer.js";
import { scanPublicEntitiesInQuery, resolveSubject } from "./subjectGraph.js";
import { lookupKnownEntity } from "./knownEntityQuickLookup.js";

const INTERNAL_DOMAIN_MARKERS =
  /\b(projet|forge|handoff|buildproject|citadelle|nexxus|studio|session|livrables|cadrage|pipeline\s+forge)\b/i;

/**
 * @param {string} query
 * @returns {{ mixedDomain: boolean, internalSignals: boolean, publicEntities: object[] }}
 */
export function detectMixedDomainSignals(query = "") {
  const q = normalizeText(query).toLowerCase();
  const internalSignals = INTERNAL_DOMAIN_MARKERS.test(q);
  const publicEntities = [...scanPublicEntitiesInQuery(q)];

  if (!publicEntities.length) {
    const jeuMatch = q.match(/\b(?:jeu|jeux|game)\s+([a-z0-9\s-]{2,40})/i);
    if (jeuMatch?.[1]) {
      const resolved = resolveSubject(jeuMatch[1].trim(), {
        domain: "public",
        preferSessionProject: false,
      });
      if (resolved.entity) {
        publicEntities.push(resolved.entity);
      } else {
        const hit = lookupKnownEntity(jeuMatch[1].trim());
        if (hit) publicEntities.push(hit);
      }
    }
  }

  const mixedDomain = internalSignals && publicEntities.length > 0;

  return {
    mixedDomain,
    internalSignals,
    publicEntities,
  };
}

/**
 * @param {string} query
 * @param {object} [state]
 */
export function detectCompositeSubject(query = "", state = {}) {
  const mixed = detectMixedDomainSignals(query);
  if (mixed.mixedDomain) {
    return {
      composite: true,
      ...mixed,
      canonical: state.canonical ?? null,
    };
  }

  if (
    state.nature === "internal_studio_operation" &&
    state.entity?.resolvedEntityId?.startsWith("public:")
  ) {
    return { composite: true, mixedDomain: true, internalSignals: true, publicEntities: [state.entity] };
  }

  return { composite: false, mixedDomain: false, internalSignals: false, publicEntities: [] };
}
