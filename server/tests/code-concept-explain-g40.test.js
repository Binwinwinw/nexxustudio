import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isCodeConceptExplainRequest,
  suppressesCulturalSummaryForConceptExplain,
  suppressesCodeGenerationForConceptExplain,
} from "../src/agent/policies/codeConceptExplainPolicy.js";
import { isCulturalContentSummaryRequest } from "../src/agent/policies/summary/index.js";
import { classifySummaryContract, SUMMARY_INTENTS } from "../src/agent/policies/summary/index.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { isCodeGenerationRequest } from "../src/agent/policies/codeDeliveryPolicy.js";
import { classifyCodeIntent } from "../src/agent/policies/codeIntentPolicy.js";
import { triageUserIntent } from "../src/agent/classifiers/intentTriageClassifier.js";
import { resolveIntentContract } from "../src/agent/config/intentContractRegistry.js";
import { evaluateJustIntent } from "../src/agent/policies/justIntentDetectionPolicy.js";
import { evaluateClarificationDecision } from "../src/agent/policies/clarificationDecisionPolicy.js";
import { isHtmlProjectDeliverable } from "../src/agent/policies/htmlProjectDeliveryPolicy.js";
import { buildCodeConceptExplainFallbackReply } from "../src/agent/policies/codeConceptExplainExecutionPolicy.js";
import { resolveSimpleFastAllowRefusal } from "../src/agent/paths/simpleFastPath.js";
import { INSUFFICIENT_SIGNAL_REFUSAL } from "../src/agent/config/modeResponseContracts.js";

const IMPORT_QUERY =
  'pourrais-tu faire un résumé du rôle de "import" dans un fichier python ?';

const DIV_QUERY = "pourrais-tu faire un résumé du rôle de <div> en HTML?";

const INTERSTELLAR_QUERY =
  "pourrais-tu faire un résumé du film Interstellar ?";

const GENERATE_PYTHON_QUERY =
  "écris un script python complet qui lit un fichier csv et affiche les 10 premières lignes";

const SPEC_MINI_SPEC_QUERY =
  "dans le langage de développement qu'est ce qu'une spec qu'est ce qu'un mini-spec ??";

/** @type {Array<{ id: string, query: string, conceptExplain: boolean }>} */
const CONCEPT_EXPLAIN_BATTERY = [
  { id: "G40-T01", query: IMPORT_QUERY, conceptExplain: true },
  { id: "G40-T02", query: DIV_QUERY, conceptExplain: true },
  {
    id: "G40-T03",
    query: "à quoi sert async/await en JavaScript ?",
    conceptExplain: true,
  },
  {
    id: "G40-T04",
    query: "explique la différence entre let et var en JS",
    conceptExplain: true,
  },
  { id: "G40-T05", query: INTERSTELLAR_QUERY, conceptExplain: false },
  { id: "G40-T06", query: GENERATE_PYTHON_QUERY, conceptExplain: false },
  { id: "G40-T07", query: SPEC_MINI_SPEC_QUERY, conceptExplain: true },
  {
    id: "G40-T08",
    query: "c'est quoi une mini-spec en développement ?",
    conceptExplain: true,
  },
];

describe("G40 — code concept explain detection", () => {
  for (const row of CONCEPT_EXPLAIN_BATTERY) {
    it(`${row.id} isCodeConceptExplainRequest`, () => {
      assert.equal(isCodeConceptExplainRequest(row.query), row.conceptExplain);
    });
  }
});

describe("G40 — suppressions de sur-routage", () => {
  it("import Python — pas cultural_content_summary", async () => {
    assert.equal(suppressesCulturalSummaryForConceptExplain(IMPORT_QUERY), true);
    assert.equal(isCulturalContentSummaryRequest(IMPORT_QUERY), false);
    const contract = classifySummaryContract(IMPORT_QUERY);
    assert.notEqual(contract?.intent, SUMMARY_INTENTS.KNOWN_ENTITY);
    const hit = await runConversationShortCircuit(IMPORT_QUERY);
    assert.notEqual(hit?.path, "cultural_content_summary");
  });

  it("import Python — pas CODE_DELIVERY_V1", () => {
    assert.equal(suppressesCodeGenerationForConceptExplain(IMPORT_QUERY), true);
    assert.equal(isCodeGenerationRequest(IMPORT_QUERY), false);
    const { contract } = resolveIntentContract(IMPORT_QUERY, {});
    assert.notEqual(contract.id, "CODE_DELIVERY_V1");
  });

  it("import Python — triage code_explain", () => {
    const triage = triageUserIntent(IMPORT_QUERY);
    assert.equal(triage.top_intent, "code_explain");
    assert.ok(triage.signals.includes("code_concept_explain_g40"));
    assert.equal(classifyCodeIntent(IMPORT_QUERY)?.kind, "code_explain");
  });

  it("div HTML — pas summary ni guided_creation ni clarification document", async () => {
    assert.equal(isCodeConceptExplainRequest(DIV_QUERY), true);
    assert.equal(isCulturalContentSummaryRequest(DIV_QUERY), false);
    assert.equal(classifySummaryContract(DIV_QUERY), null);
    const ji = evaluateJustIntent(DIV_QUERY);
    assert.equal(ji.domain, "code");
    assert.notEqual(ji.domain, "web_html");
    const clar = evaluateClarificationDecision(DIV_QUERY);
    assert.equal(clar.decision, "can_answer_now");
    const hit = await runConversationShortCircuit(DIV_QUERY);
    assert.equal(hit?.path, "code_concept_glossary_direct");
    assert.equal(hit?.glossaryDirect, true);
  });

  it("div HTML — short-circuit glossary direct G40.4", async () => {
    const hit = await runConversationShortCircuit(DIV_QUERY);
    assert.equal(hit?.path, "code_concept_glossary_direct");
    assert.equal(hit?.glossaryDirect, true);
    assert.equal(hit?.deferToLlm, false);
    assert.match(hit?.reply || "", /conteneur|générique|div/i);
    assert.doesNotMatch(
      hit?.reply || "",
      /pas de version détaillée|je n['']ai pas pu/i,
    );
  });

  it("import Python — short-circuit glossary direct G40.4", async () => {
    const hit = await runConversationShortCircuit(IMPORT_QUERY);
    assert.equal(hit?.path, "code_concept_glossary_direct");
    assert.equal(hit?.glossaryDirect, true);
    assert.match(hit?.reply || "", /import|module/i);
  });

  it("G40.3 — fallback glossaire import et div", () => {
    const divFb = buildCodeConceptExplainFallbackReply(DIV_QUERY);
    const importFb = buildCodeConceptExplainFallbackReply(IMPORT_QUERY);
    assert.equal(divFb.conceptKey, "html:div");
    assert.equal(importFb.conceptKey, "python:import");
    assert.match(divFb.text, /conteneur|div/i);
    assert.match(importFb.text, /import|module/i);
  });

  it("Interstellar — reste known_entity summary", () => {
    assert.equal(isCodeConceptExplainRequest(INTERSTELLAR_QUERY), false);
    assert.equal(isCulturalContentSummaryRequest(INTERSTELLAR_QUERY), true);
    assert.equal(
      classifySummaryContract(INTERSTELLAR_QUERY)?.intent,
      SUMMARY_INTENTS.KNOWN_ENTITY,
    );
  });

  it("spec + mini-spec — glossary dual pédagogique, pas refus piste/destination", async () => {
    assert.equal(isCodeConceptExplainRequest(SPEC_MINI_SPEC_QUERY), true);
    assert.equal(
      resolveSimpleFastAllowRefusal({ query: SPEC_MINI_SPEC_QUERY }),
      false,
    );
    const hit = await runConversationShortCircuit(SPEC_MINI_SPEC_QUERY);
    assert.equal(hit?.path, "code_concept_glossary_direct");
    assert.equal(hit?.conceptKey, "process:spec+mini_spec");
    assert.equal(hit?.deferToLlm, false);
    assert.match(hit?.reply || "", /document qui explique|ce qu['']on veut construire/i);
    assert.match(hit?.reply || "", /version courte|mini-spec/i);
    assert.match(hit?.reply || "", /Exemple/i);
    assert.doesNotMatch(hit?.reply || "", /piste|destination/i);
    assert.notEqual(hit?.reply, INSUFFICIENT_SIGNAL_REFUSAL);
  });
});
