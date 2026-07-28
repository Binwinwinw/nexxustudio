/**
 * Fail-closed — bloque les affirmations d'exécution de skills non prouvés au runtime.
 */
import { loadSkills } from "./skillRuntimeRegistry.js";
import { UNSUPPORTED_ACTION_REFUSAL } from "../config/modeResponseContracts.js";

export const SKILL_EXECUTION_CLAIM_RULE = "no_unverified_skill_execution_claims";

let executableSkillCache = null;

function getExecutableSkillIds() {
  if (executableSkillCache) return executableSkillCache;

  const { skills } = loadSkills();
  executableSkillCache = new Set(
    skills
      .filter((entry) => {
        const meta = entry.meta || {};
        if (meta.enabled === false) return false;
        if (meta.requiresRuntime === false) return false;
        return (meta.runtimeModules || []).some((mod) => mod.status === "implemented");
      })
      .map((entry) => entry.name),
  );

  return executableSkillCache;
}

export function resetExecutableSkillCache() {
  executableSkillCache = null;
}

export function isSkillExecutableAtRuntime(skillId = "") {
  const id = String(skillId || "").trim().toLowerCase();
  if (!id.startsWith("skill-")) return false;
  return getExecutableSkillIds().has(id);
}

const EXECUTION_ASSERTION_PATTERNS = [
  /\bje vais utiliser le skill\b/i,
  /\bce skill est conçu pour\b/i,
  /\blance la préparation\b/i,
  /\bvia l'orchestrateur\b/i,
  /\bje lance l'indexation\b/i,
  /\bindexation via l'orchestrateur\b/i,
];

export function detectUnverifiedSkillExecutionClaims(text = "") {
  const cleaned = String(text || "").trim();
  if (!cleaned) return [];

  const violations = [];
  const mentioned = [
    ...cleaned.matchAll(/\bskill-([a-z0-9-]+)\b/gi),
  ].map((m) => `skill-${m[1].toLowerCase()}`);

  const uniqueSkills = [...new Set(mentioned)];

  for (const skillId of uniqueSkills) {
    const assertsExecution = EXECUTION_ASSERTION_PATTERNS.some((p) => p.test(cleaned));
    if (!assertsExecution) continue;
    if (!isSkillExecutableAtRuntime(skillId)) {
      violations.push({
        skillId,
        reason: "skill_not_executable_at_runtime",
      });
    }
  }

  if (
    EXECUTION_ASSERTION_PATTERNS.some((p) => p.test(cleaned)) &&
    uniqueSkills.length === 0
  ) {
    violations.push({
      skillId: null,
      reason: "execution_claim_without_verified_skill",
    });
  }

  return violations;
}

export function sanitizeUnverifiedSkillExecutionClaims(text = "") {
  const violations = detectUnverifiedSkillExecutionClaims(text);
  if (!violations.length) return text;

  return UNSUPPORTED_ACTION_REFUSAL;
}
