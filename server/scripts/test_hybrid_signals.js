import { evaluateJustIntent } from "../src/agent/policies/justIntentDetectionPolicy.js";

const queries = [
  "ok, corrige ça",
  "parfait, continue le plan",
  "on reprend",
  "continue",
  "on reprend le point sur le PowerPoint",
  "ok, et maintenant...",
  "continue avec le CV"
];

console.log("=== AUDIT SIGNAUX HYBRIDES ===");
for (const q of queries) {
  const ev = evaluateJustIntent(q);
  console.log(`\nQuery: "${q}"`);
  console.log(`Domain: ${ev.domain}`);
  console.log(`Action: ${ev.action}`);
  console.log(`Strategy: ${ev.strategy}`);
  console.log(`Can Build Directly: ${ev.canBuildDirectly}`);
}
