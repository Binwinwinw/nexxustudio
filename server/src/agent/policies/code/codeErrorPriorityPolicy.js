/**
 * Priorisation des erreurs code — généralisée à tous les intents code_*.
 * Séquence : compile-time → runtime-critical → logic-error → style-warning.
 */
import {
  classifyCodeIntent,
  isCodeIntentRequest,
  CODE_INTENT_KINDS,
} from "./codeIntentPolicy.js";

export const CODE_ERROR_PRIORITY_CONTRACT_ID = "CODE_ERROR_PRIORITY_V1";

export const ERROR_PRIORITY = Object.freeze([
  {
    level: 1,
    category: "compile-time",
    description: "Bloquant immédiat",
    action: "fix_first",
  },
  {
    level: 2,
    category: "runtime-critical",
    description: "Plante à l'exécution",
    action: "fix_first",
  },
  {
    level: 3,
    category: "logic-error",
    description: "Mauvais résultat",
    action: "fix_when_ready",
  },
  {
    level: 4,
    category: "style-warning",
    description: "PEP8, conventions",
    action: "optional",
  },
]);

const CATEGORY_BY_LEVEL = Object.fromEntries(
  ERROR_PRIORITY.map((row) => [row.category, row.level]),
);

const CATEGORY_INFERENCE_RULES = [
  {
    category: "compile-time",
    patterns: [
      /\bsyntaxe?\b/i,
      /\bsyntax\b/i,
      /\bparse\b/i,
      /\bindentation\b/i,
      /\bpy_compile\b/i,
      /\bne compile pas\b/i,
      /\binvalid syntax\b/i,
      /\bunexpected\b/i,
      /\btexte brut\b/i,
      /\bnon comment[ée]\b/i,
      /\b__name__\b/i,
      /\bif\s+name\b/i,
    ],
  },
  {
    category: "runtime-critical",
    patterns: [
      /\bs'ex[ée]cute pas\b/i,
      /\bruntime\b/i,
      /\bnameerror\b/i,
      /\btypeerror\b/i,
      /\bzerodivision\b/i,
      /\bplante\b/i,
      /\bcrash\b/i,
      /\bexception\b/i,
      /\bbloquant/i,
      /\berreurs?\s+bloquantes?\b/i,
    ],
  },
  {
    category: "logic-error",
    patterns: [
      /\blogique\b/i,
      /\bmauvais r[ée]sultat\b/i,
      /\bcomportement incorrect\b/i,
      /\boff[- ]by[- ]one\b/i,
      /\bboucle infinie\b/i,
      /\bdivision par z[ée]ro\b/i,
      /\bmauvais calcul\b/i,
    ],
  },
  {
    category: "style-warning",
    patterns: [
      /\bpep8\b/i,
      /\bstyle\b/i,
      /\bconvention\b/i,
      /\blisibilit[ée]\b/i,
      /\bnommage\b/i,
      /\bformatage\b/i,
      /\bam[ée]lioration optionnelle\b/i,
    ],
  },
];

const INTENT_PRIORITY_RULES = Object.freeze({
  [CODE_INTENT_KINDS.REVIEW]: {
    mustLeadBlocking: true,
    ordering: "strict",
    leadLabel: "erreurs bloquantes d'abord",
  },
  [CODE_INTENT_KINDS.DEBUG]: {
    mustLeadBlocking: true,
    ordering: "strict",
    leadLabel: "causes racines classées compile → runtime → logique",
  },
  [CODE_INTENT_KINDS.CORRECTION]: {
    mustLeadBlocking: true,
    ordering: "strict",
    leadLabel: "correctif après compile/runtime",
  },
  [CODE_INTENT_KINDS.AUDIT]: {
    mustLeadBlocking: true,
    ordering: "strict",
    leadLabel: "audit par sévérité décroissante",
  },
  [CODE_INTENT_KINDS.REFACTOR]: {
    mustLeadBlocking: false,
    ordering: "soft",
    forbidNewRuntime: true,
    leadLabel: "risques d'exécution avant conventions",
  },
  [CODE_INTENT_KINDS.EXPLAIN]: {
    mustLeadBlocking: false,
    ordering: "soft",
    leadLabel: "si défauts relevés : compile → runtime → logique → style",
  },
});

export function getPriorityLevel(category = "") {
  return CATEGORY_BY_LEVEL[category] ?? 4;
}

export function classifyErrorCategory(message = "") {
  const text = String(message || "");

  // Findings sécurité web / HTML → bloquants (niveau runtime), avant le défaut « logic ».
  if (
    /\b(?:xss|csrf|ssrf|sqli|sql\s*injection|injection\s+(?:html|js|script)|innerhtml|document\.write|eval\s*\(|javascript:\s*|secret(?:s)?\b|api[_-]?key|password\s*[:=]|csp\b|content[- ]security[- ]policy|open\s+redirect|path\s+traversal|rce\b|remote\s+code)\b/i.test(
      text,
    ) ||
    /\bkind\s*:\s*(?:security|critical|high)\b/i.test(text)
  ) {
    return "runtime-critical";
  }

  // Labels explicites CODE_DIAGNOSTIC / listes `kind: …`
  const explicit = text.match(
    /\bkind\s*:\s*(compile-time|compile|runtime-critical|runtime|logic-error|logic|style-warning|style|nit)\b/i,
  );
  if (explicit) {
    const k = explicit[1].toLowerCase();
    if (k === "compile-time" || k === "compile") return "compile-time";
    if (k === "runtime-critical" || k === "runtime") return "runtime-critical";
    if (k === "logic-error" || k === "logic") return "logic-error";
    if (k === "style-warning" || k === "style" || k === "nit") {
      return "style-warning";
    }
  }

  if (
    /\b(syntaxe|indentation|texte brut|structure python|plusieurs instructions|non comment)\b/i.test(
      text,
    ) ||
    (/\binvalide\b/i.test(text) && /\b(fonction|ligne|if\s+name|__name__)\b/i.test(text))
  ) {
    return "compile-time";
  }

  for (const rule of CATEGORY_INFERENCE_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return rule.category;
    }
  }
  return "logic-error";
}

/**
 * @param {Array<{ category?: string, message?: string, [key: string]: unknown }>} errors
 */
export function prioritizeErrors(errors = []) {
  return [...errors]
    .map((err) => {
      const category = err.category || classifyErrorCategory(err.message || "");
      return {
        ...err,
        category,
        priority: getPriorityLevel(category),
      };
    })
    .sort((a, b) => a.priority - b.priority);
}

/**
 * @param {{ errors?: Array<{ category?: string, message?: string, priority?: number }> }} diagnostic
 */
export function mustLeadWithBlockingErrors(diagnostic = {}) {
  const prioritized = prioritizeErrors(diagnostic.errors || []);
  const blocking = prioritized.filter((e) => e.priority <= 2);
  return blocking.length > 0 ? blocking : prioritized;
}

export function usesBlockingFirstSentinels(intentKind = "") {
  return (
    intentKind === CODE_INTENT_KINDS.REVIEW ||
    intentKind === CODE_INTENT_KINDS.DEBUG ||
    intentKind === CODE_INTENT_KINDS.CORRECTION ||
    intentKind === CODE_INTENT_KINDS.AUDIT
  );
}

export function appliesCodeErrorPriorityPolicy(query = "") {
  return isCodeIntentRequest(query);
}

export function resolveCodeErrorPriorityIntent(query = "") {
  const classified = classifyCodeIntent(query);
  return classified?.kind || null;
}

export function getIntentPriorityRules(intentKind = "") {
  return INTENT_PRIORITY_RULES[intentKind] || null;
}

function extractNumberedErrorItems(text = "") {
  const body = String(text || "");
  const items = [];
  const lineRe = /^\s*(\d+)[.)]\s*(.+)$/gm;
  let match;
  while ((match = lineRe.exec(body)) !== null) {
    items.push({
      index: Number.parseInt(match[1], 10),
      message: match[2].trim(),
    });
  }
  return items.sort((a, b) => a.index - b.index);
}

/**
 * Vérifie qu'une liste numérotée respecte compile → runtime → logique → style.
 * Pour CODE_DIAGNOSTIC_V1, passer uniquement le corps ## blockers (pas evidence/patch).
 */
export function evaluateResponseErrorOrdering(text = "", intentKind = "") {
  const rules = getIntentPriorityRules(intentKind);
  if (!rules || rules.ordering === "none") {
    return { pass: true, skipped: true };
  }

  const items = extractNumberedErrorItems(text);
  if (items.length < 2) {
    return { pass: true, skipped: true, reason: "liste trop courte" };
  }

  const classified = items.map((item) => {
    const category = classifyErrorCategory(item.message);
    return {
      ...item,
      category,
      priority: getPriorityLevel(category),
    };
  });

  let maxPriority = 0;
  for (const item of classified) {
    if (item.priority < maxPriority) {
      return {
        pass: false,
        reason:
          `ordre invalide : « ${item.message.slice(0, 60)} » (${item.category}, niveau ${item.priority}) ` +
          `après un niveau ${maxPriority}`,
        items: classified,
      };
    }
    maxPriority = Math.max(maxPriority, item.priority);
  }

  if (rules.mustLeadBlocking) {
    const first = classified[0];
    if (first.priority > 2) {
      return {
        pass: false,
        reason:
          `la liste doit commencer par compile-time ou runtime-critical (premier item : ${first.category})`,
        items: classified,
      };
    }
  }

  return { pass: true, items: classified };
}

const PRIORITY_MODULE_BASE = `
[MODIFICATEUR: PRIORISATION ERREURS — ${CODE_ERROR_PRIORITY_CONTRACT_ID}]
Hiérarchie OBLIGATOIRE pour toute liste de défauts / causes / correctifs :
1. **compile-time** — syntaxe, indentation, texte brut non commenté, import invalide
2. **runtime-critical** — plante à l'exécution, NameError, TypeError, __name__ incorrect
3. **logic-error** — mauvais résultat, flux incorrect, calcul faux
4. **style-warning** — PEP8, conventions, lisibilité (optionnel, en dernier)

RÈGLES :
- Ne jamais ouvrir par le style ou un résumé fonctionnel si des erreurs compile/runtime existent.
- Chaque item listé doit être classifiable (compile / runtime / logique / style).
- Le correctif proposé ne doit pas réintroduire d'erreurs de niveau 1–2.
`.trim();

const INTENT_PRIORITY_SNIPPETS = Object.freeze({
  [CODE_INTENT_KINDS.REVIEW]: `
INTENT code_review : ouvrir par « erreurs bloquantes » puis liste numérotée niveau 1–2 avant tout résumé.`,
  [CODE_INTENT_KINDS.DEBUG]: `
INTENT code_debug : causes racines classées — compile d'abord, puis runtime, puis logique. Pas de « ça devrait marcher » sans preuve.`,
  [CODE_INTENT_KINDS.CORRECTION]: `
INTENT code_correction : corriger compile/runtime avant logique/style. Fournir un fence exécutable seulement après les blocages résolus.`,
  [CODE_INTENT_KINDS.AUDIT]: `
INTENT code_audit : checklist par sévérité — bloquants (1–2) en tête, puis logique, style en fin.`,
  [CODE_INTENT_KINDS.REFACTOR]: `
INTENT code_refactor : ne pas introduire de régression runtime. Signaler les risques d'exécution avant les conventions de style.`,
  [CODE_INTENT_KINDS.EXPLAIN]: `
INTENT code_explain : si tu relèves des défauts, respecte l'ordre compile → runtime → logique → style (sans imposer une correction complète).`,
});

export function buildCodeErrorPriorityAddon(query = "") {
  const intentKind = resolveCodeErrorPriorityIntent(query);
  if (!intentKind) return "";

  const rules = getIntentPriorityRules(intentKind);
  const snippet = INTENT_PRIORITY_SNIPPETS[intentKind] || "";

  return `\n\n${PRIORITY_MODULE_BASE}\n${snippet}\nRègle active : ${rules?.leadLabel || "ordre strict"}.`;
}

export function buildCodeErrorPriorityReaskPrompt(failures = []) {
  const lines = failures
    .map((f) => `- ${f.id}${f.reason ? ` : ${f.reason}` : ""}`)
    .join("\n");

  return `[GARDE-FOU PRIORISATION ERREURS — ${CODE_ERROR_PRIORITY_CONTRACT_ID}]
Ta réponse viole l'ordre compile → runtime → logique → style :
${lines || "- ordre des erreurs non conforme"}

Réécris en respectant STRICTEMENT :
1. compile-time (syntaxe, indentation)
2. runtime-critical (plante à l'exécution)
3. logic-error
4. style-warning (dernier, optionnel)`;
}

export function buildCodeErrorPriorityBlockedMessage(query = "", failures = []) {
  const snippet = String(query || "").slice(0, 100);
  const violationLines = failures.map((f) => `• ${f.reason || f.id}`).join("\n");

  return (
    "Je n'ai pas pu livrer une réponse code conforme à la priorisation des erreurs " +
    `(${CODE_ERROR_PRIORITY_CONTRACT_ID}).\n\n` +
    (snippet ? `Demande : « ${snippet}${query.length > 100 ? "…" : ""} »\n\n` : "") +
    (violationLines ? `Écarts :\n${violationLines}\n\n` : "") +
    "Relancez en demandant explicitement : erreurs bloquantes d'abord, puis correctif."
  );
}

/**
 * Évaluation runtime — ordre des erreurs (intents code_* non bloquants ou complément).
 */
export function evaluateCodeErrorPriorityOrdering({ query = "", response = "" } = {}) {
  const intentKind = resolveCodeErrorPriorityIntent(query);
  if (!intentKind) {
    return { ok: true, skipped: true, failures: [], intentKind: null };
  }

  const orderEval = evaluateResponseErrorOrdering(response, intentKind);
  if (orderEval.pass || orderEval.skipped) {
    return { ok: true, skipped: orderEval.skipped, failures: [], intentKind, orderEval };
  }

  return {
    ok: false,
    skipped: false,
    failures: [{ id: "errorPriorityOrder", reason: orderEval.reason }],
    intentKind,
    orderEval,
  };
}
