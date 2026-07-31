import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  resolveActionDecision,
  NEXXUS_PROFILES,
  ORCHESTRATOR_MODES,
  CAPABILITY_TRIGGER_EXAMPLES,
  shouldUseChatLightComposerPath,
  buildLightChatOrchestratorPacket,
} from "../src/agent/policies/orchestration/index.js";
import { buildRequestWorkup, understandQuery } from "../src/agent/policies/conversationQueryUnderstanding.js";
import { applyWorkupRetrievalGate } from "../src/agent/policies/conversationQueryUnderstanding.js";

const RTX_QUERY =
  "je veux changer ma rtx 4060, recherche sur la toile, 3 modèles qualité/prix";

describe("chatAgentProfile — table de déclenchement", () => {
  it("bonjour — chat direct, pas d'outils", () => {
    const u = understandQuery("bonjour ornith");
    const ia = { intentContractId: null, primaryDomain: u.primaryDomain, responseStrategy: u.responseStrategy, constraints: {} };
    const er = { level: "none", explicitWebRequested: false, freshnessSensitive: false, comparative: false };
    const action = resolveActionDecision("bonjour ornith", u, ia, er);
    assert.equal(action.profile, NEXXUS_PROFILES.CHAT);
    assert.equal(action.capabilities.web, false);
    assert.equal(action.capabilities.code, false);
    assert.equal(action.orchestratorMode, ORCHESTRATOR_MODES.DIRECT);
  });

  it("ray tracing — chat léger, pas de web", () => {
    const u = understandQuery("explique le ray tracing");
    const cycle = buildRequestWorkup("explique le ray tracing", u);
    assert.equal(cycle.action_decision.profile, NEXXUS_PROFILES.CHAT);
    assert.equal(cycle.action_decision.capabilities.web, false);
    assert.equal(cycle.retrieval_decision.needsExternalInfo, false);
    const gate = applyWorkupRetrievalGate(cycle, "expert_web_search", null);
    assert.equal(gate.source, "chat_profile_skip_web");
  });

  it("script Python — capacité code", () => {
    const q = "fais-moi un script Python pour renommer 500 fichiers";
    const u = understandQuery(q);
    const cycle = buildRequestWorkup(q, u);
    assert.equal(cycle.action_decision.capabilities.code, true);
    assert.equal(cycle.action_decision.capabilities.expertReasoning, true);
    assert.equal(cycle.action_decision.orchestratorMode, ORCHESTRATOR_MODES.FULL);
  });

  it("fichier Excel — capacité file", () => {
    const q = "crée-moi un fichier Excel pour suivre mes dépenses";
    const u = understandQuery(q);
    const cycle = buildRequestWorkup(q, u);
    assert.equal(cycle.action_decision.capabilities.file, true);
  });

  it("RTX + web — profil plateforme, web activé", () => {
    const u = understandQuery(RTX_QUERY);
    const cycle = buildRequestWorkup(RTX_QUERY, u, {
      intentContractId: "GUIDED_PRODUCT_RECOMMENDATION",
    });
    assert.equal(cycle.action_decision.capabilities.web, true);
    assert.ok(cycle.action_decision.webQuery);
    const gate = applyWorkupRetrievalGate(cycle, null, null);
    assert.equal(gate.source, "action_decision");
    assert.equal(gate.forcedExpertKey, "expert_web_search");
  });

  it("shouldUseChatLightComposerPath — ray tracing eligible", () => {
    const u = understandQuery("explique le ray tracing");
    const cycle = buildRequestWorkup("explique le ray tracing", u);
    assert.equal(
      shouldUseChatLightComposerPath(cycle, {
        forgeProduction: false,
        attachments: [],
        deferToFullPipeline: false,
        forcedExpertKey: null,
        wantsAnalysis: false,
      }),
      true,
    );
  });

  it("shouldUseChatLightComposerPath — RTX web non eligible", () => {
    const u = understandQuery(
      "rtx 4060 recherche web 3 modèles qualité prix",
    );
    const cycle = buildRequestWorkup(
      "rtx 4060 recherche web 3 modèles qualité prix",
      u,
      { intentContractId: "GUIDED_PRODUCT_RECOMMENDATION" },
    );
    assert.equal(
      shouldUseChatLightComposerPath(cycle, {
        attachments: [],
        deferToFullPipeline: false,
      }),
      false,
    );
  });

  it("buildLightChatOrchestratorPacket — packet minimal", () => {
    const u = understandQuery("explique le ray tracing");
    const cycle = buildRequestWorkup("explique le ray tracing", u);
    const packet = buildLightChatOrchestratorPacket(
      "explique le ray tracing",
      cycle,
      u,
    );
    assert.equal(packet.mode, "CHAT_LIGHT");
    assert.equal(packet.meta.chat_light_path, true);
    assert.equal(packet.meta.resolution_path, "chat_light_composer");
    assert.deepEqual(packet.expert_outputs, []);
  });
});
