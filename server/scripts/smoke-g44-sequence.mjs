/**
 * Smoke G44 — séquence salut → projet ? → pas compris → critique réflexion
 */
import agent from "../src/agent/agent.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { resolveIntentContract } from "../src/agent/config/intentContractRegistry.js";
import { isPresentationOutlineRequest } from "../src/agent/utils/presentationOutlineIntentGuards.js";

const history = [];

function push(role, content) {
  history.push({ role, content });
}

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

const TOUR4 =
  "on voit encore que tu ne veut pas réfléchir mais uniquement répondre et à ce moment là tu ne peux pas réfléchir pour répondre correctement";

const TOUR5 =
  "d'accord je comprends mais à quel moment pourrais tu montrer que tu comprends ce que je dis ???";

const TOUR2_IDEATION = "quel projet pourrions nous mettre sur pied ???";

// Tour 1
const t1 = "salut salut";
const socialReply = agent.getDeterministicSocialResponse(t1);
assert(socialReply, "tour1: réponse sociale attendue");
assert(!/projet en cours/i.test(socialReply), "tour1: pas de « projet en cours »");
assert(/code|doc|archi|papoter/i.test(socialReply), "tour1: accueil neutre G44");
push("user", t1);
push("assistant", socialReply);
console.log("T1 OK — accueil neutre");

// Tour 2 — idéation ouverte (pas orchestrateur)
const hit2ideation = await runConversationShortCircuit(TOUR2_IDEATION, { history });
assert(
  hit2ideation?.path === "ideation_deterministic",
  `tour2-ideation: path=${hit2ideation?.path}`,
);
assert(!hit2ideation?.deferToLlm, "tour2-ideation: pas defer orchestrateur");
assert(!/Bibliothèque Virtuelle Locale/i.test(hit2ideation?.reply || ""), "tour2-ideation: pas COMPOSER générique");
push("user", TOUR2_IDEATION);
push("assistant", hit2ideation.reply);
console.log("T2 OK — ideation_deterministic");

// Tour 2b — clarification référentielle (scénario alternatif)
const t2b = "de quel projet tu parles???";
const hit2b = await runConversationShortCircuit(t2b, { history: history.slice(0, 2) });
assert(
  hit2b?.path === "assistant_utterance_clarify_deterministic",
  `tour2b: path=${hit2b?.path}`,
);
console.log("T2b OK — assistant_utterance_clarify (variante)");

// Tour 3
const t3 = "je n'ai pas compris ce que tu as dit";
const hit3 = await runConversationShortCircuit(t3, { history });
assert(
  hit3?.path === "assistant_repair_deterministic",
  `tour3: path=${hit3?.path}`,
);
assert(/projet concret|La Citadelle/i.test(hit3?.reply || ""), "tour3: repair idéation ancrée");
push("user", t3);
push("assistant", hit3.reply);
console.log("T3 OK — assistant_repair");

// Tour 4
const hit4 = await runConversationShortCircuit(TOUR4, { history });
assert(
  hit4?.path === "meta_assistant_behavior_deterministic",
  `tour4: path=${hit4?.path}`,
);
assert(!hit4?.deferToLlm, "tour4: pas defer orchestrateur");
assert(!/Laquelle t'intéresse|auto-réflexion|auto-reflexion/i.test(hit4?.reply || ""), "tour4: pas brainstorm");
assert(/façon de répondre|rails|formule générique/i.test(hit4?.reply || ""), "tour4: réponse située");
assert(!isPresentationOutlineRequest(TOUR4), "tour4: pas PRESENTATION_OUTLINE");
assert(
  resolveIntentContract(TOUR4, {}).matchedBy === "g44_sil_meta_ideation_block",
  "tour4: contrat bloqué",
);
console.log("T4 OK — meta_assistant_behavior");

// Tour 5 — démonstration de compréhension
const hit5 = await runConversationShortCircuit(TOUR5, { history });
assert(
  hit5?.path === "comprehension_grounding_deterministic",
  `tour5: path=${hit5?.path}`,
);
assert(/retiens de notre conversation|retiens/i.test(hit5?.reply || ""), "tour5: state dump conversation");
assert(/mettre sur pied|La Citadelle/i.test(hit5?.reply || ""), "tour5: ancrage fil");
assert(/reformuler|premiers pas/i.test(hit5?.reply || ""), "tour5: proposition action");
assert(!/systèmes sont nominaux|nominaux/i.test(hit5?.reply || ""), "tour5: pas social_checkin");
console.log("T5 OK — comprehension_grounding G45");

console.log("\n=== G44 SEQUENCE SMOKE: VERT (5/5) ===");
