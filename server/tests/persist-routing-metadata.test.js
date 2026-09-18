/**
 * PERSIST-ROUTING-METADATA-V1 — persistance allowlist, pas de consume, pas de route.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  composeAssistantEventMetadata,
  collectRoutingResultFromTelemetry,
  projectRoutingResultMetadata,
  normalizeResultStatus,
  ROUTING_RESULT_METADATA_KEYS,
} from "../src/agent/telemetry/routingResultMetadata.js";
import {
  mapEventsToConversationHistory,
  mergeConversationHistories,
  resolveSessionConversationHistory,
  SESSION_CONVERSATION_HISTORY_LIMIT,
} from "../src/services/sessionHistoryService.js";
import {
  commitSessionWorkTurn,
  clearSessionWorkMemoryForTests,
  loadSessionWorkMemory,
} from "../src/agent/memory/sessionWorkMemory.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { runAgentUnderstandingPhase } from "../src/agent/nexxusAgentCycle.js";
import { getIdentityDeterministicReply } from "../src/agent/utils/intent-guards/identityIntentGuards.js";
import { isWellbeingCheckinIntent } from "../src/agent/policies/social/index.js";
import { isRepoAnalysisRequest } from "../src/agent/utils/intent-guards/repoAnalysisIntentGuards.js";
import { evaluateJustIntent } from "../src/agent/policies/intent/justIntentDetectionPolicy.js";
import { GH_SAMPLE } from "./fixtures/routing-decision-matrix-v1.js";
import { buildRoutingObserveEvent } from "../src/agent/telemetry/routingObserveTelemetry.js";

const SESSION = "test-persist-routing-metadata";

function tel(overrides = {}) {
  return {
    turnId: "turn-1",
    error: null,
    getLastPipelinePath: () => "repo_analysis_llm",
    getLastRouteRecord: () => ({
      path: "repo_analysis_llm",
      forcedIntentContractId: "REPO_ANALYSIS",
    }),
    ...overrides,
  };
}

async function sc(query) {
  const { turnComprehension, turnLoop, understanding } =
    runAgentUnderstandingPhase(query, []);
  return runConversationShortCircuit(query, {
    history: [],
    turnComprehension,
    turnLoop,
    justIntent: evaluateJustIntent(query),
    queryUnderstanding: understanding,
    getDeterministicSocialResponse: (q) => getIdentityDeterministicReply(q),
  });
}

describe("PERSIST-ROUTING-METADATA-V1 — allowlist et reconstruction", () => {
  it("A. persistance normale : path, turnId, completed, reconstruction T+1", () => {
    const meta = collectRoutingResultFromTelemetry(tel(), { status: "ok" });
    assert.equal(meta.path, "repo_analysis_llm");
    assert.equal(meta.pipelinePath, "repo_analysis_llm");
    assert.equal(meta.forcedIntentContractId, "REPO_ANALYSIS");
    assert.equal(meta.turnId, "turn-1");
    assert.equal(meta.resultStatus, "completed");

    const stored = composeAssistantEventMetadata({
      tps: "12.0",
      duration: 1.2,
      totalTokens: 40,
      ...meta,
    });
    const history = mapEventsToConversationHistory(
      [
        {
          event_family: "CONVERSATION",
          event_type: "user_message",
          payload_json: { content: "résume ce dépôt" },
        },
        {
          event_family: "CONVERSATION",
          event_type: "ai_response",
          payload_json: { content: "Résumé livré." },
          metadata_json: stored,
        },
      ],
      10,
    );
    assert.equal(history[1].path, "repo_analysis_llm");
    assert.equal(history[1].turnId, "turn-1");
    assert.equal(history[1].resultStatus, "completed");
    assert.equal(history[1].content, "Résumé livré.");
    assert.equal("tps" in history[1], false);
  });

  it("B. contrat allowlist : JUST, shadow, cible, contenu, secrets exclus", () => {
    const projected = composeAssistantEventMetadata({
      path: "repo_analysis_llm",
      JUST: { domain: "analysis", action: "summarize" },
      just_intent: "analysis/summarize",
      result_usability_shadow: "exploitable",
      route_compatibility_shadow: "suspect",
      domain_target: "repository",
      target_label_shadow: "repository",
      content: "SECRET REPLY BODY",
      prompt: "system prompt",
      token: "sk-live-secret",
      apiKey: "ak-secret",
      authorization: "Bearer xyz",
      tps: "3.1",
    });
    assert.equal(projected.path, "repo_analysis_llm");
    assert.equal(projected.tps, "3.1");
    for (const forbidden of [
      "JUST",
      "just_intent",
      "result_usability_shadow",
      "route_compatibility_shadow",
      "domain_target",
      "target_label_shadow",
      "content",
      "prompt",
      "token",
      "apiKey",
      "authorization",
    ]) {
      assert.equal(forbidden in projected, false, forbidden);
    }
    for (const key of Object.keys(projected)) {
      assert.ok(
        ROUTING_RESULT_METADATA_KEYS.includes(key) ||
          key === "tps" ||
          key === "duration" ||
          key === "totalTokens" ||
          key === "expertKey",
        key,
      );
    }
  });

  it("C. statuts completed / interrupted / aborted / failed / clarify / absent", () => {
    assert.equal(normalizeResultStatus({ path: "repo_analysis_llm", status: "ok" }), "completed");
    assert.equal(normalizeResultStatus({ aborted: true, path: "repo_analysis_llm" }), "interrupted");
    assert.equal(normalizeResultStatus({ interrupted: true }), "interrupted");
    assert.equal(
      projectRoutingResultMetadata({ path: "repo_analysis_llm", aborted: true }).resultStatus,
      "interrupted",
    );
    assert.equal(
      projectRoutingResultMetadata({ path: "action_pipeline", error: true }).resultStatus,
      "failed",
    );
    const clarify = projectRoutingResultMetadata({
      path: "request_interpreter_clarify",
      status: "ok",
    });
    assert.equal(clarify.resultStatus, "clarify");
    assert.notEqual(clarify.resultStatus, "failed");
    assert.equal(normalizeResultStatus({}), undefined);
    assert.deepEqual(projectRoutingResultMetadata({}), {});
  });

  it("D. legacy : {role,content} et tps/duration seuls → pas de pipeline", () => {
    const legacy = mapEventsToConversationHistory(
      [
        {
          event_family: "CONVERSATION",
          event_type: "ai_response",
          payload_json: { content: "Voici un résumé du dépôt." },
        },
      ],
      10,
    );
    assert.deepEqual(legacy[0], { role: "assistant", content: "Voici un résumé du dépôt." });

    const opsOnly = mapEventsToConversationHistory(
      [
        {
          event_family: "CONVERSATION",
          event_type: "ai_response",
          payload_json: { content: "Voici un résumé du dépôt." },
          metadata_json: { tps: "9.9", duration: 2, totalTokens: 12 },
        },
      ],
      10,
    );
    assert.equal("path" in opsOnly[0], false);
    assert.equal("pipelinePath" in opsOnly[0], false);
    assert.equal("resultStatus" in opsOnly[0], false);
    assert.deepEqual(projectRoutingResultMetadata({ content: "Voici un résumé du dépôt." }), {});
  });

  it("E. durée de vie : 40 messages, dernier assistant, salutation écrase le cache", () => {
    assert.equal(SESSION_CONVERSATION_HISTORY_LIMIT, 40);
    const events = Array.from({ length: 82 }, (_, index) => ({
      event_family: "CONVERSATION",
      event_type: index % 2 === 0 ? "user_message" : "ai_response",
      payload_json: { content: `msg-${index}` },
      metadata_json:
        index === 3
          ? { path: "repo_analysis_llm", status: "ok" }
          : index === 81
            ? { path: "social_deterministic", status: "ok" }
            : {},
    }));
    const windowed = mapEventsToConversationHistory(events, SESSION_CONVERSATION_HISTORY_LIMIT);
    assert.equal(windowed.length, 40);
    assert.equal(windowed[0].content, "msg-42");
    const last = windowed[windowed.length - 1];
    assert.equal(last.role, "assistant");
    assert.equal(last.path, "social_deterministic");
    assert.notEqual(last.path, "repo_analysis_llm");
  });
});

describe("PERSIST-ROUTING-METADATA-V1 — cache session et fusion", () => {
  beforeEach(() => {
    clearSessionWorkMemoryForTests(SESSION);
  });

  it("lastRoutingResult : un slot, écrasé, sans contenu", () => {
    commitSessionWorkTurn({
      sessionId: SESSION,
      lastRoutingResult: {
        path: "repo_analysis_llm",
        turnId: "t-repo",
        status: "ok",
        content: "ne doit pas rester",
      },
    });
    let state = loadSessionWorkMemory(SESSION);
    assert.equal(state.lastRoutingResult.path, "repo_analysis_llm");
    assert.equal("content" in state.lastRoutingResult, false);

    commitSessionWorkTurn({
      sessionId: SESSION,
      lastRoutingResult: {
        path: "social_deterministic",
        socialPatternName: "greeting",
        status: "ok",
      },
    });
    state = loadSessionWorkMemory(SESSION);
    assert.equal(state.lastRoutingResult.path, "social_deterministic");
    assert.notEqual(state.lastRoutingResult.path, "repo_analysis_llm");
  });

  it("fusion alignée : métadonnées DB conservées si le client est plus long", () => {
    const db = [
      { role: "user", content: "bonjour" },
      {
        role: "assistant",
        content: "salut",
        path: "social_deterministic",
        resultStatus: "completed",
      },
    ];
    const client = [
      { role: "user", content: "bonjour" },
      { role: "assistant", content: "salut" },
      { role: "user", content: "suite" },
      { role: "assistant", content: "ok" },
    ];
    const merged = mergeConversationHistories(db, client, 10);
    assert.equal(merged.length, 4);
    assert.equal(merged[1].path, "social_deterministic");
    assert.equal(merged[1].resultStatus, "completed");
  });

  it("sanitize client : allowlist gardée, secrets jetés", async () => {
    const resolved = await resolveSessionConversationHistory(null, {
      clientHistory: [
        {
          role: "assistant",
          content: "ok",
          path: "action_pipeline",
          token: "sk-secret",
          result_usability_shadow: "exploitable",
        },
      ],
      limit: 10,
    });
    assert.equal(resolved[0].path, "action_pipeline");
    assert.equal("token" in resolved[0], false);
    assert.equal("result_usability_shadow" in resolved[0], false);
  });
});

describe("PERSIST-ROUTING-METADATA-V1 — non-régression routes", () => {
  it("T1 social, T2 factual suspect, M5/T10 REPO, M6 page, T9 ni social ni REPO, Pack 6", async () => {
    const t1 = "salut comment cava aujourd'hui?";
    assert.equal(isWellbeingCheckinIntent(t1), true);
    const t1Hit = await sc(t1);
    assert.equal(t1Hit?.path, "social_deterministic");

    const t2 = "est ce que tu es dispo maintenant ?";
    const t2Hit = await sc(t2);
    assert.equal(t2Hit?.path, "simple_factual_lookup");
    const t2Event = buildRoutingObserveEvent(t2, { hit: t2Hit });
    assert.equal(t2Event.route_compatibility_shadow, "suspect");
    assert.equal(t2Event.shadow_consumed, false);

    const m5 = `résume ce dépôt ${GH_SAMPLE}`;
    assert.equal(isRepoAnalysisRequest(m5), true);
    const m5Hit = await sc(m5);
    assert.equal(m5Hit?.path, "repo_analysis_llm");
    assert.equal(m5Hit?.forcedIntentContractId, "REPO_ANALYSIS");

    const t10Hit = await sc(`bonjour, résumer ce dépôt ${GH_SAMPLE}`);
    assert.equal(t10Hit?.path, "repo_analysis_llm");

    const m6Hit = await sc("résume cette page https://example.com");
    assert.equal(m6Hit?.path, "document_synthesis_llm");

    const t9 = `est-ce que le dépôt est disponible ? ${GH_SAMPLE}`;
    const t9Hit = await sc(t9);
    assert.notEqual(t9Hit?.path, "social_deterministic");
    assert.notEqual(t9Hit?.forcedIntentContractId, "REPO_ANALYSIS");
  });
});
