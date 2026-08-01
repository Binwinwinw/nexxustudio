import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DOCUMENT_SYNTHESIS_CANONICAL_COMMENTARY_QUERY,
  DOCUMENT_SYNTHESIS_CANONICAL_MISSING_SOURCE_QUERY,
  DOCUMENT_SYNTHESIS_CANONICAL_PASTED_QUERY,
  DOCUMENT_SYNTHESIS_KINDS,
  buildDocumentSynthesisReply,
  buildMissingSourceClarifyReply,
  extractPastedSourceText,
  isDocumentSynthesisFollowUp,
  isDocumentSynthesisSatisfiable,
  resolveDocumentSynthesisContext,
  resolveDocumentSynthesisShortCircuit,
} from "../src/agent/policies/document/index.js";
import {
  CLARIFICATION_DECISIONS,
  evaluateClarificationDecision,
} from "../src/agent/policies/clarificationDecisionPolicy.js";
import { evaluateJustIntent } from "../src/agent/policies/justIntentDetectionPolicy.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { resolveDocumentContinuity } from "../src/agent/micro/continuity/documentContinuityContext.js";
import { isDocumentFollowUpIntent } from "../src/agent/micro/continuity/documentFollowUpGuards.js";
import { resolvePipelineFallback } from "../src/agent/utils/genericGreetingGuards.js";
import { INSUFFICIENT_SIGNAL_REFUSAL } from "../src/agent/config/modeResponseContracts.js";

const PDF_ANALYSIS_HISTORY = [
  { role: "user", content: "Analyse ce PDF joint" },
  {
    role: "assistant",
    content:
      "## Type de fichier\nPDF\n\n## Points clés\n- Accessibilité seniors\n- Commande vocale\n- Mode document",
  },
];

describe("documentSynthesisPolicy — batterie #33", () => {
  it("extrait le passage collé après shell synthèse", () => {
    const source = extractPastedSourceText(DOCUMENT_SYNTHESIS_CANONICAL_PASTED_QUERY);
    assert.ok(source);
    assert.match(source, /Révolution française/i);
    assert.match(source, /Bastille/i);
  });

  it("passage collé + résume → synthèse ancrée sans clarification générique", async () => {
    const hit = await runConversationShortCircuit(
      DOCUMENT_SYNTHESIS_CANONICAL_PASTED_QUERY,
    );
    assert.equal(hit?.path, "document_synthesis_deterministic");
    assert.match(hit?.reply, /Synthèse du passage/i);
    assert.match(hit?.reply, /1789|Bastille|Versailles/i);
    assert.doesNotMatch(hit?.reply, /Je vois la piste/i);
    assert.notEqual(hit?.reply, INSUFFICIENT_SIGNAL_REFUSAL);
  });

  it("extrait court + commente → lecture + suffixe angle", async () => {
    const hit = await runConversationShortCircuit(
      DOCUMENT_SYNTHESIS_CANONICAL_COMMENTARY_QUERY,
    );
    assert.equal(hit?.path, "document_synthesis_deterministic");
    assert.match(hit?.reply, /Lecture du passage/i);
    assert.match(hit?.reply, /lucioles/i);
    assert.match(hit?.reply, /style.*thème.*argument/i);
    assert.doesNotMatch(hit?.reply, /géographie|histoire/i);
  });

  it("résume sans texte → clarification ciblée documentaire", async () => {
    const hit = await runConversationShortCircuit(
      DOCUMENT_SYNTHESIS_CANONICAL_MISSING_SOURCE_QUERY,
    );
    assert.equal(hit?.path, "document_synthesis_clarify");
    assert.match(hit?.reply, /colle.*passage|joins le document/i);
    assert.doesNotMatch(hit?.reply, /géographie|histoire/i);
    assert.doesNotMatch(hit?.reply, /Je vois la piste/i);
  });

  it("clarification gate → can_answer_now pour source présente", () => {
    const decision = evaluateClarificationDecision(
      DOCUMENT_SYNTHESIS_CANONICAL_PASTED_QUERY,
      evaluateJustIntent(DOCUMENT_SYNTHESIS_CANONICAL_PASTED_QUERY),
    );
    assert.equal(decision.decision, CLARIFICATION_DECISIONS.CAN_ANSWER_NOW);
    assert.ok(decision.signals.includes("document_synthesis"));
  });
});

describe("documentSynthesisPolicy — follow-up documentaire (#33)", () => {
  it("détecte follow-up synthèse plus courte", () => {
    const q = "fais une synthèse plus courte de ce document";
    assert.equal(isDocumentSynthesisFollowUp(q), true);
    assert.equal(isDocumentFollowUpIntent(q), true);
  });

  it("briefing actif → defer continuité (pas nouvelle synthèse mono-doc)", () => {
    const q = "fais une synthèse plus courte de ce document";
    const ctx = resolveDocumentSynthesisContext(q, PDF_ANALYSIS_HISTORY);
    assert.equal(ctx?.intent_kind, DOCUMENT_SYNTHESIS_KINDS.FOLLOWUP);
    assert.equal(ctx?.deferToDocumentContinuity, true);
    assert.equal(resolveDocumentSynthesisShortCircuit(q, PDF_ANALYSIS_HISTORY), null);
  });

  it("resolveDocumentContinuity active le follow-up sans ré-ingestion", () => {
    const continuity = resolveDocumentContinuity({
      query: "fais une synthèse plus courte de ce document",
      history: PDF_ANALYSIS_HISTORY,
      attachedFiles: [],
    });
    assert.equal(continuity.shouldRunFollowUp, true);
    assert.ok(continuity.documentBriefing);
  });
});

describe("documentSynthesisPolicy — fallback discret", () => {
  it("pipeline fallback shell sans source — pas géographie", () => {
    const fallback = resolvePipelineFallback({
      query: DOCUMENT_SYNTHESIS_CANONICAL_MISSING_SOURCE_QUERY,
      rawResponse: "",
      reason: "empty_short_circuit_llm",
    });
    assert.match(fallback, /colle|document/i);
    assert.doesNotMatch(fallback, /géographie|histoire/i);
  });

  it("buildDocumentSynthesisReply — bullets 3+ sur texte long", () => {
    const ctx = resolveDocumentSynthesisContext(
      DOCUMENT_SYNTHESIS_CANONICAL_PASTED_QUERY,
    );
    const reply = buildDocumentSynthesisReply(ctx);
    assert.ok(reply);
    const bullets = reply.split("\n").filter((l) => l.startsWith("- "));
    assert.ok(bullets.length >= 3);
  });

  it("buildMissingSourceClarifyReply — ciblé matière textuelle", () => {
    const msg = buildMissingSourceClarifyReply();
    assert.match(msg, /passage|document/i);
    assert.doesNotMatch(msg, /objectif en une phrase/i);
  });
});

describe("simpleFastPath — WEB_SUMMARY delivery", () => {
  it("sortie LLM vide + documentSynthesis → pas de refus « piste »", async () => {
    const { applySimpleFastDeliveryPipeline } = await import(
      "../src/agent/paths/simpleFastPath.js"
    );
    const query =
      "fait un résumé ordonné de la page suivante : https://example.com/article";
    const delivery = await applySimpleFastDeliveryPipeline({
      query,
      rawResult: "",
      documentSynthesis: true,
      fallbackReason: "empty_short_circuit_llm",
    });
    assert.notEqual(delivery.text, INSUFFICIENT_SIGNAL_REFUSAL);
    assert.doesNotMatch(delivery.text || "", /Je vois la piste/i);
  });

  it("refus LLM verbatim + documentSynthesis → filtré, pas renvoyé tel quel", async () => {
    const { applySimpleFastDeliveryPipeline } = await import(
      "../src/agent/paths/simpleFastPath.js"
    );
    const query =
      "résume cette page https://example.com/article en points ordonnés";
    const delivery = await applySimpleFastDeliveryPipeline({
      query,
      rawResult: INSUFFICIENT_SIGNAL_REFUSAL,
      documentSynthesis: true,
      fallbackReason: "empty_short_circuit_llm",
    });
    assert.notEqual(delivery.text, INSUFFICIENT_SIGNAL_REFUSAL);
    assert.doesNotMatch(delivery.text || "", /pas encore la destination/i);
  });
});
