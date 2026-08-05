import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  G30_COVERAGE_CASES,
  G30_TIERS,
  runG30CoverageCase,
  summarizeG30CoverageMatrix,
} from "../src/agent/policies/conversation/queryUnderstandingCoverageMatrix.js";

const GREEN_CASES = G30_COVERAGE_CASES.filter((testCase) => testCase.status === "green");
const GAP_CASES = G30_COVERAGE_CASES.filter((testCase) => testCase.status === "gap");

describe("G30 — couverture verte (régression)", () => {
  for (const testCase of GREEN_CASES) {
    it(`${testCase.id} — ${testCase.label}`, () => {
      const { errors } = runG30CoverageCase(testCase);
      assert.deepEqual(
        errors,
        [],
        `${testCase.id} échec:\n${errors.map((e) => `  - ${e}`).join("\n")}`,
      );
    });
  }
});

describe("G30 — trous documentés (baseline intention)", () => {
  for (const testCase of GAP_CASES) {
    it.skip(
      `${testCase.id} [${testCase.gapTicket}] — ${testCase.label} — ${testCase.gapReason}`,
      () => {
        const { errors } = runG30CoverageCase(testCase);
        assert.deepEqual(errors, []);
      },
    );
  }
});

describe("G30 — inventaire matrice", () => {
  it("résumé green/gap par tier", () => {
    const summary = summarizeG30CoverageMatrix();
    assert.ok(summary.green >= 1, "au moins un cas vert (référence G29.2)");
    assert.ok(summary.gap >= 1, "au moins un trou documenté");
    assert.ok(summary.byTier[G30_TIERS.L1_INTENT] >= 3);
    assert.ok(summary.byTier[G30_TIERS.L2_VARIANT] >= 4);
    assert.ok(summary.byTier[G30_TIERS.L3_COMPOSITE] >= 4);
    assert.ok(summary.byTier[G30_TIERS.L4_HONEST_FAILURE] >= 2);
  });

  it("chaque gap a un ticket et une raison", () => {
    for (const testCase of GAP_CASES) {
      assert.ok(testCase.gapTicket, `${testCase.id} sans gapTicket`);
      assert.ok(testCase.gapReason, `${testCase.id} sans gapReason`);
    }
  });
});
