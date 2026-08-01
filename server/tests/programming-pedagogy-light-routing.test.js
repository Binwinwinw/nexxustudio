import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  PROGRAMMING_PEDAGOGY_CANONICAL_PYTHON_QUERY,
  isProgrammingPedagogyLightRequest,
  suppressesCodeGenerationForProgrammingPedagogy,
} from "../src/agent/utils/programmingPedagogyLightIntentGuards.js";
import { isBeginnerTopicOverviewRequest } from "../src/agent/utils/beginnerTopicOverviewIntentGuards.js";
import { isCodeGenerationRequest } from "../src/agent/policies/code/codeDeliveryPolicy.js";
import {
  triageUserIntent,
  TRIAGE_INTENTS,
} from "../src/agent/classifiers/intentTriageClassifier.js";
import { resolveIntentContract } from "../src/agent/config/intentContractRegistry.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";

const CODE_PYTHON_QUERY =
  "Écris une fonction Python qui trie une liste de dictionnaires par date";

describe("programmingPedagogyLight — PEDAGOGY_EXPLAIN_LIGHT", () => {
  it("détecte première leçon Python débutant", () => {
    assert.equal(
      isProgrammingPedagogyLightRequest(PROGRAMMING_PEDAGOGY_CANONICAL_PYTHON_QUERY),
      true,
    );
    assert.equal(isBeginnerTopicOverviewRequest(PROGRAMMING_PEDAGOGY_CANONICAL_PYTHON_QUERY), true);
  });

  it("canonical Python — pas CODE_DELIVERY ni triage code_generation", () => {
    assert.equal(
      suppressesCodeGenerationForProgrammingPedagogy(PROGRAMMING_PEDAGOGY_CANONICAL_PYTHON_QUERY),
      true,
    );
    assert.equal(isCodeGenerationRequest(PROGRAMMING_PEDAGOGY_CANONICAL_PYTHON_QUERY), false);

    const triage = triageUserIntent(PROGRAMMING_PEDAGOGY_CANONICAL_PYTHON_QUERY, []);
    assert.notEqual(triage.top_intent, TRIAGE_INTENTS.CODE_GENERATION);

    const { contract } = resolveIntentContract(PROGRAMMING_PEDAGOGY_CANONICAL_PYTHON_QUERY, {});
    assert.notEqual(contract.id, "CODE_DELIVERY_V1");
  });

  it("short-circuit → beginner_topic_overview (pas orchestrateur code)", async () => {
    const hit = await runConversationShortCircuit(PROGRAMMING_PEDAGOGY_CANONICAL_PYTHON_QUERY);
    assert.equal(hit?.path, "beginner_topic_overview");
    assert.equal(hit?.deferToLlm, true);
    assert.equal(hit?.beginnerTopicOverview, true);
    assert.match(hit?.reflectiveHint || "", /PEDAGOGY_EXPLAIN_LIGHT/i);
  });

  it("HTML / JS / PHP débutant — pédagogie légère", () => {
    const cases = [
      "Je débute en HTML : par quoi commencer pour comprendre la structure d'une page ?",
      "Première leçon JavaScript pour un débutant, sur quoi mettre l'accent ?",
      "Comment bien commencer PHP quand on n'a jamais codé ?",
    ];
    for (const q of cases) {
      assert.equal(isProgrammingPedagogyLightRequest(q), true, q);
      assert.equal(isCodeGenerationRequest(q), false, q);
    }
  });

  it("livraison code explicite — reste CODE_DELIVERY", () => {
    assert.equal(isProgrammingPedagogyLightRequest(CODE_PYTHON_QUERY), false);
    assert.equal(isCodeGenerationRequest(CODE_PYTHON_QUERY), true);

    const triage = triageUserIntent(CODE_PYTHON_QUERY, []);
    assert.equal(triage.top_intent, TRIAGE_INTENTS.CODE_GENERATION);

    const { contract } = resolveIntentContract(CODE_PYTHON_QUERY, {});
    assert.equal(contract.id, "CODE_DELIVERY_V1");
  });

  it("apprendre bash — technical_learning_path, pas how_to install", async () => {
    const q = "comment faire pour apprendre le langage bash ??";
    const hit = await runConversationShortCircuit(q);
    assert.notEqual(hit?.path, "how_to_procedural_llm", q);
    assert.equal(hit?.path, "technical_learning_path", q);
    assert.equal(hit?.technicalLearningPath, true);
  });
});
