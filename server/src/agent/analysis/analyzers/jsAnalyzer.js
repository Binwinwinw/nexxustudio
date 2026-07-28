/**
 * Adaptateur JS/TS — flux, exports, async, effets de bord.
 */
import { SOURCE_FILE_ROLES } from "../sourceFileAnalysisContract.js";

/**
 * @param {string} content
 * @param {{ path: string, ext: string, bytes: number, lines: number }} meta
 */
export function analyzeJsSource(content, meta) {
  const findings = [];
  const strengths = [];
  const structure = [];
  const recommendations = [];
  const unknowns = [];
  let i = 1;
  const push = (claim, severity, evidence) => {
    findings.push({ id: `F${i++}`, claim, severity, evidence });
  };

  const exportMatches = content.match(
    /\bexport\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|\{)/g,
  ) || [];
  const functionMatches =
    content.match(/\b(?:async\s+)?function\s+\w+|\bconst\s+\w+\s*=\s*(?:async\s*)?\(/g) ||
    [];
  const classMatches = content.match(/\bclass\s+\w+/g) || [];
  const hasImport = /\bimport\s+/.test(content);
  const hasRequire = /\brequire\s*\(/.test(content);
  const hasAsync = /\basync\b|\bawait\b|\.then\s*\(/.test(content);
  const hasTryCatch = /\btry\s*\{/.test(content);
  const hasDom =
    /\bdocument\.|querySelector|addEventListener|innerHTML|fetch\s*\(/.test(
      content,
    );
  const hasEval = /\beval\s*\(|new\s+Function\s*\(/.test(content);
  const hasInnerHtmlAssign = /\.innerHTML\s*=/.test(content);

  structure.push(`${functionMatches.length} fonction(s) / handlers repérés`);
  if (classMatches.length) structure.push(`${classMatches.length} classe(s)`);
  if (exportMatches.length) structure.push(`${exportMatches.length} export(s)`);
  structure.push(
    hasImport || hasRequire
      ? "Module avec dépendances (import/require)"
      : "Peu/pas d’imports — script plutôt autonome",
  );
  if (hasAsync) structure.push("Flux async (async/await ou Promises)");
  if (hasDom) structure.push("Effets DOM / réseau côté client");

  if (exportMatches.length || functionMatches.length >= 2) {
    strengths.push("Découpage en fonctions / exports — base de lisibilité.");
  }
  if (hasTryCatch && hasAsync) {
    strengths.push("Présence de try/catch avec logique async.");
  }
  if (!hasEval) {
    strengths.push("Pas d’\`eval\` / \`new Function\` détecté.");
  }

  if (hasInnerHtmlAssign) {
    push(
      "Assignations \`innerHTML\` détectées — risque XSS si la source n’est pas strictement contrôlée.",
      "high",
      "innerHTML =",
    );
    recommendations.push(
      "Préférer \`textContent\` / DOM API, ou sanitizer si le HTML dynamique est indispensable.",
    );
  }
  if (hasEval) {
    push("Usage d’\`eval\` / \`new Function\` — à éviter (sécurité / perf).", "high");
  }
  if (hasAsync && !hasTryCatch) {
    push(
      "Logique async sans try/catch visible — erreurs réseau/DOM potentiellement non gérées.",
      "medium",
    );
    recommendations.push("Encadrer les appels async critiques avec gestion d’erreur explicite.");
  }
  if (/\bfetch\s*\(/.test(content) && !/\bcatch\s*\(/.test(content)) {
    push(
      "Appels `fetch` sans branche `catch` visible — échecs HTTP/réseau potentiellement silencieux.",
      "medium",
    );
    recommendations.push("Gérer explicitement les réponses non-OK et les erreurs réseau.");
  }
  if (hasDom && /\baddEventListener\b/.test(content) && !/\bremoveEventListener\b/.test(content)) {
    push(
      "Écouteurs DOM ajoutés sans `removeEventListener` apparent — fuites ou doublons si le nœud est réinjecté.",
      "low",
    );
  }
  if (functionMatches.length > 25) {
    push(
      "Fichier dense (>25 handlers/fonctions) — risque de monolithe difficile à tester.",
      "low",
    );
    recommendations.push("Extraire modules utilitaires / domaines (carte, recherche, UI).");
  }
  if (!hasImport && !hasRequire && meta.lines > 200) {
    push(
      "Gros script sans imports — couplage fort probable dans un seul fichier.",
      "medium",
    );
  }

  unknowns.push(
    "Sans graphe d’imports ni exécution, les side effects runtime et le couplage réel restent partiels.",
  );
  unknowns.push("Les types TypeScript (si .ts) ne sont pas type-checkés ici.");

  if (!recommendations.length) {
    recommendations.push("Documenter les points d’entrée publics et isoler les effets de bord DOM.");
  }
  if (recommendations.length < 2) {
    recommendations.push(
      "Ajouter des tests ou un smoke manuel sur les chemins async/DOM critiques.",
    );
  }

  const role = hasDom
    ? SOURCE_FILE_ROLES.APP_LOGIC
    : exportMatches.length
      ? SOURCE_FILE_ROLES.UTILITY
      : SOURCE_FILE_ROLES.APP_LOGIC;

  return {
    access: "read_full",
    path: meta.path,
    ext: meta.ext,
    bytes: meta.bytes,
    lines: meta.lines,
    role,
    roleLabel: hasDom
      ? "Logique applicative front (DOM / events)"
      : "Module JavaScript / TypeScript",
    summary:
      "Script " +
      (hasDom ? "orienté UI/DOM" : "orienté logique") +
      " avec " +
      `${functionMatches.length} unité(s) fonctionnelle(s)` +
      (hasAsync ? ", flux asynchrones" : "") +
      ". Analyse statique des exports, erreurs et effets de bord.",
    structure,
    strengths: strengths.slice(0, 6),
    findings,
    unknowns,
    recommendations: recommendations.slice(0, 5),
    confidence: "medium",
    analyzer: meta.ext === "ts" ? "ts" : "js",
  };
}
