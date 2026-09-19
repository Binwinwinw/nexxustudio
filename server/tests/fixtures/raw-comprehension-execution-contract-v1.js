/**
 * SPEC-RAW-COMPREHENSION-EXECUTION-CONTRACT-V1 — artefact de conception.
 * PAS un sanitizer runtime. Interdit d'importer depuis
 * agentPipeline / querySanitizer / socialPatternPolicy / requestInterpreter.
 *
 * buildInputViews = contrat testable. runtimeWired=false.
 */

export const CONTRACT_ID = "SPEC-RAW-COMPREHENSION-EXECUTION-CONTRACT-V1";
export const CONTRACT_STATUS = "recorded_unwired";

export const RUNTIME = Object.freeze({
  wired: false,
  newPacket: false,
  newSanitizer: false,
  secondNlu: false,
  p4Reopened: false,
  p5Reopened: false,
  shadowConsumed: false,
  justConsumed: false,
  semanticPreprocessorIsInputNlu: false,
});

export const ROLES = Object.freeze({
  RAW: "rawQuery",
  COMPREHENSION: "comprehensionQuery",
  EXECUTION_QUERY: "executionQuery",
  EXECUTION_VALUE: "executionValue",
});

export const CLASSES = Object.freeze({
  A: "A",
  B: "B",
  C: "C",
  BC: "B/C",
});

/** Alias runtime existants : pas des rôles tant qu'ils ne sont pas qualifiés. */
export const UNQUALIFIED_ALIASES = Object.freeze([
  "pipelineQuery",
  "canonicalQuery",
  "effectiveQuery",
  "enrichedQuery",
]);

export const ALIAS_MAY_MODIFY = Object.freeze(["comprehension", "context"]);
export const ALIAS_NEVER_WITHOUT_CONFIRMATION = Object.freeze([
  "action_value",
  "path",
  "url",
  "identifier",
  "filename",
  "command",
  "date",
  "amount",
  "recipient",
]);

export const FORBIDDEN_EXECUTION_SOURCES = Object.freeze([
  "comprehensionQuery",
  "matchKey",
  "sanitizeQuery",
  "normalizeForParse",
  "canonicalQuery",
  "effectiveQuery",
  "pipelineQuery",
  "enrichedQuery",
]);

export const ALLOWED_EXECUTION_SOURCES = Object.freeze([
  "rawQuery",
  "executionValue",
  "confirmedValue",
]);

/** Hazard documenté du runtime actuel — interdit comme source d'exécution. */
export const KNOWN_RUNTIME_HAZARDS = Object.freeze([
  {
    id: "sanitizeQuery_strips_slash",
    fn: "sanitizeQuery",
    raw: "supprime /prod",
    matchingSurface: "supprime prod",
    forbiddenAsExecution: true,
  },
  {
    id: "normalizeForParse_strips_url_punct",
    fn: "normalizeForParse",
    raw: "https://github.com/example/demo",
    forbiddenAsExecution: true,
  },
]);

const ACTIVITY_AFTER_QUEST =
  /\bqu['']est[- ]?que\s+(?:tu|vous)\s+(?:fais(?:es|ez)?|racontes?|racontez)\b/i;

export const CLASS_A_RULES = Object.freeze([
  {
    id: "apostrophe_unify",
    rawExample: "qu’est-ce que tu fais ?",
    comprehensionExample: "qu'est-ce que tu fais ?",
    scope: "apostrophes typographiques → ASCII, matching seulement",
    reason: "même token conversationnel",
    risk: "low",
    provenance: "class_a.apostrophe_unify",
    positives: ["qu’est-ce que tu fais ?", "qu'est-ce que tu fais ?"],
    negatives: ["ne pas réécrire un identifiant quoted"],
  },
  {
    id: "unicode_nfkc",
    rawExample: "comment vas-tu ?",
    comprehensionExample: "comment vas-tu ?",
    scope: "NFKC non destructif",
    reason: "compatibilité unicode",
    risk: "low",
    provenance: "class_a.unicode_nfkc",
    positives: ["comment vas-tu ?"],
    negatives: ["ne pas plier un chemin"],
  },
  {
    id: "conversational_space_punct",
    rawExample: "comment vas-tu ???",
    comprehensionExample: "comment vas-tu ?",
    scope: "espaces + répétitions ?! conversationnelles",
    reason: "tournure, pas token C",
    risk: "low",
    provenance: "class_a.conversational_space_punct",
    positives: ["comment vas-tu ???"],
    negatives: ["supprime /prod — conserver le slash"],
  },
  {
    id: "case_for_match",
    rawExample: "crée un fichier README",
    comprehensionExample: "crée un fichier README",
    scope: "casse dans matchKey seulement",
    reason: "matching ≠ filename",
    risk: "low",
    provenance: "class_a.case_for_match",
    positives: ["matching lower OK"],
    negatives: ["README d'exécution reste README"],
  },
  {
    id: "accent_for_match",
    rawExample: "résume ce dépôt",
    comprehensionExample: "résume ce dépôt",
    scope: "fold accents dans matchKey seulement",
    reason: "comparaison, pas correction de contenu",
    risk: "low",
    provenance: "class_a.accent_for_match",
    positives: ["résume ce dépôt"],
    negatives: ["résume ce dépô → pas dépôt"],
  },
  {
    id: "cava_split",
    rawExample: "comment cava ?",
    comprehensionExample: "comment ca va ?",
    scope: "mot entier cava",
    reason: "typo orale check-in",
    risk: "low",
    provenance: "class_a.cava_split",
    positives: ["comment cava ?", "cava ?"],
    negatives: ["ne pas toucher un identifiant cava_x"],
  },
  {
    id: "quest_que_social",
    rawExample: "qu'est que tu fais ?",
    comprehensionExample: "qu'est-ce que tu fais ?",
    scope: "qu'est que + tu|vous + verbe d'activité",
    reason: "élision orale sociale bornée",
    risk: "low",
    provenance: "class_a.quest_que_social",
    positives: ["qu'est que tu fais ?", "qu'est que tu fais de beau ?"],
    negatives: ["qu'est que le serveur fait ?", "qu'est que la fonction fait ?"],
  },
]);

export const CLASS_B_POLICY = Object.freeze({
  items: Object.freeze([
    "action_verbs",
    "common_file_nouns",
    "depot_server_tech",
    "frameworks",
    "technical_terms",
    "fiichier",
    "depo",
    "servr",
  ]),
  silentRewrite: false,
  keepRaw: true,
  ifInsufficient: "clarify",
});

export const CLASS_C_PROHIBITIONS = Object.freeze([
  "urls",
  "paths",
  "exact_filenames",
  "identifiers",
  "people_recipients",
  "datetimes",
  "amounts",
  "versions",
  "shell",
  "code",
  "sql",
  "tokens",
  "keys",
]);

export const MATRIX = Object.freeze([
  {
    id: "comment_vas_tu",
    raw: "comment vas-tu ?",
    class: CLASSES.A,
    expected: "social",
    executionKind: null,
    slashMustSurvive: false,
  },
  {
    id: "comment_cava",
    raw: "comment cava ?",
    class: CLASSES.A,
    expected: "social",
    executionKind: null,
    slashMustSurvive: false,
  },
  {
    id: "quest_ce_que",
    raw: "qu'est ce que tu fais ?",
    class: CLASSES.A,
    expected: "phatic",
    executionKind: null,
    slashMustSurvive: false,
  },
  {
    id: "quest_que",
    raw: "qu'est que tu fais ?",
    class: CLASSES.A,
    expected: "phatic",
    executionKind: null,
    slashMustSurvive: false,
  },
  {
    id: "resume_depo",
    raw: "résume ce dépô",
    class: CLASSES.B,
    expected: "clarify_or_future_matching",
    executionKind: null,
    slashMustSurvive: false,
    forbiddenRewrite: "dépôt",
  },
  {
    id: "fiichier_readme",
    raw: "cree un fiichier README",
    class: CLASSES.BC,
    expected: "clarify_target",
    executionKind: "filename",
    slashMustSurvive: false,
    forbiddenRewrite: "fichier",
  },
  {
    id: "delete_prod",
    raw: "supprime prod",
    class: CLASSES.C,
    expected: "confirmation",
    executionKind: "token",
    slashMustSurvive: false,
  },
  {
    id: "delete_slash_prod",
    raw: "supprime /prod",
    class: CLASSES.C,
    expected: "confirmation",
    executionKind: "path",
    slashMustSurvive: true,
  },
  {
    id: "github_url",
    raw: "https://github.com/example/demo",
    class: CLASSES.C,
    expected: "repo_routing",
    executionKind: "url",
    slashMustSurvive: true,
  },
  {
    id: "shell_cmd",
    raw: "rm -rf ./dist",
    class: CLASSES.C,
    expected: "security",
    executionKind: "shell",
    slashMustSurvive: false,
  },
  {
    id: "sql_cmd",
    raw: "DELETE FROM sessions WHERE id = 1",
    class: CLASSES.C,
    expected: "security",
    executionKind: "sql",
    slashMustSurvive: false,
  },
]);

export const EXECUTION_INVARIANTS = Object.freeze([
  "no_action_reads_comprehensionQuery_as_target",
  "no_path_from_sanitizeQuery",
  "no_url_from_normalizeForParse",
  "no_exact_filename_from_comprehension_view",
  "no_autocorrect_command_sql_code",
  "destructive_confirm_shows_raw_or_resolved",
  "rawQuery_kept_when_comprehensionQuery_exists",
  "no_safe_repair_proof_keeps_raw",
]);

export const CHAIN_CONSTRAINTS = Object.freeze({
  singleNlu: true,
  localWorkupView: true,
  newPacket: false,
  newScore: false,
  newEntity: false,
  targetDetector: false,
  secondClassifier: false,
  taskKindCanonical: true,
  justShadow: true,
  shadowsUnconsumed: true,
  semanticPreprocessorAval: true,
});

function unifyApostrophes(text) {
  return String(text).replace(/[\u2018\u2019\u201B]/g, "'");
}

function collapseConversationalPunct(text) {
  return String(text)
    .replace(/[?]{2,}/g, "?")
    .replace(/[!]{2,}/g, "!")
    .replace(/\s+/g, " ")
    .trim();
}

function stripAccents(text) {
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function applyClassA(raw) {
  const repairs = [];
  let view = unifyApostrophes(raw);
  if (view !== raw) {
    repairs.push({ id: "apostrophe_unify", class: CLASSES.A, reversible: true });
  }
  const nfkc = view.normalize("NFKC");
  if (nfkc !== view) {
    repairs.push({ id: "unicode_nfkc", class: CLASSES.A, reversible: true });
    view = nfkc;
  }
  const collapsed = collapseConversationalPunct(view);
  if (collapsed !== view) {
    repairs.push({
      id: "conversational_space_punct",
      class: CLASSES.A,
      reversible: true,
    });
    view = collapsed;
  }
  const cava = view.replace(/\bcava\b/gi, "ca va");
  if (cava !== view) {
    repairs.push({ id: "cava_split", class: CLASSES.A, reversible: true });
    view = cava;
  }
  if (ACTIVITY_AFTER_QUEST.test(view)) {
    const next = view.replace(
      /\bqu'est[- ]?que\s+(?=(?:tu|vous)\s+(?:fais(?:es|ez)?|racontes?|racontez)\b)/gi,
      "qu'est-ce que ",
    );
    if (next !== view) {
      repairs.push({ id: "quest_que_social", class: CLASSES.A, reversible: true });
      view = next.replace(/\s+/g, " ").trim();
    }
  }
  return { comprehensionQuery: view, repairs };
}

function toMatchKey(comprehensionQuery) {
  return stripAccents(comprehensionQuery).toLowerCase();
}

export function extractExecutionValue(raw = "", kind = null) {
  const text = String(raw || "");
  if (!kind) return null;
  if (kind === "path") {
    const hit = text.match(/(^|\s)(\/[^\s]+)/);
    return hit ? hit[2] : null;
  }
  if (kind === "url") {
    const hit = text.match(/https?:\/\/[^\s]+/i);
    return hit ? hit[0] : null;
  }
  if (kind === "filename") {
    const hit = text.match(/\bREADME\b/);
    return hit ? hit[0] : null;
  }
  if (kind === "token") {
    const parts = text.trim().split(/\s+/);
    return parts[parts.length - 1] || null;
  }
  if (kind === "shell" || kind === "sql") return text;
  return null;
}

export function isLegalExecutionSource(source = "") {
  if (FORBIDDEN_EXECUTION_SOURCES.includes(source)) return false;
  return ALLOWED_EXECUTION_SOURCES.includes(source);
}

export function aliasIsAutomaticRole(_alias = "") {
  return false;
}

export function rowById(id) {
  return MATRIX.find((row) => row.id === id) || null;
}

export function buildInputViews(raw = "", options = {}) {
  const rawQuery = String(raw ?? "");
  const row = options.caseId ? rowById(options.caseId) : MATRIX.find((r) => r.raw === rawQuery);
  const { comprehensionQuery, repairs } = applyClassA(rawQuery);
  const matchKey = toMatchKey(comprehensionQuery);
  const executionKind = options.executionKind ?? row?.executionKind ?? null;
  const executionValue = extractExecutionValue(rawQuery, executionKind);
  return {
    rawQuery,
    comprehensionQuery,
    matchKey,
    executionQuery: rawQuery,
    executionValue,
    class: options.class ?? row?.class ?? null,
    expected: options.expected ?? row?.expected ?? null,
    repairs,
    runtimeWired: RUNTIME.wired,
    shadowConsumed: RUNTIME.shadowConsumed,
  };
}

export function matchingSurfaceIfSanitizeLike(raw = "") {
  return unifyApostrophes(String(raw || ""))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
