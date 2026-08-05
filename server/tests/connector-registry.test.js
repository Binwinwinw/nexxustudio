import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  CONNECTORS_V1,
  CONNECTOR_RESOLUTION_ORDER_V1,
  CONNECTOR_REASON_CODES,
  EXPERT_TASK_TYPES,
  REQUESTED_CAPABILITIES,
  buildConnectorResolutionContext,
  getConnectorCanonicalMatrixV1,
  mapConnectorToForcedExpertKey,
  resolveConnectorChain,
  resolvePrimaryConnectorId,
  validateConnectorRegistryV1,
  isWebChainBlocked,
  wantsWebResearch,
} from "../src/agent/policies/connectors/index.js";
import { resolveIntentFamilyFromRegistry } from "../src/agent/policies/intent/intentFamilyRegistry.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { resolvePedagogicalOverviewShortCircuit } from "../src/agent/micro/replies/pedagogicalOverviewComposer.js";

/**
 * @param {string} query
 * @param {object} [overrides]
 */
async function ctxFromQuery(query, overrides = {}) {
  const shortCircuit =
    overrides.shortCircuit !== undefined
      ? overrides.shortCircuit
      : await runConversationShortCircuit(query, {
          getDeterministicSocialResponse: () => null,
          history: [],
        });

  return buildConnectorResolutionContext({
    query,
    shortCircuit,
    ...overrides,
  });
}

describe("connectorRegistry — cohérence v1", () => {
  it("registre valide en interne", () => {
    const report = validateConnectorRegistryV1();
    assert.equal(report.ok, true, report.errors.join("\n"));
  });

  it("ordre de résolution aligné sur les connecteurs", () => {
    const sorted = [...CONNECTORS_V1]
      .sort((a, b) => a.resolveOrder - b.resolveOrder)
      .map((c) => c.id);
    assert.deepEqual(sorted, [...CONNECTOR_RESOLUTION_ORDER_V1]);
  });

  it("chaque cas canonique avec contextOverrides résout primary + chain", () => {
    for (const row of getConnectorCanonicalMatrixV1()) {
      if (!row.contextOverrides && row.label !== "explique Redis") continue;

      const ctx = buildConnectorResolutionContext({
        query: row.query,
        ...(row.contextOverrides || {}),
      });
      const plan = resolveConnectorChain(ctx);
      assert.equal(
        plan.primary.id,
        row.expectedPrimaryConnectorId,
        `primary pour « ${row.label} »`,
      );
      assert.deepEqual(
        plan.chain.map((c) => c.id),
        row.expectedChain || [],
        `chain pour « ${row.label} »`,
      );
      assert.ok(plan.reason.code, `reason.code pour « ${row.label} »`);
      assert.ok(plan.reason.message, `reason.message pour « ${row.label} »`);
    }
  });
});

describe("connectorRegistry — matrice canonique v1", () => {
  for (const row of getConnectorCanonicalMatrixV1()) {
    it(`${row.label} → ${row.expectedPrimaryConnectorId}`, async () => {
      let ctx;

      if (row.label === "fractions 6e KB") {
        const pedHit = resolvePedagogicalOverviewShortCircuit(row.query);
        ctx = buildConnectorResolutionContext({
          query: row.query,
          shortCircuit: pedHit,
          intentFamily: resolveIntentFamilyFromRegistry(row.query),
        });
      } else if (row.contextOverrides) {
        ctx = buildConnectorResolutionContext({
          query: row.query,
          ...row.contextOverrides,
        });
      } else {
        ctx = await ctxFromQuery(row.query);
      }

      const plan = resolveConnectorChain(ctx);

      assert.equal(
        plan.primary.id,
        row.expectedPrimaryConnectorId,
        `query=${row.query.slice(0, 80)}`,
      );
      assert.deepEqual(
        plan.chain.map((c) => c.id),
        row.expectedChain || [],
      );

      if (row.intentFamilyId) {
        assert.equal(
          ctx.intentFamily?.id,
          row.intentFamilyId,
          `famille intent pour « ${row.label} »`,
        );
      }
    });
  }
});

describe("connectorRegistry — garde-fous et reason codes", () => {
  it("attachment + expert_task bloque la chaîne web sans demande explicite", () => {
    const ctx = buildConnectorResolutionContext({
      query: "analyse ce fichier",
      shortCircuit: null,
      intentFamily: null,
      hasAttachments: true,
      expertTaskType: EXPERT_TASK_TYPES.EXPERT_TASK,
      requestedCapability: REQUESTED_CAPABILITIES.CODE_ANALYSIS,
      enrichment: { preferWebResearch: true },
    });

    assert.equal(isWebChainBlocked(ctx), true);
    assert.equal(wantsWebResearch(ctx), true);

    const plan = resolveConnectorChain(ctx);
    assert.equal(plan.primary.id, "full_pipeline_orchestrator");
    assert.deepEqual(plan.chain, []);
    assert.equal(
      plan.reason.code,
      CONNECTOR_REASON_CODES.WEB_CHAIN_SUPPRESSED,
    );
  });

  it("admin_procedure → reason code machine-readable dédié", async () => {
    const ctx = await ctxFromQuery("comment déclarer mes impôts en ligne");
    const plan = resolveConnectorChain(ctx);

    assert.equal(plan.primary.id, "full_pipeline_orchestrator");
    assert.deepEqual(plan.chain.map((c) => c.id), ["expert_web_search"]);
    assert.equal(
      plan.reason.code,
      CONNECTOR_REASON_CODES.ADMIN_PROCEDURE_REQUIRES_WEB,
    );
    assert.match(plan.reason.message, /administrative/i);
  });

  it("mapConnectorToForcedExpertKey — transition legacy", () => {
    assert.equal(
      mapConnectorToForcedExpertKey("expert_web_search"),
      "expert_web_search",
    );
    assert.equal(mapConnectorToForcedExpertKey("local_generative"), null);
  });

  it("resolvePrimaryConnectorId — convenience", async () => {
    const q =
      "je veux créer des fiches de connaissances afin maitriser le jsx et ses regles";
    const id = resolvePrimaryConnectorId(await ctxFromQuery(q));
    assert.equal(id, "local_generative");
  });
});
