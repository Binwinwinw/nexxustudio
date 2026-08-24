import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import agent from "../src/agent/agent.js";
import {
  ATTACHMENT_TASKS,
  FILE_ANALYSIS_CONTRACT_ID,
  classifyAttachmentTask,
  tryFileAnalysisAwaitingSource,
  wantsFileAnalysis,
  hasExplicitFileTarget,
  isRepositoryAnalysisRequest,
} from "../src/agent/policies/attachment/index.js";
import { resolveIntentContract } from "../src/agent/config/intentContractRegistry.js";
import { isRepoAnalysisRequest } from "../src/agent/utils/intent-guards/repoAnalysisIntentGuards.js";
import { REPO_ANALYSIS_CANONICAL_GITHUB_QUERY } from "../src/agent/policies/analysis/index.js";

const LIVE_Q = "j'aimerais que tu analyses un fichier es tu disponible ?";
const EXPECTED_REPLY =
  "Oui, je suis disponible. Joins le fichier et indique si tu veux une analyse simple, complète ou critique.";
const FORBIDDEN_STEP =
  /simple_fast|EXPERT_TASK|REPO_ANALYSIS|Planner|COMPOSER|Web Search|Mode Rapide|ORCHESTRATEUR|just_intent/i;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function assertStreamHandlerCallsAgentRun() {
  const indexSrc = fs.readFileSync(path.join(__dirname, "../index.js"), "utf8");
  const streamIdx = indexSrc.indexOf('"/api/stream"');
  assert.ok(streamIdx > 0, "/api/stream introuvable");
  const runIdx = indexSrc.indexOf("agent.run(q", streamIdx);
  assert.ok(runIdx > streamIdx, "/api/stream doit appeler agent.run(q)");
  const nextRoute = indexSrc.indexOf("app.post(", streamIdx + 1);
  assert.ok(runIdx < nextRoute || nextRoute < 0, "agent.run(q) hors handler stream");
}

function createStreamLikeServer() {
  return http.createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/api/stream") {
      res.statusCode = 404;
      res.end();
      return;
    }
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw || "{}");
    const imageFiles = Array.isArray(body.images) ? body.images : [];
    const steps = [];
    const result = await agent.run(body.q, body.history || [], {
      images: imageFiles,
      onStep: (step, meta = {}) => {
        steps.push({ step, ...meta });
      },
      onContent: () => {},
    });
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        result,
        steps,
        pipelinePath: steps[0]?.pipelinePath || null,
        route: steps[0]?.route || null,
      }),
    );
  });
}

async function postStream(server, payload) {
  const { port } = server.address();
  const res = await fetch(`http://127.0.0.1:${port}/api/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert.equal(res.status, 200);
  return res.json();
}

describe("file_analysis_awaiting_source — chemin HTTP /api/stream → agent.run", () => {
  it("le handler /api/stream appelle agent.run(q)", () => {
    assertStreamHandlerCallsAgentRun();
  });

  it("POST live sans PJ → CLARIFY, aucun agent, aucun web", async () => {
    const gate = tryFileAnalysisAwaitingSource(LIVE_Q, { images: [] });
    assert.equal(wantsFileAnalysis(LIVE_Q), true);
    assert.equal(hasExplicitFileTarget(LIVE_Q), false);
    assert.equal(isRepositoryAnalysisRequest(LIVE_Q), false);
    assert.equal(gate?.route, "file_analysis_awaiting_source");
    assert.equal(gate?.contract, null);
    assert.equal(gate?.pipelinePath, "CLARIFY");

    const server = createStreamLikeServer();
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const started = Date.now();
      const body = await postStream(server, { q: LIVE_Q, history: [], images: [] });
      assert.ok(Date.now() - started < 2000, "la garde HTTP doit être instantanée");
      assert.equal(body.result, EXPECTED_REPLY);
      assert.equal(body.pipelinePath, "CLARIFY");
      assert.equal(body.route, "file_analysis_awaiting_source");
      const stepBlob = JSON.stringify(body.steps);
      assert.doesNotMatch(stepBlob, FORBIDDEN_STEP);
      assert.equal(body.steps.length, 1);
    } finally {
      server.close();
    }
  });

  it(".js joint + analyse le fichier → doc_analyze + FILE_ANALYSIS_V1", () => {
    const q = "analyse le fichier";
    const files = [{ originalname: "server-index-clean.js" }];
    assert.equal(tryFileAnalysisAwaitingSource(q, { images: files }), null);
    const hit = classifyAttachmentTask(q, files);
    assert.equal(hit.task, ATTACHMENT_TASKS.DOC_ANALYZE);
    assert.equal(hit.outputContract, FILE_ANALYSIS_CONTRACT_ID);
  });

  it("analyse ce dépôt GitHub → REPO_ANALYSIS, pas CLARIFY", () => {
    const q = REPO_ANALYSIS_CANONICAL_GITHUB_QUERY;
    assert.equal(tryFileAnalysisAwaitingSource(q, { images: [] }), null);
    assert.equal(isRepoAnalysisRequest(q), true);
    const { contract } = resolveIntentContract(q);
    assert.equal(contract.id, "REPO_ANALYSIS");
  });

  it("analyse le code sans fichier ni cible → jamais REPO_ANALYSIS", () => {
    const q = "analyse le code";
    assert.equal(tryFileAnalysisAwaitingSource(q, { images: [] }), null);
    const { contract } = resolveIntentContract(q, { user_intent: "expert_task" });
    assert.notEqual(contract.id, "REPO_ANALYSIS");
  });
});
