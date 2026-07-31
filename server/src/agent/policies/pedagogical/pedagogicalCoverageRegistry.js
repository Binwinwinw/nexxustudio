/**
 * Registre de couverture pédagogique — gouvernance discipline × niveau × bande.
 *
 * Source de vérité pour « ce qui devrait être couvert comment ».
 * L'implémentation KB (`pedagogicalOverviewKnowledge.js`) suit ce registre ;
 * la politique (`pedagogicalCoveragePolicy.js`) ne lit que ce fichier + la KB.
 *
 * Pour ajouter une couverture : enrichir `levels` ici, puis ajouter le module KB.
 * Ne pas toucher au routeur central.
 */

/** @typedef {'kb_deterministic'|'family_generative'|'web_only'} CoverageTier */

/** @typedef {'primaire'|'college'|'lycee'|'superieur'} EducationBand */

/**
 * @typedef {Object} TopicCoverageEntry
 * @property {string} discipline
 * @property {string} family
 * @property {string|null} matiere
 * @property {Partial<Record<string, CoverageTier>>} levels
 * @property {Partial<Record<EducationBand, CoverageTier>>} [bands]
 */

export const PEDAGOGICAL_COLLEGE_LEVELS = ["6", "5", "4", "3"];

export const COVERAGE_TIERS = {
  KB_DETERMINISTIC: "kb_deterministic",
  FAMILY_GENERATIVE: "family_generative",
  WEB_ONLY: "web_only",
};

/** @type {Record<string, TopicCoverageEntry>} */
export const PEDAGOGICAL_TOPIC_COVERAGE = {
  fractions: {
    discipline: "maths",
    family: "maths_socle",
    matiere: "maths",
    levels: {
      "6": COVERAGE_TIERS.KB_DETERMINISTIC,
      "5": COVERAGE_TIERS.KB_DETERMINISTIC,
      "4": COVERAGE_TIERS.KB_DETERMINISTIC,
      "3": COVERAGE_TIERS.KB_DETERMINISTIC,
    },
    bands: {
      primaire: COVERAGE_TIERS.FAMILY_GENERATIVE,
      college: COVERAGE_TIERS.KB_DETERMINISTIC,
      lycee: COVERAGE_TIERS.FAMILY_GENERATIVE,
      superieur: COVERAGE_TIERS.WEB_ONLY,
    },
  },
  geometrie: {
    discipline: "maths",
    family: "maths_socle",
    matiere: "maths",
    levels: {
      "5": COVERAGE_TIERS.KB_DETERMINISTIC,
    },
    bands: {
      primaire: COVERAGE_TIERS.FAMILY_GENERATIVE,
      college: COVERAGE_TIERS.FAMILY_GENERATIVE,
      lycee: COVERAGE_TIERS.FAMILY_GENERATIVE,
      superieur: COVERAGE_TIERS.WEB_ONLY,
    },
  },
  proportionnalite: {
    discipline: "maths",
    family: "maths_socle",
    matiere: "maths",
    levels: {},
    bands: {
      college: COVERAGE_TIERS.FAMILY_GENERATIVE,
      lycee: COVERAGE_TIERS.FAMILY_GENERATIVE,
      superieur: COVERAGE_TIERS.WEB_ONLY,
    },
  },
  equations: {
    discipline: "maths",
    family: "maths_socle",
    matiere: "maths",
    levels: {},
    bands: {
      college: COVERAGE_TIERS.FAMILY_GENERATIVE,
      lycee: COVERAGE_TIERS.FAMILY_GENERATIVE,
      superieur: COVERAGE_TIERS.WEB_ONLY,
    },
  },
  conjugaison: {
    discipline: "francais",
    family: "francais_socle",
    matiere: "francais",
    levels: {},
    bands: {
      primaire: COVERAGE_TIERS.FAMILY_GENERATIVE,
      college: COVERAGE_TIERS.FAMILY_GENERATIVE,
      lycee: COVERAGE_TIERS.FAMILY_GENERATIVE,
      superieur: COVERAGE_TIERS.WEB_ONLY,
    },
  },
  grammaire: {
    discipline: "francais",
    family: "francais_socle",
    matiere: "francais",
    levels: {},
    bands: {
      primaire: COVERAGE_TIERS.FAMILY_GENERATIVE,
      college: COVERAGE_TIERS.FAMILY_GENERATIVE,
      lycee: COVERAGE_TIERS.FAMILY_GENERATIVE,
      superieur: COVERAGE_TIERS.WEB_ONLY,
    },
  },
  histoire: {
    discipline: "histoire",
    family: "histoire_socle",
    matiere: "histoire",
    levels: {},
    bands: {
      primaire: COVERAGE_TIERS.FAMILY_GENERATIVE,
      college: COVERAGE_TIERS.FAMILY_GENERATIVE,
      lycee: COVERAGE_TIERS.FAMILY_GENERATIVE,
      superieur: COVERAGE_TIERS.WEB_ONLY,
    },
  },
  geographie: {
    discipline: "geographie",
    family: "geographie_socle",
    matiere: "geographie",
    levels: {},
    bands: {
      college: COVERAGE_TIERS.FAMILY_GENERATIVE,
      lycee: COVERAGE_TIERS.FAMILY_GENERATIVE,
      superieur: COVERAGE_TIERS.WEB_ONLY,
    },
  },
  svt: {
    discipline: "svt",
    family: "svt_socle",
    matiere: "svt",
    levels: {},
    bands: {
      college: COVERAGE_TIERS.FAMILY_GENERATIVE,
      lycee: COVERAGE_TIERS.FAMILY_GENERATIVE,
      superieur: COVERAGE_TIERS.WEB_ONLY,
    },
  },
  physique: {
    discipline: "physique",
    family: "physique_socle",
    matiere: "physique",
    levels: {},
    bands: {
      college: COVERAGE_TIERS.FAMILY_GENERATIVE,
      lycee: COVERAGE_TIERS.FAMILY_GENERATIVE,
      superieur: COVERAGE_TIERS.WEB_ONLY,
    },
  },
};

export const PEDAGOGICAL_DISCIPLINE_INDEX = {
  maths: {
    label: "Mathématiques",
    topics: ["fractions", "geometrie", "proportionnalite", "equations"],
  },
  francais: { label: "Français", topics: ["conjugaison", "grammaire"] },
  histoire: { label: "Histoire", topics: ["histoire"] },
  geographie: { label: "Géographie", topics: ["geographie"] },
  svt: { label: "SVT", topics: ["svt"] },
  physique: { label: "Physique-Chimie", topics: ["physique"] },
};

export const PEDAGOGICAL_COVERAGE_REGISTRY = Object.fromEntries(
  Object.entries(PEDAGOGICAL_TOPIC_COVERAGE).map(([topic, entry]) => [
    topic,
    {
      family: entry.family,
      matiere: entry.matiere,
      localDeterministicLevels: Object.entries(entry.levels || {})
        .filter(([, tier]) => tier === COVERAGE_TIERS.KB_DETERMINISTIC)
        .map(([level]) => level),
    },
  ]),
);

/**
 * @param {string|null|undefined} topic
 * @returns {TopicCoverageEntry|null}
 */
export function getTopicCoverageEntry(topic) {
  if (!topic) return null;
  return PEDAGOGICAL_TOPIC_COVERAGE[topic] || null;
}

/**
 * @param {string|null|undefined} topic
 * @param {string|null|undefined} level
 * @param {EducationBand|null|undefined} educationBand
 * @returns {CoverageTier|null}
 */
export function resolveExpectedCoverageTier(topic, level, educationBand = null) {
  const entry = getTopicCoverageEntry(topic);
  if (!entry) return null;

  if (level && entry.levels?.[level]) {
    return entry.levels[level];
  }

  if (educationBand && entry.bands?.[educationBand]) {
    return entry.bands[educationBand];
  }

  if (level && educationBand === "college") {
    return entry.bands?.college ?? COVERAGE_TIERS.FAMILY_GENERATIVE;
  }

  return null;
}

/**
 * @param {string|null|undefined} topic
 * @returns {boolean}
 */
export function isRegisteredPedagogicalTopic(topic) {
  return Boolean(getTopicCoverageEntry(topic));
}

/**
 * @returns {Array<{ topic: string, discipline: string, kbLevels: string[], bandDefaults: Partial<Record<EducationBand, CoverageTier>> }>}
 */
export function summarizePedagogicalCoverageRegistry() {
  return Object.entries(PEDAGOGICAL_TOPIC_COVERAGE).map(([topic, entry]) => ({
    topic,
    discipline: entry.discipline,
    kbLevels: Object.entries(entry.levels || {})
      .filter(([, tier]) => tier === COVERAGE_TIERS.KB_DETERMINISTIC)
      .map(([level]) => level),
    bandDefaults: entry.bands || {},
  }));
}
