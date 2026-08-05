import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { evaluateJustIntent, shouldApplyJustIntentClarification } from "../src/agent/policies/intent/justIntentDetectionPolicy.js";
import {
  CLARIFICATION_DECISIONS,
  CLARIFICATION_GATE_PIPELINE_PATH,
  CLARIFICATION_ROUTING_RULE,
  CLARIFICATION_SOURCES,
  evaluateClarificationDecision,
  isAvoidableClarification,
  isBlockingAmbiguityQuery,
  normalizeQueryForClarificationGate,
  resolveClarificationGate,
} from "../src/agent/policies/routing/clarificationDecisionPolicy.js";
import { TRIAGE_ROUTING_ACTION } from "../src/agent/classifiers/intentTriageClassifier.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { buildJustIntentTelemetryEvent } from "../src/agent/telemetry/justIntentTelemetry.js";
import { CLARIFICATION_CORPUS } from "./fixtures/clarification-decision-corpus.js";

describe("clarificationDecisionPolicy — contrat", () => {
  it("expose la règle de routage Citadelle", () => {
    assert.match(CLARIFICATION_ROUTING_RULE, /blocking_ambiguity/);
  });

  it("Italie → can_answer_now, pas de clarification", () => {
    const q = "Que sais-tu du pays appelé Italie ?";
    const evaluation = evaluateJustIntent(q);
    const decision = evaluateClarificationDecision(q, evaluation);
    assert.equal(decision.decision, CLARIFICATION_DECISIONS.CAN_ANSWER_NOW);
    assert.equal(shouldApplyJustIntentClarification(q, evaluation, null), false);
    assert.equal(decision.avoidableClarification, true);
  });

  it("fais quelque chose → needs_clarification", () => {
    const q = "fais quelque chose";
    const evaluation = evaluateJustIntent(q);
    const decision = evaluateClarificationDecision(q, evaluation);
    assert.equal(decision.decision, CLARIFICATION_DECISIONS.NEEDS_CLARIFICATION);
    assert.equal(shouldApplyJustIntentClarification(q, evaluation, null), true);
    assert.equal(isBlockingAmbiguityQuery(q), true);
  });

  it("CV court → can_answer_with_assumptions", () => {
    const q = "Fais-moi un CV moderne";
    const evaluation = evaluateJustIntent(q);
    const decision = evaluateClarificationDecision(q, evaluation);
    assert.equal(
      decision.decision,
      CLARIFICATION_DECISIONS.CAN_ANSWER_WITH_ASSUMPTIONS,
    );
    assert.equal(shouldApplyJustIntentClarification(q, evaluation, null), false);
  });

  it("télémétrie — clarification_avoidable si clarificationUsed sur familiarité", () => {
    const q = "Que sais-tu du pays appelé Italie ?";
    const event = buildJustIntentTelemetryEvent(q, { clarificationUsed: true });
    assert.equal(event.clarification_decision, CLARIFICATION_DECISIONS.CAN_ANSWER_NOW);
    assert.equal(event.clarification_avoidable, true);
    assert.equal(
      isAvoidableClarification(
        evaluateClarificationDecision(q, evaluateJustIntent(q)),
        { clarificationUsed: true },
      ),
      true,
    );
  });
});

describe("clarificationGate — porte unique lot 1", () => {
  it("Italie avec double ? — can_answer_now, pas de clarification", () => {
    const q = "que sais tu du pays appelé Italie? ?";
    const evaluation = evaluateJustIntent(q);
    const gate = resolveClarificationGate(q, { justIntent: evaluation, intentTriage: null });
    assert.equal(gate.decision.decision, CLARIFICATION_DECISIONS.CAN_ANSWER_NOW);
    assert.equal(gate.shouldClarify, false);
    assert.equal(normalizeQueryForClarificationGate(q).includes("? ?"), false);
    assert.match(normalizeQueryForClarificationGate(q), /italie/);
  });

  it("triage ASK_CLARIFICATION + familiarité answerable → triage supprimé, pas de clarification", () => {
    const q = "Que sais-tu du pays appelé Italie ?";
    const evaluation = evaluateJustIntent(q);
    const intentTriage = {
      top_intent: "general",
      runner_up: "document_analysis",
      confidence: "low",
      needs_clarification: true,
      routing_action: TRIAGE_ROUTING_ACTION.ASK_CLARIFICATION,
    };
    const gate = resolveClarificationGate(q, { justIntent: evaluation, intentTriage });
    assert.equal(gate.shouldClarify, false);
    assert.equal(gate.triageSuppressed, true);
    assert.equal(gate.decision.decision, CLARIFICATION_DECISIONS.CAN_ANSWER_NOW);
  });

  it("fais quelque chose → clarification gate unique", () => {
    const q = "fais quelque chose";
    const evaluation = evaluateJustIntent(q);
    const gate = resolveClarificationGate(q, { justIntent: evaluation, intentTriage: null });
    assert.equal(gate.shouldClarify, true);
    assert.equal(gate.pipelinePath, CLARIFICATION_GATE_PIPELINE_PATH);
    assert.equal(gate.source, CLARIFICATION_SOURCES.BLOCKING_AMBIGUITY);
    assert.match(gate.message, /Il faudrait que tu arrives à préciser/);
  });

  it("fais une page html → clarification just_intent (questions structurées)", () => {
    const q = "fais une page html";
    const evaluation = evaluateJustIntent(q);
    const gate = resolveClarificationGate(q, { justIntent: evaluation, intentTriage: null });
    assert.equal(gate.shouldClarify, true);
    assert.equal(gate.source, CLARIFICATION_SOURCES.JUST_INTENT);
    assert.match(gate.message, /Il faudrait que tu arrives à préciser/);
  });
});

describe("clarificationDecisionPolicy — corpus non-régression", () => {
  for (const [family, cases] of Object.entries(CLARIFICATION_CORPUS)) {
    describe(family, () => {
      for (const { query, expectedDecision } of cases) {
        it(`${query.slice(0, 48)} → ${expectedDecision}`, async () => {
          const evaluation = evaluateJustIntent(query);
          const decision = evaluateClarificationDecision(query, evaluation);
          assert.equal(
            decision.decision,
            expectedDecision,
            `reason=${decision.reason}`,
          );

          if (expectedDecision === CLARIFICATION_DECISIONS.NEEDS_CLARIFICATION) {
            assert.equal(
              shouldApplyJustIntentClarification(query, evaluation, null),
              true,
            );
          } else {
            assert.equal(
              shouldApplyJustIntentClarification(query, evaluation, null),
              false,
            );
            const hit = await runConversationShortCircuit(query);
            if (family === "encyclopedic_familiarity") {
              assert.equal(hit?.path, "familiarity_deterministic");
            }
            if (family === "explanatory_general_knowledge") {
              assert.ok(
                hit?.path === "general_knowledge_deterministic" ||
                  hit?.path === "general_knowledge_full_pipeline",
              );
            }
          }
        });
      }
    });
  }
});

describe("clarificationDecisionPolicy — cadrage projet SaaS", () => {
  const saasHist = [
    {
      role: "user",
      content:
        "comment ça se passe si je veux ton aide de bout en bout pour un projet de SAAS?",
    },
    { role: "assistant", content: "Pour un projet SaaS… cadrage, Forge." },
  ];

  it("aide moi à préciser le projet — pas blocking_ambiguity", () => {
    const q = "aide moi à préciser le projet en utilisant les bonnes pratiques";
    assert.equal(isBlockingAmbiguityQuery(q), false);
    const gate = resolveClarificationGate(q, {
      history: saasHist,
      justIntent: evaluateJustIntent(q),
    });
    assert.equal(gate.shouldClarify, false);
  });

  it("aide moi nu — reste blocking", () => {
    assert.equal(isBlockingAmbiguityQuery("aide moi"), true);
  });
});
