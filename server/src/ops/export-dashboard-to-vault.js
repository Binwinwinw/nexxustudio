/**
 * Export dashboard skills → Vault 04-Operations/reports/
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateSkillsDashboard } from './dashboard-skills.js';
import { REPO_ROOT } from '../agent/utils/skillRuntimeRegistry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const VAULT_REPORTS_DIR = path.join(
  REPO_ROOT,
  'citadelle-vault',
  'Citadelle',
  '04-Operations',
  'reports',
);

export const DASHBOARD_JSON_NAME = 'skills-dashboard.json';

/**
 * @param {object} [options]
 * @param {string} [options.outputPath]
 * @param {string} [options.skillsDir]
 */
export function exportDashboardToVault(options = {}) {
  const dashboard = generateSkillsDashboard(options.skillsDir);
  const reportsDir = options.reportsDir || VAULT_REPORTS_DIR;
  const outputPath =
    options.outputPath || path.join(reportsDir, DASHBOARD_JSON_NAME);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(dashboard, null, 2)}\n`, 'utf-8');

  return { outputPath, dashboard };
}

export default exportDashboardToVault;
