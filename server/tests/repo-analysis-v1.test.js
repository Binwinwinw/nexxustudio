import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isRepoAnalysisRequest,
  extractRepoTarget,
  deriveRepoAnalysisWebQuery,
} from "../src/agent/utils/repoAnalysisIntentGuards.js";
import {
  REPO_ANALYSIS_CANONICAL_LOCAL_QUERY,
  REPO_ANALYSIS_CANONICAL_GITHUB_QUERY,
  resolveRepoAnalysisShortCircuit,
} from "../src/agent/policies/repoAnalysisPolicy.js";
import {
  REPO_ANALYSIS_CONTRACT_ID,
  validateRepoAnalysisReport,
  getRepoAnalysisSystemPrompt,
} from "../src/agent/analysis/repoAnalysisContract.js";
import { resolveIntentContract } from "../src/agent/config/intentContractRegistry.js";
import { resolveDocumentSynthesisShortCircuit } from "../src/agent/policies/documentSynthesisPolicy.js";
import { isResearchThenSummarizeRequest } from "../src/agent/policies/researchThenSummarizePolicy.js";
import { isExistingSourceAnalysisRequest } from "../src/agent/utils/localFileUriIntentGuards.js";
import { evaluateJustIntent } from "../src/agent/policies/justIntentDetectionPolicy.js";
import { INTENT_DOMAINS } from "../../shared/justIntentCatalog.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";

describe("REPO_ANALYSIS_V1 — intent", () => {
  it("détecte analyse dépôt local projects/", () => {
    assert.equal(isRepoAnalysisRequest(REPO_ANALYSIS_CANONICAL_LOCAL_QUERY), true);
    const t = extractRepoTarget(REPO_ANALYSIS_CANONICAL_LOCAL_QUERY);
    assert.equal(t?.kind, "workspace_projects");
    assert.match(t?.localRelative || "", /projects\/demo-citadelle/);
  });

  it("détecte URL GitHub", () => {
    assert.equal(isRepoAnalysisRequest(REPO_ANALYSIS_CANONICAL_GITHUB_QUERY), true);
    const t = extractRepoTarget(REPO_ANALYSIS_CANONICAL_GITHUB_QUERY);
    assert.equal(t?.label, "JuliusBrussee/caveman");
    assert.match(deriveRepoAnalysisWebQuery(REPO_ANALYSIS_CANONICAL_GITHUB_QUERY), /github\.com/);
  });

  it("ne confond pas avec fichier seul", () => {
    const q =
      "analyse le fichier index.html qui est dans le dossier projects/demo-citadelle/";
    assert.equal(isExistingSourceAnalysisRequest(q), true);
    assert.equal(isRepoAnalysisRequest(q), false);
  });

  it("ne vole pas research-then-summarize", () => {
    const q =
      'j\'ai entendu parler d\'un dépôt github dont le nom est "caveman" vas te renseigner là dessus et fait moi un résumé consistant sur son utilité et sa conception';
    assert.equal(isResearchThenSummarizeRequest(q), true);
    assert.equal(isRepoAnalysisRequest(q), false);
  });
});

describe("REPO_ANALYSIS_V1 — routing", () => {
  it("contrat REPO_ANALYSIS (pas DOCUMENT_ANALYSIS)", () => {
    const { contract } = resolveIntentContract(REPO_ANALYSIS_CANONICAL_GITHUB_QUERY);
    assert.equal(contract.id, "REPO_ANALYSIS");
    assert.notEqual(contract.id, "DOCUMENT_ANALYSIS");
  });

  it("exclut document_synthesis_clarify", () => {
    assert.equal(
      resolveDocumentSynthesisShortCircuit(REPO_ANALYSIS_CANONICAL_LOCAL_QUERY),
      null,
    );
  });

  it("justIntent ANALYSIS + preempt repo", () => {
    const evaluation = evaluateJustIntent(REPO_ANALYSIS_CANONICAL_LOCAL_QUERY);
    assert.equal(evaluation.domain, INTENT_DOMAINS.ANALYSIS);
    assert.ok(evaluation.signals.includes("preempt:repo_analysis"));
  });

  it("short-circuit local déterministe review-grade", async () => {
    const hit = await runConversationShortCircuit(REPO_ANALYSIS_CANONICAL_LOCAL_QUERY);
    assert.equal(hit?.path, "repo_analysis_deterministic");
    assert.match(hit?.reply || "", /REPO_ANALYSIS_V1/);
    assert.match(hit?.reply || "", /Points forts/);
    assert.match(hit?.reply || "", /Problèmes \/ risques/);
    assert.match(hit?.reply || "", /Actions recommandées/);
    assert.doesNotMatch(hit?.reply || "", /colle le passage|PDF/i);
  });

  it("short-circuit GitHub → defer LLM + contrat", async () => {
    const hit = await runConversationShortCircuit(REPO_ANALYSIS_CANONICAL_GITHUB_QUERY);
    assert.equal(hit?.path, "repo_analysis_llm");
    assert.equal(hit?.deferToLlm, true);
    assert.equal(hit?.forcedIntentContractId, "REPO_ANALYSIS");
    assert.ok(hit?.webQueryOverride);
  });
});

describe("REPO_ANALYSIS_V1 — rapport local + deep sample", () => {
  it("rapport demo-citadelle passe les minima", () => {
    const hit = resolveRepoAnalysisShortCircuit(REPO_ANALYSIS_CANONICAL_LOCAL_QUERY);
    assert.equal(hit?.path, "repo_analysis_deterministic");
    const quality = hit?.repoTarget?.quality;
    assert.equal(quality?.ok, true, (quality?.failures || []).join(", "));
  });

  it("prompt système expose le rubric + findings code", () => {
    const prompt = getRepoAnalysisSystemPrompt();
    assert.match(prompt, new RegExp(REPO_ANALYSIS_CONTRACT_ID));
    assert.match(prompt, /Langages principaux/);
    assert.match(prompt, /Actions recommandées/);
    assert.match(prompt, /findings ancrés/);
  });

  it("demo-citadelle — findings code ancrés (html + js)", async () => {
    const hit = await runConversationShortCircuit(REPO_ANALYSIS_CANONICAL_LOCAL_QUERY);
    assert.equal(hit?.path, "repo_analysis_deterministic");
    assert.match(hit?.reply || "", /Findings code \(échantillon\)/);
    assert.match(hit?.reply || "", /SOURCE_FILE_ANALYSIS_V1/);
    assert.match(hit?.reply || "", /index\.html/);
    assert.match(hit?.reply || "", /app\.js/);
    assert.match(
      hit?.reply || "",
      /atelier|thème|hero|aria|accessib|Google Fonts|landing|skip/i,
    );

    const direct = resolveRepoAnalysisShortCircuit(REPO_ANALYSIS_CANONICAL_LOCAL_QUERY);
    const reportQuality = direct?.repoTarget?.quality;
    assert.equal(reportQuality?.ok, true, (reportQuality?.failures || []).join(", "));
  });

  it("selectDeepSampleFiles priorise index.html puis app.js", async () => {
    const { selectDeepSampleFiles } = await import(
      "../src/agent/analysis/repoDeepSample.js"
    );
    const picked = selectDeepSampleFiles([
      "style.css",
      "app.js",
      "index.html",
      "readme.md",
    ]);
    assert.deepEqual(picked, ["index.html", "app.js"]);
  });
});
