/**
 * Dashboard ops — maturité skills prompt-only vs runtime-backed.
 */
import { loadSkills } from '../agent/utils/skillRuntimeRegistry.js';

const WAVE2_CRITICAL = [
  'skill-pdf-extraction',
  'skill-egress-security',
  'skill-memory-governance',
  'skill-quality-gate',
];

function isFullyImplemented(entry) {
  const modules = entry.meta.runtimeModules || [];
  if (modules.length === 0) return false;
  return modules.every((mod) => mod.status === 'implemented');
}

function hasPendingModule(entry) {
  return (entry.meta.runtimeModules || []).some((mod) => mod.status === 'pending');
}

/**
 * @param {string} [skillsDir]
 */
export function generateSkillsDashboard(skillsDir) {
  const { skills, warnings, errors } = loadSkills(skillsDir);

  const runtimeBacked = skills.filter(
    (entry) => entry.meta.runtimeModules?.length > 0,
  );
  const promptOnly = skills.filter(
    (entry) => !entry.meta.runtimeModules?.length,
  );
  const implemented = runtimeBacked.filter(isFullyImplemented);
  const pending = runtimeBacked.filter(hasPendingModule);
  const subSkills = skills.filter((entry) => entry.meta.parentSkillId);
  const parentsWithSubs = skills.filter(
    (entry) => (entry.meta.subSkills || []).length > 0,
  );

  return {
    summary: {
      totalSkills: skills.length,
      runtimeBacked: runtimeBacked.length,
      promptOnly: promptOnly.length,
      fullyImplemented: implemented.length,
      partiallyImplemented: pending.length,
      subSkills: subSkills.length,
      parentSkills: parentsWithSubs.length,
      warnings: warnings.length,
      errors: errors.length,
    },
    runtimeBacked: runtimeBacked.map((entry) => ({
      id: entry.name,
      name: entry.meta.name,
      modules: entry.meta.runtimeModules,
      subSkills: entry.meta.subSkills || [],
    })),
    promptOnly: promptOnly.map((entry) => ({
      id: entry.name,
      name: entry.meta.name,
      requiresRuntime: entry.meta.requiresRuntime === true,
      parentSkillId: entry.meta.parentSkillId || null,
    })),
    wave2: {
      critical: WAVE2_CRITICAL.map((id) => {
        const entry = skills.find((skill) => skill.name === id);
        return {
          id,
          present: Boolean(entry),
          runtimeBacked: Boolean(entry?.meta.runtimeModules?.length),
          fullyImplemented: entry ? isFullyImplemented(entry) : false,
        };
      }),
    },
    coverage: {
      pdf: runtimeBacked.some((entry) => entry.name === 'skill-pdf-extraction')
        ? '✅'
        : '❌',
      egress: runtimeBacked.some((entry) => entry.name === 'skill-egress-security')
        ? '✅'
        : '❌',
      memory: runtimeBacked.some(
        (entry) => entry.name === 'skill-memory-governance',
      )
        ? '✅'
        : '❌',
      quality: runtimeBacked.some((entry) => entry.name === 'skill-quality-gate')
        ? '✅'
        : '❌',
    },
    warnings,
    errors,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * @param {string} [skillsDir]
 */
export function printSkillsDashboard(skillsDir) {
  const dashboard = generateSkillsDashboard(skillsDir);

  console.log('\n📊 DASHBOARD SUITE DE SKILLS La Citadelle');
  console.log('='.repeat(70));
  console.log(`\nTotal skills: ${dashboard.summary.totalSkills}`);
  console.log(`  🟢 Runtime-backed: ${dashboard.summary.runtimeBacked}`);
  console.log(`  🔵 Prompt-only: ${dashboard.summary.promptOnly}`);
  console.log(`  🧩 Sub-skills (ADR-008): ${dashboard.summary.subSkills}`);
  console.log(`  ✅ Fully implemented: ${dashboard.summary.fullyImplemented}`);
  console.log(`  ⚠️  Partially implemented: ${dashboard.summary.partiallyImplemented}`);
  console.log(`\n❌ Errors: ${dashboard.summary.errors}`);
  console.log(`⚠️  Warnings: ${dashboard.summary.warnings}`);

  console.log('\n🎯 Couverture Vague 2:');
  console.log(`  PDF: ${dashboard.coverage.pdf}`);
  console.log(`  Egress: ${dashboard.coverage.egress}`);
  console.log(`  Memory: ${dashboard.coverage.memory}`);
  console.log(`  Quality: ${dashboard.coverage.quality}`);

  if (dashboard.warnings.length > 0) {
    console.log('\n⚠️  Avertissements:');
    for (const warning of dashboard.warnings) {
      console.log(`  • [${warning.code}] ${warning.skill}: ${warning.message}`);
    }
  }

  if (dashboard.errors.length > 0) {
    console.log('\n❌ Erreurs:');
    for (const error of dashboard.errors) {
      console.log(`  • [${error.code}] ${error.skill}: ${error.message || JSON.stringify(error.errors)}`);
    }
  }

  console.log(`\n${'='.repeat(70)}\n`);

  return dashboard;
}

export default { generateSkillsDashboard, printSkillsDashboard };
