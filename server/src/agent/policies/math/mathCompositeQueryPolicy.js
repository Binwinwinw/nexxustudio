/**
 * G28 — lecture composite des requêtes math avant routage mono-intent.
 * Répond aux trois questions : combien d'intentions ? lesquelles ? comment répondre ?
 */
import {
  parseMathSimpleTask,
  solveMathSimpleTask,
  buildMathSimpleReply,
} from "./mathSimplePolicy.js";
import {
  parseMathRootTask,
  buildMathRootReply,
  isMathRootReplyCoherent,
} from "./mathRootPolicy.js";
import {
  parseMathGeometryTask,
  buildMathGeometryReply,
  isMathGeometryReplyCoherent,
} from "./mathGeometryPolicy.js";
import {
  parseMathPercentTask,
  buildMathPercentReply,
  isMathPercentReplyCoherent,
} from "./mathPercentPolicy.js";
import {
  parseMathExplainTask,
  buildMathExplainReply,
} from "./mathExplainPolicy.js";

export const MATH_COMPOSITE_RULE = "math_composite_query_policy_v1";

/** Cas canonique G28 — racine carrée + nombres premiers. */
export const MATH_COMPOSITE_CANONICAL_ROOT_AND_PRIMES_QUERY =
  "bonjour tu peux m'aider à calculer la racine carré d'un nombre et aussi me donner la liste des nombres premiers";

export const MATH_COMPOSITE_CANONICAL_AREA_AND_PERIMETER_QUERY =
  "calcule l'aire d'un rectangle de 5 sur 3 et aussi son périmètre";

export const MATH_COMPOSITE_RESPONSE_MODES = Object.freeze({
  SEQUENTIAL_ANSWER: "sequential_answer",
  COMPOSITE_ANSWER: "composite_answer",
  PARTIAL_CLARIFY: "partial_clarify",
});

export const MATH_COMPOSITE_FAMILIES = Object.freeze({
  MATH_SIMPLE: "math_simple",
  MATH_ROOT: "math_root",
  MATH_GEOMETRY: "math_geometry",
  MATH_PERCENT: "math_percent",
  MATH_EXPLAIN: "math_explain",
  PRIME_NUMBERS: "prime_numbers",
});

const MATH_COMPOSITE_STRONG_SPLIT_RE =
  /\s*(?:;\s+|\s+et\s+aussi\s+|\s+ainsi\s+que\s+|\s+puis\s+|\s+ensuite\s+|\s+et\s+puis\s+|\s+apres\s+ca\s+|\s+après\s+ça\s+)/i;

const PRIME_SHELL_RE =
  /\b(?:nombres?\s+premiers?|liste\s+(?:des\s+)?nombres?\s+premiers?|premiers?\s+nombres?)\b/i;

const PRIME_BOUND_RE =
  /\b(?:jusqu[a']?\s*(?:a\s+)?|en\s+dessous\s+de\s+|les\s+)(\d+)\s+(?:premiers?|nombres?\s+premiers?)\b|\b(?:jusqu[a']?\s*(?:a\s+)?|en\s+dessous\s+de\s+)(\d+)\b/i;

const SECTION_LABELS = Object.freeze({
  [MATH_COMPOSITE_FAMILIES.MATH_SIMPLE]: "Factorisation",
  [MATH_COMPOSITE_FAMILIES.MATH_ROOT]: "Racine carrée",
  [MATH_COMPOSITE_FAMILIES.MATH_GEOMETRY]: "Géométrie",
  [MATH_COMPOSITE_FAMILIES.MATH_PERCENT]: "Pourcentage",
  [MATH_COMPOSITE_FAMILIES.MATH_EXPLAIN]: "Explication math",
  [MATH_COMPOSITE_FAMILIES.PRIME_NUMBERS]: "Nombres premiers",
});

/**
 * @param {string} raw
 */
export function normalizeMathCompositeQuery(raw = "") {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {number} max
 * @returns {number[]}
 */
function sievePrimesUpTo(max = 30) {
  const limit = Math.max(2, Math.min(Math.floor(max), 500));
  const sieve = new Array(limit + 1).fill(true);
  sieve[0] = sieve[1] = false;
  for (let i = 2; i * i <= limit; i += 1) {
    if (!sieve[i]) continue;
    for (let j = i * i; j <= limit; j += i) sieve[j] = false;
  }
  const primes = [];
  for (let i = 2; i <= limit; i += 1) {
    if (sieve[i]) primes.push(i);
  }
  return primes;
}

/**
 * @param {string} segment
 * @returns {{ kind: string, bound: number|null }|null}
 */
export function extractPrimeNumbersIntent(segment = "") {
  const q = normalizeMathCompositeQuery(segment);
  if (!q || !PRIME_SHELL_RE.test(q)) return null;

  const boundMatch = q.match(PRIME_BOUND_RE);
  const bound = boundMatch ? Number.parseInt(boundMatch[1], 10) : null;

  return {
    kind: bound !== null && Number.isFinite(bound) ? "prime_list_computed" : "prime_list_explain",
    bound: Number.isFinite(bound) ? bound : null,
  };
}

/**
 * @param {{ kind: string, bound: number|null }} task
 * @returns {string|null}
 */
export function buildPrimeNumbersReply(task) {
  if (!task?.kind) return null;

  if (task.kind === "prime_list_computed" && task.bound !== null) {
    const primes = sievePrimesUpTo(task.bound).filter((p) => p <= task.bound);
    return (
      `Les nombres premiers **≤ ${task.bound}** sont : **${primes.join(", ")}** ` +
      `(${primes.length} nombres premiers).`
    );
  }

  const sample = sievePrimesUpTo(30);
  return (
    "Un **nombre premier** est un entier **> 1** divisible seulement par **1** et par lui-même. " +
    `Exemples : **${sample.join(", ")}**. ` +
    "Indique une borne (ex. 50) si tu veux la liste complète jusqu'à ce nombre."
  );
}

/**
 * @param {string} query
 * @returns {string[]}
 */
export function splitMathCompositeSegments(query = "") {
  const raw = String(query || "").trim();
  if (!raw) return [];

  const strongParts = raw
    .split(MATH_COMPOSITE_STRONG_SPLIT_RE)
    .map((part) => part.trim())
    .filter(Boolean);

  if (strongParts.length >= 2) return strongParts;

  const weakParts = raw
    .split(/\s+et\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);

  if (weakParts.length < 2) return [raw];

  const intents = weakParts.map((part) => detectMathIntentInSegment(part));
  const detected = intents.filter(Boolean);
  if (detected.length >= 2) return weakParts;

  return [raw];
}

/**
 * @param {string} family
 * @param {{ kind?: string, operation?: string }} task
 */
function resolveSectionLabel(family, task = {}) {
  if (family === MATH_COMPOSITE_FAMILIES.MATH_GEOMETRY) {
    if (task.operation === "perimeter") return "Périmètre";
    if (task.operation === "area") return "Aire";
    if (task.operation === "circumference") return "Circonférence";
  }
  return SECTION_LABELS[family] || "Math";
}

/**
 * @param {string} segment
 * @returns {{
 *   family: string,
 *   path: string,
 *   label: string,
 *   reply: string|null,
 *   kind: string|null,
 *   segment: string,
 *   task: object|null,
 * }|null}
 */
export function detectMathIntentInSegment(segment = "") {
  const payload = String(segment || "").trim();
  if (!payload) return null;

  const simpleTask = parseMathSimpleTask(payload);
  if (simpleTask) {
    const result = solveMathSimpleTask(simpleTask);
    const reply = result ? buildMathSimpleReply(simpleTask, result) : null;
    if (reply) {
      return {
        family: MATH_COMPOSITE_FAMILIES.MATH_SIMPLE,
        path: "math_simple_deterministic",
        label: resolveSectionLabel(MATH_COMPOSITE_FAMILIES.MATH_SIMPLE, simpleTask),
        reply,
        kind: simpleTask.kind,
        segment: payload,
        task: simpleTask,
      };
    }
  }

  const rootTask = parseMathRootTask(payload);
  if (rootTask) {
    const reply = buildMathRootReply(rootTask);
    if (reply && isMathRootReplyCoherent(payload, reply)) {
      return {
        family: MATH_COMPOSITE_FAMILIES.MATH_ROOT,
        path: "math_root_deterministic",
        label: resolveSectionLabel(MATH_COMPOSITE_FAMILIES.MATH_ROOT, rootTask),
        reply,
        kind: rootTask.kind,
        segment: payload,
        task: rootTask,
      };
    }
  }

  const geometryTask = parseMathGeometryTask(payload);
  if (geometryTask) {
    const reply = buildMathGeometryReply(geometryTask);
    if (reply && isMathGeometryReplyCoherent(payload, reply)) {
      return {
        family: MATH_COMPOSITE_FAMILIES.MATH_GEOMETRY,
        path: "math_geometry_deterministic",
        label: resolveSectionLabel(MATH_COMPOSITE_FAMILIES.MATH_GEOMETRY, geometryTask),
        reply,
        kind: geometryTask.kind,
        segment: payload,
        task: geometryTask,
      };
    }
  }

  const percentTask = parseMathPercentTask(payload);
  if (percentTask) {
    const reply = buildMathPercentReply(percentTask);
    if (reply && isMathPercentReplyCoherent(payload, reply)) {
      return {
        family: MATH_COMPOSITE_FAMILIES.MATH_PERCENT,
        path: "math_percent_deterministic",
        label: resolveSectionLabel(MATH_COMPOSITE_FAMILIES.MATH_PERCENT, percentTask),
        reply,
        kind: percentTask.kind,
        segment: payload,
        task: percentTask,
      };
    }
  }

  const explainTask = parseMathExplainTask(payload);
  if (explainTask) {
    const reply = buildMathExplainReply(explainTask);
    if (reply) {
      return {
        family: MATH_COMPOSITE_FAMILIES.MATH_EXPLAIN,
        path: "math_explain_deterministic",
        label: resolveSectionLabel(MATH_COMPOSITE_FAMILIES.MATH_EXPLAIN, explainTask),
        reply,
        kind: explainTask.kind,
        segment: payload,
        task: explainTask,
      };
    }
  }

  const primeTask = extractPrimeNumbersIntent(payload);
  if (primeTask) {
    const reply = buildPrimeNumbersReply(primeTask);
    if (reply) {
      return {
        family: MATH_COMPOSITE_FAMILIES.PRIME_NUMBERS,
        path: "math_composite_deterministic",
        label: resolveSectionLabel(MATH_COMPOSITE_FAMILIES.PRIME_NUMBERS, primeTask),
        reply,
        kind: primeTask.kind,
        segment: payload,
        task: primeTask,
      };
    }
  }

  return null;
}

/**
 * @param {string} query
 * @returns {{
 *   intentCount: number,
 *   intents: ReturnType<typeof detectMathIntentInSegment>[],
 *   segments: string[],
 * }}
 */
export function detectQueryMathIntents(query = "") {
  const segments = splitMathCompositeSegments(query);
  const intents = [];
  /** @type {{ shape: string, length: number, width: number, unit: string|null }|null} */
  let geometryCarryover = null;

  for (const segment of segments) {
    let payload = segment;
    if (
      geometryCarryover &&
      /\b(?:son|sa|leur|meme|même)\s+(?:perimetre|périmètre|aire)\b/i.test(segment)
    ) {
      const unitSuffix = geometryCarryover.unit ? ` ${geometryCarryover.unit}` : "";
      payload =
        `rectangle ${segment} de ${geometryCarryover.length}${unitSuffix} sur ` +
        `${geometryCarryover.width}${unitSuffix}`;
    }

    const intent = detectMathIntentInSegment(payload);
    if (!intent) continue;

    intents.push({ ...intent, segment });

    if (
      intent.family === MATH_COMPOSITE_FAMILIES.MATH_GEOMETRY &&
      intent.task?.shape === "rectangle" &&
      intent.task?.dimensions?.length != null &&
      intent.task?.dimensions?.width != null
    ) {
      geometryCarryover = {
        shape: "rectangle",
        length: intent.task.dimensions.length,
        width: intent.task.dimensions.width,
        unit: intent.task.dimensions.unit || null,
      };
    }
  }

  return {
    intentCount: intents.length,
    intents,
    segments,
  };
}

/**
 * @param {string} query
 * @returns {{
 *   intentCount: number,
 *   intents: ReturnType<typeof detectMathIntentInSegment>[],
 *   segments: string[],
 *   responseMode: string,
 *   satisfiableCount: number,
 *   droppedIntentCount: number,
 * }}
 */
export function buildMathCompositeResponsePlan(query = "") {
  const { intentCount, intents, segments } = detectQueryMathIntents(query);
  const satisfiable = intents.filter((intent) => Boolean(intent.reply));
  const droppedIntentCount = Math.max(0, segments.length - intents.length);

  let responseMode = MATH_COMPOSITE_RESPONSE_MODES.SEQUENTIAL_ANSWER;
  if (intentCount >= 2 && satisfiable.length < intentCount) {
    responseMode = MATH_COMPOSITE_RESPONSE_MODES.PARTIAL_CLARIFY;
  } else if (intentCount >= 2 && satisfiable.length >= 2) {
    responseMode = MATH_COMPOSITE_RESPONSE_MODES.SEQUENTIAL_ANSWER;
  }

  return {
    intentCount,
    intents,
    segments,
    responseMode,
    satisfiableCount: satisfiable.length,
    droppedIntentCount,
  };
}

/**
 * @param {ReturnType<typeof buildMathCompositeResponsePlan>} plan
 * @returns {string|null}
 */
export function buildMathCompositeReply(plan) {
  if (!plan?.intents?.length || plan.intentCount < 2) return null;

  const lines = [];
  for (const intent of plan.intents) {
    if (intent.reply) {
      lines.push(`**${intent.label} :** ${intent.reply}`);
      continue;
    }
    lines.push(
      `**${intent.label} :** Je repère cette sous-demande, mais il me manque un élément pour y répondre précisément.`,
    );
  }

  if (plan.droppedIntentCount > 0) {
    lines.push(
      "*(Une partie de ta requête n'a pas été rattachée à une intention math explicite — précise-la si besoin.)*",
    );
  }

  const reply = lines.filter(Boolean).join("\n\n").trim();
  return reply || null;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isMathCompositeRequest(query = "") {
  return buildMathCompositeResponsePlan(query).intentCount >= 2;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isMathCompositeSatisfiable(query = "") {
  const plan = buildMathCompositeResponsePlan(query);
  return plan.intentCount >= 2 && plan.satisfiableCount >= 2;
}

/**
 * @param {string} query
 * @returns {{ path: string, reply: string, plan: ReturnType<typeof buildMathCompositeResponsePlan> }|null}
 */
export function resolveMathCompositeShortCircuit(query = "") {
  const plan = buildMathCompositeResponsePlan(query);
  if (!isMathCompositeSatisfiable(query)) return null;

  const reply = buildMathCompositeReply(plan);
  if (!reply) return null;

  return {
    path: "math_composite_deterministic",
    reply,
    plan,
  };
}
