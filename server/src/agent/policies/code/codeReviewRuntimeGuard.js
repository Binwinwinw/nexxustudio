/**
 * Garde-fou runtime — revue de code post-génération.
 * Sentinelles → reask ciblé (1 retry) → fallback explicite.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  isCodeReviewRequest,
  resolveCodeReviewLanguage,
} from "./codeReviewPolicy.js";
import { evaluateCodeReviewSentinels } from "./codeReviewSentinels.js";
import { extractCodeFences } from "./codeDeliverySentinels.js";
import {
  appliesCodeErrorPriorityPolicy,
  evaluateCodeErrorPriorityOrdering,
  evaluateResponseErrorOrdering,
  buildCodeErrorPriorityBlockedMessage,
} from "./codeErrorPriorityPolicy.js";
import { classifyCodeIntent, requiresBlockingFirstContract } from "./codeIntentPolicy.js";
import {
  derivePythonAnalysisFlags,
  buildCodeReviewSourceText,
} from "./codeReviewRoutingGuard.js";
import {
  evaluateCodeDiagnosticContract,
  buildCodeDiagnosticBlockedMessage,
  CODE_DIAGNOSTIC_CONTRACT_ID,
  hasCodeDiagnosticV1Structure,
} from "./codeDiagnosticContract.js";

export const MAX_CODE_REVIEW_RUNTIME_RETRIES = 1;

/**
 * Scénario dynamique pour les sentinelles (hors fixture golden).
 * Les drapeaux sont dérivés du snippet / pièce jointe — pas de liste calculatrice fixe.
 */
export function buildCodeReviewScenario(query = "", options = {}) {
  const language = resolveCodeReviewLanguage(query);
  const sourceText = buildCodeReviewSourceText(query, options.attachments);
  const flags =
    language === "python" ? derivePythonAnalysisFlags(sourceText) : [];

  return {
    language,
    query,
    analysisMustFlag: flags,
    sentinels: {
      mustFlagCriticalIssues: true,
      mustLeadWithBlockingErrors: true,
      mustNotIntroduceTyposInFix: true,
      mustNotUseGenericFluff: true,
      pythonFenceMustBeValid: true,
    },
  };
}

export function buildCodeReviewReaskPrompt(failures = []) {
  const lines = failures
    .map((f) => `- ${f.id}${f.reason ? ` : ${f.reason}` : ""}`)
    .join("\n");

  return `[GARDE-FOU REVUE DE CODE — RÉPONSE REFUSÉE]
Ta réponse précédente viole le contrat CODE_REVIEW_V1_1 :
${lines || "- structure de revue non conforme"}

Réécris ENTIÈREMENT au format ${CODE_DIAGNOSTIC_CONTRACT_ID} :
## blockers → ## evidence (claim/file/line/proof) → ## patch (diff minimal ou bloc) → ## risks
OU legacy : « Le code ne peut pas s'exécuter tel quel » + « ❌ Erreurs bloquantes détectées ».

Interdit :
- commencer par « Points clés du code », « Fonctions de base », « Interface utilisateur »
- résumer le comportement avant les erreurs bloquantes
- typos dans le code corrigé (choi, operationschoix, if name)

Si tu fournis une correction, le bloc \`\`\`python\`\`\` doit être syntaxiquement valide.`;
}

export function buildCodeReviewBlockedMessage(query = "", failures = []) {
  const snippet = String(query || "").slice(0, 100);
  const violationLines = failures
    .map((f) => `• ${f.reason || f.id}`)
    .join("\n");

  return (
    "Je n'ai pas pu finaliser une revue de code conforme au contrat qualité " +
    "(CODE_REVIEW_V1_1) après plusieurs tentatives.\n\n" +
    (snippet ? `Demande : « ${snippet}${query.length > 100 ? "…" : ""} »\n\n` : "") +
    (violationLines ? `Écarts détectés :\n${violationLines}\n\n` : "") +
    "Relancez l'analyse ou reformulez la demande. " +
    "La réponse doit ouvrir sur les erreurs bloquantes du snippet fourni, pas sur un résumé fonctionnel."
  );
}

/**
 * Valide les fences Python via py_compile si l'interpréteur est disponible.
 */
export function validatePythonFencesWithPyCompile(text = "") {
  const fences = extractCodeFences(text).filter(
    (f) => !f.lang || f.lang === "python" || f.lang === "py",
  );
  if (fences.length === 0) {
    return { pass: true, skipped: true, reason: "aucune fence python" };
  }

  for (const fence of fences) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "citadelle-py-"));
    const tmpFile = path.join(tmpDir, "review_snippet.py");
    try {
      fs.writeFileSync(tmpFile, fence.body, "utf8");
      const result = spawnSync(process.env.PYTHON || "python", ["-m", "py_compile", tmpFile], {
        encoding: "utf8",
        timeout: 8000,
      });
      if (result.error?.code === "ENOENT") {
        return { pass: true, skipped: true, reason: "python indisponible" };
      }
      if (result.status !== 0) {
        const stderr = (result.stderr || result.stdout || "").trim();
        return {
          pass: false,
          reason: `py_compile : ${stderr.slice(0, 240) || "syntaxe invalide"}`,
        };
      }
    } finally {
      try {
        fs.unlinkSync(tmpFile);
        fs.rmdirSync(tmpDir);
      } catch {
        /* ignore */
      }
    }
  }

  return { pass: true };
}

/**
 * Évalue une réponse contre les sentinelles + py_compile optionnel.
 */
export function evaluateCodeReviewRuntime({ query = "", response = "", attachments = [] } = {}) {
  if (!isCodeReviewRequest(query)) {
    return { ok: true, failures: [], skipped: true };
  }

  const scenario = buildCodeReviewScenario(query, { attachments });
  const sentinelEval = evaluateCodeReviewSentinels(response, scenario);
  const failures = [...sentinelEval.failures];

  const pyCompile = validatePythonFencesWithPyCompile(response);
  if (!pyCompile.pass && !pyCompile.skipped) {
    failures.push({ id: "pythonSyntax", reason: pyCompile.reason });
  }

  const classified = classifyCodeIntent(query);
  // CODE_DIAGNOSTIC_V1 : l'ordre est validé sur ## blockers uniquement (évite
  // que les listes numérotées d'evidence/patch faussent errorPriorityOrder).
  if (classified?.kind && !hasCodeDiagnosticV1Structure(response)) {
    const orderEval = evaluateResponseErrorOrdering(response, classified.kind);
    if (!orderEval.pass && !orderEval.skipped) {
      failures.push({ id: "errorPriorityOrder", reason: orderEval.reason });
    }
  }

  const diagnosticEval = evaluateCodeDiagnosticContract({ query, response });
  if (!diagnosticEval.ok && !diagnosticEval.skipped) {
    for (const f of diagnosticEval.failures) {
      failures.push({ id: `diagnostic_${f.id}`, reason: f.reason });
    }
  }

  return {
    ok: failures.length === 0,
    failures,
    scenario,
    pyCompile,
    diagnosticEval,
  };
}

/**
 * Applique le garde-fou : retourne la réponse validée ou les métadonnées de retry/blocage.
 */
/**
 * Filet pipeline — bloque toute livraison non conforme (sans retry LLM).
 * Utiliser sur les chemins qui contournent finalRendererAgent.compose().
 */
export function enforceCodeReviewPipelineDelivery(
  query = "",
  response = "",
  { attachments = [] } = {},
) {
  if (!isCodeReviewRequest(query)) {
    return {
      delivered: String(response || ""),
      action: "passthrough",
      ok: true,
    };
  }

  const evaluation = evaluateCodeReviewRuntime({ query, response, attachments });
  if (evaluation.ok || evaluation.skipped) {
    return {
      delivered: String(response || ""),
      action: "passed",
      ok: true,
    };
  }

  return {
    delivered: buildCodeReviewBlockedMessage(query, evaluation.failures),
    action: "blocked",
    ok: false,
    failures: evaluation.failures,
  };
}

/**
 * Filet pipeline — tous les intents code_* (sentinelles + ordre erreurs).
 */
export function enforceCodeErrorPriorityPipelineDelivery(
  query = "",
  response = "",
  { attachments = [] } = {},
) {
  if (!appliesCodeErrorPriorityPolicy(query)) {
    return {
      delivered: String(response || ""),
      action: "passthrough",
      ok: true,
    };
  }

  if (requiresBlockingFirstContract(query)) {
    return enforceCodeReviewPipelineDelivery(query, response, { attachments });
  }

  const evaluation = evaluateCodeErrorPriorityOrdering({ query, response });
  if (!evaluation.ok && !evaluation.skipped) {
    return {
      delivered: buildCodeErrorPriorityBlockedMessage(query, evaluation.failures),
      action: "blocked",
      ok: false,
      failures: evaluation.failures,
    };
  }

  const diagnosticEval = evaluateCodeDiagnosticContract({ query, response });
  if (!diagnosticEval.ok && !diagnosticEval.skipped) {
    return {
      delivered: buildCodeDiagnosticBlockedMessage(query, diagnosticEval.failures),
      action: "blocked",
      ok: false,
      failures: diagnosticEval.failures,
      contract: CODE_DIAGNOSTIC_CONTRACT_ID,
    };
  }

  return {
    delivered: String(response || ""),
    action: "passed",
    ok: true,
    diagnosticFormat: diagnosticEval.format,
  };
}

export function applyCodeReviewRuntimeGuard({ query = "", response = "" } = {}) {
  const evaluation = evaluateCodeReviewRuntime({ query, response });

  if (evaluation.ok || evaluation.skipped) {
    return {
      ok: true,
      response,
      failures: [],
      shouldRetry: false,
    };
  }

  return {
    ok: false,
    response,
    failures: evaluation.failures,
    shouldRetry: true,
    reaskPrompt: buildCodeReviewReaskPrompt(evaluation.failures),
    blockedMessage: buildCodeReviewBlockedMessage(query, evaluation.failures),
  };
}
