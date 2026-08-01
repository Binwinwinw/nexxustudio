import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  RESEARCH_THEN_SUMMARIZE_CANONICAL_QUERY,
  isResearchThenSummarizeRequest,
  extractResearchThenSummarizeTarget,
  deriveResearchThenSummarizeWebQuery,
  resolveResearchThenSummarizeIntentContractId,
} from "../src/agent/policies/researchThenSummarizePolicy.js";
import {
  resolveIntentContract,
  shouldSkipWebSearchForIntent,
} from "../src/agent/config/intentContractRegistry.js";
import {
  classifySummaryContract,
} from "../src/agent/policies/summary/index.js";
import {
  extractPastedSourceText,
  isDocumentSynthesisExcluded,
} from "../src/agent/policies/document/index.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import {
  understandQuery,
  buildRequestWorkup,
} from "../src/agent/policies/conversationQueryUnderstanding.js";

describe("researchThenSummarizePolicy", () => {
  it("détecte caveman GitHub + va te renseigner + résumé", () => {
    assert.equal(
      isResearchThenSummarizeRequest(RESEARCH_THEN_SUMMARIZE_CANONICAL_QUERY),
      true,
    );
    assert.equal(
      extractResearchThenSummarizeTarget(RESEARCH_THEN_SUMMARIZE_CANONICAL_QUERY),
      "caveman",
    );
    assert.match(
      deriveResearchThenSummarizeWebQuery(RESEARCH_THEN_SUMMARIZE_CANONICAL_QUERY),
      /github.*caveman/i,
    );
  });

  it("n'aspire pas un résumé de passage collé", () => {
    const pasted =
      "Résume ce passage :\n\nLa Révolution française commence en 1789. Les États généraux se réunissent.";
    assert.equal(isResearchThenSummarizeRequest(pasted), false);
  });

  it("n'aspire pas un résumé d'œuvre culturelle sans recherche", () => {
    assert.equal(
      isResearchThenSummarizeRequest(
        "pourrais-tu faire un résumé du film Interstellar ?",
      ),
      false,
    );
  });
});

describe("researchThenSummarize — anti faux pasted / G38", () => {
  it("apostrophe française ne crée pas de faux passage collé", () => {
    assert.equal(
      extractPastedSourceText(RESEARCH_THEN_SUMMARIZE_CANONICAL_QUERY),
      null,
    );
  });

  it("exclu de document_synthesis et de classifySummaryContract", () => {
    assert.equal(
      isDocumentSynthesisExcluded(RESEARCH_THEN_SUMMARIZE_CANONICAL_QUERY),
      true,
    );
    assert.equal(
      classifySummaryContract(RESEARCH_THEN_SUMMARIZE_CANONICAL_QUERY),
      null,
    );
  });
});

describe("researchThenSummarize — routage pipeline + cycle", () => {
  it("short-circuit → information_seeking_full_pipeline + web", async () => {
    const hit = await runConversationShortCircuit(
      RESEARCH_THEN_SUMMARIZE_CANONICAL_QUERY,
    );
    assert.equal(hit?.path, "information_seeking_full_pipeline");
    assert.equal(hit?.deferToFullPipeline, true);
    assert.equal(hit?.preferWebResearch, true);
    assert.equal(hit?.researchThenSummarize, true);
    assert.notEqual(hit?.path, "document_synthesis_llm");
    assert.ok(!hit?.reply);
  });

  it("cycle → info_seeking / web_lookup / evidence high", () => {
    const u = understandQuery(RESEARCH_THEN_SUMMARIZE_CANONICAL_QUERY);
    assert.equal(u.primaryDomain, "info_seeking");
    assert.equal(u.responseStrategy, "web_lookup");
    assert.notEqual(u.primaryDomain, "document_synthesis");

    const cycle = buildRequestWorkup(RESEARCH_THEN_SUMMARIZE_CANONICAL_QUERY, u);
    assert.equal(cycle.evidence_requirement.level, "high");
    assert.equal(cycle.retrieval_decision.sourceKind, "web");
    assert.equal(cycle.action_decision.capabilities.web, true);
    assert.match(cycle.retrieval_decision.webQuery || "", /caveman/i);
  });

  it("contrat intent → RESEARCH_THEN_SUMMARIZE (pas DESIGN_CREATE)", () => {
    const { contract, matchedBy } = resolveIntentContract(
      RESEARCH_THEN_SUMMARIZE_CANONICAL_QUERY,
      {},
    );
    assert.equal(contract.id, "RESEARCH_THEN_SUMMARIZE");
    assert.match(matchedBy, /isResearchThenSummarizeRequest/);
    assert.equal(
      shouldSkipWebSearchForIntent(RESEARCH_THEN_SUMMARIZE_CANONICAL_QUERY, {}),
      false,
    );
    assert.equal(
      resolveResearchThenSummarizeIntentContractId(null, RESEARCH_THEN_SUMMARIZE_CANONICAL_QUERY),
      "RESEARCH_THEN_SUMMARIZE",
    );
  });
});
