import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadSkills,
  logRuntimeModuleStatus,
} from '../src/agent/utils/skillRuntimeRegistry.js';
import {
  generateSkillsDashboard,
} from '../src/ops/dashboard-skills.js';

describe('skillRuntimeRegistry v1.6', () => {
  it('charge 26 skills sans erreur schéma', () => {
    const { skills, errors } = loadSkills();
    assert.equal(errors.length, 0);
    assert.ok(skills.length >= 26);
  });

  it('détecte les liens parent/sub-skill Obsidian', () => {
    const { skills, warnings } = loadSkills();
    const parent = skills.find((entry) => entry.name === 'skill-obsidian-governance');
    assert.ok(parent);
    assert.deepEqual(parent.meta.subSkills, [
      'skill-obsidian-markdown',
      'skill-obsidian-canvas',
      'skill-obsidian-cli',
    ]);

    const subWarnings = warnings.filter((warning) => warning.code === 'SUB_SKILL_MISSING');
    assert.equal(subWarnings.length, 0);
  });
});

describe('dashboard-skills', () => {
  it('génère un dashboard avec couverture vague 2', () => {
    const dashboard = generateSkillsDashboard();
    assert.equal(dashboard.summary.errors, 0);
    assert.equal(dashboard.coverage.pdf, '✅');
    assert.equal(dashboard.coverage.egress, '✅');
    assert.equal(dashboard.coverage.memory, '✅');
    assert.equal(dashboard.coverage.quality, '✅');
    assert.ok(dashboard.summary.subSkills >= 3);
  });

  it('logRuntimeModuleStatus s exécute sans exception', () => {
    const { skills } = loadSkills();
    assert.doesNotThrow(() => logRuntimeModuleStatus(skills));
  });
});
