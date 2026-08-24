import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  resolveWarmupExperimentPlan,
  resolveDeclaredExperimentPlan,
  resolveServedExperimentId,
  getWarmupExperimentId,
  isWarmupShadowEnabled,
  getWarmupCanaryPct,
  isStickyCanarySession,
  warmupCanaryBucket,
  runWithWarmupSession,
  evaluateRolloutDecision,
  WARMUP_MATRIX_BASELINE_PATH,
  WARMUP_MATRIX_CANDIDATE_PATH,
  WARMUP_EXPERIMENT_GATES,
  WARMUP_SHADOW_CORPUS,
  WARMUP_EXPERIMENT_ROLLBACK,
  WARMUP_CANARY_PCTS,
} from "../src/config/warmupExperimentPlan.js";
import {
  getActiveTier1ChatModel,
  getReasonerModel,
  getTier2Model,
  isTier2Enabled,
  shouldWarmTier2AtBoot,
  isTier2Model,
  listTier3ExpertModels,
} from "../src/config/models.js";
import {
  AGENT_ROLES,
  getFallbackModel,
  getEscalationModel,
  shouldUseDeferredReasoner,
  resolveLightJsonModel,
} from "../src/agent/policies/core/agentRolePolicy.js";

describe("warmupExperimentPlan — point unique", () => {
  it("baseline par défaut (pas de flag)", () => {
    const env = {};
    assert.equal(getWarmupExperimentId(env), "baseline");
    const plan = resolveWarmupExperimentPlan(env);
    assert.equal(plan.experimentId, "baseline");
    assert.equal(plan.experiment, "off");
    assert.equal(plan.ownership.owner, "Binwinwinw");
    assert.equal(plan.ownership.cleanupBy, "2026-08-24");
    assert.equal(plan.matrixPath, WARMUP_MATRIX_BASELINE_PATH);
    assert.equal(plan.tier1Chat, "qwen3.5:2b");
    assert.equal(plan.tier2.enabled, true);
    assert.equal(plan.tier2.model, "granite4.1:8b");
    assert.equal(plan.tier2.warmAtBoot, false);
    assert.equal(plan.tier2.loadStrategy, "deferred");
  });

  it("off / baseline explicite → baseline", () => {
    assert.equal(getWarmupExperimentId({ OLLAMA_WARMUP_EXPERIMENT: "off" }), "baseline");
    assert.equal(
      getWarmupExperimentId({ OLLAMA_WARMUP_EXPERIMENT: "baseline" }),
      "baseline",
    );
    assert.equal(
      resolveWarmupExperimentPlan({ OLLAMA_WARMUP_EXPERIMENT: "off" }).experiment,
      "off",
    );
  });

  it("candidate → qwen3.5:2b + granite T2 différé", () => {
    const plan = resolveWarmupExperimentPlan({
      OLLAMA_WARMUP_EXPERIMENT: "candidate",
    });
    assert.equal(plan.experimentId, "candidate");
    assert.equal(plan.experiment, "candidate");
    assert.ok(plan.ownership.owner);
    assert.ok(plan.ownership.cleanupBy);
    assert.equal(plan.matrixPath, WARMUP_MATRIX_CANDIDATE_PATH);
    assert.equal(plan.tier1Chat, "qwen3.5:2b");
    assert.equal(plan.tier2.enabled, true);
    assert.equal(plan.tier2.model, "granite4.1:8b");
    assert.equal(plan.tier2.warmAtBoot, false);
    assert.equal(plan.tier2.loadStrategy, "deferred");
  });
});

describe("models.js — getters via resolver uniquement", () => {
  const prev = process.env.OLLAMA_WARMUP_EXPERIMENT;

  after(() => {
    if (prev === undefined) delete process.env.OLLAMA_WARMUP_EXPERIMENT;
    else process.env.OLLAMA_WARMUP_EXPERIMENT = prev;
  });

  it("sans flag — baseline qwen / T2 granite deferred", () => {
    delete process.env.OLLAMA_WARMUP_EXPERIMENT;
    assert.equal(getActiveTier1ChatModel("reactive"), "qwen3.5:2b");
    assert.equal(getActiveTier1ChatModel("fast"), "qwen3.5:2b");
    assert.equal(getReasonerModel("reactive"), "granite4.1:8b");
    assert.equal(isTier2Enabled(), true);
    assert.equal(getTier2Model(), "granite4.1:8b");
    assert.equal(shouldWarmTier2AtBoot(), false);
    assert.equal(isTier2Model("granite4.1:8b"), true);
  });

  it("flag candidate — T1 qwen / T2 granite / warmAtBoot false", () => {
    process.env.OLLAMA_WARMUP_EXPERIMENT = "candidate";
    assert.equal(getActiveTier1ChatModel("reactive"), "qwen3.5:2b");
    assert.equal(getActiveTier1ChatModel("fast"), "qwen3.5:2b");
    assert.equal(getReasonerModel(), "granite4.1:8b");
    assert.equal(isTier2Enabled(), true);
    assert.equal(getTier2Model(), "granite4.1:8b");
    assert.equal(shouldWarmTier2AtBoot(), false);
    assert.equal(isTier2Model("granite4.1:8b"), true);
  });

  it("getReasonerModel lit plan.tier2, pas experimentId==='candidate'", () => {
    const src = fs.readFileSync(
      new URL("../src/config/models.js", import.meta.url),
      "utf8",
    );
    const fn = src.slice(
      src.indexOf("export function getReasonerModel"),
      src.indexOf("export function isTier2Enabled"),
    );
    assert.equal(fn.includes('experimentId === "candidate"'), false);
    assert.equal(fn.includes("experimentId === 'candidate'"), false);
    assert.match(fn, /plan\.tier2\.enabled && plan\.tier2\.model/);
  });

  it("ollama.js defaults chat/chatSafe/chatStream = getActiveTier1ChatModel", () => {
    const src = fs.readFileSync(
      new URL("../src/llm/ollama.js", import.meta.url),
      "utf8",
    );
    assert.equal(src.includes("ornith:9b"), false);
    assert.match(src, /async chatSafe\(messages, model = getActiveTier1ChatModel\(\)/);
    assert.match(src, /async chat\(messages, model = getActiveTier1ChatModel\(\)/);
    assert.match(src, /model = getActiveTier1ChatModel\(\)/);
  });
});

const T3_ROLE_IDS = Object.freeze([
  "BUILDER",
  "ELITE_CODER",
  "TRANSLATOR",
  "VISION",
  "OCR",
  "VOX",
]);

const T3_ROLE_SNAPSHOT = Object.freeze({
  BUILDER: "qwen2.5-coder:7b",
  ELITE_CODER: "qwen2.5-coder:7b",
  TRANSLATOR: "qwen3.5:9b",
  VISION: "gemma4:12b",
  OCR: "glm-ocr:q8_0",
  VOX: "nexxus-vox:latest",
});

function tier3IdsFromMatrix(matrixPath) {
  const raw = JSON.parse(fs.readFileSync(matrixPath, "utf8"));
  return (raw.tiers?.tier3?.models || []).map((m) => m.id).sort();
}

describe("AGENT_ROLES — T1/T2 via plan unique, T3 figé", () => {
  const prev = process.env.OLLAMA_WARMUP_EXPERIMENT;

  after(() => {
    if (prev === undefined) delete process.env.OLLAMA_WARMUP_EXPERIMENT;
    else process.env.OLLAMA_WARMUP_EXPERIMENT = prev;
  });

  it("flag off — T1 qwen, T2 granite reasoner, T3 figé", () => {
    delete process.env.OLLAMA_WARMUP_EXPERIMENT;
    assert.equal(AGENT_ROLES.CHAT, "qwen3.5:2b");
    assert.equal(AGENT_ROLES.SOCIAL, "qwen3.5:2b");
    assert.equal(AGENT_ROLES.WEB_SEARCHER, "qwen3.5:2b");
    assert.equal(AGENT_ROLES.ORCHESTRATOR, "granite4.1:8b");
    assert.equal(AGENT_ROLES.PLANNER, "granite4.1:8b");
    assert.equal(AGENT_ROLES.CHAT_REASONER, "granite4.1:8b");
    assert.equal(AGENT_ROLES.FORGE_REASONER, "granite4.1:8b");
    assert.equal(getFallbackModel(AGENT_ROLES.CHAT), null);
    assert.equal(getFallbackModel(AGENT_ROLES.CHAT_REASONER), "qwen3.5:2b");
    assert.equal(getEscalationModel(AGENT_ROLES.CHAT), "granite4.1:8b");
    for (const key of T3_ROLE_IDS) {
      assert.equal(AGENT_ROLES[key], T3_ROLE_SNAPSHOT[key], key);
    }
    assert.equal(AGENT_ROLES.ZEPHYR, "qwen3.5:2b");
    assert.equal(AGENT_ROLES.SEMANTIC_ROUTER, "qwen3.5:2b");
    assert.equal(resolveLightJsonModel(), "qwen3.5:2b");
    assert.equal(resolveLightJsonModel("zephyr"), "qwen3.5:2b");
    assert.equal(resolveLightJsonModel("zephyr:latest"), "qwen3.5:2b");
  });

  it("flag candidate — T1 qwen3.5:2b, T2 granite reasoner, T3 inchangé", () => {
    process.env.OLLAMA_WARMUP_EXPERIMENT = "candidate";
    assert.equal(AGENT_ROLES.CHAT, "qwen3.5:2b");
    assert.equal(AGENT_ROLES.SOCIAL, "qwen3.5:2b");
    assert.equal(AGENT_ROLES.WEB_SEARCHER, "qwen3.5:2b");
    assert.equal(AGENT_ROLES.ORCHESTRATOR, "granite4.1:8b");
    assert.equal(AGENT_ROLES.PLANNER, "granite4.1:8b");
    assert.equal(AGENT_ROLES.CHAT_REASONER, "granite4.1:8b");
    assert.equal(AGENT_ROLES.FORGE_REASONER, "granite4.1:8b");
    assert.equal(AGENT_ROLES.MASTER_ARCHITECT, "granite4.1:8b");
    assert.equal(AGENT_ROLES.SECURITY_AUDITOR, "granite4.1:8b");
    for (const key of T3_ROLE_IDS) {
      assert.equal(AGENT_ROLES[key], T3_ROLE_SNAPSHOT[key], key);
    }
    assert.equal(AGENT_ROLES.ZEPHYR, "qwen3.5:2b");
    assert.equal(AGENT_ROLES.SEMANTIC_ROUTER, "qwen3.5:2b");
  });

  it("escalade T1→T2 ≠ fallback T2→T1 (timeout n'est pas une escalade)", () => {
    process.env.OLLAMA_WARMUP_EXPERIMENT = "candidate";
    assert.equal(getEscalationModel("qwen3.5:2b"), "granite4.1:8b");
    assert.equal(getEscalationModel("granite4.1:8b"), null);
    assert.equal(getFallbackModel("granite4.1:8b"), "qwen3.5:2b");
    assert.equal(getFallbackModel("qwen3.5:2b"), null);
  });

  it("unset flag ≠ rollback ornith — stack promu reste qwen+granite", () => {
    process.env.OLLAMA_WARMUP_EXPERIMENT = "candidate";
    assert.equal(AGENT_ROLES.CHAT, "qwen3.5:2b");
    assert.equal(AGENT_ROLES.CHAT_REASONER, "granite4.1:8b");
    delete process.env.OLLAMA_WARMUP_EXPERIMENT;
    assert.equal(AGENT_ROLES.CHAT, "qwen3.5:2b");
    assert.equal(AGENT_ROLES.CHAT_REASONER, "granite4.1:8b");
    assert.equal(getEscalationModel("qwen3.5:2b"), "granite4.1:8b");
    assert.equal(getFallbackModel("granite4.1:8b"), "qwen3.5:2b");
  });

  it("budget ms (30000) n'est pas une escalade T2 ; 3–10 oui", () => {
    assert.equal(shouldUseDeferredReasoner(1), false);
    assert.equal(shouldUseDeferredReasoner(3), true);
    assert.equal(shouldUseDeferredReasoner(10), true);
    assert.equal(shouldUseDeferredReasoner(11), false);
    assert.equal(shouldUseDeferredReasoner(30_000), false);
  });

  it("matrices baseline vs candidate — IDs T3 identiques", () => {
    assert.deepEqual(
      tier3IdsFromMatrix(WARMUP_MATRIX_BASELINE_PATH),
      tier3IdsFromMatrix(WARMUP_MATRIX_CANDIDATE_PATH),
    );
  });
});

describe("WARMUP_EXPERIMENT_GATES — warmup ≠ qualité rollout", () => {
  it("gates warmup ping/VRAM conservées", () => {
    assert.equal(WARMUP_EXPERIMENT_GATES.G1_tier1_ready_max_ratio, 1.2);
    assert.equal(WARMUP_EXPERIMENT_GATES.G4_tier1_hard_fail_max, 0);
    assert.equal(WARMUP_EXPERIMENT_GATES.G5_tier2_ondemand_max_ms, 120_000);
  });

  it("gates qualité G1–G5 / R1 figées", () => {
    const q = WARMUP_EXPERIMENT_GATES.quality;
    assert.equal(q.G1_delta_max_pts, 2);
    assert.equal(q.G1_rollback_delta_pts, 5);
    assert.equal(q.G2_t1_p95_max_ratio, 1.3);
    assert.equal(q.G2_t2_p95_warm_ms, 20_000);
    assert.equal(q.G2_t2_p95_cold_ms, 45_000);
    assert.equal(q.G2_t1_p95_rollback_ratio, 1.6);
    assert.equal(q.G3_escalate_min_pct, 15);
    assert.equal(q.G3_escalate_max_pct, 45);
    assert.equal(q.G3_rollback_pct, 60);
    assert.equal(q.G4_t1_prime_hard_fail_max, 0);
    assert.equal(q.G4_timeout_delta_max_pts, 1);
    assert.equal(q.G5_boot_vram_gb_max, 4);
    assert.equal(q.G5_t2_resident_at_boot, false);
    assert.match(q.R1, /unset OLLAMA_WARMUP_EXPERIMENT/);
  });
});

function restoreEnv(keys, prev) {
  for (const key of keys) {
    if (prev[key] === undefined) delete process.env[key];
    else process.env[key] = prev[key];
  }
}

function snapshotEnv(keys) {
  const prev = {};
  for (const key of keys) prev[key] = process.env[key];
  return prev;
}

function findSessionInBucket(pred) {
  for (let i = 0; i < 8000; i += 1) {
    const id = `sess-${i}`;
    if (pred(id)) return id;
  }
  throw new Error("no matching canary session");
}

describe("shadow — sert baseline, ne répond jamais candidate", () => {
  const keys = ["OLLAMA_WARMUP_EXPERIMENT", "OLLAMA_WARMUP_SHADOW"];
  const prev = snapshotEnv(keys);
  after(() => restoreEnv(keys, prev));

  it("corpus minimum 6 cas", () => {
    const ids = WARMUP_SHADOW_CORPUS.map((c) => c.id);
    assert.deepEqual(
      ids.sort(),
      ["architecture", "ce_soir", "checkin", "excel", "factual", "idea_critique"].sort(),
    );
  });

  it("SHADOW=1 + candidate → plan servi baseline, déclaré candidate", () => {
    const env = {
      OLLAMA_WARMUP_EXPERIMENT: "candidate",
      OLLAMA_WARMUP_SHADOW: "1",
    };
    assert.equal(isWarmupShadowEnabled(env), true);
    assert.equal(getWarmupExperimentId(env), "candidate");
    assert.equal(resolveServedExperimentId(env, "any"), "baseline");
    const served = resolveWarmupExperimentPlan(env);
    const declared = resolveDeclaredExperimentPlan(env);
    assert.equal(served.experimentId, "baseline");
    assert.equal(served.tier1Chat, "qwen3.5:2b");
    assert.equal(served.tier2.enabled, true);
    assert.equal(served.tier2.model, "granite4.1:8b");
    assert.equal(declared.tier1Chat, "qwen3.5:2b");
    assert.equal(declared.tier2.model, "granite4.1:8b");
    assert.equal(declared.tier2.warmAtBoot, false);
  });

  it("SHADOW=1 live AGENT_ROLES reste le stack promu (qwen / granite)", () => {
    process.env.OLLAMA_WARMUP_EXPERIMENT = "candidate";
    process.env.OLLAMA_WARMUP_SHADOW = "1";
    assert.equal(AGENT_ROLES.CHAT, "qwen3.5:2b");
    assert.equal(AGENT_ROLES.CHAT_REASONER, "granite4.1:8b");
  });
});

describe("canary sticky 1/10/50/100", () => {
  const keys = [
    "OLLAMA_WARMUP_EXPERIMENT",
    "OLLAMA_WARMUP_SHADOW",
    "OLLAMA_WARMUP_CANARY_PCT",
  ];
  const prev = snapshotEnv(keys);
  after(() => restoreEnv(keys, prev));

  it("paliers autorisés uniquement", () => {
    assert.deepEqual([...WARMUP_CANARY_PCTS], [1, 10, 50, 100]);
    assert.equal(getWarmupCanaryPct({}), null);
    assert.equal(getWarmupCanaryPct({ OLLAMA_WARMUP_CANARY_PCT: "10" }), 10);
    assert.equal(getWarmupCanaryPct({ OLLAMA_WARMUP_CANARY_PCT: "7" }), 0);
  });

  it("même sessionId → même seau ; pct=1 sépare in/out", () => {
    const inId = findSessionInBucket((id) => warmupCanaryBucket(id) < 1);
    const outId = findSessionInBucket((id) => warmupCanaryBucket(id) >= 1);
    assert.equal(isStickyCanarySession(inId, 1), true);
    assert.equal(isStickyCanarySession(inId, 1), true);
    assert.equal(isStickyCanarySession(outId, 1), false);
    assert.equal(isStickyCanarySession(inId, 100), true);
    assert.equal(isStickyCanarySession(outId, 100), true);
  });

  it("candidate + canary 100 → qwen ; canary 1 hors seau → baseline qwen", () => {
    const outId = findSessionInBucket((id) => warmupCanaryBucket(id) >= 1);
    const env100 = {
      OLLAMA_WARMUP_EXPERIMENT: "candidate",
      OLLAMA_WARMUP_CANARY_PCT: "100",
    };
    const env1 = {
      OLLAMA_WARMUP_EXPERIMENT: "candidate",
      OLLAMA_WARMUP_CANARY_PCT: "1",
    };
    assert.equal(resolveWarmupExperimentPlan(env100, outId).tier1Chat, "qwen3.5:2b");
    assert.equal(resolveWarmupExperimentPlan(env1, outId).tier1Chat, "qwen3.5:2b");
    assert.equal(AGENT_ROLES.VISION, "gemma4:12b");
    assert.equal(AGENT_ROLES.BUILDER, "qwen2.5-coder:7b");
  });

  it("ALS session sticky pour AGENT_ROLES", () => {
    const inId = findSessionInBucket((id) => warmupCanaryBucket(id) < 10);
    const outId = findSessionInBucket((id) => warmupCanaryBucket(id) >= 10);
    process.env.OLLAMA_WARMUP_EXPERIMENT = "candidate";
    process.env.OLLAMA_WARMUP_CANARY_PCT = "10";
    delete process.env.OLLAMA_WARMUP_SHADOW;
    runWithWarmupSession(inId, () => {
      assert.equal(AGENT_ROLES.CHAT, "qwen3.5:2b");
      assert.equal(AGENT_ROLES.CHAT_REASONER, "granite4.1:8b");
    });
    runWithWarmupSession(outId, () => {
      assert.equal(AGENT_ROLES.CHAT, "qwen3.5:2b");
    });
  });
});

describe("rollout decision + runbook — pas de promotion auto", () => {
  it("incomplet → hold ; vert complet → promote recommandé", () => {
    const hold = evaluateRolloutDecision({ escalatePct: 100 });
    assert.equal(hold.decision, "hold");
    assert.equal(hold.red.length, 0);
    assert.equal(hold.autoApply, false);
    const promote = evaluateRolloutDecision({
      complete: true,
      offtopicDeltaPts: 1,
      t1P95Ratio: 1.1,
      escalatePct: 30,
      t1PrimeHardFail: 0,
      timeoutDeltaPts: 0,
      bootVramGb: 3,
      t2ResidentAtBoot: false,
    });
    assert.equal(promote.decision, "promote");
    assert.equal(promote.autoApply, false);
  });

  it("seuil rouge → rollback + runbook unset", () => {
    const out = evaluateRolloutDecision({
      complete: true,
      offtopicDeltaPts: 6,
      t1PrimeHardFail: 1,
      t2ResidentAtBoot: true,
    });
    assert.equal(out.decision, "rollback");
    assert.ok(out.red.includes("G1_quality"));
    assert.ok(out.red.includes("G4_fallback"));
    assert.ok(out.red.includes("G5_load"));
    assert.deepEqual(out.rollback.steps, [
      "unset OLLAMA_WARMUP_EXPERIMENT",
      "unset OLLAMA_WARMUP_SHADOW",
      "unset OLLAMA_WARMUP_CANARY_PCT",
      "restart",
    ]);
    assert.equal(WARMUP_EXPERIMENT_ROLLBACK.neverCommitFlag, true);
    assert.equal(WARMUP_EXPERIMENT_ROLLBACK.t3NeverPromoted, true);
    assert.equal(
      WARMUP_EXPERIMENT_ROLLBACK.promoteBaselineOnlyIfAllQualityGatesGreen,
      true,
    );
  });
});

describe("cognitiveIdentify — hop T1, pas T2", () => {
  it("chatSafe du routeur cognitif utilise AGENT_ROLES.CHAT", () => {
    const src = fs.readFileSync(
      new URL("../src/agent/router/expertRouter.js", import.meta.url),
      "utf8",
    );
    const start = src.indexOf("async cognitiveIdentify");
    assert.ok(start >= 0);
    const next = src.indexOf("\n  async ", start + 1);
    const fn = src.slice(start, next === -1 ? undefined : next);
    assert.match(fn, /AGENT_ROLES\.CHAT/);
    assert.equal(fn.includes("AGENT_ROLES.ORCHESTRATOR"), false);
  });
});

function extractPostHandler(src, route) {
  const needle = `app.post(\n  "${route}"`;
  const start = src.indexOf(needle);
  assert.ok(start >= 0, `route ${route} introuvable`);
  const next = src.indexOf("\napp.post(", start + needle.length);
  return src.slice(start, next === -1 ? undefined : next);
}

describe("first_traffic — pas de warmup T2 spéculatif", () => {
  const indexSrc = fs.readFileSync(
    new URL("../index.js", import.meta.url),
    "utf8",
  );
  const warmupSrc = fs.readFileSync(
    new URL("../src/services/warmupService.js", import.meta.url),
    "utf8",
  );

  it("/api/chat et /api/stream ne déclenchent pas first_traffic", () => {
    const chat = extractPostHandler(indexSrc, "/api/chat");
    const stream = extractPostHandler(indexSrc, "/api/stream");
    assert.equal(chat.includes("scheduleTier2Warmup"), false);
    assert.equal(stream.includes("scheduleTier2Warmup"), false);
    assert.equal(indexSrc.includes("scheduleTier2Warmup('first_traffic')"), false);
  });

  it("T2 on-demand reste possible (ensureTier2Warmup + CHAT_REASONER granite)", () => {
    assert.match(warmupSrc, /export async function ensureTier2Warmup/);
    assert.match(warmupSrc, /scheduleTier2Warmup\('aggressive_boot'\)/);
    process.env.OLLAMA_WARMUP_EXPERIMENT = "candidate";
    assert.equal(getReasonerModel(), "granite4.1:8b");
    assert.equal(AGENT_ROLES.CHAT_REASONER, "granite4.1:8b");
    assert.equal(AGENT_ROLES.FORGE_REASONER, "granite4.1:8b");
    delete process.env.OLLAMA_WARMUP_EXPERIMENT;
    assert.equal(getReasonerModel(), "granite4.1:8b");
  });

  it("warmAtBoot reste false ; T3 inchangé ; T1 promu qwen", () => {
    assert.equal(
      resolveWarmupExperimentPlan({}).tier2.warmAtBoot,
      false,
    );
    assert.equal(
      resolveWarmupExperimentPlan({}).tier2.loadStrategy,
      "deferred",
    );
    assert.equal(
      resolveWarmupExperimentPlan({ OLLAMA_WARMUP_EXPERIMENT: "candidate" })
        .tier2.warmAtBoot,
      false,
    );
    assert.deepEqual(
      tier3IdsFromMatrix(WARMUP_MATRIX_BASELINE_PATH),
      tier3IdsFromMatrix(WARMUP_MATRIX_CANDIDATE_PATH),
    );
    process.env.OLLAMA_WARMUP_EXPERIMENT = "candidate";
    for (const key of T3_ROLE_IDS) {
      assert.equal(AGENT_ROLES[key], T3_ROLE_SNAPSHOT[key], key);
    }
    delete process.env.OLLAMA_WARMUP_EXPERIMENT;
    assert.equal(AGENT_ROLES.CHAT, "qwen3.5:2b");
  });

  it("ligne TIER-3 byte-for-byte + template warmupService inchangé", () => {
    const warmupSrc = fs.readFileSync(
      new URL("../src/services/warmupService.js", import.meta.url),
      "utf8",
    );
    assert.equal(
      warmupSrc.includes(
        "[Warmup][TIER-3] ❄️ Experts lazy: ${listTier3ExpertModels().join(', ')}",
      ),
      true,
    );
    assert.equal(
      listTier3ExpertModels().join(", "),
      "qwen2.5-coder:7b, gemma4:12b, glm-ocr:q8_0, nexxus-vox:latest",
    );
  });
});
