import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getActiveTier1ChatModel, listTier3ExpertModels } from "../src/config/models.js";
import {
  AGENT_ROLES,
  resolveLightJsonModel,
} from "../src/agent/policies/core/agentRolePolicy.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(__dirname, "../src");
const TIER3_LOG = "qwen2.5-coder:7b, gemma4:12b, glm-ocr:q8_0, nexxus-vox:latest";
const TIER3_LINE = `[Warmup][TIER-3] ❄️ Experts lazy: ${TIER3_LOG}`;

const RUNTIME_ZEPHYR_RE =
  /(?:\|\|\s*["']zephyr(?::latest)?["']|["']zephyr:latest["']|model:\s*["']zephyr)/i;

function walkJsFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJsFiles(full, acc);
    else if (entry.name.endsWith(".js")) acc.push(full);
  }
  return acc;
}

describe("SemanticPreProcessor — modèle T1, plus zephyr", () => {
  it("resolveLightJsonModel = T1 qwen3.5:2b ; zephyr ignoré", () => {
    assert.equal(resolveLightJsonModel(), "qwen3.5:2b");
    assert.equal(resolveLightJsonModel(""), getActiveTier1ChatModel());
    assert.equal(resolveLightJsonModel("zephyr"), "qwen3.5:2b");
    assert.equal(resolveLightJsonModel("zephyr:latest"), "qwen3.5:2b");
    assert.equal(resolveLightJsonModel("qwen3.5:9b"), "qwen3.5:9b");
  });

  it("semanticPreProcessor.js appelle T1 via resolveLightJsonModel, plus défaut zephyr", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../src/agent/stages/semanticPreProcessor.js"),
      "utf8",
    );
    assert.match(src, /export function getSemanticPreprocessorModel/);
    assert.match(
      src,
      /resolveLightJsonModel\(process\.env\.OLLAMA_SEMANTIC_PREPROCESSOR_MODEL\)/,
    );
    assert.match(src, /getSemanticPreprocessorModel\(\)/);
    assert.equal(src.includes('|| "zephyr"'), false);
    assert.equal(src.includes("|| 'zephyr'"), false);
    assert.equal(src.includes('"zephyr"'), false);
  });

  it("SEMANTIC_ROUTER / ZEPHYR alias = T1, pas T3", () => {
    assert.equal(AGENT_ROLES.SEMANTIC_ROUTER, "qwen3.5:2b");
    assert.equal(AGENT_ROLES.ZEPHYR, "qwen3.5:2b");
    assert.equal(AGENT_ROLES.BUILDER, "qwen2.5-coder:7b");
    assert.equal(AGENT_ROLES.CHAT, "qwen3.5:2b");
    assert.equal(AGENT_ROLES.CHAT_REASONER, "granite4.1:8b");
  });

  it("aucun défaut runtime Ollama model=zephyr dans server/src", () => {
    const hits = [];
    for (const file of walkJsFiles(SRC_ROOT)) {
      const src = fs.readFileSync(file, "utf8");
      if (!RUNTIME_ZEPHYR_RE.test(src)) continue;
      hits.push(path.relative(SRC_ROOT, file).replaceAll("\\", "/"));
    }
    assert.deepEqual(hits, [], `call sites zephyr restants: ${hits.join(", ")}`);
  });

  it("airllm catalogue ne liste plus zephyr:latest", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../src/llm/airllm.js"),
      "utf8",
    );
    assert.equal(src.includes('"zephyr:latest"'), false);
    assert.equal(src.includes('"zephyr"'), false);
  });

  it("matrice ExecutionBrief default_model = T1 ; actor ornith = metadata T1", () => {
    const matrix = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, "../config/executionBrief.trigger-matrix.json"),
        "utf8",
      ),
    );
    assert.equal(matrix.doctrine.default_model, "qwen3.5:2b");
    assert.equal(matrix.actor_escalation.ornith.model, "qwen3.5:2b");
    assert.equal(matrix.actor_escalation.ornith.tier, 1);
    assert.equal(matrix.actor_escalation.ornith_only.model, "qwen3.5:2b");
  });

  it("ligne T3 byte-for-byte inchangée", () => {
    const warmupSrc = fs.readFileSync(
      path.resolve(__dirname, "../src/services/warmupService.js"),
      "utf8",
    );
    assert.equal(
      warmupSrc.includes(
        "[Warmup][TIER-3] ❄️ Experts lazy: ${listTier3ExpertModels().join(', ')}",
      ),
      true,
    );
    assert.equal(listTier3ExpertModels().join(", "), TIER3_LOG);
    assert.equal(
      `[Warmup][TIER-3] ❄️ Experts lazy: ${listTier3ExpertModels().join(", ")}`,
      TIER3_LINE,
    );
  });
});
