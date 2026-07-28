/**
 * Extraction transversale de sujet — vérité unique pour P2 (routage) et P3 (subject_mismatch).
 * Spec : docs/agents/conversation-move-governance.md (G17–G19)
 */
import { normalizeFamiliarityQuery } from "../utils/familiarityIntentGuards.js";
import {
  extractInformationSeekingTarget,
  isInformationSeekingWithTarget,
} from "../utils/informationSeekingIntentGuards.js";
import {
  extractGeneralKnowledgeSubject,
  isGeneralKnowledgeRequest,
} from "../utils/generalKnowledgeIntentGuards.js";

export const TEMPORAL_TARGET_KIND = Object.freeze({
  HISTORICAL: "historical",
  RELATIVE: "relative",
  NOW: "now",
  NONE: "none",
});

const HISTORICAL_DATE_RE =
  /\b(\d{1,2})\s+(janvier|fevrier|février|mars|avril|mai|juin|juillet|aout|août|septembre|octobre|novembre|decembre|décembre)\s+(\d{4})\b/i;

const HISTORICAL_PAST_TENSE_RE =
  /\b(?:était|etait|fut|ete|été|c'etait|c'était|etait il|été le)\b/i;

const RELATIVE_DATETIME_RE =
  /\b(?:dans\s+\d+\s+(?:jours?|semaines?|mois|heures?|minutes?)|dans\s+une\s+semaine|dans\s+un\s+mois|semaine\s+prochaine|mois\s+prochain|demain|apr[eè]s[- ]?demain|apr[eè]s\s+demain|la\s+semaine\s+prochaine|le\s+mois\s+prochain|quel\s+jour\s+sera|quelle\s+date\s+sera|sera\s+dans)\b/i;

const EXTERNAL_CALENDAR_EVENT_RE =
  /\b(?:pleine\s+lune|nouvelle\s+lune|derni[eè]re\s+lune|lune\s+bleue|phase\s+(?:de\s+la\s+)?lune|calendrier\s+lunaire|[eé]clipse\s+(?:lunaire|solaire)?|solstice|[eé]quinoxe)\b/i;

const LOCAL_NOW_DATE_RE =
  /\b(?:quelle\s+date|quel\s+est\s+la\s+date|quelle\s+est\s+la\s+date|date\s+du\s+jour|date\s+sommes[- ]?nous|jour\s+sommes[- ]?nous|nous\s+sommes\s+quel\s+jour|on\s+est\s+quel\s+jour|aujourd['']?hui\s+on\s+est|quel\s+jour\s+sommes)\b/i;

const SECONDARY_ACTION_RE =
  /\b(trouver|choisir|comparer|acheter|creer|créer|corriger|recommand|conseill|decider|décider|evaluer|évaluer|analyser|optimiser)\b/i;

const SUBJECT_STOPWORDS = new Set([
  "avec",
  "pour",
  "dans",
  "sans",
  "vers",
  "chez",
  "entre",
  "sous",
  "une",
  "des",
  "les",
  "sur",
  "jeu",
  "jeux",
  "app",
  "application",
  "logiciel",
  "monument",
  "pays",
  "ville",
]);

/** Seuils fuzzy lexical (G20 Palier 1) — instrumentés en shadow. */
export const ANCHOR_ALIGNMENT_THRESHOLDS = Object.freeze({
  STRONG: 0.92,
  WEAK: 0.8,
});

export const ANCHOR_ALIGNMENT_TIER = Object.freeze({
  STRONG: "anchor_strong",
  WEAK: "anchor_weak",
  MISS: "anchor_miss",
});

function normalizeQuery(query = "") {
  return normalizeFamiliarityQuery(query);
}

function stripAccents(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeSurfaceText(text = "") {
  return stripAccents(String(text || "").toLowerCase())
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactAlphaNumeric(text = "") {
  return stripAccents(String(text || "").toLowerCase()).replace(/[^a-z0-9]/g, "");
}

/**
 * Similarité Levenshtein bornée [0, 1].
 * @param {string} a
 * @param {string} b
 */
export function fuzzyTokenSimilarity(a = "", b = "") {
  const left = compactAlphaNumeric(a);
  const right = compactAlphaNumeric(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.length < 3 || right.length < 3) return 0;

  const maxLen = Math.max(left.length, right.length);
  const distance = levenshteinDistance(left, right);
  return Number((1 - distance / maxLen).toFixed(4));
}

function levenshteinDistance(a = "", b = "") {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[rows - 1][cols - 1];
}

function resolveAnchorTier(score = 0, signals = []) {
  if (
    score >= ANCHOR_ALIGNMENT_THRESHOLDS.STRONG ||
    signals.includes("exact") ||
    signals.includes("compact")
  ) {
    return ANCHOR_ALIGNMENT_TIER.STRONG;
  }
  if (score >= ANCHOR_ALIGNMENT_THRESHOLDS.WEAK) {
    return ANCHOR_ALIGNMENT_TIER.WEAK;
  }
  return ANCHOR_ALIGNMENT_TIER.MISS;
}

/**
 * Score d'alignement surface ↔ sujet (G20 Palier 1).
 * @param {string} text
 * @param {string} subject
 * @returns {{
 *   score: number,
 *   tier: string,
 *   signals: string[],
 *   anchor_tokens: string[],
 * }}
 */
export function scoreSubjectSurfaceAlignment(text = "", subject = "") {
  const body = normalizeSurfaceText(text);
  const subjectNorm = normalizeSurfaceText(subject);
  const signals = [];
  let score = 0;

  if (!body || !subjectNorm) {
    return {
      score: 0,
      tier: ANCHOR_ALIGNMENT_TIER.MISS,
      signals: ["empty"],
      anchor_tokens: [],
    };
  }

  const anchorTokens = extractSubjectAnchorTokens(subject);
  const bodyWords = body.split(/\s+/).filter((word) => word.length >= 3);
  const subjectCompact = compactAlphaNumeric(subject);
  const bodyCompact = compactAlphaNumeric(body);

  if (subjectCompact.length >= 4 && bodyCompact.includes(subjectCompact)) {
    signals.push("compact");
    score = 1;
  }

  for (const token of anchorTokens) {
    if (body.includes(token)) {
      signals.push("exact");
      score = Math.max(score, 1);
      continue;
    }

    if (bodyCompact.includes(token)) {
      signals.push("compact");
      score = Math.max(score, 0.98);
      continue;
    }

    for (const word of bodyWords) {
      const similarity = fuzzyTokenSimilarity(token, word);
      if (similarity >= ANCHOR_ALIGNMENT_THRESHOLDS.STRONG) {
        signals.push("fuzzy_strong");
        score = Math.max(score, similarity);
      } else if (similarity >= ANCHOR_ALIGNMENT_THRESHOLDS.WEAK) {
        signals.push("fuzzy_weak");
        score = Math.max(score, similarity);
      }
    }
  }

  if (anchorTokens.length === 0 && subjectCompact.length >= 4) {
    for (const word of bodyWords) {
      const similarity = fuzzyTokenSimilarity(subjectCompact, word);
      if (similarity >= ANCHOR_ALIGNMENT_THRESHOLDS.WEAK) {
        signals.push("fuzzy_weak");
        score = Math.max(score, similarity);
      }
    }
  }

  if (
    subjectCompact.length >= 4 &&
    score < ANCHOR_ALIGNMENT_THRESHOLDS.WEAK &&
    bodyCompact.length >= subjectCompact.length
  ) {
    const windowSize = subjectCompact.length;
    let best = 0;
    for (let i = 0; i <= bodyCompact.length - windowSize; i += 1) {
      const chunk = bodyCompact.slice(i, i + windowSize);
      best = Math.max(best, fuzzyTokenSimilarity(subjectCompact, chunk));
    }
    if (best >= ANCHOR_ALIGNMENT_THRESHOLDS.STRONG) {
      signals.push("fuzzy_strong");
      score = Math.max(score, best);
    } else if (best >= ANCHOR_ALIGNMENT_THRESHOLDS.WEAK) {
      signals.push("fuzzy_weak");
      score = Math.max(score, best);
    }
  }

  const uniqueSignals = [...new Set(signals)];
  return {
    score: Number(score.toFixed(4)),
    tier: resolveAnchorTier(score, uniqueSignals),
    signals: uniqueSignals,
    anchor_tokens: anchorTokens,
  };
}

/**
 * Entité / topic principal de la requête.
 * @param {string} query
 * @returns {string|null}
 */
export function extractConversationSubject(query = "") {
  if (isInformationSeekingWithTarget(query)) {
    return extractInformationSeekingTarget(query);
  }
  if (isGeneralKnowledgeRequest(query)) {
    return extractGeneralKnowledgeSubject(query);
  }
  return null;
}

/**
 * Date explicite passée — hors contrat datetime_deterministic (« maintenant »).
 * @param {string} query
 * @returns {boolean}
 */
export function isHistoricalTemporalTarget(query = "") {
  const q = normalizeQuery(query);
  if (!HISTORICAL_DATE_RE.test(q)) return false;
  if (HISTORICAL_PAST_TENSE_RE.test(q)) return true;
  const match = q.match(HISTORICAL_DATE_RE);
  if (!match) return false;
  const year = Number.parseInt(match[3], 10);
  return Number.isFinite(year) && year < new Date().getFullYear();
}

/**
 * Temps relatif ou futur — hors contrat « maintenant ».
 * @param {string} query
 * @returns {boolean}
 */
export function isRelativeOrFutureDatetimeQuestion(query = "") {
  const q = normalizeQuery(query);
  if (!q) return false;
  if (EXTERNAL_CALENDAR_EVENT_RE.test(q)) return false;
  if (isHistoricalTemporalTarget(q)) return false;
  return RELATIVE_DATETIME_RE.test(q);
}

/**
 * Cible temporelle typée.
 * @param {string} query
 * @returns {"historical"|"relative"|"now"|"none"}
 */
export function extractTemporalTarget(query = "") {
  const q = normalizeQuery(query);
  if (!q) return TEMPORAL_TARGET_KIND.NONE;
  if (isHistoricalTemporalTarget(q)) return TEMPORAL_TARGET_KIND.HISTORICAL;
  if (isRelativeOrFutureDatetimeQuestion(q)) return TEMPORAL_TARGET_KIND.RELATIVE;
  if (LOCAL_NOW_DATE_RE.test(q)) return TEMPORAL_TARGET_KIND.NOW;
  return TEMPORAL_TARGET_KIND.NONE;
}

/**
 * Verbe d'action secondaire (politesse « trouver », etc.) — pas le but principal.
 * @param {string} query
 * @returns {boolean}
 */
export function hasSecondaryActionVerb(query = "") {
  return SECONDARY_ACTION_RE.test(normalizeQuery(query));
}

/**
 * Tokens significatifs d'un sujet pour ancrage surface.
 * @param {string} subject
 * @returns {string[]}
 */
export function extractSubjectAnchorTokens(subject = "") {
  const probe = stripAccents(String(subject || "").toLowerCase());
  return probe
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9]/g, ""))
    .filter((token) => token.length >= 4 && !SUBJECT_STOPWORDS.has(token));
}

/**
 * La surface mentionne-t-elle le sujet (token, compact ou fuzzy ≥ weak) ?
 * @param {string} text
 * @param {string} subject
 * @returns {boolean}
 */
export function surfaceMentionsSubject(text = "", subject = "") {
  const alignment = scoreSubjectSurfaceAlignment(text, subject);
  return alignment.tier !== ANCHOR_ALIGNMENT_TIER.MISS;
}

/**
 * @param {string} query
 * @returns {{ day: number, month: number, year: number }|null}
 */
export function parseHistoricalDateFromQuery(query = "") {
  const q = normalizeQuery(query);
  const match = q.match(HISTORICAL_DATE_RE);
  if (!match) return null;
  const monthMap = {
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
  };
  const day = Number.parseInt(match[1], 10);
  const month = monthMap[match[2].toLowerCase()];
  const year = Number.parseInt(match[3], 10);
  if (month === undefined || !Number.isFinite(day) || year < 1000) return null;
  return { day, month, year };
}

/**
 * Offset relatif en jours (approximation semaine = 7, mois = 30).
 * @param {string} query
 * @returns {number|null}
 */
export function parseRelativeDayOffset(query = "") {
  const q = normalizeQuery(query);
  if (!q) return null;

  const daysMatch = q.match(/\bdans\s+(\d+)\s+jours?\b/i);
  if (daysMatch) return Number.parseInt(daysMatch[1], 10);

  const weeksMatch = q.match(/\bdans\s+(\d+)\s+semaines?\b/i);
  if (weeksMatch) return Number.parseInt(weeksMatch[1], 10) * 7;

  if (/\bdans\s+une\s+semaine\b/i.test(q) || /\bsemaine\s+prochaine\b/i.test(q)) {
    return 7;
  }

  const monthsMatch = q.match(/\bdans\s+(\d+)\s+mois\b/i);
  if (monthsMatch) return Number.parseInt(monthsMatch[1], 10) * 30;

  if (/\bmois\s+prochain\b/i.test(q) || /\bdans\s+un\s+mois\b/i.test(q)) {
    return 30;
  }

  if (/\bapr[eè]s[- ]?demain\b/i.test(q)) return 2;
  if (/\bdemain\b/i.test(q)) return 1;

  return null;
}
