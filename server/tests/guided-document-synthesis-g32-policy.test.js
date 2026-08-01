import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { INTENT_CONTRACT_REGISTRY } from "../src/agent/config/intentContractRegistry.js";
import {
  buildDocumentSynthesisSlots,
  detectDocumentSynthesisIntent,
  getMissingDocumentSynthesisSlots,
  GUIDED_SYNTHESIS_STRATEGY,
} from "../src/agent/policies/document/index.js";
import {
  DOCUMENT_SYNTHESIS_CANONICAL_PASTED_QUERY,
  DOCUMENT_SYNTHESIS_CANONICAL_MISSING_SOURCE_QUERY,
} from "../src/agent/policies/document/index.js";
import {
  isGuidedDocumentSynthesisRequest,
  resolveGuidedDocumentSynthesisIntentContractId,
  resolveGuidedSynthesisExecutionLimits,
  buildDocumentSynthesisSlotTelemetry,
} from "../src/agent/policies/guidedDocumentSynthesisPolicy.js";
import {
  scoreSynthesisGroundedness,
  isGenericSynthesisReply,
  validateDocumentSynthesisReply,
} from "../src/agent/policies/document/index.js";
import { understandQuery } from "../src/agent/policies/conversationQueryUnderstanding.js";
import { resolveClarificationGate } from "../src/agent/policies/clarificationDecisionPolicy.js";
import { evaluateJustIntent } from "../src/agent/policies/justIntentDetectionPolicy.js";
import { resolveStrategyExecution } from "../src/agent/telemetry/strategyExecutionTelemetry.js";

const TEXT_ATTACHMENT = [{ originalname: "extrait.txt", mimetype: "text/plain" }];

describe("documentSynthesisCompositePolicy — G32.1/2 slots", () => {
  it("getMissingDocumentSynthesisSlots — source absente", () => {
    const missing = getMissingDocumentSynthesisSlots(
      DOCUMENT_SYNTHESIS_CANONICAL_MISSING_SOURCE_QUERY,
    );
    assert.deepEqual(missing, ["source"]);
  });

  it("getMissingDocumentSynthesisSlots — passage collé présent", () => {
    const missing = getMissingDocumentSynthesisSlots(
      DOCUMENT_SYNTHESIS_CANONICAL_PASTED_QUERY,
    );
    assert.deepEqual(missing, []);
  });

  it("detectDocumentSynthesisIntent — pièce jointe → guided_synthesis", () => {
    const intent = detectDocumentSynthesisIntent(
      "Résume ce document joint",
      { attachments: TEXT_ATTACHMENT },
    );
    assert.equal(intent?.path, "document_synthesis_guided");
    assert.equal(intent?.strategy, GUIDED_SYNTHESIS_STRATEGY);
    assert.equal(intent?.task?.slots?.source, "attachment");
    assert.deepEqual(intent?.task?.missingSlots, []);
  });

  it("detectDocumentSynthesisIntent — shell sans source → partial_clarify", () => {
    const intent = detectDocumentSynthesisIntent("Résume ce texte");
    assert.equal(intent?.path, "document_synthesis_clarify");
    assert.equal(intent?.strategy, "partial_clarify");
    assert.deepEqual(intent?.task?.missingSlots, ["source"]);
  });
});

describe("guidedDocumentSynthesisPolicy — G32.3 contrat", () => {
  it("understandQuery — attachment → guided_synthesis + contrat", () => {
    const u = understandQuery("Résume ce document joint", [], {
      attachments: TEXT_ATTACHMENT,
    });
    assert.equal(u.primaryDomain, "document_synthesis");
    assert.equal(u.responseStrategy, "guided_synthesis");
    assert.equal(
      resolveGuidedDocumentSynthesisIntentContractId(u),
      "GUIDED_DOCUMENT_SYNTHESIS",
    );
  });

  it("isGuidedDocumentSynthesisRequest — via packet meta", () => {
    const u = understandQuery("Résume ce document joint", [], {
      attachments: TEXT_ATTACHMENT,
    });
    const packet = {
      meta: {
        query_understanding: {
          primaryDomain: u.primaryDomain,
          responseStrategy: u.responseStrategy,
        },
      },
    };
    assert.equal(
      isGuidedDocumentSynthesisRequest("Résume ce document joint", packet),
      true,
    );
  });

  it("resolveGuidedSynthesisExecutionLimits — température basse, tokens bornés", () => {
    const contract = INTENT_CONTRACT_REGISTRY.find(
      (item) => item.id === "GUIDED_DOCUMENT_SYNTHESIS",
    );
    const limits = resolveGuidedSynthesisExecutionLimits(contract, { length: "short" });
    assert.equal(limits.temperature, 0.2);
    assert.equal(limits.maxTokens, 400);
  });

  it("buildDocumentSynthesisSlotTelemetry — required + missing", () => {
    const u = understandQuery("Résume ce texte");
    const telemetry = buildDocumentSynthesisSlotTelemetry(u);
    assert.ok(telemetry);
    assert.deepEqual(telemetry.required_slots, ["source"]);
    assert.deepEqual(telemetry.missing_slots, ["source"]);
    assert.match(telemetry.policy_match_reason, /document_synthesis/);
  });
});

describe("documentSynthesisValidator — G32.4 groundedness", () => {
  it("isGenericSynthesisReply — détecte template vague", () => {
    assert.equal(
      isGenericSynthesisReply(
        "Ce document parle de l'importance de la Seconde Guerre mondiale.",
      ),
      true,
    );
  });

  it("scoreSynthesisGroundedness — tokens source retrouvés", () => {
    const source =
      "La Révolution française commence en 1789. La prise de la Bastille marque un tournant.";
    const reply =
      "La Révolution française débute en 1789 ; la prise de la Bastille est un tournant décisif.";
    const score = scoreSynthesisGroundedness(reply, source);
    assert.ok(score.anchored >= score.required);
  });

  it("validateDocumentSynthesisReply — issue si ancrage insuffisant", () => {
    const source = "La Révolution française commence en 1789 à Versailles.";
    const result = validateDocumentSynthesisReply(
      "En résumé, ce passage évoque des événements historiques importants en Europe.",
      { sourceText: source },
    );
    assert.equal(result.valid, false);
    assert.ok(result.issues.length > 0);
    assert.match(result.sanitized, /passage source|texte fourni/i);
  });
});

describe("guidedDocumentSynthesisPolicy — G32 intégration gate", () => {
  it("resolveClarificationGate — NEEDS_CLARIFICATION si source absente", () => {
    const ji = evaluateJustIntent("Résume ce texte");
    const gate = resolveClarificationGate("Résume ce texte", { justIntent: ji });
    assert.equal(gate.shouldClarify, true);
    assert.equal(gate.decision.reason, "summary_missing_source");
    assert.match(gate.message, /passage|document/i);
  });

  it("resolveStrategyExecution — override document_synthesis visible", () => {
    const u = understandQuery("Résume ce texte");
    const ji = evaluateJustIntent("Résume ce texte");
    const gate = resolveClarificationGate("Résume ce texte", { justIntent: ji });
    const exec = resolveStrategyExecution({
      justIntent: ji,
      clarificationGate: gate,
      queryUnderstanding: u,
    });
    assert.equal(exec.strategy_effective, "partial_clarify");
    assert.equal(exec.strategy_override_reason, "summary_missing_source");
  });
});
