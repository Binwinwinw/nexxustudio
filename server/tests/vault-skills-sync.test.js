import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import exportDashboardToVault, {
  DASHBOARD_JSON_NAME,
} from '../src/ops/export-dashboard-to-vault.js';
import syncVaultToSkillsHub, {
  renderSkillsHubMarkdown,
} from '../src/ops/sync-vault-skills.js';
import { generateSkillsDashboard } from '../src/ops/dashboard-skills.js';
import { loadSkills } from '../src/agent/utils/skillRuntimeRegistry.js';

describe('export-dashboard-to-vault', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-export-'));
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('exporte un JSON dashboard valide', () => {
    const outputPath = path.join(tmpDir, DASHBOARD_JSON_NAME);
    const { dashboard } = exportDashboardToVault({ outputPath });

    assert.ok(fs.existsSync(outputPath));
    const parsed = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    assert.equal(parsed.summary.totalSkills, dashboard.summary.totalSkills);
    assert.ok(parsed.summary.totalSkills >= 23);
    assert.equal(parsed.coverage.pdf, '✅');
  });
});

describe('sync-vault-skills', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-sync-'));
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('génère un hub SKILLS.md avec métriques live', () => {
    const { skills } = loadSkills();
    const dashboard = generateSkillsDashboard();
    const markdown = renderSkillsHubMarkdown(dashboard, skills);

    assert.match(markdown, /Hub des Skills — La Citadelle/);
    assert.match(markdown, /Runtime-backed:/);
    assert.match(markdown, /skill-pdf-extraction/);
    assert.match(markdown, /skill-obsidian-markdown/);
  });

  it('syncVaultToSkillsHub écrit hub + module vault en sandbox', () => {
    const hubPath = path.join(tmpDir, 'SKILLS.md');
    const vaultModulesPath = path.join(tmpDir, 'modules', 'skills.md');

    const result = syncVaultToSkillsHub({ hubPath, vaultModulesPath });
    assert.ok(fs.existsSync(hubPath));
    assert.ok(fs.existsSync(vaultModulesPath));
    assert.equal(result.dashboard.summary.errors, 0);
  });
});
