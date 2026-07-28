/**
 * SOURCE_FILE_ANALYSIS_V1 — enveloppe universelle d'analyse fichier (read-only).
 * Les adaptateurs par format remplissent la même structure.
 */
import {
  REVIEW_GRADE_MINIMUMS,
  collectReviewGradeFailures,
} from "./reviewGradeMinimums.js";

export const SOURCE_FILE_ANALYSIS_CONTRACT_ID = "SOURCE_FILE_ANALYSIS_V1";
export { REVIEW_GRADE_MINIMUMS };

export const SOURCE_FILE_ROLES = Object.freeze({
  UI_SHELL: "ui_shell",
  UI_COMPONENT: "ui_component",
  APP_LOGIC: "app_logic",
  UTILITY: "utility",
  CONFIG: "config",
  SERVER_PAGE: "server_page",
  SERVER_API: "server_api",
  STYLE: "style",
  DATA: "data",
  UNKNOWN: "unknown",
});

/**
 * @typedef {{
 *   id: string,
 *   claim: string,
 *   severity?: 'info'|'low'|'medium'|'high',
 *   evidence?: string,
 * }} AnalysisFinding
 */

/**
 * @typedef {{
 *   access: string,
 *   path: string,
 *   ext: string,
 *   bytes: number,
 *   lines: number,
 *   role: string,
 *   roleLabel: string,
 *   summary: string,
 *   structure: string[],
 *   strengths: string[],
 *   findings: AnalysisFinding[],
 *   unknowns: string[],
 *   recommendations: string[],
 *   roleRationale?: string,
 *   confidence: 'low'|'medium'|'high',
 *   analyzer: string,
 * }} SourceFileAnalysisReport
 */

/**
 * @param {SourceFileAnalysisReport} report
 * @returns {string}
 */
export function formatSourceFileAnalysisReply(report) {
  const lines = [
    `## Analyse — \`${report.path}\``,
    "",
    `**Contrat** : \`${SOURCE_FILE_ANALYSIS_CONTRACT_ID}\` · analyseur \`${report.analyzer}\``,
    `**Accès** : \`${report.access}\` (lecture seule)`,
    `- Taille : ~${report.bytes} octets · ${report.lines} lignes · \`.${report.ext || "?"}\``,
    `- **Rôle probable** : ${report.roleLabel} (\`${report.role}\`)`,
    `- **Confiance** : ${report.confidence}`,
    "",
  ];

  if (report.roleRationale?.trim()) {
    lines.push("### Pourquoi ce rôle", report.roleRationale.trim(), "");
  }

  lines.push(
    "### Ce que le fichier fait",
    report.summary || "(résumé indisponible)",
    "",
  );

  if (report.structure?.length) {
    lines.push("### Structure repérée", ...report.structure.map((s) => `- ${s}`), "");
  }

  if (report.strengths?.length) {
    lines.push("### Points solides", ...report.strengths.map((s) => `- ${s}`), "");
  }

  if (report.findings?.length) {
    lines.push("### Problèmes / risques");
    for (const f of report.findings) {
      const sev = f.severity ? ` _(sévérité ${f.severity})_` : "";
      lines.push(`- **${f.id}**${sev} : ${f.claim}`);
      if (f.evidence) lines.push(`  - Preuve : \`${f.evidence.slice(0, 120)}\``);
    }
    lines.push("");
  }

  if (report.unknowns?.length) {
    lines.push("### Inconnues / limites", ...report.unknowns.map((u) => `- ${u}`), "");
  }

  if (report.recommendations?.length) {
    lines.push(
      "### Actions conseillées",
      ...report.recommendations.map((r, i) => `${i + 1}. ${r}`),
      "",
    );
  }

  return lines.join("\n").trimEnd();
}

/**
 * Garde-qualité minimale du rapport (anti « taille + au revoir »).
 * @param {SourceFileAnalysisReport} report
 * @returns {{ ok: boolean, failures: string[] }}
 */
export function validateSourceFileAnalysisReport(report) {
  const failures = collectReviewGradeFailures(report);
  return { ok: failures.length === 0, failures };
}
