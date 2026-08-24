/**
 * FILE_ANALYSIS_V1 — doctrine de restitution pour « analyse le fichier ».
 * Distinct de code_review / security_audit. doc_analyze reste la tâche PJ.
 * Profondeur = intention, pas l'extension.
 */

export const FILE_ANALYSIS_CONTRACT_ID = "FILE_ANALYSIS_V1";

export const FILE_ANALYSIS_DEPTHS = Object.freeze({
  SIMPLE: "simple",
  COMPLETE: "complete",
  CRITIQUE: "critique",
});

export const FILE_ANALYSIS_SECTIONS = Object.freeze({
  IDENTIFICATION: "identification",
  STRUCTURE: "structure",
  FONCTIONNEMENT: "fonctionnement",
  POINTS_POSITIFS: "points_positifs",
  FAIBLESSES: "faiblesses",
  RISQUES: "risques",
  VERIFICATIONS: "verifications",
  PRIORITES: "priorites",
});

const COMPLETE_RE =
  /\b(?:analyse\s+compl[eè]te|analyse\s+d[eé]taill[eé]e|d[eé]coupe(?:r)?\s+(?:toutes?\s+)?(?:les\s+)?parties)\b/i;
const CRITIQUE_RE =
  /\b(?:analyse\s+critique|analyse\s+complexe|toute\s+la\s+r[eé]flexion|faiblesses|points?\s+faibles)\b/i;

const SECTION_HEADINGS = Object.freeze({
  identification: /identification/i,
  structure: /structure/i,
  fonctionnement: /fonctionnement|ce que le fichier fait/i,
  points_positifs: /points?\s+(?:positifs|solides|forts)/i,
  faiblesses: /faiblesses|anomal|probl[eè]mes/i,
  risques: /risques?/i,
  verifications: /v[eé]rifi(?:er|cations)|limites?|inconnues/i,
  priorites: /priorit|actions?\s+conseill/i,
});

export function resolveFileAnalysisDepth(query = "") {
  const q = String(query || "");
  if (CRITIQUE_RE.test(q)) return FILE_ANALYSIS_DEPTHS.CRITIQUE;
  if (COMPLETE_RE.test(q)) return FILE_ANALYSIS_DEPTHS.COMPLETE;
  return FILE_ANALYSIS_DEPTHS.SIMPLE;
}

export function requiredFileAnalysisSections(depth = FILE_ANALYSIS_DEPTHS.SIMPLE) {
  if (depth === FILE_ANALYSIS_DEPTHS.SIMPLE) {
    return [
      FILE_ANALYSIS_SECTIONS.IDENTIFICATION,
      FILE_ANALYSIS_SECTIONS.STRUCTURE,
      FILE_ANALYSIS_SECTIONS.FONCTIONNEMENT,
    ];
  }
  return Object.values(FILE_ANALYSIS_SECTIONS);
}

/** Extensions source lues par le rail FILE_ANALYSIS (pas PDF, pas HTML documentaire). */
export const FILE_ANALYSIS_SOURCE_EXT_RE =
  /\.(js|mjs|cjs|ts|tsx|jsx|php|py|json|md|css|yml|yaml|sql)$/i;

export const SQL_SOURCE_ANALYSIS_CONTRACT_ID = "SQL_SOURCE_ANALYSIS_V1";

export const FILE_ANALYSIS_AWAITING_SOURCE_ROUTE =
  "file_analysis_awaiting_source";
export const FILE_ANALYSIS_AWAITING_SOURCE_PIPELINE_PATH = "CLARIFY";

/** analyse / analyses / analyser / analysez — 2e personne incluse. */
const FILE_ANALYSIS_VERB_RE =
  /\b(?:analys(?:e(?:s|r|z)?)|expliqu(?:e(?:s|r|z)?)|c['']est quoi ce fichier|faiblesses|points?\s+faibles|toute\s+la\s+r[eé]flexion)\b/i;

const FILE_ANALYSIS_OBJECT_RE =
  /\b(?:un|le|ce|cet|mon|ton|du)\s+fichier\b|\b(?:une|la|cette|ma|ta)\s+(?:pi[eè]ce\s+jointe|document)\b|\bfichier\s+joint\b|\bdocument\s+joint\b|\bpi[eè]ce\s+jointe\b/i;

const FILE_ANALYSIS_CATALOG_RE =
  /\b(?:quels?|quelles?|quels\s+types?|formats?)\b|\bdes\s+fichiers\b|\bles\s+fichiers\b/i;

function normalizeFileAnalysisQuery(query = "") {
  return String(query || "").replace(/[\u2018\u2019\u02BC]/g, "'");
}

export function isFileAnalysisWorkRequest(query = "") {
  const q = normalizeFileAnalysisQuery(query);
  if (
    /\b(?:corrige(?:r)?|fix(?:e|er)?|r[eé]pare(?:r)?|refactor|debug|faille|s[eé]curit|xss|revue|review|erreurs?\s+bloquantes?|am[eé]lior(?:e|er|ation)|contenu am[eé]lior|r[eé]sume(?:r)?|synth[eè]se)\b/i.test(
      q,
    )
  ) {
    return false;
  }
  return FILE_ANALYSIS_VERB_RE.test(q);
}

export function wantsFileAnalysis(userText) {
  return isFileAnalysisWorkRequest(userText);
}

function hasUploadedFile(attachments = []) {
  if (!Array.isArray(attachments)) return false;
  return attachments.some((f) => {
    if (!f || typeof f !== "object") return false;
    if (String(f.originalname || f.name || "").trim()) return true;
    if (Buffer.isBuffer(f.buffer) && f.buffer.length > 0) return true;
    return false;
  });
}

export function hasExplicitFileTarget(query = "") {
  const q = normalizeFileAnalysisQuery(query);
  return /\bprojects\/[\w./-]+\.\w+/i.test(q) || /\bfile:\/\//i.test(q);
}

export function isRepositoryAnalysisRequest(userText = "") {
  const q = normalizeFileAnalysisQuery(userText);
  return (
    /github\.com\//i.test(q) ||
    /\b(?:d[eé]p[oô]t|repo(?:sitory)?|codebase)\b/i.test(q)
  );
}

/**
 * « Analyse un fichier » / « es-tu dispo pour analyser un fichier » —
 * sans PJ, sans chemin, sans dépôt. Pas REPO_ANALYSIS, pas web.
 */
export function isFileAnalysisRequestWithoutSource(query = "", options = {}) {
  const q = normalizeFileAnalysisQuery(query);
  if (!q) return false;
  const attachments = options.attachments || options.images || [];
  if (hasUploadedFile(attachments)) return false;
  if (!wantsFileAnalysis(q)) return false;
  if (hasExplicitFileTarget(q)) return false;
  if (isRepositoryAnalysisRequest(q)) return false;
  if (FILE_ANALYSIS_CATALOG_RE.test(q)) return false;
  if (!FILE_ANALYSIS_OBJECT_RE.test(q)) return false;
  return true;
}

export function buildFileAnalysisAwaitingSourceReply(query = "") {
  const availability = /\b(?:disponible|dispo|pr[eê]t(?:e)?s?)\b/i.test(
    normalizeFileAnalysisQuery(query),
  );
  if (availability) {
    return "Oui, je suis disponible. Joins le fichier et indique si tu veux une analyse simple, complète ou critique.";
  }
  return "Joins le fichier et indique si tu veux une analyse simple, complète ou critique.";
}

/**
 * Pré-routage : avant simple_fast / EXPERT_TASK / REPO_ANALYSIS / Planner / web.
 * @returns {{ route: string, contract: null, pipelinePath: string, reply: string } | null}
 */
export function tryFileAnalysisAwaitingSource(query, options = {}) {
  if (options.forgeProduction === true) return null;
  const attachments = options.attachments || options.images || [];
  if (!isFileAnalysisRequestWithoutSource(query, { attachments })) return null;
  return {
    route: FILE_ANALYSIS_AWAITING_SOURCE_ROUTE,
    contract: null,
    pipelinePath: FILE_ANALYSIS_AWAITING_SOURCE_PIPELINE_PATH,
    reply: buildFileAnalysisAwaitingSourceReply(query),
  };
}

export function isFileAnalysisSourceName(name = "") {
  const n = String(name || "");
  if (/\.pdf$/i.test(n) || /\.html?$/i.test(n)) return false;
  return FILE_ANALYSIS_SOURCE_EXT_RE.test(n);
}

export function shouldApplyFileAnalysisSourceRail({
  task = "",
  fileName = "",
  mime = "",
  content = "",
} = {}) {
  if (task !== "doc_analyze") return false;
  if (/\.pdf$/i.test(fileName) || /pdf/i.test(String(mime || ""))) return false;
  if (!isFileAnalysisSourceName(fileName)) return false;
  return String(content || "").trim().length >= 20;
}

export function mapHtmlViewsToFileAnalysisReport(views = {}) {
  const headings = Array.isArray(views.headings) ? views.headings : [];
  return {
    path: views.fileName || "page.html",
    ext: "html",
    bytes: views.raw_bytes || 0,
    lines: views.raw_characters || 0,
    roleLabel: views.og_title || views.title || "page HTML",
    roleRationale: views.canonical_url
      ? `URL canonique : ${views.canonical_url}`
      : "Page HTML autonome — pas d'URL extraite.",
    summary:
      views.og_description ||
      views.meta_description ||
      String(views.visible_text || "").slice(0, 400) ||
      "Contenu HTML lu via les vues documentaires.",
    structure: [
      headings.length
        ? `Titres : ${headings.slice(0, 8).join(" · ")}`
        : "Peu de titres de section hors métadonnées",
      `Scripts / styles : ${views.scripts_styles_count ?? 0}`,
    ],
    strengths: views.title ? [`Titre exploitable : ${views.title}`] : [],
    findings: [],
    unknowns: [
      views.og_image
        ? "Image référencée non jointe — pas d'analyse pixel."
        : "Pas d'image extraite.",
      "Pas d'exécution runtime ni de fichiers liés.",
    ],
    recommendations: [
      "Relire les métadonnées et le texte visible extraits.",
      "Joindre l'image ou le CSS si l'analyse visuelle / de style est demandée.",
    ],
    title: views.title,
    canonical_url: views.canonical_url,
    og_description: views.og_description,
    visible_text: views.visible_text,
  };
}

/**
 * @param {object} report — rapport SOURCE_FILE_ANALYSIS ou vues HTML
 * @param {string} depth
 * @param {string} [query]
 */
export function formatFileAnalysisReply(report = {}, depth = FILE_ANALYSIS_DEPTHS.SIMPLE, query = "") {
  const path = report.path || report.fileName || "fichier joint";
  const ext = report.ext || (String(path).split(".").pop() || "?");
  const role = report.roleLabel || report.summary || report.title || "contenu local";
  const structure = report.structure || report.headings || [];
  const strengths = report.strengths || [];
  const findings = report.findings || [];
  const unknowns = report.unknowns || [];
  const recs = report.recommendations || [];
  const bytes = report.bytes || report.raw_bytes || 0;
  const lines = report.lines || 0;

  const idLines = [
    `Type : \`.${ext}\`${bytes ? ` · ~${bytes} octets` : ""}${lines ? ` · ${lines} lignes` : ""}.`,
    report.sourceKind === "sql" || report.analyzer === "sql"
      ? `Contrat source : \`${SQL_SOURCE_ANALYSIS_CONTRACT_ID}\`.`
      : "",
    `Rôle probable : ${role}.`,
    report.roleRationale ? `Contexte apparent : ${report.roleRationale}` : "",
    report.canonical_url ? `Provenance : ${report.canonical_url}` : "",
  ].filter(Boolean);

  const structLines = structure.length
    ? structure.slice(0, 12).map((s) => `- ${typeof s === "string" ? s : s.claim || s}`)
    : ["- Structure peu marquée dans l'extrait lu."];

  const sqlInventoryLines =
    report.sourceKind === "sql" || report.analyzer === "sql"
      ? formatSqlInventoryLines(report.inventory || {})
      : [];

  const functionText =
    report.summary ||
    report.og_description ||
    report.meta_description ||
    report.visible_text?.slice(0, 400) ||
    "Fonctionnement déduit uniquement de ce qui est visible dans le fichier.";

  const weak = findings.map((f) => {
    const claim = typeof f === "string" ? f : f.claim;
    const sev = f?.severity ? ` [${f.severity}]` : "";
    return `- ${claim}${sev}`;
  });
  const risks = findings
    .filter((f) => f?.severity === "high" || f?.severity === "medium")
    .map((f) => `- ${f.claim} (${f.severity})`);

  const linesOut = [
    `## Analyse du fichier \`${path}\``,
    "",
    `Contrat : \`${FILE_ANALYSIS_CONTRACT_ID}\` · profondeur **${depth}**.`,
    query ? `Demande : ${String(query).trim()}` : "",
    "",
    "### Identification du fichier",
    ...idLines,
    "",
    "### Structure interne",
    ...structLines,
    "",
    ...(sqlInventoryLines.length ? [...sqlInventoryLines, ""] : []),
    "### Fonctionnement observable",
    functionText,
    "",
  ];

  if (depth === FILE_ANALYSIS_DEPTHS.SIMPLE) {
    const notes = [
      ...strengths.slice(0, 2).map((s) => `- ${s}`),
      ...weak.slice(0, 2),
    ];
    linesOut.push(
      "### Remarques principales",
      ...(notes.length ? notes : ["- Lecture factuelle : pas d'anomalie bloquante évidente dans l'extrait."]),
      "",
      "Faits ci-dessus. Hypothèses de rôle marquées « probable ». Limite : pas d'exécution runtime.",
    );
    return linesOut.filter((l) => l !== undefined).join("\n");
  }

  linesOut.push(
    "### Points positifs",
    ...(strengths.length ? strengths.map((s) => `- ${s}`) : ["- Aucun point solide extraire sans sur-interpréter."]),
    "",
    "### Faiblesses / anomalies",
    ...(weak.length ? weak : ["- Pas d'anomalie structurelle évidente dans l'extrait lu."]),
    "",
    "### Risques",
    ...(risks.length ? risks : ["- Risques non démontrés sans exécution ni fichiers liés."]),
    "",
    "### Points à vérifier",
    ...(unknowns.length
      ? unknowns.map((u) => `- ${u}`)
      : ["- Comportement runtime, fichiers liés non joints, et contexte d'exploitation."]),
    "",
    "### Priorités",
    ...(recs.length
      ? recs.map((r, i) => `${i + 1}. ${r}`)
      : ["1. Relire les blocs cités.", "2. Vérifier l'exécution ou les dépendances manquantes."]),
    "",
    "Distinction : faits = extraits visibles · interprétation = rôle/risque probable · limite = non exécuté.",
  );

  return linesOut.filter((l) => l !== undefined).join("\n");
}

function listOrNone(items, none) {
  if (!items?.length) return [`- ${none}`];
  return items.slice(0, 40).map((x) => `- ${x}`);
}

export function formatSqlInventoryLines(inventory = {}) {
  const inserts = inventory.inserts || {};
  const insertLine = inserts.statements
    ? `${inserts.statements} instruction(s) · tables : ${Object.keys(inserts.byTable || {}).join(", ") || "n/d"}`
    : "Aucun INSERT visible";
  return [
    "### Inventaire SQL",
    `Dialecte / version : ${inventory.dialect || "non visible"}${inventory.version ? ` ${inventory.version}` : ""}.`,
    "",
    "#### Tables",
    ...listOrNone(inventory.tables, "Aucune table CREATE TABLE visible."),
    "",
    "#### Colonnes et types",
    ...listOrNone(inventory.columns, "Aucune colonne extraite."),
    "",
    "#### Clés primaires explicites",
    ...listOrNone(inventory.primaryKeys, "Aucune PRIMARY KEY visible."),
    "",
    "#### Clés étrangères explicites",
    ...listOrNone(
      inventory.foreignKeys,
      "Aucune contrainte FOREIGN KEY / REFERENCES visible.",
    ),
    "",
    "#### Contraintes",
    ...listOrNone(inventory.constraints, "Aucune contrainte extraite."),
    "",
    "#### Index",
    ...listOrNone(inventory.indexes, "Aucun index visible."),
    "",
    "#### Vues",
    ...listOrNone(inventory.views, "Aucune vue."),
    "",
    "#### Triggers",
    ...listOrNone(inventory.triggers, "Aucun trigger."),
    "",
    "#### Procédures",
    ...listOrNone(inventory.procedures, "Aucune procédure / fonction."),
    "",
    "#### Événements",
    ...listOrNone(inventory.events, "Aucun événement."),
    "",
    "#### INSERT",
    `- ${insertLine}`,
    "",
    "#### Anomalies",
    ...listOrNone(inventory.anomalies, "Pas d'anomalie d'encodage / dump évidente."),
    "",
    "#### Limites",
    ...listOrNone(inventory.limits, "Couverture limitée au fichier joint."),
    "",
    "#### Hypothèses / à vérifier",
    ...listOrNone(
      inventory.idHints,
      "Pas de colonne *Id sans REFERENCES.",
    ),
  ];
}

export function evaluateFileAnalysisSufficiency(input = {}) {
  const {
    query = "",
    reply = "",
    depth = resolveFileAnalysisDepth(query),
    fileName = "",
    artifactsPresent = false,
    sourceKind = "",
  } = input;
  const text = String(reply || "");
  const required = requiredFileAnalysisSections(depth);
  const missing = required.filter((key) => !SECTION_HEADINGS[key].test(text));
  const generic = /voici des axes d'am[eé]lioration g[eé]n[eé]riques|tutoriel g[eé]n[eé]rique/i.test(
    text,
  );
  const falseEmpty = /fichier vide|trop court pour une analyse/i.test(text) && artifactsPresent;
  const mentionsFile =
    (fileName && text.toLowerCase().includes(String(fileName).slice(0, 18).toLowerCase())) ||
    /identification|structure|fonctionnement/i.test(text);
  const isSql =
    sourceKind === "sql" ||
    /\.sql$/i.test(String(fileName || "")) ||
    /SQL_SOURCE_ANALYSIS_V1|Inventaire SQL/i.test(text);

  const inferredAsFact =
    /\b(?:cl[eé]\s+[eé]trang[eè]re\s+implicite|relation\s+(?:confirm[eé]e|d[eé]ductible)|d[eé]ductibles?\s+depuis)\b/i.test(
      text,
    ) ||
    (/\bcl[eé]s?\s+[eé]trang[eè]res?\b/i.test(text) &&
      !/REFERENCES|FOREIGN KEY|explicite/i.test(text) &&
      !/hypoth[eè]se/i.test(text));

  const reasons = [];
  if (generic || (!mentionsFile && text.length > 40)) reasons.push("generic_unanchored");
  if (falseEmpty) reasons.push("false_empty");
  if (
    (depth === FILE_ANALYSIS_DEPTHS.COMPLETE || depth === FILE_ANALYSIS_DEPTHS.CRITIQUE) &&
    missing.length
  ) {
    reasons.push("missing_sections");
  }
  if (depth === FILE_ANALYSIS_DEPTHS.CRITIQUE && !/limite|v[eé]rifi|hypoth/i.test(text)) {
    reasons.push("critique_without_limits");
  }

  const checks = {
    attachment_used: mentionsFile,
    factual_anchoring: mentionsFile && !generic,
    source_inventory_sufficient: isSql ? /Inventaire SQL/i.test(text) && /#### Tables/i.test(text) : null,
    inferred_claims_marked: isSql ? !inferredAsFact : null,
    repetition_absent: true,
    final_output_complete: true,
  };

  if (isSql && !checks.source_inventory_sufficient) {
    reasons.push("source_inventory_insufficient");
  }
  if (isSql && inferredAsFact) reasons.push("inferred_claims_unmarked");
  if (isSql && /documentAnalysis|synth[eè]se des donn[eé]es structur[eé]es/i.test(text)) {
    reasons.push("llm_inventory_source");
  }

  return {
    ok: reasons.length === 0,
    reasons,
    missing,
    depth,
    contract: FILE_ANALYSIS_CONTRACT_ID,
    checks,
  };
}

export function buildFileAnalysisPromptAddon(depth = FILE_ANALYSIS_DEPTHS.SIMPLE) {
  const required = requiredFileAnalysisSections(depth).join(", ");
  return [
    `[${FILE_ANALYSIS_CONTRACT_ID} profondeur=${depth}]`,
    `Sections obligatoires : ${required}.`,
    "Ancre chaque affirmation sur le fichier. Distingue fait / interprétation / limite.",
    "INTERDIT : résumé générique, avis sans extrait, « fichier vide » si le contenu a été lu.",
    depth === FILE_ANALYSIS_DEPTHS.SIMPLE
      ? "Niveau 1 : identification, structure, fonctionnement, remarques. Pas d'audit sécu."
      : depth === FILE_ANALYSIS_DEPTHS.COMPLETE
        ? "Niveau 2 : trame complète, sous-parties, critique mesurée."
        : "Niveau 3 : trame complète + diagnostic + risques + priorités + non-vérifiable.",
  ].join("\n");
}
