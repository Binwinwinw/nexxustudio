import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  isWebSearchExpertAuthorized,
  filterUnauthorizedWebExpertMatches,
  WEB_SEARCH_EXPERT_KEY,
} from "../src/agent/policies/routing/webSearchExpertAuthorization.js";
import { isExplicitWebSearchRequest } from "../src/agent/policies/routing/explicitWebSearchRequestPolicy.js";
import { shouldSkipWebSearchForIntent } from "../src/agent/config/intentContractRegistry.js";
import { resolveIntentContract } from "../src/agent/config/intentContractRegistry.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { shouldDeferShortCircuitToFullPipeline } from "../src/agent/policies/routing/practicalAdviceRoutingGuard.js";
import {
  SHORT_GENERAL_ANSWER_PATH,
  isShortGeneralAnswerRequest,
} from "../src/agent/policies/conversation/shortGeneralAnswerPolicy.js";
import { tryFileAnalysisAwaitingSource } from "../src/agent/policies/attachment/fileAnalysisContract.js";
import {
  classifyAttachmentTask,
  ATTACHMENT_TASKS,
  FILE_ANALYSIS_CONTRACT_ID,
  SQL_SOURCE_ANALYSIS_CONTRACT_ID,
} from "../src/agent/policies/attachment/index.js";
import { isRepoAnalysisRequest } from "../src/agent/utils/intent-guards/repoAnalysisIntentGuards.js";
import {
  REPO_ANALYSIS_CANONICAL_GITHUB_QUERY,
} from "../src/agent/policies/analysis/index.js";
import { REPO_ANALYSIS_CONTRACT_ID } from "../src/agent/analysis/repoAnalysisContract.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const WEB_MATCH = {
  expert: { key: WEB_SEARCH_EXPERT_KEY, name: "Expert Web Search" },
  score: 0.99,
};
const REPO_AUDIT_MATCH = {
  expert: { key: "repo_audit_agent", name: "RepoAuditAgent" },
  score: 0.95,
};
const MEMORY_MATCH = {
  expert: { key: "memory_consolidator", name: "Nexxus Consolidator" },
  score: 0.9,
};

const BM25_WEB_ONLY = [WEB_MATCH, REPO_AUDIT_MATCH, MEMORY_MATCH];

const CHAT_HISTORY = [
  { role: "user", content: "salut salut" },
  {
    role: "assistant",
    content:
      "Salut ! Si tu veux on peut papoter ou je t'aide à cadrer un projet.",
  },
];

/**
 * Miroir de la boucle Sovereign : seule clé exécutée = expert_web_search si autorisée.
 * @returns {{ executedKeys: string[], webResearchStages: string[] }}
 */
function simulateExecutedExpertOutputs(matches, query, packet = {}, options = {}) {
  const selected = filterUnauthorizedWebExpertMatches(
    matches,
    query,
    packet,
    options,
  );
  const executedKeys = [];
  const webResearchStages = [];
  for (const match of selected) {
    const key = match?.expert?.key;
    if (key !== WEB_SEARCH_EXPERT_KEY) continue;
    if (!isWebSearchExpertAuthorized(query, packet, options)) continue;
    if (shouldSkipWebSearchForIntent(query, packet)) continue;
    executedKeys.push(key);
    webResearchStages.push("web_research");
  }
  return { selected, executedKeys, webResearchStages };
}

describe("Lot A — autorisation expert_web_search (T1–T8)", () => {
  it("câblage : barrière sélection RoutingStage + exécution Sovereign", () => {
    const routing = fs.readFileSync(
      path.join(ROOT, "src/agent/stages/RoutingStage.js"),
      "utf8",
    );
    const sovereign = fs.readFileSync(
      path.join(ROOT, "src/agent/orchestrator/SovereignOrchestrator.js"),
      "utf8",
    );
    const json = JSON.parse(
      fs.readFileSync(
        path.join(ROOT, "data/experts/expert_web_search.json"),
        "utf8",
      ),
    );
    assert.match(routing, /filterUnauthorizedWebExpertMatches/);
    assert.match(sovereign, /isWebSearchExpertAuthorized/);
    const when = json.experts[0].when_to_use;
    assert.deepEqual(when, [
      "recherche web",
      "sur internet",
      "actualité",
      "source externe",
    ]);
    assert.equal(when.includes("pourquoi"), false);
    assert.equal(when.includes("comment"), false);
    assert.equal(when.includes("histoire"), false);
  });

  it("T1 — question générale courte → aucun expert JSON web exécuté", async () => {
    const q = "que penses-tu de Linux ?";
    assert.equal(isShortGeneralAnswerRequest(q), true);
    const hit = await runConversationShortCircuit(q, { history: CHAT_HISTORY });
    assert.equal(hit?.path, SHORT_GENERAL_ANSWER_PATH);
    assert.equal(hit?.skipWeb, true);
    assert.equal(hit?.skipSovereign, true);
    assert.equal(hit?.skipComposer, true);
    assert.equal(shouldDeferShortCircuitToFullPipeline(hit, q), false);
    assert.equal(isWebSearchExpertAuthorized(q), false);
    const sim = simulateExecutedExpertOutputs(BM25_WEB_ONLY, q);
    assert.equal(sim.executedKeys.includes(WEB_SEARCH_EXPERT_KEY), false);
    assert.equal(sim.webResearchStages.includes("web_research"), false);
  });

  it("T2 — social_checkin → aucun web_research", async () => {
    const q = "comment ça va ?";
    const hit = await runConversationShortCircuit(q, { history: CHAT_HISTORY });
    assert.equal(hit?.path, "social_deterministic");
    assert.ok(!hit?.deferToLlm);
    assert.equal(isWebSearchExpertAuthorized(q), false);
    const sim = simulateExecutedExpertOutputs(BM25_WEB_ONLY, q);
    assert.deepEqual(sim.webResearchStages, []);
    assert.equal(sim.executedKeys.length, 0);
  });

  it("T3 — recherche web explicite → expert_web_search uniquement", () => {
    const q = "fais une recherche sur internet sur les RTX 5070";
    assert.equal(isExplicitWebSearchRequest(q), true);
    assert.equal(isWebSearchExpertAuthorized(q), true);
    const sim = simulateExecutedExpertOutputs(BM25_WEB_ONLY, q);
    assert.deepEqual(sim.executedKeys, [WEB_SEARCH_EXPERT_KEY]);
    assert.deepEqual(sim.webResearchStages, ["web_research"]);
    assert.equal(sim.executedKeys.includes("repo_audit_agent"), false);
    assert.equal(sim.executedKeys.includes("memory_consolidator"), false);
  });

  it("T3b — forcedExpertKey expert_web_search autorise sans locution explicite", () => {
    const q = "marché streaming 2026";
    assert.equal(isExplicitWebSearchRequest(q), false);
    assert.equal(isWebSearchExpertAuthorized(q), false);
    assert.equal(
      isWebSearchExpertAuthorized(q, {}, { forcedExpertKey: WEB_SEARCH_EXPERT_KEY }),
      true,
    );
    const sim = simulateExecutedExpertOutputs(BM25_WEB_ONLY, q, {}, {
      forcedExpertKey: "Elite:expert_web_search",
    });
    assert.deepEqual(sim.executedKeys, [WEB_SEARCH_EXPERT_KEY]);
  });

  it("T3c — contrat FACTUAL déjà posé autorise (pas BM25 seul)", () => {
    const q = "marché du streaming vidéo chiffres 2026";
    assert.equal(isExplicitWebSearchRequest(q), false);
    const packet = { meta: { intent_contract_id: "FACTUAL_RESEARCH" } };
    assert.equal(isWebSearchExpertAuthorized(q, packet), true);
    const sim = simulateExecutedExpertOutputs(BM25_WEB_ONLY, q, packet);
    assert.deepEqual(sim.webResearchStages, ["web_research"]);
  });

  it("T4 — GitHub → REPO_ANALYSIS_V1, pas RepoAuditAgent JSON exécuté", async () => {
    const q = REPO_ANALYSIS_CANONICAL_GITHUB_QUERY;
    assert.equal(isRepoAnalysisRequest(q), true);
    const { contract } = resolveIntentContract(q, {});
    assert.equal(contract.id, "REPO_ANALYSIS");
    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.forcedIntentContractId, "REPO_ANALYSIS");
    const packet = { meta: { intent_contract_id: "REPO_ANALYSIS" } };
    const sim = simulateExecutedExpertOutputs(BM25_WEB_ONLY, q, packet);
    assert.equal(sim.executedKeys.includes("repo_audit_agent"), false);
    assert.equal(sim.selected.some((m) => m.expert.key === "repo_audit_agent"), true);
    assert.match(REPO_ANALYSIS_CONTRACT_ID, /REPO_ANALYSIS_V1/);
  });

  it("T5 — DOCUMENT / FILE_ANALYSIS / SQL inchangés, web JSON non exécuté", () => {
    const pdf = "analyse ce document Windows 7.pdf";
    assert.equal(isWebSearchExpertAuthorized(pdf), false);
    assert.deepEqual(
      simulateExecutedExpertOutputs(BM25_WEB_ONLY, pdf).webResearchStages,
      [],
    );

    const jsFiles = [{ originalname: "server-index-clean.js" }];
    const jsHit = classifyAttachmentTask("analyse le fichier", jsFiles);
    assert.equal(jsHit.task, ATTACHMENT_TASKS.DOC_ANALYZE);
    assert.equal(jsHit.outputContract, FILE_ANALYSIS_CONTRACT_ID);
    assert.equal(
      isWebSearchExpertAuthorized("analyse le fichier", {
        meta: { _attachment_refs: jsFiles },
      }),
      false,
    );

    const sqlFiles = [{ originalname: "dump.sql" }];
    const sqlHit = classifyAttachmentTask("analyse le fichier", sqlFiles);
    assert.equal(sqlHit.task, ATTACHMENT_TASKS.DOC_ANALYZE);
    assert.ok(
      sqlHit.outputContract === FILE_ANALYSIS_CONTRACT_ID ||
        sqlHit.outputContract === SQL_SOURCE_ANALYSIS_CONTRACT_ID,
    );
    assert.equal(
      isWebSearchExpertAuthorized("analyse le dump sql", {
        meta: { _attachment_refs: sqlFiles },
      }),
      false,
    );
  });

  it("T6 — analyse sans PJ → file_analysis_awaiting_source, pas web_research", async () => {
    const q = "j'aimerais que tu analyses un fichier es tu disponible ?";
    const awaiting = tryFileAnalysisAwaitingSource(q, { attachments: [] });
    assert.ok(awaiting);
    const hit = await runConversationShortCircuit(q);
    assert.ok(
      hit?.path === "file_analysis_awaiting_source" ||
        awaiting.pipelinePath === "file_analysis_awaiting_source" ||
        /disponible/i.test(awaiting.reply || hit?.reply || ""),
    );
    assert.equal(isWebSearchExpertAuthorized(q), false);
    const sim = simulateExecutedExpertOutputs(BM25_WEB_ONLY, q);
    assert.deepEqual(sim.webResearchStages, []);
  });

  it("T7 — demande mémoire → memory_consolidator NON_BRANCHÉ", () => {
    const q = "consolide la mémoire du vault et archive les souvenirs";
    assert.equal(isWebSearchExpertAuthorized(q), false);
    const sim = simulateExecutedExpertOutputs(BM25_WEB_ONLY, q);
    assert.equal(sim.executedKeys.includes("memory_consolidator"), false);
    const sovereign = fs.readFileSync(
      path.join(ROOT, "src/agent/orchestrator/SovereignOrchestrator.js"),
      "utf8",
    );
    const routing = fs.readFileSync(
      path.join(ROOT, "src/agent/stages/RoutingStage.js"),
      "utf8",
    );
    assert.equal(sovereign.includes("memory_consolidator"), false);
    assert.equal(routing.includes("memory_consolidator"), false);
    assert.equal(
      /if \(key === ["']memory_consolidator["']\)/.test(sovereign),
      false,
    );
  });

  it("T8 — pourquoi générique → BM25 web ignoré, pas web_research", () => {
    const q = "pourquoi le ciel est bleu";
    assert.equal(isExplicitWebSearchRequest(q), false);
    assert.equal(isWebSearchExpertAuthorized(q), false);
    const filtered = filterUnauthorizedWebExpertMatches(BM25_WEB_ONLY, q);
    assert.equal(
      filtered.some((m) => m.expert.key === WEB_SEARCH_EXPERT_KEY),
      false,
    );
    const sim = simulateExecutedExpertOutputs(BM25_WEB_ONLY, q);
    assert.deepEqual(sim.webResearchStages, []);
    assert.equal(sim.executedKeys.length, 0);
  });
});
