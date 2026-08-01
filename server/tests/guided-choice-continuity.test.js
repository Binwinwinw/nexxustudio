import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  parseOpenPromptMenuChoice,
  buildGuidedChoiceReply,
  resolveGuidedChoiceShortCircuit,
  GUIDED_CHOICE_PIPELINE_PATH,
} from "../src/agent/policies/guided/index.js";
import { resolveDeliverableContract, PROMISED_VALUES } from "../src/agent/policies/delivery/index.js";
import { resolveCodeConceptExplainShortCircuit } from "../src/agent/policies/codeConceptExplainExecutionPolicy.js";
import { isCodeConceptExplainRequest } from "../src/agent/policies/codeConceptExplainPolicy.js";

const PANEL_HISTORY = [
  {
    role: "user",
    content: "qu'est-ce qu'on pourrait faire aujourd'hui ?",
  },
  {
    role: "assistant",
    content:
      "Tu as le choix — on peut partir là-dessus :\n\n" +
      "1. discussion libre\n" +
      "2. brainstorm léger\n" +
      "3. recherche web sur un thème\n" +
      "4. petit livrable tech\n" +
      "5. apprendre un sujet\n\n" +
      "Choisis un numéro et on se lance",
  },
];

describe("guided_choice après open_prompt", () => {
  it("« 4 » → petit livrable tech (pas UX/UI React)", () => {
    const choice = parseOpenPromptMenuChoice("4");
    assert.equal(choice?.key, "livrable_tech");
    assert.equal(choice?.label, "petit livrable tech");
    const reply = buildGuidedChoiceReply(choice);
    assert.match(reply, /petit livrable tech/i);
    assert.doesNotMatch(reply, /UX\/UI|React|composant/i);
  });

  it("short-circuit déterministe pour « 4 » avec history panel", () => {
    const hit = resolveGuidedChoiceShortCircuit("4", { history: PANEL_HISTORY });
    assert.ok(hit);
    assert.equal(hit.path, GUIDED_CHOICE_PIPELINE_PATH);
    assert.equal(hit.choiceId, 4);
    assert.match(hit.reply, /langage/i);
    assert.doesNotMatch(hit.reply, /UX\/UI|React/i);
  });

  it("sans panel → pas de guided_choice", () => {
    const hit = resolveGuidedChoiceShortCircuit("4", { history: [] });
    assert.equal(hit, null);
  });

  it("contrat deliverable runtimeAligned=true", () => {
    const c = resolveDeliverableContract("4", { history: PANEL_HISTORY });
    assert.equal(c.promisedValue, PROMISED_VALUES.GUIDED_CHOICE);
    assert.equal(c.runtimeAligned, true);
  });

  it("mot « livrable » après panel → option 4", () => {
    const hit = resolveGuidedChoiceShortCircuit("livrable", {
      history: PANEL_HISTORY,
    });
    assert.equal(hit?.choiceKey, "livrable_tech");
  });
});

describe("code concept — fonction PHP", () => {
  const q =
    "pourrais tu expliquer et montrer un exemple de fonction en php en indiquant son rôle";

  it("détecte code_concept_explain (pas seulement technical_overview mort)", () => {
    assert.equal(isCodeConceptExplainRequest(q), true);
  });

  it("glossaire local php:function avec exemple", () => {
    const hit = resolveCodeConceptExplainShortCircuit(q);
    assert.ok(hit);
    assert.equal(hit.path, "code_concept_glossary_direct");
    assert.equal(hit.deferToLlm, false);
    assert.match(String(hit.reply), /function\s+additionner|fonction PHP/i);
    assert.match(String(hit.reply), /return/i);
  });
});
