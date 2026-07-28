/**
 * Calibration HTML_PROJECT_DELIVERY_V1 — corpus statique, sans LLM.
 * Mesure strategy/profile et compare aux attentes documentées.
 */
import {
  evaluateHtmlProjectDelivery,
  isHtmlProjectDeliverable,
} from "../src/agent/policies/htmlProjectDeliveryPolicy.js";
import { HTML_PROJECT_THRESHOLDS } from "../src/agent/policies/htmlProjectDeliveryThresholds.js";
import {
  buildHtmlProjectTelemetryEvent,
  shortenHtmlProjectProfile,
} from "../src/agent/telemetry/htmlProjectDeliveryTelemetry.js";

/** @type {Array<{ id: string, query: string, expectDetected?: boolean, expectStrategy?: string, expectProfile?: string, note?: string }>} */
const CALIBRATION_CORPUS = [
  {
    id: "notion_workshop",
    query:
      "sais tu créer un atelier d'initiation à l'application NOTION sous forme de fichier html avec header sidebar sur les différents thèmes comme menus?",
    expectDetected: true,
    expectStrategy: "build_v1",
    expectProfile: "workshop",
    note: "Référence terrain — atelier structuré",
  },
  {
    id: "landing_saas",
    query: "crée une landing page html pour mon produit SaaS avec hero et CTA",
    expectDetected: true,
    expectStrategy: "build_v1",
    expectProfile: "landing",
  },
  {
    id: "dashboard_admin",
    query: "génère un dashboard html tableau de bord admin avec sidebar et stats",
    expectDetected: true,
    expectStrategy: "build_v1",
    expectProfile: "dashboard",
  },
  {
    id: "template_demo",
    query: "crée un template html de démo responsive",
    expectDetected: true,
    expectStrategy: "build_with_smart_defaults",
    expectProfile: "template",
  },
  {
    id: "very_vague",
    query: "fais une page html",
    expectDetected: true,
    expectStrategy: "clarify_then_build",
    expectProfile: "generic",
    note: "Ambiguïté forte — clarification attendue",
  },
  {
    id: "portfolio_sections",
    query: "page html portfolio avec header et sections",
    expectDetected: true,
    expectStrategy: "build_v1",
    expectProfile: "info_page",
    note: "Court mais structuré — ne doit pas clarify",
  },
  {
    id: "short_clear_sidebar",
    query: "fichier html sidebar sections notion",
    expectDetected: true,
    expectStrategy: "build_v1",
    expectProfile: "workshop",
    note: "Court (<45) mais signaux structure+sujet",
  },
  {
    id: "not_html",
    query: "explique moi les fractions en mathématiques",
    expectDetected: false,
  },
  {
    id: "python_not_html",
    query: "écris un script python qui lit un fichier json",
    expectDetected: false,
  },
];

function evaluateCase(item) {
  const detected = isHtmlProjectDeliverable(item.query);
  const evaluation = evaluateHtmlProjectDelivery(item.query);
  const telemetry = buildHtmlProjectTelemetryEvent(item.query);

  const mismatches = [];
  if (item.expectDetected !== undefined && detected !== item.expectDetected) {
    mismatches.push(`detected: got ${detected}, expected ${item.expectDetected}`);
  }
  if (item.expectStrategy && evaluation.strategy !== item.expectStrategy) {
    mismatches.push(`strategy: got ${evaluation.strategy}, expected ${item.expectStrategy}`);
  }
  if (item.expectProfile && shortenHtmlProjectProfile(evaluation.profile) !== item.expectProfile) {
    mismatches.push(
      `profile: got ${shortenHtmlProjectProfile(evaluation.profile)}, expected ${item.expectProfile}`,
    );
  }

  return {
    id: item.id,
    detected,
    strategy: evaluation.strategy,
    profile: shortenHtmlProjectProfile(evaluation.profile),
    clarification_count: evaluation.clarificationQuestions.length,
    query_length: telemetry.query_length,
    mismatches,
    note: item.note || "",
  };
}

function printSummary(results) {
  const byStrategy = {};
  for (const r of results) {
    if (!r.detected) continue;
    byStrategy[r.strategy] = (byStrategy[r.strategy] || 0) + 1;
  }

  console.log("\n=== RÉPARTITION STRATÉGIES (HTML détecté) ===");
  for (const [strategy, count] of Object.entries(byStrategy)) {
    console.log(`  ${strategy}: ${count}`);
  }

  const failures = results.filter((r) => r.mismatches.length > 0);
  console.log(`\n=== ÉCARTS vs ATTENDU : ${failures.length} / ${results.length} ===`);
  for (const f of failures) {
    console.log(`  ⚠️  ${f.id}: ${f.mismatches.join(" ; ")}`);
  }

  return failures.length === 0;
}

function main() {
  console.log("=== CALIBRATION HTML_PROJECT_DELIVERY_V1 ===\n");
  console.log("Seuils actifs:", JSON.stringify(HTML_PROJECT_THRESHOLDS, null, 2));
  console.log("");

  console.log("| id | detected | strategy | profile | clarify | len | note |");
  console.log("|---|:---:|:---:|:---:|:---:|:---:|---|");

  const results = CALIBRATION_CORPUS.map((item) => {
    const r = evaluateCase(item);
    const status = r.mismatches.length ? "⚠️" : "✅";
    console.log(
      `| ${status} ${r.id} | ${r.detected} | ${r.strategy || "-"} | ${r.profile || "-"} | ${r.clarification_count} | ${r.query_length} | ${r.note} |`,
    );
    console.log(
      `[HTML_PROJECT_DELIVERY] ${JSON.stringify(buildHtmlProjectTelemetryEvent(item.query))}`,
    );
    return r;
  });

  const ok = printSummary(results);
  console.log(
    ok
      ? "\n✅ Corpus calibration — tous les cas conformes aux attentes."
      : "\n⚠️ Corpus calibration — écarts détectés : ajuster htmlProjectDeliveryThresholds.js",
  );
  process.exit(ok ? 0 : 1);
}

main();
