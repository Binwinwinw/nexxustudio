import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  shouldBypassMultiSegmentShortCircuit,
  shouldDeferShortCircuitToFullPipeline,
} from "../src/agent/policies/routing/practicalAdviceRoutingGuard.js";
import { resolveKnowledgeEnrichmentPolicy } from "../src/agent/policies/routing/knowledgeEnrichmentPolicy.js";
import { resolveClarificationGate } from "../src/agent/policies/routing/clarificationDecisionPolicy.js";
import { mergeAgentCycleWithShortCircuit } from "../src/agent/policies/routing/shortCircuitCognitiveCyclePolicy.js";
import { resolveResearchThenSummarizeIntentContractId } from "../src/agent/policies/routing/researchThenSummarizePolicy.js";
import {
  decomposeRequest,
  buildMultiUnitExecutionHint,
} from "../src/agent/policies/routing/requestDecompositionPolicy.js";
import { isWebCitationsStructuredReportCluster } from "../src/agent/policies/routing/explicitWebSearchRequestPolicy.js";

const SHORT_CIRCUIT_SRC = new URL(
  "../src/agent/micro/classifiers/intentShortCircuit.js",
  import.meta.url,
);
const PIPELINE_SRC = new URL(
  "../src/agent/agentPipeline.js",
  import.meta.url,
);

describe("routing barrel — runtime boot guard", () => {
  it("intentShortCircuit n'importe pas policies/routing/index.js", () => {
    const src = readFileSync(SHORT_CIRCUIT_SRC, "utf8");
    assert.doesNotMatch(
      src,
      /policies\/routing\/index\.js/,
      "import critique via barrel : un réordonnancement casse le boot",
    );
  });

  it("agentPipeline n'importe pas policies/routing/index.js", () => {
    const src = readFileSync(PIPELINE_SRC, "utf8");
    assert.doesNotMatch(
      src,
      /policies\/routing\/index\.js/,
      "import critique via barrel : un réordonnancement casse le boot",
    );
  });

  it("symboles routing du pipeline existent sur les modules source", () => {
    assert.equal(typeof shouldBypassMultiSegmentShortCircuit, "function");
    assert.equal(typeof shouldDeferShortCircuitToFullPipeline, "function");
    assert.equal(typeof resolveKnowledgeEnrichmentPolicy, "function");
    assert.equal(typeof resolveClarificationGate, "function");
    assert.equal(typeof mergeAgentCycleWithShortCircuit, "function");
    assert.equal(typeof resolveResearchThenSummarizeIntentContractId, "function");
    assert.equal(typeof decomposeRequest, "function");
    assert.equal(typeof buildMultiUnitExecutionHint, "function");
    assert.equal(typeof isWebCitationsStructuredReportCluster, "function");
  });

  it("intentShortCircuit charge sans export manquant", async () => {
    const mod = await import(
      "../src/agent/micro/classifiers/intentShortCircuit.js"
    );
    assert.equal(typeof mod.runConversationShortCircuit, "function");
    assert.equal(typeof mod.shouldEvaluateConversationShortCircuit, "function");
  });

  it("agentPipeline charge sans export manquant", async () => {
    const { spawn } = await import("node:child_process");
    const href = String(PIPELINE_SRC);
    await new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          `import(${JSON.stringify(href)}).then((m) => { if (typeof m.default !== "function") process.exit(2); process.exit(0); }).catch(() => process.exit(1));`,
        ],
        { stdio: ["ignore", "ignore", "pipe"] },
      );
      let err = "";
      child.stderr.on("data", (chunk) => {
        err += chunk;
      });
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error("agentPipeline import timeout"));
      }, 20000);
      child.on("exit", (code) => {
        clearTimeout(timer);
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(`agentPipeline import exit ${code}${err ? `\n${err}` : ""}`));
      });
    });
  });
});
