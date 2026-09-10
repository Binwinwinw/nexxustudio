import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { isCodeConceptExplainRequest } from "../src/agent/policies/code/codeConceptExplainPolicy.js";
import { resolveCodeConceptExplainShortCircuit } from "../src/agent/policies/code/codeConceptExplainExecutionPolicy.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { isTranslationRequestReady } from "../src/agent/utils/intent-guards/translationIntentGuards.js";
import {
  resolveOutputLanguagePolicy,
  enforceOutputLanguage,
  applyTranslationPathLanguagePolicy,
} from "../src/agent/policies/posture/outputLanguagePolicy.js";

const TRANSLATION_PYTHON_QUERY =
  "je veux faire une traduction en français de ce qui suit : " +
  "A harness is everything around that loop. See Tools for tool definition, context access. " +
  "Pass any Python callable. from langchain.agents import create_agent\n" +
  "class Answer:\n  def search(query): return query\n";

const FRENCH_TRANSLATION_REPLY =
  "Un harnais (harness) est tout ce qui entoure cette boucle : le prompt, les outils et le middleware. " +
  "En pratique, c'est le cadre qui lance et borne les appels.";

describe("TRANSLATION_PREEMPTS_CODE_CONCEPT_GLOSSARY_V1", () => {
  it("traduction + snippet Python : ready, glossaire SC stand-down", () => {
    assert.equal(isTranslationRequestReady(TRANSLATION_PYTHON_QUERY), true);
    assert.equal(
      resolveCodeConceptExplainShortCircuit(TRANSLATION_PYTHON_QUERY),
      null,
    );
  });

  it("atteint translation_pipeline, pas code_concept_glossary_direct", async () => {
    const hit = await runConversationShortCircuit(TRANSLATION_PYTHON_QUERY);
    assert.equal(hit?.path, "translation_pipeline");
    assert.notEqual(hit?.path, "code_concept_glossary_direct");
    assert.equal(hit?.preferWebResearch, false);
  });

  it("dump EN : outputLanguage = fr (cible), gate ne jette pas la traduction FR", () => {
    const policy = resolveOutputLanguagePolicy(TRANSLATION_PYTHON_QUERY);
    assert.equal(policy.outputLanguage, "fr");
    assert.equal(policy.explicitOverride, true);

    const gatedDumpWouldHaveBeenEn = resolveOutputLanguagePolicy(
      Array.from({ length: 20 }, () =>
        "The agent and the planner and the worker share the same runtime with tools.",
      ).join(" "),
    );
    assert.equal(gatedDumpWouldHaveBeenEn.outputLanguage, "en");
    assert.equal(policy.outputLanguage, "fr");

    const forPath = applyTranslationPathLanguagePolicy(
      { outputLanguage: "en", explicitOverride: false },
      TRANSLATION_PYTHON_QUERY,
      "translation_pipeline",
    );
    assert.equal(forPath.outputLanguage, "fr");

    const gated = enforceOutputLanguage(FRENCH_TRANSLATION_REPLY, forPath, {
      pipelinePath: "translation_pipeline",
    });
    assert.equal(gated.blocked, false);
    assert.doesNotMatch(
      gated.text,
      /pas pu garder cette réponse dans ta langue|couldn't keep this answer in your language/i,
    );
    assert.match(gated.text, /harnais/i);
  });

  it("G40 import python hors traduction reste glossaire", async () => {
    const q =
      'pourrais-tu faire un résumé du rôle de "import" dans un fichier python ?';
    assert.equal(isCodeConceptExplainRequest(q), true);
    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "code_concept_glossary_direct");
  });
});
