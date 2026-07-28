import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  resolveIntentComposition,
  applyPedagogicalCompositionAugment,
  formatIntentCompositionSummary,
} from "../src/agent/policies/intentCompositionPolicy.js";
import { evaluateJustIntent } from "../src/agent/policies/justIntentDetectionPolicy.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { DROP_REASONS } from "../src/agent/policies/intentCompatibilityMatrix.js";

describe("INTENT_COMPOSITION_V1 — P0", () => {
  it("greeting + explain + table + summarize → composition riche", () => {
    const q =
      "Bonjour, peux-tu m'expliquer le cycle de la lune sous forme de tableau et me donner ensuite un résumé simple ?";
    const just = evaluateJustIntent(q);
    const c = resolveIntentComposition(q, { justIntent: just });

    assert.deepEqual(c.social, ["greeting"]);
    assert.equal(c.primary_action, "explain");
    assert.ok(c.secondary_actions.includes("summarize"));
    assert.equal(c.output_constraints.format, "table");
    assert.equal(c.clarification_required, false);
    assert.ok(
      ["confirmed", "refined", "too_flat"].includes(c.just_relation),
      `just_relation=${c.just_relation}`,
    );
    assert.ok(c.confidence_breakdown.primary_action > 0.5);
    assert.ok(c.confidence_breakdown.constraints > 0.5);
    assert.ok(Array.isArray(c.dropped_candidates));
    assert.match(formatIntentCompositionSummary(c), /primary=explain/);
  });

  it("« tableau » n'est pas une intention primary/secondary", () => {
    const q =
      "pourrais tu expliquer en détail le cycle de la lune sous forme de tableau";
    const c = resolveIntentComposition(q, {
      justIntent: evaluateJustIntent(q),
    });
    assert.equal(c.primary_action, "explain");
    assert.ok(!c.secondary_actions.includes("table"));
    assert.equal(c.output_constraints.format, "table");
    assert.ok(
      c.dropped_candidates.some(
        (d) =>
          d.label === "table" && d.reason === DROP_REASONS.ABSORBED_AS_CONSTRAINT,
      ),
    );
  });

  it("contradiction depth detailed vs ultra_short → clarify", () => {
    const q =
      "explique en détail le cycle de l'eau mais en une seule phrase ultra-court";
    const c = resolveIntentComposition(q);
    assert.equal(c.clarification_required, true);
    assert.equal(c.clarify_reason, "depth_contradiction");
  });

  it("multi N=2 targets → targets length 2", () => {
    const q =
      "fait 2 tableaux : 1 - cycle de la lune sous forme de tableau 2 - cycle de vie d'une libellule sous forme de tableau";
    const c = resolveIntentComposition(q);
    assert.equal(c.primary_action, "explain");
    assert.equal(c.output_constraints.format, "table");
    assert.equal(c.targets.length, 2);
  });

  it("workload 4 unités → budget_units=4 + social deferred", () => {
    const q =
      "fait 4 choses à faire : 1 - tu dois faire un tableau avec des détails expliquant le cycle de la lune 2 - tu dois faire un tableau avec des détails expliquant le cycle de vie d'une libellule 3 - tu dois faire un tableau avec des détails expliquant la pollinisation 4 - tu dois faire un tableau avec des détails expliquant le concept de l'addition";
    const c = resolveIntentComposition(q);
    assert.equal(c.primary_action, "explain");
    assert.equal(c.output_constraints.format, "table");
    assert.equal(c.workload_signal?.explicit_unit_count, 4);
    assert.equal(c.execution_constraints?.budget_units, 4);
    assert.equal(c.execution_constraints?.must_preserve_all_units, true);
    assert.equal(c.social_weight, "deferred_to_response");
    assert.equal(c.targets.length, 4);
  });

  it("social seul → primary null", () => {
    const c = resolveIntentComposition("bonjour nexxus");
    assert.deepEqual(c.social, ["greeting"]);
    assert.equal(c.primary_action, null);
    assert.equal(c.execution_plan.mode, "social_only");
  });

  it("consommateur — greeting + summarize sur réponse table", async () => {
    const q =
      "Bonjour, explique le cycle de la lune sous forme de tableau puis un résumé en 3 lignes";
    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "lexicon_science_format_table_deterministic");
    assert.match(hit?.reply || "", /^Bonjour\./i);
    assert.match(hit?.reply || "", /Nouvelle lune|Pleine lune/i);
    assert.match(hit?.reply || "", /En 3 lignes|En résumé/i);
  });

  it("applyPedagogicalCompositionAugment — sources si demandé", () => {
    const composition = resolveIntentComposition(
      "explique le cycle de l'eau sous forme de tableau avec sources",
    );
    const base =
      "Voici un tableau\n\n| Étape | Description | Résultat / Exemple |\n| --- | --- | --- |\n| A | B | C |\n| A | B | C |\n| A | B | C |\n| A | B | C |\n| A | B | C |\n";
    const out = applyPedagogicalCompositionAugment(base, composition, {
      subject: "cycle de l eau",
    });
    assert.match(out, /\*\*Sources\*\*/i);
  });
});
