/**
 * skillRuntimeRegistry.js — ADR-007 v1.6
 * Audit runtimeModules + chargement meta pour dashboard ops.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '../../..');
const REPO_ROOT = path.resolve(SERVER_ROOT, '..');
const DEFAULT_SKILLS_DIR = path.join(SERVER_ROOT, 'data/skills');
const SCHEMA_PATH = path.join(
  SERVER_ROOT,
  'src/agent/contracts/skillMeta.schema.json',
);

const ajv = new Ajv({ allErrors: true, strict: false });
const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf-8'));
const validateMeta = ajv.compile(schema);

function resolveRepoPath(relativePath) {
  return path.join(REPO_ROOT, relativePath.replace(/\//g, path.sep));
}

function listSkillDirs(skillsDir = DEFAULT_SKILLS_DIR) {
  return fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('skill-'))
    .map((entry) => entry.name)
    .sort();
}

export function auditRuntimeModules(skillName, meta) {
  const warnings = [];

  if (meta.requiresRuntime === true && (!meta.runtimeModules || meta.runtimeModules.length === 0)) {
    warnings.push({
      skill: skillName,
      code: 'RUNTIME_MISSING',
      message: 'requiresRuntime=true mais aucun runtimeModules déclaré',
      suggestion: 'Ajouter runtimeModules[] ou mettre requiresRuntime=false',
    });
  }

  for (const mod of meta.runtimeModules || []) {
    if (mod.status !== 'implemented') continue;

    const fullPath = resolveRepoPath(mod.path);
    if (!fs.existsSync(fullPath)) {
      warnings.push({
        skill: skillName,
        code: 'RUNTIME_FILE_MISSING',
        module: mod.path,
        exportName: mod.exportName,
        message: 'Module runtime marqué implemented mais fichier inexistant',
        suggestion: `Créer ${mod.path} ou mettre status="pending"`,
      });
    }
  }

  return warnings;
}

function auditSubSkillLinks(skillName, meta, allSkillIds) {
  const warnings = [];

  if (meta.parentSkillId && !allSkillIds.has(meta.parentSkillId)) {
    warnings.push({
      skill: skillName,
      code: 'PARENT_SKILL_MISSING',
      message: `parentSkillId=${meta.parentSkillId} introuvable`,
    });
  }

  for (const subId of meta.subSkills || []) {
    if (!allSkillIds.has(subId)) {
      warnings.push({
        skill: skillName,
        code: 'SUB_SKILL_MISSING',
        message: `subSkill ${subId} introuvable`,
      });
    }
  }

  return warnings;
}

/**
 * Charge tous les skills avec validation schéma + audit runtime v1.6.
 * @param {string} [skillsDir]
 */
export function loadSkills(skillsDir = DEFAULT_SKILLS_DIR) {
  const skillNames = listSkillDirs(skillsDir);
  const allSkillIds = new Set(skillNames);
  const skills = [];
  const warnings = [];
  const errors = [];

  for (const skillName of skillNames) {
    const metaPath = path.join(skillsDir, skillName, 'meta.json');

    if (!fs.existsSync(metaPath)) {
      errors.push({
        skill: skillName,
        code: 'META_MISSING',
        message: 'meta.json manquant',
      });
      continue;
    }

    let meta;
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    } catch (err) {
      errors.push({
        skill: skillName,
        code: 'META_INVALID_JSON',
        message: err.message,
      });
      continue;
    }

    const valid = validateMeta(meta);
    if (!valid) {
      errors.push({
        skill: skillName,
        code: 'SCHEMA_INVALID',
        errors: validateMeta.errors,
      });
      continue;
    }

    warnings.push(...auditRuntimeModules(skillName, meta));
    warnings.push(...auditSubSkillLinks(skillName, meta, allSkillIds));

    skills.push({ name: skillName, meta });
  }

  return { skills, warnings, errors, skillsDir };
}

/**
 * @param {Array<{ name: string, meta: object }>} skills
 */
export function logRuntimeModuleStatus(skills) {
  console.log('\n📊 État runtimeModules (v1.6)');
  console.log('='.repeat(60));

  const runtimeBacked = skills.filter(
    (entry) => entry.meta.runtimeModules?.length > 0,
  );
  const promptOnly = skills.filter(
    (entry) => !entry.meta.runtimeModules?.length,
  );

  console.log(`\n🟢 Runtime-backed: ${runtimeBacked.length} skills`);
  for (const entry of runtimeBacked) {
    const modules = entry.meta.runtimeModules
      .map((mod) => `${mod.exportName} (${mod.status || 'implemented'})`)
      .join(', ');
    console.log(`  ✓ ${entry.name}: ${modules}`);
  }

  console.log(`\n🔵 Prompt-only: ${promptOnly.length} skills`);
  for (const entry of promptOnly) {
    const flag =
      entry.meta.requiresRuntime === true
        ? '⚠️ requiresRuntime=true'
        : '✅ requiresRuntime=false';
    const parent = entry.meta.parentSkillId
      ? ` parent=${entry.meta.parentSkillId}`
      : '';
    console.log(`  • ${entry.name}: ${flag}${parent}`);
  }

  console.log(`\n${'='.repeat(60)}`);
}

export { DEFAULT_SKILLS_DIR, REPO_ROOT, SERVER_ROOT };
