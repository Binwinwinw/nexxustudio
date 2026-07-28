import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DELIVERY_CONTRACT_V1,
  DELIVERY_MODES,
  ensureTerminalDeliveryText,
} from "../src/agent/policies/deliveryContract.js";
import AgentPipeline from "../src/agent/agentPipeline.js";
import turnTelemetry from "../src/agent/telemetry/turnTelemetry.js";
import { createPipelineTelemetryContext } from "../src/agent/telemetry/telemetryObservabilityBridge.js";

describe("deliveryContract — DELIVERY_CONTRACT_V1", () => {
  it("expose le contrat et les modes", () => {
    assert.equal(DELIVERY_CONTRACT_V1, "DELIVERY_CONTRACT_V1");
    assert.equal(DELIVERY_MODES.BUFFERED_FINAL, "buffered_final");
  });

  it("texte non vide → pas de fallback", () => {
    const out = ensureTerminalDeliveryText({
      text: "Réponse Italie.",
      query: "que sais-tu de l'Italie ?",
    });
    assert.equal(out.fallbackApplied, false);
    assert.match(out.text, /Italie/);
  });

  it("texte vide + familiarité → fiche locale", () => {
    const q = "que sais tu du pays appelé Italie ?";
    const out = ensureTerminalDeliveryText({
      text: "",
      query: q,
      reason: "empty_pipeline_output",
    });
    assert.equal(out.fallbackApplied, true);
    assert.match(out.text, /Italie/i);
    assert.equal(out.fallbackReason, "empty_pipeline_output");
  });

  it("texte vide + travail substantiel → recovery, pas greeting", () => {
    const q = "génère un module React complet avec tests et documentation";
    const out = ensureTerminalDeliveryText({
      text: "",
      query: q,
      reason: "empty_simple_fast",
    });
    assert.equal(out.fallbackApplied, true);
    assert.match(out.text, /Je n'ai pas pu finaliser/);
    assert.doesNotMatch(out.text, /Tout est prêt/);
  });
});

describe("_finalizePipelineTurn — émission buffered + fallback", () => {
  it("émet via onContent et applique fallback si texte vide", () => {
    const pipeline = new AgentPipeline({
      getDeterministicSocialResponse: () => "ok",
    });
    pipeline._turnDeliveryCtx = {
      getQuery: () => "que sais tu du pays appelé Italie ?",
      getHistory: () => [],
    };

    turnTelemetry.startTrace({
      sessionId: "test-session",
      query: "que sais tu du pays appelé Italie ?",
    });
    const pipelineTelemetryCtx = createPipelineTelemetryContext(
      "que sais tu du pays appelé Italie ?",
    );

    const chunks = [];
    const finalText = pipeline._finalizePipelineTurn({
      text: "",
      pipelinePath: "simple_fast",
      status: true,
      deliveryMode: DELIVERY_MODES.BUFFERED_FINAL,
      fallbackReason: "empty_simple_fast",
      pipelineTelemetryCtx,
      turnTelemetry,
      onContent: (token) => chunks.push(token),
      onStep: () => {},
    });

    assert.ok(chunks.length >= 1);
    assert.match(finalText, /Italie/i);
    assert.match(chunks.join(""), /Italie/i);
    const snap = turnTelemetry.snapshot();
    assert.equal(snap.metrics?.legacy?.delivery_fallback_applied, true);
    assert.equal(snap.metrics?.legacy?.delivery_mode, "buffered");
    assert.equal(snap.metrics?.legacy?.delivery_contract, DELIVERY_CONTRACT_V1);
  });

  it("texte terminal non vide → pas de double fallback", () => {
    const pipeline = new AgentPipeline({
      getDeterministicSocialResponse: () => "ok",
    });
    pipeline._turnDeliveryCtx = {
      getQuery: () => "salut",
      getHistory: () => [],
    };

    turnTelemetry.startTrace({
      sessionId: "test-session-2",
      query: "salut",
    });
    const pipelineTelemetryCtx = createPipelineTelemetryContext("salut");

    const chunks = [];
    const finalText = pipeline._finalizePipelineTurn({
      text: "Salut !",
      pipelinePath: "instant",
      status: true,
      deliveryMode: DELIVERY_MODES.BUFFERED_FINAL,
      pipelineTelemetryCtx,
      turnTelemetry,
      onContent: (token) => chunks.push(token),
      onStep: () => {},
    });

    assert.equal(finalText, "Salut !");
    assert.deepEqual(chunks, ["Salut !"]);
    assert.notEqual(
      turnTelemetry.snapshot().metrics?.legacy?.delivery_fallback_applied,
      true,
    );
  });

  it("texte terminal long → émission chunked (buffered lissé)", () => {
    const pipeline = new AgentPipeline({
      getDeterministicSocialResponse: () => "ok",
    });
    pipeline._turnDeliveryCtx = {
      getQuery: () => "test",
      getHistory: () => [],
    };

    turnTelemetry.startTrace({
      sessionId: "test-session-3",
      query: "test",
    });
    const pipelineTelemetryCtx = createPipelineTelemetryContext("test");

    const longText =
      "Voici une réponse pré-enregistrée qui doit arriver progressivement dans l'interface utilisateur de La Citadelle.";
    const chunks = [];
    pipeline._finalizePipelineTurn({
      text: longText,
      pipelinePath: "simple_fast",
      status: true,
      deliveryMode: DELIVERY_MODES.BUFFERED_FINAL,
      pipelineTelemetryCtx,
      turnTelemetry,
      onContent: (token) => chunks.push(token),
      onStep: () => {},
    });

    assert.ok(chunks.length > 1);
    assert.equal(chunks.join(""), longText);
  });
});
