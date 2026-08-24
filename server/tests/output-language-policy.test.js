import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  detectDominantLanguage,
  extractExplicitOutputLanguage,
  resolveOutputLanguagePolicy,
  enforceOutputLanguage,
  isTextInLanguage,
  buildOutputLanguageSystemAddon,
} from "../src/agent/policies/posture/outputLanguagePolicy.js";
import {
  resolveShortGeneralAnswerShortCircuit,
  WINDOWS_8_SHORT_GENERAL_REPLY,
  WINDOWS_8_SHORT_GENERAL_REPLY_EN,
} from "../src/agent/policies/conversation/shortGeneralAnswerPolicy.js";
import { getComposerSystemPrompt } from "../src/agent/config/modeResponseContracts.js";

const SPANISH_WEB_DUMP =
  "Pros y Contras de Windows 8 | Gustos y Disgustos de los Usuarios - G2 : 3 source(s) web consultée(s) (g2.com, tecnovortex.com, softonic.com). " +
  "¿Qué opinás de Windows 8? - Tecnovortex. Windows 8: una revolución que nadie había pedido - Softonic.";

describe("output_language_policy", () => {
  it("que penses-tu de Windows 8 ? → fr", () => {
    const policy = resolveOutputLanguagePolicy("que penses-tu de Windows 8 ?");
    assert.equal(policy.outputLanguage, "fr");
    assert.equal(policy.explicitOverride, false);
    assert.equal(policy.sourceLanguage, null);
  });

  it("what do you think about Windows 8? → en", () => {
    const policy = resolveOutputLanguagePolicy(
      "what do you think about Windows 8?",
    );
    assert.equal(policy.outputLanguage, "en");
    assert.equal(policy.explicitOverride, false);
  });

  it("¿qué piensas de Windows 8? → es", () => {
    const policy = resolveOutputLanguagePolicy("¿qué piensas de Windows 8?");
    assert.equal(policy.outputLanguage, "es");
    assert.equal(policy.explicitOverride, false);
  });

  it("Réponds en anglais : que penses-tu de Windows 8 ? → en explicite", () => {
    const q = "Réponds en anglais : que penses-tu de Windows 8 ?";
    assert.equal(extractExplicitOutputLanguage(q), "en");
    const policy = resolveOutputLanguagePolicy(q);
    assert.equal(policy.outputLanguage, "en");
    assert.equal(policy.explicitOverride, true);
    assert.equal(policy.currentUserInputLanguage, "fr");
  });

  it("sources espagnoles ne battent pas l'input français", () => {
    const policy = resolveOutputLanguagePolicy("que penses-tu de Windows 8 ?", {
      sourceLanguage: "es",
    });
    assert.equal(policy.outputLanguage, "fr");
    const gated = enforceOutputLanguage(SPANISH_WEB_DUMP, policy);
    assert.equal(gated.ok, false);
    assert.equal(gated.blocked, true);
    assert.equal(isTextInLanguage(gated.text, "fr"), true);
    assert.doesNotMatch(gated.text, /Gustos y Disgustos|tecnovortex|opinás/i);
  });

  it("analyse ce PDF en anglais → override en, pas la langue du document", () => {
    const q = "analyse ce PDF en anglais";
    const policy = resolveOutputLanguagePolicy(q, { sourceLanguage: "fr" });
    assert.equal(policy.explicitOverride, true);
    assert.equal(policy.outputLanguage, "en");
    assert.notEqual(policy.outputLanguage, policy.sourceLanguage);
  });

  it("input anglais gagne sur un fil français (pas d'imposition aveugle)", () => {
    const policy = resolveOutputLanguagePolicy(
      "what do you think about Windows 8?",
      {
        history: [
          { role: "user", content: "salut ça va ?" },
          { role: "assistant", content: "Ça va bien, merci." },
        ],
      },
    );
    assert.equal(policy.outputLanguage, "en");
  });

  it("titre / produit / URL ne comptent pas comme changement de langue", () => {
    const detected = detectDominantLanguage(
      "que penses-tu de https://g2.com/es/products/windows-8/reviews Windows 8 Microsoft",
    );
    assert.equal(detected.code, "fr");
  });

  it("COMPOSER reçoit l'addon langue", () => {
    const prompt = getComposerSystemPrompt(
      {
        user_query: "que penses-tu de Windows 8 ?",
        meta: {
          languagePolicy: resolveOutputLanguagePolicy(
            "que penses-tu de Windows 8 ?",
          ),
        },
      },
      {},
    );
    assert.match(prompt, /LANGUE DE SORTIE/);
    assert.match(prompt, /français/);
  });

  it("Win8 + consigne anglais → fiche EN, pas FR", () => {
    const q = "Réponds en anglais : que penses-tu de Windows 8 ?";
    const policy = resolveOutputLanguagePolicy(q);
    const hit = resolveShortGeneralAnswerShortCircuit(q, {
      languagePolicy: policy,
    });
    assert.equal(hit?.reply, WINDOWS_8_SHORT_GENERAL_REPLY_EN);
    assert.notEqual(hit?.reply, WINDOWS_8_SHORT_GENERAL_REPLY);
    assert.equal(isTextInLanguage(hit.reply, "en"), true);
  });
});
