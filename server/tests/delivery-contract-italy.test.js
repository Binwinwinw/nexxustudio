import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { isSimpleFactualQuestion, evaluateJustIntent, shouldApplyJustIntentClarification } from "../src/agent/policies/intent/justIntentDetectionPolicy.js";
import { shouldDeferShortCircuitToFullPipeline } from "../src/agent/policies/practicalAdviceRoutingGuard.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { parseFamiliarityQuery, isFamiliarityIntent } from "../src/agent/utils/familiarityIntentGuards.js";
import { resolveLocalDeterministicFallback } from "../src/agent/utils/genericGreetingGuards.js";

const ITALY_QUERY = "que sais tu du pays appelé Italie? ?";

describe("contrat de livraison — Italie (du pays appelé)", () => {
  it("parse familiarité overview avec « du »", () => {
    const parsed = parseFamiliarityQuery(ITALY_QUERY);
    assert.ok(parsed);
    assert.equal(parsed.kind, "overview");
    assert.match(parsed.rawSubject, /italie/i);
  });

  it("n'est plus classé simple_factual_lookup", () => {
    assert.equal(isFamiliarityIntent(ITALY_QUERY), true);
    assert.equal(isSimpleFactualQuestion(ITALY_QUERY), false);
  });

  it("short-circuit → familiarity_deterministic avec réponse Italie", async () => {
    const hit = await runConversationShortCircuit(ITALY_QUERY);
    assert.ok(hit);
    assert.equal(hit.path, "familiarity_deterministic");
    assert.match(hit.reply, /Italie/i);
    assert.equal(hit.deferToFullPipeline, undefined);
  });

  it("simple_factual_lookup ne force plus deferToFullPipeline", async () => {
    const factualHit = await runConversationShortCircuit(
      "Dans quelle ville se trouve le Parc Astérix ?",
    );
    assert.equal(factualHit.path, "simple_factual_lookup");
    assert.equal(factualHit.deferToFullPipeline, undefined);
    assert.equal(
      shouldDeferShortCircuitToFullPipeline(factualHit, "Parc Astérix"),
      false,
    );
  });

  it("just_intent ne déclenche pas clarify_then_build ni clarification", () => {
    const ev = evaluateJustIntent(ITALY_QUERY);
    assert.equal(ev.strategy, "build_v1");
    assert.equal(ev.canBuildDirectly, true);
    assert.equal(shouldApplyJustIntentClarification(ITALY_QUERY, ev, null), false);
  });

  it("à propos de l'Italie sans ? → familiarity, pas factuel ni recovery", async () => {
    const q = "que sais tu à propos de l'italie";
    assert.equal(isSimpleFactualQuestion(q), false);
    assert.equal(parseFamiliarityQuery(q)?.kind, "overview");
    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "familiarity_deterministic");
    assert.match(hit?.reply || "", /Italie/i);
    const local = resolveLocalDeterministicFallback(q);
    assert.ok(local);
    assert.match(local, /Italie/i);
  });
});
