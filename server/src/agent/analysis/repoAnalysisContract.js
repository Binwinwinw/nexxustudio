/**
 * REPO_ANALYSIS_V1 — revue technique structurée d'un dépôt (lecture seule).
 * Homologue dépôt de SOURCE_FILE_ANALYSIS_V1.
 */
import {
  REPO_REVIEW_GRADE_MINIMUMS,
  collectRepoReviewGradeFailures,
} from "./repoReviewGradeMinimums.js";
import { SOURCE_FILE_ANALYSIS_CONTRACT_ID } from "./sourceFileAnalysisContract.js";

export const REPO_ANALYSIS_CONTRACT_ID = "REPO_ANALYSIS_V1";
export { REPO_REVIEW_GRADE_MINIMUMS };

const SOURCE_FILE_HINT = SOURCE_FILE_ANALYSIS_CONTRACT_ID;

/**
 * @typedef {{
 *   id: string,
 *   claim: string,
 *   severity?: 'info'|'low'|'medium'|'high',
 *   evidence?: string,
 * }} RepoFinding
 */

/**
 * @typedef {{
 *   access: string,
 *   repoLabel: string,
 *   sourceKind: 'local_workspace'|'remote_github'|'unresolved',
 *   summary: string,
 *   languages: string[],
 *   structure: string[],
 *   strengths: string[],
 *   findings: RepoFinding[],
 *   testsQuality: string[],
 *   documentation: string[],
 *   unknowns: string[],
 *   recommendations: string[],
 *   confidence: 'low'|'medium'|'high',
 *   analyzer: string,
 *   multiStack?: string|null,
 *   deepMode?: boolean,
 *   requireCodeFindings?: boolean,
 *   sampledPaths?: string[],
 *   codeFindings?: RepoFinding[],
 *   codeStrengths?: string[],
 * }} RepoAnalysisReport
 */

/**
 * Prompt système injecté pour le pipeline LLM (dépôts distants / web).
 * @returns {string}
 */
export function getRepoAnalysisSystemPrompt() {
  return `Tu es Nexxus, en mode analyse de dépôt code (contrat ${REPO_ANALYSIS_CONTRACT_ID}).

Mission :
Analyser techniquement le dépôt indiqué (GitHub ou autre) comme un reviewer expérimenté : structure, langages, modules, qualité, risques, tests, documentation, inconnues et actions.

Ce que tu dois faire :
- Identifier les langages et technologies réellement utilisés (fichiers, configs, scripts) — avec preuves.
- Décrire la structure du dépôt (dossiers principaux, modules, configuration, tests).
- Relever les points forts (organisation, patterns, tests, docs…).
- Relever les problèmes et risques concrets (sécurité, dette, fragilité, manque de tests/docs…).
- Lister les inconnues (ce que tu ne peux pas savoir sans exécution ou contexte externe).
- Proposer des actions recommandées priorisées (roadmap courte).
- Si multi-langages / multi-stack : ajouter une note de cohérence multi-stack.

Ce que tu ne dois pas faire :
- Ne pas te limiter au nom, à l'auteur ou à l'URL.
- Ne pas rester au seul README sans citer d'autres fichiers/configs structurants.
- Ne pas produire une réponse purement générique, sociale ou « document vague ».

Sortie obligatoire (markdown) :
## Analyse du dépôt : <owner>/<repo ou chemin>
### Langages principaux
### Structure du dépôt
### Points forts
### Problèmes / risques
### Tests / qualité
### Documentation
### Inconnues / limites
### Actions recommandées

Minima :
- ≥ ${REPO_REVIEW_GRADE_MINIMUMS.strengths} points forts (dépôt non trivial)
- ≥ ${REPO_REVIEW_GRADE_MINIMUMS.findings} problèmes/risques concrets (ou explique pourquoi impossible)
- ≥ ${REPO_REVIEW_GRADE_MINIMUMS.unknowns} inconnues
- ≥ ${REPO_REVIEW_GRADE_MINIMUMS.recommendations} actions
- Si des fichiers source sont accessibles dans l'échantillon : ≥ ${REPO_REVIEW_GRADE_MINIMUMS.codeFindingsMin} findings ancrés dans leur contenu (pas seulement hygiène dépôt).`;
}

/**
 * @param {RepoAnalysisReport} report
 * @returns {string}
 */
export function formatRepoAnalysisReply(report) {
  const lines = [
    `## Analyse du dépôt : \`${report.repoLabel}\``,
    "",
    `**Contrat** : \`${REPO_ANALYSIS_CONTRACT_ID}\` · analyseur \`${report.analyzer}\``,
    `**Accès** : \`${report.access}\` · source \`${report.sourceKind}\` · confiance **${report.confidence}**`,
    "",
    "### Ce que le dépôt fait",
    report.summary || "(résumé indisponible)",
    "",
    "### Langages principaux",
    ...(report.languages?.length
      ? report.languages.map((l) => `- ${l}`)
      : ["- (non déterminé)"]),
    "",
  ];

  if (report.structure?.length) {
    lines.push(
      "### Structure du dépôt",
      ...report.structure.map((s) => `- ${s}`),
      "",
    );
  }

  if (report.strengths?.length) {
    lines.push(
      "### Points forts",
      ...report.strengths.map((s) => `- ${s}`),
      "",
    );
  }

  if (report.findings?.length) {
    lines.push("### Problèmes / risques");
    for (const f of report.findings) {
      const sev = f.severity ? ` _(sévérité ${f.severity})_` : "";
      lines.push(`- **${f.id}**${sev} : ${f.claim}`);
      if (f.evidence) {
        lines.push(`  - Preuve : \`${String(f.evidence).slice(0, 120)}\``);
      }
    }
    lines.push("");
  }

  if (report.codeFindings?.length) {
    lines.push("### Findings code (échantillon)");
    if (report.sampledPaths?.length) {
      lines.push(
        `_Fichiers lus via \`${SOURCE_FILE_HINT}\` : ${report.sampledPaths.map((p) => `\`${p}\``).join(", ")}_`,
        "",
      );
    }
    for (const f of report.codeFindings) {
      const sev = f.severity ? ` _(sévérité ${f.severity})_` : "";
      lines.push(`- **${f.id}**${sev} : ${f.claim}`);
      if (f.evidence) {
        lines.push(`  - Preuve : \`${String(f.evidence).slice(0, 120)}\``);
      }
    }
    lines.push("");
  }

  if (report.testsQuality?.length) {
    lines.push(
      "### Tests / qualité",
      ...report.testsQuality.map((t) => `- ${t}`),
      "",
    );
  }

  if (report.documentation?.length) {
    lines.push(
      "### Documentation",
      ...report.documentation.map((d) => `- ${d}`),
      "",
    );
  }

  if (report.multiStack) {
    lines.push("### Cohérence multi-stack", report.multiStack, "");
  }

  if (report.unknowns?.length) {
    lines.push(
      "### Inconnues / limites",
      ...report.unknowns.map((u) => `- ${u}`),
      "",
    );
  }

  if (report.recommendations?.length) {
    lines.push(
      "### Actions recommandées",
      ...report.recommendations.map((r, i) => `${i + 1}. ${r}`),
      "",
    );
  }

  return lines.join("\n").trimEnd();
}

/**
 * @param {RepoAnalysisReport} report
 * @returns {{ ok: boolean, failures: string[] }}
 */
export function validateRepoAnalysisReport(report) {
  const failures = collectRepoReviewGradeFailures(report);
  return { ok: failures.length === 0, failures };
}
