import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";

import {
  buildPlacementPlan,
  listModelIdsByClass,
  summarizePlacementForCockpit,
  inferObservedProcessor,
  indexActiveObservations,
  PLACEMENT_CLASSES,
  PLACEMENT_ACTIONS,
  PLACEMENT_KEEPALIVE_TRANSPORT,
} from "../src/llm/placement/placementPlan.js";
import { buildWarmupCockpitSnapshot } from "../src/services/warmupCockpitSnapshot.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MATRIX_PATH = path.resolve(__dirname, "../config/warmup.matrix.json");

describe("placementPlan P0 — buildPlacementPlan", () => {
  it("reactive → resident = ornith:9b + nomic-embed-text", async () => {
    const matrix = await fs.readJson(MATRIX_PATH);
    const plan = buildPlacementPlan({ profile: "reactive", matrix });

    assert.equal(plan.version, "1.0.0");
    assert.equal(plan.profile, "reactive");
    assert.equal(plan.honesty.silentDowngradeAllowed, false);
    assert.equal(plan.honesty.keepAliveTransport, PLACEMENT_KEEPALIVE_TRANSPORT);

    const resident = listModelIdsByClass(plan, PLACEMENT_CLASSES.RESIDENT);
    assert.ok(resident.includes("ornith:9b"), `resident=${resident.join(",")}`);
    assert.ok(
      resident.includes("nomic-embed-text:latest"),
      `resident=${resident.join(",")}`,
    );

    const lazy = listModelIdsByClass(plan, PLACEMENT_CLASSES.LAZY);
    assert.ok(!lazy.includes("deepseek-r1:8b"));
    assert.ok(lazy.includes("qwen2.5-coder:7b"));

    const never = listModelIdsByClass(plan, PLACEMENT_CLASSES.NEVER);
    assert.ok(never.includes("deepseek-r1:8b"));
    assert.ok(never.includes("deepseek-r1:14b"));
  });

  it("fast → resident chat = qwen3.5:9b", async () => {
    const matrix = await fs.readJson(MATRIX_PATH);
    const plan = buildPlacementPlan({ profile: "fast", matrix });
    const resident = listModelIdsByClass(plan, PLACEMENT_CLASSES.RESIDENT);
    assert.ok(resident.includes("qwen3.5:9b"));
    assert.ok(!resident.includes("ornith:9b"));
  });

  it("aggressive → pas de tier2 prefetch (Tier 2 off)", async () => {
    const matrix = await fs.readJson(MATRIX_PATH);
    const plan = buildPlacementPlan({ profile: "aggressive", matrix });
    const prefetch = listModelIdsByClass(plan, PLACEMENT_CLASSES.PREFETCH);
    assert.ok(!prefetch.includes("deepseek-r1:8b"));
  });

  it("intentHint ne pollue pas class", async () => {
    const matrix = await fs.readJson(MATRIX_PATH);
    const plan = buildPlacementPlan({
      profile: "reactive",
      matrix,
      intentHints: { "qwen2.5-coder:7b": "prefetch" },
    });
    const coder = plan.models.find((m) => m.modelId === "qwen2.5-coder:7b");
    assert.equal(coder.class, PLACEMENT_CLASSES.LAZY);
    assert.equal(coder.intentHint, "prefetch");
  });

  it("observations ollama ps → processor + size", async () => {
    const matrix = await fs.readJson(MATRIX_PATH);
    const plan = buildPlacementPlan({
      profile: "reactive",
      matrix,
      activePsModels: [
        {
          name: "ornith:9b",
          size: 7.8e9,
          size_vram: 7.8e9,
        },
        {
          name: "deepseek-r1:8b",
          size: 5.2e9,
          size_vram: 0,
        },
      ],
    });
    const ornith = plan.models.find((m) => m.modelId === "ornith:9b");
    const r1 = plan.models.find((m) => m.modelId === "deepseek-r1:8b");
    assert.equal(ornith.observedProcessor, "gpu");
    assert.ok(ornith.observedSizeGb > 7);
    assert.equal(r1.class, PLACEMENT_CLASSES.NEVER);
    assert.equal(r1.observedProcessor, "cpu");
  });

  it("PLACEMENT_ACTIONS expose deferred ≠ refuse", () => {
    assert.equal(PLACEMENT_ACTIONS.DEFERRED, "deferred");
    assert.equal(PLACEMENT_ACTIONS.REFUSE, "refuse");
    assert.notEqual(PLACEMENT_ACTIONS.DEFERRED, PLACEMENT_ACTIONS.REFUSE);
  });
});

describe("placementPlan — helpers", () => {
  it("inferObservedProcessor mixed", () => {
    assert.equal(
      inferObservedProcessor({ size: 10e9, size_vram: 4e9 }),
      "mixed",
    );
    assert.equal(
      inferObservedProcessor({ processor: "100% GPU" }),
      "gpu",
    );
  });

  it("indexActiveObservations", () => {
    const map = indexActiveObservations([
      { name: "a", size: 1e9, size_vram: 1e9 },
    ]);
    assert.equal(map.get("a").observedProcessor, "gpu");
  });

  it("summarizePlacementForCockpit + snapshot", async () => {
    const matrix = await fs.readJson(MATRIX_PATH);
    const plan = buildPlacementPlan({ profile: "reactive", matrix });
    const summary = summarizePlacementForCockpit(plan);
    assert.deepEqual(
      summary.resident.sort(),
      ["nomic-embed-text:latest", "ornith:9b"].sort(),
    );

    const snapshot = buildWarmupCockpitSnapshot({
      phase: "ready",
      isReady: true,
      tier2_deferred: false,
      placementPlan: plan,
      models: {
        "ornith:9b": "ready",
        "nomic-embed-text:latest": "ready",
        "qwen2.5-coder:7b": "lazy",
      },
    });
    assert.ok(snapshot.placement);
    assert.equal(snapshot.placement.profile, "reactive");
    assert.ok(snapshot.placement.resident.includes("ornith:9b"));
    assert.ok(!snapshot.placement.lazy.includes("deepseek-r1:8b"));
    assert.ok(snapshot.placement.never.includes("deepseek-r1:8b"));
  });
});
