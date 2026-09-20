/**
 * P1-C — FIX-JUST-PHATIC-FAIS-SHADOW-NOISE
 * Shadow JUST seulement : phatique « fais » ≠ create/generate.
 * Routage SC inchangé.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  INTENT_ACTIONS,
  INTENT_DOMAINS,
} from "../../shared/justIntentCatalog.js";
import { evaluateJustIntent } from "../src/agent/policies/intent/justIntentDetectionPolicy.js";
import { resolveIntentComposition } from "../src/agent/policies/intent/intentCompositionPolicy.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { isPhaticSocialCheckinIntent } from "../src/agent/policies/social/index.js";

const PHATIC_FAIS = [
  "qu'est ce que tu fais de bon ?",
  "tu fais quoi de beau ?",
  "bonjour que fais tu ?",
  "sinon, tu fais quoi de beau ?",
];

describe("JUST-PHATIC-FAIS-SHADOW", () => {
  it("JUST-PHATIC-FAIS-01 — social/social_checkin, pas create", () => {
    for (const q of PHATIC_FAIS) {
      assert.equal(isPhaticSocialCheckinIntent(q), true, q);
      const just = evaluateJustIntent(q);
      assert.equal(just.domain, INTENT_DOMAINS.SOCIAL, q);
      assert.equal(just.action, INTENT_ACTIONS.SOCIAL_CHECKIN, q);
    }
  });

  it("JUST-PHATIC-FAIS-02 — composition primary ≠ generate", () => {
    for (const q of PHATIC_FAIS) {
      const just = evaluateJustIntent(q);
      const c = resolveIntentComposition(q, { justIntent: just });
      assert.notEqual(c.primary_action, "generate", q);
      assert.equal(c.primary_action, "social_checkin", q);
    }
  });

  it("JUST-PHATIC-FAIS-03 — SC social_deterministic inchangé", async () => {
    for (const q of PHATIC_FAIS) {
      const hit = await runConversationShortCircuit(q);
      assert.equal(hit?.path, "social_deterministic", q);
      assert.notEqual(hit?.path, "guided_creation_scoping", q);
    }
  });

  it("JUST-PHATIC-FAIS-04 — CREATE réel non régressé", () => {
    const cv = evaluateJustIntent("Fais-moi un CV moderne");
    assert.equal(cv.action, INTENT_ACTIONS.CREATE);
    const html = evaluateJustIntent("creer une page html pour mon portfolio avec header et sections");
    assert.equal(html.domain, INTENT_DOMAINS.WEB_HTML);
    assert.equal(html.action, INTENT_ACTIONS.CREATE);
    const review = evaluateJustIntent(
      "Fais une revue de code Python de ce snippet. Commence par les erreurs bloquantes.\ndef broken(): pass",
    );
    assert.equal(review.domain, INTENT_DOMAINS.CODE);
    assert.equal(review.action, INTENT_ACTIONS.REVIEW);
  });
});
