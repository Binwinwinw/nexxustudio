import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { resolveExploratorySubjectAngleShortCircuit } from "../src/agent/policies/conversation/conversationFramingPolicy.js";
import { classifyMetaConversationIntent } from "../src/agent/utils/intent-guards/metaConversationIntentGuards.js";

const PAPOTER_HISTORY = [
  { role: "user", content: "salut" },
  {
    role: "assistant",
    content:
      "Salut ! Si tu veux on peut papoter ou je t'aide à cadrer un projet, clarifier un besoin, structurer des livrables. Qu'est-ce que tu veux faire ?",
  },
];

const CAPABILITY_CASES = [
  { q: "qu'est ce que tu sais faire ?", kind: "capability_overview" },
  { q: "qu'est-ce que tu sais faire ?", kind: "capability_overview" },
  { q: "que sais-tu faire ?", kind: "capability_overview" },
  { q: "tu peux faire quoi ?", kind: "capability_overview" },
  { q: "quelles sont tes capacités ?", kind: "capability_overview" },
  { q: "quelles sont tes compétences ?", kind: "capability_overview" },
  { q: "quelles sont tes competences ?", kind: "capability_overview" },
  { q: "quels sont tes savoir-faire ?", kind: "capability_overview" },
  { q: "quelle est ton expertise ?", kind: "capability_overview" },
  { q: "dans quels domaines peux-tu m'aider ?", kind: "help_scope" },
  { q: "comment peux-tu m'aider ?", kind: "help_scope" },
  { q: "à quoi sers-tu ?", kind: "capability_overview" },
  { q: "what can you do?", kind: "capability_overview" },
  { q: "qué sabes hacer?", kind: "capability_overview" },
  { q: "Réponds en anglais : que sais-tu faire ?", kind: "capability_overview" },
];

function assertCapabilityHit(hit, kind) {
  assert.equal(hit?.path, "meta_conversation_deterministic");
  assert.equal(hit?.metaSubKind, kind);
  assert.notEqual(hit?.path, "subject_angle_explore");
  assert.notEqual(hit?.path, "simple_factual_lookup");
  assert.notEqual(hit?.path, "exploratory_conversation_light");
  assert.doesNotMatch(
    hit?.reply || "",
    /donn[eé]e factuelle directe|reformulation pr[eé]alable|Sovereign|Planner|Composer/i,
  );
  assert.equal(hit?.skipPlanner, true);
  assert.equal(hit?.skipSovereign, true);
  assert.equal(hit?.skipWeb, true);
  assert.equal(hit?.skipComposer, true);
  assert.equal(hit?.deferToLlm, false);
  assert.ok(hit?.reply);
}

describe("CAPABILITIES_INTENT — overview / help_scope", () => {
  for (const { q, kind } of CAPABILITY_CASES) {
    it(`${q} → ${kind}, pas subject_angle`, async () => {
      assert.equal(classifyMetaConversationIntent(q)?.kind, kind);
      assert.equal(resolveExploratorySubjectAngleShortCircuit(q), null);

      const bare = await runConversationShortCircuit(q, { history: [] });
      assertCapabilityHit(bare, kind);

      const afterChat = await runConversationShortCircuit(q, {
        history: PAPOTER_HISTORY,
      });
      assertCapabilityHit(afterChat, kind);
    });
  }

  it("construis-moi un plan de projet → pas capacités", async () => {
    const q = "construis-moi un plan de projet";
    const kind = classifyMetaConversationIntent(q)?.kind;
    assert.notEqual(kind, "capability_overview");
    assert.notEqual(kind, "help_scope");
    const hit = await runConversationShortCircuit(q, { history: [] });
    assert.notEqual(hit?.metaSubKind, "capability_overview");
    assert.notEqual(hit?.metaSubKind, "help_scope");
  });

  it("après identité : quelles sont tes compétences ? → overview, pas factual/Sovereign", async () => {
    const q = "quelles sont tes compétences ?";
    const history = [
      { role: "user", content: "bonjour, comment t'appelles tu ?" },
      {
        role: "assistant",
        content: "NEXXUS — assistant souverain de La Citadelle / Nexxus Studio.",
      },
    ];
    const hit = await runConversationShortCircuit(q, { history });
    assertCapabilityHit(hit, "capability_overview");
    assert.notEqual(hit?.path, "simple_factual_lookup");
    assert.doesNotMatch(hit?.reply || "", /donn[eé]e factuelle directe/i);
  });

  it("explique-moi ce que fait ce code → pas capacités", async () => {
    const q = "explique-moi ce que fait ce code";
    const kind = classifyMetaConversationIntent(q)?.kind;
    assert.notEqual(kind, "capability_overview");
    assert.notEqual(kind, "help_scope");
    const hit = await runConversationShortCircuit(q, { history: [] });
    assert.notEqual(hit?.metaSubKind, "capability_overview");
    assert.notEqual(hit?.metaSubKind, "help_scope");
  });
});
