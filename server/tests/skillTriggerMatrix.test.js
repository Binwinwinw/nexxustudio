/**
 * Matrice de déclenchement skills plateforme (vague 2 + régression v1.3).
 * KPI : triggerAccuracy = passed / total (cible ≥ 0.85 global).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import skillLoader from '../src/agent/utils/skillLoader.js';
import {
  FULL_TRIGGER_MATRIX,
  evaluateSkillTriggerAccuracy,
} from '../src/quality/skillTriggerMatrixData.js';

describe('skillTriggerMatrix', () => {
  for (const row of FULL_TRIGGER_MATRIX) {
    it(row.label, async () => {
      skillLoader.invalidateCache();
      const id = await skillLoader.identifyRelevantSkill(row.query, row.context || {});

      if (row.expect) {
        assert.equal(id, row.expect, `query="${row.query}"`);
      }
      if (row.expectNot) {
        assert.notEqual(id, row.expectNot, `query="${row.query}"`);
      }
    });
  }

  it('KPI triggerAccuracy ≥ 0.85 on matrix', async () => {
    const evaluation = await evaluateSkillTriggerAccuracy(skillLoader, 0.85);
    assert.ok(
      evaluation.pass,
      `triggerAccuracy=${evaluation.accuracy.toFixed(2)} (${evaluation.passed}/${evaluation.total})`,
    );
  });
});
