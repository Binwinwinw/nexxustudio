/**
 * Rubriques comportementales — livraison code (sentinel checks).
 * Utilisées en régression golden et évaluables sur sorties LLM live.
 */
import {
  isGenericReadyGreeting,
  isSubstantiveWorkRequest,
} from "../../utils/genericGreetingGuards.js";

export const SENTINEL_IDS = Object.freeze({
  MUST_NOT_BE_GREETING: "mustNotBeGreeting",
  MUST_DELIVER_CODE: "mustDeliverCode",
  MUST_RESPECT_REQUESTED_LANGUAGE: "mustRespectRequestedLanguage",
  MUST_NOT_ASK_CLARIFICATION: "mustNotAskClarificationWhenSpecSufficient",
  MUST_INCLUDE_MULTI_FILE: "mustIncludeMultiFileStructure",
});

const GREETING_PATTERNS = [
  /tout est pr[eé]t/i,
  /sur quoi travaillons/i,
  /comment puis-je vous aider/i,
  /en quoi puis-je/i,
  /que souhaitez-vous/i,
  /par o[uù] commen[cç]ons/i,
];

const CLARIFICATION_PATTERNS = [
  /peux-tu pr[eé]ciser/i,
  /pouvez-vous pr[eé]ciser/i,
  /il me manque/i,
  /il manque des infos/i,
  /manque des informations/i,
  /pourriez-vous me dire/i,
  /quelle(s)? (longueur|langage|framework|version)/i,
  /pr[eé]f[eè]rez-vous/i,
  /souhaitez-vous que je/i,
  /avez-vous une pr[eé]f[eé]rence/i,
  /besoin de plus de d[eé]tails/i,
  /donnez-moi plus de contexte/i,
];

const PSEUDO_CODE_PATTERNS = [
  /ton code ici/i,
  /\bTODO\b.*\bimpl[eé]menter/i,
  /pseudo-?code/i,
  /\/\/ \.\.\./,
  /# \.\.\./,
  /\{\s*\.\.\.\s*\}/,
];

const LANGUAGE_FENCE = {
  php: ["php"],
  javascript_node: ["javascript", "js"],
  javascript_browser: ["javascript", "js"],
  html: ["html"],
  css: ["css"],
  jsx: ["jsx", "javascript", "js"],
  python: ["python", "py"],
};

const LANGUAGE_CONTENT_SIGNALS = {
  php: [/<\?php/i, /htmlspecialchars\s*\(/i, /\bPDO\b/],
  javascript_node: [/\brequire\s*\(/i, /\bmodule\.exports\b/i, /\bprocess\./i, /\basync\s+function\b/i],
  javascript_browser: [/document\.addEventListener/i, /\bDOMContentLoaded\b/i, /\bwindow\./i],
  html: [/<!DOCTYPE\s+html/i, /<html[\s>]/i, /<main[\s>]/i],
  css: [/@media\b/i, /\.[\w-]+\s*\{/, /display:\s*(flex|grid)/i],
  jsx: [/import\s+React/i, /\buseState\s*\(/i, /export\s+default\b/i, /<\w+[^>]*>/],
  python: [/def\s+\w+\s*\(/i, /if\s+__name__\s*==\s*['"]__main__['"]/i, /import\s+\w+/i],
};

const DEFAULT_SENTINELS = {
  [SENTINEL_IDS.MUST_NOT_BE_GREETING]: true,
  [SENTINEL_IDS.MUST_DELIVER_CODE]: true,
  [SENTINEL_IDS.MUST_RESPECT_REQUESTED_LANGUAGE]: true,
  [SENTINEL_IDS.MUST_NOT_ASK_CLARIFICATION]: true,
  [SENTINEL_IDS.MUST_INCLUDE_MULTI_FILE]: false,
};

export function resolveSentinelConfig(scenario = {}) {
  const base = { ...DEFAULT_SENTINELS };
  if (scenario.expectsMultiFile) {
    base[SENTINEL_IDS.MUST_INCLUDE_MULTI_FILE] = true;
  }
  return { ...base, ...(scenario.sentinels || {}) };
}

export function extractCodeFences(text = "") {
  const body = String(text || "");
  const fences = [];
  const re = /```(\w+)?[^\n]*\n([\s\S]*?)```/gi;
  let match;
  while ((match = re.exec(body)) !== null) {
    fences.push({
      lang: (match[1] || "").toLowerCase(),
      body: match[2].trim(),
    });
  }
  return fences;
}

export function mustNotBeGreeting(text = "") {
  const body = String(text || "").trim();
  if (!body) {
    return { pass: false, reason: "réponse vide" };
  }
  if (isGenericReadyGreeting(body)) {
    return { pass: false, reason: "salutation générique NEXXUS détectée" };
  }
  for (const pattern of GREETING_PATTERNS) {
    if (pattern.test(body) && body.length < 280) {
      return { pass: false, reason: `accueil générique: ${pattern}` };
    }
  }
  return { pass: true };
}

export function mustDeliverCode(text = "", language = null) {
  const body = String(text || "");
  const fences = extractCodeFences(body);

  if (fences.length === 0) {
    return { pass: false, reason: "aucun bloc de code fenced" };
  }

  const substantial = fences.filter((f) => f.body.length >= 40);
  if (substantial.length === 0) {
    return { pass: false, reason: "blocs de code trop courts ou vides" };
  }

  for (const pattern of PSEUDO_CODE_PATTERNS) {
    if (pattern.test(body)) {
      return { pass: false, reason: `pseudo-code détecté: ${pattern}` };
    }
  }

  return { pass: true, fenceCount: fences.length };
}

export function mustRespectRequestedLanguage(text = "", language = "") {
  if (!language) return { pass: true, skipped: true };

  const body = String(text || "");
  const fences = extractCodeFences(body);
  const allowedFences = LANGUAGE_FENCE[language] || [language];
  const contentSignals = LANGUAGE_CONTENT_SIGNALS[language] || [];

  const fenceLangOk = fences.some((f) => !f.lang || allowedFences.includes(f.lang));
  const contentOk = contentSignals.some((re) => re.test(body));

  if (fenceLangOk || contentOk) {
    return { pass: true };
  }

  return {
    pass: false,
    reason: `langage attendu « ${language} » non détecté dans les blocs ou le contenu`,
  };
}

export function mustNotAskClarificationWhenSpecSufficient(text = "", query = "") {
  const body = String(text || "");
  if (!isSubstantiveWorkRequest(query)) {
    return { pass: true, skipped: true };
  }

  const clarificationHits = CLARIFICATION_PATTERNS.filter((re) => re.test(body));
  if (clarificationHits.length === 0) {
    return { pass: true };
  }

  const deliversCode = extractCodeFences(body).some((f) => f.body.length >= 40);
  if (deliversCode) {
    return { pass: true, note: "clarification tolérée car code livré" };
  }

  return {
    pass: false,
    reason: "demande de clarification sans livrable alors que la spec est suffisante",
  };
}

export function mustIncludeMultiFileStructure(text = "") {
  const body = String(text || "");
  const fileMarkers = (body.match(/📁\s*[\w.-]+\.(html|css|js|jsx|php|py)/gi) || []).length;
  const pathHints = (body.match(/\b[\w.-]+\.(html|css|js|jsx|php|py)\b/gi) || []).length;
  const fenceCount = extractCodeFences(body).length;

  if (fileMarkers >= 2 || (pathHints >= 3 && fenceCount >= 2)) {
    return { pass: true };
  }

  return {
    pass: false,
    reason: "structure multi-fichiers absente (📁 ou plusieurs fences nommés)",
  };
}

const EVALUATORS = {
  [SENTINEL_IDS.MUST_NOT_BE_GREETING]: (text) => mustNotBeGreeting(text),
  [SENTINEL_IDS.MUST_DELIVER_CODE]: (text, scenario) =>
    mustDeliverCode(text, scenario.language),
  [SENTINEL_IDS.MUST_RESPECT_REQUESTED_LANGUAGE]: (text, scenario) =>
    mustRespectRequestedLanguage(text, scenario.language),
  [SENTINEL_IDS.MUST_NOT_ASK_CLARIFICATION]: (text, scenario) =>
    mustNotAskClarificationWhenSpecSufficient(text, scenario.query),
  [SENTINEL_IDS.MUST_INCLUDE_MULTI_FILE]: (text) => mustIncludeMultiFileStructure(text),
};

/**
 * Évalue toutes les sentinelles actives pour un scénario golden.
 * @returns {{ pass: boolean, results: Record<string, { pass: boolean, reason?: string }> }}
 */
export function evaluateCodeDeliverySentinels(text = "", scenario = {}) {
  const config = resolveSentinelConfig(scenario);
  const results = {};

  for (const [id, enabled] of Object.entries(config)) {
    if (!enabled) continue;
    const evaluator = EVALUATORS[id];
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
