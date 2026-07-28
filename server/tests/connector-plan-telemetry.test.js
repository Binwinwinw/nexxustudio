import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildPipelineConnectorContext,
  connectorPlanMatchesLegacy,
  connectorPlanImpliesWeb,
  deriveLegacyForcedExpertKey,
  observeConnectorPlanShadow,
  resolveExpertTaskTypeFromPipeline,
} from "../src/agent/policies/connectorPlanTelemetry.js";
import { resolveConnectorChain } from "../src/agent/policies/connectorRegistry.js";
import { EXPERT_TASK_TYPES, REQUESTED_CAPABILITIES } from "../src/agent/policies/connectorRegistry.js";
import turnTelemetry from "../src/agent/telemetry/turnTelemetry.js";

describe("connectorPlanTelemetry — Phase B shadow", () => {
  it("deriveLegacyForcedExpertKey — defer full + enrichment", () => {
    const key = deriveLegacyForcedExpertKey({
      query: "comment déclarer mes impôts en ligne",
      shortCircuit: { preferWebResearch: true },
      deferToFullPipelineActive: true,
      enrichment: { preferWebResearch: true },
    });
    assert.equal(key, "expert_web_search");
  });

  it("deriveLegacyForcedExpertKey — compare sans web legacy si enrichment seul", () => {
    const key = deriveLegacyForcedExpertKey({
      query: "Redis vs Memcached que choisir pour un cache session",
      shortCircuit: { deferToFullPipeline: true },
      deferToFullPipelineActive: true,
      enrichment: { preferWebResearch: true },
    });
    assert.equal(key, "expert_web_search");
  });

  it("connectorPlanMatchesLegacy — registre compare sans web vs legacy avec web", async () => {
    const ctx = buildPipelineConnectorContext({
      query: "Redis vs Memcached que choisir pour un cache session",
      shortCircuit: {
        path: "compare_choose",
        deferToFullPipeline: true,
        deferToLlm: true,
      },
    });
    const plan = resolveConnectorChain(ctx);
    const legacyKey = deriveLegacyForcedExpertKey({
      query: ctx.query,
      shortCircuit: ctx.shortCircuit,
      deferToFullPipelineActive: true,
      enrichment: ctx.enrichment,
    });

    assert.equal(connectorPlanImpliesWeb(plan), false);
    assert.equal(legacyKey, "expert_web_search");
    assert.equal(connectorPlanMatchesLegacy(plan, legacyKey), false);
  });

  it("observeConnectorPlanShadow — enregistre connector.plan.shadow", () => {
    turnTelemetry.beginTurn("test shadow", { traceId: "trace-shadow-1" });

    const { observation } = observeConnectorPlanShadow({
      hook: "unit_test",
      query: "explique Redis",
      turnTelemetry,
      shortCircuit: { path: "technical_overview", deferToLlm: true },
    });

    assert.equal(observation.matchesLegacy, true);

    const shadowEvents = turnTelemetry.events.filter(
      (e) => e.event === "connector.plan.shadow",
    );
    assert.ok(shadowEvents.length >= 1);
    const last = shadowEvents[shadowEvents.length - 1];
    assert.equal(last.hook, "unit_test");
    assert.equal(last.primary, "local_generative");
    assert.equal(last.reason_code, "local_generative_short_circuit");
    assert.ok(Object.prototype.hasOwnProperty.call(last, "connector_plan_matches_legacy"));
  });

  it("resolveExpertTaskTypeFromPipeline — attachment code", () => {
    assert.equal(
      resolveExpertTaskTypeFromPipeline({
        intentTriage: { top_intent: "code_generation" },
        wantsAnalysis: false,
        hasAttachments: true,
      }),
      EXPERT_TASK_TYPES.EXPERT_TASK,
    );
    assert.equal(
      buildPipelineConnectorContext({
        query: "analyse ce fichier",
        hasAttachments: true,
        expertTaskType: EXPERT_TASK_TYPES.EXPERT_TASK,
        requestedCapability: REQUESTED_CAPABILITIES.CODE_ANALYSIS,
      }).expertTaskType,
      EXPERT_TASK_TYPES.EXPERT_TASK,
    );
  });
});
