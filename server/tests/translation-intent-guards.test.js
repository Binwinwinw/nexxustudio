import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isTranslationShell,
  isTranslationRequest,
  isTranslationRequestReady,
  isTranslationDerivedRequest,
  isTranslationPipelineReady,
  extractTargetLanguage,
  extractTargetLanguages,
  isMultiTargetTranslationRequest,
  buildTranslationEffectiveQuery,
  extractTranslationPayload,
  requiresTranslationClarification,
  buildTranslationClarifyReply,
  suppressesSocialForTranslation,
} from "../src/agent/utils/translationIntentGuards.js";
import { evaluateJustIntent } from "../src/agent/policies/justIntentDetectionPolicy.js";
import { analyzeRequestIntentFrame } from "../src/agent/policies/requestIntentFrame.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { buildTranslationOrchestrationEvent } from "../src/agent/telemetry/translationOrchestrationTelemetry.js";
import { resolveClarificationGate } from "../src/agent/policies/clarificationDecisionPolicy.js";

describe("translationIntentGuards", () => {
  it("traduction prête — texte + langue cible", () => {
    const q = "traduis en anglais : Le contrat expire le 31 décembre.";
    assert.equal(isTranslationRequestReady(q), true);
    assert.equal(extractTargetLanguage(q), "en");
    assert.match(extractTranslationPayload(q), /contrat expire/i);
  });

  it("bug social — Bonjour dans le texte traduit ne route pas social", async () => {
    const q = "traduis ce texte en anglais : Bonjour, comment allez-vous ?";
    const frame = analyzeRequestIntentFrame(q);
    assert.equal(frame.task.kind, "translate");
    assert.equal(frame.conversation.socialOnly, false);
    assert.equal(isTranslationRequestReady(q), true);

    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "translation_pipeline");
    assert.notEqual(hit?.path, "social_deterministic");
  });

  it("clarification — shell sans texte ni langue", () => {
    const q = "traduction FR vers EN ton professionnel";
    assert.equal(isTranslationShell(q), true);
    assert.equal(isTranslationRequestReady(q), false);
    assert.equal(requiresTranslationClarification(q), true);
    assert.match(buildTranslationClarifyReply(q), /texte à traduire/i);
  });

  it("justIntent — preempt translation_request", () => {
    const q = "traduis en anglais : Notre produit réduit les coûts de 30%.";
    const ji = evaluateJustIntent(q);
    assert.equal(ji.action, "translate");
    assert.ok(ji.signals.includes("preempt:translation_request"));
  });

  it("suppressesSocialForTranslation", () => {
    const q = "traduis ce texte en anglais : Bonjour, comment allez-vous ?";
    assert.equal(suppressesSocialForTranslation(q), true);
  });

  it("telemetry [TRANSLATION_ORCH]", () => {
    const q = "traduis en espagnol : Gracias por su compra.";
    const event = buildTranslationOrchestrationEvent(q, {
      pipelinePath: "translation_pipeline",
    });
    assert.equal(event.event, "translation_orchestration");
    assert.equal(event.target_language, "es");
    assert.equal(event.text_present, true);
    assert.equal(event.pipeline_path, "translation_pipeline");
    assert.equal(event.prefer_web_research, false);
  });

  it("clarify gate — traduction prête sans clarification", () => {
    const q = "traduis en anglais : Bonjour, comment allez-vous ?";
    const ji = evaluateJustIntent(q);
    const gate = resolveClarificationGate(q, { justIntent: ji });
    assert.equal(gate.shouldClarify, false);
  });

  it("suite — la phrase précédente en allemand avec historique", async () => {
    const history = [
      {
        role: "user",
        content:
          "je veux traduire la phrase suivante en espagnol : Suivez la progression de votre enfant en toute sérénité",
      },
      {
        role: "assistant",
        content: "Sigue el progreso de tu hijo/a con toda tranquilidad",
      },
    ];
    const q = "la phrase précédente mais en allemand";
    assert.equal(isTranslationDerivedRequest(q), true);
    assert.equal(isTranslationPipelineReady(q, history), true);

    const frame = analyzeRequestIntentFrame(q);
    assert.equal(frame.task.kind, "translate");
    assert.equal(frame.conversation.socialOnly, false);

    const hit = await runConversationShortCircuit(q, { history });
    assert.equal(hit?.path, "translation_pipeline");
    assert.equal(hit?.translationDerived, true);
    assert.match(hit?.translationEffectiveQuery, /allemand/i);
    assert.match(hit?.translationEffectiveQuery, /Sigue el progreso/i);

    const gate = resolveClarificationGate(q, {
      justIntent: evaluateJustIntent(q),
      history,
    });
    assert.equal(gate.shouldClarify, false);
  });

  it("suite sans historique — clarification traduction dérivée", async () => {
    const q = "la phrase précédente mais en allemand";
    const hit = await runConversationShortCircuit(q, { history: [] });
    assert.equal(hit?.path, "translation_clarify");
  });

  it("multi-langues — 4 langues + requête enrichie", () => {
    const q =
      "je veux traduire la phrase suivante en espagnol, en allemand, en arabe et en chinois : Suivez la progression de votre enfant en toute sérénité merci par avance";
    assert.deepEqual(extractTargetLanguages(q), ["es", "de", "ar", "zh"]);
    assert.equal(isTranslationRequestReady(q), true);
    assert.equal(isMultiTargetTranslationRequest(q), true);
    assert.match(buildTranslationEffectiveQuery(q), /espagnol, allemand, arabe/i);
    assert.match(buildTranslationEffectiveQuery(q), /chinois/i);
    assert.match(
      buildTranslationEffectiveQuery(q),
      /Suivez la progression de votre enfant/i,
    );
  });

  it("multi-langues + merci par avance — pas composite social", () => {
    const q =
      "je veux traduire la phrase suivante en espagnol, en allemand, en arabe et en chinois : Suivez la progression de votre enfant en toute sérénité merci par avance";
    const frame = analyzeRequestIntentFrame(q);
    assert.equal(frame.composite, false);
    assert.equal(frame.translation?.multiTarget, true);
    assert.equal(frame.translation?.mode, "multi_target_batch");
    assert.equal(frame.translation?.executionMode, "batch");
    assert.equal(frame.translation?.requestUnits?.length, 4);
    assert.deepEqual(frame.translation?.targetLanguages, ["es", "de", "ar", "zh"]);
  });

  it("multi-langues — short-circuit translation_multi_target", async () => {
    const q =
      "je veux traduire la phrase suivante en espagnol, en allemand, en arabe et en chinois : Suivez la progression de votre enfant en toute sérénité merci par avance";
    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "translation_multi_target");
    assert.equal(hit?.translationPlan?.executionMode, "batch");
  });
});
