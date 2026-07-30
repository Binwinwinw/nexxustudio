/**
 * Subject typing — détecter, qualifier le type d'objet, clarifier sélectivement si ambigu.
 * Extension transverse : familiarité, info-seeking, reprise slot filling.
 */
import { sanitizeQuery } from "../../micro/normalization/querySanitizer.js";
import { SUBJECT_CATEGORIES } from "../../utils/familiarityIntentGuards.js";
import { parseFamiliarityQuery, isFamiliarityDomainOverviewRequest } from "../../utils/familiarityIntentGuards.js";
import { isSubjectReferenceAvailabilityRequest } from "../../micro/continuity/sessionSubjectReferenceGuards.js";
import { extractInformationSeekingTarget } from "../../utils/informationSeekingIntentGuards.js";
import { resolveSubject } from "../../micro/subject/subjectGraph.js";

export const SUBJECT_TYPING_RULE = "subject_typing_policy_v1";

export const SUBJECT_OBJECT_TYPES = Object.freeze({
  VEHICLE: "vehicle",
  ANIMAL: "animal",
  BRAND: "brand",
  CRYPTO_ASSET: "crypto_asset",
  FASHION_HOUSE: "fashion_house",
  LANDMARK: "landmark",
  PLACE: "place",
  PERSON: "person",
  VIDEO_GAME: "video_game",
  TOOL: "tool",
  CONCEPT: "concept",
  IDE: "ide",
  ASTRONOMY: "astronomy",
  INTERNAL: "internal_codename",
  UNKNOWN: "unknown",
});

/** Map type d'objet → catégorie familiarité existante */
export const OBJECT_TYPE_TO_SUBJECT_CATEGORY = Object.freeze({
  [SUBJECT_OBJECT_TYPES.VEHICLE]: SUBJECT_CATEGORIES.PERSON_ENTITY,
  [SUBJECT_OBJECT_TYPES.ANIMAL]: SUBJECT_CATEGORIES.UNKNOWN,
  [SUBJECT_OBJECT_TYPES.BRAND]: SUBJECT_CATEGORIES.PERSON_ENTITY,
  [SUBJECT_OBJECT_TYPES.CRYPTO_ASSET]: SUBJECT_CATEGORIES.CONCEPT_METHOD,
  [SUBJECT_OBJECT_TYPES.FASHION_HOUSE]: SUBJECT_CATEGORIES.PERSON_ENTITY,
  [SUBJECT_OBJECT_TYPES.LANDMARK]: SUBJECT_CATEGORIES.PLACE_INSTITUTION,
  [SUBJECT_OBJECT_TYPES.PLACE]: SUBJECT_CATEGORIES.PLACE_INSTITUTION,
  [SUBJECT_OBJECT_TYPES.PERSON]: SUBJECT_CATEGORIES.PERSON_ENTITY,
  [SUBJECT_OBJECT_TYPES.VIDEO_GAME]: SUBJECT_CATEGORIES.TOOL_PLATFORM,
  [SUBJECT_OBJECT_TYPES.TOOL]: SUBJECT_CATEGORIES.TOOL_PLATFORM,
  [SUBJECT_OBJECT_TYPES.CONCEPT]: SUBJECT_CATEGORIES.CONCEPT_METHOD,
  [SUBJECT_OBJECT_TYPES.IDE]: SUBJECT_CATEGORIES.TOOL_PLATFORM,
  [SUBJECT_OBJECT_TYPES.ASTRONOMY]: SUBJECT_CATEGORIES.CONCEPT_METHOD,
  [SUBJECT_OBJECT_TYPES.INTERNAL]: SUBJECT_CATEGORIES.TOOL_PLATFORM,
});

const TYPE_LABELS_FR = Object.freeze({
  vehicle: "voiture / marque automobile",
  animal: "animal",
  brand: "marque",
  crypto_asset: "crypto / blockchain",
  fashion_house: "maison de mode",
  landmark: "monument",
  place: "lieu",
  person: "personne",
  video_game: "jeu vidéo",
  tool: "outil / logiciel",
  concept: "concept",
  ide: "IDE de développement",
  astronomy: "phénomène astronomique",
  internal_codename: "projet ou module interne",
});

/**
 * Lexique d'ambiguïté de type — sujets propres à sens multiples.
 * @type {Record<string, { label: string, candidates: string[], clarifyLabels?: Record<string,string> }>}
 */
const AMBIGUOUS_SUBJECT_TYPING_LEXICON = {
  jaguar: {
    label: "Jaguar",
    candidates: ["vehicle", "animal", "brand"],
    clarifyLabels: {
      vehicle: "la marque automobile Jaguar",
      animal: "le félin jaguar",
      brand: "la marque Jaguar (autre produit / groupe)",
    },
  },
  solana: {
    label: "Solana",
    candidates: ["crypto_asset", "place"],
    clarifyLabels: {
      crypto_asset: "la blockchain / crypto Solana",
      place: "un lieu nommé Solana",
    },
  },
  dior: {
    label: "Dior",
    candidates: ["fashion_house", "brand", "person"],
    clarifyLabels: {
      fashion_house: "la maison de mode Dior",
      brand: "la marque Dior (parfums, produits…)",
      person: "Christian Dior (créateur)",
    },
  },
  java: {
    label: "Java",
    candidates: ["tool", "place", "concept"],
    clarifyLabels: {
      tool: "le langage de programmation Java",
      place: "l'île de Java (Indonésie)",
      concept: "autre sens de « Java »",
    },
  },
};

const SUBJECT_TYPE_SLOT_PATTERNS = [
  { slot: "vehicle", re: /\b(?:voiture|automobile|marque\s+auto|vehicule|véhicule|auto)\b/i },
  { slot: "animal", re: /\b(?:animal|felin|félin|chat|faune)\b/i },
  { slot: "brand", re: /\b(?:marque|enseigne|groupe)\b/i },
  { slot: "crypto_asset", re: /\b(?:crypto|blockchain|token|sol|coin)\b/i },
  { slot: "place", re: /\b(?:lieu|ville|region|région|endroit|ile|île)\b/i },
  { slot: "fashion_house", re: /\b(?:maison\s+de\s+mode|couture|mode|haute\s+couture)\b/i },
  { slot: "person", re: /\b(?:personne|createur|créateur|designer|homme|fondateur)\b/i },
  { slot: "tool", re: /\b(?:langage|programmation|logiciel|outil|ide)\b/i },
  { slot: "concept", re: /\b(?:concept|autre\s+sens)\b/i },
  { slot: "ide", re: /\b(?:ide|eclipse\s+ide|developpement\s+java)\b/i },
  { slot: "astronomy", re: /\b(?:eclipse\s+solaire|eclipse\s+lunaire|astronom|lune|soleil)\b/i },
  { slot: "internal_codename", re: /\b(?:projet\s+interne|module\s+interne|codename|forge|citadelle)\b/i },
  { slot: "video_game", re: /\b(?:jeu|jeu\s+video|jeu\s+vidéo|gaming)\b/i },
];

const SUBJECT_TYPE_PENDING_PATTERNS = Object.entries(
  AMBIGUOUS_SUBJECT_TYPING_LEXICON,
).map(([key, entry]) => ({
  clarificationType: "subject_type",
  topic: key,
  label: entry.label,
  test: (content) =>
    new RegExp(
      `Tu parles de \\*\\*${entry.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\*\\* en tant que`,
      "i",
    ).test(content),
}));

export function normalizeSubjectValue(value = "") {
  return sanitizeQuery(String(value || ""))
    .replace(/^(?:le|la|les|l|du|de|d|sur|concernant)\s+/, "")
    .replace(/^(?:jeu|jeux|app|application)\s+/, "")
    .trim();
}

export function mapObjectTypeToSubjectCategory(objectType = "") {
  return (
    OBJECT_TYPE_TO_SUBJECT_CATEGORY[objectType] || SUBJECT_CATEGORIES.UNKNOWN
  );
}

/**
 * Extension de classifySubjectCategory — applique objectType si présent.
 * @param {object} subject
 */
export function classifySubjectCategoryExtended(subject = {}) {
  if (subject.category) return subject.category;
  if (subject.objectType) {
    return mapObjectTypeToSubjectCategory(subject.objectType);
  }
  if (subject.subject_type) {
    return mapObjectTypeToSubjectCategory(subject.subject_type);
  }
  return SUBJECT_CATEGORIES.UNKNOWN;
}

/**
 * @param {string} subjectValue
 */
export function resolveSubjectTyping(subjectValue = "") {
  const normalized = normalizeSubjectValue(subjectValue);
  const bare = normalized.replace(/^(le|la|les|l)\s+/, "");

  const lexEntry = AMBIGUOUS_SUBJECT_TYPING_LEXICON[bare] ||
    AMBIGUOUS_SUBJECT_TYPING_LEXICON[normalized];

  if (lexEntry && lexEntry.candidates.length > 1) {
    return {
      subject_value: lexEntry.label,
      subject_key: bare || normalized,
      subject_type_candidates: [...lexEntry.candidates],
      requires_subject_disambiguation: true,
      resolved_type: null,
      source: "typing_lexicon",
      clarifyLabels: lexEntry.clarifyLabels || {},
    };
  }

  const graphHit = resolveSubject(bare || normalized, {
    domain: "public",
    preferSessionProject: false,
  });

  if (graphHit.ambiguous && graphHit.entity?.alternateSenses?.length > 1) {
    const candidates = graphHit.entity.alternateSenses.map((s) => s.kind);
    return {
      subject_value: graphHit.entity.label,
      subject_key: graphHit.entity.canonical || bare,
      subject_type_candidates: candidates,
      requires_subject_disambiguation: true,
      resolved_type: null,
      source: "subject_graph",
      alternateSenses: graphHit.entity.alternateSenses,
      clarifyLabels: Object.fromEntries(
        graphHit.entity.alternateSenses.map((s) => [
          s.kind,
          TYPE_LABELS_FR[s.kind] || s.kind,
        ]),
      ),
    };
  }

  if (lexEntry?.candidates?.length === 1) {
    return {
      subject_value: lexEntry.label,
      subject_key: bare || normalized,
      subject_type_candidates: [...lexEntry.candidates],
      requires_subject_disambiguation: false,
      resolved_type: lexEntry.candidates[0],
      source: "typing_lexicon",
    };
  }

  return {
    subject_value: subjectValue.trim() || bare || normalized,
    subject_key: bare || normalized,
    subject_type_candidates: [],
    requires_subject_disambiguation: false,
    resolved_type: null,
    source: "none",
  };
}

/**
 * Extrait la cible depuis familiarité ou info-seeking.
 * @param {string} query
 */
export function extractSubjectValueFromQuery(query = "") {
  const infoTarget = extractInformationSeekingTarget(query);
  if (infoTarget) return infoTarget;

  const parsed = parseFamiliarityQuery(query);
  if (parsed?.rawSubject) return parsed.rawSubject;

  return null;
}

/**
 * @param {string} query
 */
export function resolveSubjectTypingFromQuery(query = "") {
  const value = extractSubjectValueFromQuery(query);
  if (!value) return null;
  return resolveSubjectTyping(value);
}

/**
 * @param {ReturnType<typeof resolveSubjectTyping>} typing
 */
export function buildSubjectTypeClarifyReply(typing) {
  if (!typing?.requires_subject_disambiguation) return null;

  const label = typing.subject_value || "ce sujet";
  const options = typing.subject_type_candidates
    .map((type) => {
      const custom = typing.clarifyLabels?.[type];
      return custom || TYPE_LABELS_FR[type] || type;
    })
    .filter(Boolean);

  if (options.length < 2) return null;

  const list =
    options.length === 2
      ? `${options[0]} ou ${options[1]}`
      : `${options.slice(0, -1).join(", ")} ou ${options[options.length - 1]}`;

  return (
    `Tu parles de **${label}** en tant que ${list} ?\n` +
    "Précise le type visé et je réponds sur la bonne piste."
  );
}

/**
 * @param {string} assistantContent
 */
export function extractSubjectTypePendingState(assistantContent = "") {
  const content = String(assistantContent || "").trim();
  if (!content) return null;

  for (const pattern of SUBJECT_TYPE_PENDING_PATTERNS) {
    if (pattern.test(content)) {
      return {
        clarificationActive: true,
        clarificationType: pattern.clarificationType,
        topic: pattern.topic,
        label: pattern.label,
        candidateSlots: AMBIGUOUS_SUBJECT_TYPING_LEXICON[pattern.topic]?.candidates ||
          [],
      };
    }
  }

  const graphMatch = content.match(
    /Tu parles de \*\*([^*]+)\*\* en tant que .+\?/i,
  );
  if (graphMatch) {
    const label = graphMatch[1].trim();
    const typing = resolveSubjectTyping(label);
    if (typing.requires_subject_disambiguation) {
      return {
        clarificationActive: true,
        clarificationType: "subject_type",
        topic: typing.subject_key,
        label: typing.subject_value,
        candidateSlots: typing.subject_type_candidates,
      };
    }
  }

  return null;
}

/**
 * @param {string} query
 * @param {{ topic?: string, candidateSlots?: string[] }} pending
 */
export function matchSubjectTypeSlot(query = "", pending = {}) {
  const normalized = sanitizeQuery(query);
  if (!normalized || normalized.length < 2) return null;

  const allowed = new Set(pending.candidateSlots || []);
  for (const { slot, re } of SUBJECT_TYPE_SLOT_PATTERNS) {
    if (allowed.size > 0 && !allowed.has(slot)) continue;
    if (re.test(normalized)) return slot;
  }

  if (allowed.has("vehicle") && /\bjaguar\b/i.test(normalized) && /\b(?:auto|voiture)\b/i.test(normalized)) {
    return "vehicle";
  }

  return null;
}

/**
 * @param {string} topic
 * @param {string} slot
 */
export function buildSubjectTypedEnrichedQuery(topic = "", slot = "") {
  const typing = resolveSubjectTyping(topic);
  const label = typing.subject_value || topic;
  const clarify = typing.clarifyLabels?.[slot];
  if (clarify) return `que sais-tu de ${clarify}`;
  const typeLabel = TYPE_LABELS_FR[slot] || slot;
  return `que sais-tu de ${label} (${typeLabel})`;
}

/**
 * @param {string} topic
 * @param {string} slot
 */
export function buildSubjectTypedResumeReply(topic = "", slot = "") {
  const typing = resolveSubjectTyping(topic);
  const label = typing.subject_value || topic;
  const typeLabel = typing.clarifyLabels?.[slot] || TYPE_LABELS_FR[slot] || slot;

  if (slot === "vehicle" && typing.subject_key === "jaguar") {
    return (
      `D'accord — **Jaguar** côté automobile : marque britannique de voitures de luxe et sportives, ` +
      `filiale de Tata Motors.\nTu veux un aperçu historique, les modèles récents, ou une comparaison ?`
    );
  }
  if (slot === "animal" && typing.subject_key === "jaguar") {
    return (
      `D'accord — le **jaguar** (félin) : grand prédateur des Amériques, solitaire, excellent nageur.\n` +
      "Tu veux habitat, comportement, ou statut de conservation ?"
    );
  }
  if (slot === "crypto_asset" && typing.subject_key === "solana") {
    return (
      `D'accord — **Solana** (crypto) : blockchain haute performance, token SOL, écosystème DeFi/NFT.\n` +
      "Tu veux un aperçu technique, l'écosystème, ou une comparaison avec d'autres chaînes ?"
    );
  }
  if (slot === "fashion_house" && typing.subject_key === "dior") {
    return (
      `D'accord — **Dior** (maison de mode) : griffe française de luxe (LVMH), haute couture et prêt-à-porter.\n` +
      "Tu veux l'histoire de la maison, les lignes produits, ou l'actualité ?"
    );
  }

  return (
    `D'accord — **${label}** en tant que ${typeLabel}.\n` +
    "Dis-moi ce que tu veux approfondir et je réponds précisément."
  );
}

/**
 * @param {string} query
 */
export function resolveSubjectTypeClarifyShortCircuit(query = "") {
  if (isFamiliarityDomainOverviewRequest(query)) return null;
  if (isSubjectReferenceAvailabilityRequest(query)) return null;
  const typing = resolveSubjectTypingFromQuery(query);
  if (!typing?.requires_subject_disambiguation) return null;
  const reply = buildSubjectTypeClarifyReply(typing);
  if (!reply) return null;
  return { typing, reply };
}

/**
 * @param {string} query
 * @param {{ topic?: string, candidateSlots?: string[] }} pending
 */
export function resumeSubjectTypeClarification(query = "", pending = {}) {
  const slot = matchSubjectTypeSlot(query, pending);
  if (!slot) return null;

  return {
    reply: buildSubjectTypedResumeReply(pending.topic || pending.label, slot),
    resumePath: "subject_type_resolved",
    enrichedQuery: buildSubjectTypedEnrichedQuery(pending.topic || pending.label, slot),
    slotFilled: slot,
    subjectType: slot,
    objectType: slot,
    skipClarificationGate: true,
  };
}
