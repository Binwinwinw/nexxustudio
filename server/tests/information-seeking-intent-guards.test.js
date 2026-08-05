import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isInformationSeekingShell,
  isInformationSeekingWithTarget,
  extractInformationSeekingTarget,
  shouldEscalateSimpleFactualToFullPipeline,
  buildInformationSeekingWebQuery,
  isInformationSeekingRecoveryResponse,
} from "../src/agent/utils/informationSeekingIntentGuards.js";
import { isSimpleFactualQuestion } from "../src/agent/policies/intent/justIntentDetectionPolicy.js";
import { evaluateJustIntent } from "../src/agent/policies/intent/justIntentDetectionPolicy.js";
import { resolveClarificationGate } from "../src/agent/policies/routing/clarificationDecisionPolicy.js";
import { analyzeRequestIntentFrame } from "../src/agent/policies/intent/requestIntentFrame.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { EXECUTION_STRATEGIES } from "../../shared/justIntentCatalog.js";

describe("informationSeekingIntentGuards", () => {
  it("détecte shell + cible Teams 365", () => {
    const q = "je cherche des informations sur teams 365";
    assert.equal(isInformationSeekingShell(q), true);
    assert.equal(isInformationSeekingWithTarget(q), true);
    assert.match(extractInformationSeekingTarget(q), /teams 365/i);
  });

  it("shell sans cible — pas withTarget", () => {
    assert.equal(isInformationSeekingShell("je cherche des infos"), true);
    assert.equal(isInformationSeekingWithTarget("je cherche des infos"), false);
  });

  it("salut + infos ciblées — composite, pas socialOnly, pas social_deterministic", async () => {
    const q = "salut je cherche des infos sur teams 365";
    const frame = analyzeRequestIntentFrame(q);
    assert.equal(frame.conversation.socialOnly, false);
    assert.equal(frame.composite, true);
    assert.equal(frame.task.kind, "explain");
    assert.match(frame.domain.target, /teams 365/i);

    const ji = evaluateJustIntent(q);
    assert.equal(ji.domain, "general");
    assert.equal(ji.action, "explain");
    assert.equal(ji.strategy, EXECUTION_STRATEGIES.BUILD_V1);

    const gate = resolveClarificationGate(q, { justIntent: ji });
    assert.equal(gate.shouldClarify, false);

    const hit = await runConversationShortCircuit(q);
    assert.notEqual(hit?.path, "social_deterministic");
  });

  it("check-in + infos ciblées — pas social seul", async () => {
    const q = "comment ca va, je cherche des infos sur teams 365";
    const frame = analyzeRequestIntentFrame(q);
    assert.equal(frame.conversation.socialOnly, false);
    assert.equal(frame.composite, true);

    const hit = await runConversationShortCircuit(q);
    assert.notEqual(hit?.path, "social_deterministic");
  });

  it("cible explicite — pas clarify_then_build prématuré", () => {
    const q = "bonjour je cherche des informations sur Microsoft Teams 365";
    const ji = evaluateJustIntent(q);
    assert.equal(ji.strategy, EXECUTION_STRATEGIES.BUILD_V1);
    const gate = resolveClarificationGate(q, { justIntent: ji });
    assert.equal(gate.shouldClarify, false);
  });

  it("King of Avalon — shell possession + cible du jeu", () => {
    const q = "quelles informations aurais tu du jeu kingofavalon";
    assert.equal(isInformationSeekingShell(q), true);
    assert.equal(isInformationSeekingWithTarget(q), true);
    assert.match(extractInformationSeekingTarget(q), /kingofavalon/i);
  });

  it("King of Avalon — pas simple_factual_lookup", async () => {
    const q = "quelles informations aurais tu du jeu kingofavalon";
    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "information_seeking_full_pipeline");
    assert.equal(hit?.deferToFullPipeline, true);
  });

  it("King of Avalon — frame explain + preempt information_seeking", () => {
    const q = "quelles informations aurais tu du jeu kingofavalon";
    const frame = analyzeRequestIntentFrame(q);
    assert.equal(frame.task.kind, "explain");
    assert.match(frame.domain.target, /kingofavalon/i);

    const ji = evaluateJustIntent(q);
    assert.ok(ji.signals.includes("preempt:information_seeking"));
  });

  it("capitales scandinaves — reste hors info-seeking étendu", () => {
    const q = "quelles sont les capitales des pays scandinaves";
    assert.equal(isInformationSeekingWithTarget(q), false);
    assert.equal(isSimpleFactualQuestion(q), true);
  });

  it("shouldEscalateSimpleFactualToFullPipeline — filet niche", () => {
    const q = "quelles informations aurais tu du jeu kingofavalon";
    assert.equal(
      shouldEscalateSimpleFactualToFullPipeline(q, "empty_short_circuit_llm"),
      true,
    );
    assert.equal(
      shouldEscalateSimpleFactualToFullPipeline(q, "empty_simple_fast"),
      false,
    );
    assert.equal(
      shouldEscalateSimpleFactualToFullPipeline(
        q,
        null,
        "Je n'ai pas pu finaliser une réponse pour cette question (empty_short_circuit_llm).",
      ),
      true,
    );
  });

  it("buildInformationSeekingWebQuery — jeu King of Avalon", () => {
    const q = "quelles informations aurais tu du jeu kingofavalon";
    const webQ = buildInformationSeekingWebQuery(q);
    assert.match(webQ, /kingofavalon/i);
    assert.match(webQ, /jeu|overview/i);
  });

  it("shell court infos sur X — withTarget + web query", () => {
    const q = "infos sur le kimono";
    assert.equal(isInformationSeekingWithTarget(q), true);
    assert.match(extractInformationSeekingTarget(q), /kimono/i);
    assert.match(buildInformationSeekingWebQuery(q), /kimono overview/i);
  });

  it("animal — quelles informations sur le tigre → full pipeline", async () => {
    const q = "quelles informations aurais tu sur le tigre";
    assert.equal(isInformationSeekingWithTarget(q), true);
    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "information_seeking_full_pipeline");
  });

  it("animal — que sais-tu du tigre prime sur familiarity", async () => {
    const q = "que sais tu du tigre";
    assert.equal(isInformationSeekingWithTarget(q), true);
    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "information_seeking_full_pipeline");
    assert.notEqual(hit?.path, "familiarity_deterministic");
  });

  it("monument — que sais-tu du Taj Mahal reste culture générale", async () => {
    const q = "que sais tu du monument Taj Mahal";
    assert.equal(isInformationSeekingWithTarget(q), true);
    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "general_knowledge_full_pipeline");
  });

  it("vêtement — quelles informations sur le kimono → full pipeline", async () => {
    const q = "quelles informations aurais tu sur le kimono";
    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "information_seeking_full_pipeline");
  });
});
