import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TUTOIEMENT_RULE, TUTOIEMENT_COMPOSER_LINE } from "../src/agent/policies/posture/index.js";
import { MODE_SYSTEM_PROMPTS } from "../src/agent/config/modeResponseContracts.js";
import { buildSystemPrompt } from "../src/agent/prompts/systemPromptBuilder.js";

describe("addressingPolicy", () => {
  it("expose la règle de tutoiement", () => {
    assert.match(TUTOIEMENT_RULE, /TUTOIEMENT OBLIGATOIRE/i);
    assert.match(TUTOIEMENT_RULE, /vouvoiement/i);
  });

  it("injecte le tutoiement dans tous les modes composer", () => {
    for (const prompt of Object.values(MODE_SYSTEM_PROMPTS)) {
      assert.match(prompt, /TUTOIEMENT OBLIGATOIRE/i);
    }
  });

  it("injecte le tutoiement dans buildSystemPrompt", () => {
    const prompt = buildSystemPrompt([], false, { phase: "DISCOVERY", score: 0 });
    assert.match(prompt, /TUTOIEMENT OBLIGATOIRE/i);
  });
});
