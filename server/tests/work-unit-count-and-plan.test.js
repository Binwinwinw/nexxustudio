import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  WORK_UNIT_EXECUTION_MODES,
  reconcileUnitCounts,
  normalizeWorkUnits,
  resolveWorkUnitExecutionMode,
  resolveWorkUnitCountAndPlan,
} from "../src/agent/policies/workUnitCountAndPlanPolicy.js";
import { resolveRequestWorkloadSignal } from "../src/agent/policies/requestWorkloadSignalPolicy.js";

describe("WorkUnitCountAndPlanPolicy", () => {
  it("4 choses indépendantes → reconcile ok + multi_unit_parallel", () => {
    const q =
      "fait 4 choses à faire : 1 - tu dois faire un tableau avec des détails expliquant le cycle de la lune 2 - tu dois faire un tableau avec des détails expliquant le cycle de vie d'une libellule 3 - tu dois faire un tableau avec des détails expliquant la pollinisation 4 - tu dois faire un tableau avec des détails expliquant le concept de l'addition";

    const plan = resolveWorkUnitCountAndPlan(q);
    assert.equal(plan.count.declared_count, 4);
    assert.equal(plan.count.parsed_count, 4);
    assert.equal(plan.count.reconciled_count, 4);
    assert.equal(plan.count.ok, true);
    assert.equal(plan.unit_count, 4);
    assert.equal(plan.mode, WORK_UNIT_EXECUTION_MODES.MULTI_UNIT_PARALLEL);
    assert.equal(plan.execution_allowed, true);
    assert.equal(plan.all_units_accounted_for, true);
    assert.equal(plan.parallelism.eligible, true);
    assert.equal(plan.units.length, 4);
    assert.ok(plan.units.every((u) => u.independent === true));
    assert.equal(plan.units[0].output_format, "table");
    assert.equal(plan.units[0].depth, "detailed");
  });

  it("écart déclaré/parsé → blocked_clarify, pas d’exécution", () => {
    const q =
      "fait 4 choses à faire : 1 - tu dois faire un tableau expliquant le cycle de la lune 2 - tu dois faire un tableau expliquant la pollinisation";
    const plan = resolveWorkUnitCountAndPlan(q);
    assert.equal(plan.count.ok, false);
    assert.equal(plan.mode, WORK_UNIT_EXECUTION_MODES.BLOCKED_CLARIFY);
    assert.equal(plan.execution_allowed, false);
    assert.ok(plan.clarify_reply);
    assert.match(plan.clarify_reply, /4/i);
    assert.match(plan.clarify_reply, /2/i);
  });

  it("chaîne dépendante → multi_unit_sequential", () => {
    const q =
      "1 - explique le cycle de la lune sous forme de tableau 2 - compare ensuite avec le cycle de l'eau puis résume la comparaison";
    const plan = resolveWorkUnitCountAndPlan(q);
    assert.ok(plan.unit_count >= 2);
    assert.equal(plan.mode, WORK_UNIT_EXECUTION_MODES.MULTI_UNIT_SEQUENTIAL);
    assert.equal(plan.parallelism.eligible, false);
    assert.equal(plan.parallelism.reason, "dependency_detected");
  });

  it("solo → single_unit", () => {
    const q =
      "pourrais tu expliquer en détail le cycle de la lune sous forme de tableau?";
    const workload = resolveRequestWorkloadSignal(q);
    // Solo souvent 0 unités workload (pas de liste) — fabriquer 1 unité normalisée
    if (workload.units.length === 0) {
      const units = normalizeWorkUnits(
        [
          {
            action: "explain",
            format: "table",
            target: "cycle de la lune",
            subject: "cycles de la lune",
            segment: q,
          },
        ],
        q,
      );
      const { mode } = resolveWorkUnitExecutionMode(units, { reconcileOk: true });
      assert.equal(mode, WORK_UNIT_EXECUTION_MODES.SINGLE_UNIT);
    } else {
      const plan = resolveWorkUnitCountAndPlan(q);
      assert.equal(plan.mode, WORK_UNIT_EXECUTION_MODES.SINGLE_UNIT);
    }
  });

  it("reconcileUnitCounts — declared matches parsed", () => {
    const r = reconcileUnitCounts({
      stated_count: 2,
      units: [{}, {}],
      confidence: 0.9,
    });
    assert.equal(r.ok, true);
    assert.equal(r.reconciled_count, 2);
    assert.ok(r.confidence >= 0.9);
  });
});
