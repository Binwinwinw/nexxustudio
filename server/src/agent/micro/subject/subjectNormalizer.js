import { normalizeFamiliarityQuery } from "../../utils/familiarityIntentGuards.js";

/** @type {Map<string, string>} alias → clé canonique */
const ALIAS_TO_CANONICAL = new Map();

/** @type {Map<string, { canonical: string, aliases: string[] }>} */
const CANONICAL_ENTRIES = new Map();

function registerCanonical(canonical, aliases = []) {
  const key = canonical.toLowerCase().trim();
  CANONICAL_ENTRIES.set(key, { canonical: key, aliases });
  for (const alias of [key, ...aliases]) {
    ALIAS_TO_CANONICAL.set(alias.toLowerCase().trim(), key);
  }
}

registerCanonical("need for speed", ["nfs", "need 4 speed", "need4speed"]);
registerCanonical("grand theft auto", ["gta"]);
registerCanonical("eclipse", []);
registerCanonical("atlas", []);

const LEET_FOR_PATTERN = /\bneed\s+4\s+speed\b/i;

/**
 * @param {string} raw
 * @returns {{ raw: string, normalizedKey: string, canonical: string }}
 */
export function normalizeSubject(raw = "") {
  const trimmed = String(raw || "").trim();
  let normalizedKey = normalizeFamiliarityQuery(trimmed)
    .replace(/^(le|la|les|l)\s+/, "")
    .trim();

  if (LEET_FOR_PATTERN.test(normalizedKey)) {
    normalizedKey = "need for speed";
  }

  normalizedKey = normalizedKey.replace(/\s+/g, " ");

  const canonical = ALIAS_TO_CANONICAL.get(normalizedKey) || normalizedKey;

  return {
    raw: trimmed,
    normalizedKey,
    canonical,
  };
}

export function registerSubjectAlias(canonical, alias) {
  const entry = CANONICAL_ENTRIES.get(canonical.toLowerCase());
  if (entry) {
    entry.aliases.push(alias.toLowerCase());
    ALIAS_TO_CANONICAL.set(alias.toLowerCase(), canonical.toLowerCase());
  } else {
    registerCanonical(canonical, [alias]);
  }
}
