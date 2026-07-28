/**
 * Internalisation golden automatisée : export → baseline après N passages CI.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { triageUserIntent } from "./intentTriageClassifier.js";
import {
  renderGoldenFixtureModule,
  EXPORT_CATEGORIES,
  queryFingerprint,
} from "./intentTriageFeedbackExporter.js";
import { getIntentTriageFeedbackPath } from "./intentTriageFeedbackRecorder.js";
import {
  getGoldenCiPassCount,
  loadGoldenCiRegistry,
} from "./intentTriageGoldenCiRegistry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, "../../..");
const FIXTURES_DIR = path.resolve(SERVER_ROOT, "tests/fixtures");
const BASELINE_FIXTURE = path.join(FIXTURES_DIR, "intentTriageGoldenQueries.js");
const EXPORTED_FIXTURE = path.join(FIXTURES_DIR, "intentTriageGoldenExported.js");
const REPORTS_DIR = path.resolve(SERVER_ROOT, "data/intent-triage/reports");

const CONFIDENCE_RANK = { low: 0, medium: 1, high: 2 };

export { queryFingerprint };

function parseJsonl(content = "") {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function assertGoldenCasePasses(caseItem) {
  const triage = triageUserIntent(caseItem.query);
  if (caseItem.expectedTopIntent && triage.top_intent !== caseItem.expectedTopIntent) {
    return false;
  }
  if (caseItem.expectedRunnerUp && triage.runner_up !== caseItem.expectedRunnerUp) {
    return false;
  }
  if (caseItem.minConfidence) {
    const actual = CONFIDENCE_RANK[triage.confidence] ?? 0;
    const min = CONFIDENCE_RANK[caseItem.minConfidence] ?? 0;
    if (actual < min) return false;
  }
  if (caseItem.routingAction && triage.routing_action !== caseItem.routingAction) {
    return false;
  }
  return true;
}

/**
 * @param {import("./intentTriageFeedbackExporter.js").IntentTriageGoldenCase} caseItem
 */
export function toBaselinePromotedCase(caseItem, promotedMeta = {}) {
  const fingerprint = queryFingerprint(caseItem.query);
  return {
    ...caseItem,
    id: caseItem.id?.startsWith("baseline-")
      ? caseItem.id
      : `baseline-promoted-${fingerprint}`,
    category: caseItem.category || EXPORT_CATEGORIES.PRODUCTION_ROUTING,
    source: "baseline_promoted",
    observedAt: promotedMeta.promoted_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    incident:
      caseItem.incident ||
      `Promu automatiquement après ${promotedMeta.ci_pass_count} passage(s) CI.`,
    promoted_at: promotedMeta.promoted_at,
    promoted_by: promotedMeta.promoted_by,
    ci_pass_count: promotedMeta.ci_pass_count,
  };
}

export function renderBaselineFixtureModule(cases = []) {
  const needsCalcSnippet = cases.some(
    (c) => c.id === "baseline-calculatrice-code-review-high",
  );

  const serializedCases = cases.map((caseItem) => {
    if (caseItem.id === "baseline-calculatrice-code-review-high") {
      return {
        ...caseItem,
        query: "__BROKEN_CALCULATRICE_TEMPLATE__",
      };
    }
    return caseItem;
  });

  let body = JSON.stringify(serializedCases, null, 2);
  if (needsCalcSnippet) {
    body = body.replace(
      '"__BROKEN_CALCULATRICE_TEMPLATE__"',
      "`analyse le code suivant c'est du python :\\n${BROKEN_CALCULATRICE_PY_SNIPPET}`",
    );
  }

  const calcImport = needsCalcSnippet
    ? 'import { BROKEN_CALCULATRICE_PY_SNIPPET } from "./codeReviewGoldenQueries.js";\n'
    : "";

  return `/**
 * Cas golden — tri d'intention (règles + scores, local-first).
 * Enrichi manuellement ; complété par intentTriageGoldenExported.js via npm run triage:export-golden.
 * Promotions auto : npm run triage:promote-golden
 */
import { EXPORT_CATEGORIES } from "../../src/agent/classifiers/intentTriageFeedbackExporter.js";
${calcImport}
/** @type {import("../../src/agent/classifiers/intentTriageFeedbackExporter.js").IntentTriageGoldenCase[]} */
export const INTENT_TRIAGE_BASELINE_QUERIES = ${body};

export { EXPORT_CATEGORIES };
`;
}

/**
 * Marque les entrées JSONL correspondant aux queries promues.
 */
export function markFeedbackEntriesPromoted(queries = [], meta = {}) {
  const feedbackPath = meta.feedbackPath || getIntentTriageFeedbackPath();
  if (!fs.existsSync(feedbackPath) || queries.length === 0) {
    return { updated: 0, feedbackPath };
  }

  const fingerprints = new Set(queries.map((q) => queryFingerprint(q)));
  const lines = parseJsonl(fs.readFileSync(feedbackPath, "utf8"));
  let updated = 0;

  const rewritten = lines.map((line) => {
    try {
      const entry = JSON.parse(line);
      const fp = queryFingerprint(entry.query || "");
      if (!fingerprints.has(fp) || entry.promoted_to_baseline === true) {
        return line;
      }
      updated += 1;
      return JSON.stringify({
        ...entry,
        promoted_to_baseline: true,
        promoted_at: meta.promoted_at || new Date().toISOString(),
        promoted_by: meta.promoted_by || "triage:promote-golden",
        ci_pass_count: meta.ci_pass_count ?? entry.ci_pass_count,
      });
    } catch {
      return line;
    }
  });

  fs.writeFileSync(feedbackPath, `${rewritten.join("\n")}\n`, "utf8");
  return { updated, feedbackPath };
}

/**
 * @param {{
 *   minCount?: number,
 *   dryRun?: boolean,
 *   baselineCases?: object[],
 *   exportedCases?: object[],
 * }} [options]
 */
export function promoteStableGoldenCases(options = {}) {
  const minCount = Math.max(parseInt(options.minCount || "5", 10), 1);
  const dryRun = Boolean(options.dryRun);
  const promotedAt = new Date().toISOString();
  const promotedBy = `triage:promote-golden --min-count=${minCount}`;

  const baselineCases = options.baselineCases || [];
  const exportedCases = options.exportedCases || [];
  const baselineIds = new Set(baselineCases.map((c) => c.id));

  const candidates = exportedCases.filter((caseItem) => {
    if (!caseItem?.id || baselineIds.has(caseItem.id)) return false;
    if (caseItem.id.startsWith("baseline-")) return false;
    if (caseItem.source === "baseline" || caseItem.source === "baseline_promoted") {
      return false;
    }
    const passCount = getGoldenCiPassCount(caseItem.id);
    if (passCount < minCount) return false;
    return assertGoldenCasePasses(caseItem);
  });

  const promotedCases = candidates.map((caseItem) =>
    toBaselinePromotedCase(caseItem, {
      promoted_at: promotedAt,
      promoted_by: promotedBy,
      ci_pass_count: getGoldenCiPassCount(caseItem.id),
    }),
  );

  const candidateIds = new Set(candidates.map((c) => c.id));
  const filteredExported = exportedCases.filter((c) => !candidateIds.has(c.id));

  const nextBaseline = [...baselineCases, ...promotedCases].sort((a, b) =>
    a.id.localeCompare(b.id),
  );

  const report = {
    schema_version: "intent_triage_promoted_v1",
    promoted_at: promotedAt,
    promoted_by: promotedBy,
    min_count: minCount,
    dry_run: dryRun,
    registry: loadGoldenCiRegistry(),
    promoted: promotedCases.map((c) => ({
      id: c.id,
      previous_id: candidates.find((x) => queryFingerprint(x.query) === queryFingerprint(c.query))?.id,
      query_preview: String(c.query).slice(0, 120),
      expected_top_intent: c.expectedTopIntent,
      ci_pass_count: c.ci_pass_count,
    })),
    skipped: exportedCases
      .filter((c) => !candidateIds.has(c.id) && !c.id.startsWith("baseline-"))
      .map((c) => ({
        id: c.id,
        ci_pass_count: getGoldenCiPassCount(c.id),
        reason:
          getGoldenCiPassCount(c.id) < minCount
            ? "ci_pass_count_below_threshold"
            : "validation_failed_or_already_baseline",
      })),
  };

  if (!dryRun && promotedCases.length > 0) {
    fs.mkdirSync(path.dirname(BASELINE_FIXTURE), { recursive: true });
    fs.writeFileSync(
      BASELINE_FIXTURE,
      renderBaselineFixtureModule(nextBaseline),
      "utf8",
    );

    fs.writeFileSync(
      EXPORTED_FIXTURE,
      renderGoldenFixtureModule(filteredExported, {
        feedbackPath: getIntentTriageFeedbackPath(),
        exportedAt: promotedAt.slice(0, 10),
      }),
      "utf8",
    );

    markFeedbackEntriesPromoted(
      promotedCases.map((c) => c.query),
      { promoted_at: promotedAt, promoted_by: promotedBy },
    );

    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    const reportPath = path.join(
      REPORTS_DIR,
      `promoted-cases-${promotedAt.slice(0, 10)}.json`,
    );
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    report.report_path = reportPath;
  }

  return {
    ...report,
    baseline_path: BASELINE_FIXTURE,
    exported_path: EXPORTED_FIXTURE,
    promoted_count: promotedCases.length,
    remaining_exported_count: filteredExported.length,
    next_baseline_count: nextBaseline.length,
  };
}
