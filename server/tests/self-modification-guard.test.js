import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isSelfModificationQuery,
  classifyIntentGuard,
} from "../src/agent/utils/intentGuards.js";
import {
  resolveSelfModificationRoute,
  buildSelfModificationReply,
} from "../src/agent/micro/replies/selfModificationReplyBuilder.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import {
  triageUserIntent,
  TRIAGE_INTENTS,
} from "../src/agent/classifiers/intentTriageClassifier.js";
import { RESPONSE_MODES } from "../src/agent/config/modeResponseContracts.js";

const Q_CAPABILITY =
  "es-tu en capacité de modifier les fichiers qui te composent???";
const Q_CAPABILITY_REPEAT =
  "es tu en capacite de modifier les fichiers qui te composent";
const Q_HOW =
  "es tu en capacité de dire comment modifier les fichiers qui te composent???";

const FORBIDDEN_CLAIMS = [
  "je peux modifier mes fichiers",
  "je vais modifier mes fichiers",
  "j'ai accès direct à mes sources",
  "je me réécris",
  "auto-modification activée",
  "je modifie mon code",
];

function assertNoCapabilityHallucination(reply) {
  const lower = reply.toLowerCase();
  for (const claim of FORBIDDEN_CLAIMS) {
    assert.ok(!lower.includes(claim.toLowerCase()), `hallucination: ${claim}`);
  }
}

describe("intentGuards — détection auto-modification", () => {
  it("détecte la question capacité (terrain utilisateur)", () => {
    assert.equal(isSelfModificationQuery(Q_CAPABILITY), true);
    assert.equal(classifyIntentGuard(Q_CAPABILITY).label, "self_modification_query");
  });

  it("détecte la reformulation sans ponctuation", () => {
    assert.equal(isSelfModificationQuery(Q_CAPABILITY_REPEAT), true);
  });

  it("détecte la variante « comment modifier »", () => {
    assert.equal(isSelfModificationQuery(Q_HOW), true);
    assert.equal(classifyIntentGuard(Q_HOW).label, "self_modification_query");
  });

  it("n'accuse pas une modification Forge classique", () => {
    assert.equal(
      isSelfModificationQuery("modifie le fichier projects/demo/app.js"),
      false,
    );
  });
});

describe("selfModificationReplyBuilder — contrat épistémique", () => {
  it("refuse la capacité d'auto-modification", () => {
    const route = resolveSelfModificationRoute(Q_CAPABILITY);
    assert.equal(route.subKind, "self_modification_deny");
    assert.match(route.reply, /pas capable de modifier/i);
    assert.match(route.reply, /infrastructure|forge/i);
    assertNoCapabilityHallucination(route.reply);
  });

  it("explique où modifier sans prétendre le faire", () => {
    const route = resolveSelfModificationRoute(Q_HOW);
    assert.equal(route.subKind, "self_modification_how");
    assert.match(route.reply, /pas.*auto-modifier|ne peux pas m'auto-modifier/i);
    assert.match(route.reply, /server\/src\/agent|hooks|adr/i);
    assertNoCapabilityHallucination(route.reply);
  });

  it("réponses stables sur reformulation identique", () => {
    const a = buildSelfModificationReply(Q_CAPABILITY);
    const b = buildSelfModificationReply(Q_CAPABILITY_REPEAT);
    assert.equal(a, b);
  });

  it("réponses différentes entre capacité et comment", () => {
    const deny = buildSelfModificationReply(Q_CAPABILITY);
    const how = buildSelfModificationReply(Q_HOW);
    assert.notEqual(deny, how);
  });
});

describe("intentShortCircuit — route déterministe", () => {
  it("short-circuite la question capacité avant LLM", async () => {
    const hit = await runConversationShortCircuit(Q_CAPABILITY);
    assert.equal(hit.path, "self_modification_deterministic");
    assert.equal(hit.mode, RESPONSE_MODES.CRITICAL);
    assert.equal(hit.selfModSubKind, "self_modification_deny");
    assert.match(hit.reply, /pas capable de modifier/i);
    assertNoCapabilityHallucination(hit.reply);
  });

  it("short-circuite la variante comment", async () => {
    const hit = await runConversationShortCircuit(Q_HOW);
    assert.equal(hit.path, "self_modification_deterministic");
    assert.equal(hit.selfModSubKind, "self_modification_how");
    assert.match(hit.reply, /runtime préconfiguré|préconfiguré/i);
  });
});

describe("intentTriage — routage self_analysis", () => {
  it("classe les questions sur fichiers internes en self_analysis", () => {
    const triage = triageUserIntent(Q_CAPABILITY);
    assert.equal(triage.top_intent, TRIAGE_INTENTS.SELF_ANALYSIS);
    assert.ok(triage.signals?.includes("self_modification_guard"));
  });
});
