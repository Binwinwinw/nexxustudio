import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSystemPrompt } from "../src/agent/prompts/systemPromptBuilder.js";
import { getComposerSystemPrompt } from "../src/agent/config/modeResponseContracts.js";
import {
  isCodeReviewRequest,
  buildCodeReviewAddon,
  CODE_REVIEW_CONTRACT_ID,
} from "../src/agent/policies/codeReviewPolicy.js";
import {
  evaluateCodeReviewSentinels,
  mustLeadWithBlockingErrors,
  mustNotIntroduceTyposInFix,
  mustNotUseGenericFluff,
} from "../src/agent/policies/codeReviewSentinels.js";
import { shouldBypassSimpleFast } from "../src/agent/config/intentContractRegistry.js";
import {
  CODE_REVIEW_PRODUCTION_BUG_QUERIES,
  NEXXUS_FAILED_REVIEW_SAMPLES,
} from "./fixtures/codeReviewGoldenQueries.js";

describe("codeReviewPolicy", () => {
  for (const scenario of CODE_REVIEW_PRODUCTION_BUG_QUERIES) {
    it(`[${scenario.id}] détecte une demande de revue`, () => {
      assert.equal(isCodeReviewRequest(scenario.query), true);
    });

    it(`[${scenario.id}] injecte le modificateur REVUE DE CODE`, () => {
      const addon = buildCodeReviewAddon(scenario.query);
      assert.match(addon, /REVUE DE CODE/);
      assert.match(addon, new RegExp(CODE_REVIEW_CONTRACT_ID));
      assert.ok(
        scenario.promptMustInclude.every((p) =>
          addon.toLowerCase().includes(String(p).toLowerCase()),
        ),
      );
    });

    it(`[${scenario.id}] propage le modificateur dans buildSystemPrompt`, () => {
      const prompt = buildSystemPrompt(
        [],
        false,
        { phase: "DISCOVERY", score: 0 },
        "BALANCED",
        "",
        {},
        true,
        false,
        null,
        "NORMAL",
        false,
        null,
        scenario.query,
      );
      assert.match(prompt, /\[MODIFICATEUR: REVUE DE CODE/);
      assert.match(prompt, /\[SECTION: SOUVERAINETÉ & SÉCURITÉ\]/);
    });

    it(`[${scenario.id}] golden passe les sentinelles de revue`, () => {
      const evaluation = evaluateCodeReviewSentinels(scenario.goldenResponse, scenario);
      assert.equal(evaluation.pass, true, JSON.stringify(evaluation.failures));
    });
  }

  it("n'active pas la revue sur une simple salutation", () => {
    assert.equal(isCodeReviewRequest("Bonjour"), false);
  });
});

describe("codeReviewSentinels — échantillons Nexxus défaillants", () => {
  const scenario = CODE_REVIEW_PRODUCTION_BUG_QUERIES[0];

  it("rejette le tour 1 (résumé sans erreurs bloquantes)", () => {
    const evaluation = evaluateCodeReviewSentinels(
      NEXXUS_FAILED_REVIEW_SAMPLES.tour1_resume_sans_erreurs,
      scenario,
    );
    assert.equal(evaluation.pass, false);
    assert.ok(
      evaluation.failures.some((f) => f.id === "mustFlagCriticalIssues"),
    );
    assert.ok(
      evaluation.failures.some((f) => f.id === "mustLeadWithBlockingErrors"),
    );
  });

  it("rejette le tour borderline (__name__ mentionné mais résumé fonctionnel en tête)", () => {
    const evaluation = evaluateCodeReviewSentinels(
      NEXXUS_FAILED_REVIEW_SAMPLES.tour1_borderline_name_only,
      scenario,
    );
    assert.equal(evaluation.pass, false);
    assert.ok(
      evaluation.failures.some((f) => f.id === "mustLeadWithBlockingErrors"),
      JSON.stringify(evaluation.failures),
    );
    assert.ok(
      evaluation.failures.some((f) => f.id === "mustFlagCriticalIssues"),
    );
  });

  it("bypass SIMPLE_FAST pour une demande de revue de code", () => {
    assert.equal(shouldBypassSimpleFast(scenario.query, {}, {}), true);
  });

  it("rejette le tour 2 (typo choi + fluff responsive)", () => {
    assert.equal(mustNotIntroduceTyposInFix(NEXXUS_FAILED_REVIEW_SAMPLES.tour2_avec_typo_choi).pass, false);
    assert.equal(mustNotUseGenericFluff(NEXXUS_FAILED_REVIEW_SAMPLES.tour2_avec_typo_choi).pass, false);
  });

  it("golden composer inclut le modificateur", () => {
    const prompt = getComposerSystemPrompt({
      user_query: scenario.query,
      risk_level: "low",
    });
    assert.match(prompt, /REVUE DE CODE/);
  });
});
