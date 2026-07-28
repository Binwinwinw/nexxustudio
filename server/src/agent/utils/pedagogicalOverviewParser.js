/**
 * Intent + slots pour les aperçus pédagogiques.
 * Sépare la détection de l'intention de l'extraction paramétrée (niveau, thème, profondeur).
 */
import { normalizeFamiliarityQuery } from "./familiarityIntentGuards.js";

/** @typedef {'intro'|'standard'|'advanced'} PedagogicalDepth */
/** @typedef {'high'|'medium'|'low'} SlotConfidence */
/** @typedef {'primaire'|'college'|'lycee'|'superieur'|null} EducationBand */

/**
 * @typedef {Object} PedagogicalOverviewSlots
 * @property {'pedagogical_overview'} intent
 * @property {string|null} topic — clé interne (ex. fractions)
 * @property {string|null} topicLabel — libellé surface (ex. fractions complexes)
 * @property {string|null} matiere
 * @property {string|null} level — chiffre normalisé ('3'|'4'|'5'|'6')
 * @property {string|null} levelLabel — libellé affiché ('4e', '6ème', 'seconde')
 * @property {string|null} lyceeGrade — 'seconde'|'premiere'|'terminale'
 * @property {PedagogicalDepth|null} depth
 * @property {EducationBand} educationBand
 * @property {'overview'} scope
 * @property {SlotConfidence} confidence
 * @property {string[]} missingSlots
 */

const LEVEL_EXPLICIT_RE =
  /\b(?:eleve|élève|ecolier|écolier|niveau|classe|en|de)\s+(?:de\s+)?(\d{1,2})\s*(?:e|eme|ème)\b/i;
const LEVEL_SHORT_RE = /\b(\d{1,2})\s*(?:e|eme|ème)\b/i;
const CM2_RE = /\bcm2\b/i;
const PRIMAIRE_RE =
  /\b(?:primaire|cp|ce1|ce2|cm1|cm2|ecole\s+elementaire|école\s+élémentaire)\b/i;
const LYCEE_RE =
  /\b(?:lycee|lycée|seconde|2nde|premiere|première|1ere|1ère|terminale|bac\s+pro|bac\s+general|bac\s+général)\b/i;
const SUPERIEUR_RE =
  /\b(?:licence|master|mast[eè]re|doctorat|bac\+?\s*[345]|l\s*[123]\b|m\s*[12]\b|grandes?\s+[eé]coles?|superieur|supérieur|universite|université|dut|bts|but|iut|prepa|pr[eé]pa)\b/i;

const DEPTH_INTRO_RE =
  /\b(?:simple|simples|introductif(?:s|es)?|bases?|de\s+base|elementaires?|élémentaires?|premiers?\s+pasi?|notions?\s+de\s+base)\b/i;
const DEPTH_ADVANCED_RE =
  /\b(?:complex|complexes|avance(?:e|es)?|approfondi(?:e|es)?|difficile(?:s)?|operations?\s+sur|calculs?\s+(?:avec|sur))\b/i;

/** @type {ReadonlyArray<{ key: string, pattern: RegExp, matiere: string, label: string }>} */
export const PEDAGOGICAL_TOPIC_REGISTRY = [
  { key: "fractions", pattern: /\bfractions?\b/i, matiere: "maths", label: "fractions" },
  {
    key: "geometrie",
    pattern: /\b(?:geometrie|géométrie)\b/i,
    matiere: "maths",
    label: "géométrie",
  },
  {
    key: "proportionnalite",
    pattern: /\b(?:proportionnalite|proportionnalité|proportion|pourcentage|pourcentages)\b/i,
    matiere: "maths",
    label: "proportionnalité",
  },
  {
    key: "equations",
    pattern: /\b(?:equation|équations?)\b/i,
    matiere: "maths",
    label: "équations",
  },
  {
    key: "conjugaison",
    pattern: /\bconjugaison\b/i,
    matiere: "francais",
    label: "conjugaison",
  },
  {
    key: "grammaire",
    pattern: /\bgrammaire\b/i,
    matiere: "francais",
    label: "grammaire",
  },
  {
    key: "histoire",
    pattern: /\bhistoire\b/i,
    matiere: "histoire",
    label: "histoire",
  },
  {
    key: "geographie",
    pattern: /\b(?:geographie|géographie|geo)\b/i,
    matiere: "geographie",
    label: "géographie",
  },
  {
    key: "svt",
    pattern: /\bsvt\b/i,
    matiere: "svt",
    label: "SVT",
  },
  {
    key: "physique",
    pattern: /\bphysique(?:\s*-?\s*chimie)?\b/i,
    matiere: "physique",
    label: "physique",
  },
];

const VALID_LEVELS = new Set(["3", "4", "5", "6"]);

const LYCEE_GRADE_RE =
  /\b(seconde|2nde|premiere|première|1ere|1ère|terminale)\b/i;

/**
 * @param {string} raw
 * @returns {{ lyceeGrade: string|null, levelLabel: string|null }}
 */
export function extractLyceeGrade(raw = "") {
  const q = normalizeFamiliarityQuery(raw);
  if (!q) return { lyceeGrade: null, levelLabel: null };

  if (/\b(seconde|2nde)\b/i.test(q)) {
    return { lyceeGrade: "seconde", levelLabel: "seconde" };
  }
  if (/\b(premiere|première|1ere|1ère)\b/i.test(q)) {
    return { lyceeGrade: "premiere", levelLabel: "première" };
  }
  if (/\bterminale\b/i.test(q)) {
    return { lyceeGrade: "terminale", levelLabel: "terminale" };
  }

  return { lyceeGrade: null, levelLabel: null };
}

/**
 * @param {string} raw
 * @returns {{ level: string|null, levelLabel: string|null }}
 */
export function extractPedagogicalLevel(raw = "") {
  const q = normalizeFamiliarityQuery(raw);
  if (!q) return { level: null, levelLabel: null };

  const explicit = q.match(LEVEL_EXPLICIT_RE);
  if (explicit?.[1] && VALID_LEVELS.has(explicit[1])) {
    return { level: explicit[1], levelLabel: `${explicit[1]}e` };
  }

  const short = q.match(LEVEL_SHORT_RE);
  if (short?.[1] && VALID_LEVELS.has(short[1])) {
    return { level: short[1], levelLabel: `${short[1]}e` };
  }

  if (CM2_RE.test(q)) {
    return { level: "6", levelLabel: "CM2" };
  }

  return { level: null, levelLabel: null };
}

/**
 * @param {string} raw
 * @returns {EducationBand}
 */
export function extractPedagogicalEducationBand(raw = "") {
  const q = normalizeFamiliarityQuery(raw);
  if (!q) return null;
  if (SUPERIEUR_RE.test(q)) return "superieur";
  if (LYCEE_RE.test(q)) return "lycee";
  if (PRIMAIRE_RE.test(q) || CM2_RE.test(q)) return "primaire";
  if (/\b(?:6e|5e|4e|3e|6eme|5eme|4eme|3eme|college|collège|cycle\s+[34])\b/i.test(q)) {
    return "college";
  }
  return null;
}

/**
 * @param {string} raw
 * @returns {PedagogicalDepth|null}
 */
export function extractPedagogicalDepth(raw = "") {
  const q = normalizeFamiliarityQuery(raw);
  if (!q) return null;
  if (DEPTH_ADVANCED_RE.test(q)) return "advanced";
  if (DEPTH_INTRO_RE.test(q)) return "intro";
  return null;
}

/**
 * @param {string} raw
 * @returns {{ topic: string|null, topicLabel: string|null, matiere: string|null }}
 */
export function extractPedagogicalTopic(raw = "") {
  const q = normalizeFamiliarityQuery(raw);
  if (!q) return { topic: null, topicLabel: null, matiere: null };

  for (const entry of PEDAGOGICAL_TOPIC_REGISTRY) {
    if (!entry.pattern.test(q)) continue;

    const topicStem = entry.label.replace(/s$/, "");
    const qualifierMatch = q.match(
      new RegExp(
        `\\b${topicStem}s?\\s+(simples?|complexes?|equivalentes?|avance(?:e|es)?)\\b`,
        "i",
      ),
    );
    const topicLabel = qualifierMatch
      ? `${entry.label} ${qualifierMatch[1]}`.replace(/\s+/g, " ").trim()
      : entry.label;

    return { topic: entry.key, topicLabel, matiere: entry.matiere };
  }

  const surMatch = q.match(
    /\b(?:sur|en|de|du|dans)\s+(?:les\s+|la\s+|le\s+|l')?([^?.!]{3,80})$/,
  );
  if (surMatch?.[1]) {
    const label = String(surMatch[1]).replace(/\s+/g, " ").trim();
    return { topic: null, topicLabel: label, matiere: null };
  }

  return { topic: null, topicLabel: null, matiere: null };
}

/**
 * @param {string} query
 * @returns {PedagogicalOverviewSlots|null}
 */
export function parsePedagogicalOverview(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q || q.length < 12) return null;

  const { level, levelLabel: collegeLevelLabel } = extractPedagogicalLevel(q);
  const { lyceeGrade, levelLabel: lyceeLevelLabel } = extractLyceeGrade(q);
  const depth = extractPedagogicalDepth(q);
  const educationBand = extractPedagogicalEducationBand(q);
  const { topic, topicLabel, matiere } = extractPedagogicalTopic(q);

  const levelLabel = collegeLevelLabel || lyceeLevelLabel || null;

  const missingSlots = [];
  if (!topic && !topicLabel) missingSlots.push("topic");
  if (!level && !lyceeGrade && !educationBand) missingSlots.push("level");

  let confidence = "high";
  if (!topic) confidence = "medium";
  if (!level && !depth && !lyceeGrade && !educationBand) confidence = "low";
  if (!topic && !level && !lyceeGrade && !educationBand) confidence = "low";

  return {
    intent: "pedagogical_overview",
    topic,
    topicLabel,
    matiere,
    level,
    levelLabel,
    lyceeGrade,
    depth,
    educationBand,
    scope: "overview",
    confidence,
    missingSlots,
  };
}

/**
 * Résout le niveau effectif pour le rendu — sans nearest-match silencieux.
 * Pas de fallback collège si lycée/supérieur/primaire est explicitement demandé.
 *
 * @param {PedagogicalOverviewSlots} slots
 * @param {{ defaultLevelByDepth?: Partial<Record<PedagogicalDepth, string>>, defaultLevel?: string|null, levelModules?: Record<string, unknown> }} topicConfig
 * @returns {string|null}
 */
export function resolvePedagogicalRenderLevel(slots, topicConfig = {}) {
  if (slots.level && VALID_LEVELS.has(slots.level)) {
    return slots.level;
  }

  if (slots.lyceeGrade) {
    return topicConfig.levelModules?.[slots.lyceeGrade] ? slots.lyceeGrade : null;
  }

  if (
    slots.educationBand === "lycee" ||
    slots.educationBand === "superieur" ||
    slots.educationBand === "primaire"
  ) {
    return null;
  }

  const depthDefaults = topicConfig.defaultLevelByDepth || {};
  if (slots.depth && depthDefaults[slots.depth]) {
    return depthDefaults[slots.depth];
  }

  if (
    !slots.level &&
    !slots.lyceeGrade &&
    (!slots.educationBand || slots.educationBand === "college")
  ) {
    if (topicConfig.defaultLevel) {
      return topicConfig.defaultLevel;
    }
  }

  return null;
}
