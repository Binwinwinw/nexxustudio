import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  FAMILIARITY_DOMAIN_CANONICAL_DIOR_QUERY,
  FAMILIARITY_DOMAIN_CANONICAL_PHP_QUERY,
  FAMILIARITY_DOMAIN_CANONICAL_POLITIQUE_ALT_QUERY,
  FAMILIARITY_DOMAIN_CANONICAL_POLITIQUE_QUERY,
  isFamiliarityDomainOverviewSatisfiable,
  resolveFamiliarityDomainOverviewShortCircuit,
} from "../src/agent/policies/familiarity/index.js";
import {
  CLARIFICATION_DECISIONS,
  evaluateClarificationDecision,
} from "../src/agent/policies/clarificationDecisionPolicy.js";
import {
  evaluateJustIntent,
  isSimpleFactualQuestion,
} from "../src/agent/policies/justIntentDetectionPolicy.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { resolvePipelineFallback } from "../src/agent/utils/genericGreetingGuards.js";
import { INSUFFICIENT_SIGNAL_REFUSAL } from "../src/agent/config/modeResponseContracts.js";

describe("familiarityDomainOverviewPolicy — batterie #34", () => {
  it("politique française (t'y connais) → short-circuit domaine, pas simple_factual", async () => {
    assert.equal(
      isFamiliarityDomainOverviewSatisfiable(
        FAMILIARITY_DOMAIN_CANONICAL_POLITIQUE_QUERY,
      ),
      true,
    );
    assert.equal(
      isSimpleFactualQuestion(FAMILIARITY_DOMAIN_CANONICAL_POLITIQUE_QUERY),
      false,
    );

    const hit = await runConversationShortCircuit(
      FAMILIARITY_DOMAIN_CANONICAL_POLITIQUE_QUERY,
    );
    assert.equal(hit?.path, "familiarity_domain_overview_deterministic");
    assert.match(hit?.reply, /Oui, je peux t'aider/i);
    assert.match(hit?.reply, /politique/i);
    assert.match(hit?.reply, /institutions|partis|élections/i);
    assert.match(hit?.reply, /aperçu général ou une question précise/i);
    assert.doesNotMatch(hit?.reply, /géographie|histoire/i);
    assert.notEqual(hit?.reply, INSUFFICIENT_SIGNAL_REFUSAL);
  });

  it("tu connais la politique française → même couloir domaine", async () => {
    const hit = await runConversationShortCircuit(
      FAMILIARITY_DOMAIN_CANONICAL_POLITIQUE_ALT_QUERY,
    );
    assert.equal(hit?.path, "familiarity_domain_overview_deterministic");
    assert.match(hit?.reply, /politique/i);
    assert.match(hit?.reply, /institutions|partis/i);
    assert.doesNotMatch(hit?.reply, /géographie|histoire/i);
  });

  it("PHP → disponibilité technique avec angles", async () => {
    const hit = await runConversationShortCircuit(
      FAMILIARITY_DOMAIN_CANONICAL_PHP_QUERY,
    );
    assert.equal(hit?.path, "familiarity_domain_overview_deterministic");
    assert.match(hit?.reply, /PHP/i);
    assert.match(hit?.reply, /syntaxe|bonnes pratiques|frameworks/i);
    assert.doesNotMatch(hit?.reply, /géographie|histoire/i);
  });

  it("Dior → familiarité marque/mode, pas refus générique", async () => {
    const hit = await runConversationShortCircuit(
      FAMILIARITY_DOMAIN_CANONICAL_DIOR_QUERY,
    );
    assert.equal(hit?.path, "familiarity_domain_overview_deterministic");
    assert.match(hit?.reply, /Dior/i);
    assert.match(hit?.reply, /mode|maison|parfums|actualité/i);
    assert.doesNotMatch(hit?.reply, /géographie|précise l'angle/i);
  });

  it("clarification gate → can_answer_now + signal familiarity_domain_overview", () => {
    const decision = evaluateClarificationDecision(
      FAMILIARITY_DOMAIN_CANONICAL_POLITIQUE_QUERY,
      evaluateJustIntent(FAMILIARITY_DOMAIN_CANONICAL_POLITIQUE_QUERY),
    );
    assert.equal(decision.decision, CLARIFICATION_DECISIONS.CAN_ANSWER_NOW);
    assert.ok(
      decision.signals.includes("familiarity_domain_overview") ||
        decision.signals.includes("subject_reference_resume"),
    );
  });

  it("resolveFamiliarityDomainOverviewShortCircuit — structure", () => {
    const hit = resolveFamiliarityDomainOverviewShortCircuit(
      FAMILIARITY_DOMAIN_CANONICAL_POLITIQUE_QUERY,
    );
    assert.equal(hit?.path, "familiarity_domain_overview_deterministic");
    assert.equal(hit?.kind, "domain_readiness");
    assert.ok(hit?.rawSubject?.includes("politique"));
  });

  it("pipeline fallback empty_short_circuit_llm — pas géographie/histoire", () => {
    const fallback = resolvePipelineFallback({
      query: FAMILIARITY_DOMAIN_CANONICAL_POLITIQUE_QUERY,
      reason: "empty_short_circuit_llm",
    });
    assert.match(fallback, /Oui, je peux t'aider/i);
    assert.match(fallback, /politique/i);
    assert.doesNotMatch(fallback, /géographie|histoire|précise l'angle/i);
  });
});
