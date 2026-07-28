// server/tests/intent-routing.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { selectPipeline } from '../config/intent-routing.js';
import { orchestrate } from '../config/pipelines.js';

describe('intent-routing', () => {
  test("general/explain + conf élevé → direct_explanation", () => {
    const pipeline = selectPipeline("general/explain", 0.85);
    assert.equal(pipeline, "direct_explanation");
  });
  
  test("general/explain + conf faible → clarify_user", () => {
    const pipeline = selectPipeline("general/explain", 0.5);
    assert.equal(pipeline, "clarify_user");
  });

  test("general/explain + conf à 0.69 → clarify_user", () => {
    const pipeline = selectPipeline("general/explain", 0.69);
    assert.equal(pipeline, "clarify_user");
  });

  test("general/explain + conf à 0.7 → direct_explanation", () => {
    const pipeline = selectPipeline("general/explain", 0.7);
    assert.equal(pipeline, "direct_explanation");
  });
  
  test("code/create → build_v1", () => {
    const pipeline = selectPipeline("code/create", 0.9);
    assert.equal(pipeline, "build_v1");
  });
  
  test("presentation/plan → build_v1", () => {
    const pipeline = selectPipeline("presentation/plan", 0.7);
    assert.equal(pipeline, "build_v1");
  });
  
  test("conversation_recall → recall_previous", () => {
    const pipeline = selectPipeline("conversation_recall", 0.8);
    assert.equal(pipeline, "recall_previous");
  });
  
  test("intent inconnue → general_answer (fallback)", () => {
    const pipeline = selectPipeline("unknown_intent", 0.5);
    assert.equal(pipeline, "general_answer");
  });
  
  test("pas de fallback sur conversation_recall", () => {
    const pipeline = selectPipeline("general/explain", 0.3);
    assert.notEqual(pipeline, "conversation_recall");
  });

  test("orchestrate exécute le pipeline sélectionné", async () => {
    const result = await orchestrate("explique la mémoire vectorielle", {
      detectIntent: async () => ({ intent: "general/explain", conf: 0.85 }),
      handlers: {
        generateFactAnswer: async (query, context) => ({
          query,
          pipeline: context.pipelineKey,
        }),
      },
    });

    assert.deepEqual(result, {
      query: "explique la mémoire vectorielle",
      pipeline: "direct_explanation",
    });
  });

  test("orchestrate échoue si le handler du pipeline manque", async () => {
    await assert.rejects(
      () => orchestrate("explique", {
        detectIntent: async () => ({ intent: "general/explain", conf: 0.85 }),
      }),
      /Handler non configuré pour le pipeline: direct_explanation/,
    );
  });
});
