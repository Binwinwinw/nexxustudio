import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  META_BEHAVIOR_CANONICAL_REFLECT_QUERY,
  resolveMetaAssistantBehaviorShortCircuit,
} from "../src/agent/policies/meta/metaAssistantBehaviorPolicy.js";
import {
  EXPLORATORY_CANONICAL_MARTIAL_QUERY,
  resolveExploratoryConversationShortCircuit,
} from "../src/agent/policies/conversation/exploratoryConversationPolicy.js";
import { isMetaAssistantBehaviorRequest } from "../src/agent/utils/metaAssistantBehaviorGuards.js";
import { isExploratoryTopicIntent } from "../src/agent/utils/exploratoryConversationGuards.js";
import { shouldAllowClarifyThenBuild } from "../src/agent/utils/deliverableMandateGuards.js";
import {
  CLARIFICATION_DECISIONS,
  evaluateClarificationDecision,
  resolveClarificationGate,
} from "../src/agent/policies/clarificationDecisionPolicy.js";
import { evaluateJustIntent } from "../src/agent/policies/intent/justIntentDetectionPolicy.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { classifyConversationTurn } from "../src/agent/micro/classifiers/conversationTurnType.js";

const MARTIAL_HISTORY = [
  { role: "user", content: "salut nexxus" },
  { role: "assistant", content: "Salut ! Sur quoi veux-tu travailler aujourd'hui ?" },
  { role: "user", content: "ben je ne sais pas… et toi qu'est-ce que tu fais ?" },
  { role: "assistant", content: "Mes systèmes sont nominaux. Tu veux avancer sur quoi ?" },
  { role: "user", content: EXPLORATORY_CANONICAL_MARTIAL_QUERY },
  {
    role: "assistant",
    content:
      "Je vois la piste, mais pas encore la destination. Donne-moi l'objectif en une phrase et je prends la main.",
  },
];

describe("meta_assistant_behavior — guards", () => {
  it("détecte critique réflexion avant réponse", () => {
    assert.equal(isMetaAssistantBehaviorRequest(META_BEHAVIOR_CANONICAL_REFLECT_QUERY), true);
  });

  it("short-circuit déterministe", () => {
    const hit = resolveMetaAssistantBehaviorShortCircuit(META_BEHAVIOR_CANONICAL_REFLECT_QUERY, {
      history: MARTIAL_HISTORY,
    });
    assert.equal(hit?.path, "meta_assistant_behavior_deterministic");
    assert.match(hit?.reply || "", /façon de répondre|rails|comportement/i);
    assert.doesNotMatch(hit?.reply || "", /Je vois la piste/i);
  });
});

describe("exploratory_conversation — guards", () => {
  it("détecte « on part vers » sans mandat", () => {
    assert.equal(isExploratoryTopicIntent(EXPLORATORY_CANONICAL_MARTIAL_QUERY), true);
  });

  it("n'intercepte pas délégation recherche", () => {
    assert.equal(
      isExploratoryTopicIntent("va faire des recherches sur les arts martiaux"),
      false,
    );
  });

  it("short-circuit deferToLlm avec hint exploration", async () => {
    const hit = await runConversationShortCircuit(EXPLORATORY_CANONICAL_MARTIAL_QUERY, {
      history: MARTIAL_HISTORY.slice(0, 4),
    });
    assert.equal(hit?.path, "exploratory_conversation_light");
    assert.equal(hit?.deferToLlm, true);
    assert.match(hit?.reflectiveHint || "", /EXPLORATION/i);
  });
});

describe("clarificationDecisionPolicy — stratification", () => {
  it("exploration arts martiaux → can_answer_now, pas gate", () => {
    const evaluation = evaluateJustIntent(EXPLORATORY_CANONICAL_MARTIAL_QUERY);
    const decision = evaluateClarificationDecision(
      EXPLORATORY_CANONICAL_MARTIAL_QUERY,
      evaluation,
      null,
      MARTIAL_HISTORY.slice(0, 4),
    );
    assert.equal(decision.decision, CLARIFICATION_DECISIONS.CAN_ANSWER_NOW);
    assert.ok(decision.signals.includes("exploratory_conversation"));

    const gate = resolveClarificationGate(EXPLORATORY_CANONICAL_MARTIAL_QUERY, {
      justIntent: evaluation,
      history: MARTIAL_HISTORY.slice(0, 4),
    });
    assert.equal(gate.shouldClarify, false);
  });

  it("« des techniques d'art martiaux » → bypass clarify_then_build", () => {
    const q = "des techniques d'art martiaux";
    const evaluation = evaluateJustIntent(q);
    assert.equal(shouldAllowClarifyThenBuild(q, evaluation), false);

    const decision = evaluateClarificationDecision(q, evaluation, null, MARTIAL_HISTORY);
    assert.equal(decision.decision, CLARIFICATION_DECISIONS.CAN_ANSWER_NOW);
    assert.notEqual(decision.reason, "general_partial_ambiguity");
  });

  it("critique méta → can_answer_now, short-circuit sans gate", async () => {
    const evaluation = evaluateJustIntent(META_BEHAVIOR_CANONICAL_REFLECT_QUERY);
    const decision = evaluateClarificationDecision(
      META_BEHAVIOR_CANONICAL_REFLECT_QUERY,
      evaluation,
      null,
      MARTIAL_HISTORY,
    );
    assert.equal(decision.decision, CLARIFICATION_DECISIONS.CAN_ANSWER_NOW);
    assert.ok(decision.signals.includes("meta_assistant_behavior"));

    const hit = await runConversationShortCircuit(META_BEHAVIOR_CANONICAL_REFLECT_QUERY, {
      history: MARTIAL_HISTORY,
    });
    assert.equal(hit?.path, "meta_assistant_behavior_deterministic");
  });

  it("mandat flou explicite → clarification toujours légitime", () => {
    const q = "fais une page html";
    const evaluation = evaluateJustIntent(q);
    assert.equal(shouldAllowClarifyThenBuild(q, evaluation), true);
    const gate = resolveClarificationGate(q, { justIntent: evaluation });
    assert.equal(gate.shouldClarify, true);
  });

  it("comment faire une soupe → bypass clarify_then_build et gate", () => {
    const q = "comment faire une bonne soupe ??";
    const evaluation = evaluateJustIntent(q);
    assert.equal(shouldAllowClarifyThenBuild(q, evaluation), false);

    const decision = evaluateClarificationDecision(q, evaluation);
    assert.equal(decision.decision, CLARIFICATION_DECISIONS.CAN_ANSWER_NOW);
    assert.ok(decision.signals.includes("how_to_procedural"));
    assert.notEqual(decision.reason, "general_partial_ambiguity");

    const gate = resolveClarificationGate(q, { justIntent: evaluation });
    assert.equal(gate.shouldClarify, false);
  });

  it("comment faire tiramisu → pas culture générale full pipeline", async () => {
    const q = "comment faire un bon tiramisu";
    const evaluation = evaluateJustIntent(q);
    const decision = evaluateClarificationDecision(q, evaluation);
    assert.equal(decision.decision, CLARIFICATION_DECISIONS.CAN_ANSWER_NOW);

    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "how_to_simple_local");
    assert.notEqual(hit?.path, "general_knowledge_full_pipeline");
  });
});

describe("conversationTurnType — méta feedback étendu", () => {
  it("classifie critique réflexion comme meta_feedback", () => {
    const turn = classifyConversationTurn(META_BEHAVIOR_CANONICAL_REFLECT_QUERY, {
      history: MARTIAL_HISTORY,
    });
    assert.equal(turn.turnType, "meta_feedback");
    assert.equal(turn.shortCircuit, true);
  });
});
