import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { SIMPLE_FACTUAL_TERRAIN_CORPUS } from "./fixtures/simple-factual-terrain-corpus.js";
import {
  evaluateFactualSanityGate,
  FACTUAL_SANITY_DECISIONS,
} from "../src/agent/micro/replies/factualSanityGate.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { evaluateJustIntent } from "../src/agent/policies/intent/justIntentDetectionPolicy.js";
import { EXECUTION_STRATEGIES } from "../../shared/justIntentCatalog.js";

function inferPipelineVerdict(hit, justIntent) {
  if (hit?.path === "simple_factual_lookup") return "answer";
  if (hit?.path === "simple_factual_abstain") return "abstain";
  if (hit?.path === "simple_factual_clarify") return "clarify";
  if (justIntent.strategy === EXECUTION_STRATEGIES.CLARIFY_THEN_BUILD) return "clarify";
  return "other";
}

describe("factualSanityGate — règles unitaires", () => {
  it("laisse passer les questions valides", () => {
    for (const { id, q } of SIMPLE_FACTUAL_TERRAIN_CORPUS.filter((c) => c.bucket === "valid")) {
      const out = evaluateFactualSanityGate(q);
      assert.equal(out.decision, FACTUAL_SANITY_DECISIONS.PASS, `${id} devrait passer`);
    }
  });

  it("abstient sur typo repère (P1)", () => {
    const out = evaluateFactualSanityGate("Où se trouve la tour de pizz ?");
    assert.equal(out.decision, FACTUAL_SANITY_DECISIONS.ABSTAIN);
    assert.equal(out.matchedRule, "typo_or_unrecognized_landmark");
  });

  it("abstient sur fiction explicite (P2, P3)", () => {
    const p2 = evaluateFactualSanityGate(
      "Dans quelle ville se trouve le château de Poudlard en France ?",
    );
    assert.equal(p2.decision, FACTUAL_SANITY_DECISIONS.ABSTAIN);
    assert.equal(p2.matchedRule, "fiction_entity");

    const p3 = evaluateFactualSanityGate("Quelle est la capitale du royaume de Westeros ?");
    assert.equal(p3.decision, FACTUAL_SANITY_DECISIONS.ABSTAIN);
  });

  it("clarifie anaphore nue (A2)", () => {
    const out = evaluateFactualSanityGate("Où se trouve-ce ?", { history: [] });
    assert.equal(out.decision, FACTUAL_SANITY_DECISIONS.CLARIFY);
    assert.equal(out.matchedRule, "anaphora_no_antecedent");
  });

  it("ne bloque pas les exclusions conseil déjà gérées (A1, A3)", () => {
    const a1 = evaluateFactualSanityGate(
      "Dans quelle ville vaut-il mieux ouvrir mon restaurant ?",
    );
    assert.equal(a1.decision, FACTUAL_SANITY_DECISIONS.PASS);

    const a3 = evaluateFactualSanityGate("Quel plan proposes-tu pour visiter le Parc Astérix ?");
    assert.equal(a3.decision, FACTUAL_SANITY_DECISIONS.PASS);
  });
});

describe("simple-factual-terrain-corpus — pipeline", () => {
  for (const c of SIMPLE_FACTUAL_TERRAIN_CORPUS) {
    it(`${c.id} · ${c.bucket} → ${c.target}`, async () => {
      const justIntent = evaluateJustIntent(c.q);
      const hit = await runConversationShortCircuit(c.q, { history: [] });
      const verdict = inferPipelineVerdict(hit, justIntent);

      if (c.target === "answer") {
        assert.equal(verdict, "answer", `attendu answer, obtenu ${verdict} (${hit?.path})`);
      } else if (c.target === "abstain") {
        assert.equal(verdict, "abstain", `attendu abstain, obtenu ${verdict} (${hit?.path})`);
      } else {
        assert.ok(
          verdict === "clarify" || verdict === "other",
          `attendu clarify/other, obtenu ${verdict} (${hit?.path})`,
        );
      }
    });
  }
});
