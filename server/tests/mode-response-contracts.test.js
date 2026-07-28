import test from "node:test";
import assert from "node:assert/strict";

import {
  RESPONSE_MODES,
  INSUFFICIENT_SIGNAL_REFUSAL,
  getModeSystemPrompt,
  getComposerSystemPrompt,
  resolveComposerContractMode,
  enforceModeContract,
  enforceComposerContract,
  validateModeContract,
  MODE_SYSTEM_PROMPTS,
  shouldApplyOpenPropositionContract,
  isOpenProjectIdeation,
  buildAttachedDocumentFallback,
  isInsufficientSignalRefusal,
  isGreetingOrIntroduction,
  evaluateEpistemicRefusal,
} from "../src/agent/config/modeResponseContracts.js";

test("contracts: all modes have system prompts", () => {
  for (const mode of Object.values(RESPONSE_MODES)) {
    assert.ok(MODE_SYSTEM_PROMPTS[mode], `Missing prompt for ${mode}`);
    assert.ok(getModeSystemPrompt(mode).includes("redacted_thinking"));
    if (mode === RESPONSE_MODES.OPEN_PROPOSITION) {
      assert.ok(getModeSystemPrompt(mode).includes("idéation suffit"));
    } else if (mode === RESPONSE_MODES.SIMPLE_FACTUAL) {
      assert.ok(getModeSystemPrompt(mode).includes("SIMPLE_FACTUAL_LOOKUP"));
      assert.doesNotMatch(getModeSystemPrompt(mode), /REFUS PROPRE/);
    } else {
      assert.ok(getModeSystemPrompt(mode).includes("REFUS PROPRE"));
    }
  }
});

test("contracts: SIMPLE_FAST enforces max two sentences", () => {
  const raw =
    "Bonjour. Voici une deuxième phrase. Et une troisième phrase en trop.";
  const out = enforceModeContract(RESPONSE_MODES.SIMPLE_FAST, raw);
  const count = out.split(/[.!?]+/).filter((s) => s.trim()).length;
  assert.equal(count, 2);
});

test("contracts: SIMPLE_FAST strips thinking blocks", () => {
  const raw =
    "<think>interne</think>Salut, tout va bien. Et toi ?";
  const out = enforceModeContract(RESPONSE_MODES.SIMPLE_FAST, raw);
  assert.equal(out.includes("<think>"), false);
  assert.equal(out.includes("Salut"), true);
});

test("contracts: empty signal triggers refusal (non-INSTANT)", () => {
  const out = enforceModeContract(RESPONSE_MODES.CRITICAL, "   ");
  assert.equal(out, INSUFFICIENT_SIGNAL_REFUSAL);
});

test("contracts: DOCUMENT validates structure on long text", () => {
  const structured = "- Point A\n- Point B\n- Point C";
  const validation = validateModeContract(RESPONSE_MODES.DOCUMENT, structured);
  assert.equal(validation.conform, true);

  const flat =
    "Ceci est une longue réponse sans structure ni puces ni sections explicites pour un document.";
  const flatValidation = validateModeContract(RESPONSE_MODES.DOCUMENT, flat);
  assert.equal(flatValidation.conform, false);
  assert.ok(flatValidation.failures.includes("document_missing_structure"));
});

test("contracts: CRITICAL validation expects caution markers on long answers", () => {
  const cautious =
    "Confirmé: le module est stable. Risque résiduel faible. Recommandation: déployer en local.";
  assert.equal(
    validateModeContract(RESPONSE_MODES.CRITICAL, cautious).conform,
    true,
  );
});

test("contracts: INSTANT keeps short deterministic output", () => {
  const out = enforceModeContract(RESPONSE_MODES.INSTANT, "Salut !");
  assert.equal(out, "Salut !");
});

test("contracts: INSTANT ne tronque pas un panel open_prompt (>6 lignes)", () => {
  const panel =
    "Tu as le choix — on peut partir là-dessus :\n\n" +
    "1. discussion libre\n" +
    "2. brainstorm léger\n" +
    "3. recherche web sur un thème\n" +
    "4. petit livrable tech\n" +
    "5. apprendre un sujet\n\n" +
    "Choisis un numéro et on se lance";
  const out = enforceModeContract(RESPONSE_MODES.INSTANT, panel);
  assert.match(out, /5\.\s+apprendre un sujet/);
  assert.match(out, /Choisis un numéro et on se lance/);
  assert.equal(out.includes("4. petit livrable tech"), true);
});

test("composer: resolveComposerContractMode maps social to SIMPLE_FAST", () => {
  const mode = resolveComposerContractMode(
    { user_intent: "social", mode: "OPERATIONAL" },
    { isSocial: true, forceShort: false, useFactual: false },
  );
  assert.equal(mode, RESPONSE_MODES.SIMPLE_FAST);
});

test("composer: resolveComposerContractMode maps epistemic high risk to CRITICAL", () => {
  const mode = resolveComposerContractMode(
    { mode: "EPISTEMIC", risk_level: "high" },
    { isSocial: false, forceShort: false, useFactual: true },
  );
  assert.equal(mode, RESPONSE_MODES.CRITICAL);
});

test("composer: system prompt includes thinking and refusal rules", () => {
  const prompt = getComposerSystemPrompt(
    { user_intent: "unknown", mode: "OPERATIONAL", user_query: "test" },
    { forceShort: false, isSocial: false, useFactual: false },
  );
  assert.ok(prompt.includes("redacted_thinking"));
  assert.ok(prompt.includes("REFUS PROPRE"));
});

test("composer: enforceComposerContract strips thinking leaks", () => {
  const packet = { user_intent: "unknown", mode: "OPERATIONAL", user_query: "bonjour" };
  const raw =
    "<think>interne</think>Bonjour, comment puis-je t'aider ?";
  const out = enforceComposerContract(packet, raw, {
    forceShort: true,
    isSocial: false,
    useFactual: false,
  });
  assert.equal(out.includes("<think>"), false);
  assert.ok(out.includes("Bonjour"));
});

test("open proposition: detects ideation + fallback_no_results", () => {
  const packet = {
    user_query: "un projet avec l'IA qu'est-ce que tu pourrais proposer???",
    user_intent: "expert_task",
    mode: "EPISTEMIC",
    meta: { web_failure_mode: "fallback_no_results" },
  };
  assert.equal(isOpenProjectIdeation(packet.user_query, packet), true);
  assert.equal(shouldApplyOpenPropositionContract(packet), true);
});

test("open proposition: active even when web would return sources", () => {
  const packet = {
    user_query: "J'ai envie de construire quelque chose en IA, mais je ne sais pas quoi",
    user_intent: "expert_task",
    mode: "EPISTEMIC",
    meta: {},
  };
  assert.equal(shouldApplyOpenPropositionContract(packet), true);
});

test("open proposition: skipped when user asks for web sources", () => {
  const packet = {
    user_query: "trouve des articles web sur les projets IA avec sources",
    mode: "EPISTEMIC",
    meta: {},
  };
  assert.equal(shouldApplyOpenPropositionContract(packet), false);
});

test("open proposition: resolves dedicated contract mode", () => {
  const mode = resolveComposerContractMode(
    { mode: "EPISTEMIC" },
    { openProposition: true },
  );
  assert.equal(mode, RESPONSE_MODES.OPEN_PROPOSITION);
  const prompt = getComposerSystemPrompt(
    { user_query: "projet ia", mode: "EPISTEMIC" },
    { openProposition: true },
  );
  assert.ok(prompt.includes("Voici 3 pistes concrètes"));
});

test("pipeline routing: short ideation bypasses SIMPLE_FAST gate", () => {
  const query =
    "J'ai envie de construire quelque chose en IA, mais je ne sais pas quoi";
  const wordsCount = query.toLowerCase().split(/\s+/).length;
  assert.ok(wordsCount < 15);
  assert.equal(isOpenProjectIdeation(query, { user_query: query }), true);
  assert.equal(shouldApplyOpenPropositionContract({ user_query: query, meta: {} }), true);
});

test("open proposition: meta flag forces contract", () => {
  assert.equal(
    shouldApplyOpenPropositionContract({
      user_query: "hello",
      meta: { open_proposition: true },
    }),
    true,
  );
});

test("open proposition: does not trigger insufficient-signal refusal", () => {
  const out = enforceModeContract(RESPONSE_MODES.OPEN_PROPOSITION, "   ", {
    allowRefusal: true,
  });
  assert.notEqual(out, INSUFFICIENT_SIGNAL_REFUSAL);
});

test("open proposition: rejects generic suggestions section", () => {
  const bad =
    "Voici 3 pistes.\nSuggestions pour avancer:\n- faire un plan\n- lire la doc";
  const validation = validateModeContract(RESPONSE_MODES.OPEN_PROPOSITION, bad);
  assert.equal(validation.conform, false);
  assert.ok(validation.failures.includes("open_proposition_generic_section"));
});

test("document: attached mode blocks LLM refusal phrase", () => {
  const out = enforceModeContract(
    RESPONSE_MODES.DOCUMENT,
    INSUFFICIENT_SIGNAL_REFUSAL,
    { allowRefusal: false, attachedDocument: true },
  );
  assert.equal(out, "");
  assert.ok(isInsufficientSignalRefusal(INSUFFICIENT_SIGNAL_REFUSAL));
});

test("document: attached fallback produces structured output", () => {
  const briefing = `\n--- DOCUMENTS DE CONTEXTE FOURNIS PAR L'UTILISATEUR ---\n\n[DOCUMENT #1: server-index-clean.js]\nTYPE: text/javascript\nCONTENU:\nimport express from 'express';\nconst app = express();\n\n------------------------------------------------------\n`;
  const out = buildAttachedDocumentFallback(
    briefing,
    "analyse le fichier stp",
    "server-index-clean.js",
  );
  assert.match(out, /## Analyse de server-index-clean\.js/);
  assert.match(out, /express/);
  assert.notEqual(out, INSUFFICIENT_SIGNAL_REFUSAL);
});

test("evaluateEpistemicRefusal: refuses without reliable context", () => {
  const out = evaluateEpistemicRefusal({
    query: "Quelle est la config secrète du serveur XYZ?",
  });
  assert.equal(out.shouldRefuse, true);
  assert.equal(out.message, INSUFFICIENT_SIGNAL_REFUSAL);
  assert.equal(out.fallbackSkillId, "skill-document-analysis");
});

test("evaluateEpistemicRefusal: open ideation exception", () => {
  const out = evaluateEpistemicRefusal({
    query: "proposes-moi des idées créatives pour mon app",
  });
  assert.equal(out.shouldRefuse, false);
  assert.equal(out.reason, "open_proposition_exception");
});

test("evaluateEpistemicRefusal: document attached suggests fallback", () => {
  const out = evaluateEpistemicRefusal({
    query: "analyse le document",
    hasAttachedDocument: true,
  });
  assert.equal(out.shouldRefuse, false);
  assert.equal(out.fallbackSkillId, "skill-document-analysis");
});

test("evaluateEpistemicRefusal: enforces refusal on empty response", () => {
  const out = evaluateEpistemicRefusal({
    query: "explique le module auth",
    responseText: "   ",
    mode: RESPONSE_MODES.CRITICAL,
  });
  assert.equal(out.shouldRefuse, true);
  assert.equal(out.reason, "enforced_refusal");
});

test("isGreetingOrIntroduction: détecte salutations et présentations", () => {
  assert.equal(isGreetingOrIntroduction("salut salut qui es tu ?"), true);
  assert.equal(isGreetingOrIntroduction("Bonjour, comment ça va ?"), true);
  assert.equal(isGreetingOrIntroduction("Présente-toi"), true);
  assert.equal(isGreetingOrIntroduction("Quelle est la config secrète du serveur?"), false);
});

test("evaluateEpistemicRefusal: n refuse pas les greetings / présentations", () => {
  const out = evaluateEpistemicRefusal({
    query: "salut salut qui es tu ?",
  });
  assert.equal(out.shouldRefuse, false);
  assert.equal(out.reason, "greeting_or_introduction");
});

test("evaluateEpistemicRefusal: n refuse pas le rappel conversationnel", () => {
  const out = evaluateEpistemicRefusal({
    query: "saurais tu retrouver de quoi nous avons parlé hier ?",
  });
  assert.equal(out.shouldRefuse, false);
  assert.equal(out.reason, "conversation_memory_recall");
});

test("evaluateEpistemicRefusal: n refuse pas si gravité intent faible", () => {
  const out = evaluateEpistemicRefusal({
    query: "explique le module auth",
    intent: { gravity: 0.1 },
  });
  assert.equal(out.shouldRefuse, false);
  assert.equal(out.reason, "low_intent_gravity");
});

test("evaluateEpistemicRefusal: n refuse pas si identité canopy disponible", () => {
  const out = evaluateEpistemicRefusal({
    query: "explique le module auth",
    canopy: { identity: { name: "NEXXUS" } },
  });
  assert.equal(out.shouldRefuse, false);
  assert.equal(out.reason, "canopy_identity_available");
});

// ==================== Régression épistémique (v1.7) ====================

test("isGreetingOrIntroduction: coucou, hey, yo et casse", () => {
  assert.equal(isGreetingOrIntroduction("coucou"), true);
  assert.equal(isGreetingOrIntroduction("hey"), true);
  assert.equal(isGreetingOrIntroduction("yo"), true);
  assert.equal(isGreetingOrIntroduction("SALUT"), true);
  assert.equal(isGreetingOrIntroduction("qui es-tu ?"), true);
  assert.equal(isGreetingOrIntroduction("présente-toi"), true);
  assert.equal(isGreetingOrIntroduction("analyse ce code"), false);
});

test("evaluateEpistemicRefusal: greetings sociaux — pas de refus", () => {
  for (const query of ["coucou", "hey", "yo", "salut salut qui es tu ?"]) {
    const out = evaluateEpistemicRefusal({ query });
    assert.equal(out.shouldRefuse, false, query);
    assert.equal(out.reason, "greeting_or_introduction", query);
  }
});

test("evaluateEpistemicRefusal: greeting + tâche technique — pas de refus", () => {
  const out = evaluateEpistemicRefusal({ query: "salut, analyse ce repo" });
  assert.equal(out.shouldRefuse, false);
  assert.equal(out.reason, "greeting_or_introduction");
});

test("evaluateEpistemicRefusal: idéation ouverte — pas de refus", () => {
  for (const query of [
    "propose des idées créatives pour mon app",
    "je veux des idées créatives pour mon projet",
  ]) {
    const out = evaluateEpistemicRefusal({ query });
    assert.equal(out.shouldRefuse, false, query);
    assert.equal(out.reason, "open_proposition_exception", query);
  }
});

test("evaluateEpistemicRefusal: incertitude utilisateur sans contexte — refus canonique", () => {
  const out = evaluateEpistemicRefusal({ query: "je ne sais pas comment faire X" });
  assert.equal(out.shouldRefuse, true);
  assert.equal(out.reason, "insufficient_context");
  assert.equal(out.message, INSUFFICIENT_SIGNAL_REFUSAL);
  assert.equal(out.fallbackSkillId, "skill-document-analysis");
});

test("evaluateEpistemicRefusal: questions sans signal fiable — refus canonique", () => {
  for (const query of [
    "quel sera le cours de l action Apple demain ?",
    "prédire le résultat du match de foot de demain",
    "je n ai aucune information sur ce sujet",
    "les données manquantes m empêche de répondre",
  ]) {
    const out = evaluateEpistemicRefusal({ query });
    assert.equal(out.shouldRefuse, true, query);
    assert.ok(
      out.reason === "insufficient_context" || out.reason === "globally_unanswerable",
      query,
    );
    assert.equal(out.message, INSUFFICIENT_SIGNAL_REFUSAL, query);
  }
});

test("evaluateEpistemicRefusal: pièce jointe + question vague — fallback document", () => {
  const out = evaluateEpistemicRefusal({
    query: "qu est-ce que tu en penses ?",
    hasAttachedDocument: true,
  });
  assert.equal(out.shouldRefuse, false);
  assert.equal(out.reason, "document_attached_fallback");
  assert.equal(out.fallbackSkillId, "skill-document-analysis");
});
