/**
 * math_root — racines (carrée en v1) : calcul local ou explication pédagogique.
 * Extraction structurée : operation × operande × mode (G22).
 */

export const MATH_ROOT_RULE = "math_root_policy_v1";

/** Cas canonique G22 — racine carrée générique (typo « carré »). */
export const MATH_ROOT_CANONICAL_SQUARE_ROOT_QUERY =
  "bonjour tu peux m'aider à calculer la racine carré d'un nombre ??";

export const MATH_ROOT_CANONICAL_COMPUTE_QUERY = "calcule la racine carrée de 16";

export const MATH_ROOT_CANONICAL_EXPLAIN_QUERY =
  "explique ce qu'est une racine carrée";

export const MATH_ROOT_OPERATIONS = Object.freeze({
  SQUARE_ROOT: "square_root",
});

export const MATH_ROOT_MODES = Object.freeze({
  COMPUTE: "compute",
  EXPLAIN: "explain",
});

export const MATH_ROOT_KINDS = Object.freeze({
  SQUARE_ROOT_EXPLAIN: "square_root_explain",
  SQUARE_ROOT_COMPUTED: "square_root_computed",
  SQUARE_ROOT_NEGATIVE: "square_root_negative_operand",
});

const SQUARE_ROOT_SHELL_RE =
  /\b(?:racine\s+carre(?:e)?|square\s+root|sqrt)\b/i;

const MATH_ROOT_ACTION_RE =
  /\b(?:calculer|calcule|donne|donner|trouve|trouver|combien|valeur)\b/i;

const MATH_ROOT_EXPLAIN_RE =
  /\b(?:explique|expliquer|definis|définis|definir|définir|c\s+est\s+quoi|qu\s+est\s+ce\s+que|signifie|definition|définition)\b/i;

const GENERIC_NUMBER_OPERAND_RE = /\b(?:d\s+un\s+nombre|du\s+nombre|un\s+nombre)\b/i;

const OPERAND_VALUE_RE =
  /\b(?:de|du|d')\s*(-?\d+(?:[.,]\d+)?)\b/;

/**
 * @param {string} raw
 */
export function normalizeMathRootQuery(raw = "") {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\bracine\s+carre\b/g, "racine carree");
}

/**
 * @param {string} q
 * @returns {number|null}
 */
function parseOperandValue(q) {
  const match = q.match(OPERAND_VALUE_RE);
  if (!match) return null;
  const value = Number.parseFloat(String(match[1]).replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

/**
 * @param {string} query
 * @returns {{
 *   operation: string,
 *   mode: string,
 *   operand: number|null,
 * }|null}
 */
export function extractMathRootIntent(query = "") {
  const q = normalizeMathRootQuery(query);
  if (!q || !SQUARE_ROOT_SHELL_RE.test(q)) return null;

  const operand = parseOperandValue(q);
  const explainMode = MATH_ROOT_EXPLAIN_RE.test(q);
  const computeMode =
    MATH_ROOT_ACTION_RE.test(q) && !explainMode && operand !== null;
  const genericNumber =
    operand === null && GENERIC_NUMBER_OPERAND_RE.test(q);

  if (computeMode) {
    return {
      operation: MATH_ROOT_OPERATIONS.SQUARE_ROOT,
      mode: MATH_ROOT_MODES.COMPUTE,
      operand,
    };
  }

  if (explainMode || genericNumber || MATH_ROOT_ACTION_RE.test(q)) {
    return {
      operation: MATH_ROOT_OPERATIONS.SQUARE_ROOT,
      mode: MATH_ROOT_MODES.EXPLAIN,
      operand: null,
    };
  }

  return {
    operation: MATH_ROOT_OPERATIONS.SQUARE_ROOT,
    mode: MATH_ROOT_MODES.EXPLAIN,
    operand: null,
  };
}

/**
 * @param {{ operation: string, mode: string, operand: number|null }} intent
 * @returns {string|null}
 */
function resolveKindFromIntent(intent) {
  if (intent.mode === MATH_ROOT_MODES.EXPLAIN) {
    return MATH_ROOT_KINDS.SQUARE_ROOT_EXPLAIN;
  }
  if (intent.operand !== null && intent.operand < 0) {
    return MATH_ROOT_KINDS.SQUARE_ROOT_NEGATIVE;
  }
  if (intent.mode === MATH_ROOT_MODES.COMPUTE && intent.operand !== null) {
    return MATH_ROOT_KINDS.SQUARE_ROOT_COMPUTED;
  }
  return MATH_ROOT_KINDS.SQUARE_ROOT_EXPLAIN;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isMathRootRequest(query = "") {
  return Boolean(extractMathRootIntent(query));
}

/**
 * @param {string} query
 * @returns {{ kind: string, operation: string, mode: string, operand: number|null }|null}
 */
export function parseMathRootTask(query = "") {
  const intent = extractMathRootIntent(query);
  if (!intent) return null;
  const kind = resolveKindFromIntent(intent);
  if (!kind) return null;
  return { kind, ...intent };
}

/**
 * @param {number} n
 * @returns {string|null}
 */
export function formatSquareRootResult(n) {
  if (n < 0) return null;
  const root = Math.sqrt(n);
  if (Number.isInteger(root)) return String(root);
  const rounded = Math.round(root * 1_000_000) / 1_000_000;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) {
    return String(Math.round(rounded));
  }
  return `√${n} ≈ ${rounded.toFixed(3)}`;
}

/**
 * @param {{ kind: string, operand?: number|null }} task
 * @returns {string|null}
 */
export function buildMathRootReply(task) {
  if (!task?.kind) return null;

  switch (task.kind) {
    case MATH_ROOT_KINDS.SQUARE_ROOT_EXPLAIN:
      return (
        "La **racine carrée** d'un nombre **x** est le nombre **y** tel que **y² = x**. " +
        "Par exemple : √16 = 4, car 4 × 4 = 16. " +
        "Donne-moi un nombre précis (ex. 25, 49, 2) et je calcule sa racine carrée."
      );

    case MATH_ROOT_KINDS.SQUARE_ROOT_COMPUTED: {
      const result = formatSquareRootResult(task.operand);
      if (!result) return null;
      return `La racine carrée de **${task.operand}** est **${result}**.`;
    }

    case MATH_ROOT_KINDS.SQUARE_ROOT_NEGATIVE:
      return (
        "La racine carrée d'un **nombre négatif** n'est pas définie dans les **nombres réels**. " +
        "Sur les réels, on ne peut calculer √x que pour **x ≥ 0**."
      );

    default:
      return null;
  }
}

/**
 * @param {string} query
 * @param {string} reply
 * @returns {boolean}
 */
export function isMathRootReplyCoherent(query = "", reply = "") {
  const intent = extractMathRootIntent(query);
  if (!intent) return true;

  const text = String(reply || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (!/\bracine\s+carre/.test(text) && !/√/.test(text)) return false;
  if (/je vois la piste|precise ton objectif|cadrer un projet/i.test(text)) {
    return false;
  }
  if (intent.mode === MATH_ROOT_MODES.COMPUTE && intent.operand !== null && intent.operand >= 0) {
    return !/donne-moi un nombre precis/i.test(text);
  }
  return true;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isMathRootSatisfiable(query = "") {
  const task = parseMathRootTask(query);
  if (!task) return false;
  const reply = buildMathRootReply(task);
  return Boolean(reply) && isMathRootReplyCoherent(query, reply);
}

/**
 * @param {string} query
 * @returns {{ path: string, kind: string, reply: string, task: object }|null}
 */
export function resolveMathRootShortCircuit(query = "") {
  const task = parseMathRootTask(query);
  if (!task) return null;
  const reply = buildMathRootReply(task);
  if (!reply || !isMathRootReplyCoherent(query, reply)) return null;

  return {
    path: "math_root_deterministic",
    kind: task.kind,
    reply,
    task,
  };
}

/**
 * @param {string} query
 * @returns {string}
 */
export function resolveMathRootBypassReply(query = "") {
  return resolveMathRootShortCircuit(query)?.reply || "";
}
