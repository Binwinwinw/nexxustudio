/**
 * Adaptateur PHP — entrées, SQL, includes, mélange vue/logique.
 */
import { SOURCE_FILE_ROLES } from "../sourceFileAnalysisContract.js";

/**
 * @param {string} content
 * @param {{ path: string, ext: string, bytes: number, lines: number }} meta
 */
export function analyzePhpSource(content, meta) {
  const findings = [];
  const strengths = [];
  const structure = [];
  const recommendations = [];
  const unknowns = [];
  let i = 1;
  const push = (claim, severity, evidence) => {
    findings.push({ id: `F${i++}`, claim, severity, evidence });
  };

  const hasPhpOpen = /<\?php/.test(content);
  const functions = content.match(/\bfunction\s+\w+/g) || [];
  const classes = content.match(/\bclass\s+\w+/g) || [];
  const usesSuperglobal =
    /\$_(GET|POST|REQUEST|COOKIE|SERVER|FILES)\b/.test(content);
  const hasEchoHtml =
    /echo\s+['"]\s*</.test(content) ||
    /<\?=\s*/.test(content) ||
    /\?>\s*\n?\s*</.test(content);
  const hasSql =
    /\b(?:mysqli_|PDO|mysql_query|->query\s*\(|SELECT\s+.+\s+FROM)/i.test(
      content,
    );
  const hasPrepare = /\bprepare\s*\(/i.test(content);
  const hasInclude = /\b(?:include|require)(_once)?\s*\(/i.test(content);
  const hasSession = /\bsession_start\s*\(|\$_SESSION\b/.test(content);
  const hasEval = /\beval\s*\(/.test(content);
  const hasUnescapedEcho = /echo\s+\$_(GET|POST|REQUEST)/i.test(content);

  if (hasPhpOpen) structure.push("Balise \`<?php\` présente");
  structure.push(`${functions.length} fonction(s) · ${classes.length} classe(s)`);
  if (usesSuperglobal) structure.push("Accès super-globales (\$_GET/\$_POST/…)");
  if (hasSql) structure.push("Accès SQL / DB détecté");
  if (hasSession) structure.push("Session PHP");
  if (hasInclude) structure.push("include/require");

  if (classes.length || functions.length) {
    strengths.push("Organisation en fonctions/classes — meilleure testabilité potentielle.");
  }
  if (hasPrepare && hasSql) {
    strengths.push("Requêtes préparées détectées (bonne pratique SQL).");
  }
  if (!hasEval) {
    strengths.push("Pas d’\`eval\` détecté.");
  }
  if (strengths.length < 2) {
    strengths.push(
      "Signaux OWASP repérables (entrées HTTP, SQL) sans exécuter le runtime PHP.",
    );
  }

  if (hasSql && !hasPrepare) {
    push(
      "SQL détecté sans \`prepare\` visible — risque d’injection si entrées concaténées.",
      "high",
    );
    recommendations.push("Utiliser PDO/mysqli préparés pour toute requête paramétrée.");
  }
  if (hasUnescapedEcho || (usesSuperglobal && hasEchoHtml)) {
    push(
      "Sortie HTML potentiellement nourrie par des entrées utilisateur sans échappement visible.",
      "high",
    );
    recommendations.push("Échapper avec \`htmlspecialchars\` / templating sûr.");
  }
  if (usesSuperglobal && !/filter_input|htmlspecialchars|trim\s*\(\s*\$_/i.test(content)) {
    push(
      "Super-globales lues sans validation/filtre évident.",
      "medium",
    );
    recommendations.push("Valider/sanitiser systématiquement \$_GET/\$_POST avant usage.");
  }
  if (hasEchoHtml && functions.length + classes.length > 0) {
    push(
      "Mélange probable logique PHP / rendu HTML dans le même fichier — maintenance plus difficile.",
      "low",
    );
  }
  if (hasEval) {
    push("Usage d’\`eval\` — à éliminer.", "high");
  }

  if (findings.length < 3 && hasSql) {
    push(
      "Contexte d’exécution SQL (connexion, charset, droits DB) non visible dans ce fichier seul.",
      "info",
    );
  }
  if (findings.length < 3 && usesSuperglobal) {
    push(
      "Les entrées HTTP ne sont pas tracées jusqu’au point de sortie — revue XSS/SQLi incomplète sans les includes.",
      "medium",
    );
  }
  if (findings.length < 3) {
    push(
      "Flux d’authentification, CSRF et configuration serveur absents de cette analyse statique.",
      "info",
    );
  }

  unknowns.push(
    "Sans schéma DB ni routes front controller, le flux HTTP complet n’est pas certifié.",
  );
  unknowns.push("Auth/session réelle dépend d’autres includes non lus ici.");

  if (!recommendations.length) {
    recommendations.push("Séparer validation d’entrée, accès données et rendu.");
  }
  if (recommendations.length < 2) {
    recommendations.push(
      "Tracer les includes et le bootstrap HTTP pour compléter la revue sécurité.",
    );
  }

  const role =
    hasSql || usesSuperglobal
      ? SOURCE_FILE_ROLES.SERVER_API
      : hasEchoHtml
        ? SOURCE_FILE_ROLES.SERVER_PAGE
        : SOURCE_FILE_ROLES.UTILITY;

  return {
    access: "read_full",
    path: meta.path,
    ext: meta.ext,
    bytes: meta.bytes,
    lines: meta.lines,
    role,
    roleLabel:
      role === SOURCE_FILE_ROLES.SERVER_API
        ? "Endpoint / logique serveur PHP"
        : role === SOURCE_FILE_ROLES.SERVER_PAGE
          ? "Page PHP (logique + vue)"
          : "Module PHP",
    summary:
      "Fichier PHP analysé pour structure, entrées utilisateur, SQL et séparation des responsabilités (revue statique OWASP-oriented).",
    structure,
    strengths: strengths.slice(0, 6),
    findings,
    unknowns,
    recommendations: recommendations.slice(0, 5),
    confidence: findings.some((f) => f.severity === "high") ? "high" : "medium",
    analyzer: "php",
  };
}
