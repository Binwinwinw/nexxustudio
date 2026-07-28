import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildTranslationRequestPlan,
  buildMultiTargetOutputFormatSpec,
  validateMultiTargetTranslationOutput,
  TRANSLATION_PLAN_MODES,
  TRANSLATION_EXECUTION_MODES,
} from "../src/agent/utils/translationRequestPlan.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { buildTranslationOrchestrationEvent } from "../src/agent/telemetry/translationOrchestrationTelemetry.js";

const multiQuery =
  "je veux traduire la phrase suivante en espagnol, en allemand, en arabe et en chinois : Suivez la progression de votre enfant en toute sérénité merci par avance";

describe("translationRequestPlan", () => {
  it("décompose 1 texte × 4 langues en requestUnits homogènes", () => {
    const plan = buildTranslationRequestPlan(multiQuery);
    assert.equal(plan.ready, true);
    assert.equal(plan.multiTarget, true);
    assert.equal(plan.targetLanguageCount, 4);
    assert.equal(plan.mode, TRANSLATION_PLAN_MODES.MULTI_TARGET_BATCH);
    assert.equal(plan.executionMode, TRANSLATION_EXECUTION_MODES.BATCH);
    assert.equal(plan.requestUnits.length, 4);
    assert.equal(
      new Set(plan.requestUnits.map((u) => u.sourceText)).size,
      1,
    );
    assert.deepEqual(
      plan.requestUnits.map((u) => u.targetLanguage),
      ["es", "de", "ar", "zh"],
    );
    assert.match(plan.effectiveQuery, /FORMAT DE SORTIE OBLIGATOIRE/i);
    assert.match(plan.effectiveQuery, /\*\*Espagnol :\*\*/i);
  });

  it("short-circuit → translation_multi_target", async () => {
    const hit = await runConversationShortCircuit(multiQuery);
    assert.equal(hit?.path, "translation_multi_target");
    assert.equal(hit?.translationPlan?.targetLanguageCount, 4);
    assert.equal(hit?.translationExecutionMode, "batch");
  });

  it("telemetry — execution_mode batch + unit count", () => {
    const plan = buildTranslationRequestPlan(multiQuery);
    const event = buildTranslationOrchestrationEvent(multiQuery, {
      pipelinePath: "translation_multi_target",
      plan,
    });
    assert.equal(event.translation_multi_target, true);
    assert.equal(event.execution_mode, "batch");
    assert.equal(event.request_unit_count, 4);
    assert.equal(event.plan_mode, "multi_target_batch");
  });

  it("validation sortie multi-cibles", () => {
    const ok =
      "**Espagnol :** Hola\n**Allemand :** Hallo\n**Arabe :** مرحبا\n**Chinois :** 你好";
    assert.equal(
      validateMultiTargetTranslationOutput(ok, ["es", "de", "ar", "zh"]),
      true,
    );
    assert.equal(
      validateMultiTargetTranslationOutput(
        "Je vois la piste, mais pas encore la destination",
        ["es", "de", "ar", "zh"],
      ),
      false,
    );
  });

  it("format spec — une ligne par langue", () => {
    const spec = buildMultiTargetOutputFormatSpec(["es", "de"]);
    assert.match(spec, /\*\*Espagnol :\*\*/i);
    assert.match(spec, /\*\*Allemand :\*\*/i);
  });
});
