import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  applyConnectorPhaseCWebKey,
  isConnectorPhaseCWebAuthorityFamily,
  CONNECTOR_PHASE_C_WEB_AUTHORITY_FAMILIES_V1,
} from "../src/agent/policies/connectors/index.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";

describe("connectorPhaseC — autorité web v1", () => {
  it("familles autorité déclarées", () => {
    assert.ok(
      isConnectorPhaseCWebAuthorityFamily("admin_procedure"),
    );
    assert.ok(
      isConnectorPhaseCWebAuthorityFamily("compare_choose"),
    );
    assert.ok(
      isConnectorPhaseCWebAuthorityFamily("technical_learning_path"),
    );
    assert.equal(isConnectorPhaseCWebAuthorityFamily("technical_overview"), false);
    assert.equal(CONNECTOR_PHASE_C_WEB_AUTHORITY_FAMILIES_V1.size, 4);
  });

  it("admin_procedure — registre conserve expert_web_search", async () => {
    const q = "comment déclarer mes impôts en ligne";
    const shortCircuit = await runConversationShortCircuit(q, {
      getDeterministicSocialResponse: () => null,
      history: [],
    });
    const result = applyConnectorPhaseCWebKey({
      query: q,
      shortCircuit,
      legacyKey: "expert_web_search",
      deferToFullPipelineActive: true,
    });
    assert.equal(result.applied, true);
    assert.equal(result.key, "expert_web_search");
    assert.equal(result.source, "connector_registry");
  });

  it("compare_choose — registre supprime le web legacy", async () => {
    const q = "Redis vs Memcached que choisir pour un cache session";
    const shortCircuit = await runConversationShortCircuit(q, {
      getDeterministicSocialResponse: () => null,
      history: [],
    });
    const result = applyConnectorPhaseCWebKey({
      query: q,
      shortCircuit,
      legacyKey: "expert_web_search",
      deferToFullPipelineActive: true,
    });
    assert.equal(result.applied, true);
    assert.equal(result.key, null);
    assert.equal(result.reasonCode, "family_defer_full_pipeline");
  });

  it("technical_learning_path — hors autorité orchestrateur si pas dans set... learning IS in set", async () => {
    const q =
      "je veux créer des fiches de connaissances afin maitriser le jsx et ses regles";
    const shortCircuit = await runConversationShortCircuit(q, {
      getDeterministicSocialResponse: () => null,
      history: [],
    });
    const result = applyConnectorPhaseCWebKey({
      query: q,
      shortCircuit,
      legacyKey: null,
    });
    assert.equal(result.applied, true);
    assert.equal(result.key, null);
    assert.equal(result.planPrimary, "local_generative");
  });

  it("technical_overview — legacy inchangé (hors Phase C)", async () => {
    const q = "explique Redis";
    const shortCircuit = await runConversationShortCircuit(q, {
      getDeterministicSocialResponse: () => null,
      history: [],
    });
    const result = applyConnectorPhaseCWebKey({
      query: q,
      shortCircuit,
      legacyKey: null,
    });
    assert.equal(result.applied, false);
    assert.equal(result.source, "legacy");
  });
});
