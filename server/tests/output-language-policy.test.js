import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  detectDominantLanguage,
  extractExplicitOutputLanguage,
  resolveOutputLanguagePolicy,
  enforceOutputLanguage,
  isTextInLanguage,
  hasFrenchResponseStructure,
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

const MIXED_HARNESS_FR =
  "Le harnais (harness en anglais) est la couche d'exécution d'un système multi-agent. " +
  "The agent and the planner and the worker share the same runtime, with tools and budgets for this loop. " +
  "En pratique, c'est le cadre qui lance, borne et relance les appels. " +
  "Source : « Designing Agent Harnesses » (https://example.com/harness).";

const ENGLISH_ONLY_HARNESS =
  "The harness in a multi-agent system is the execution layer. " +
  "The agent uses tools and the planner shares the runtime with the worker. " +
  "This and that are handled by the same budget and the same loop.";

describe("COMPOSER_LANGUAGE_GATE_PRESERVES_EVIDENCE_V1", () => {
  const frPolicy = { outputLanguage: "fr" };

  it("query harnais + glose EN reste FR", () => {
    const policy = resolveOutputLanguagePolicy(
      "ok, je voudrais que tu recherches des informations précises sur le harnais (harness en anglais) dans un système agentique multi agent",
    );
    assert.equal(policy.outputLanguage, "fr");
  });

  it("mixte technique hors COMPOSER → toujours BLOCK_REPLY", () => {
    assert.equal(isTextInLanguage(MIXED_HARNESS_FR, "fr"), false);
    const gated = enforceOutputLanguage(MIXED_HARNESS_FR, frPolicy);
    assert.equal(gated.blocked, true);
    assert.match(gated.text, /pas pu garder cette réponse dans ta langue/i);
  });

  it("mixte technique COMPOSER + preuves web → conserve, pas BLOCK_REPLY", () => {
    assert.equal(hasFrenchResponseStructure(MIXED_HARNESS_FR), true);
    const gated = enforceOutputLanguage(MIXED_HARNESS_FR, frPolicy, {
      pipelinePath: "COMPOSER",
      hasWebEvidence: true,
    });
    assert.equal(gated.blocked, false);
    assert.match(gated.text, /harnais|couche d['']exécution|En pratique/i);
    assert.doesNotMatch(gated.text, /pas pu garder cette réponse dans ta langue/i);
  });

  it("COMPOSER anglais pur + preuves web → conserve le livrable", () => {
    const gated = enforceOutputLanguage(ENGLISH_ONLY_HARNESS, frPolicy, {
      pipelinePath: "COMPOSER",
      hasWebEvidence: true,
    });
    assert.equal(gated.blocked, false);
    assert.equal(gated.ok, false);
    assert.equal(gated.preserved, "web_evidence");
    assert.equal(gated.text, ENGLISH_ONLY_HARNESS);
  });

  it("anglais pur hors COMPOSER → BLOCK_REPLY", () => {
    const gated = enforceOutputLanguage(ENGLISH_ONLY_HARNESS, frPolicy, {
      pipelinePath: "SIMPLE_FAST",
    });
    assert.equal(gated.blocked, true);
    assert.match(gated.text, /pas pu garder cette réponse dans ta langue/i);
  });

  it("dump espagnol COMPOSER sans preuve web → toujours bloqué", () => {
    const gated = enforceOutputLanguage(SPANISH_WEB_DUMP, frPolicy, {
      pipelinePath: "COMPOSER",
      hasWebEvidence: false,
    });
    assert.equal(gated.blocked, true);
    assert.doesNotMatch(gated.text, /Gustos y Disgustos|opinás/i);
  });
});

