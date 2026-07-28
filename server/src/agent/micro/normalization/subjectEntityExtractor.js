/* Extraction d'entité principale + résolution célébrités */
import { sanitizeQuery, stripTrailingFiller } from "./querySanitizer.js";

/** Alias orthographiques → forme canonique */
export const CELEBRITY_ALIASES = {
  "mickael jackson": "Michael Jackson",
  "michael jackson": "Michael Jackson",
  "taylor swift": "Taylor Swift",
  "lionel messi": "Lionel Messi",
  "messi": "Lionel Messi",
  "beyonce": "Beyoncé",
  "beyoncé": "Beyoncé",
  "prince": "Prince",
  "madonna": "Madonna",
};

const LOWERCASE_PARTICLES = new Set([
  "de",
  "du",
  "des",
  "et",
  "la",
  "le",
  "les",
  "van",
  "von",
  "d",
]);

const COMPLEMENT_TAIL =
  /\s+et\s+(quelques|plusieurs|ses|des|la|liste|certains|certaines|un|une)\b/i;

const ORG_MARKERS =
  /\b(openai|mistral|microsoft|google|meta|anthropic|nvidia|apple|amazon|deepseek|hostinger|entreprise|societe|studio|labs)\b/;

const CELEBRITY_CONTEXT =
  /\b(chanson|chansons|album|albums|film|films|carriere|carrière|musique|discographie|sport|match|but|role|rôle)\b/;

/**
 * Extrait l'entité principale d'un sujet avec complément.
 * Ex. « mickael jackson et quelques-unes de ses chansons » → « mickael jackson »
 */
export function extractMainEntity(rawSubject = "") {
  const normalized = stripTrailingFiller(sanitizeQuery(rawSubject));
  if (!normalized) {
    return { main: "", complement: null, raw: rawSubject };
  }

  const tailMatch = normalized.match(COMPLEMENT_TAIL);
  if (tailMatch?.index != null && tailMatch.index > 0) {
    const main = normalized.slice(0, tailMatch.index).trim();
    const complement = normalized.slice(tailMatch.index).trim();
    if (main.length >= 2) {
      return { main, complement, raw: rawSubject };
    }
  }

  const etParts = normalized.split(/\s+et\s+/);
  if (etParts.length >= 2) {
    const second = etParts.slice(1).join(" et ");
    if (
      /^(quelques|plusieurs|ses|des|la|le|les|un|une)\b/.test(second) ||
      CELEBRITY_CONTEXT.test(second)
    ) {
      return { main: etParts[0].trim(), complement: second, raw: rawSubject };
    }
  }

  return { main: normalized, complement: null, raw: rawSubject };
}

/** Casse naturelle pour noms propres (pas Title Case grotesque sur toute une phrase). */
export function normalizeProperNameCase(text = "") {
  return String(text || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && LOWERCASE_PARTICLES.has(lower)) {
        return lower;
      }
      if (word.includes("-")) {
        return word
          .split("-")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
          .join("-");
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

export function resolveCelebrityLabel(normalizedMain = "") {
  const key = String(normalizedMain || "").trim();
  if (CELEBRITY_ALIASES[key]) return CELEBRITY_ALIASES[key];
  return null;
}

export function inferCelebrityFromContext(mainNormalized = "", complement = "") {
  if (resolveCelebrityLabel(mainNormalized)) return true;
  const probe = `${mainNormalized} ${complement || ""}`;
  if (CELEBRITY_CONTEXT.test(probe)) {
    const words = mainNormalized.split(/\s+/).filter(Boolean);
    return words.length >= 2 && words.length <= 4 && !ORG_MARKERS.test(mainNormalized);
  }
  return false;
}

export function isOrganizationEntity(normalizedMain = "") {
  return ORG_MARKERS.test(normalizedMain);
}
