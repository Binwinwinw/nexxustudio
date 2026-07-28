import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  PROMPT_FOR_ARTIFACT_CANONICAL_CREATE_QUERY,
  PROMPT_FOR_ARTIFACT_CANONICAL_LANDING_QUERY,
  PROMPT_FOR_ARTIFACT_CANONICAL_META_QUERY,
  buildPromptForArtifactReply,
  isPromptForArtifactSatisfiable,
  resolvePromptForArtifactShortCircuit,
} from "../src/agent/policies/promptForArtifactPolicy.js";
import {
  isPromptForArtifactRequest,
  parsePromptForArtifactTask,
} from "../src/agent/utils/promptForArtifactIntentGuards.js";
import { isHtmlProjectDeliverable } from "../src/agent/policies/htmlProjectDeliveryPolicy.js";
import {
  CLARIFICATION_DECISIONS,
  evaluateClarificationDecision,
} from "../src/agent/policies/clarificationDecisionPolicy.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { resolvePipelineFallback } from "../src/agent/utils/genericGreetingGuards.js";

describe("promptForArtifactPolicy — batterie #37", () => {
  it("landing page + concept créatif → prompt_for_artifact_deterministic", async () => {
    assert.equal(
      isPromptForArtifactRequest(PROMPT_FOR_ARTIFACT_CANONICAL_LANDING_QUERY),
      true,
    );
    assert.equal(
      isPromptForArtifactSatisfiable(PROMPT_FOR_ARTIFACT_CANONICAL_LANDING_QUERY),
      true,
    );

    const task = parsePromptForArtifactTask(PROMPT_FOR_ARTIFACT_CANONICAL_LANDING_QUERY);
    assert.equal(task?.artifactType, "landing_page");
    assert.match(task?.subject || "", /boisson energetique/i);

    const hit = await runConversationShortCircuit(
      PROMPT_FOR_ARTIFACT_CANONICAL_LANDING_QUERY,
    );
    assert.equal(hit?.path, "prompt_for_artifact_deterministic");
    assert.match(hit?.reply, /Prompt court/i);
    assert.match(hit?.reply, /Prompt détaillé/i);
    assert.match(hit?.reply, /landing page/i);
    assert.match(hit?.reply, /boisson energetique/i);
    assert.match(hit?.reply, /hero|CTA|bénéfices/i);
  });

  it("méta « c'est quoi un bon prompt » → pas ce patron", () => {
    assert.equal(
      isPromptForArtifactRequest(PROMPT_FOR_ARTIFACT_CANONICAL_META_QUERY),
      false,
    );
    assert.equal(
      resolvePromptForArtifactShortCircuit(PROMPT_FOR_ARTIFACT_CANONICAL_META_QUERY),
      null,
    );
  });

  it("crée une landing page → html_project, pas prompt_for_artifact", () => {
    assert.equal(
      isPromptForArtifactRequest(PROMPT_FOR_ARTIFACT_CANONICAL_CREATE_QUERY),
      false,
    );
    assert.equal(
      isHtmlProjectDeliverable(PROMPT_FOR_ARTIFACT_CANONICAL_CREATE_QUERY),
      true,
    );
    assert.equal(parsePromptForArtifactTask(PROMPT_FOR_ARTIFACT_CANONICAL_CREATE_QUERY), null);
  });

  it("clarification gate → can_answer_now + signal prompt_for_artifact", () => {
    const decision = evaluateClarificationDecision(
      PROMPT_FOR_ARTIFACT_CANONICAL_LANDING_QUERY,
      [],
    );
    assert.equal(decision.decision, CLARIFICATION_DECISIONS.CAN_ANSWER_NOW);
    assert.equal(decision.reason, "prompt_for_artifact_deterministic");
    assert.ok(decision.signals.includes("prompt_for_artifact"));
  });

  it("recovery empty_short_circuit → prompt structuré copiable", () => {
    const reply = resolvePipelineFallback({
      query: PROMPT_FOR_ARTIFACT_CANONICAL_LANDING_QUERY,
      history: [],
      reason: "empty_short_circuit_llm",
    });
    assert.match(reply, /Prompt court/i);
    assert.match(reply, /landing page/i);
  });

  it("buildPromptForArtifactReply — sections landing complètes", () => {
    const reply = buildPromptForArtifactReply(
      PROMPT_FOR_ARTIFACT_CANONICAL_LANDING_QUERY,
    );
    assert.match(reply, /directeur artistique|copywriter/i);
    assert.match(reply, /FAQ|preuve|CTA/i);
  });
});
