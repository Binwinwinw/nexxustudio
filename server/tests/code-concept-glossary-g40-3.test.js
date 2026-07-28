import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveCodeConceptGlossaryEntry,
  resolveCodeConceptGlossaryFallback,
} from "../src/agent/policies/codeConceptGlossaryPolicy.js";
import {
  buildCodeConceptExplainFallbackReply,
  CODE_CONCEPT_EXECUTION_PATHS,
} from "../src/agent/policies/codeConceptExplainExecutionPolicy.js";
import {
  composeMannerReply,
  detectPriorAssistantFailure,
  RESPONSE_MANNER_FAMILIES,
} from "../src/agent/policies/responseMannerPolicy.js";
import { CODE_CONCEPT_GLOSSARY_SOURCES } from "../src/agent/policies/codeConceptGlossaryPolicy.js";

const DIV_QUERY = "pourrais-tu faire un résumé du rôle de <div> en HTML?";
const IMPORT_QUERY =
  'pourrais-tu faire un résumé du rôle de "import" dans un fichier python ?';
const UNKNOWN_QUERY =
  "pourrais-tu faire un résumé du rôle de xyznonexistent en HTML?";

describe("G40.3 — glossaire concepts", () => {
  it("G40.3-T01 resolve div glossary", () => {
    const entry = resolveCodeConceptGlossaryEntry(DIV_QUERY);
    assert.equal(entry?.key, "html:div");
    assert.match(entry.shortDefinition, /conteneur générique/i);
  });

  it("G40.3-T02 resolve import glossary", () => {
    const entry = resolveCodeConceptGlossaryEntry(IMPORT_QUERY);
    assert.equal(entry?.key, "python:import");
    assert.match(entry.shortDefinition, /modules/i);
  });

  it("G40.3-T03 fallback div — contenu utile, pas échec sec", () => {
    const hit = resolveCodeConceptGlossaryFallback(DIV_QUERY);
    assert.equal(hit.conceptFallbackUsed, true);
    assert.equal(hit.source, CODE_CONCEPT_GLOSSARY_SOURCES.GLOSSARY);
    assert.equal(hit.conceptKey, "html:div");
    assert.match(hit.text, /conteneur|générique|HTML/i);
    assert.doesNotMatch(hit.text, /je n['']ai pas pu produire l'explication locale/i);
  });

  it("G40.3-T04 fallback import — contenu utile", () => {
    const hit = resolveCodeConceptGlossaryFallback(IMPORT_QUERY);
    assert.equal(hit.conceptKey, "python:import");
    assert.match(hit.text, /import|module/i);
  });

  it("G40.3-T05 concept inconnu — message repli doux", () => {
    const hit = buildCodeConceptExplainFallbackReply(UNKNOWN_QUERY);
    assert.equal(hit.conceptKey, null);
    assert.equal(hit.source, CODE_CONCEPT_GLOSSARY_SOURCES.FAILURE);
    assert.match(hit.text, /reformul|réessaie|bloque/i);
  });

  it("G40.3-T06 repair après échec assistant", () => {
    const history = [
      { role: "user", content: DIV_QUERY },
      {
        role: "assistant",
        content:
          "Je n'ai pas pu produire l'explication locale pour div dans ce tour.",
      },
    ];
    assert.equal(detectPriorAssistantFailure(history), true);
    const hit = buildCodeConceptExplainFallbackReply(DIV_QUERY, { history });
    assert.match(hit.text, /corrige|repren|fois d'avant|essentiel/i);
  });
});

describe("G41 — response manner", () => {
  it("G41-T01 variantes capability_overview", () => {
    const a = composeMannerReply({
      family: RESPONSE_MANNER_FAMILIES.CAPABILITY_OVERVIEW,
      salt: "a",
    });
    const b = composeMannerReply({
      family: RESPONSE_MANNER_FAMILIES.CAPABILITY_OVERVIEW,
      salt: "b",
    });
    assert.ok(a.length > 40);
    assert.ok(b.length > 40);
  });

  it("G41-T02 execution path glossary défini", () => {
    assert.equal(
      CODE_CONCEPT_EXECUTION_PATHS.GLOSSARY_FALLBACK,
      "code_concept_glossary_fallback",
    );
    assert.equal(
      CODE_CONCEPT_EXECUTION_PATHS.GLOSSARY_DIRECT,
      "code_concept_glossary_direct",
    );
  });
});

describe("G40.4 — glossary prioritaire", () => {
  it("G40.4-T01 short-circuit direct sans LLM", async () => {
    const { resolveCodeConceptExplainShortCircuit } = await import(
      "../src/agent/policies/codeConceptExplainExecutionPolicy.js"
    );
    const hit = resolveCodeConceptExplainShortCircuit(DIV_QUERY);
    assert.equal(hit?.path, "code_concept_glossary_direct");
    assert.equal(hit?.deferToLlm, false);
    assert.equal(hit?.glossaryDirect, true);
    assert.equal(hit?.conceptKey, "html:div");
    assert.match(hit?.reply || "", /conteneur|générique/i);
  });
});
