import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  INTENT_FAMILIES_V1,
  INTENT_FAMILY_SHORT_CIRCUIT_ORDER_V1,
  getIntentFamilyCanonicalMatrixV1,
  resolveIntentFamilyFromRegistry,
  validateIntentFamilyRegistryV1,
} from "../src/agent/policies/intentFamilyRegistry.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";

describe("intentFamilyRegistry — cohérence v1", () => {
  it("registre valide en interne", () => {
    const report = validateIntentFamilyRegistryV1();
    assert.equal(report.ok, true, report.errors.join("\n"));
  });

  it("ordre short-circuit aligné sur les familles", () => {
    const sorted = [...INTENT_FAMILIES_V1]
      .sort((a, b) => a.shortCircuitOrder - b.shortCircuitOrder)
      .map((f) => f.id);
    assert.deepEqual(sorted, [...INTENT_FAMILY_SHORT_CIRCUIT_ORDER_V1]);
  });

  it("chaque requête canonique résout une famille unique attendue", () => {
    for (const row of getIntentFamilyCanonicalMatrixV1()) {
      const family = resolveIntentFamilyFromRegistry(row.query);
      assert.ok(family, `aucune famille pour « ${row.label || row.query} »`);
      assert.equal(
        family.id,
        row.familyId,
        `famille registre pour « ${row.label || row.query} »`,
      );
    }
  });
});

describe("intentFamilyRegistry — matrice de routage canonique v1", () => {
  for (const row of getIntentFamilyCanonicalMatrixV1()) {
    it(`${row.label || row.familyId} → ${row.expectedPath}`, async () => {
      const hit = await runConversationShortCircuit(row.query, {
        getDeterministicSocialResponse: () => null,
        history: [],
      });
      assert.equal(
        hit?.path,
        row.expectedPath,
        `query=${row.query.slice(0, 80)}`,
      );

      if (INTENT_FAMILIES_V1.find((f) => f.id === row.familyId)?.deferToFullPipeline) {
        assert.equal(hit?.deferToFullPipeline, true);
      }
      if (INTENT_FAMILIES_V1.find((f) => f.id === row.familyId)?.preferWebResearch) {
        assert.equal(hit?.preferWebResearch, true);
      }
    });
  }
});

describe("intentFamilyRegistry — frontières croisées (détecteurs)", () => {
  const matrix = getIntentFamilyCanonicalMatrixV1();

  it("une requête canonique n'active qu'une seule famille registre", () => {
    for (const row of matrix) {
      const matches = INTENT_FAMILIES_V1.filter((f) => f.detect(row.query)).map(
        (f) => f.id,
      );
      assert.equal(
        matches.length,
        1,
        `« ${row.label} » matched [${matches.join(", ")}], expected only ${row.familyId}`,
      );
      assert.equal(matches[0], row.familyId);
    }
  });
});
