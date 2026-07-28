import { evaluateJustIntent } from "../src/agent/policies/justIntentDetectionPolicy.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import agent from "../src/agent/agent.js";

const queries = [
  "salut",
  "ok",
  "salut, continue le plan",
  "salut salut, merci beaucoup"
];

console.log("=== AUDIT ROBUSTESSE INTENT ROUTING ===");

async function runAudit() {
  for (const q of queries) {
    const justIntent = evaluateJustIntent(q);
    
    const hit = await runConversationShortCircuit(q, {
      justIntent,
      getDeterministicSocialResponse: agent.getDeterministicSocialResponse.bind(agent),
    });

    console.log(`\nQuery: "${q}"`);
    console.log(` -> Domain: ${justIntent.domain}`);
    console.log(` -> Action: ${justIntent.action}`);
    if (hit) {
      console.log(` -> Pipeline Route: ${hit.path}`);
      console.log(` -> Step: ${hit.step}`);
      console.log(` -> Reply: ${hit.reply}`);
    } else {
      console.log(` -> Pipeline Route: [FALLTHROUGH TO FULL PIPELINE]`);
    }
  }
}

runAudit();
