/**
 * Micro-parser de segments de requête — signaux, buts, contexte support.
 * Doctrine : un signal reconnu ne doit pas annuler le reste de la phrase.
 */

const GOAL_LINKER_PATTERN =
  /\b(?:afin de|pour pouvoir|pour trouver|pour savoir|en vue de|histoire de|de facon a|de façon a|de maniere a|de manière a)\b/i;

const SEGMENT_DETECTORS = [
  {
    type: "time_lookup",
    test: (t) =>
      /\b(quelle date|date du jour|date d aujourd|on est quel jour|nous sommes quel jour|jour actuel|quelle heure|heure actuelle|il est quelle heure)\b/i.test(
        t,
      ),
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

function detectSegmentType(text) {
  const t = normalizeForParse(text);
  if (!t) return "unknown";
  for (const d of SEGMENT_DETECTORS) {
    if (d.test(t)) return d.type;
  }
  return "general";
}

/**
 * @param {string} rawQuery
 * @returns {{
 *   raw: string,
 *   normalized: string,
 *   segments: Array<{ type: string, text: string, role: string }>,
 *   linker: string|null,
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
        type: detectSegmentType(before),
        text: before,
        role: "support_context",
      });
    }
    if (after) {
      segments.push({
        type: detectSegmentType(after),
        text: after,
        role: "primary_goal",
      });
    }
    return { raw, normalized, segments, linker };
  }

  const types = SEGMENT_DETECTORS.map((d) => ({
    type: d.type,
    hit: d.test(normalized),
  })).filter((x) => x.hit);

  if (types.length <= 1) {
    const only = types[0]?.type || detectSegmentType(normalized);
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
    };
  }

  const priority = [
    "purchase_advice",
    "recommendation",
    "identity_lookup",
    "how_to",
    "time_lookup",
    "general",
  ];
  const primaryType =
    priority.find((p) => types.some((t) => t.type === p)) || types[0].type;

  return {
    raw,
    normalized,
    segments: types.map((t) => ({
      type: t.type,
      text: normalized,
      role: t.type === primaryType ? "primary_goal" : "support_context",
    })),
    linker: null,
  };
}

export { normalizeForParse, detectSegmentType, GOAL_LINKER_PATTERN };
