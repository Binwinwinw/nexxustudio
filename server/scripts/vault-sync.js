#!/usr/bin/env node
import syncVaultToSkillsHub from '../src/ops/sync-vault-skills.js';
import exportDashboardToVault from '../src/ops/export-dashboard-to-vault.js';

const sync = syncVaultToSkillsHub();
console.log(`✅ Synchronisation Vault → SKILLS.md : ${sync.hubPath}`);
console.log(`✅ Module Vault mis à jour : ${sync.vaultModulesPath}`);

const { outputPath } = exportDashboardToVault();
console.log(`✅ Dashboard exporté vers Vault : ${outputPath}`);
