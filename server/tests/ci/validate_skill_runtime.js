#!/usr/bin/env node
/**
 * CI — Validation skillMeta v1.5 + traçabilité runtimeModules.
 * Usage: npm run test:skills (depuis server/)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(SERVER_ROOT, '..');
const SKILLS_DIR = path.join(SERVER_ROOT, 'data/skills');
const SCHEMA_PATH = path.join(
  SERVER_ROOT,
  'src/agent/contracts/skillMeta.schema.json',
);

const ajv = new Ajv({ allErrors: true, strict: false });
const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf-8'));
const validate = ajv.compile(schema);

const errors = [];
const warnings = [];

function resolveRepoPath(relativePath) {
  return path.join(REPO_ROOT, relativePath.replace(/\//g, path.sep));
}

function hasExportInFile(filePath, exportName) {
  const content = fs.readFileSync(filePath, 'utf-8');
  if (exportName === 'default') {
    return /export\s+default\b/.test(content);
  }
  const patterns = [
    new RegExp(`export\\s+(async\\s+)?function\\s+${exportName}\\b`),
    new RegExp(`export\\s+const\\s+${exportName}\\b`),
    new RegExp(`export\\s+class\\s+${exportName}\\b`),
    new RegExp(`export\\s*\\{[^}]*\\b${exportName}\\b`),
  ];
  return patterns.some((pattern) => pattern.test(content));
}

function listSkillDirs() {
  return fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('skill-'))
    .map((entry) => entry.name)
    .sort();
}

const skillNames = listSkillDirs();

for (const skillName of skillNames) {
  const metaPath = path.join(SKILLS_DIR, skillName, 'meta.json');
  if (!fs.existsSync(metaPath)) {
    errors.push(`❌ ${skillName}: meta.json manquant`);
    continue;
  }

  let meta;
  try {
    meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
  } catch (err) {
    errors.push(`❌ ${skillName}: meta.json illisible — ${err.message}`);
    continue;
  }

  const valid = validate(meta);
  if (!valid) {
    errors.push(
      `❌ ${skillName}: schéma v1.5 invalide — ${JSON.stringify(validate.errors)}`,
    );
    continue;
  }

  if (meta.deprecated && !meta.replacedBy) {
    warnings.push(`⚠️ ${skillName}: deprecated=true sans replacedBy`);
  }

  const modules = meta.runtimeModules || [];
  const requiresRuntime = meta.requiresRuntime === true;

  if (modules.length === 0) {
    if (requiresRuntime) {
      errors.push(
        `❌ ${skillName}: requiresRuntime=true mais runtimeModules vide`,
      );
    } else if (meta.requiresRuntime !== false) {
      warnings.push(
        `⚠️ ${skillName}: aucun runtimeModules (skill procédural pur — définir requiresRuntime: false)`,
      );
    }
    continue;
  }

  let hasImplemented = false;

  for (const mod of modules) {
    const fullPath = resolveRepoPath(mod.path);
    const exists = fs.existsSync(fullPath);

    if (!exists) {
      if (mod.status === 'pending') {
        warnings.push(`⚠️ ${skillName}: ${mod.path} marqué pending (OK)`);
      } else {
        errors.push(
          `❌ ${skillName}: ${mod.path} manquant (status=${mod.status || 'implemented'})`,
        );
      }
      continue;
    }

    if (mod.status === 'pending') {
      errors.push(
        `❌ ${skillName}: ${mod.path} existe mais marqué pending — passer à implemented`,
      );
      continue;
    }

    if (mod.status !== 'deprecated' && !hasExportInFile(fullPath, mod.exportName)) {
      errors.push(
        `❌ ${skillName}: export « ${mod.exportName} » introuvable dans ${mod.path}`,
      );
      continue;
    }

    if (mod.status === 'implemented') {
      hasImplemented = true;
    }
  }

  if (requiresRuntime && !hasImplemented) {
    errors.push(
      `❌ ${skillName}: requiresRuntime=true sans module status=implemented`,
    );
  }

  for (const testFile of meta.testFiles || []) {
    const testPath = resolveRepoPath(testFile);
    if (!fs.existsSync(testPath)) {
      errors.push(`❌ ${skillName}: testFiles — ${testFile} introuvable`);
    }
  }
}

const allSkillIds = new Set(skillNames);
for (const skillName of skillNames) {
  const metaPath = path.join(SKILLS_DIR, skillName, 'meta.json');
  if (!fs.existsSync(metaPath)) continue;
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));

  if (meta.parentSkillId && !allSkillIds.has(meta.parentSkillId)) {
    errors.push(
      `❌ ${skillName}: parentSkillId ${meta.parentSkillId} introuvable`,
    );
  }

  for (const subId of meta.subSkills || []) {
    if (!allSkillIds.has(subId)) {
      errors.push(`❌ ${skillName}: subSkill ${subId} introuvable`);
    }
  }
}

console.log('\n📊 Résumé validation skills v1.6');
console.log(`Total skills: ${skillNames.length}`);
console.log(`Errors: ${errors.length}`);
console.log(`Warnings: ${warnings.length}\n`);

if (errors.length > 0) {
  console.log('❌ ERREURS:');
  errors.forEach((entry) => console.log(entry));
}

if (warnings.length > 0) {
  console.log('⚠️ AVERTISSEMENTS:');
  warnings.forEach((entry) => console.log(entry));
}

if (errors.length > 0) {
  process.exit(1);
}

console.log('✅ Tous les skills validés — schema v1.6 OK');
process.exit(0);
