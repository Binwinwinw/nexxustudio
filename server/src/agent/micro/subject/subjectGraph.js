/**
 * Subject Graph — source de vérité locale pour entités, alias et relations (déterministe).
 * Consommé par SIL, familiarité, launcher, domain signals.
 */
import { normalizeFamiliarityQuery } from "../../utils/familiarityIntentGuards.js";
import { normalizeSubject } from "./subjectNormalizer.js";
import { confidenceFromSource, SUBJECT_CONFIDENCE } from "./subjectConfidence.js";
import { ENTITY_IDS, ENTITY_DOMAINS, sessionProjectEntityId } from "./subjectEntityIds.js";

/** @typedef {'exact'|'alias'|'fuzzy'|'session_project'|null} SubjectGraphMatchType */

/**
 * @type {Record<string, {
 *   domain: 'public'|'internal',
 *   label: string,
 *   canonical: string,
 *   kind: string,
 *   definition: string,
 *   aliases?: string[],
 *   relations: string[],
 *   platforms?: string[],
 *   ambiguous?: boolean,
 *   alternateSenses?: object[],
 * }>}
 */
export const SUBJECT_GRAPH_ENTITIES = {
  [ENTITY_IDS.PUBLIC_GAME_NFS]: {
    domain: ENTITY_DOMAINS.PUBLIC,
    label: "Need for Speed",
    canonical: "need for speed",
    kind: "video_game_franchise",
    definition:
      "une série de jeux de course automobile (franchise EA, studios comme Criterion, etc.)",
    aliases: ["nfs", "need 4 speed", "need4speed", "needfor speed"],
    relations: ["is_game", "is_franchise"],
    platforms: ["Steam", "EA App", "PlayStation", "Xbox", "Origin"],
  },
  [ENTITY_IDS.PUBLIC_GAME_FORTNITE]: {
    domain: ENTITY_DOMAINS.PUBLIC,
    label: "Fortnite",
    canonical: "fortnite",
    kind: "video_game",
    definition: "jeu en ligne multijoueur (Epic Games)",
    relations: ["is_game"],
    platforms: ["PC", "PlayStation", "Xbox", "Nintendo Switch"],
  },
  [ENTITY_IDS.PUBLIC_GAME_MINECRAFT]: {
    domain: ENTITY_DOMAINS.PUBLIC,
    label: "Minecraft",
    canonical: "minecraft",
    kind: "video_game",
    definition: "jeu sandbox de construction et survie (Mojang / Microsoft)",
    relations: ["is_game"],
    platforms: ["PC", "PlayStation", "Xbox", "Nintendo Switch"],
  },
  [ENTITY_IDS.PUBLIC_GAME_GTA]: {
    domain: ENTITY_DOMAINS.PUBLIC,
    label: "Grand Theft Auto",
    canonical: "grand theft auto",
    kind: "video_game_franchise",
    definition: "série de jeux d'action en monde ouvert (Rockstar)",
    aliases: ["gta"],
    relations: ["is_game", "is_franchise"],
    platforms: ["Steam", "Rockstar Games Launcher", "PlayStation", "Xbox"],
  },
  [ENTITY_IDS.PUBLIC_GAME_LOL]: {
    domain: ENTITY_DOMAINS.PUBLIC,
    label: "League of Legends",
    canonical: "league of legends",
    kind: "video_game",
    definition: "MOBA en ligne (Riot Games)",
    relations: ["is_game"],
    platforms: ["PC"],
  },
  [ENTITY_IDS.PUBLIC_PLATFORM_STEAM]: {
    domain: ENTITY_DOMAINS.PUBLIC,
    label: "Steam",
    canonical: "steam",
    kind: "software_platform",
    definition: "plateforme de distribution de jeux PC (Valve)",
    relations: ["is_platform"],
    platforms: ["PC"],
  },
  [ENTITY_IDS.PUBLIC_AMBIGUOUS_ECLIPSE]: {
    domain: ENTITY_DOMAINS.PUBLIC,
    label: "Eclipse",
    canonical: "eclipse",
    kind: "ambiguous_software",
    definition: "plusieurs sens possibles selon le contexte",
    ambiguous: true,
    relations: ["is_ambiguous"],
    alternateSenses: [
      {
        kind: "ide",
        definition: "IDE de développement Java (Eclipse Foundation)",
        relations: ["is_ide"],
      },
      {
        kind: "astronomy",
        definition: "phénomène astronomique (éclipse solaire ou lunaire)",
        relations: ["is_natural_phenomenon"],
      },
      {
        kind: "internal_codename",
        definition: "éventuel nom de projet ou module dans un workspace",
        relations: ["is_internal_codename"],
      },
    ],
  },
  [ENTITY_IDS.PUBLIC_AMBIGUOUS_ATLAS]: {
    domain: ENTITY_DOMAINS.PUBLIC,
    label: "Atlas",
    canonical: "atlas",
    kind: "ambiguous_name",
    definition: "nom pouvant désigner un jeu, une carte, ou un codename de projet",
    ambiguous: true,
    relations: ["is_ambiguous"],
    alternateSenses: [
      {
        kind: "video_game",
        definition: "jeu ou univers ludique",
        relations: ["is_game"],
      },
      {
        kind: "internal_codename",
        definition: "projet ou dépôt interne si tu es dans une session Citadelle",
        relations: ["is_internal_project"],
      },
    ],
  },
  [ENTITY_IDS.INTERNAL_FORGE]: {
    domain: ENTITY_DOMAINS.INTERNAL,
    label: "Forge",
    canonical: "forge",
    kind: "citadelle_component",
    definition: "chaîne de génération / handoff Nexxus Studio (La Citadelle)",
    relations: ["is_internal_component", "is_forge_pipeline"],
  },
  [ENTITY_IDS.INTERNAL_NEXXUS]: {
    domain: ENTITY_DOMAINS.INTERNAL,
    label: "Nexxus Studio",
    canonical: "nexxus",
    kind: "citadelle_product",
    definition: "cockpit et orchestrateur de La Citadelle",
    aliases: ["nexxus studio", "nexus"],
    relations: ["is_internal_product"],
  },
  [ENTITY_IDS.INTERNAL_CITADELLE]: {
    domain: ENTITY_DOMAINS.INTERNAL,
    label: "La Citadelle",
    canonical: "citadelle",
    kind: "citadelle_product",
    definition: "écosystème souverain local-first (vault, agents, Forge)",
    relations: ["is_internal_product"],
  },
  [ENTITY_IDS.INTERNAL_STUDIO]: {
    domain: ENTITY_DOMAINS.INTERNAL,
    label: "Nexxus Studio",
    canonical: "studio",
    kind: "citadelle_product",
    definition: "interface et pipeline conversationnel du produit",
    relations: ["is_internal_product"],
  },
};

/** Index alias normalisé → entityId */
const ALIAS_INDEX = new Map();

function normalizeGraphKey(value = "") {
  return normalizeFamiliarityQuery(String(value || ""))
    .replace(/^(le|la|les|l)\s+/, "")
    .trim();
}

function registerAlias(key, entityId) {
  const norm = normalizeGraphKey(key);
  if (!norm || norm.length < 2) return;
  if (!ALIAS_INDEX.has(norm)) {
    ALIAS_INDEX.set(norm, entityId);
  }
}

function buildAliasIndex() {
  for (const [entityId, node] of Object.entries(SUBJECT_GRAPH_ENTITIES)) {
    registerAlias(node.canonical, entityId);
    registerAlias(node.label, entityId);
    for (const alias of node.aliases || []) {
      registerAlias(alias, entityId);
    }
  }
}

buildAliasIndex();

/**
 * Fragments pour scan mixed-domain (requête complète).
 */
export const SUBJECT_GRAPH_QUERY_FRAGMENTS = [
  "need for speed",
  "need 4 speed",
  "nfs",
  "minecraft",
  "fortnite",
  "grand theft auto",
  "gta",
  "league of legends",
  "steam",
  "eclipse",
  "atlas",
];

/**
 * @param {string} entityId
 */
export function getGraphEntity(entityId) {
  return SUBJECT_GRAPH_ENTITIES[entityId] ?? null;
}

/**
 * @param {string} relation
 * @returns {string[]}
 */
export function listEntityIdsByRelation(relation) {
  return Object.entries(SUBJECT_GRAPH_ENTITIES)
    .filter(([, node]) => node.relations?.includes(relation))
    .map(([id]) => id);
}

/**
 * @param {string} entityId
 * @returns {string[]}
 */
export function getEntityPlatforms(entityId) {
  const node = getGraphEntity(entityId);
  return node?.platforms ? [...node.platforms] : [];
}

/**
 * @param {string} entityId
 * @param {object} node
 * @param {string} source
 * @param {SubjectGraphMatchType} matchType
 */
function toResolutionHit(entityId, node, source, matchType) {
  const ambiguous = Boolean(node.ambiguous);
  return {
    resolvedEntityId: entityId,
    label: node.label,
    kind: node.kind,
    definition: node.definition,
    relations: node.relations || [],
    platforms: node.platforms || [],
    ambiguous,
    alternateSenses: node.alternateSenses || null,
    domain: node.domain,
    source,
    matchType,
    confidence: confidenceFromSource(source, { ambiguous }),
  };
}

/**
 * @param {string} key
 * @param {{ domainFilter?: 'public'|'internal'|null }} [options]
 */
function resolveByNormalizedKey(key, options = {}) {
  const entityId = ALIAS_INDEX.get(key);
  if (entityId) {
    const node = SUBJECT_GRAPH_ENTITIES[entityId];
    if (!options.domainFilter || node.domain === options.domainFilter) {
      const source =
        node.domain === ENTITY_DOMAINS.INTERNAL
          ? "graph_internal_exact"
          : node.ambiguous
            ? "graph_ambiguous"
            : "graph_public_exact";
      return toResolutionHit(entityId, node, source, "alias");
    }
  }

  for (const [id, node] of Object.entries(SUBJECT_GRAPH_ENTITIES)) {
    if (options.domainFilter && node.domain !== options.domainFilter) continue;
    const canonical = node.canonical;
    if (key === canonical || key.includes(canonical) || canonical.includes(key)) {
      const source =
        node.domain === ENTITY_DOMAINS.INTERNAL
          ? "graph_internal_fuzzy"
          : "graph_public_fuzzy";
      return toResolutionHit(id, node, source, "fuzzy");
    }
    for (const alias of node.aliases || []) {
      if (key === alias || key.includes(alias) || alias.includes(key)) {
        const source =
          node.domain === ENTITY_DOMAINS.INTERNAL
            ? "graph_internal_exact"
            : "graph_public_exact";
        return toResolutionHit(id, node, source, "exact");
      }
    }
  }

  return null;
}

/**
 * @param {string} rawSubject
 * @param {{ activeProjectNames?: string[], inCitadelleWorkspace?: boolean }} [sessionContext]
 */
function resolveSessionProject(rawSubject, sessionContext = {}) {
  const { canonical } = normalizeSubject(rawSubject);
  const key = canonical;
  if (!key) return null;

  const projectNames = (sessionContext.activeProjectNames || []).map(
    (n) => normalizeSubject(n).canonical,
  );
  if (!projectNames.length || !projectNames.includes(key)) return null;

  const entityId = sessionProjectEntityId(key);
  return {
    resolvedEntityId: entityId,
    label: rawSubject.trim(),
    kind: "internal_project",
    definition: "projet ou codename actif dans ta session Citadelle",
    relations: ["is_internal_project", "is_codename"],
    platforms: [],
    ambiguous: false,
    alternateSenses: null,
    domain: ENTITY_DOMAINS.SESSION,
    source: "session_project_match",
    matchType: "session_project",
    confidence: confidenceFromSource("session_project_match"),
  };
}

/**
 * Résolution centrale — retourne entité + métadonnées (sans texte utilisateur).
 * @param {string} rawSubject
 * @param {{
 *   sessionContext?: object,
 *   domain?: 'auto'|'public'|'internal',
 *   preferSessionProject?: boolean,
 * }} [options]
 * @returns {{
 *   entityId: string|null,
 *   entity: object|null,
 *   confidence: string,
 *   candidates: object[],
 *   matchType: SubjectGraphMatchType,
 *   ambiguous: boolean,
 * }}
 */
export function resolveSubject(rawSubject = "", options = {}) {
  const sessionContext = options.sessionContext || {};
  const domain = options.domain || "auto";
  const { canonical, normalizedKey } = normalizeSubject(rawSubject);
  const key = canonical || normalizedKey;

  if (!key || key.length < 2) {
    return {
      entityId: null,
      entity: null,
      confidence: SUBJECT_CONFIDENCE.LOW,
      candidates: [],
      matchType: null,
      ambiguous: false,
    };
  }

  if (options.preferSessionProject !== false) {
    const sessionHit = resolveSessionProject(rawSubject, sessionContext);
    if (sessionHit) {
      return {
        entityId: sessionHit.resolvedEntityId,
        entity: sessionHit,
        confidence: sessionHit.confidence,
        candidates: [sessionHit],
        matchType: "session_project",
        ambiguous: false,
      };
    }
  }

  const domainFilter =
    domain === "public"
      ? ENTITY_DOMAINS.PUBLIC
      : domain === "internal"
        ? ENTITY_DOMAINS.INTERNAL
        : null;

  const tryInternal = domain === "auto" || domain === "internal";
  const tryPublic = domain === "auto" || domain === "public";

  if (tryInternal) {
    const internalHit = resolveByNormalizedKey(key, {
      domainFilter: ENTITY_DOMAINS.INTERNAL,
    });
    if (internalHit) {
      return {
        entityId: internalHit.resolvedEntityId,
        entity: internalHit,
        confidence: internalHit.confidence,
        candidates: [internalHit],
        matchType: internalHit.matchType,
        ambiguous: false,
      };
    }
  }

  if (tryPublic) {
    const publicHit = resolveByNormalizedKey(key, {
      domainFilter: ENTITY_DOMAINS.PUBLIC,
    });
    if (publicHit) {
      const candidates = buildCandidatesFromHit(publicHit);
      return {
        entityId: publicHit.resolvedEntityId,
        entity: publicHit,
        confidence: publicHit.confidence,
        candidates,
        matchType: publicHit.matchType,
        ambiguous: Boolean(publicHit.ambiguous),
      };
    }
  }

  return {
    entityId: null,
    entity: null,
    confidence: SUBJECT_CONFIDENCE.LOW,
    candidates: [],
    matchType: null,
    ambiguous: false,
  };
}

/**
 * @param {object} hit
 */
export function buildCandidatesFromHit(hit) {
  if (!hit) return [];
  if (hit.ambiguous && hit.alternateSenses?.length) {
    return hit.alternateSenses.map((sense) => ({
      label: hit.label,
      resolvedEntityId: hit.resolvedEntityId,
      kind: sense.kind,
      definition: sense.definition,
      relations: sense.relations || [],
      source: hit.source,
      confidence: SUBJECT_CONFIDENCE.MEDIUM,
    }));
  }
  return [hit];
}

/**
 * Scan requête complète pour entités publiques connues (mixed domain).
 * @param {string} query
 */
export function scanPublicEntitiesInQuery(query = "") {
  const q = normalizeGraphKey(query);
  const hits = [];

  for (const fragment of SUBJECT_GRAPH_QUERY_FRAGMENTS) {
    if (q.includes(normalizeGraphKey(fragment))) {
      const resolved = resolveSubject(fragment, { domain: "public", preferSessionProject: false });
      if (
        resolved.entity &&
        !hits.some((h) => h.resolvedEntityId === resolved.entity.resolvedEntityId)
      ) {
        hits.push(resolved.entity);
      }
    }
  }

  return hits;
}

export function hasRelation(entityId, relation) {
  const node = getGraphEntity(entityId);
  return Boolean(node?.relations?.includes(relation));
}
