#!/usr/bin/env node
import exportDashboardToVault from '../src/ops/export-dashboard-to-vault.js';

const { outputPath } = exportDashboardToVault();
console.log(`✅ Dashboard exporté vers Vault : ${outputPath}`);
