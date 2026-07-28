import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  detectUnverifiedSkillExecutionClaims,
  sanitizeUnverifiedSkillExecutionClaims,
  isSkillExecutableAtRuntime,
} from "../src/agent/utils/skillExecutionClaimGuard.js";

describe("skillExecutionClaimGuard", () => {
  it("skill-industrial-maturation n'est pas exécutable au runtime", () => {
    assert.equal(isSkillExecutableAtRuntime("skill-industrial-maturation"), false);
  });

  it("détecte une affirmation d'exécution non prouvée", () => {
    const text =
      "Je vais utiliser le skill skill-industrial-maturation pour indexer tout le code via l'orchestrateur.";
    const violations = detectUnverifiedSkillExecutionClaims(text);
    assert.ok(violations.length >= 1);
    assert.equal(violations[0].skillId, "skill-industrial-maturation");
  });

  it("sanitise en options sans promesse d'exécution", () => {
    const text =
      "Je vais utiliser le skill skill-industrial-maturation. Ce skill est conçu pour indexer efficacement tout le code.";
    const sanitized = sanitizeUnverifiedSkillExecutionClaims(text);
    assert.match(sanitized, /approches concrètes/i);
    assert.ok(!sanitized.includes("skill-industrial-maturation"));
    assert.ok(!sanitized.includes("via l'orchestrateur"));
  });

  it("laisse passer un texte sans affirmation d'exécution de skill", () => {
    const text = "Voici 3 approches pour un code-reviewer local-first.";
    assert.equal(sanitizeUnverifiedSkillExecutionClaims(text), text);
  });
});
