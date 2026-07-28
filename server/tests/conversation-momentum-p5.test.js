import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { resolveNextMove, countNumberedOptions } from "../src/agent/micro/momentum/nextMovePolicy.js";
import {
  buildDefaultRecommendation,
  enrichArchitectureOptionsReply,
} from "../src/agent/micro/momentum/defaultRecommendationBuilder.js";
import { applyConversationMomentum } from "../src/agent/micro/momentum/conversationMomentumOrchestrator.js";
import { buildArchitectureDesignReply } from "../src/agent/micro/replies/architectureDesignReplyBuilder.js";
import { CONVERSATION_NEXT_MOVES, INTENT_CONTRACTS } from "../src/agent/micro/momentum/conversationMoveTypes.js";
import { buildArchitectureDesignOptionsReply } from "../src/agent/utils/architectureDesignIntentGuards.js";

const CODE_REVIEWER_QUERY =
  "comment créer un code-reviewer qui analyse tout le code d'un projet";

describe("P5 — nextMovePolicy", () => {
  it("recommande quand plusieurs options et signal explorable", () => {
    const move = resolveNextMove({
      contractId: INTENT_CONTRACTS.ARCHITECTURE_OPTIONS,
      signal: "explorable",
      optionCount: 3,
    });
    assert.equal(move.move, CONVERSATION_NEXT_MOVES.RECOMMEND);
  });

  it("clarifie quand signal vague", () => {
    const move = resolveNextMove({
      contractId: INTENT_CONTRACTS.ARCHITECTURE_OPTIONS,
      signal: "vague",
      optionCount: 0,
    });
    assert.equal(move.move, CONVERSATION_NEXT_MOVES.CLARIFY);
  });

  it("compte les options numérotées", () => {
    const base = buildArchitectureDesignOptionsReply(CODE_REVIEWER_QUERY);
    assert.equal(countNumberedOptions(base), 3);
  });
});

describe("P5 — defaultRecommendationBuilder", () => {
  it("recommande intermédiaire pour code-reviewer", () => {
    const rec = buildDefaultRecommendation({
      contractId: INTENT_CONTRACTS.ARCHITECTURE_OPTIONS,
      query: CODE_REVIEWER_QUERY,
      signal: "explorable",
    });
    assert.ok(rec);
    assert.equal(rec.key, "intermediate");
    assert.match(rec.label, /intermédiaire|intermediaire/i);
    assert.match(rec.nextStep, /review senior/i);
  });

  it("recommande légère pour prototype rapide", () => {
    const rec = buildDefaultRecommendation({
      contractId: INTENT_CONTRACTS.ARCHITECTURE_OPTIONS,
      query: "comment créer un prototype rapide de linter",
      signal: "explorable",
    });
    assert.equal(rec.key, "light");
  });

  it("n'applique pas de recommandation si vague", () => {
    assert.equal(
      buildDefaultRecommendation({
        contractId: INTENT_CONTRACTS.ARCHITECTURE_OPTIONS,
        query: "comment créer",
        signal: "vague",
      }),
      null,
    );
  });
});

describe("P5 — enrichissement architecture", () => {
  it("inclut recommandation + prochain pas (critère v1)", () => {
    const reply = buildArchitectureDesignReply(CODE_REVIEWER_QUERY);
    assert.ok(reply);
    assert.match(reply, /Je partirais plutôt sur/i);
    assert.match(reply, /intermédiaire|intermediaire/i);
    assert.match(reply, /recommandée pour ton cas/i);
    assert.match(reply, /\*\*Prochain pas\*\*/i);
    assert.match(reply, /review senior/i);
    assert.ok(!/Tu vises plutôt une architecture conceptuelle/i.test(reply));
  });

  it("laisse le framing si signal vague", () => {
    const reply = buildArchitectureDesignReply("comment créer");
    assert.ok(reply);
    assert.match(reply, /architecture conceptuelle|prototype|implémentation/i);
    assert.ok(!/Je partirais plutôt sur/i.test(reply));
  });

  it("applyConversationMomentum retourne move recommend", () => {
    const base = buildArchitectureDesignOptionsReply(CODE_REVIEWER_QUERY);
    const out = applyConversationMomentum({
      contractId: INTENT_CONTRACTS.ARCHITECTURE_OPTIONS,
      query: CODE_REVIEWER_QUERY,
      baseReply: base,
      signal: "explorable",
    });
    assert.equal(out.move.move, CONVERSATION_NEXT_MOVES.RECOMMEND);
    assert.ok(out.recommendation);
    assert.match(out.reply, /\*\*Prochain pas\*\*/);
  });

  it("enrichArchitectureOptionsReply marque l'option recommandée", () => {
    const base = buildArchitectureDesignOptionsReply(CODE_REVIEWER_QUERY);
    const enriched = enrichArchitectureOptionsReply(base, {
      key: "intermediate",
      label: "l'approche intermédiaire (RAG + règles)",
      rationale: "test",
      nextStep: "étape test",
    });
    assert.match(enriched, /recommandée pour ton cas/);
    assert.match(enriched, /Prochain pas.*étape test/);
  });
});
