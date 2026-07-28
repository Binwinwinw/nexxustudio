/**
 * math_simple — calculs élémentaires satisfiables localement (factorisation quadratique monique).
 * Court-circuite clarification gate et simple_fast pour expressions complètes.
 */

export const MATH_SIMPLE_RULE = "math_simple_policy_v1";

/** Requête canonique batterie #30 — factorisation quadratique monique. */
export const MATH_SIMPLE_CANONICAL_FACTORIZE_QUERY =
  "quelle est la forme factorisée de l'expression x²+5x+6 ?";

export const MATH_SIMPLE_KINDS = Object.freeze({
  FACTORIZE_QUADRATIC: "factorize_quadratic",
  FACTORIZE_QUADRATIC_SYMBOLIC: "factorize_quadratic_symbolic",
});

/** Canonique batterie #32 — racines irrationnelles (Δ > 0 non carré parfait). */
export const MATH_SIMPLE_CANONICAL_IRRATIONAL_FACTORIZE_QUERY =
  "quelle est la forme factorisée de x²+25x-46 ?";

const FACTORIZE_SHELL_RE =
  /\b(?:forme\s+factorisee?|factoriser|factorise[rz]?|factorisation|developper\s+et\s+factoriser)\b/i;

const QUADRATIC_EXPR_RE =
  /([+-]?\d*)\s*x\s*(?:\^2|²)\s*(?:([+-]?\s*\d*)\s*x\s*)?([+-]?\s*\d+)/i;

/**
 * @param {string} raw
 */
function normalizeMathShellQuery(raw = "") {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Préserve ^ et chiffres — ne passe pas par sanitizeQuery (qui retire ²/^).
 * @param {string} raw
 */
function normalizeMathExpressionSource(raw = "") {
  return String(raw || "").replace(/²/g, "^2").replace(/×/g, "*");
}

/**
 * @param {string} token
 * @returns {number|null}
 */
function parseSignedInteger(token = "") {
  const compact = String(token || "").replace(/\s/g, "");
  if (!compact || compact === "+") return 1;
  if (compact === "-") return -1;
  const value = Number.parseInt(compact, 10);
  return Number.isFinite(value) ? value : null;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isMathSimpleRequest(query = "") {
  const shellQ = normalizeMathShellQuery(query);
  if (!shellQ) return false;
  const exprQ = normalizeMathExpressionSource(query);
  return FACTORIZE_SHELL_RE.test(shellQ) || QUADRATIC_EXPR_RE.test(exprQ);
}

/**
 * @param {string} query
 * @returns {{
 *   kind: string,
 *   expression: string,
 *   coefficients: { a: number, b: number, c: number },
 * }|null}
 */
export function parseMathSimpleTask(query = "") {
  const shellQ = normalizeMathShellQuery(query);
  if (!shellQ) return null;

  const shell = FACTORIZE_SHELL_RE.test(shellQ);
  const exprSource = normalizeMathExpressionSource(query);
  const match = exprSource.match(QUADRATIC_EXPR_RE);
  if (!match) return null;
  if (!shell && !/\b(?:quelle|donne|calcule|trouve|combien)\b/i.test(shellQ)) {
    return null;
  }

  const a = parseSignedInteger(match[1]);
  const b = match[2] !== undefined ? parseSignedInteger(match[2]) : 0;
  const c = parseSignedInteger(match[3]);
  if (a === null || b === null || c === null) return null;
  if (a === 0) return null;

  const expression = match[0].replace(/\s/g, "");

  return {
    kind: MATH_SIMPLE_KINDS.FACTORIZE_QUADRATIC,
    expression,
    coefficients: { a, b, c },
  };
}

/**
 * @param {number} b
 * @param {number} c
 * @returns {{ p: number, q: number }|null}
 */
export function factorizeMonicQuadratic(b, c) {
  if (!Number.isInteger(b) || !Number.isInteger(c)) return null;
  const limit = Math.max(Math.abs(c), Math.abs(b), 1);
  for (let p = -limit; p <= limit; p += 1) {
    if (p === 0) continue;
    if (c % p !== 0) continue;
    const q = c / p;
    if (p + q === b) return { p, q };
  }
  return null;
}

/**
 * @param {number} n
 * @returns {string|null}
 */
function formatSqrtDelta(n) {
  if (n < 0) return null;
  const root = Math.sqrt(n);
  if (Number.isInteger(root)) return String(root);
  return `√${n}`;
}

/**
 * @param {number} b
 * @param {string} sqrtDelta
 * @param {"+"|"-"} op
 */
function formatQuadraticRoot(b, sqrtDelta, op) {
  const negB = -b;
  const bPart =
    negB === 0 ? "" : negB > 0 ? `${negB}` : `(${negB})`;
  const sqrtPart = sqrtDelta === "1" ? "" : `${op}${sqrtDelta}`;
  const numerator =
    bPart && sqrtPart ? `${bPart}${sqrtPart}` : bPart || sqrtPart.replace(/^\+/, "");
  return `(${numerator})/2`;
}

/**
 * @param {string} rootExpr
 */
function formatSymbolicLinearFactor(rootExpr) {
  return `(x-${rootExpr})`;
}

/**
 * Factorisation symbolique sur ℝ quand les racines ne sont pas entières.
 * @param {number} b
 * @param {number} c
 * @returns {{ factored: string, delta: number, style: "symbolic" }|null}
 */
export function factorizeMonicQuadraticSymbolic(b, c) {
  if (!Number.isInteger(b) || !Number.isInteger(c)) return null;
  const delta = b * b - 4 * c;
  if (delta < 0) return null;

  const intRoots = factorizeMonicQuadratic(b, c);
  if (intRoots) return null;

  const sqrtDelta = formatSqrtDelta(delta);
  if (!sqrtDelta) return null;

  const r1 = formatQuadraticRoot(b, sqrtDelta, "+");
  const r2 = formatQuadraticRoot(b, sqrtDelta, "-");
  const factored = `${formatSymbolicLinearFactor(r1)}${formatSymbolicLinearFactor(r2)}`;
  return { factored, delta, style: "symbolic" };
}

/**
 * @param {number} n
 */
function formatLinearFactor(n) {
  if (n > 0) return `(x+${n})`;
  return `(x${n})`;
}

/**
 * @param {{ kind: string, expression: string, coefficients: { a: number, b: number, c: number } }} task
 * @returns {{ factored: string, factors: [number, number] }|null}
 */
export function solveMathSimpleTask(task) {
  if (!task || task.kind !== MATH_SIMPLE_KINDS.FACTORIZE_QUADRATIC) return null;
  const { a, b, c } = task.coefficients;
  if (a !== 1) return null;

  const roots = factorizeMonicQuadratic(b, c);
  if (roots) {
    const { p, q } = roots;
    const factored = `${formatLinearFactor(p)}${formatLinearFactor(q)}`;
    return { factored, factors: [p, q], style: "integer" };
  }

  const symbolic = factorizeMonicQuadraticSymbolic(b, c);
  if (symbolic) {
    return {
      factored: symbolic.factored,
      delta: symbolic.delta,
      style: "symbolic",
    };
  }

  return null;
}

/**
 * @param {{ expression: string }} task
 * @param {{ factored: string }} result
 */
export function buildMathSimpleReply(task, result) {
  const displayExpr = String(task.expression || "")
    .replace(/\^2/g, "²")
    .replace(/\*/g, "×");
  if (result.style === "symbolic") {
    return (
      `La forme factorisée de **${displayExpr}** sur ℝ est **${result.factored}** ` +
      `(racines irrationnelles, Δ = ${result.delta}).`
    );
  }
  return `La forme factorisée de **${displayExpr}** est **${result.factored}**.`;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isMathSimpleSatisfiable(query = "") {
  const task = parseMathSimpleTask(query);
  if (!task) return false;
  return Boolean(solveMathSimpleTask(task));
}

/**
 * @param {string} query
 * @returns {{ path: string, kind: string, reply: string, task: object, result: object }|null}
 */
export function resolveMathSimpleShortCircuit(query = "") {
  const task = parseMathSimpleTask(query);
  if (!task) return null;
  const result = solveMathSimpleTask(task);
  if (!result) return null;

  return {
    path: "math_simple_deterministic",
    kind: task.kind,
    reply: buildMathSimpleReply(task, result),
    task,
    result,
  };
}
