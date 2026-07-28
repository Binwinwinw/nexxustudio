/**
 * Fuzz — variantes de formulation vs rails attendus (G45 honnêteté).
 */
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import {
  isComprehensionDemonstrationRequest,
  isMetaAssistantBehaviorRequest,
} from "../src/agent/utils/metaAssistantBehaviorGuards.js";
import { isIdeationIntent } from "../src/agent/utils/ideationIntentGuards.js";

const history = [
  { role: "user", content: "salut salut" },
  { role: "assistant", content: "Salut ! Je suis là." },
  { role: "user", content: "quel projet pourrions nous mettre sur pied ???" },
  { role: "assistant", content: "3 pistes RAG, auto, mini-app." },
];

const cases = [
  { q: "à quel moment pourrais tu montrer que tu comprends ce que je dis ???", expect: "comprehension_grounding_deterministic" },
  { q: "tu comprends vraiment ce que je dis ?", expect: "comprehension_grounding_deterministic" },
  { q: "montre moi que tu as saisi la conversation", expect: "comprehension_grounding_deterministic" },
  { q: "est-ce que tu as compris mon intention", expect: "comprehension_grounding_deterministic" },
  { q: "prouve que tu suis le fil", expect: "comprehension_grounding_deterministic" },
  { q: "quel projet on pourrait lancer ensemble", expect: "ideation_deterministic" },
  { q: "on pourrait faire quoi comme projet", expect: "ideation_deterministic" },
  { q: "comment ca va", expect: "social_deterministic" },
  { q: "comment vas-tu", expect: "social_deterministic" },
];

let leaks = 0;
for (const { q, expect } of cases) {
  const comp = isComprehensionDemonstrationRequest(q);
  const meta = isMetaAssistantBehaviorRequest(q);
  const ideation = isIdeationIntent(q);
  const hit = await runConversationShortCircuit(q, { history });
  const path = hit?.path || "MISS";
  const ok = expect === "LEAK" ? !comp && path !== "comprehension_grounding_deterministic" : path === expect;
  if (!ok) leaks++;
  console.log(
    `${ok ? "OK" : "LEAK"} | comp=${comp} meta=${meta} ideation=${ideation} | path=${path} | expect=${expect}`,
  );
  console.log(`     q="${q}"`);
}

console.log(`\n=== FUZZ: ${leaks} écart(s) sur ${cases.length} variantes ===`);
process.exit(leaks > 0 ? 1 : 0);
