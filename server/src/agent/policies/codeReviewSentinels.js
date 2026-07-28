/**
 * Sentinelles — revue / analyse critique de code.
 */
import { extractCodeFences } from "./codeDeliverySentinels.js";

export const CODE_REVIEW_SENTINEL_IDS = Object.freeze({
  MUST_FLAG_CRITICAL_ISSUES: "mustFlagCriticalIssues",
  MUST_LEAD_WITH_BLOCKING_ERRORS: "mustLeadWithBlockingErrors",
  MUST_NOT_INTRODUCE_TYPOS_IN_FIX: "mustNotIntroduceTyposInFix",
  MUST_NOT_USE_GENERIC_FLUFF: "mustNotUseGenericFluff",
  PYTHON_FENCE_MUST_BE_VALID: "pythonFenceMustBeValid",
});

const BLOCKING_LEAD_PATTERNS = [
  /erreurs?\s+bloquantes?/i,
  /ne peut pas s['']exécuter/i,
  /ne peut pas s executer/i,
  /n['']est pas exécutable/i,
  /n est pas executable/i,
  /syntaxe invalide/i,
  /code ne peut pas/i,
  /❌/,
  /bloquant/i,
  /^#{1,3}\s*blockers\b/im,
  /^#{1,3}\s*blocants?\b/im,
];

const FUNCTIONAL_SUMMARY_PATTERNS = [
  /points clés/i,
  /fonctions de base/i,
  /ce que (fait|fait votre|fait le)/i,
  /comportement (attendu|du script|général)/i,
  /résumé (fonctionnel|du code)/i,
  /l['']objectif (du code|est)/i,
  /ce script (permet|fait|vise)/i,
  /interface utilisateur/i,
  /gestion des entrées/i,
  /exécution principale/i,
  /structure du code/i,
];

const GENERIC_FLUFF_PATTERNS = [
  /\bresponsive\b/i,
  /\bperformances?\b.*\b(web|navigateur|frontend)\b/i,
  /\baccessibilit[eé]\b.*\bcalculateur\b/i,
];

const PYTHON_TYPO_PATTERNS = [
  { pattern: /\bif\s+choi\b/, reason: "typo choi au lieu de choix" },
  { pattern: /operations\s*choix|operationschoix/i, reason: "typo operations[choix]" },
  { pattern: /\bif\s+name\s*==\s*["']main["']/i, reason: "if name au lieu de __name__" },
];

const DEFAULT_REVIEW_SENTINELS = {
  [CODE_REVIEW_SENTINEL_IDS.MUST_FLAG_CRITICAL_ISSUES]: true,
  [CODE_REVIEW_SENTINEL_IDS.MUST_LEAD_WITH_BLOCKING_ERRORS]: true,
  [CODE_REVIEW_SENTINEL_IDS.MUST_NOT_INTRODUCE_TYPOS_IN_FIX]: true,
  [CODE_REVIEW_SENTINEL_IDS.MUST_NOT_USE_GENERIC_FLUFF]: true,
  [CODE_REVIEW_SENTINEL_IDS.PYTHON_FENCE_MUST_BE_VALID]: true,
};

export function resolveCodeReviewSentinelConfig(scenario = {}) {
  return { ...DEFAULT_REVIEW_SENTINELS, ...(scenario.sentinels || {}) };
}

function findFirstMatchIndex(text, patterns) {
  let earliest = -1;
  for (const pattern of patterns) {
    const match = text.search(pattern);
    if (match >= 0 && (earliest < 0 || match < earliest)) {
      earliest = match;
    }
  }
  return earliest;
}

/**
 * Zone critique = tout le texte avant le premier résumé fonctionnel.
 */
export function getCriticalAnalysisZone(text = "") {
  const body = String(text || "");
  const functionalAt = findFirstMatchIndex(body, FUNCTIONAL_SUMMARY_PATTERNS);
  if (functionalAt < 0) return body;
  return body.slice(0, functionalAt);
}

/**
 * La réponse doit ouvrir sur l'non-exécutabilité, pas sur un résumé fonctionnel.
 */
export function mustLeadWithBlockingErrors(text = "") {
  const body = String(text || "").trim();
  if (!body) return { pass: false, reason: "réponse vide" };

  const head = body.slice(0, 600);
  const hasBlockingLead = BLOCKING_LEAD_PATTERNS.some((p) => p.test(head));
  if (!hasBlockingLead) {
    return {
      pass: false,
      reason:
        "la réponse doit commencer par « erreurs bloquantes » / « ne peut pas s'exécuter » / ❌",
    };
  }

  const firstFunctional = findFirstMatchIndex(body, FUNCTIONAL_SUMMARY_PATTERNS);
  const firstBlocking = findFirstMatchIndex(body, BLOCKING_LEAD_PATTERNS);

  if (firstFunctional >= 0 && firstBlocking >= 0 && firstFunctional < firstBlocking) {
    return {
      pass: false,
      reason: "résumé fonctionnel (« Points clés », etc.) placé avant les erreurs bloquantes",
    };
  }

  if (/^points clés/i.test(body)) {
    return {
      pass: false,
      reason: "interdit : commencer par « Points clés du code »",
    };
  }

  return { pass: true };
}

/**
 * Vérifie que les erreurs critiques sont mentionnées dans la zone critique (avant résumé).
 */
export function mustFlagCriticalIssues(text = "", scenario = {}) {
  const body = String(text || "");
  const required = scenario.analysisMustFlag || [];
  const criticalZone = getCriticalAnalysisZone(body);

  const missing = required.filter((flag) => {
    const re = typeof flag === "string" ? new RegExp(flag, "i") : flag;
    return !re.test(criticalZone);
  });

  if (missing.length > 0) {
    return {
      pass: false,
      reason: `erreurs critiques absentes de la zone prioritaire: ${missing.map(String).join(", ")}`,
    };
  }

  const leadCheck = mustLeadWithBlockingErrors(body);
  if (!leadCheck.pass) {
    return leadCheck;
  }

  return { pass: true };
}

export function mustNotIntroduceTyposInFix(text = "", language = "python") {
  if (language !== "python") return { pass: true, skipped: true };

  const fences = extractCodeFences(text).filter(
    (f) => !f.lang || f.lang === "python" || f.lang === "py",
  );
  // Ne scanner que les fences python du correctif — pas la prose evidence (if name cité en preuve).
  if (fences.length === 0) {
    return { pass: true, skipped: true, reason: "aucune fence python dans le patch" };
  }
  const bodies = fences.map((f) => f.body);

  for (const body of bodies) {
    for (const { pattern, reason } of PYTHON_TYPO_PATTERNS) {
      if (pattern.test(body)) {
        return { pass: false, reason: `fence python: ${reason}` };
      }
    }
  }
  return { pass: true };
}

export function mustNotUseGenericFluff(text = "") {
  const body = String(text || "");
  const hits = GENERIC_FLUFF_PATTERNS.filter((re) => re.test(body));
  if (hits.length > 0) {
    return { pass: false, reason: "justification générique hors sujet (responsive/perf web)" };
  }
  return { pass: true };
}

export function validatePythonFences(text = "") {
  const fences = extractCodeFences(text).filter(
    (f) => !f.lang || f.lang === "python" || f.lang === "py",
  );
  if (fences.length === 0) return { pass: true, skipped: true };

  for (const fence of fences) {
    const typo = mustNotIntroduceTyposInFix(fence.body, "python");
    if (!typo.pass) return typo;

    const lines = fence.body.split("\n");
    for (const line of lines) {
      if (!line.trim() || line.trim().startsWith("#")) continue;
      const stripped = line.trimEnd();
      if (/:\s*$/.test(stripped) && /;/.test(stripped.replace(/".*?"|'.*?'/g, ""))) {
        return {
          pass: false,
          reason: "instruction multiple invalide sur une ligne (point-virgule après :)",
        };
      }
    }
  }

  return { pass: true };
}

const REVIEW_EVALUATORS = {
  [CODE_REVIEW_SENTINEL_IDS.MUST_FLAG_CRITICAL_ISSUES]: (text, scenario) =>
    mustFlagCriticalIssues(text, scenario),
  [CODE_REVIEW_SENTINEL_IDS.MUST_LEAD_WITH_BLOCKING_ERRORS]: (text) =>
    mustLeadWithBlockingErrors(text),
  [CODE_REVIEW_SENTINEL_IDS.MUST_NOT_INTRODUCE_TYPOS_IN_FIX]: (text, scenario) =>
    mustNotIntroduceTyposInFix(text, scenario.language),
  [CODE_REVIEW_SENTINEL_IDS.MUST_NOT_USE_GENERIC_FLUFF]: (text) => mustNotUseGenericFluff(text),
  [CODE_REVIEW_SENTINEL_IDS.PYTHON_FENCE_MUST_BE_VALID]: (text) => validatePythonFences(text),
};

export function evaluateCodeReviewSentinels(text = "", scenario = {}) {
  const config = resolveCodeReviewSentinelConfig(scenario);
  const results = {};

  for (const [id, enabled] of Object.entries(config)) {
    if (!enabled) continue;
    const evaluator = REVIEW_EVALUATORS[id];
    if (!evaluator) continue;
    results[id] = evaluator(text, scenario);
  }

  const failures = Object.entries(results).filter(([, r]) => r.pass === false);
  return {
    pass: failures.length === 0,
    results,
    failures: failures.map(([id, r]) => ({ id, reason: r.reason })),
  };
}
