/**
 * Extraction générique d'entités saillantes citées par l'assistant (tour n−1).
 * Pas de lexique métier : heuristiques structurelles (gras, introducteurs, énumérations).
 */
import { normalizeFamiliarityQuery } from "../../utils/familiarityIntentGuards.js";

const INTRODUCER_PATTERN =
  /\b(?:par exemple|comme|notamment|je te conseille|tu peux essayer|tu peux regarder|une option serait|voici|pense a|pense à)\s+(?:la |le |l'|les |un |une |des )?/gi;

const QUALIFIER_AFTER_COMMA =
  /^(classique|traditionnel|emblématique|incontournable|romaine?|italienne?|espagnol|connue?|célèbre|populaire|iconique|à |en |pour )/i;

const STOP_SPANS = new Set([
  "oui",
  "oui oui",
  "par exemple",
  "notamment",
  "barcelone",
  "grenade",
  "madrid",
  "rome",
  "paris",
  "espagne",
  "italie",
  "france",
  "catalogne",
]);

function normalizeSpan(span = "") {
  return normalizeFamiliarityQuery(span)
    .replace(/\s+/g, " ")
    .trim();
}

function stripLeadingArticle(span = "") {
  return String(span || "")
    .replace(/^(?:la |le |les |l'|un |une |des |du |de la |de l')\s*/i, "")
    .trim();
}

/**
 * Coupe une énumération « A ou B » sans fragmenter les virgules qualificatives.
 * @param {string} chunk
 * @returns {string[]}
 */
export function splitSalientEnumeration(chunk = "") {
  const raw = String(chunk || "").trim();
  if (!raw) return [];

  const parts = raw
    .split(/\s+ou\s+/i)
    .map((part) => cleanSalientSpan(part))
    .filter(Boolean);

  return parts.length > 0 ? parts : [cleanSalientSpan(raw)].filter(Boolean);
}

/**
 * @param {string} span
 * @returns {string|null}
 */
export function cleanSalientSpan(span = "") {
  let text = String(span || "").trim();
  if (!text) return null;

  const commaIdx = text.indexOf(",");
  if (commaIdx > 0) {
    const after = text.slice(commaIdx + 1).trim();
    if (QUALIFIER_AFTER_COMMA.test(after)) {
      text = text.slice(0, commaIdx).trim();
    }
  }

  text = stripLeadingArticle(text);
  text = text.replace(
    /\s+(?:a|en|dans|pour|sur)\s+[a-z0-9' -]{2,}$/i,
    "",
  );
  const normalized = normalizeSpan(text);
  if (!normalized || normalized.length < 2 || normalized.length > 90) return null;
  if (STOP_SPANS.has(normalized)) return null;
  return normalized;
}

/**
 * @param {string} text
 * @returns {string[]}
 */
export function extractSalientSpansFromAssistantText(text = "") {
  const source = String(text || "").trim();
  if (!source) return [];

  const found = new Map();

  const add = (raw) => {
    const cleaned = cleanSalientSpan(raw);
    if (!cleaned) return;
    const key = cleaned.toLowerCase();
    if (!found.has(key)) {
      found.set(key, cleaned);
    }
  };

  for (const match of source.matchAll(/\*\*([^*]+)\*\*/g)) {
    add(match[1]);
  }

  let introducerMatch;
  const introRegex = new RegExp(INTRODUCER_PATTERN.source, "gi");
  while ((introducerMatch = introRegex.exec(source)) !== null) {
    const tail = source.slice(introducerMatch.index + introducerMatch[0].length);
    const chunk = tail.split(/[.\n!?]/)[0] || "";
    for (const part of splitSalientEnumeration(chunk)) {
      add(part);
    }
  }

  if (/\bou\b/i.test(source)) {
    const listish = source.match(
      /(?:conseille|essayer|regarder|choisir|opter pour|entre)\s+(.+?)(?:[.!?]|$)/i,
    );
    if (listish?.[1]) {
      for (const part of splitSalientEnumeration(listish[1])) {
        add(part);
      }
    }
  }

  return [...found.values()];
}
