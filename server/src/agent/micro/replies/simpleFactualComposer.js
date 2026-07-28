/**
 * Doctrine de formulation — couloir simple_factual_lookup.
 * Une réponse factuelle simple = une phrase complète, naturelle, sans fragment nu.
 */
import { INSUFFICIENT_SIGNAL_REFUSAL } from "../../config/modeResponseContracts.js";
import { normalizeFamiliarityQuery } from "../../utils/familiarityIntentGuards.js";
import { formatSubjectSurfaceForm } from "../normalization/surfaceFormNormalizer.js";
import {
  extractTemporalTarget,
  isRelativeOrFutureDatetimeQuestion,
  parseRelativeDayOffset,
  TEMPORAL_TARGET_KIND,
} from "../../policies/conversationSubjectExtraction.js";

/** Fiches locales — couche contenu, pas formulation. Motifs terrain récurrents uniquement. */
const LOCAL_SIMPLE_FACTUAL_FICHES = Object.freeze({
  "parc asterix": "Le Parc Astérix se trouve à Plailly, dans l'Oise, au nord de Paris.",
});

const CLARIFICATION_LEAK_RE =
  /\b(objectif en une phrase|il faudrait que tu arrives a preciser|je vois la piste, mais pas encore|precise ce que tu veux|ton objectif principal|precise l angle|précise l angle|geographie, histoire, contexte|géographie, histoire, contexte|je n ai pas pu finaliser|je n'ai pas pu finaliser|reessaie ou precise|réessaie ou précise)\b/i;

export const SIMPLE_FACTUAL_TYPES = Object.freeze({
  LOCATION: "location",
  DATE: "date",
  IDENTITY: "identity",
  DEFINITION: "definition",
  QUANTITY: "quantity",
  GENERAL: "general",
});

const GREETING_PREFIX_RE =
  /^(?:salut|bonjour|hello|coucou|hey|bonsoir)\s+(?:nexxus\s*,?\s*)?/i;

const FRENCH_VERB_RE =
  /\b(est|sont|se trouve|correspond|commence|ont|était|fut|signifie|né|née|nee|compte|vaut|représente|represente|a)\b/i;

const LOCATION_QUERY_RE =
  /\b(ou|où|dans quelle ville|se trouve|situe|situé|situee|localise|localisé)\b/i;

const DATE_QUERY_RE =
  /\b(quelle heure|quel jour|quelle date|quelle est la date|quand|en quelle année|en quelle annee|quelle année|quelle annee)\b/i;

const QUANTITY_QUERY_RE = /\b(combien|quelle quantité|quelle quantite)\b/i;

const DEFINITION_QUERY_RE =
  /\b(qu est[- ]ce qu|c est quoi|que signifie|definition)\b/i;

const IDENTITY_QUERY_RE =
  /\b(qui est|qui es[- ]?tu|comment tu t['']appelles|comment t['']appelles|quel est ton nom)\b/i;

const LOCATION_SUBJECT_PATTERNS = [
  /(?:dans quelle ville|ou)\s+(?:se trouve|est\s+(?:situe|situé|situee))\s+(?:le|la|les|l')?\s*(.+)$/i,
  /(?:dans quelle ville)\s+(?:se trouve\s+)?(?:le|la|les|l')?\s*(.+)$/i,
  /(?:ou)\s+(?:se trouve|est)\s+(?:le|la|les|l')?\s*(.+)$/i,
];

const DEFINITION_SUBJECT_PATTERNS = [
  /(?:qu est[- ]ce qu)\s+(?:un|une|le|la|les|l )?\s*(.+)$/i,
  /(?:c est quoi)\s+(?:un|une|le|la|les|l )?\s*(.+)$/i,
  /(?:que signifie)\s+(?:un|une|le|la|les|l )?\s*(.+)$/i,
];

const IDENTITY_SUBJECT_PATTERNS = [
  /^qui est\s+(?:le|la|les|l')?\s*(.+)$/i,
  /^qui est\s+(.+)$/i,
];

/**
 * @param {string} query
 * @returns {keyof typeof SIMPLE_FACTUAL_TYPES extends string ? string : never}
 */
export function classifySimpleFactualQuestionType(query = "") {
  let q = normalizeFamiliarityQuery(query);
  q = q.replace(GREETING_PREFIX_RE, "").trim();
  if (!q) return SIMPLE_FACTUAL_TYPES.GENERAL;

  if (DATE_QUERY_RE.test(q)) return SIMPLE_FACTUAL_TYPES.DATE;
  if (QUANTITY_QUERY_RE.test(q)) return SIMPLE_FACTUAL_TYPES.QUANTITY;
  if (DEFINITION_QUERY_RE.test(q)) return SIMPLE_FACTUAL_TYPES.DEFINITION;
  if (IDENTITY_QUERY_RE.test(q)) return SIMPLE_FACTUAL_TYPES.IDENTITY;
  if (LOCATION_QUERY_RE.test(q)) return SIMPLE_FACTUAL_TYPES.LOCATION;
  return SIMPLE_FACTUAL_TYPES.GENERAL;
}

/**
 * @param {string} query
 * @param {string} type
 * @returns {string|null}
 */
function extractSimpleFactualSubject(query = "", type = SIMPLE_FACTUAL_TYPES.GENERAL) {
  let q = normalizeFamiliarityQuery(query);
  q = q.replace(GREETING_PREFIX_RE, "").trim();
  if (!q) return null;

  const patterns =
    type === SIMPLE_FACTUAL_TYPES.LOCATION
      ? LOCATION_SUBJECT_PATTERNS
      : type === SIMPLE_FACTUAL_TYPES.DEFINITION
        ? DEFINITION_SUBJECT_PATTERNS
        : type === SIMPLE_FACTUAL_TYPES.IDENTITY
          ? IDENTITY_SUBJECT_PATTERNS
          : [];

  for (const pattern of patterns) {
    const match = q.match(pattern);
    if (match?.[1]) {
      return formatSubjectSurfaceForm(match[1].trim());
    }
  }

  return null;
}

function withDefiniteArticle(label = "") {
  if (/^(Le|La|Les|L'|l')/i.test(label)) return label;
  if (/^[aeiouy]/i.test(label)) return `L'${label}`;
  return `Le ${label}`;
}

function withIndefiniteArticle(label = "") {
  if (/^(Un|Une|Le|La|Les|L'|Ce|Cette)/i.test(label)) return label;
  if (/^[aeiouy]/i.test(label)) return `Un ${label}`;
  return `Un ${label}`;
}

function ensurePeriod(text = "") {
  const trimmed = String(text || "").trim();
  if (!trimmed) return trimmed;
  if (/[.!?]$/.test(trimmed)) {
    return trimmed.replace(/!+$/, ".").replace(/\?+$/, ".");
  }
  return `${trimmed}.`;
}

function stripBareExclamation(text = "") {
  return String(text || "")
    .trim()
    .replace(/^["'«]|["'»]$/g, "")
    .replace(/!+$/g, "")
    .trim();
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isBareFactualFragment(text = "") {
  const cleaned = stripBareExclamation(text);
  if (!cleaned) return false;
  if (isWellFormedSimpleFactualSentence(cleaned)) return false;

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length <= 3) return true;
  if (/!$/.test(String(text || "").trim()) && words.length < 8) return true;
  if (words.length <= 5 && !FRENCH_VERB_RE.test(cleaned)) return true;

  return false;
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isWellFormedSimpleFactualSentence(text = "") {
  const cleaned = ensurePeriod(stripBareExclamation(text));
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length < 6) return false;
  if (!FRENCH_VERB_RE.test(cleaned)) return false;
  return true;
}

/**
 * @param {string} subject
 * @param {string} answer
 * @returns {string}
 */
function renderLocationAnswer(subject, answer) {
  const value = stripBareExclamation(answer);
  const label = subject || "Ce lieu";
  const withArticle = withDefiniteArticle(label);
  if (/se trouve/i.test(value)) {
    return ensurePeriod(value.startsWith(withArticle) ? value : `${withArticle} ${value}`);
  }
  const place = value.replace(/^(à|a)\s+/i, "").trim();
  return ensurePeriod(`${withArticle} se trouve à ${place}`);
}

/**
 * @param {string} subject
 * @param {string} answer
 * @returns {string}
 */
function renderDateAnswer(subject, answer) {
  const value = stripBareExclamation(answer);
  if (FRENCH_VERB_RE.test(value) && value.split(/\s+/).length >= 5) {
    return ensurePeriod(value);
  }
  const label = subject || "L'événement";
  return ensurePeriod(`${label} date de ${value}`);
}

/**
 * @param {string} subject
 * @param {string} answer
 * @returns {string}
 */
function renderIdentityAnswer(subject, answer) {
  const value = stripBareExclamation(answer);
  if (FRENCH_VERB_RE.test(value) && value.split(/\s+/).length >= 5) {
    return ensurePeriod(value);
  }
  const label = subject || value;
  return ensurePeriod(`${label} est ${value}`);
}

/**
 * @param {string} subject
 * @param {string} answer
 * @returns {string}
 */
function renderDefinitionAnswer(subject, answer) {
  const value = stripBareExclamation(answer);
  if (/correspond/i.test(value)) return ensurePeriod(value);
  const label = subject || "élément demandé";
  const withArticle = withIndefiniteArticle(formatSubjectSurfaceForm(label));
  if (/^\d/.test(value)) {
    return ensurePeriod(`${withArticle} correspond à ${value}`);
  }
  return ensurePeriod(`${withArticle} ${/^est\b/i.test(value) ? value : `est ${value}`}`);
}

/**
 * @param {string} subject
 * @param {string} answer
 * @returns {string}
 */
function renderQuantityAnswer(subject, answer) {
  const value = stripBareExclamation(answer);
  if (FRENCH_VERB_RE.test(value) && value.split(/\s+/).length >= 5) {
    return ensurePeriod(value);
  }
  const label = subject || "La quantité";
  return ensurePeriod(`${label} est de ${value}`);
}

/**
 * @param {string} subject
 * @param {string} answer
 * @returns {string}
 */
function renderGeneralAnswer(subject, answer) {
  const value = stripBareExclamation(answer);
  if (isWellFormedSimpleFactualSentence(value)) return ensurePeriod(value);
  if (subject) {
    return ensurePeriod(`${subject} : ${value}`);
  }
  return ensurePeriod(value);
}

/**
 * @param {string} rawText
 * @param {string} query
 * @param {string} [questionType]
 * @returns {string}
 */
export function renderSimpleFactualAnswer(rawText = "", query = "", questionType) {
  const type = questionType || classifySimpleFactualQuestionType(query);
  const subject = extractSimpleFactualSubject(query, type);
  const answer = stripBareExclamation(rawText);

  if (!answer) return answer;
  if (isWellFormedSimpleFactualSentence(answer)) {
    return ensurePeriod(answer);
  }

  switch (type) {
    case SIMPLE_FACTUAL_TYPES.LOCATION:
      return renderLocationAnswer(subject, answer);
    case SIMPLE_FACTUAL_TYPES.DATE:
      return renderDateAnswer(subject, answer);
    case SIMPLE_FACTUAL_TYPES.IDENTITY:
      return renderIdentityAnswer(subject, answer);
    case SIMPLE_FACTUAL_TYPES.DEFINITION:
      return renderDefinitionAnswer(subject, answer);
    case SIMPLE_FACTUAL_TYPES.QUANTITY:
      return renderQuantityAnswer(subject, answer);
    default:
      return renderGeneralAnswer(subject, answer);
  }
}

/**
 * Post-traitement du couloir simple_factual_lookup.
 * @param {string} rawText
 * @param {string} query
 * @returns {string}
 */
export function polishSimpleFactualAnswer(rawText = "", query = "") {
  const text = String(rawText || "").trim();
  if (!text) return text;

  const type = classifySimpleFactualQuestionType(query);
  if (isBareFactualFragment(text) || !isWellFormedSimpleFactualSentence(text)) {
    return renderSimpleFactualAnswer(text, query, type);
  }
  return ensurePeriod(stripBareExclamation(text));
}

const TYPE_TEMPLATE_HINTS = Object.freeze({
  [SIMPLE_FACTUAL_TYPES.LOCATION]:
    "Lieu — ex. « Le Parc Astérix se trouve à Plailly, dans l'Oise. »",
  [SIMPLE_FACTUAL_TYPES.DATE]:
    "Date — ex. « La Révolution française a commencé en 1789. »",
  [SIMPLE_FACTUAL_TYPES.IDENTITY]:
    "Personne — ex. « Victor Hugo est né à Besançon. »",
  [SIMPLE_FACTUAL_TYPES.DEFINITION]:
    "Définition — ex. « Un octet correspond à 8 bits. »",
  [SIMPLE_FACTUAL_TYPES.QUANTITY]:
    "Quantité — ex. « Un kilooctet correspond à 1 024 octets. »",
  [SIMPLE_FACTUAL_TYPES.GENERAL]:
    "Fait simple — une phrase complète, directe, sans fragment isolé.",
});

/**
 * Consigne système pour le mode simpleFactual.
 * @param {string} query
 * @returns {string}
 */
export function buildSimpleFactualSystemAddon(query = "") {
  const type = classifySimpleFactualQuestionType(query);
  const subject = extractSimpleFactualSubject(query, type);

  return [
    "VARIANTE SIMPLE_FACTUAL_LOOKUP — formulation obligatoire :",
    "- Une seule phrase complète, naturelle, assurée (8 à 18 mots environ).",
    "- INTERDIT : mot isolé, valeur seule, exclamation brute (« Orléans ! »).",
    "- INTERDIT : « Selon mes informations », préambule ou seconde phrase.",
    `- Gabarit attendu (${type}) : ${TYPE_TEMPLATE_HINTS[type] || TYPE_TEMPLATE_HINTS.general}`,
    subject ? `- Sujet à nommer explicitement : ${subject}.` : "",
    "- Réponds directement au fait demandé, sans lister ni conseiller.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function resolveLocalSimpleFactualAnswer(query = "") {
  let q = normalizeFamiliarityQuery(query);
  q = q.replace(GREETING_PREFIX_RE, "").trim();
  if (!q) return null;

  for (const [key, answer] of Object.entries(LOCAL_SIMPLE_FACTUAL_FICHES)) {
    if (q.includes(key)) return answer;
  }
  return null;
}

/**
 * Détecte une fuite clarify-first dans une sortie simple factuelle.
 * @param {string} text
 * @returns {boolean}
 */
export function isSimpleFactualClarificationLeak(text = "") {
  const normalized = normalizeFamiliarityQuery(text);
  if (!normalized) return false;
  if (normalized === normalizeFamiliarityQuery(INSUFFICIENT_SIGNAL_REFUSAL)) return true;
  return CLARIFICATION_LEAK_RE.test(normalized);
}

/**
 * Résout une réponse simple factuelle (fiche locale, puis polish).
 * @param {string} rawText
 * @param {string} query
 * @returns {string}
 */
export function finalizeSimpleFactualAnswer(rawText = "", query = "") {
  const local = resolveLocalSimpleFactualAnswer(query);
  const text = String(rawText || "").trim();

  if (local && (!text || isSimpleFactualClarificationLeak(text))) {
    return local;
  }
  if (!text) {
    return local || buildSimpleFactualDirectFallback(query);
  }
  if (isSimpleFactualClarificationLeak(text)) {
    return local || buildSimpleFactualDirectFallback(query);
  }
  return polishSimpleFactualAnswer(text, query);
}

const LETTER_IN_WORD_RE =
  /combien\s+de\s+(?:lettres?\s+)?([a-zàâäéèêëïîôùûüç])\s+(?:dans|y\s+a[- ]t[- ]il(?:\s+dans)?|contient)\s+(.+)/i;

const LETTER_COUNT_WORD_RE =
  /combien\s+de\s+lettres?\s+(?:dans|y\s+a[- ]t[- ]il(?:\s+dans)?|contient)\s+(.+)/i;

const FRENCH_MONTHS = Object.freeze({
  janvier: 0,
  fevrier: 1,
  février: 1,
  mars: 2,
  avril: 3,
  mai: 4,
  juin: 5,
  juillet: 6,
  aout: 7,
  août: 7,
  septembre: 8,
  octobre: 9,
  novembre: 10,
  decembre: 11,
  décembre: 11,
});

const HISTORICAL_DATE_RE =
  /\b(\d{1,2})\s+(janvier|fevrier|février|mars|avril|mai|juin|juillet|aout|août|septembre|octobre|novembre|decembre|décembre)\s+(\d{4})\b/i;

const HISTORICAL_PAST_TENSE_RE =
  /\b(?:était|etait|fut|ete|été|c'etait|c'était|etait il|été le)\b/i;

const WEEKDAY_NAMES_RE =
  /\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/i;

/**
 * Date explicite passée — hors contrat datetime_deterministic (« maintenant »).
 * @param {string} query
 */
export function isHistoricalDateQuestion(query = "") {
  return extractTemporalTarget(query) === TEMPORAL_TARGET_KIND.HISTORICAL;
}

/** @deprecated alias — utiliser isRelativeOrFutureDatetimeQuestion */
export { isRelativeOrFutureDatetimeQuestion };

/**
 * datetime_deterministic a répondu « aujourd'hui » pour une cible non-actuelle.
 * @param {string} text
 * @param {string} query
 */
export function isDatetimeSubjectMismatch(text = "", query = "") {
  const kind = extractTemporalTarget(query);
  if (kind !== TEMPORAL_TARGET_KIND.HISTORICAL && kind !== TEMPORAL_TARGET_KIND.RELATIVE) {
    return false;
  }
  const cleaned = String(text || "").trim();
  if (!cleaned) return false;
  if (/\bnous sommes le\b/i.test(cleaned)) return true;
  return isSimpleFactualDeterministicMiss(cleaned, query);
}

function stripAccents(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Résolutions déterministes — comptages / faits triviaux sans LLM.
 * @param {string} query
 * @returns {string|null}
 */
export function tryResolveDeterministicSimpleFactual(query = "") {
  let q = normalizeFamiliarityQuery(query);
  q = q.replace(GREETING_PREFIX_RE, "").trim().replace(/[?.!]+$/g, "");

  const historical = resolveHistoricalWeekdayAnswer(q);
  if (historical) return historical;

  const relative = resolveRelativeDateAnswer(q);
  if (relative) return relative;

  const letterMatch = q.match(LETTER_IN_WORD_RE);
  if (letterMatch) {
    const letter = stripAccents(letterMatch[1].toLowerCase());
    const rawWord = letterMatch[2].trim().replace(/[?.!,]+$/g, "");
    const word = stripAccents(rawWord.toLowerCase());
    const count = [...word].filter((ch) => ch === letter).length;
    const displayWord = rawWord || "mot";
    const displayLetter = letterMatch[1];

    if (/^brocoli$/i.test(rawWord) && letter === "l") {
      return ensurePeriod(
        `Le mot « brocoli » contient une seule lettre « ${displayLetter} » en orthographe française ; « broccoli » en anglais en contient deux`,
      );
    }

    const label =
      count <= 1
        ? `une seule lettre « ${displayLetter} »`
        : `${count} lettres « ${displayLetter} »`;

    return ensurePeriod(`Le mot « ${displayWord} » contient ${label}`);
  }

  const wordLetterCount = q.match(LETTER_COUNT_WORD_RE);
  if (wordLetterCount) {
    const rawWord = wordLetterCount[1].trim().replace(/[?.!,]+$/g, "");
    const count = stripAccents(rawWord.toLowerCase()).length;
    return ensurePeriod(`Le mot « ${rawWord} » contient ${count} lettres`);
  }

  return null;
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function resolveHistoricalWeekdayAnswer(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!/\bquel jour\b/i.test(q) && !DATE_QUERY_RE.test(q)) return null;

  const match = q.match(HISTORICAL_DATE_RE);
  if (!match) return null;

  const day = Number.parseInt(match[1], 10);
  const monthLabel = match[2];
  const month = FRENCH_MONTHS[monthLabel.toLowerCase()];
  const year = Number.parseInt(match[3], 10);
  if (month === undefined || !Number.isFinite(day) || year < 1000) return null;

  const date = new Date(year, month, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  const weekday = date.toLocaleDateString("fr-FR", { weekday: "long" });
  const displayMonth =
    monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1).toLowerCase();
  return ensurePeriod(`Le ${day} ${displayMonth} ${year} était un ${weekday}`);
}

/**
 * Résolution déterministe date relative (J+N, semaine prochaine, etc.).
 * @param {string} query
 * @param {Date} [referenceDate]
 * @returns {string|null}
 */
export function resolveRelativeDateAnswer(query = "", referenceDate = new Date()) {
  if (!isRelativeOrFutureDatetimeQuestion(query)) return null;

  const offsetDays = parseRelativeDayOffset(query);
  if (offsetDays === null || !Number.isFinite(offsetDays)) return null;

  const target = new Date(referenceDate);
  target.setDate(target.getDate() + offsetDays);

  const formattedDate = target.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const q = normalizeFamiliarityQuery(query);
  if (/\bquel\s+jour\b/i.test(q)) {
    const weekday = target.toLocaleDateString("fr-FR", { weekday: "long" });
    if (offsetDays === 1) {
      return ensurePeriod(`Demain sera un ${weekday}.`);
    }
    if (offsetDays === 2) {
      return ensurePeriod(`Après-demain sera un ${weekday}.`);
    }
    return ensurePeriod(
      `Dans ${offsetDays} jour${offsetDays > 1 ? "s" : ""}, nous serons un ${weekday} (${formattedDate}).`,
    );
  }

  if (offsetDays === 1) {
    return ensurePeriod(`Demain, nous serons le ${formattedDate}.`);
  }
  if (offsetDays === 7 && /\bsemaine\s+prochaine\b/i.test(q)) {
    return ensurePeriod(`La semaine prochaine, nous serons le ${formattedDate}.`);
  }
  return ensurePeriod(
    `Dans ${offsetDays} jour${offsetDays > 1 ? "s" : ""}, nous serons le ${formattedDate}.`,
  );
}

/**
 * Canevas factuel minimal quand le LLM refuse ou vide (P3).
 * @param {string} query
 */
export function buildSimpleFactualDirectFallback(query = "") {
  const deterministic = tryResolveDeterministicSimpleFactual(query);
  if (deterministic) return deterministic;

  const local = resolveLocalSimpleFactualAnswer(query);
  if (local) return local;

  const type = classifySimpleFactualQuestionType(query);
  const subject = extractSimpleFactualSubject(query, type);

  if (type === SIMPLE_FACTUAL_TYPES.QUANTITY && subject) {
    return ensurePeriod(
      `Pour « ${subject} », la réponse attendue est une valeur ou un comptage direct en une phrase — sans angle supplémentaire`,
    );
  }

  const snippet = normalizeFamiliarityQuery(query).slice(0, 80);
  return ensurePeriod(
    snippet
      ? `Pour répondre à « ${snippet} », il faut une donnée factuelle directe en une phrase — pas de reformulation préalable`
      : "Il faut une réponse factuelle directe en une phrase — pas de reformulation préalable",
  );
}

/**
 * @param {string} text
 */
export function isSimpleFactualOverRefusal(text = "") {
  const probe = String(text || "").trim();
  if (!probe) return true;
  return isSimpleFactualClarificationLeak(probe);
}

/**
 * @param {string} text
 * @param {string} query
 */
export function isSimpleFactualDeterministicMiss(text = "", query = "") {
  const expected = tryResolveDeterministicSimpleFactual(query);
  if (!expected) return false;

  const cleaned = String(text || "").trim();
  if (!cleaned) return true;

  const weekday = expected.match(WEEKDAY_NAMES_RE)?.[1];
  if (weekday && !new RegExp(`\\b${weekday}\\b`, "i").test(cleaned)) {
    return true;
  }

  const dateMatch = query.match(HISTORICAL_DATE_RE);
  if (dateMatch) {
    const year = dateMatch[3];
    const monthToken = dateMatch[2].slice(0, 4).toLowerCase();
    if (year && !cleaned.includes(year)) return true;
    if (monthToken && !new RegExp(monthToken, "i").test(cleaned)) return true;
  }

  if (cleaned.length > 350 && expected.length < 140) {
    const anchor = expected
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length >= 5)
      .slice(0, 4);
    const mentionsAnchor = anchor.some((token) =>
      cleaned.toLowerCase().includes(token),
    );
    if (!mentionsAnchor) return true;
  }

  return false;
}

/**
 * Violation P3 complète — refus, recovery, ou réponse factuelle manquante.
 * @param {string} text
 * @param {string} query
 */
export function isSimpleFactualContractViolation(text = "", query = "") {
  return (
    isSimpleFactualOverRefusal(text) ||
    isSimpleFactualDeterministicMiss(text, query)
  );
}

/**
 * Verrou P3 — remplace refus / pseudo-clarification par réponse factuelle directe.
 * @param {string} text
 * @param {string} query
 */
export function enforceSimpleFactualDirectness(text = "", query = "") {
  const cleaned = String(text || "").trim();
  if (!isSimpleFactualContractViolation(cleaned, query)) {
    return cleaned;
  }
  return buildSimpleFactualDirectFallback(query);
}
