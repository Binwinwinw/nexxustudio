import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isSimpleFactualQuestion,
  evaluateJustIntent,
} from "../src/agent/policies/intent/justIntentDetectionPolicy.js";
import { resolveLocalSimpleFactualAnswer } from "../src/agent/micro/replies/simpleFactualComposer.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { EXECUTION_STRATEGIES } from "../../shared/justIntentCatalog.js";

const FACTUAL_CASES = [
  "Dans quelle ville se trouve le Parc Astérix ?",
  "Où se trouve le Parc Astérix ?",
  "Salut Nexxus, dans quelle ville se trouve le Parc Astérix ?",
  "dans quelle ville de France se trouve le parc Astérix ?",
];

const NON_FACTUAL_CASES = [
  "Quel plan proposes-tu pour visiter le Parc Astérix ?",
  "Dans quelle ville vaut-il mieux lancer ce projet ?",
];

describe("simple_factual_lookup — régression Parc Astérix", () => {
  for (const query of FACTUAL_CASES) {
    it(`factuel pur · ${query.slice(0, 42)}…`, async () => {
      assert.equal(isSimpleFactualQuestion(query), true);

      const evaluation = evaluateJustIntent(query);
      assert.notEqual(
        evaluation.strategy,
        EXECUTION_STRATEGIES.CLARIFY_THEN_BUILD,
        "ne doit pas clarifier avant réponse directe",
      );
      assert.equal(evaluation.canBuildDirectly, true);

      const hit = await runConversationShortCircuit(query);
      assert.ok(hit, "short-circuit attendu");
      assert.equal(hit.path, "simple_factual_lookup");
      assert.equal(hit.simpleFactual, true);

      const local = resolveLocalSimpleFactualAnswer(query);
      if (local) {
        assert.match(local, /Plailly/i);
      }
    });
  }

  for (const query of NON_FACTUAL_CASES) {
    it(`hors couloir factuel · ${query.slice(0, 42)}…`, async () => {
      assert.equal(isSimpleFactualQuestion(query), false);

      const hit = await runConversationShortCircuit(query);
      assert.notEqual(hit?.path, "simple_factual_lookup");
    });
  }
});
