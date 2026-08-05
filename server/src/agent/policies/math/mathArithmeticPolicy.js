/**
 * math_arithmetic — exercices arithmétiques fermés (+ − × ÷ ^).
 * Stop déterministe avant workload / composer / web.
 *
 * Modes de sortie :
 * - strict (défaut) : une ligne par résultat, sans bavardage
 * - steps : montre les étapes si demandé explicitement
 * - explain : explication si demandé explicitement
 */

export const MATH_ARITHMETIC_RULE = "math_arithmetic_policy_v1";

export const MATH_ARITHMETIC_ANSWER_MODES = Object.freeze({
  STRICT: "strict",
  STEPS: "steps",
  EXPLAIN: "explain",
});

export const MATH_ARITHMETIC_KINDS = Object.freeze({
  SINGLE: "arithmetic_single",
  LIST: "arithmetic_list",
});

/** @typedef {'strict'|'steps'|'explain'} MathArithmeticAnswerMode */

const META_ABOUT_MATH_RE =
  /\b(?:comment\s+tu\s+|comment\s+est[- ]ce\s+que\s+tu\s+|de\s+quelle\s+mani[eè]re\s+tu\s+|comment\s+(?:g[eè]res|traites|abordes)|quelle\s+est\s+ta\s+(?:mani[eè]re|fa[cç]on))\b/i;

const COMPUTE_SHELL_RE =
  /\b(?:effectue|effectuer|fais|fait|calcule|calculer|calculez|r[eé]sous|r[eé]soudre|r[eé]souds|trouve|trouver)\b/i;

const CALCULS_NOUN_RE =
  /\b(?:les\s+calculs?(?:\s+suivants?)?|calculs?(?:\s+suivants?)?|op[eé]rations?(?:\s+suivantes?)?|expressions?(?:\s+suivantes?)?)\b/i;

const STEPS_RE =
  /\b(?:montre(?:[- ]moi)?\s+les\s+[eé]tapes|[eé]tape\s+par\s+[eé]tape|d[eé]taille\s+les\s+[eé]tapes|avec\s+les\s+[eé]tapes|montre\s+le\s+d[eé]tail\s+du\s+calcul)\b/i;

const EXPLAIN_RE =
  /\b(?:explique(?:[- ]moi)?(?:\s+comment)?|expliquer(?:\s+comment)?|comment\s+(?:faire|calculer|r[eé]soudre)|pourquoi\s+(?:ce\s+r[eé]sultat|on\s+obtient))\b/i;

/** Expression compacte fermée : chiffres + opérateurs uniquement. */
const CLOSED_EXPR_COMPACT_RE =
  /^[+-]?\d+(?:\.\d+)?(?:[+\-*/^][+-]?\d+(?:\.\d+)?)+$/;

const NUMBERED_LINE_RE = /^\s*\d+\s*[-–.)]\s*(.+)$/;

/**
 * @param {string} raw
 */
export function normalizeMathArithmeticQuery(raw = "") {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} query
 * @returns {MathArithmeticAnswerMode}
 */
export function resolveMathArithmeticAnswerMode(query = "") {
  const q = String(query || "");
  if (STEPS_RE.test(q)) return MATH_ARITHMETIC_ANSWER_MODES.STEPS;
  if (EXPLAIN_RE.test(q) && !META_ABOUT_MATH_RE.test(q)) {
    return MATH_ARITHMETIC_ANSWER_MODES.EXPLAIN;
  }
  return MATH_ARITHMETIC_ANSWER_MODES.STRICT;
}

/**
 * @param {string} expr
 * @returns {string}
 */
function normalizeExpression(expr = "") {
  return String(expr || "")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/,/g, ".")
    .replace(/\s+/g, "")
    .trim();
}

/**
 * @param {string} expr
 * @returns {boolean}
 */
export function isClosedArithmeticExpression(expr = "") {
  const n = normalizeExpression(expr);
  if (!n || n.length > 80) return false;
  if (/[^0-9+\-*/.^]/.test(n)) return false;
  if (!/[+\-*/^]/.test(n)) return false;
  return CLOSED_EXPR_COMPACT_RE.test(n);
}

/**
 * Évalue une expression fermée (ops binaires gauches→droite, ^ à droite).
 * @param {string} expr
 * @returns {number|null}
 */
export function evaluateClosedArithmeticExpression(expr = "") {
  const src = normalizeExpression(expr);
  if (!isClosedArithmeticExpression(src)) return null;

  // Tokenize numbers and operators
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    if (/[0-9.]/.test(src[i])) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j += 1;
      const num = Number.parseFloat(src.slice(i, j));
      if (!Number.isFinite(num)) return null;
      tokens.push(num);
      i = j;
      continue;
    }
    if ("+-*/^".includes(src[i])) {
      // unary minus after op or start
      if (
        src[i] === "-" &&
        (tokens.length === 0 || typeof tokens[tokens.length - 1] === "string")
      ) {
        let j = i + 1;
        if (j < src.length && /[0-9.]/.test(src[j])) {
          while (j < src.length && /[0-9.]/.test(src[j])) j += 1;
          const num = Number.parseFloat(src.slice(i, j));
          if (!Number.isFinite(num)) return null;
          tokens.push(num);
          i = j;
          continue;
        }
      }
      tokens.push(src[i]);
      i += 1;
      continue;
    }
    return null;
  }

  if (tokens.length < 3 || typeof tokens[0] !== "number") return null;

  // Powers right-associative
  const withPow = [];
  for (let k = 0; k < tokens.length; k += 1) {
    if (tokens[k] === "^") {
      const left = withPow.pop();
      const right = tokens[k + 1];
      if (typeof left !== "number" || typeof right !== "number") return null;
      withPow.push(left ** right);
      k += 1;
      continue;
    }
    withPow.push(tokens[k]);
  }

  // * / left-associative
  const withMul = [];
  for (let k = 0; k < withPow.length; k += 1) {
    const t = withPow[k];
    if (t === "*" || t === "/") {
      const left = withMul.pop();
      const right = withPow[k + 1];
      if (typeof left !== "number" || typeof right !== "number") return null;
      if (t === "/" && right === 0) return null;
      withMul.push(t === "*" ? left * right : left / right);
      k += 1;
      continue;
    }
    withMul.push(t);
  }

  // + - left-associative
  let acc = withMul[0];
  if (typeof acc !== "number") return null;
  for (let k = 1; k < withMul.length; k += 2) {
    const op = withMul[k];
    const right = withMul[k + 1];
    if ((op !== "+" && op !== "-") || typeof right !== "number") return null;
    acc = op === "+" ? acc + right : acc - right;
  }
  return Number.isFinite(acc) ? acc : null;
}

/**
 * @param {number} value
 */
function formatResult(value) {
  if (!Number.isFinite(value)) return String(value);
  if (Number.isInteger(value)) return String(value);
  const rounded = Math.round(value * 1e10) / 1e10;
  return String(rounded);
}

/**
 * @param {string} query
 * @returns {string[]}
 */
export function extractClosedArithmeticExpressions(query = "") {
  const raw = String(query || "");
  const found = [];
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    const numbered = line.match(NUMBERED_LINE_RE);
    const candidate = numbered ? numbered[1] : line;
    const cleaned = String(candidate || "")
      .replace(
        /^(?:calcule|calculer|r[eé]sous|r[eé]soudre|trouve|trouver)\s+/i,
        "",
      )
      .trim();
    if (isClosedArithmeticExpression(cleaned)) {
      found.push(normalizeExpression(cleaned));
    }
  }

  // Single-line: pull expressions from the whole query if none from lines
  if (found.length === 0) {
    const stripped = raw
      .replace(COMPUTE_SHELL_RE, " ")
      .replace(CALCULS_NOUN_RE, " ")
      .replace(STEPS_RE, " ")
      .replace(EXPLAIN_RE, " ")
      .replace(/[:：]/g, " ")
      .trim();
    // Split on ; or newlines already handled — try whole remainder
    const parts = stripped.split(/\s*;\s*|\s+et\s+(?=[-+]?\d)/i);
    for (const part of parts) {
      const cleaned = part
        .replace(/^(?:calcule|calculer)\s+/i, "")
        .replace(/^\d+\s*[-–.)]\s*/, "")
        .trim();
      if (isClosedArithmeticExpression(cleaned)) {
        found.push(normalizeExpression(cleaned));
      }
    }
  }

  // Dedupe preserve order
  const seen = new Set();
  return found.filter((e) => {
    if (seen.has(e)) return false;
    seen.add(e);
    return true;
  });
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isMathArithmeticRequest(query = "") {
  const raw = String(query || "").trim();
  if (!raw || META_ABOUT_MATH_RE.test(raw)) return false;

  const exprs = extractClosedArithmeticExpressions(raw);
  if (exprs.length === 0) return false;

  const hasShell =
    COMPUTE_SHELL_RE.test(raw) ||
    CALCULS_NOUN_RE.test(raw) ||
    /^\s*\d+\s*[-–.)]\s*/m.test(raw);

  // Au moins une expression + (shell calcul OU liste numérotée d'expressions)
  if (exprs.length >= 2) return true;
  return hasShell && exprs.length === 1;
}

/**
 * @param {string} expr display source
 * @param {number} value
 * @param {MathArithmeticAnswerMode} mode
 */
function formatOneResult(expr, value, mode) {
  const display = expr
    .replace(/\*/g, " × ")
    .replace(/\//g, " ÷ ")
    .replace(/\+/g, " + ")
    .replace(/(?<=\d)-/g, " − ")
    .replace(/\^/g, "^")
    .replace(/\s+/g, " ")
    .trim();
  const result = formatResult(value);

  if (mode === MATH_ARITHMETIC_ANSWER_MODES.STRICT) {
    return `${display} = ${result}`;
  }

  if (mode === MATH_ARITHMETIC_ANSWER_MODES.STEPS) {
    return `${display}\n→ ${result}`;
  }

  // explain: courte, toujours ancrée sur le résultat (pas de digression)
  return `${display} = ${result} (opération arithmétique fermée).`;
}

/**
 * @param {string} query
 * @returns {{
 *   kind: string,
 *   answerMode: MathArithmeticAnswerMode,
 *   expressions: string[],
 *   values: number[],
 * }|null}
 */
export function parseMathArithmeticTask(query = "") {
  if (!isMathArithmeticRequest(query)) return null;
  const expressions = extractClosedArithmeticExpressions(query);
  if (expressions.length === 0) return null;

  const values = [];
  for (const expr of expressions) {
    const v = evaluateClosedArithmeticExpression(expr);
    if (v === null) return null;
    values.push(v);
  }

  return {
    kind:
      expressions.length === 1
        ? MATH_ARITHMETIC_KINDS.SINGLE
        : MATH_ARITHMETIC_KINDS.LIST,
    answerMode: resolveMathArithmeticAnswerMode(query),
    expressions,
    values,
  };
}

/**
 * @param {{ answerMode: MathArithmeticAnswerMode, expressions: string[], values: number[] }} task
 */
export function buildMathArithmeticReply(task) {
  if (!task?.expressions?.length || task.expressions.length !== task.values?.length) {
    return null;
  }
  const mode = task.answerMode || MATH_ARITHMETIC_ANSWER_MODES.STRICT;
  const lines = task.expressions.map((expr, i) =>
    formatOneResult(expr, task.values[i], mode),
  );

  if (mode === MATH_ARITHMETIC_ANSWER_MODES.STRICT) {
    return lines.join("\n");
  }
  if (mode === MATH_ARITHMETIC_ANSWER_MODES.STEPS) {
    return lines.join("\n\n");
  }
  return lines.join("\n");
}

/**
 * @param {string} query
 * @param {string} reply
 */
export function isMathArithmeticReplyCoherent(query = "", reply = "") {
  const text = String(reply || "").trim();
  if (!text) return false;
  const mode = resolveMathArithmeticAnswerMode(query);
  if (mode === MATH_ARITHMETIC_ANSWER_MODES.STRICT) {
    // Pas d'intro / suggestion typique
    if (/\b(?:voici|je\s+peux|si\s+tu\s+veux|n['’]h[eé]site|explique|d[eé]taille)\b/i.test(text)) {
      return false;
    }
    return /=\s*-?\d/.test(text);
  }
  // steps / explain : résultat chiffré obligatoire (= ou →)
  return /(?:→|=>|=)\s*-?\d/.test(text);
}

/**
 * @param {string} query
 */
export function isMathArithmeticSatisfiable(query = "") {
  const task = parseMathArithmeticTask(query);
  if (!task) return false;
  const reply = buildMathArithmeticReply(task);
  return Boolean(reply) && isMathArithmeticReplyCoherent(query, reply);
}

/**
 * @param {string} query
 * @returns {{ path: string, kind: string, reply: string, task: object, answerMode: string }|null}
 */
export function resolveMathArithmeticShortCircuit(query = "") {
  const task = parseMathArithmeticTask(query);
  if (!task) return null;
  const reply = buildMathArithmeticReply(task);
  if (!reply || !isMathArithmeticReplyCoherent(query, reply)) return null;

  return {
    path: "math_arithmetic_deterministic",
    kind: task.kind,
    reply,
    task,
    answerMode: task.answerMode,
  };
}

/**
 * @param {string} query
 */
export function resolveMathArithmeticBypassReply(query = "") {
  return resolveMathArithmeticShortCircuit(query)?.reply || "";
}
