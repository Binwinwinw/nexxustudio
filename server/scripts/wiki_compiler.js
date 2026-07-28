#!/usr/bin/env node
/**
 * CLI — compilation wiki Vault Obsidian.
 * Runtime : server/src/wiki/wiki_compiler.js
 */
import { compileWikiFromVault } from '../src/wiki/wiki_compiler.js';

async function main() {
  console.log('📚 Lancement du Wiki Compiler v1.1 (ESM runtime)...');
  const result = await compileWikiFromVault();
  console.log(`✅ Wiki-ADR-Index.md généré (${result.adrCount} ADR).`);
  console.log(`✅ Wiki-Modules-Summary.md généré (${result.moduleCount} modules).`);
  console.log('🚀 Compilation Wiki terminée. Le Vault Obsidian est désormais queryable et structuré.');
}

main().catch((err) => {
  console.error('[wiki_compiler CLI]', err.message);
  process.exit(1);
});
