import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isContextReferenceRequest,
  extractContextReferenceTarget,
  buildContextReferenceNotFoundMessage,
  detectContextReferenceType,
} from "../src/agent/utils/contextReferenceIntentGuards.js";
import {
  resolveSessionContextReference,
  findSessionMatchForTarget,
} from "../src/agent/utils/sessionContextReferenceResolver.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { resolveClarificationGate } from "../src/agent/policies/clarificationDecisionPolicy.js";
import { evaluateJustIntent } from "../src/agent/policies/justIntentDetectionPolicy.js";
import { buildContextReferenceTelemetryEvent } from "../src/agent/telemetry/contextReferenceTelemetry.js";

const translationHistory = [
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

const kingHistory = [
  {
    role: "user",
    content: "quelles informations aurais tu du jeu kingofavalon",
  },
  {
    role: "assistant",
    content: "King of Avalon est un jeu de stratégie mobile...",
  },
];

const tigreHistory = [
  {
    role: "user",
    content: "quelles informations aurais tu sur le tigre",
  },
  {
    role: "assistant",
    content: "Le tigre est un grand félin...",
  },
];

describe("sessionContextReferenceResolver", () => {
  it("traduction dérivée — phrase précédente en allemand", async () => {
    const q = "la phrase précédente mais en allemand";
    assert.equal(isContextReferenceRequest(q), true);
    const resolution = resolveSessionContextReference(q, translationHistory);
    assert.equal(resolution.resolved, true);
    assert.equal(resolution.referenceType, "previous_translation");
    assert.equal(resolution.previousOutputAsSource, true);
    assert.match(resolution.enrichedQuery, /allemand/i);
    assert.match(resolution.enrichedQuery, /Sigue el progreso/i);

    const hit = await runConversationShortCircuit(resolution.enrichedQuery, {
      history: translationHistory,
    });
    assert.equal(hit?.path, "translation_pipeline");

    const gate = resolveClarificationGate(resolution.enrichedQuery, {
      justIntent: evaluateJustIntent(resolution.enrichedQuery),
      history: translationHistory,
    });
    assert.equal(gate.shouldClarify, false);
  });

  it("tu te rappelles de King of Avalon — match session", () => {
    const q = "tu te rappelles de King of Avalon ?";
    const resolution = resolveSessionContextReference(q, kingHistory);
    assert.equal(resolution.resolved, true);
    assert.equal(resolution.referenceType, "subject_recall");
    assert.match(resolution.enrichedQuery, /kingofavalon/i);
    assert.equal(findSessionMatchForTarget("King of Avalon", kingHistory)?.source, "recent_turns");
  });

  it("tu te rappelles du tigre — match session", () => {
    const q = "tu te rappelles du tigre ?";
    const resolution = resolveSessionContextReference(q, tigreHistory);
    assert.equal(resolution.resolved, true);
    assert.match(resolution.enrichedQuery, /tigre/i);
  });

  it("reprends ce qu'on disait sur le kimono — enrichissement info-seeking", () => {
    const history = [
      { role: "user", content: "infos sur le kimono" },
      { role: "assistant", content: "Le kimono est un vêtement traditionnel japonais." },
    ];
    const q = "reprends ce qu'on disait sur le kimono";
    const resolution = resolveSessionContextReference(q, history);
    assert.equal(resolution.resolved, true);
    assert.match(resolution.enrichedQuery, /kimono/i);
  });

  it("tu te rappelles de Docker — pas de match", () => {
    const q = "tu te rappelles de Docker ?";
    const resolution = resolveSessionContextReference(q, kingHistory);
    assert.equal(resolution.resolved, false);
    assert.match(
      resolution.notFoundMessage,
      /Nous n'avons pas parlé de Docker/i,
    );
    assert.match(buildContextReferenceNotFoundMessage("Docker"), /Redonne-moi le contexte/i);
  });

  it("telemetry [CONTEXT_REF]", () => {
    const event = buildContextReferenceTelemetryEvent(
      "tu te rappelles du tigre ?",
      tigreHistory,
    );
    assert.equal(event.event, "context_reference_resolution");
    assert.equal(event.reference_resolved, true);
    assert.equal(event.reference_type, "subject_recall");
  });

  it("detectContextReferenceType — subject vs translation", () => {
    assert.equal(
      detectContextReferenceType("tu te rappelles de kingofavalon"),
      "subject_recall",
    );
    assert.equal(
      detectContextReferenceType("la phrase précédente mais en allemand"),
      "previous_translation",
    );
    assert.equal(
      extractContextReferenceTarget("tu te rappelles du tigre"),
      "tigre",
    );
  });
});
