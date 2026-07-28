/**
 * math_percent — pourcentages élémentaires : partie, augmentation, réduction.
 * Extraction structurée : operation × rate × base × mode (G23).
 */

export const MATH_PERCENT_RULE = "math_percent_policy_v1";

export const MATH_PERCENT_CANONICAL_PART_OF_QUERY = "quel est 15 % de 200";

export const MATH_PERCENT_CANONICAL_INCREASE_QUERY = "augmente 80 de 25 %";

export const MATH_PERCENT_CANONICAL_DECREASE_QUERY = "réduis 200 de 10 %";

export const MATH_PERCENT_CANONICAL_GENERIC_QUERY =
  "bonjour tu peux m'aider à calculer un pourcentage ??";

export const MATH_PERCENT_OPERATIONS = Object.freeze({
  PART_OF: "part_of",
  INCREASE: "increase",
  DECREASE: "decrease",
});

export const MATH_PERCENT_MODES = Object.freeze({
  COMPUTE: "compute",
  EXPLAIN: "explain",
});

export const MATH_PERCENT_KINDS = Object.freeze({
  PART_OF_COMPUTED: "part_of_computed",
  INCREASE_COMPUTED: "increase_computed",
  DECREASE_COMPUTED: "decrease_computed",
  PERCENT_EXPLAIN: "percent_explain",
});

const PERCENT_SHELL_RE = /(?:%|pourcent(?:age)?s?|pour\s+cents?)/i;

const MATH_PERCENT_ACTION_RE =
  /\b(?:calculer|calcule|donne|donner|trouve|trouver|combien|quel|quelle|valeur|augmente|augmenter|majore|majorer|diminue|diminuer|reduis|réduis|reduit|réduit|baisse|baisser)\b/i;

const MATH_PERCENT_EXPLAIN_RE =
  /\b(?:explique|expliquer|definis|définis|definir|définir|c\s+est\s+quoi|qu\s+est\s+ce\s+que|signifie|definition|définition)\b/i;

const GENERIC_PERCENT_RE =
  /\b(?:un\s+pourcentage|des\s+pourcentages|le\s+pourcentage)\b/i;

const PART_OF_RE =
  /(\d+(?:[.,]\d+)?)\s*(?:%|pourcent(?:age)?s?)\s*(?:de|sur|d')\s*(\d+(?:[.,]\d+)?)/i;

const INCREASE_RE =
  /\b(?:augmente|augmenter|majore|majorer|ajoute|ajouter)\s*(\d+(?:[.,]\d+)?)\s*(?:de|d')\s*(\d+(?:[.,]\d+)?)\s*(?:%|pourcent(?:age)?s?)/i;

const DECREASE_RE =
  /\b(?:diminue|diminuer|reduis|réduis|reduit|réduit|baisse|baisser)\s*(\d+(?:[.,]\d+)?)\s*(?:de|d')\s*(\d+(?:[.,]\d+)?)\s*(?:%|pourcent(?:age)?s?)/i;

/**
 * @param {string} raw
 */
export function normalizeMathPercentQuery(raw = "") {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} token
 * @returns {number|null}
 */
function parseNumber(token = "") {
  const value = Number.parseFloat(String(token || "").replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

/**
 * @param {number} value
 */
function formatNumber(value) {
  const rounded = Math.round(value * 1_000) / 1_000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

/**
 * @param {string} query
 * @returns {{
 *   operation: string,
 *   mode: string,
 *   rate: number|null,
 *   base: number|null,
 * }|null}
 */
export function extractMathPercentIntent(query = "") {
  const q = normalizeMathPercentQuery(query);
  if (!q) return null;

  const hasPercentSignal =
    PERCENT_SHELL_RE.test(q) ||
    PART_OF_RE.test(q) ||
    INCREASE_RE.test(q) ||
    DECREASE_RE.test(q);
  if (!hasPercentSignal) return null;

  const explainMode =
    MATH_PERCENT_EXPLAIN_RE.test(q) ||
    (GENERIC_PERCENT_RE.test(q) && !PART_OF_RE.test(q) && !INCREASE_RE.test(q) && !DECREASE_RE.test(q));

  const partMatch = q.match(PART_OF_RE);
  if (partMatch) {
    const rate = parseNumber(partMatch[1]);
    const base = parseNumber(partMatch[2]);
    if (rate !== null && base !== null) {
      return {
        operation: MATH_PERCENT_OPERATIONS.PART_OF,
        mode: MATH_PERCENT_MODES.COMPUTE,
        rate,
        base,
      };
    }
  }

  const increaseMatch = q.match(INCREASE_RE);
  if (increaseMatch) {
    const base = parseNumber(increaseMatch[1]);
    const rate = parseNumber(increaseMatch[2]);
    if (rate !== null && base !== null) {
      return {
        operation: MATH_PERCENT_OPERATIONS.INCREASE,
        mode: MATH_PERCENT_MODES.COMPUTE,
        rate,
        base,
      };
    }
  }

  const decreaseMatch = q.match(DECREASE_RE);
  if (decreaseMatch) {
    const base = parseNumber(decreaseMatch[1]);
    const rate = parseNumber(decreaseMatch[2]);
    if (rate !== null && base !== null) {
      return {
        operation: MATH_PERCENT_OPERATIONS.DECREASE,
        mode: MATH_PERCENT_MODES.COMPUTE,
        rate,
        base,
      };
    }
  }

  if (explainMode || (MATH_PERCENT_ACTION_RE.test(q) && GENERIC_PERCENT_RE.test(q))) {
    return {
      operation: MATH_PERCENT_OPERATIONS.PART_OF,
      mode: MATH_PERCENT_MODES.EXPLAIN,
      rate: null,
      base: null,
    };
  }

  if (MATH_PERCENT_ACTION_RE.test(q) && PERCENT_SHELL_RE.test(q)) {
    return {
      operation: MATH_PERCENT_OPERATIONS.PART_OF,
      mode: MATH_PERCENT_MODES.EXPLAIN,
      rate: null,
      base: null,
    };
  }

  return null;
}

/**
 * @param {{ operation: string, mode: string, rate: number|null, base: number|null }} intent
 * @returns {string|null}
 */
function resolveKindFromIntent(intent) {
  if (intent.mode === MATH_PERCENT_MODES.EXPLAIN) {
    return MATH_PERCENT_KINDS.PERCENT_EXPLAIN;
  }
  switch (intent.operation) {
    case MATH_PERCENT_OPERATIONS.PART_OF:
      return MATH_PERCENT_KINDS.PART_OF_COMPUTED;
    case MATH_PERCENT_OPERATIONS.INCREASE:
      return MATH_PERCENT_KINDS.INCREASE_COMPUTED;
    case MATH_PERCENT_OPERATIONS.DECREASE:
      return MATH_PERCENT_KINDS.DECREASE_COMPUTED;
    default:
      return null;
  }
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isMathPercentRequest(query = "") {
  return Boolean(extractMathPercentIntent(query));
}

/**
 * @param {string} query
 * @returns {{ kind: string, operation: string, mode: string, rate: number|null, base: number|null }|null}
 */
export function parseMathPercentTask(query = "") {
  const intent = extractMathPercentIntent(query);
  if (!intent) return null;
  const kind = resolveKindFromIntent(intent);
  if (!kind) return null;
  return { kind, ...intent };
}

/**
 * @param {{ kind: string, operation?: string, rate?: number|null, base?: number|null }} task
 * @returns {string|null}
 */
export function buildMathPercentReply(task) {
  if (!task?.kind) return null;

  switch (task.kind) {
    case MATH_PERCENT_KINDS.PERCENT_EXPLAIN:
      return (
        "Un **pourcentage** exprime une proportion sur 100 : **15 %** signifie **15 pour 100**, soit **0,15** du total. " +
        "Formules utiles : **partie = taux × base** (ex. 15 % de 200 = 30), " +
        "**augmentation** = base × (1 + taux/100), **réduction** = base × (1 − taux/100). " +
        "Donne un taux et une base (ex. « 15 % de 200 ») et je calcule."
      );

    case MATH_PERCENT_KINDS.PART_OF_COMPUTED: {
      const part = (task.rate / 100) * task.base;
      return (
        `**${task.rate} %** de **${formatNumber(task.base)}** = **${formatNumber(part)}** ` +
        `(${formatNumber(task.rate)} / 100 × ${formatNumber(task.base)} = ${formatNumber(part)}).`
      );
    }

    case MATH_PERCENT_KINDS.INCREASE_COMPUTED: {
      const result = task.base * (1 + task.rate / 100);
      return (
        `**${formatNumber(task.base)}** augmenté de **${task.rate} %** = **${formatNumber(result)}** ` +
        `(${formatNumber(task.base)} × (1 + ${formatNumber(task.rate)}/100) = ${formatNumber(result)}).`
      );
    }

    case MATH_PERCENT_KINDS.DECREASE_COMPUTED: {
      const result = task.base * (1 - task.rate / 100);
      return (
        `**${formatNumber(task.base)}** réduit de **${task.rate} %** = **${formatNumber(result)}** ` +
        `(${formatNumber(task.base)} × (1 − ${formatNumber(task.rate)}/100) = ${formatNumber(result)}).`
      );
    }

    default:
      return null;
  }
}

/**
 * @param {string} query
 * @param {string} reply
 * @returns {boolean}
 */
export function isMathPercentReplyCoherent(query = "", reply = "") {
  const intent = extractMathPercentIntent(query);
  if (!intent) return true;

  const text = String(reply || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (!/\bpourcent/.test(text) && !/%/.test(text)) return false;
  if (/je vois la piste|precise ton objectif|cadrer un projet/i.test(text)) return false;

  if (intent.mode === MATH_PERCENT_MODES.COMPUTE && intent.rate !== null) {
    if (intent.operation === MATH_PERCENT_OPERATIONS.INCREASE) {
      return /\baugment/.test(text);
    }
    if (intent.operation === MATH_PERCENT_OPERATIONS.DECREASE) {
      return /\bredui|\bdiminu|\bbaiss/.test(text);
    }
    if (intent.operation === MATH_PERCENT_OPERATIONS.PART_OF) {
      return !/\baugment/.test(text) && !/\bredui|\bdiminu|\bbaiss/.test(text);
    }
  }
  return true;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isMathPercentSatisfiable(query = "") {
  const task = parseMathPercentTask(query);
  if (!task) return false;
  const reply = buildMathPercentReply(task);
  return Boolean(reply) && isMathPercentReplyCoherent(query, reply);
}

/**
 * @param {string} query
 * @returns {{ path: string, kind: string, reply: string, task: object }|null}
 */
export function resolveMathPercentShortCircuit(query = "") {
  const task = parseMathPercentTask(query);
  if (!task) return null;
  const reply = buildMathPercentReply(task);
  if (!reply || !isMathPercentReplyCoherent(query, reply)) return null;

  return {
    path: "math_percent_deterministic",
    kind: task.kind,
    reply,
    task,
  };
}

/**
 * @param {string} query
 * @returns {string}
 */
export function resolveMathPercentBypassReply(query = "") {
  return resolveMathPercentShortCircuit(query)?.reply || "";
}
