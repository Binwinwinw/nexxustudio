/**
 * Minima « review-grade » pour SOURCE_FILE_ANALYSIS_V1.
 */

export const REVIEW_GRADE_MINIMUMS = Object.freeze({
  strengths: 2,
  findings: 3,
  unknowns: 1,
  recommendations: 2,
  summaryMinChars: 40,
  structureMin: 1,
});

/**
 * @param {import('./sourceFileAnalysisContract.js').SourceFileAnalysisReport} report
 * @returns {string[]}
 */
export function collectReviewGradeFailures(report) {
  const failures = [];
  const min = REVIEW_GRADE_MINIMUMS;

  if (!report?.summary || report.summary.length < min.summaryMinChars) {
    failures.push("summary_too_short");
  }
  if ((report?.structure?.length || 0) < min.structureMin) {
    failures.push("missing_structure");
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
  return failures;
}
