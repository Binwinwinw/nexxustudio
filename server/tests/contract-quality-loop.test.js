import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  QUALITY_STOP_REASONS,
  defineContractQualityPolicy,
  runContractQualityLoop,
} from "../src/agent/quality/contractQualityLoop.js";
import { frontPresentationQualityPolicy } from "../src/agent/quality/policies/frontPresentationQualityPolicy.js";
import { FRONT_PRESENTATION_CONTRACT_ID } from "../src/agent/policies/frontendPresentationQualityContract.js";

function makePolicy(overrides = {}) {
  return defineContractQualityPolicy({
    id: "TEST_QUALITY_V1",
    maxRepairs: 1,
    applies: () => true,
    validate: (draft) => {
      const score = String(draft).includes("GOOD") ? 90 : 20;
      return {
        quality: score >= 70 ? "pass" : "fail",
        score,
        passFormat: !String(draft).includes("NOFORMAT"),
        reasons: score >= 70 ? [] : ["too_weak"],
        checks: {},
      };
    },
    buildRepairAddon: (q) => `REPAIR score=${q.score}`,
    ...overrides,
  });
}

describe("contractQualityLoop", () => {
  it("normalise les défauts via defineContractQualityPolicy", () => {
    const policy = makePolicy({ maxRepairs: undefined });
    assert.equal(policy.maxRepairs, 1);
    assert.equal(typeof policy.shouldAcceptRepair, "function");
  });

  it("stopReason=policy_not_applicable si applies=false", async () => {
    const policy = makePolicy({ applies: () => false });
    const out = await runContractQualityLoop(policy, "draft", {
      query: "x",
      generate: async () => "GOOD",
      systemPrompt: "s",
      userPrompt: "u",
    });
    assert.equal(out.stopReason, QUALITY_STOP_REASONS.POLICY_NOT_APPLICABLE);
    assert.equal(out.repairAttempts, 0);
    assert.equal(out.text, "draft");
  });

  it("pass immédiat sans repair", async () => {
    const events = [];
    const out = await runContractQualityLoop(makePolicy(), "GOOD page", {
      query: "x",
      generate: async () => {
        throw new Error("ne doit pas appeler generate");
      },
      systemPrompt: "s",
      userPrompt: "u",
      telemetrySink: (e) => events.push(e),
    });
    assert.equal(out.stopReason, QUALITY_STOP_REASONS.PASS);
    assert.equal(out.repairAttempts, 0);
    assert.equal(out.finalQuality.quality, "pass");
    assert.equal(events[0]?.verdict, "pass");
    assert.equal(events[0]?.policyId, "TEST_QUALITY_V1");
  });

  it("repair accepté améliore le draft", async () => {
    let calls = 0;
    const out = await runContractQualityLoop(makePolicy(), "WEAK", {
      query: "x",
      systemPrompt: "s",
      userPrompt: "u",
      generate: async () => {
        calls += 1;
        return "GOOD repaired";
      },
    });
    assert.equal(calls, 1);
    assert.equal(out.repairAttempts, 1);
    assert.equal(out.text, "GOOD repaired");
    assert.equal(out.initialQuality.score, 20);
    assert.equal(out.finalQuality.score, 90);
    assert.equal(out.stopReason, QUALITY_STOP_REASONS.PASS);
    assert.equal(out.history.length, 2);
    assert.equal(out.history[1].accepted, true);
  });

  it("repair rejeté conserve le draft initial", async () => {
    const policy = makePolicy({
      shouldAcceptRepair: () => false,
      maxRepairs: 1,
    });
    const out = await runContractQualityLoop(policy, "WEAK", {
      query: "x",
      systemPrompt: "s",
      userPrompt: "u",
      generate: async () => "STILL_WEAK",
    });
    assert.equal(out.text, "WEAK");
    assert.equal(out.stopReason, QUALITY_STOP_REASONS.REPAIR_REJECTED);
    assert.equal(out.history[1].accepted, false);
  });

  it("max_repairs_reached quand toujours fail après repair accepté", async () => {
    const policy = makePolicy({
      maxRepairs: 1,
      validate: (draft) => {
        const score = String(draft).includes("BETTER") ? 40 : 10;
        return {
          quality: "fail",
          score,
          passFormat: true,
          reasons: ["still_fail"],
          checks: {},
        };
      },
      shouldAcceptRepair: (next, prev) => next.score > prev.score,
    });
    const out = await runContractQualityLoop(policy, "WEAK", {
      query: "x",
      systemPrompt: "s",
      userPrompt: "u",
      generate: async () => "BETTER but not enough",
    });
    assert.equal(out.finalQuality.score, 40);
    assert.equal(out.stopReason, QUALITY_STOP_REASONS.MAX_REPAIRS_REACHED);
    assert.equal(out.repairExhausted, true);
  });

  it("blocked quand passFormat final false", async () => {
    const out = await runContractQualityLoop(makePolicy({ maxRepairs: 0 }), "NOFORMAT WEAK", {
      query: "x",
      systemPrompt: "s",
      userPrompt: "u",
      generate: async () => "GOOD",
    });
    assert.equal(out.blocked, true);
    assert.equal(out.stopReason, QUALITY_STOP_REASONS.BLOCKED);
  });

  it("frontPresentationQualityPolicy est figé et applicable CPL", () => {
    assert.equal(frontPresentationQualityPolicy.id, FRONT_PRESENTATION_CONTRACT_ID);
    assert.equal(frontPresentationQualityPolicy.maxRepairs, 1);
    assert.equal(
      frontPresentationQualityPolicy.applies({
        query:
          "Crée une page HTML/CSS/JS simple pour présenter La Citadelle, enregistre les fichiers dans projects/demo-citadelle",
      }),
      true,
    );
    assert.equal(frontPresentationQualityPolicy.applies({ query: "bonjour" }), false);
  });
});
