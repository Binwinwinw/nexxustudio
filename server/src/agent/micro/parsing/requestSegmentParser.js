/**
 * Micro-parser de segments de requête — signaux, buts, contexte support.
 * Doctrine : un signal reconnu ne doit pas annuler le reste de la phrase.
 * Precedence weather vs time : contrat resolveWeatherTemporalPrecedence.
 */
import {
  detectWeatherPrimaryIntent,
  extractTemporalModifierSignal,
  isStandaloneTimeLookup,
  isWeatherFamilyIntent,
  resolveWeatherTemporalPrecedence,
} from "./compositeQueryFrameParser.js";

const GOAL_LINKER_PATTERN =
  /\b(?:afin de|pour pouvoir|pour trouver|pour savoir|en vue de|histoire de|de facon a|de façon a|de maniere a|de manière a)\b/i;

const SEGMENT_DETECTORS = [
  {
    type: "weather_current",
    test: (t, raw) => detectWeatherPrimaryIntent(raw || t) === "weather_current",
  },
  {
    type: "temporal_modifier",
    test: (t, raw) => {
      if (!extractTemporalModifierSignal(raw || t)) return false;
      // Modificateur attaché à un but météo — pas une question d'heure autonome.
      return Boolean(detectWeatherPrimaryIntent(raw || t));
    },
  },
  {
    type: "time_lookup",
    test: (t, raw) => isStandaloneTimeLookup(raw || t),
  },
  {
    type: "purchase_advice",
    test: (t) =>
      /\b(bon achat|acheter|achat|carte graphique|gpu|graphique|vram|\d+\s*go)\b/i.test(
        t,
      ),
  },
  {
    type: "recommendation",
    test: (t) =>
      /\b(conseil|recommand|meilleur|quel .* choisir|quelle .* choisir)\b/i.test(
        t,
      ),
  },
  {
    type: "identity_lookup",
    test: (t) =>
      /\b(qui es tu|qui es tu exactement|quel est ton nom|ton nom|comment tu t appelles|comment t appelles tu|tu t appelles comment|c est quoi ton nom)\b/i.test(
        t,
      ),
  },
  {
    type: "how_to",
    test: (t) => /\b(comment|faire pour|procedure|etapes)\b/i.test(t),
  },
];

/** Priorité explicite — weather_current avant time_lookup. */
const SEGMENT_PRIORITY = [
  "purchase_advice",
  "recommendation",
  "weather_current",
  "identity_lookup",
  "how_to",
  "time_lookup",
  "temporal_modifier",
  "general",
];

function normalizeForParse(raw = "") {
  return String(raw)
    .toLowerCase()
    .replace(/œ/g, "oe")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectSegmentType(text, rawHint = "") {
  const t = normalizeForParse(text);
  if (!t) return "unknown";
  const raw = rawHint || text;
  for (const d of SEGMENT_DETECTORS) {
    if (d.test(t, raw)) return d.type;
  }
  return "general";
}

function collectHitTypes(normalized, raw) {
  return SEGMENT_DETECTORS.map((d) => ({
    type: d.type,
    hit: d.test(normalized, raw),
  })).filter((x) => x.hit);
}

/**
 * Applique le contrat weather vs time sur la liste de hits.
 * @param {Array<{ type: string }>} hits
 * @param {string} raw
 */
function applyWeatherTimePrecedenceToHits(hits, raw) {
  const weatherHit = hits.find((h) => isWeatherFamilyIntent(h.type));
  const hasTemporal = hits.some((h) => h.type === "temporal_modifier");
  const hasTime = hits.some((h) => h.type === "time_lookup");

  const decision = resolveWeatherTemporalPrecedence({
    weatherIntent: weatherHit?.type || detectWeatherPrimaryIntent(raw),
    hasTemporalModifier: hasTemporal || Boolean(extractTemporalModifierSignal(raw)),
    hasStandaloneTimeLookup: hasTime || isStandaloneTimeLookup(raw),
  });

  let next = hits.filter((h) => !decision.suppressed.includes(h.type));

  // Si weather wins mais weather_current absent des hits (détecté via frame), injecter.
  if (
    decision.winner &&
    isWeatherFamilyIntent(decision.winner) &&
    !next.some((h) => h.type === decision.winner)
  ) {
    next = [{ type: decision.winner }, ...next];
  }

  // temporal_modifier reste support si weather présent.
  if (
    decision.winner &&
    isWeatherFamilyIntent(decision.winner) &&
    extractTemporalModifierSignal(raw) &&
    !next.some((h) => h.type === "temporal_modifier")
  ) {
    next.push({ type: "temporal_modifier" });
  }

  return { hits: next, decision };
}

/**
 * @param {string} rawQuery
 * @returns {{
 *   raw: string,
 *   normalized: string,
 *   segments: Array<{ type: string, text: string, role: string }>,
 *   linker: string|null,
 *   precedence?: object,
 * }}
 */
export function parseRequestSegments(rawQuery = "") {
  const raw = String(rawQuery || "").trim();
  const normalized = normalizeForParse(raw);

  if (!normalized) {
    return { raw, normalized, segments: [], linker: null };
  }

  const linkerMatch = normalized.match(GOAL_LINKER_PATTERN);
  if (linkerMatch?.index != null) {
    const idx = linkerMatch.index;
    const linker = linkerMatch[0];
    const before = normalized.slice(0, idx).trim();
    const after = normalized.slice(idx + linker.length).trim();
    const segments = [];
    if (before) {
      segments.push({
        type: detectSegmentType(before, before),
        text: before,
        role: "support_context",
      });
    }
    if (after) {
      segments.push({
        type: detectSegmentType(after, after),
        text: after,
        role: "primary_goal",
      });
    }
    return { raw, normalized, segments, linker };
  }

  let hits = collectHitTypes(normalized, raw);
  const { hits: rankedHits, decision } = applyWeatherTimePrecedenceToHits(
    hits,
    raw,
  );
  hits = rankedHits;

  if (hits.length <= 1) {
    const only = hits[0]?.type || detectSegmentType(normalized, raw);
    return {
      raw,
      normalized,
      segments: [
        {
          type: only,
          text: normalized,
          role: "primary_goal",
        },
      ],
      linker: null,
      precedence: decision,
    };
  }

  const primaryType =
    SEGMENT_PRIORITY.find((p) => hits.some((t) => t.type === p)) ||
    hits[0].type;

  return {
    raw,
    normalized,
    segments: hits.map((t) => ({
      type: t.type,
      text: normalized,
      role: t.type === primaryType ? "primary_goal" : "support_context",
    })),
    linker: null,
    precedence: decision,
  };
}

export {
  normalizeForParse,
  detectSegmentType,
  GOAL_LINKER_PATTERN,
  SEGMENT_PRIORITY,
};
