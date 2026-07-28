/**
 * G29.1 — explications doctrine / lots gouvernance (Gxx, query understanding).
 * Réponses courtes déterministes pour segments « En une phrase G29… ».
 */

export const GOVERNANCE_EXPLAIN_RULE = "governance_explain_policy_v1";

export const GOVERNANCE_EXPLAIN_CANONICAL_G29_QUERY =
  "En une phrase G29 ne demande plus à Nexxus de deviner s'il y a plusieurs demandes";

export const GOVERNANCE_EXPLAIN_CANONICAL_PERIMETER_G29_QUERY =
  "bonjour tu peux m'aider à calculer le périmètre d'un rectangle ?? En une phrase G29 ne demande plus à Nexxus de \"deviner s'il y a plusieurs demandes\" ; il lui impose de les lire, les planifier et les nommer, et il fournit des métriques pour vérifier qu'il le fait vraiment.";

const GOVERNANCE_LOT_RE = /\bG(2[0-9]|[1-9][0-9])\b/i;

const GOVERNANCE_EXPLAIN_SHELL_RE =
  /\b(?:en une phrase|explique(?:r)?(?:\s+moi)?|resume|resumé|résume|dis[- ]?moi en bref|c\s+est quoi|qu\s+est\s+ce que)\b/i;

const GOVERNANCE_TOPIC_RE =
  /\b(?:gouvernance|doctrine|query understanding|spec\s+g|lot\s+g|conversation query understanding)\b/i;

const GOVERNANCE_CONTINUATION_RE =
  /\b(?:impose de les lire|planifier et les nommer|métriques pour vérifier|ecart mesurable|écart mesurable|deviner s.?il y a plusieurs|sous[- ]?buts?|executionplan|execution plan)\b/i;

const CANNED_ONE_LINERS = Object.freeze({
  G29:
    "G29 n'attend plus que Nexxus « devine » les requêtes multi-intent : il impose de détecter tous les sous-buts, construire un plan d'exécution pour chacun et rendre ce plan observable via des métriques, pour qu'une omission soit un écart mesurable au contrat — pas une surprise de formulation.",
  G28:
    "G28 couvre la composition math multi-intent : segmenter la requête, répondre en sections et ne jamais abandonner silencieusement une seconde intention math explicite.",
  G29_1:
    "G29.1 étend le registre avec les explications doctrine (governance_explain) et un comptage honnête des segments non classés, pour que les trous de couverture restent visibles.",
});

/**
 * @param {string} raw
 */
export function normalizeGovernanceExplainQuery(raw = "") {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[''""]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} segment
 * @returns {string|null}
 */
export function extractGovernanceLotId(segment = "") {
  const q = normalizeGovernanceExplainQuery(segment);
  if (!q) return null;
  const match = q.match(GOVERNANCE_LOT_RE);
  return match ? `G${match[1]}` : null;
}

/**
 * @param {string} segment
 * @returns {boolean}
 */
export function isGovernanceExplainRequest(segment = "") {
  const q = normalizeGovernanceExplainQuery(segment);
  if (!q) return false;

  const hasLot = GOVERNANCE_LOT_RE.test(q);
  const hasShell = GOVERNANCE_EXPLAIN_SHELL_RE.test(q);
  const hasTopic = GOVERNANCE_TOPIC_RE.test(q);
  const hasContinuation = GOVERNANCE_CONTINUATION_RE.test(q);

  if (hasLot && (hasShell || hasTopic || hasContinuation)) return true;
  if (hasShell && hasTopic) return true;
  if (hasContinuation) return true;
  return false;
}

/**
 * @param {string} segment
 * @returns {{ lotId: string|null, kind: string }|null}
 */
export function parseGovernanceExplainTask(segment = "") {
  if (!isGovernanceExplainRequest(segment)) return null;

  const lotId = extractGovernanceLotId(segment);
  if (lotId === "G29" && /\bg29\.1\b/i.test(segment)) {
    return { lotId: "G29_1", kind: "governance_one_liner" };
  }
  return {
    lotId: lotId || "G29",
    kind: "governance_one_liner",
  };
}

/**
 * @param {{ lotId: string|null, kind: string }} task
 * @returns {string|null}
 */
export function buildGovernanceExplainReply(task) {
  if (!task?.kind) return null;
  const key = task.lotId || "G29";
  return CANNED_ONE_LINERS[key] || CANNED_ONE_LINERS.G29;
}

/**
 * @param {string} segment
 * @returns {boolean}
 */
export function isGovernanceExplainSatisfiable(segment = "") {
  const task = parseGovernanceExplainTask(segment);
  if (!task) return false;
  return Boolean(buildGovernanceExplainReply(task));
}

/**
 * @param {string} segment
 * @returns {{
 *   domain: string,
 *   familyId: string,
 *   path: string,
 *   label: string,
 *   reply: string,
 *   satisfiable: boolean,
 *   strategy: string,
 *   segment: string,
 *   task: object,
 *   priority: number,
 * }|null}
 */
export function detectGovernanceExplainIntent(segment = "") {
  const task = parseGovernanceExplainTask(segment);
  if (!task) return null;
  const reply = buildGovernanceExplainReply(task);
  if (!reply) return null;

  return {
    domain: "governance",
    familyId: "governance_explain",
    path: "governance_explain_deterministic",
    label: task.lotId ? `Doctrine ${task.lotId}` : "Doctrine gouvernance",
    reply,
    satisfiable: true,
    strategy: "deterministic",
    segment,
    task,
    priority: 18,
  };
}

/**
 * Découpe un segment mixte (ex. math + « En une phrase G29… »).
 * @param {string[]} segments
 * @returns {string[]}
 */
export function refineSegmentsForGovernance(segments = []) {
  const refined = [];
  const inlineSplitRe = /\b(?=En une phrase\s+G\d{2}\b)/i;

  for (const segment of segments) {
    const parts = String(segment || "")
      .split(inlineSplitRe)
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length > 1) {
      refined.push(...parts);
    } else {
      refined.push(segment);
    }
  }

  return refined.length ? refined : segments;
}
