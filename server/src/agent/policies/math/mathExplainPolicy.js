/**
 * math_explain — explications math théoriques (discriminant, factorisation sur ℝ/ℂ).
 * Complète math_simple (calcul local) ; réponses codées pour les cas scolaires classiques.
 */

export const MATH_EXPLAIN_RULE = "math_explain_policy_v1";

/** Requête canonique batterie #31 — discriminant négatif. */
export const MATH_EXPLAIN_CANONICAL_NEGATIVE_DISCRIMINANT_QUERY =
  "Comment factoriser si le discriminant est négatif ?";

export const MATH_EXPLAIN_KINDS = Object.freeze({
  DISCRIMINANT_NEGATIVE: "discriminant_negative",
  DISCRIMINANT_ZERO: "discriminant_zero",
  DISCRIMINANT_POSITIVE: "discriminant_positive",
  DISCRIMINANT_GENERAL: "discriminant_general",
  FACTORIZATION_GENERAL: "factorization_general",
});

/** Canonique batterie #32 — théorie vague mais légitime. */
export const MATH_EXPLAIN_CANONICAL_FACTORIZATION_GENERAL_QUERY =
  "parle moi des factorisations en générale";

const MATH_EXPLAIN_SHELL_RE =
  /\b(?:explique|expliquer|comment|pourquoi|que se passe|qu se passe|definis|definition|definir|c est quoi|qu est ce que|signifie)\b/;

const MATH_CONCEPT_RE =
  /\b(?:discriminant|delta|factoris|racines?\s+reelles?|racines?\s+complexes?|trinome|equation\s+du\s+second|polynome\s+du\s+second)\b/;

/**
 * @param {string} raw
 */
export function normalizeMathExplainQuery(raw = "") {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isMathFactorizationGeneralRequest(query = "") {
  const q = normalizeMathExplainQuery(query);
  if (!/\bfactoris/.test(q)) return false;
  return (
    /\b(?:en\s+)?general/.test(q) ||
    /\b(?:parle|dis[- ]?moi|raconte|explique)\b/.test(q) ||
    /\bque\s+sais[- ]?tu\b/.test(q) ||
    /\bqu\s+est[- ]ce\b/.test(q)
  );
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isMathExplainRequest(query = "") {
  if (isMathFactorizationGeneralRequest(query)) return true;
  const q = normalizeMathExplainQuery(query);
  if (!q || !MATH_CONCEPT_RE.test(q)) return false;
  if (MATH_EXPLAIN_SHELL_RE.test(q)) return true;
  if (
    /\b(?:discriminant|delta)\b/.test(q) &&
    /\b(?:negatif|nul|positif|zero)\b/.test(q)
  ) {
    return true;
  }
  return false;
}

/**
 * @param {string} query
 * @returns {{ kind: string }|null}
 */
export function parseMathExplainTask(query = "") {
  const q = normalizeMathExplainQuery(query);
  if (isMathFactorizationGeneralRequest(query)) {
    return { kind: MATH_EXPLAIN_KINDS.FACTORIZATION_GENERAL };
  }
  if (!isMathExplainRequest(query)) return null;

  if (
    /\b(?:negatif|negative|<\s*0)\b/.test(q) &&
    /\b(?:discriminant|delta|factoris)\b/.test(q)
  ) {
    return { kind: MATH_EXPLAIN_KINDS.DISCRIMINANT_NEGATIVE };
  }
  if (
    /\b(?:nul|zero|= 0)\b/.test(q) &&
    /\b(?:discriminant|delta)\b/.test(q)
  ) {
    return { kind: MATH_EXPLAIN_KINDS.DISCRIMINANT_ZERO };
  }
  if (/\bpositif\b/.test(q) && /\b(?:discriminant|delta)\b/.test(q)) {
    return { kind: MATH_EXPLAIN_KINDS.DISCRIMINANT_POSITIVE };
  }
  if (/\b(?:discriminant|delta)\b/.test(q)) {
    return { kind: MATH_EXPLAIN_KINDS.DISCRIMINANT_GENERAL };
  }
  return null;
}

const CANNED_REPLIES = Object.freeze({
  [MATH_EXPLAIN_KINDS.DISCRIMINANT_NEGATIVE]:
    "Sur les **réels**, si le discriminant **Δ = b² − 4ac** est **négatif**, le trinôme n'a **pas de racines réelles** : on ne peut pas le factoriser en produit de binômes à coefficients réels. Sur les **complexes**, on peut factoriser en utilisant les racines (éventuellement complexes) données par la formule **x = (−b ± √Δ) / 2a**.",
  [MATH_EXPLAIN_KINDS.DISCRIMINANT_ZERO]:
    "Si le discriminant **Δ = b² − 4ac** est **nul**, le trinôme a **une racine double** **x₀ = −b / 2a** et se factorise sous la forme **a(x − x₀)²** (ou **(x − x₀)²** si a = 1).",
  [MATH_EXPLAIN_KINDS.DISCRIMINANT_POSITIVE]:
    "Si le discriminant **Δ = b² − 4ac** est **strictement positif**, le trinôme a **deux racines réelles distinctes** ; on peut le factoriser en **a(x − x₁)(x − x₂)** avec **x₁, x₂ = (−b ± √Δ) / 2a**.",
  [MATH_EXPLAIN_KINDS.DISCRIMINANT_GENERAL]:
    "Le **discriminant** d'un trinôme **ax² + bx + c** est **Δ = b² − 4ac**. Il indique le nombre de racines réelles : **Δ > 0** → deux racines réelles, **Δ = 0** → racine double, **Δ < 0** → pas de racine réelle (factorisation réelle impossible).",
  [MATH_EXPLAIN_KINDS.FACTORIZATION_GENERAL]:
    "**Factoriser**, c'est écrire une expression comme **produit de facteurs plus simples**. Pour les **nombres**, on décompose en facteurs premiers ; pour les **polynômes**, on cherche souvent une forme **(x − r₁)(x − r₂)** ou une identité remarquable. Tu veux qu'on parle des **nombres**, des **trinômes**, ou d'un **exemple concret** ?",
});

/**
 * @param {{ kind: string }} task
 * @returns {string|null}
 */
export function buildMathExplainReply(task) {
  if (!task?.kind) return null;
  return CANNED_REPLIES[task.kind] || null;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isMathExplainSatisfiable(query = "") {
  const task = parseMathExplainTask(query);
  if (!task) return false;
  return Boolean(buildMathExplainReply(task));
}

/**
 * @param {string} query
 * @returns {string}
 */
export function buildMathExplainRecoveryMessage(query = "", reason = "empty_output") {
  const canned = resolveMathExplainLocalFallback(query);
  if (canned) return canned;
  const snippet = normalizeMathExplainQuery(query).slice(0, 100);
  return (
    "Je n'ai pas pu finaliser l'explication math pour cette question " +
    `(${reason}). ` +
    (snippet ? `Tu demandais : « ${snippet}${query.length > 100 ? "…" : ""} ». ` : "") +
    "Reformule ou donne un exemple chiffré (trinôme ou équation) si tu veux qu'on calcule ensemble."
  );
}

/**
 * @param {string} query
 * @returns {string}
 */
export function resolveMathExplainLocalFallback(query = "") {
  const task = parseMathExplainTask(query);
  if (!task) return "";
  return buildMathExplainReply(task) || "";
}

/**
 * @param {string} query
 * @returns {{ path: string, kind: string, reply: string, task: object }|null}
 */
export function resolveMathExplainShortCircuit(query = "") {
  const task = parseMathExplainTask(query);
  if (!task) return null;
  const reply = buildMathExplainReply(task);
  if (!reply) return null;

  return {
    path: "math_explain_deterministic",
    kind: task.kind,
    reply,
    task,
  };
}

/**
 * Bypass repeated_fallback_refusal / clarification pour questions math pédagogiques.
 * @param {string} query
 * @returns {string}
 */
export function resolveMathPedagogyBypassReply(query = "") {
  return resolveMathExplainShortCircuit(query)?.reply || "";
}
