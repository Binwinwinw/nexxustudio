/**
 * Minima review-grade pour REPO_ANALYSIS_V1 (échelle dépôt).
 */

export const REPO_REVIEW_GRADE_MINIMUMS = Object.freeze({
  strengths: 3,
  findings: 5,
  unknowns: 2,
  recommendations: 3,
  languagesMin: 1,
  structureMin: 2,
  summaryMinChars: 60,
  /** Quand deep sample / sources présentes. */
  codeFindingsMin: 2,
});

/**
 * @param {import('./repoAnalysisContract.js').RepoAnalysisReport} report
 * @returns {string[]}
 */
export function collectRepoReviewGradeFailures(report) {
  const failures = [];
  const min = REPO_REVIEW_GRADE_MINIMUMS;

  if (!report?.summary || report.summary.length < min.summaryMinChars) {
    failures.push("summary_too_short");
  }
  if ((report?.languages?.length || 0) < min.languagesMin) {
    failures.push(`languages_below_${min.languagesMin}`);
  }
  if ((report?.structure?.length || 0) < min.structureMin) {
    failures.push(`structure_below_${min.structureMin}`);
  }
  if ((report?.strengths?.length || 0) < min.strengths) {
    failures.push(`strengths_below_${min.strengths}`);
  }
  if ((report?.findings?.length || 0) < min.findings) {
    failures.push(`findings_below_${min.findings}`);
  }
  if ((report?.unknowns?.length || 0) < min.unknowns) {
    failures.push(`unknowns_below_${min.unknowns}`);
  }
  if ((report?.recommendations?.length || 0) < min.recommendations) {
    failures.push(`recommendations_below_${min.recommendations}`);
  }
  if (report?.requireCodeFindings) {
    if ((report?.codeFindings?.length || 0) < min.codeFindingsMin) {
      failures.push(`code_findings_below_${min.codeFindingsMin}`);
    }
  }
  return failures;
}
