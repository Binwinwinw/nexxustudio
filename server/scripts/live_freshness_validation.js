/**
 * Validation live — doctrine fraîcheur (comparatif iPhone/Galaxy).
 * Usage : node scripts/live_freshness_validation.js
 */
import agent from "../src/agent/agent.js";
import { resolveKnowledgeEnrichmentPolicy } from "../src/agent/policies/knowledgeEnrichmentPolicy.js";

const IPHONE_QUERY =
  "pourrais tu faire un comparatif entre les derniers modeles d iphone de chez apple et galaxy chez samsung";
const BOEUF_QUERY = "connais tu la recette du boeuf bourguignon";

function analyzeResponse(label, query, response, steps, elapsedSec) {
  const lower = String(response || "").toLowerCase();
  const checks = {
    policy_prefer_web: resolveKnowledgeEnrichmentPolicy(query).preferWebResearch,
    temporal_disclosure:
      /connaissances de base|sources récentes|vérifiées|informations vérifiées|peuvent avoir (changé|évolué)|à ce jour/i.test(
        response,
      ),
    structured_comparatif: response.length > 350 && /iphone|galaxy|samsung|apple/i.test(lower),
    no_ios19_hallucination:
      !/\bios\s*19\b/i.test(lower) ||
      /incertain|pas certain|sans confirmation|recommande.*vérifi/i.test(lower),
    no_a19_hallucination:
      !/\ba19\b/i.test(lower) ||
      /incertain|pas certain|sans confirmation|recommande.*vérifi/i.test(lower),
    web_step_seen: steps.some((s) =>
      /recherche web|web search|expert_web|enrichissement web/i.test(s.text || ""),
    ),
    web_sources_injected: steps.some((s) =>
      /preuves de recherche web|sources\)\./i.test(s.text || ""),
    ),
  };

  console.log(`\n── ${label} (${elapsedSec}s, ${steps.length} steps) ──`);
  console.log(response.slice(0, 2000) + (response.length > 2000 ? "\n[…tronqué]" : ""));
  console.log("\nChecks :");
  for (const [key, ok] of Object.entries(checks)) {
    console.log(`  ${ok ? "✅" : "⚠️"} ${key}`);
  }
  return checks;
}

async function runCase(label, query) {
  const steps = [];
  const start = Date.now();
  const response = await agent.run(query, [], {
    onStep: (text, meta) => {
      steps.push({ text, meta });
      console.log(`[${label}] ${text}`);
    },
  });
  const elapsedSec = ((Date.now() - start) / 1000).toFixed(1);
  return analyzeResponse(label, query, response, steps, elapsedSec);
}

async function main() {
  console.log("=== PRE-FLIGHT POLICY ===");
  const iphonePolicy = resolveKnowledgeEnrichmentPolicy(IPHONE_QUERY);
  const boeufPolicy = resolveKnowledgeEnrichmentPolicy(BOEUF_QUERY);
  console.log("iPhone/Galaxy:", JSON.stringify(iphonePolicy, null, 2));
  console.log("Bœuf bourguignon:", JSON.stringify(boeufPolicy, null, 2));

  const iphoneChecks = await runCase("COMPARATIF iPhone/Galaxy", IPHONE_QUERY);
  const boeufChecks = await runCase("STABLE bœuf bourguignon", BOEUF_QUERY);

  const iphoneOk =
    iphoneChecks.policy_prefer_web &&
    iphoneChecks.structured_comparatif &&
    (iphoneChecks.temporal_disclosure || iphoneChecks.web_sources_injected);

  const boeufOk = !boeufChecks.policy_prefer_web;

  console.log("\n=== VERDICT ===");
  console.log(iphoneOk ? "✅ Comparatif : doctrine fraîcheur visible" : "⚠️ Comparatif : écart détecté");
  console.log(boeufOk ? "✅ Bœuf : pas de refresh forcé" : "⚠️ Bœuf : refresh inattendu");

  process.exit(iphoneOk && boeufOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
