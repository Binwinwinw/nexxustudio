/* server/src/agent/utils/familiarityIntentGuards.js */
import { isIdeationIntent } from "./ideationIntentGuards.js";
import { isIdentityIntent } from "./identityIntentGuards.js";
import {
  sanitizeQuery,
  stripTrailingFiller,
} from "../micro/normalization/querySanitizer.js";
import {
  formatSubjectSurfaceForm,
  SURFACE_FORM_BY_KEY,
  extractMainEntity,
  resolveCelebrityLabel,
} from "../micro/normalization/surfaceFormNormalizer.js";
import {
  inferCelebrityFromContext,
  isOrganizationEntity,
} from "../micro/normalization/subjectEntityExtractor.js";
import {
  enrichSubjectResolution,
  extractCandidateSubject,
} from "../micro/classifiers/subjectUnderstanding.js";
import { getPromotedLexiconMap } from "../micro/lexicon/lexiconLearningStore.js";
import { observeLexiconLearning } from "../micro/lexicon/lexiconLearningOrchestrator.js";

export { formatSubjectSurfaceForm, SURFACE_FORM_BY_KEY };

export const FAMILIARITY_MAX_WORDS = 18;

/** @typedef {"tool_platform"|"concept_method"|"place_institution"|"person_entity"|"unknown_subject"} SubjectCategory */

export const SUBJECT_CATEGORIES = {
  TOOL_PLATFORM: "tool_platform",
  CONCEPT_METHOD: "concept_method",
  PLACE_INSTITUTION: "place_institution",
  PERSON_ENTITY: "person_entity",
  UNKNOWN: "unknown_subject",
};

/** @typedef {"country_region"|"city_place"|"institution_museum"|"landmark_site"} PlaceSubtype */

export const PLACE_SUBTYPES = {
  COUNTRY_REGION: "country_region",
  CITY_PLACE: "city_place",
  INSTITUTION_MUSEUM: "institution_museum",
  LANDMARK_SITE: "landmark_site",
};

/** @typedef {"person_organization"|"person_celebrity"} PersonSubtype */

export const PERSON_SUBTYPES = {
  ORGANIZATION: "person_organization",
  CELEBRITY: "person_celebrity",
};

/**
 * Règle d'ouverture familiarité (entité + complément) :
 * quand rawSubject = « X et [complément] », l'ouverture (« je connais … »)
 * porte exclusivement sur subject.label (entité principale extraite),
 * jamais sur rawSubject ni le complément lexical.
 */
export const FAMILIARITY_MAIN_ENTITY_OPENING_RULE = "main_entity_only";

/**
 * Mode de réponse familiarité — reconnaissance simple sur sujet connu :
 * reconnaissance humaine brève (1–2 phrases), pas d'offre de service générique.
 */
export const FAMILIARITY_REPLY_MODES = {
  SIMPLE_KNOWN_SUBJECT: "simple_known_subject",
  FOLLOWUP_APERCU: "familiarity_followup_apercu",
  DOMAIN_READINESS: "domain_readiness",
};

const SIMPLE_RECOGNITION_FOLLOW_UP = "Tu veux que je t'en parle rapidement ?";
const SIMPLE_RECOGNITION_FOLLOW_UP_ALT =
  "Tu veux un aperçu ou tu as une question précise ?";

export const FAMILIARITY_ANTI_MARKERS = [
  "fichier",
  "analyse",
  "analyser",
  "corrige",
  "corriger",
  "debug",
  "erreur",
  "bug",
  "implement",
  "implément",
  "code source",
  "endpoint",
  "crash",
  "log ",
  "screenshot",
  "capture d",
  "regarde cette",
  "voir cette image",
];

/** Intentions additionnelles — requête compound, pas une reconnaissance pure de sujet. */
export const FAMILIARITY_COMPOUND_INTENT_MARKERS = [
  "recette",
  "cuisine",
  "cuire",
  "ingredient",
  "ingrédient",
  "plat",
  "pates",
  "pâtes",
  "voyage",
  "visiter",
  "monument",
  "monuments",
  "itineraire",
  "itinéraire",
  "enfant",
  "enfants",
  "famille",
  "chercher",
  "trouver",
  "acheter",
  "comparer",
  "comment faire",
  "comment preparer",
  "comment préparer",
  "histoire de",
  "afin de",
  "pour pouvoir",
  "me conseiller",
  "me recommander",
];

const FAMILIARITY_SHELL_STRIP_PATTERNS = [
  /^(?:est[- ]ce[- ]que )?tu t y connais en\s+/,
  /^tu t y connais en\s+/,
  /^(?:est[- ]ce[- ]que )?tu connais bien\s+/,
  /^tu connais bien\s+/,
  /^(?:est[- ]ce[- ]que )?tu peux parler de\s+/,
  /^tu peux parler de\s+/,
  /^(?:est[- ]ce[- ]que )?tu peux parler d\s+/,
  /^tu peux parler d\s+/,
  /^(?:est[- ]ce[- ]que )?tu connais\s+/,
  /^connais[- ]tu\s+/,
  /^tu as entendu parler de\s+/,
  /^(?:est[- ]ce[- ]que )?que sais[- ]tu de\s+/,
  /^que sais[- ]tu de\s+/,
  /^(?:est[- ]ce[- ]que )?que sais[- ]tu du\s+/,
  /^que sais[- ]tu du\s+/,
  /^(?:est[- ]ce[- ]que )?que sais[- ]tu de la\s+/,
  /^que sais[- ]tu de la\s+/,
  /^(?:est[- ]ce[- ]que )?que sais[- ]tu des\s+/,
  /^que sais[- ]tu des\s+/,
  /^(?:est[- ]ce[- ]que )?que sais[- ]tu a propos de\s+/,
  /^que sais[- ]tu a propos de\s+/,
  /^(?:est[- ]ce[- ]que )?que sais[- ]tu sur\s+/,
  /^que sais[- ]tu sur\s+/,
  /^parle[- ]moi de\s+/,
  /^parlez[- ]moi de\s+/,
  /^donne[- ]moi un apercu de\s+/,
  /^dis[- ]moi en plus sur\s+/,
  /^(?:c est quoi|qu est ce que c est)\s+/,
  /^qu est ce que\s+/,
  /^tu sais ce que c est que\s+/,
  /^(?:tu peux|peux tu|pouvez vous) m aider (?:sur|avec|pour)\s+/,
];

const EXTRACTION_RULES = [
  {
    kind: "domain_readiness",
    pattern:
      /(?:^|\b)(?:est[- ]ce[- ]que )?tu t y connais en\s+(.+?)(?:\s*\?|\s*$)/,
  },
  {
    kind: "domain_readiness",
    pattern: /(?:^|\b)tu t y connais en\s+(.+?)(?:\s*\?|\s*$)/,
  },
  {
    kind: "domain_readiness",
    pattern:
      /(?:^|\b)(?:est[- ]ce[- ]que )?tu connais bien\s+(.+?)(?:\s*\?|\s*$)/,
  },
  {
    kind: "domain_readiness",
    pattern: /(?:^|\b)tu connais bien\s+(.+?)(?:\s*\?|\s*$)/,
  },
  {
    kind: "domain_readiness",
    pattern:
      /(?:^|\b)(?:est[- ]ce[- ]que )?tu peux parler de\s+(.+?)(?:\s*\?|\s*$)/,
  },
  {
    kind: "domain_readiness",
    pattern: /(?:^|\b)tu peux parler de\s+(.+?)(?:\s*\?|\s*$)/,
  },
  {
    kind: "domain_readiness",
    pattern:
      /(?:^|\b)(?:est[- ]ce[- ]que )?tu peux parler d\s+(.+?)(?:\s*\?|\s*$)/,
  },
  {
    kind: "domain_readiness",
    pattern: /(?:^|\b)tu peux parler d\s+(.+?)(?:\s*\?|\s*$)/,
  },
  {
    kind: "recognition",
    pattern: /(?:^|\b)(?:est[- ]ce que )?tu connais\s+(.+?)(?:\s*\?|\s*$)/,
  },
  {
    kind: "recognition",
    pattern: /(?:^|\b)connais[- ]tu\s+(.+?)(?:\s*\?|\s*$)/,
  },
  {
    kind: "recognition",
    pattern: /tu as entendu parler de\s+(.+?)(?:\s*\?|\s*$)/,
  },

  {
    kind: "overview",
    pattern: /(?:^|\b)que sais[- ]tu de\s+(.+?)(?:\s*\?|\s*$)/,
  },
  {
    kind: "overview",
    pattern: /(?:^|\b)que sais tu de\s+(.+?)(?:\s*\?|\s*$)/,
  },
  {
    kind: "overview",
    pattern: /(?:^|\b)que sais[- ]tu du\s+(.+?)(?:\s*\?|\s*$)/,
  },
  {
    kind: "overview",
    pattern: /(?:^|\b)que sais tu du\s+(.+?)(?:\s*\?|\s*$)/,
  },
  {
    kind: "overview",
    pattern: /(?:^|\b)que sais[- ]tu de la\s+(.+?)(?:\s*\?|\s*$)/,
  },
  {
    kind: "overview",
    pattern: /(?:^|\b)que sais tu de la\s+(.+?)(?:\s*\?|\s*$)/,
  },
  {
    kind: "overview",
    pattern: /(?:^|\b)que sais[- ]tu des\s+(.+?)(?:\s*\?|\s*$)/,
  },
  {
    kind: "overview",
    pattern: /(?:^|\b)que sais tu des\s+(.+?)(?:\s*\?|\s*$)/,
  },
  {
    kind: "overview",
    pattern: /(?:^|\b)que sais[- ]tu a propos de\s+(.+?)(?:\s*\?|\s*$)/,
  },
  {
    kind: "overview",
    pattern: /(?:^|\b)que sais tu a propos de\s+(.+?)(?:\s*\?|\s*$)/,
  },
  {
    kind: "overview",
    pattern: /(?:^|\b)que sais[- ]tu sur\s+(.+?)(?:\s*\?|\s*$)/,
  },
  {
    kind: "overview",
    pattern: /(?:^|\b)que sais tu sur\s+(.+?)(?:\s*\?|\s*$)/,
  },
  {
    kind: "overview",
    pattern: /(?:^|\b)parle[- ]moi de\s+(.+?)(?:\s*\?|\s*$)/,
  },
  {
    kind: "overview",
    pattern: /(?:^|\b)parlez[- ]moi de\s+(.+?)(?:\s*\?|\s*$)/,
  },
  {
    kind: "overview",
    pattern: /(?:^|\b)donne[- ]moi un apercu de\s+(.+?)(?:\s*\?|\s*$)/,
  },
  {
    kind: "overview",
    pattern: /(?:^|\b)dis[- ]moi en plus sur\s+(.+?)(?:\s*\?|\s*$)/,
  },

  {
    kind: "definition",
    pattern: /(?:^|\b)(?:c est quoi|qu est ce que c est)\s+(.+?)(?:\s*\?|\s*$)/,
  },
  {
    kind: "definition",
    pattern: /(?:^|\b)qu est ce que\s+(.+?)(?:\s*\?|\s*$)/,
  },
  {
    kind: "definition",
    pattern: /tu sais ce que c est que\s+(.+?)(?:\s*\?|\s*$)/,
  },
  {
    kind: "help",
    pattern:
      /(?:^|\b)(?:tu peux|peux[- ]tu|pouvez[- ]vous) m aider (?:sur|avec|pour)\s+(.+?)(?:\s*\?|\s*$)/,
  },
];

const PLACE_INFERENCE_PATTERN =
  /\b(musee|monument|ville|region|pays|ile|arrondissement|cathedrale|chateau|louvre|paris|martinique|guadeloupe|france|italie|rome|institution|universite|bibliotheque|colisee|eiffel)\b/;

const MUSEUM_INFERENCE_PATTERN = /\b(musee|galerie|bibliotheque)\b/;
const LANDMARK_INFERENCE_PATTERN =
  /\b(tour|colisee|pont|arc|cathedrale|chateau|statue|monument)\b/;

const COUNTRY_KEYS = new Set([
  "italie",
  "france",
  "martinique",
  "guadeloupe",
  "japon",
  "espagne",
  "allemagne",
  "belgique",
  "suisse",
  "canada",
  "portugal",
  "grece",
  "maroc",
  "senegal",
  "bresil",
  "brésil",
  "etats unis",
  "royaume uni",
]);

const CITY_KEYS = new Set([
  "paris",
  "rome",
  "lyon",
  "marseille",
  "fort de france",
  "bordeaux",
  "lille",
  "toulouse",
  "nice",
  "milan",
  "naples",
]);

const ENTITY_INFERENCE_PATTERN =
  /\b(openai|mistral|microsoft|google|meta|anthropic|nvidia|apple|amazon|deepseek|hostinger)\b/;

const CONCEPT_INFERENCE_PATTERN =
  /\b(rag|embedding|embeddings|vectorisation|fine tuning|prompt engineering|llm|transformer|retrieval)\b/;

function buildEffectiveLexicon() {
  const promoted = getPromotedLexiconMap();
  /** @type {Record<string, object>} */
  const effective = { ...SUBJECT_LEXICON };

  for (const [key, entry] of Object.entries(promoted)) {
    const normalizedEntry = {
      label: entry.label,
      category: entry.category || SUBJECT_CATEGORIES.UNKNOWN,
      placeSubtype: entry.placeSubtype ?? null,
      personSubtype: entry.personSubtype ?? null,
      definition: entry.definition ?? null,
      helpAngles:
        entry.helpAngles ??
        DEFAULT_HELP_ANGLES[entry.category || SUBJECT_CATEGORIES.UNKNOWN],
      lexiconSource: "promoted_lexicon",
    };
    effective[key] = normalizedEntry;
    for (const alias of entry.aliases || []) {
      const aliasNorm = normalizeFamiliarityQuery(alias);
      const bare = aliasNorm.replace(/^(le|la|les|l)\s+/, "");
      if (!effective[aliasNorm]) effective[aliasNorm] = normalizedEntry;
      if (bare && !effective[bare]) effective[bare] = normalizedEntry;
    }
  }

  return effective;
}

export function hasStaticLexiconEntry(canonicalKey = "") {
  const key = normalizeFamiliarityQuery(canonicalKey).replace(
    /^(le|la|les|l)\s+/,
    "",
  );
  return Object.keys(SUBJECT_LEXICON).some(
    (k) => k === key || key.includes(k) || k.includes(key),
  );
}

/** @type {Record<string, { label: string, category: SubjectCategory, placeSubtype?: PlaceSubtype, definition?: string, helpAngles?: string[] }>} */
const SUBJECT_LEXICON = {
  "teams 365": {
    label: "Teams 365",
    category: SUBJECT_CATEGORIES.TOOL_PLATFORM,
    definition:
      "L'écosystème Microsoft 365 centré sur Teams pour la collaboration, les réunions et le partage.",
    helpAngles: [
      "le présenter",
      "créer un atelier",
      "structurer du contenu",
      "concevoir une interface autour",
    ],
  },
  "microsoft 365": {
    label: "Microsoft 365",
    category: SUBJECT_CATEGORIES.TOOL_PLATFORM,
    definition:
      "Suite cloud Microsoft (Teams, SharePoint, OneDrive, Office) pour le travail collaboratif.",
    helpAngles: [
      "cadrer un usage",
      "préparer un atelier",
      "structurer un parcours utilisateur",
    ],
  },
  "microsoft teams": {
    label: "Microsoft Teams",
    category: SUBJECT_CATEGORIES.TOOL_PLATFORM,
    definition:
      "Plateforme de collaboration Microsoft pour chat, réunions et partage de fichiers.",
    helpAngles: [
      "présenter Teams",
      "préparer un atelier",
      "structurer un scénario pédagogique",
    ],
  },
  teams: {
    label: "Microsoft Teams",
    category: SUBJECT_CATEGORIES.TOOL_PLATFORM,
    definition:
      "Plateforme de collaboration Microsoft pour chat, réunions et partage de fichiers.",
    helpAngles: [
      "présenter Teams",
      "préparer un atelier",
      "structurer un scénario pédagogique",
    ],
  },
  obsidian: {
    label: "Obsidian",
    category: SUBJECT_CATEGORIES.TOOL_PLATFORM,
    definition:
      "Outil de prise de notes en markdown avec liens, graphe et plugins.",
    helpAngles: [
      "organiser un vault",
      "configurer des templates",
      "l'intégrer à La Citadelle",
    ],
  },
  docker: {
    label: "Docker",
    category: SUBJECT_CATEGORIES.TOOL_PLATFORM,
    definition:
      "Plateforme de conteneurisation pour empaqueter et exécuter des applications.",
    helpAngles: ["le comprendre", "l'installer", "le configurer", "l'utiliser"],
  },
  ollama: {
    label: "Ollama",
    category: SUBJECT_CATEGORIES.TOOL_PLATFORM,
    definition:
      "Runtime local pour exécuter des modèles de langage sur ta machine.",
    helpAngles: [
      "choisir un modèle",
      "configurer le contexte",
      "l'intégrer à un pipeline",
    ],
  },
  rag: {
    label: "le RAG",
    category: SUBJECT_CATEGORIES.CONCEPT_METHOD,
    definition:
      "une approche qui combine recherche documentaire et génération pour enrichir un LLM.",
    helpAngles: ["t'en faire un aperçu simple", "t'aider à l'implémenter"],
  },
  embeddings: {
    label: "les embeddings",
    category: SUBJECT_CATEGORIES.CONCEPT_METHOD,
    definition:
      "des représentations vectorielles de texte utilisées pour la recherche sémantique.",
    helpAngles: [
      "t'en expliquer le principe",
      "t'aider à les utiliser dans un index",
    ],
  },
  vectorisation: {
    label: "la vectorisation",
    category: SUBJECT_CATEGORIES.CONCEPT_METHOD,
    definition:
      "le processus de conversion de contenu en vecteurs pour la recherche ou le RAG.",
    helpAngles: [
      "t'en faire un aperçu simple",
      "t'aider à cadrer un cas d'usage",
    ],
  },
  react: {
    label: "React",
    category: SUBJECT_CATEGORIES.TOOL_PLATFORM,
    definition: "Bibliothèque JavaScript pour construire des interfaces web.",
    helpAngles: [
      "structurer un composant",
      "organiser un petit projet",
      "intégrer une API",
    ],
  },
  vite: {
    label: "Vite",
    category: SUBJECT_CATEGORIES.TOOL_PLATFORM,
    definition:
      "Outil de build frontend rapide pour projets JavaScript/TypeScript.",
    helpAngles: [
      "démarrer un projet",
      "configurer le dev server",
      "préparer un build",
    ],
  },
  node: {
    label: "Node.js",
    category: SUBJECT_CATEGORIES.TOOL_PLATFORM,
    definition: "Runtime JavaScript côté serveur pour APIs et scripts.",
    helpAngles: [
      "structurer un petit serveur",
      "organiser des scripts",
      "débugger un module",
    ],
  },
  "node js": {
    label: "Node.js",
    category: SUBJECT_CATEGORIES.TOOL_PLATFORM,
    definition: "Runtime JavaScript côté serveur pour APIs et scripts.",
    helpAngles: [
      "structurer un petit serveur",
      "organiser des scripts",
      "débugger un module",
    ],
  },
  git: {
    label: "Git",
    category: SUBJECT_CATEGORIES.TOOL_PLATFORM,
    definition: "Système de versioning distribué pour le code source.",
    helpAngles: [
      "comprendre le workflow",
      "structurer des branches",
      "résoudre un conflit simple",
    ],
  },
  github: {
    label: "GitHub",
    category: SUBJECT_CATEGORIES.TOOL_PLATFORM,
    definition: "Plateforme d'hébergement Git pour repos, PR et CI.",
    helpAngles: [
      "organiser un repo",
      "préparer une PR",
      "configurer une action simple",
    ],
  },
  forge: {
    label: "La Forge",
    category: SUBJECT_CATEGORIES.TOOL_PLATFORM,
    definition:
      "Sous-système de production de La Citadelle pour transformer un projet validé en livrables.",
    helpAngles: [
      "comprendre le passage à la Forge",
      "préparer un dossier projet",
      "cadrer une livraison",
    ],
  },
  "la forge": {
    label: "La Forge",
    category: SUBJECT_CATEGORIES.TOOL_PLATFORM,
    definition:
      "Sous-système de production de La Citadelle pour transformer un projet validé en livrables.",
    helpAngles: [
      "comprendre le passage à la Forge",
      "préparer un dossier projet",
      "cadrer une livraison",
    ],
  },
  citadelle: {
    label: "La Citadelle",
    category: SUBJECT_CATEGORIES.TOOL_PLATFORM,
    definition:
      "Écosystème local-first de Nexxus Studio pour orchestrer connaissances, agents et production.",
    helpAngles: [
      "comprendre l'architecture",
      "explorer un module",
      "cadrer un cas d'usage",
    ],
  },
  "la citadelle": {
    label: "La Citadelle",
    category: SUBJECT_CATEGORIES.TOOL_PLATFORM,
    definition:
      "Écosystème local-first de Nexxus Studio pour orchestrer connaissances, agents et production.",
    helpAngles: [
      "comprendre l'architecture",
      "explorer un module",
      "cadrer un cas d'usage",
    ],
  },
  "musee du louvre": {
    label: "le musée du Louvre",
    category: SUBJECT_CATEGORIES.PLACE_INSTITUTION,
    placeSubtype: PLACE_SUBTYPES.INSTITUTION_MUSEUM,
    definition: "un grand musée à Paris, l'un des plus visités au monde.",
  },
  louvre: {
    label: "le musée du Louvre",
    category: SUBJECT_CATEGORIES.PLACE_INSTITUTION,
    placeSubtype: PLACE_SUBTYPES.INSTITUTION_MUSEUM,
    definition: "un grand musée à Paris, l'un des plus visités au monde.",
  },
  martinique: {
    label: "la Martinique",
    category: SUBJECT_CATEGORIES.PLACE_INSTITUTION,
    placeSubtype: PLACE_SUBTYPES.COUNTRY_REGION,
    definition:
      "une île et région française des Antilles, en mer des Caraïbes.",
  },
  italie: {
    label: "l'Italie",
    category: SUBJECT_CATEGORIES.PLACE_INSTITUTION,
    placeSubtype: PLACE_SUBTYPES.COUNTRY_REGION,
    definition:
      "un pays d'Europe du Sud, riche en histoire, culture et patrimoine.",
  },
  france: {
    label: "la France",
    category: SUBJECT_CATEGORIES.PLACE_INSTITUTION,
    placeSubtype: PLACE_SUBTYPES.COUNTRY_REGION,
    definition:
      "un pays d'Europe occidentale, connu pour sa culture, son histoire et sa diversité régionale.",
  },
  paris: {
    label: "Paris",
    category: SUBJECT_CATEGORIES.PLACE_INSTITUTION,
    placeSubtype: PLACE_SUBTYPES.CITY_PLACE,
    definition:
      "la capitale de la France, ville majeure pour culture, économie et tourisme.",
  },
  rome: {
    label: "Rome",
    category: SUBJECT_CATEGORIES.PLACE_INSTITUTION,
    placeSubtype: PLACE_SUBTYPES.CITY_PLACE,
    definition:
      "la capitale de l'Italie, ville historique au patrimoine antique et baroque exceptionnel.",
  },
  "tour eiffel": {
    label: "la tour Eiffel",
    category: SUBJECT_CATEGORIES.PLACE_INSTITUTION,
    placeSubtype: PLACE_SUBTYPES.LANDMARK_SITE,
    definition:
      "monument emblématique de Paris, construit pour l'Exposition universelle de 1889.",
  },
  colisee: {
    label: "le Colisée",
    category: SUBJECT_CATEGORIES.PLACE_INSTITUTION,
    placeSubtype: PLACE_SUBTYPES.LANDMARK_SITE,
    definition:
      "amphithéâtre antique de Rome, l'un des monuments les plus célèbres au monde.",
  },
  openai: {
    label: "OpenAI",
    category: SUBJECT_CATEGORIES.PERSON_ENTITY,
    definition:
      "une entreprise spécialisée en intelligence artificielle générative.",
    helpAngles: [
      "t'en faire un aperçu",
      "le comparer à d'autres acteurs",
      "t'aider à cadrer un usage concret",
    ],
  },
  mistral: {
    label: "Mistral AI",
    category: SUBJECT_CATEGORIES.PERSON_ENTITY,
    definition:
      "une entreprise française spécialisée en modèles de langage open-weight.",
    helpAngles: [
      "t'en faire un aperçu",
      "le comparer à d'autres acteurs",
      "t'aider à cadrer un usage local",
    ],
  },
  microsoft: {
    label: "Microsoft",
    category: SUBJECT_CATEGORIES.PERSON_ENTITY,
    personSubtype: PERSON_SUBTYPES.ORGANIZATION,
    definition:
      "un éditeur majeur de logiciels, cloud et outils collaboratifs.",
    helpAngles: [
      "t'en faire un aperçu",
      "cadrer un usage Teams ou M365",
      "t'aider à structurer un atelier",
    ],
  },
  "michael jackson": {
    label: "Michael Jackson",
    category: SUBJECT_CATEGORIES.PERSON_ENTITY,
    personSubtype: PERSON_SUBTYPES.CELEBRITY,
    definition:
      "artiste américain, icône de la pop, auteur de nombreux albums majeurs.",
  },
  "mickael jackson": {
    label: "Michael Jackson",
    category: SUBJECT_CATEGORIES.PERSON_ENTITY,
    personSubtype: PERSON_SUBTYPES.CELEBRITY,
    definition:
      "artiste américain, icône de la pop, auteur de nombreux albums majeurs.",
  },
  "taylor swift": {
    label: "Taylor Swift",
    category: SUBJECT_CATEGORIES.PERSON_ENTITY,
    personSubtype: PERSON_SUBTYPES.CELEBRITY,
    definition:
      "autrice-compositrice-interprète américaine, figure majeure de la pop contemporaine.",
  },
  petanque: {
    label: "la pétanque",
    category: SUBJECT_CATEGORIES.UNKNOWN,
    definition:
      "un sport de boules traditionnel, très populaire en France et en Provence.",
  },
  football: {
    label: "le football",
    category: SUBJECT_CATEGORIES.UNKNOWN,
    definition: "un sport collectif opposant deux équipes de onze joueurs.",
  },
  noel: {
    label: "la Noël",
    category: SUBJECT_CATEGORIES.UNKNOWN,
    definition:
      "fête chrétienne célébrée le 25 décembre, marquée par les traditions familiales, les cadeaux et les repas de fin d'année.",
  },
  "la noel": {
    label: "la Noël",
    category: SUBJECT_CATEGORIES.UNKNOWN,
    definition:
      "fête chrétienne célébrée le 25 décembre, marquée par les traditions familiales, les cadeaux et les repas de fin d'année.",
  },
};

const DEFAULT_HELP_ANGLES = {
  [SUBJECT_CATEGORIES.TOOL_PLATFORM]: [
    "le comprendre",
    "l'installer",
    "le configurer",
    "l'utiliser",
  ],
  [SUBJECT_CATEGORIES.CONCEPT_METHOD]: [
    "t'en faire un aperçu simple",
    "t'aider à l'implémenter",
  ],
  [SUBJECT_CATEGORIES.PLACE_INSTITUTION]: [
    "t'en faire un aperçu rapide",
    "t'aider à préparer une visite ou un contexte",
    "répondre à une question précise",
  ],
  [SUBJECT_CATEGORIES.PERSON_ENTITY]: [
    "t'en faire un aperçu",
    "le comparer à d'autres acteurs",
    "t'aider à cadrer un usage concret",
  ],
  [SUBJECT_CATEGORIES.UNKNOWN]: [
    "t'en parler simplement",
    "t'aider à clarifier le contexte",
    "répondre à une question précise",
  ],
};

const CELEBRITY_HELP_ANGLES = [
  "t'en parler simplement",
  "te parler de sa carrière ou de ses chansons",
  "répondre à une question précise",
];

export function normalizeFamiliarityQuery(query = "") {
  return sanitizeQuery(query);
}

export function getFamiliarityWordCount(query = "") {
  return normalizeFamiliarityQuery(query).split(/\s+/).filter(Boolean).length;
}

function cleanSubjectTail(tail = "") {
  return stripTrailingFiller(tail);
}

function stripLeadingArticle(normalized = "") {
  return String(normalized || "")
    .replace(/^(le|la|les|l)\s+/, "")
    .trim();
}

export function stripFamiliarityShell(query = "") {
  let q = normalizeFamiliarityQuery(query);
  for (const pattern of FAMILIARITY_SHELL_STRIP_PATTERNS) {
    q = q.replace(pattern, "");
  }
  return q.replace(/\?+$/g, "").trim();
}

function buildSubjectFocusCandidates(rawSubject = "") {
  const raw = normalizeFamiliarityQuery(rawSubject);
  const main = normalizeFamiliarityQuery(
    extractMainEntity(rawSubject).main || rawSubject,
  );
  const subject = resolveFamiliaritySubject(rawSubject);
  const label = normalizeFamiliarityQuery(subject.label || "");
  const bareLabel = label.replace(/^(l|la|le|les)\s+/, "");

  const candidates = new Set([raw, main, label, bareLabel].filter(Boolean));
  for (const candidate of [raw, main, label, bareLabel]) {
    if (!candidate) continue;
    candidates.add(`l ${candidate}`);
    candidates.add(`la ${candidate}`);
    candidates.add(`le ${candidate}`);
    candidates.add(`les ${candidate}`);
  }
  return candidates;
}

function isSubjectOnlyCore(core = "", rawSubject = "") {
  const normalizedCore = normalizeFamiliarityQuery(core);
  if (!normalizedCore) return false;
  const candidates = buildSubjectFocusCandidates(rawSubject);
  return candidates.has(normalizedCore);
}

/**
 * Détecte une requête {intention} + {sujet} — ne doit pas déclencher la réponse anticipée.
 */
export function hasCompoundIntentBeyondSubject(query = "", rawSubject = "") {
  const normalizedQuery = normalizeFamiliarityQuery(query);
  if (!normalizedQuery) return false;

  if (
    FAMILIARITY_COMPOUND_INTENT_MARKERS.some((marker) =>
      normalizedQuery.includes(marker),
    )
  ) {
    return true;
  }

  if (
    /\bet\s+(?:quelle|quel|quand|comment|pourquoi|c'est|c est|qu est)\b/.test(
      normalizedQuery,
    )
  ) {
    return true;
  }

  const core = stripFamiliarityShell(query);
  if (isSubjectOnlyCore(core, rawSubject)) return false;

  if (/\bet\s+(sa|son|ses|leur|leurs|la|le|les|un|une)\b/.test(core)) {
    return true;
  }

  if (/\b(avec|pour|afin de|histoire de)\b/.test(core)) {
    return true;
  }

  return core.length > 0;
}

/**
 * Réponse anticipée uniquement si la requête est focalisée sur le sujet seul.
 */
export function isPureSubjectFamiliarityQuery(query = "", parsed = null) {
  const hit = parsed || parseFamiliarityQuery(query);
  if (!hit?.rawSubject) return false;
  return !hasCompoundIntentBeyondSubject(query, hit.rawSubject);
}

function escapeRegExp(text = "") {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Évite les faux positifs lexique (ex. « italienne » → « italie »). */
function lexiconKeyMatchesText(text = "", key = "") {
  if (!text || !key) return false;
  if (text === key) return true;
  const escaped = escapeRegExp(key);
  return new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(text);
}

export function parseFamiliarityQuery(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q) return null;

  for (const rule of EXTRACTION_RULES) {
    const match = q.match(rule.pattern);
    if (!match?.[1]) continue;
    const rawSubject = cleanSubjectTail(match[1]);
    if (!rawSubject || rawSubject.length < 2) continue;
    return { kind: rule.kind, rawSubject };
  }

  return null;
}

/** @param {string} normalized @returns {SubjectCategory} */
export function inferSubjectCategory(normalized = "", label = "") {
  const probe = `${normalized} ${normalizeFamiliarityQuery(label)}`.trim();
  if (CONCEPT_INFERENCE_PATTERN.test(probe))
    return SUBJECT_CATEGORIES.CONCEPT_METHOD;
  if (PLACE_INFERENCE_PATTERN.test(probe))
    return SUBJECT_CATEGORIES.PLACE_INSTITUTION;
  if (ENTITY_INFERENCE_PATTERN.test(probe))
    return SUBJECT_CATEGORIES.PERSON_ENTITY;
  return SUBJECT_CATEGORIES.UNKNOWN;
}

export function classifySubjectCategory(subject = {}) {
  if (subject.category) return subject.category;
  const objectType = subject.objectType || subject.subject_type;
  if (objectType) {
    if (
      objectType === "vehicle" ||
      objectType === "brand" ||
      objectType === "fashion_house" ||
      objectType === "person"
    ) {
      return SUBJECT_CATEGORIES.PERSON_ENTITY;
    }
    if (objectType === "place" || objectType === "landmark") {
      return SUBJECT_CATEGORIES.PLACE_INSTITUTION;
    }
    if (
      objectType === "tool" ||
      objectType === "ide" ||
      objectType === "video_game" ||
      objectType === "internal_codename"
    ) {
      return SUBJECT_CATEGORIES.TOOL_PLATFORM;
    }
    if (
      objectType === "crypto_asset" ||
      objectType === "concept" ||
      objectType === "astronomy"
    ) {
      return SUBJECT_CATEGORIES.CONCEPT_METHOD;
    }
  }
  return inferSubjectCategory(
    normalizeFamiliarityQuery(subject.label || ""),
    subject.label || "",
  );
}

/** @returns {PlaceSubtype|null} */
export function inferPlaceSubtype(normalized = "", category = "") {
  if (category !== SUBJECT_CATEGORIES.PLACE_INSTITUTION) return null;
  const bare = stripLeadingArticle(normalized);
  if (MUSEUM_INFERENCE_PATTERN.test(normalized))
    return PLACE_SUBTYPES.INSTITUTION_MUSEUM;
  if (LANDMARK_INFERENCE_PATTERN.test(normalized))
    return PLACE_SUBTYPES.LANDMARK_SITE;
  if (COUNTRY_KEYS.has(bare) || COUNTRY_KEYS.has(normalized)) {
    return PLACE_SUBTYPES.COUNTRY_REGION;
  }
  if (CITY_KEYS.has(bare) || CITY_KEYS.has(normalized)) {
    return PLACE_SUBTYPES.CITY_PLACE;
  }
  return PLACE_SUBTYPES.CITY_PLACE;
}

export function classifyPlaceSubtype(subject = {}) {
  if (subject.placeSubtype) return subject.placeSubtype;
  const normalized = normalizeFamiliarityQuery(subject.label || "");
  const category = classifySubjectCategory(subject);
  return inferPlaceSubtype(normalized, category);
}

export function inferPersonSubtype(
  mainNormalized = "",
  complement = "",
  entry = null,
) {
  if (entry?.personSubtype) return entry.personSubtype;
  if (inferCelebrityFromContext(mainNormalized, complement)) {
    return PERSON_SUBTYPES.CELEBRITY;
  }
  if (isOrganizationEntity(mainNormalized)) {
    return PERSON_SUBTYPES.ORGANIZATION;
  }
  return PERSON_SUBTYPES.ORGANIZATION;
}

export function classifyPersonSubtype(subject = {}) {
  if (subject.personSubtype) return subject.personSubtype;
  const normalized = normalizeFamiliarityQuery(subject.label || "");
  return inferPersonSubtype(normalized, subject.complement || "");
}

/**
 * Vérifie que le sujet résolu respecte FAMILIARITY_MAIN_ENTITY_OPENING_RULE.
 * Utile en tests : le label ne doit pas réinjecter le complément ni la phrase brute.
 */
export function familiarityUsesMainEntityOpening(
  subject = {},
  rawSubject = "",
) {
  if (!subject.label) return false;
  if (!subject.complement) return true;

  const label = normalizeFamiliarityQuery(subject.label);
  const complementBody = normalizeFamiliarityQuery(subject.complement).replace(
    /^et\s+/,
    "",
  );
  const raw = normalizeFamiliarityQuery(rawSubject);

  if (raw && label === raw) return false;
  if (complementBody.length > 3 && label.includes(complementBody)) return false;

  const complementWords = complementBody
    .split(/\s+/)
    .filter((w) => w.length > 4);
  const labelWords = label.split(/\s+/);
  const leaked = complementWords.some(
    (word) =>
      labelWords.includes(word) &&
      !resolveCelebrityLabel(label)?.toLowerCase().includes(word),
  );
  return !leaked;
}

export function resolveFamiliaritySubject(rawSubject = "") {
  const { main, complement } = extractMainEntity(rawSubject);
  const normalized = cleanSubjectTail(
    normalizeFamiliarityQuery(main || rawSubject),
  );
  const normalizedFull = cleanSubjectTail(
    normalizeFamiliarityQuery(rawSubject),
  );

  if (!normalized && !normalizedFull) {
    return {
      label: null,
      known: false,
      category: SUBJECT_CATEGORIES.UNKNOWN,
      placeSubtype: null,
      personSubtype: null,
      complement: null,
      definition: null,
      helpAngles: DEFAULT_HELP_ANGLES[SUBJECT_CATEGORIES.UNKNOWN],
    };
  }

  const lexiconKeys = Object.keys(buildEffectiveLexicon()).sort(
    (a, b) => b.length - a.length,
  );
  const effectiveLexicon = buildEffectiveLexicon();

  for (const key of lexiconKeys) {
    const matchesMain =
      normalized === key ||
      lexiconKeyMatchesText(normalized, key) ||
      (normalized.length <= key.length && key.includes(normalized));
    const matchesFull =
      normalizedFull === key ||
      lexiconKeyMatchesText(normalizedFull, key) ||
      (normalizedFull.length <= key.length && key.includes(normalizedFull));
    if (matchesMain || matchesFull) {
      const entry = effectiveLexicon[key];
      return enrichSubjectResolution(
        {
          known: true,
          label: entry.label,
          category: entry.category,
          placeSubtype: entry.placeSubtype ?? null,
          personSubtype:
            entry.personSubtype ??
            (entry.category === SUBJECT_CATEGORIES.PERSON_ENTITY
              ? inferPersonSubtype(normalized, complement, entry)
              : null),
          complement: complement || null,
          definition: entry.definition ?? null,
          helpAngles:
            entry.personSubtype === PERSON_SUBTYPES.CELEBRITY
              ? CELEBRITY_HELP_ANGLES
              : (entry.helpAngles ?? DEFAULT_HELP_ANGLES[entry.category]),
        },
        normalized,
      );
    }
  }

  const category = inferSubjectCategory(normalized, main || rawSubject);
  const placeSubtype =
    category === SUBJECT_CATEGORIES.PLACE_INSTITUTION
      ? inferPlaceSubtype(normalized, category)
      : null;
  const personSubtype =
    category === SUBJECT_CATEGORIES.PERSON_ENTITY
      ? inferPersonSubtype(normalized, complement)
      : inferCelebrityFromContext(normalized, complement)
        ? PERSON_SUBTYPES.CELEBRITY
        : null;
  const resolvedCategory =
    personSubtype === PERSON_SUBTYPES.CELEBRITY &&
    category === SUBJECT_CATEGORIES.UNKNOWN
      ? SUBJECT_CATEGORIES.PERSON_ENTITY
      : category;
  const celebrityLabel = resolveCelebrityLabel(normalized);
  const label =
    celebrityLabel ||
    formatSubjectSurfaceForm(main || rawSubject, {
      category: resolvedCategory,
      placeSubtype,
    });

  return enrichSubjectResolution(
    {
      label,
      known: false,
      category: resolvedCategory,
      placeSubtype,
      personSubtype,
      complement: complement || null,
      definition: null,
      helpAngles:
        personSubtype === PERSON_SUBTYPES.CELEBRITY
          ? CELEBRITY_HELP_ANGLES
          : DEFAULT_HELP_ANGLES[resolvedCategory],
    },
    normalized,
  );
}

export function resolveKnownOrUnknownSubject(rawSubject = "") {
  const { normalized } = extractCandidateSubject(rawSubject);
  return enrichSubjectResolution(
    resolveFamiliaritySubject(rawSubject),
    normalized,
  );
}

export function isFamiliarityIntent(query = "") {
  if (!query || isIdentityIntent(query) || isIdeationIntent(query)) {
    return false;
  }

  const q = normalizeFamiliarityQuery(query);
  if (!q || getFamiliarityWordCount(query) > FAMILIARITY_MAX_WORDS) {
    return false;
  }

  if (FAMILIARITY_ANTI_MARKERS.some((marker) => q.includes(marker))) {
    return false;
  }

  const parsed = parseFamiliarityQuery(query);
  if (!parsed) return false;

  return isPureSubjectFamiliarityQuery(query, parsed);
}

const DOMAIN_TOPIC_RE =
  /\b(?:politique|php|javascript|python|java|typescript|sql|rust|go|ruby|histoire|geographie|economie|droit|philosophie|math|maths|dior|chanel|gucci|hermes|mode)\b/;

const DOMAIN_READINESS_ANGLE_RULES = [
  {
    pattern: /\bpolitique\b/,
    angles: [
      "institutions",
      "partis",
      "élections",
      "réformes",
      "contexte actuel",
    ],
  },
  {
    pattern: /\bphp\b/,
    angles: ["syntaxe", "bonnes pratiques", "frameworks", "débogage"],
  },
  {
    pattern: /\b(?:javascript|typescript|python|java|ruby|rust|go|sql)\b/,
    angles: ["concepts clés", "bonnes pratiques", "outils", "exemples"],
  },
  {
    pattern: /\b(?:dior|chanel|gucci|hermes|louis vuitton)\b/,
    angles: [
      "mode",
      "histoire de la maison",
      "parfums et produits",
      "actualité",
    ],
  },
  {
    pattern: /\b(?:histoire|geographie)\b/,
    angles: ["contexte", "chronologie", "points clés", "questions précises"],
  },
];

/**
 * Sujet identifiable comme domaine / discipline / marque — pas un lieu seul.
 * @param {string} rawSubject
 * @returns {boolean}
 */
export function isDomainTopicSubject(rawSubject = "") {
  const n = normalizeFamiliarityQuery(rawSubject);
  if (!n) return false;
  if (DOMAIN_TOPIC_RE.test(n)) return true;
  if (CONCEPT_INFERENCE_PATTERN.test(n)) return true;
  if (ENTITY_INFERENCE_PATTERN.test(n)) return true;
  return false;
}

/**
 * Requête de disponibilité sur un domaine identifiable (lot #34).
 * @param {string} query
 * @returns {boolean}
 */
export function isFamiliarityDomainOverviewRequest(query = "") {
  const parsed = parseFamiliarityQuery(query);
  if (!parsed || !isPureSubjectFamiliarityQuery(query, parsed)) return false;
  if (parsed.kind === "domain_readiness") return true;
  if (parsed.kind === "recognition" && isDomainTopicSubject(parsed.rawSubject)) {
    return true;
  }
  return false;
}

/**
 * @param {string} rawSubject
 * @param {object} subject
 * @returns {string[]}
 */
function inferDomainReadinessAngles(rawSubject = "", subject = {}) {
  const n = normalizeFamiliarityQuery(rawSubject || subject.label || "");
  for (const rule of DOMAIN_READINESS_ANGLE_RULES) {
    if (rule.pattern.test(n)) return rule.angles;
  }
  const cat = classifySubjectCategory(subject);
  if (cat === SUBJECT_CATEGORIES.TOOL_PLATFORM) {
    return ["aperçu", "bonnes pratiques", "usage concret", "questions précises"];
  }
  if (cat === SUBJECT_CATEGORIES.PLACE_INSTITUTION) {
    return ["géographie", "culture", "institutions", "actualité"];
  }
  if (cat === SUBJECT_CATEGORIES.CONCEPT_METHOD) {
    return ["définitions", "usage", "bonnes pratiques", "exemples"];
  }
  if (cat === SUBJECT_CATEGORIES.PERSON_ENTITY) {
    return ["contexte", "parcours", "actualité", "points clés"];
  }
  return ["aperçu général", "contexte", "points clés", "questions précises"];
}

/**
 * Réponse de disponibilité domaine — confirme la capacité + axes concrets.
 * @param {object} subject
 * @param {{ rawSubject?: string }} parsed
 * @returns {string}
 */
export function buildDomainReadinessReply(subject = {}, parsed = {}) {
  const surface =
    subject.label ||
    formatSubjectSurfaceForm(parsed.rawSubject || "", { label: subject.label });
  const displayLabel =
    surface.charAt(0).toUpperCase() + surface.slice(1);
  const angles = inferDomainReadinessAngles(parsed.rawSubject, subject);
  const anglesText = angles.slice(0, 5).join(", ");
  return `Oui, je peux t'aider sur ${displayLabel} : ${anglesText}. Tu veux un aperçu général ou une question précise ?`;
}

/**
 * Reprise explicite d'un sujet déjà vu dans la session.
 * @param {object} subject
 * @param {{ rawSubject?: string }} parsed
 * @returns {string}
 */
export function buildDomainResumeReply(subject = {}, parsed = {}) {
  const surface =
    subject.label ||
    formatSubjectSurfaceForm(parsed.rawSubject || "", { label: subject.label });
  const displayLabel =
    surface.charAt(0).toUpperCase() + surface.slice(1);
  const angles = inferDomainReadinessAngles(parsed.rawSubject, subject);
  const anglesText = angles.slice(0, 4).join(", ");
  return `Oui. On peut reprendre sur ${displayLabel} : ${anglesText}. Tu veux revenir sur quel angle ?`;
}

/**
 * @param {object} subject
 * @param {{ rawSubject?: string }} parsed
 * @param {{ contextual_resume?: boolean }} [options]
 * @returns {string}
 */
export function buildDomainAvailabilityReply(
  subject = {},
  parsed = {},
  options = {},
) {
  if (options.contextual_resume) {
    return buildDomainResumeReply(subject, parsed);
  }
  return buildDomainReadinessReply(subject, parsed);
}

export function resolveFamiliarityReplyMode(parsed = {}, subject = {}) {
  if (parsed.kind === "domain_readiness") {
    return FAMILIARITY_REPLY_MODES.DOMAIN_READINESS;
  }
  if (
    parsed.kind === "recognition" &&
    isDomainTopicSubject(parsed.rawSubject)
  ) {
    return FAMILIARITY_REPLY_MODES.DOMAIN_READINESS;
  }
  if (parsed.kind === "definition") return "definition";
  if (parsed.kind === "overview")
    return FAMILIARITY_REPLY_MODES.FOLLOWUP_APERCU;
  if (parsed.kind === "help") return "help";
  return FAMILIARITY_REPLY_MODES.SIMPLE_KNOWN_SUBJECT;
}

function pickSimpleFollowUp(subject = {}) {
  const category = classifySubjectCategory(subject);
  if (
    category === SUBJECT_CATEGORIES.TOOL_PLATFORM ||
    category === SUBJECT_CATEGORIES.CONCEPT_METHOD
  ) {
    return SIMPLE_RECOGNITION_FOLLOW_UP_ALT;
  }
  return SIMPLE_RECOGNITION_FOLLOW_UP;
}

/** Reconnaissance brève : « Oui, je connais X. » + ouverture légère optionnelle (max 2 phrases). */
function buildSimpleRecognitionReply(subject) {
  const label = subject.label;
  return `Oui, je connais ${label}.\n${pickSimpleFollowUp(subject)}`;
}

function buildRecognitionReply(subject) {
  return buildSimpleRecognitionReply(subject);
}

function buildDefinitionReply(subject) {
  const category = classifySubjectCategory(subject);
  const definition = subject.definition
    ? `${subject.label} : ${subject.definition}`
    : `${subject.label} est un sujet que je peux t'aider à clarifier.`;

  if (category === SUBJECT_CATEGORIES.TOOL_PLATFORM) {
    return `${definition}\nTu veux un aperçu ou une aide concrète ?`;
  }
  if (category === SUBJECT_CATEGORIES.CONCEPT_METHOD) {
    return `${definition}\nTu veux un aperçu simple ou de l'aide pour l'implémenter ?`;
  }
  if (category === SUBJECT_CATEGORIES.PERSON_ENTITY) {
    return `${definition}\nTu veux un aperçu ou tu as une question précise ?`;
  }
  return `${definition}\nTu veux un aperçu ou tu as une question précise ?`;
}

function buildHelpReply(subject) {
  const label = subject.label;
  const category = classifySubjectCategory(subject);

  if (category === SUBJECT_CATEGORIES.TOOL_PLATFORM) {
    return `Oui, je connais ${label}.\nTu veux un aperçu ou une aide concrète ?`;
  }
  return `Oui, je connais ${label}.\n${pickSimpleFollowUp(subject)}`;
}

export function resolveSubjectFromLabel(label = "") {
  const normalized = normalizeFamiliarityQuery(label);
  if (!normalized) return null;

  const buildFromEntry = (entry) =>
    enrichSubjectResolution(
      {
        known: true,
        label: entry.label,
        category: entry.category,
        placeSubtype: entry.placeSubtype ?? null,
        personSubtype: entry.personSubtype ?? null,
        complement: null,
        definition: entry.definition ?? null,
        helpAngles:
          entry.personSubtype === PERSON_SUBTYPES.CELEBRITY
            ? CELEBRITY_HELP_ANGLES
            : (entry.helpAngles ?? DEFAULT_HELP_ANGLES[entry.category]),
      },
      normalized,
    );

  for (const entry of Object.values(SUBJECT_LEXICON)) {
    if (normalizeFamiliarityQuery(entry.label) === normalized) {
      return buildFromEntry(entry);
    }
  }

  const bare = normalized.replace(/^(le|la|les|l)\s+/, "");
  for (const [key, entry] of Object.entries(SUBJECT_LEXICON)) {
    if (
      key === bare ||
      key === normalized ||
      normalizeFamiliarityQuery(entry.label) === bare
    ) {
      return buildFromEntry(entry);
    }
  }

  return enrichSubjectResolution(
    resolveFamiliaritySubject(normalized),
    normalized,
  );
}

function formatApercuBody(subject = {}) {
  const label = subject.label || "";
  const definition = String(subject.definition || "").trim();
  if (!definition) return null;

  const defBody = definition.replace(/^(un|une|des|le|la|les)\s+/i, "");
  if (/^(l'|la |le |les )/.test(label)) {
    const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
    return `${capitalized}, c'est ${defBody}`;
  }
  return `${label} : ${definition}`;
}

export function buildFamiliarityFollowupApercuReply(subject = {}) {
  if (!subject?.label) return null;
  const body = formatApercuBody(subject);
  if (body) {
    if (subject.resolutionMode === "generic") {
      return `Il me semble que c'est un sujet que je peux aborder.\n${body}\nTu as une question plus précise ?`;
    }
    if (subject.resolutionMode === "inferred") {
      return `Je vois de quoi il s'agit, voici un aperçu.\n${body}\nTu as une question plus précise ?`;
    }
    return `D'accord, voici un aperçu rapide.\n${body}\nTu as une question plus précise ?`;
  }
  return `D'accord, voici un aperçu rapide sur ${subject.label}.\nDis-moi ce que tu veux approfondir et je te réponds précisément.`;
}

/**
 * Corps de réponse familiarité (sans garde intention).
 * @param {object} subject
 * @param {{ kind?: string }} parsed
 */
export function buildFamiliarityBodyForSubject(subject = {}, parsed = {}) {
  if (!subject.label) {
    return "Je peux t'aider, mais précise le sujet : de quoi parles-tu exactement ?";
  }

  const mode = resolveFamiliarityReplyMode(parsed, subject);

  switch (mode) {
    case "definition":
      return buildDefinitionReply(subject);
    case "help":
      return buildHelpReply(subject);
    case FAMILIARITY_REPLY_MODES.FOLLOWUP_APERCU:
      return buildFamiliarityFollowupApercuReply(subject) || buildRecognitionReply(subject);
    case FAMILIARITY_REPLY_MODES.DOMAIN_READINESS:
      return buildDomainReadinessReply(subject, parsed);
    case FAMILIARITY_REPLY_MODES.SIMPLE_KNOWN_SUBJECT:
    default:
      return buildRecognitionReply(subject);
  }
}

export function getFamiliarityDeterministicReply(query = "", options = {}) {
  const parsed = parseFamiliarityQuery(query);
  if (!parsed || !isPureSubjectFamiliarityQuery(query, parsed)) return null;
  if (isIdentityIntent(query) || isIdeationIntent(query)) return null;
  if (
    FAMILIARITY_ANTI_MARKERS.some((m) =>
      normalizeFamiliarityQuery(query).includes(m),
    )
  ) {
    return null;
  }

  const subject = resolveKnownOrUnknownSubject(parsed.rawSubject);

  if (options.lexiconLearning !== false) {
    try {
      observeLexiconLearning({
        query,
        parsed,
        subject,
        sessionId: options.sessionId,
        hasStaticLexiconEntry,
      });
    } catch {
      /* fail-closed : l'observation ne doit jamais casser la réponse */
    }
  }

  return buildFamiliarityBodyForSubject(subject, parsed);
}
