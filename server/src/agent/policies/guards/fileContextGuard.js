/**
 * Garde-fou anti-hallucination fichier — grounding strict sur sources disponibles.
 *
 * Précédence (P1.1) :
 * réponse métier utile ancrée sur PJ > soft-guard.
 * Si hasConcreteAttachmentAnswer → append_only / no_op, jamais remplacement destructif.
 */
import path from "node:path";
import {
  isCodeIntentRequest,
  hasCodeContext,
  hasExecutableSnippet,
} from "../codeIntentPolicy.js";
import {
  classifyAttachmentTask,
  isCodeAttachmentTask,
  isDocumentAttachmentTask,
} from "../attachment/index.js";

export const INLINE_CONTEXT_LABEL = "snippet fourni dans la requête";

export const GUARD_MODES = Object.freeze({
  PASS: "pass",
  REPLACE: "replace",
  APPEND_ONLY: "append_only",
  NO_OP: "no_op",
  INCAPACITY: "incapacity",
});

const FILE_EXT_PATTERN =
  /\.(py|js|jsx|ts|tsx|mjs|cjs|php|html|htm|css|scss|json|md|txt|docx?|rtf|sh|bash|yml|yaml|xml|sql|java|go|rs|rb|vue|svelte)\b/i;

const PATH_LIKE_PATTERN =
  /(?:^|[\s("'`])([\w./\\-]+\.(?:py|js|jsx|ts|tsx|mjs|cjs|php|html|htm|css|scss|json|md|txt|docx?|rtf|sh|bash|yml|yaml|xml|sql|java|go|rs|rb|vue|svelte))(?:\b|[\s"'`,:;])/gi;

const FICHIER_PATTERN =
  /\b(?:fichier|file|module|script)\s+[`"']?([\w./\\-]+\.(?:py|js|jsx|ts|tsx|mjs|cjs|php|html|htm|css|scss|json|md|txt|docx?|rtf|sh|bash|yml|yaml|xml|sql|java|go|rs|rb|vue|svelte))[`"']?/gi;

const INCAPACITY_RESPONSE_RE =
  /\[DOC(?:X)?\s*[—\-–]|extraction indisponible|format \.doc \(binaire legacy\) non support[eé]|Impossible de lire ce Word|non support[eé] pour l['']extraction/i;

function normalizeFileKey(name = "") {
  return String(name).trim().toLowerCase().replace(/\\/g, "/");
}

function basenameOf(filePath = "") {
  const normalized = String(filePath).replace(/\\/g, "/");
  return path.posix.basename(normalized);
}

/**
 * Évite les faux positifs (`.ts`, `*.js`) — il faut un stem réel.
 * @param {string} filePath
 */
export function isPlausibleFileBasename(filePath = "") {
  const base = basenameOf(filePath);
  const m = String(base).match(/^(.+)\.([a-z0-9]+)$/i);
  if (!m) return false;
  const stem = m[1].replace(/^\.+/, "").replace(/[*?]+/g, "");
  return stem.length >= 2 && /[a-z0-9]/i.test(stem);
}

/**
 * @param {string} text
 * @returns {string[]}
 */
export function extractFilePathsFromText(text = "") {
  const found = new Set();
  const source = String(text || "");

  for (const match of source.matchAll(PATH_LIKE_PATTERN)) {
    const candidate = match[1];
    if (candidate && FILE_EXT_PATTERN.test(candidate) && isPlausibleFileBasename(candidate)) {
      found.add(basenameOf(candidate));
    }
  }

  for (const match of source.matchAll(FICHIER_PATTERN)) {
    const candidate = match[1];
    if (candidate && isPlausibleFileBasename(candidate)) {
      found.add(basenameOf(candidate));
    }
  }

  return [...found];
}

/**
 * @param {{
 *   query?: string,
 *   attachments?: Array<{ originalname?: string, name?: string }>,
 *   attachmentRefs?: Array<{ name?: string }>,
 *   extraFiles?: string[],
 * }} input
 */
export function buildFileContextInventory(input = {}) {
  const { query = "", attachments = [], attachmentRefs = [], extraFiles = [] } =
    input;

  const files = new Map();

  const register = (rawName, source) => {
    const base = basenameOf(rawName);
    if (!base || !FILE_EXT_PATTERN.test(base)) return;
    const key = normalizeFileKey(base);
    if (!files.has(key)) {
      files.set(key, { id: base, source, path: String(rawName).replace(/\\/g, "/") });
    }
  };

  for (const att of attachments) {
    register(att?.originalname || att?.name, "attachment");
  }
  for (const ref of attachmentRefs) {
    register(ref?.name, "attachment_ref");
  }
  for (const name of extraFiles) {
    register(name, "explicit");
  }
  for (const mentioned of extractFilePathsFromText(query)) {
    register(mentioned, "query_mention");
  }

  const hasInlineCode =
    hasCodeContext(query) || hasExecutableSnippet(query) || /\bdef\s+\w+/.test(query);

  return {
    files: [...files.values()],
    knownKeys: new Set([...files.keys()]),
    hasInlineCode,
    allowGenericReferences: hasInlineCode || files.size > 0,
    inlineContextLabel: INLINE_CONTEXT_LABEL,
  };
}

/**
 * @param {string} response
 * @param {ReturnType<typeof buildFileContextInventory>} inventory
 */
export function findHallucinatedFileReferences(response = "", inventory = {}) {
  const cited = extractFilePathsFromText(response);
  const knownKeys = inventory.knownKeys || new Set();
  const hallucinated = [];

  for (const basename of cited) {
    const key = normalizeFileKey(basename);
    if (knownKeys.has(key)) continue;
    hallucinated.push({
      file: basename,
      reason: "not_in_context_inventory",
    });
  }

  return hallucinated;
}

export function buildMissingFileClarification(hallucinated = [], inventory = {}) {
  const files = hallucinated.map((h) => `**${h.file}**`).join(", ");
  const knownList =
    inventory.files?.length > 0
      ? inventory.files.map((f) => f.id).join(", ")
      : inventory.hasInlineCode
        ? INLINE_CONTEXT_LABEL
        : "aucune source fichier";

  return (
    "Je ne peux pas affirmer l'existence ou le contenu de fichiers non fournis dans le contexte.\n\n" +
    `Références non vérifiables : ${files}.\n` +
    `Sources disponibles pour ce tour : ${knownList}.\n\n` +
    "Merci de joindre le fichier manquant ou de coller l'extrait pertinent (avec chemin si utile)."
  );
}

/**
 * Note courte — ne remplace pas une analyse déjà concrète.
 * @param {Array<{ file: string }>} hallucinated
 * @param {ReturnType<typeof buildFileContextInventory>} inventory
 */
export function buildUnverifiedRefsNote(hallucinated = [], inventory = {}) {
  const files = hallucinated.map((h) => h.file).filter(Boolean);
  if (!files.length) return "";
  const knownList =
    inventory.files?.length > 0
      ? inventory.files.map((f) => f.id).join(", ")
      : inventory.hasInlineCode
        ? INLINE_CONTEXT_LABEL
        : "aucune";
  return (
    `\n\n---\n` +
    `Note : références hors pièces jointes de ce tour (${files.join(", ")}) — ` +
    `je ne peux pas en garantir le contenu. Source(s) jointe(s) : ${knownList}.`
  );
}

/**
 * Réponse déjà utile (analyse, fix, refactor, résumé…) ancrée sur une source connue.
 * @param {string} response
 * @param {ReturnType<typeof buildFileContextInventory>} inventory
 */
export function isConcreteGroundedResponse(response = "", inventory = {}) {
  const text = String(response || "").trim();
  if (text.length < 220) return false;
  if (/je ne peux pas affirmer l'existence/i.test(text)) return false;
  if (INCAPACITY_RESPONSE_RE.test(text) && text.length < 400) return false;

  const knownFiles = inventory.files || [];
  const mentionsKnown = knownFiles.some((f) => {
    const id = String(f.id || "").trim();
    if (!id) return false;
    return new RegExp(
      `\\b${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "i",
    ).test(text);
  });

  const lineCount = text.split(/\n/).filter((l) => l.trim()).length;
  const analysisShape =
    /(?:analyse|points?\s+cl[eé]s|am[eé]lior|proposition|recommand|contenu|structure|objectifs?)/i.test(
      text,
    ) && lineCount >= 4;
  const summaryShape =
    /(?:r[eé]sum[eé]|synth[eè]se|points?\s+cl[eé]s|essentiel|en\s+bref)/i.test(
      text,
    ) && lineCount >= 3;
  const fixShape =
    (/```/.test(text) ||
      /(?:version corrig[eé]e|correctif|diff\b|patch\b|corrig[eé]|fix(?:e|er)?)/i.test(
        text,
      )) &&
    lineCount >= 3;
  const refactorShape =
    /(?:refactor|restructur|sans changer le comportement|clean\s+code|avant\s*\/\s*apr[eè]s)/i.test(
      text,
    ) && lineCount >= 3;

  const deliverableShape =
    analysisShape || summaryShape || fixShape || refactorShape;

  if (knownFiles.length > 0 && mentionsKnown && text.length >= 220) return true;
  if (knownFiles.length > 0 && deliverableShape && text.length >= 320) return true;
  if (inventory.hasInlineCode && deliverableShape && text.length >= 280) return true;
  return false;
}

/**
 * Signal unique de fin de pipeline — précédence métier vs guard.
 * @param {{
 *   query?: string,
 *   response?: string,
 *   attachments?: object[],
 *   attachmentRefs?: object[],
 *   inventory?: ReturnType<typeof buildFileContextInventory>|null,
 *   attachmentTask?: string|null,
 *   sourceBacked?: boolean|null,
 * }} input
 */
export function buildAttachmentResponseState(input = {}) {
  const {
    query = "",
    response = "",
    attachments = [],
    attachmentRefs = [],
    attachmentTask = null,
    sourceBacked: sourceBackedHint = null,
  } = input;

  const inventory =
    input.inventory ||
    buildFileContextInventory({
      query,
      attachments,
      attachmentRefs,
    });

  const taskHit =
    attachmentTask ||
    classifyAttachmentTask(query, attachments)?.task ||
    null;
  const taskResolved = Boolean(taskHit);

  const hasAttachmentSource =
    (inventory.files?.length || 0) > 0 || Boolean(inventory.hasInlineCode);
  const sourceBacked =
    sourceBackedHint != null
      ? Boolean(sourceBackedHint)
      : hasAttachmentSource;

  const text = String(response || "").trim();
  const incapacityResponse = INCAPACITY_RESPONSE_RE.test(text);
  const hasConcreteAttachmentAnswer = isConcreteGroundedResponse(
    response,
    inventory,
  );

  // Task résolu + PJ + réponse déjà substantive (seuil assoupli vs shape lexicale).
  const taskBackedSubstantive =
    taskResolved &&
    sourceBacked &&
    text.length >= 120 &&
    (isCodeAttachmentTask(taskHit) || isDocumentAttachmentTask(taskHit)) &&
    !incapacityResponse;

  // Réponse métier utile + source/PJ → lock anti-override (jamais kill-switch).
  const overrideLocked =
    !incapacityResponse &&
    (sourceBacked || taskResolved) &&
    (hasConcreteAttachmentAnswer || taskBackedSubstantive);

  let guardMode = GUARD_MODES.REPLACE;
  if (incapacityResponse) {
    guardMode = GUARD_MODES.INCAPACITY;
  } else if (!hasAttachmentSource && !inventory.hasInlineCode) {
    guardMode = GUARD_MODES.REPLACE;
  } else if (overrideLocked) {
    guardMode = GUARD_MODES.APPEND_ONLY;
  } else if (hasConcreteAttachmentAnswer || taskBackedSubstantive) {
    guardMode = GUARD_MODES.APPEND_ONLY;
  }

  return {
    hasConcreteAttachmentAnswer:
      hasConcreteAttachmentAnswer || taskBackedSubstantive,
    sourceBacked,
    overrideLocked,
    guardMode,
    attachmentTask: taskHit,
    incapacityResponse,
    inventory,
  };
}

export function buildFileContextGuardAddon(inventory = {}) {
  const known =
    inventory.files?.length > 0
      ? inventory.files.map((f) => `- ${f.id} (${f.source})`).join("\n")
      : inventory.hasInlineCode
        ? `- ${INLINE_CONTEXT_LABEL}`
        : "- aucun fichier joint — n'invente aucun chemin";

  return `
[MODIFICATEUR: GROUNDING FICHIERS — FILE_CONTEXT_GUARD_V1]
Sources fichier/autorité pour CE tour uniquement :
${known}

RÈGLES NON NÉGOCIABLES :
1. Ne cite JAMAIS un fichier, module ou chemin (.py, .js, etc.) absent de la liste ci-dessus.
2. Si le snippet est inline dans la requête, dis « le snippet fourni » — pas « dans utils.py » sauf si utils.py est listé.
3. Si une information dépend d'un fichier non fourni → réponds explicitement « je ne sais pas sans le fichier X » et demande-le.
4. Interdit : « dans le fichier X ligne Y » si X n'est pas dans les sources listées.
`.trim();
}

/**
 * @param {{
 *   query?: string,
 *   response?: string,
 *   attachments?: object[],
 *   attachmentRefs?: object[],
 *   extraFiles?: string[],
 *   enabled?: boolean,
 *   attachmentTask?: string|null,
 *   sourceBacked?: boolean|null,
 * }} input
 */
export function evaluateFileContextGuard(input = {}) {
  const {
    query = "",
    response = "",
    attachments = [],
    attachmentRefs = [],
    extraFiles = [],
    enabled = true,
    attachmentTask = null,
    sourceBacked = null,
  } = input;

  if (!enabled || !response?.trim()) {
    return {
      ok: true,
      action: "pass",
      guardMode: GUARD_MODES.PASS,
      violations: [],
      inventory: null,
      responseState: null,
    };
  }

  if (
    !isCodeIntentRequest(query, { attachments }) &&
    attachments.length === 0 &&
    attachmentRefs.length === 0
  ) {
    return {
      ok: true,
      action: "pass",
      guardMode: GUARD_MODES.PASS,
      violations: [],
      inventory: null,
      responseState: null,
    };
  }

  const inventory = buildFileContextInventory({
    query,
    attachments,
    attachmentRefs,
    extraFiles,
  });

  const responseState = buildAttachmentResponseState({
    query,
    response,
    attachments,
    attachmentRefs,
    inventory,
    attachmentTask,
    sourceBacked,
  });

  // Incapacité déjà livrée (.doc legacy, extract fail) — ne pas remplacer par « fichier manquant ».
  if (responseState.guardMode === GUARD_MODES.INCAPACITY) {
    return {
      ok: true,
      action: "no_op",
      guardMode: GUARD_MODES.NO_OP,
      violations: [],
      inventory,
      responseState,
      preservedMessage: String(response),
    };
  }

  const violations = findHallucinatedFileReferences(response, inventory);
  if (violations.length === 0) {
    return {
      ok: true,
      action: "pass",
      guardMode: responseState.overrideLocked
        ? GUARD_MODES.NO_OP
        : GUARD_MODES.PASS,
      violations: [],
      inventory,
      responseState,
      preservedMessage: String(response),
    };
  }

  // Override lock / append-only : jamais destructif.
  if (
    responseState.overrideLocked ||
    responseState.guardMode === GUARD_MODES.APPEND_ONLY ||
    responseState.hasConcreteAttachmentAnswer
  ) {
    const note = buildUnverifiedRefsNote(violations, inventory);
    const alreadyNoted = /références hors pièces jointes/i.test(response);
    return {
      ok: true,
      action: alreadyNoted || !note ? "no_op" : "softened",
      guardMode: alreadyNoted || !note ? GUARD_MODES.NO_OP : GUARD_MODES.APPEND_ONLY,
      violations,
      inventory,
      responseState,
      softenedMessage: alreadyNoted
        ? String(response)
        : String(response).trimEnd() + note,
      preservedMessage: String(response),
    };
  }

  return {
    ok: false,
    action: "blocked",
    guardMode: GUARD_MODES.REPLACE,
    violations,
    inventory,
    responseState,
    blockedMessage: buildMissingFileClarification(violations, inventory),
  };
}

export function enforceFileContextGuard(input = {}) {
  const original = String(input.response || "");
  const result = evaluateFileContextGuard(input);

  if (result.ok) {
    if (result.action === "softened") {
      return {
        delivered: result.softenedMessage,
        blocked: false,
        softened: true,
        appendOnly: true,
        overrideLocked: Boolean(result.responseState?.overrideLocked),
        guardMode: result.guardMode || GUARD_MODES.APPEND_ONLY,
        guard: result,
      };
    }
    // pass / no_op / incapacity — livrable original intact
    return {
      delivered: result.preservedMessage || original,
      blocked: false,
      softened: false,
      appendOnly: false,
      overrideLocked: Boolean(result.responseState?.overrideLocked),
      guardMode: result.guardMode || GUARD_MODES.PASS,
      guard: result,
    };
  }

  return {
    delivered: result.blockedMessage,
    blocked: true,
    softened: false,
    appendOnly: false,
    overrideLocked: false,
    guardMode: GUARD_MODES.REPLACE,
    guard: result,
  };
}

export function shouldApplyFileContextGuard(query = "", attachments = []) {
  return isCodeIntentRequest(query) || attachments.length > 0;
}
