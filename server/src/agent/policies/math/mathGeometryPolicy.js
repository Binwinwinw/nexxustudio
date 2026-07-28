/**
 * math_geometry — calculs et formules géométriques élémentaires (aire, périmètre).
 * Extraction structurée : operation × shape × dimensions (G21.1).
 */

export const MATH_GEOMETRY_RULE = "math_geometry_policy_v1";

/** Requête canonique G21 — aire rectangle avec typo « air ». */
export const MATH_GEOMETRY_CANONICAL_RECTANGLE_QUERY =
  "tu peux m'aider à calculer l'air d'un rectangle ??";

export const MATH_GEOMETRY_CANONICAL_RECTANGLE_PERIMETER_QUERY =
  "bonjour tu peux m'aider à calculer le périmètre d'un rectangle ??";

export const MATH_GEOMETRY_CANONICAL_RECTANGLE_DIMENSIONS_QUERY =
  "Calcule l'aire d'un rectangle de 5 cm par 3 cm";

export const MATH_GEOMETRY_CANONICAL_RECTANGLE_FORMULA_QUERY =
  "Donne la formule pour l'aire d'un rectangle";

export const MATH_GEOMETRY_OPERATIONS = Object.freeze({
  AREA: "area",
  PERIMETER: "perimeter",
  CIRCUMFERENCE: "circumference",
});

export const MATH_GEOMETRY_SHAPES = Object.freeze({
  RECTANGLE: "rectangle",
  SQUARE: "square",
  TRIANGLE: "triangle",
  CIRCLE: "circle",
});

export const MATH_GEOMETRY_KINDS = Object.freeze({
  RECTANGLE_AREA_FORMULA: "rectangle_area_formula",
  RECTANGLE_AREA_COMPUTED: "rectangle_area_computed",
  RECTANGLE_PERIMETER_FORMULA: "rectangle_perimeter_formula",
  RECTANGLE_PERIMETER_COMPUTED: "rectangle_perimeter_computed",
  SQUARE_AREA_FORMULA: "square_area_formula",
  SQUARE_PERIMETER_FORMULA: "square_perimeter_formula",
  TRIANGLE_AREA_FORMULA: "triangle_area_formula",
  CIRCLE_AREA_FORMULA: "circle_area_formula",
  CIRCLE_CIRCUMFERENCE_FORMULA: "circle_circumference_formula",
});

const MATH_GEOMETRY_ACTION_RE =
  /\b(?:calculer|calcule|donne|donner|trouve|trouver|formule|superficie|aire|perimetre|périmètre|mesure|circonference|circonférence)\b/i;

const RECTANGLE_RE = /\b(?:rectangle|rectangles)\b/i;
const SQUARE_RE = /\b(?:carre|carré|carrés)\b/i;
const TRIANGLE_RE = /\b(?:triangle|triangles)\b/i;
const CIRCLE_RE = /\b(?:cercle|cercles)\b/i;

const AREA_HINT_RE = /\b(?:aire|superficie)\b/i;
const PERIMETER_HINT_RE = /\b(?:perimetre|périmètre)\b/i;
const CIRCUMFERENCE_HINT_RE = /\b(?:circonference|circonférence)\b/i;

const DIMENSION_PAIR_RE =
  /(\d+(?:[.,]\d+)?)\s*(cm|mm|m|km)?\s*(?:par|×|x|\*|sur)\s*(\d+(?:[.,]\d+)?)\s*(cm|mm|m|km)?/i;

const SINGLE_MEASURE_RE =
  /(\d+(?:[.,]\d+)?)\s*(cm|mm|m|km)\b/i;

/**
 * @param {string} raw
 */
export function normalizeMathGeometryQuery(raw = "") {
  let q = String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['']/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  q = q.replace(/\bl\s+air\s+d\s+un\b/g, "l aire d un");
  q = q.replace(/\bair\s+d\s+un\b/g, "aire d un");
  q = q.replace(/\bcalculer\s+l\s+air\b/g, "calculer l aire");
  q = q.replace(/\bair\s+(?:d\s+un|du|de\s+la)\s+rectangle\b/g, "aire d un rectangle");

  return q;
}

/**
 * @param {string} q
 * @returns {keyof typeof MATH_GEOMETRY_SHAPES|null}
 */
function extractShape(q) {
  if (RECTANGLE_RE.test(q)) return MATH_GEOMETRY_SHAPES.RECTANGLE;
  if (SQUARE_RE.test(q)) return MATH_GEOMETRY_SHAPES.SQUARE;
  if (TRIANGLE_RE.test(q)) return MATH_GEOMETRY_SHAPES.TRIANGLE;
  if (CIRCLE_RE.test(q)) return MATH_GEOMETRY_SHAPES.CIRCLE;
  return null;
}

/**
 * @param {string} q
 * @param {string|null} shape
 * @returns {keyof typeof MATH_GEOMETRY_OPERATIONS|null}
 */
function extractOperation(q, shape = null) {
  if (PERIMETER_HINT_RE.test(q)) {
    return shape === MATH_GEOMETRY_SHAPES.CIRCLE
      ? MATH_GEOMETRY_OPERATIONS.CIRCUMFERENCE
      : MATH_GEOMETRY_OPERATIONS.PERIMETER;
  }
  if (CIRCUMFERENCE_HINT_RE.test(q)) {
    return MATH_GEOMETRY_OPERATIONS.CIRCUMFERENCE;
  }
  if (AREA_HINT_RE.test(q)) {
    return MATH_GEOMETRY_OPERATIONS.AREA;
  }
  return null;
}

/**
 * @param {string} q
 * @returns {{ length: number, width: number, unit: string|null }|null}
 */
function parseDimensionPair(q) {
  const match = q.match(DIMENSION_PAIR_RE);
  if (!match) return null;

  const length = Number.parseFloat(String(match[1]).replace(",", "."));
  const width = Number.parseFloat(String(match[3]).replace(",", "."));
  if (!Number.isFinite(length) || !Number.isFinite(width)) return null;

  const unit = match[2] || match[4] || null;
  return { length, width, unit };
}

/**
 * @param {string} q
 * @returns {{ value: number, unit: string|null }|null}
 */
function parseSingleMeasure(q) {
  const match = q.match(SINGLE_MEASURE_RE);
  if (!match) return null;
  const value = Number.parseFloat(String(match[1]).replace(",", "."));
  if (!Number.isFinite(value)) return null;
  return { value, unit: match[2] || null };
}

/**
 * @param {string} query
 * @returns {{
 *   operation: string,
 *   shape: string,
 *   dimensions: object|null,
 * }|null}
 */
export function extractMathGeometryIntent(query = "") {
  const q = normalizeMathGeometryQuery(query);
  if (!q) return null;

  const shape = extractShape(q);
  if (!shape) return null;

  const operation = extractOperation(q, shape);
  if (!operation) return null;

  const pair = parseDimensionPair(q);
  if (pair) {
    return { operation, shape, dimensions: pair };
  }

  const single = parseSingleMeasure(q);
  if (single) {
    if (shape === MATH_GEOMETRY_SHAPES.CIRCLE && operation === MATH_GEOMETRY_OPERATIONS.CIRCUMFERENCE) {
      return { operation, shape, dimensions: { radius: single.value, unit: single.unit } };
    }
    if (shape === MATH_GEOMETRY_SHAPES.SQUARE) {
      return { operation, shape, dimensions: { side: single.value, unit: single.unit } };
    }
  }

  return { operation, shape, dimensions: null };
}

/**
 * @param {{ operation: string, shape: string, dimensions: object|null }} intent
 * @returns {string|null}
 */
function resolveKindFromIntent(intent) {
  const { operation, shape, dimensions } = intent;
  const hasDims = Boolean(dimensions);

  if (shape === MATH_GEOMETRY_SHAPES.RECTANGLE) {
    if (operation === MATH_GEOMETRY_OPERATIONS.AREA) {
      return hasDims
        ? MATH_GEOMETRY_KINDS.RECTANGLE_AREA_COMPUTED
        : MATH_GEOMETRY_KINDS.RECTANGLE_AREA_FORMULA;
    }
    if (operation === MATH_GEOMETRY_OPERATIONS.PERIMETER) {
      return hasDims
        ? MATH_GEOMETRY_KINDS.RECTANGLE_PERIMETER_COMPUTED
        : MATH_GEOMETRY_KINDS.RECTANGLE_PERIMETER_FORMULA;
    }
  }

  if (shape === MATH_GEOMETRY_SHAPES.SQUARE) {
    if (operation === MATH_GEOMETRY_OPERATIONS.AREA) {
      return MATH_GEOMETRY_KINDS.SQUARE_AREA_FORMULA;
    }
    if (operation === MATH_GEOMETRY_OPERATIONS.PERIMETER) {
      return MATH_GEOMETRY_KINDS.SQUARE_PERIMETER_FORMULA;
    }
  }

  if (shape === MATH_GEOMETRY_SHAPES.TRIANGLE && operation === MATH_GEOMETRY_OPERATIONS.AREA) {
    return MATH_GEOMETRY_KINDS.TRIANGLE_AREA_FORMULA;
  }

  if (shape === MATH_GEOMETRY_SHAPES.CIRCLE) {
    if (operation === MATH_GEOMETRY_OPERATIONS.AREA) {
      return MATH_GEOMETRY_KINDS.CIRCLE_AREA_FORMULA;
    }
    if (operation === MATH_GEOMETRY_OPERATIONS.CIRCUMFERENCE) {
      return MATH_GEOMETRY_KINDS.CIRCLE_CIRCUMFERENCE_FORMULA;
    }
  }

  return null;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isMathGeometryRequest(query = "") {
  return Boolean(extractMathGeometryIntent(query));
}

/**
 * @param {string} query
 * @returns {{ kind: string, operation: string, shape: string, dimensions: object|null }|null}
 */
export function parseMathGeometryTask(query = "") {
  const intent = extractMathGeometryIntent(query);
  if (!intent) return null;

  const kind = resolveKindFromIntent(intent);
  if (!kind) return null;

  return {
    kind,
    operation: intent.operation,
    shape: intent.shape,
    dimensions: intent.dimensions,
  };
}

/**
 * @param {number} value
 * @param {string|null} unit
 */
function formatMeasure(value, unit = null) {
  const rounded =
    Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
  return unit ? `${rounded} ${unit}` : rounded;
}

/**
 * @param {{ kind: string, operation?: string, shape?: string, dimensions?: object|null }} task
 * @returns {string|null}
 */
export function buildMathGeometryReply(task) {
  if (!task?.kind) return null;

  switch (task.kind) {
    case MATH_GEOMETRY_KINDS.RECTANGLE_AREA_FORMULA:
      return (
        "L'aire d'un rectangle se calcule avec la formule **A = longueur × largeur** " +
        "(ou base × hauteur). Si tu as des mesures précises, donne-les et je calcule le résultat."
      );

    case MATH_GEOMETRY_KINDS.RECTANGLE_AREA_COMPUTED: {
      const { length, width, unit } = task.dimensions;
      const area = length * width;
      const unitSuffix = unit ? ` ${unit}²` : "";
      const dimLabel = unit
        ? `${formatMeasure(length, unit)} × ${formatMeasure(width, unit)}`
        : `${formatMeasure(length, null)} × ${formatMeasure(width, null)}`;
      return (
        `L'aire d'un rectangle de **${dimLabel}** est **${formatMeasure(area, null)}${unitSuffix}** ` +
        `(${formatMeasure(length, null)} × ${formatMeasure(width, null)} = ${formatMeasure(area, null)}).`
      );
    }

    case MATH_GEOMETRY_KINDS.RECTANGLE_PERIMETER_FORMULA:
      return (
        "Le périmètre d'un rectangle se calcule avec **P = 2 × (longueur + largeur)** " +
        "(ou **P = 2 × longueur + 2 × largeur**). Donne les mesures si tu veux un résultat chiffré."
      );

    case MATH_GEOMETRY_KINDS.RECTANGLE_PERIMETER_COMPUTED: {
      const { length, width, unit } = task.dimensions;
      const perimeter = 2 * (length + width);
      const unitSuffix = unit ? ` ${unit}` : "";
      const dimLabel = unit
        ? `${formatMeasure(length, unit)} × ${formatMeasure(width, unit)}`
        : `${formatMeasure(length, null)} × ${formatMeasure(width, null)}`;
      return (
        `Le périmètre d'un rectangle de **${dimLabel}** est **${formatMeasure(perimeter, null)}${unitSuffix}** ` +
        `(2 × (${formatMeasure(length, null)} + ${formatMeasure(width, null)}) = ${formatMeasure(perimeter, null)}).`
      );
    }

    case MATH_GEOMETRY_KINDS.SQUARE_AREA_FORMULA:
      return (
        "L'aire d'un carré se calcule avec **A = côté × côté** (ou **c²**). " +
        "Donne la longueur du côté si tu veux un calcul chiffré."
      );

    case MATH_GEOMETRY_KINDS.SQUARE_PERIMETER_FORMULA:
      return (
        "Le périmètre d'un carré se calcule avec **P = 4 × côté**. " +
        "Donne la longueur du côté si tu veux un résultat chiffré."
      );

    case MATH_GEOMETRY_KINDS.TRIANGLE_AREA_FORMULA:
      return (
        "L'aire d'un triangle se calcule avec **A = (base × hauteur) / 2**. " +
        "Donne base et hauteur si tu veux un résultat numérique."
      );

    case MATH_GEOMETRY_KINDS.CIRCLE_AREA_FORMULA:
      return (
        "L'aire d'un cercle se calcule avec **A = π × r²** (r = rayon). " +
        "Donne le rayon si tu veux un calcul chiffré."
      );

    case MATH_GEOMETRY_KINDS.CIRCLE_CIRCUMFERENCE_FORMULA:
      return (
        "La circonférence d'un cercle se calcule avec **C = 2 × π × r** (r = rayon). " +
        "Donne le rayon si tu veux un résultat chiffré."
      );

    default:
      return null;
  }
}

/**
 * Garde locale — la réponse doit correspondre à l'opération demandée.
 * @param {string} query
 * @param {string} reply
 * @returns {boolean}
 */
export function isMathGeometryReplyCoherent(query = "", reply = "") {
  const intent = extractMathGeometryIntent(query);
  if (!intent) return true;

  const text = String(reply || "").toLowerCase();
  if (intent.operation === MATH_GEOMETRY_OPERATIONS.PERIMETER) {
    return /\bpérimètre\b|\bperimetre\b/i.test(text) && !/\bl['']?aire\b/i.test(text);
  }
  if (intent.operation === MATH_GEOMETRY_OPERATIONS.CIRCUMFERENCE) {
    return /\bcirconférence\b|\bcirconference\b/i.test(text) && !/\bl['']?aire\b/i.test(text);
  }
  if (intent.operation === MATH_GEOMETRY_OPERATIONS.AREA) {
    return /\bl['']?aire\b/i.test(text) && !/\bpérimètre\b|\bperimetre\b/i.test(text);
  }
  return true;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isMathGeometrySatisfiable(query = "") {
  const task = parseMathGeometryTask(query);
  if (!task) return false;
  const reply = buildMathGeometryReply(task);
  return Boolean(reply) && isMathGeometryReplyCoherent(query, reply);
}

/**
 * @param {string} query
 * @returns {{ path: string, kind: string, reply: string, task: object }|null}
 */
export function resolveMathGeometryShortCircuit(query = "") {
  const task = parseMathGeometryTask(query);
  if (!task) return null;
  const reply = buildMathGeometryReply(task);
  if (!reply || !isMathGeometryReplyCoherent(query, reply)) return null;

  return {
    path: "math_geometry_deterministic",
    kind: task.kind,
    reply,
    task,
  };
}

/**
 * @param {string} query
 * @returns {string}
 */
export function resolveMathGeometryBypassReply(query = "") {
  return resolveMathGeometryShortCircuit(query)?.reply || "";
}
