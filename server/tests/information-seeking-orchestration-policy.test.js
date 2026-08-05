import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  resolveInformationSeekingOrchestration,
  resolveInformationSeekingEnrichmentPolicy,
  classifyInformationSeekingTargetType,
  assessInformationSeekingLocalCoverage,
  INFORMATION_SEEKING_ACTIONS,
  INFORMATION_SEEKING_SHORT_CIRCUIT_STATUS,
} from "../src/agent/policies/routing/informationSeekingOrchestrationPolicy.js";
import { buildInformationSeekingOrchestrationEvent } from "../src/agent/telemetry/informationSeekingOrchestrationTelemetry.js";
import { resolveKnowledgeEnrichmentPolicy } from "../src/agent/policies/routing/knowledgeEnrichmentPolicy.js";

describe("informationSeekingOrchestrationPolicy", () => {
  it("jeu sans fiche locale → full_pipeline + web", () => {
    const q = "quelles informations aurais tu du jeu kingofavalon";
    const orch = resolveInformationSeekingOrchestration(q, { phase: "route" });
    assert.equal(orch.applicable, true);
    assert.equal(orch.targetType, "product_app_game");
    assert.equal(orch.localAnswerFound, false);
    assert.equal(orch.recommendedAction, INFORMATION_SEEKING_ACTIONS.FULL_PIPELINE);
    assert.equal(orch.preferWebResearch, true);
    assert.match(orch.webQuery, /kingofavalon/i);
  });

  it("animal → general_entity + overview web query", () => {
    const q = "quelles informations aurais tu sur le tigre";
    const orch = resolveInformationSeekingOrchestration(q, { phase: "route" });
    assert.equal(orch.targetType, "general_entity");
    assert.match(orch.webQuery, /tigre overview/i);
  });

  it("empty_short_circuit_llm → web_fallback", () => {
    const q = "infos sur le kimono";
    const orch = resolveInformationSeekingOrchestration(q, {
      phase: "post_simple_fast",
      fallbackReason: "empty_short_circuit_llm",
    });
    assert.equal(
      orch.shortCircuitStatus,
      INFORMATION_SEEKING_SHORT_CIRCUIT_STATUS.EMPTY,
    );
    assert.equal(orch.recommendedAction, INFORMATION_SEEKING_ACTIONS.WEB_FALLBACK);
    assert.equal(orch.webFallbackTriggered, true);
  });

  it("classifyInformationSeekingTargetType — app vs entité", () => {
    assert.equal(
      classifyInformationSeekingTargetType("infos sur l app trello"),
      "product_app_game",
    );
    assert.equal(
      classifyInformationSeekingTargetType("infos sur le tigre"),
      "general_entity",
    );
  });

  it("resolveKnowledgeEnrichmentPolicy — info-seeking active web", () => {
    const enrich = resolveKnowledgeEnrichmentPolicy(
      "quelles informations aurais tu du jeu stellaris",
      { orchestrationCtx: { phase: "route" } },
    );
    assert.equal(enrich.domain, "information_seeking");
    assert.equal(enrich.preferWebResearch, true);
    assert.match(enrich.webQuery, /stellaris/i);
    assert.ok(enrich.informationSeeking);
  });

  it("telemetry event — grille observable", () => {
    const q = "infos sur le kimono";
    const orch = resolveInformationSeekingOrchestration(q, { phase: "route" });
    const event = buildInformationSeekingOrchestrationEvent(q, orch, {
      pipelinePath: "information_seeking_full_pipeline",
    });
    assert.equal(event.event, "info_seeking_orchestration");
    assert.equal(event.shell_recognized, true);
    assert.equal(event.target, "kimono");
    assert.equal(event.pipeline_path, "information_seeking_full_pipeline");
    assert.equal(typeof event.web_query, "string");
  });

  it("hors shell — not applicable", () => {
    const orch = resolveInformationSeekingOrchestration(
      "quelles sont les capitales des pays scandinaves",
    );
    assert.equal(orch.applicable, false);
    const enrich = resolveInformationSeekingEnrichmentPolicy(
      "quelles sont les capitales des pays scandinaves",
    );
    assert.equal(enrich.applicable, false);
  });

  it("assessInformationSeekingLocalCoverage — low sans fiche", () => {
    const cov = assessInformationSeekingLocalCoverage("infos sur le axolotl");
    assert.equal(cov.found, false);
    assert.equal(cov.confidence, "low");
  });
});
