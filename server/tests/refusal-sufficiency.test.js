import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  evaluateEpistemicRefusal,
  INSUFFICIENT_SIGNAL_REFUSAL,
} from "../src/agent/config/modeResponseContracts.js";
import { evaluateRefusalSufficiency } from "../src/agent/micro/parsing/refusalSufficiencyEvaluator.js";
import { isExploitableProcedureIntent } from "../src/agent/utils/procedureIntentGuards.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import applyRagConfidenceGate from "../src/retrieval/ragResponseGate.js";

const FORGE_QUERY =
  "comment faire pour lancer un projet qui déclenche la forge";

describe("procedureIntentGuards", () => {
  it("détecte l'intention procédurale Forge/projet", () => {
    assert.equal(isExploitableProcedureIntent(FORGE_QUERY), true);
    assert.equal(
      isExploitableProcedureIntent("quel sera le cours de l action Apple demain"),
      false,
    );
  });

  it("détecte comment faire hors Forge mais dans le périmètre Studio", () => {
    assert.equal(
      isExploitableProcedureIntent(
        "comment faire pour analyser un document dans la session",
      ),
      true,
    );
    assert.equal(
      isExploitableProcedureIntent("comment faire des crêpes maison"),
      false,
    );
  });
});

describe("evaluateRefusalSufficiency", () => {
  it("answer_first pour procédure exploitable", () => {
    const out = evaluateRefusalSufficiency(FORGE_QUERY);
    assert.equal(out.branch, "answer_first");
    assert.ok(out.reply?.includes("Forge"));
    assert.match(out.reply, /cadrer/i);
  });

  it("refuse pour sujet fondamentalement hors périmètre", () => {
    const out = evaluateRefusalSufficiency(
      "prédire le résultat du match de foot de demain",
    );
    assert.equal(out.branch, "refuse");
  });
});

describe("evaluateEpistemicRefusal — minimal useful before refusal", () => {
  it("n refuse pas une procédure Forge sans contexte RAG", () => {
    const out = evaluateEpistemicRefusal({
      query: FORGE_QUERY,
      hasReliableContext: false,
    });
    assert.equal(out.shouldRefuse, false);
    assert.equal(out.reason, "minimal_useful_procedure_before_refusal");
  });

  it("refuse toujours les questions hors périmètre sans contexte", () => {
    const out = evaluateEpistemicRefusal({
      query: "prédire le résultat du match de foot de demain",
      hasReliableContext: false,
    });
    assert.equal(out.shouldRefuse, true);
    assert.equal(out.message, INSUFFICIENT_SIGNAL_REFUSAL);
  });
});

describe("intentShortCircuit — procedure_deterministic", () => {
  it("court-circuite avant refus avec réponse procédurale", async () => {
    const hit = await runConversationShortCircuit(FORGE_QUERY, {
      wantsAnalysis: false,
      history: [],
    });
    assert.ok(hit);
    assert.equal(hit.path, "procedure_deterministic");
    assert.ok(!hit.reply.includes(INSUFFICIENT_SIGNAL_REFUSAL));
    assert.match(hit.reply, /Forge/i);
  });
});

describe("applyRagConfidenceGate — procedure bypass", () => {
  it("proceed avec groundedHint si confiance reject mais intention procédurale", () => {
    const gate = applyRagConfidenceGate({
      query: FORGE_QUERY,
      confidence: { level: "reject", score: 0.2, reason: "low" },
      results: [],
    });
    assert.equal(gate.type, "proceed");
    assert.equal(gate.procedureFallback, true);
    assert.ok(gate.groundedHint?.includes("Forge"));
  });
});
