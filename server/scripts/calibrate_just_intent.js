/**
 * Calibration JUST_INTENT_DETECTION_V1 — corpus statique sans LLM.
 */
import { evaluateJustIntent } from "../src/agent/policies/justIntentDetectionPolicy.js";
import { JUST_INTENT_THRESHOLDS } from "../src/agent/policies/justIntentThresholds.js";
import { buildJustIntentTelemetryEvent } from "../src/agent/telemetry/justIntentTelemetry.js";

/** @type {Array<{ id: string, query: string, expectDomain: string, expectAction?: string, expectDeliverable?: string, expectStrategy: string, note?: string }>} */
const CALIBRATION_CORPUS = [
  {
    id: "code_review",
    query:
      "Fais une revue de code Python de ce snippet. Commence par les erreurs bloquantes.\ndef broken(): pass",
    expectDomain: "code",
    expectAction: "review",
    expectStrategy: "build_v1",
  },
  {
    id: "ppt_soutenance",
    query: "Crée un PowerPoint pour ma soutenance de 15 minutes",
    expectDomain: "presentation",
    expectAction: "create",
    expectDeliverable: "ppt_slides",
    expectStrategy: "build_v1",
  },
  {
    id: "cv_moderne",
    query: "Fais-moi un CV moderne",
    expectDomain: "document",
    expectDeliverable: "cv",
    expectStrategy: "build_with_smart_defaults",
  },
  {
    id: "security_rules",
    query: "Rédige des règles de sécurité pour une équipe support",
    expectDomain: "security_policy",
    expectDeliverable: "policy_rules",
    expectStrategy: "build_v1",
  },
  {
    id: "dissertation",
    query: "Fais une dissertation sur l'IA et l'éducation",
    expectDomain: "writing",
    expectDeliverable: "essay",
    expectStrategy: "build_v1",
  },
  {
    id: "html_vague",
    query: "fais une page html",
    expectDomain: "web_html",
    expectStrategy: "clarify_then_build",
    note: "Ambiguïté — clarification attendue",
  },
  {
    id: "notion_workshop",
    query:
      "sais tu créer un atelier d'initiation à NOTION sous forme de fichier html avec header sidebar?",
    expectDomain: "web_html",
    expectStrategy: "build_v1",
  },
  {
    id: "compare_smartphones",
    query: "compare les meilleurs smartphones milieu de gamme en 2026",
    expectDomain: "analysis",
    expectAction: "compare",
    expectStrategy: "build_v1",
  },
  {
    id: "salut",
    query: "salut",
    expectDomain: "general",
    expectStrategy: "clarify_then_build",
    note: "Social — pas de clarification pipeline (garde-fou)",
  },
];

function evaluateCase(item) {
  const ev = evaluateJustIntent(item.query);
  const mismatches = [];

  if (ev.domain !== item.expectDomain) {
    mismatches.push(`domain: got ${ev.domain}, expected ${item.expectDomain}`);
  }
  if (item.expectAction && ev.action !== item.expectAction) {
    mismatches.push(`action: got ${ev.action}, expected ${item.expectAction}`);
  }
  if (item.expectDeliverable && ev.deliverable !== item.expectDeliverable) {
    mismatches.push(
      `deliverable: got ${ev.deliverable}, expected ${item.expectDeliverable}`,
    );
  }
  if (ev.strategy !== item.expectStrategy) {
    mismatches.push(`strategy: got ${ev.strategy}, expected ${item.expectStrategy}`);
  }

  return {
    id: item.id,
    domain: ev.domain,
    action: ev.action,
    deliverable: ev.deliverable,
    strategy: ev.strategy,
    mismatches,
    note: item.note || "",
  };
}

function main() {
  console.log("=== CALIBRATION JUST_INTENT_DETECTION_V1 ===\n");
  console.log("Seuils actifs:", JSON.stringify(JUST_INTENT_THRESHOLDS, null, 2));
  console.log("");

  console.log("| id | domain | action | deliverable | strategy | note |");
  console.log("|---|:---:|:---:|:---:|:---:|---|");

  const results = CALIBRATION_CORPUS.map((item) => {
    const r = evaluateCase(item);
    const status = r.mismatches.length ? "⚠️" : "✅";
    console.log(
      `| ${status} ${r.id} | ${r.domain} | ${r.action} | ${r.deliverable} | ${r.strategy} | ${r.note} |`,
    );
    console.log(
      `[JUST_INTENT] ${JSON.stringify(buildJustIntentTelemetryEvent(item.query))}`,
    );
    return r;
  });

  const failures = results.filter((r) => r.mismatches.length > 0);
  console.log(`\n=== ÉCARTS vs ATTENDU : ${failures.length} / ${results.length} ===`);
  for (const f of failures) {
    console.log(`  ⚠️  ${f.id}: ${f.mismatches.join(" ; ")}`);
  }

  const ok = failures.length === 0;
  console.log(
    ok
      ? "\n✅ Corpus calibration — tous les cas conformes."
      : "\n⚠️ Corpus calibration — ajuster justIntentThresholds.js ou heuristiques.",
  );
  process.exit(ok ? 0 : 1);
}

main();
