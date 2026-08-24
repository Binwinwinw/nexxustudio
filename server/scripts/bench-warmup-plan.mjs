#!/usr/bin/env node
/**
 * Bench A/B warmup T1/T2 (réversible).
 *
 * Usage:
 *   node scripts/bench-warmup-plan.mjs --dry-run
 *   node scripts/bench-warmup-plan.mjs --prime
 *   node scripts/bench-warmup-plan.mjs --prime --routing-gate
 *   node scripts/bench-warmup-plan.mjs --shadow
 *   node scripts/bench-warmup-plan.mjs --shadow --prime
 *   node scripts/bench-warmup-plan.mjs --dry-run --experiment candidate
 *
 * Sans --experiment : lit OLLAMA_WARMUP_EXPERIMENT (défaut baseline).
 * Shadow sert toujours le baseline ; le candidate n'est jamais la réponse.
 * Seuils G1–G5 / R1 : voir WARMUP_EXPERIMENT_GATES (doc plan).
 */
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  resolveWarmupExperimentPlan,
  resolveDeclaredExperimentPlan,
  isWarmupShadowEnabled,
  WARMUP_EXPERIMENT_GATES,
  WARMUP_SHADOW_CORPUS,
  WARMUP_EXPERIMENT_ROLLBACK,
  evaluateRolloutDecision,
} from "../src/config/warmupExperimentPlan.js";
import {
  getActiveTier1ChatModel,
  getReasonerModel,
  getTier2Model,
  isTier2Enabled,
  listTier3ExpertModels,
  shouldWarmTier2AtBoot,
} from "../src/config/models.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../tmp");

function resolveOllamaHost(raw = process.env.OLLAMA_HOST || "http://127.0.0.1:11434") {
  let host = String(raw || "").trim() || "http://127.0.0.1:11434";
  if (!/^https?:\/\//i.test(host)) host = `http://${host}`;
  host = host.replace(/0\.0\.0\.0/g, "127.0.0.1").replace(/\/$/, "");
  return host;
}

const OLLAMA_HOST = resolveOllamaHost();

function parseArgs(argv) {
  const args = {
    dryRun: false,
    prime: false,
    routingGate: false,
    experiment: null,
    shadow: false,
  };
  for (const a of argv) {
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--prime") args.prime = true;
    else if (a === "--routing-gate") args.routingGate = true;
    else if (a === "--shadow") args.shadow = true;
    else if (a.startsWith("--experiment=")) {
      args.experiment = a.slice("--experiment=".length);
    } else if (a === "--experiment") {
      args._nextExp = true;
    } else if (args._nextExp) {
      args.experiment = a;
      args._nextExp = false;
    }
  }
  if (!args.dryRun && !args.prime && !args.routingGate && !args.shadow) {
    args.dryRun = true;
  }
  return args;
}

async function readPs() {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/ps`);
    if (!res.ok) return { ok: false, models: [], error: `HTTP ${res.status}` };
    const data = await res.json();
    const models = Array.isArray(data?.models) ? data.models : [];
    const totalBytes = models.reduce((s, m) => s + (Number(m.size) || 0), 0);
    return {
      ok: true,
      models: models.map((m) => ({
        name: m.name || m.model,
        sizeGb: Number(((Number(m.size) || 0) / 1e9).toFixed(3)),
      })),
      totalSizeGb: Number((totalBytes / 1e9).toFixed(3)),
    };
  } catch (err) {
    return { ok: false, models: [], error: err.message };
  }
}

async function primeModel(modelId, opts = {}) {
  const start = Date.now();
  const body = {
    model: modelId,
    messages: [{ role: "user", content: opts.prompt || "Ping" }],
    stream: false,
    options: { num_predict: opts.numPredict ?? 1, num_ctx: 2048 },
    keep_alive: opts.keepAlive ?? "30m",
  };
  const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const ms = Date.now() - start;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { model: modelId, ok: false, ms, error: `HTTP ${res.status} ${text.slice(0, 120)}` };
  }
  await res.json().catch(() => null);
  return { model: modelId, ok: true, ms };
}

async function runRoutingGate() {
  const { runConversationShortCircuit } = await import(
    "../src/agent/micro/classifiers/intentShortCircuit.js"
  );
  const cases = [
    {
      id: "social",
      q: "bonjour, est-ce que tu es disponible ???",
      forbid: [],
      requirePathPrefix: "social",
    },
    {
      id: "excel",
      q: 'aide moi à propos de ce projet sur excel, je veux créer "un tableau de bord" calendriers rendez-vous congés',
      forbid: [
        "architecture_design_deterministic",
        "lexicon_science_format_table",
      ],
    },
  ];
  const results = [];
  for (const c of cases) {
    const hit = await runConversationShortCircuit(c.q);
    const pathHit = String(hit?.path || "");
    const forbidHit = c.forbid.find((p) => pathHit.startsWith(p) || pathHit === p);
    const requireOk = c.requirePathPrefix
      ? pathHit.startsWith(c.requirePathPrefix)
      : true;
    results.push({
      id: c.id,
      path: pathHit || null,
      ok: !forbidHit && requireOk,
      forbidHit: forbidHit || null,
    });
  }
  return {
    ok: results.every((r) => r.ok),
    results,
  };
}

async function runShadowCorpus({ prime = false } = {}) {
  const served = resolveWarmupExperimentPlan();
  const shadowTarget = resolveDeclaredExperimentPlan({
    OLLAMA_WARMUP_EXPERIMENT: "candidate",
  });
  const { runConversationShortCircuit } = await import(
    "../src/agent/micro/classifiers/intentShortCircuit.js"
  );

  const turns = [];
  let scCount = 0;
  let llmCount = 0;
  let escalateCount = 0;

  for (const item of WARMUP_SHADOW_CORPUS) {
    const hit = await runConversationShortCircuit(item.q);
    const pathHit = String(hit?.path || "");
    const viaSc = Boolean(pathHit);
    if (viaSc) scCount += 1;
    else llmCount += 1;
    const wouldEscalate = !viaSc && item.lane === "t2_escalate";
    if (wouldEscalate) escalateCount += 1;

    let servedPrime = null;
    let shadowT1 = null;
    let shadowT2 = null;
    if (prime) {
      servedPrime = await primeModel(served.tier1Chat, {
        prompt: item.q.slice(0, 80),
        numPredict: 8,
      });
      shadowT1 = await primeModel(shadowTarget.tier1Chat, {
        prompt: item.q.slice(0, 80),
        numPredict: 8,
        keepAlive: "0",
      });
      if (wouldEscalate && shadowTarget.tier2.model) {
        shadowT2 = await primeModel(shadowTarget.tier2.model, {
          prompt: "Ping",
          numPredict: 1,
          keepAlive: "0",
        });
      }
    }

    turns.push({
      id: item.id,
      lane: item.lane,
      servedReplyFrom: "baseline",
      path: pathHit || "llm",
      viaShortCircuit: viaSc,
      wouldEscalate,
      served: { model: served.tier1Chat, prime: servedPrime },
      shadow: {
        t1: { model: shadowTarget.tier1Chat, prime: shadowT1 },
        t2: wouldEscalate
          ? { model: shadowTarget.tier2.model, prime: shadowT2 }
          : null,
      },
    });
  }

  const llmTurns = Math.max(llmCount, 1);
  const escalatePct = Number(((escalateCount / llmTurns) * 100).toFixed(1));
  const t1Latencies = turns
    .map((t) => t.shadow?.t1?.prime?.ms)
    .filter((ms) => Number.isFinite(ms));
  const t2Latencies = turns
    .map((t) => t.shadow?.t2?.prime?.ms)
    .filter((ms) => Number.isFinite(ms));
  const p95 = (arr) => {
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.ceil(s.length * 0.95) - 1)];
  };

  const decision = evaluateRolloutDecision({
    complete: false,
    escalatePct,
    t1PrimeHardFail: turns.some((t) => t.served?.prime && !t.served.prime.ok)
      ? 1
      : 0,
    t2ResidentAtBoot: false,
  });

  return {
    servedExperimentId: served.experimentId,
    servedReply: "baseline",
    shadowTarget: {
      tier1Chat: shadowTarget.tier1Chat,
      tier2: shadowTarget.tier2.model,
    },
    corpusSize: WARMUP_SHADOW_CORPUS.length,
    scCount,
    llmCount,
    escalateCount,
    escalatePct,
    t1P95Ms: p95(t1Latencies),
    t2P95Ms: p95(t2Latencies),
    turns,
    decision,
    rollback: WARMUP_EXPERIMENT_ROLLBACK,
  };
}

function buildResolvedSnapshot(plan) {
  return {
    experiment: plan.experiment,
    experimentId: plan.experimentId,
    ownership: plan.ownership,
    matrixPath: plan.matrixPath,
    tier1Chat: getActiveTier1ChatModel(),
    tier1Embeddings: plan.tier1Embeddings,
    reasoner: getReasonerModel(),
    tier2: {
      enabled: isTier2Enabled(),
      model: getTier2Model(),
      warmAtBoot: shouldWarmTier2AtBoot(),
      vramGb: plan.tier2.vramGb,
    },
    tier3Experts: listTier3ExpertModels(),
    declaredVramBootGb: plan.declaredVramBootGb,
    gates: WARMUP_EXPERIMENT_GATES,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.experiment != null) {
    process.env.OLLAMA_WARMUP_EXPERIMENT =
      args.experiment === "baseline" || args.experiment === "off"
        ? ""
        : args.experiment;
  }
  if (args.shadow) process.env.OLLAMA_WARMUP_SHADOW = "1";

  const plan = resolveWarmupExperimentPlan();
  const report = {
    ts: new Date().toISOString(),
    host: OLLAMA_HOST,
    experiment: plan.experiment,
    ownership: plan.ownership,
    mode: {
      dryRun: args.dryRun,
      prime: args.prime,
      routingGate: args.routingGate,
      shadow: args.shadow || isWarmupShadowEnabled(),
    },
    resolved: buildResolvedSnapshot(plan),
    prime: null,
    psBefore: null,
    psAfter: null,
    routingGate: null,
    shadow: null,
  };

  console.log("=== Warmup bench plan ===");
  console.log(`experiment=${plan.experiment}`);
  console.log(
    `owner=${plan.ownership.owner} cleanup_by=${plan.ownership.cleanupBy}`,
  );
  console.log(plan.ownership.rule);
  console.log(JSON.stringify(report.resolved, null, 2));

  if (args.dryRun && !args.prime && !args.routingGate && !args.shadow) {
    await fs.mkdir(OUT_DIR, { recursive: true });
    const out = path.join(
      OUT_DIR,
      `warmup-bench-${plan.experiment}-dry-${Date.now()}.json`,
    );
    await fs.writeFile(out, JSON.stringify(report, null, 2), "utf8");
    console.log(`\nWrote ${out}`);
    console.log(`DONE experiment=${plan.experiment}`);
    return;
  }

  if (args.prime) {
    report.psBefore = await readPs();
    const tier1Start = Date.now();
    const chatPrime = await primeModel(plan.tier1Chat, {
      prompt: "Bonjour Nexxus. Es-tu prêt ?",
      numPredict: 8,
    });
    const embedNote = {
      model: plan.tier1Embeddings,
      ok: null,
      ms: null,
      note: "embeddings skipped in bench (chat-only prime)",
    };
    const tier1Ms = Date.now() - tier1Start;

    let tier2Prime = null;
    if (isTier2Enabled() && getTier2Model()) {
      const t2Start = Date.now();
      tier2Prime = await primeModel(getTier2Model(), {
        prompt: "Ping",
        numPredict: 1,
      });
      tier2Prime.loadMs = Date.now() - t2Start;
    }

    report.prime = {
      tier1ReadyMs: tier1Ms,
      chat: chatPrime,
      embeddings: embedNote,
      tier2: tier2Prime,
      g4_tier1_hard_fail: chatPrime.ok ? 0 : 1,
      g5_tier2_ms: tier2Prime?.loadMs ?? null,
    };
    report.psAfter = await readPs();
    console.log("\n--- prime ---");
    console.log(JSON.stringify(report.prime, null, 2));
    console.log("--- /api/ps after ---");
    console.log(JSON.stringify(report.psAfter, null, 2));
  }

  if (args.routingGate) {
    report.routingGate = await runRoutingGate();
    console.log("\n--- routing-gate (R1) ---");
    console.log(JSON.stringify(report.routingGate, null, 2));
  }

  if (args.shadow) {
    report.shadow = await runShadowCorpus({ prime: args.prime });
    console.log("\n--- shadow (served=baseline, candidate not replied) ---");
    console.log(JSON.stringify({
      servedExperimentId: report.shadow.servedExperimentId,
      servedReply: report.shadow.servedReply,
      shadowTarget: report.shadow.shadowTarget,
      scCount: report.shadow.scCount,
      llmCount: report.shadow.llmCount,
      escalatePct: report.shadow.escalatePct,
      decision: report.shadow.decision,
    }, null, 2));
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  const out = path.join(
    OUT_DIR,
    `warmup-bench-${plan.experiment}-${Date.now()}.json`,
  );
  await fs.writeFile(out, JSON.stringify(report, null, 2), "utf8");
  console.log(`\nWrote ${out}`);
  console.log(`DONE experiment=${plan.experiment}`);

  if (report.prime && report.prime.g4_tier1_hard_fail > 0) {
    console.error(
      `NO-GO G4: Tier1 prime failed — rollback immédiat (experiment=${plan.experiment}). Unset OLLAMA_WARMUP_EXPERIMENT + restart, sans commit.`,
    );
    process.exitCode = 2;
  }
  if (report.routingGate && !report.routingGate.ok) {
    console.error(
      `NO-GO R1: routing-gate failed — rollback immédiat (experiment=${plan.experiment}). Unset OLLAMA_WARMUP_EXPERIMENT + restart, sans commit.`,
    );
    process.exitCode = 2;
  }
  if (report.shadow && report.shadow.servedExperimentId !== "baseline") {
    console.error(
      "NO-GO shadow: candidate would have been served — abort. Unset OLLAMA_WARMUP_SHADOW + OLLAMA_WARMUP_EXPERIMENT + restart.",
    );
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
