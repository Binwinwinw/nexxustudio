/**
 * Lot OBS-ROUTING-FRAME-SC — observabilité shadow, aucun changement de route.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import {
  buildRoutingObserveEvent,
  ROUTING_OBSERVE_EVENT,
} from "../src/agent/telemetry/routingObserveTelemetry.js";
import { evaluateJustIntent } from "../src/agent/policies/intent/justIntentDetectionPolicy.js";
import { runAgentUnderstandingPhase } from "../src/agent/nexxusAgentCycle.js";
import { getIdentityDeterministicReply } from "../src/agent/utils/intent-guards/identityIntentGuards.js";

const GH = "https://github.com/Tencent-Hunyuan/Hy4-preview";

/** Cible attendue = label de matrice, pas une extraction runtime. */
export const ROUTING_OBSERVE_MATRIX = Object.freeze([
  {
    id: "M1",
    q: "tu es dispo ?",
    expected_target: "assistant",
    expected_pipeline: null,
  },
  {
    id: "T2",
    q: "est ce que tu es dispo maintenant ?",
    expected_target: "assistant",
    expected_pipeline: "simple_factual_lookup",
  },
  {
    id: "T1",
    q: "salut comment cava aujourd'hui?",
    expected_target: "assistant",
    expected_pipeline: "social_deterministic",
  },
  {
    id: "M2",
    q: "le serveur est dispo ?",
    expected_target: "server",
    expected_pipeline: null,
  },
  {
    id: "M3",
    q: "tu peux m'aider ?",
    expected_target: "assistant",
    expected_pipeline: null,
  },
  {
    id: "M4",
    q: "Paris est-elle la capitale de la France ?",
    expected_target: "world",
    expected_pipeline: null,
  },
  {
    id: "M5",
    q: `résume ce dépôt ${GH}`,
    expected_target: "repository",
    expected_pipeline: "repo_analysis_llm",
  },
  {
    id: "M6",
    q: "résume cette page https://example.com",
    expected_target: "page",
    expected_pipeline: "document_synthesis_llm",
  },
  {
    id: "M7",
    q: "et maintenant ?",
    expected_target: "context",
    expected_pipeline: null,
  },
  {
    id: "M8",
    q: "crée un fichier",
    expected_target: "workspace",
    expected_pipeline: null,
  },
  {
    id: "M9",
    q: "c'est disponible ?",
    expected_target: "unknown",
    expected_pipeline: null,
  },
  {
    id: "T9",
    q: `est-ce que le dépôt est disponible ? ${GH}`,
    expected_target: "repository",
    expected_pipeline: null,
  },
  {
    id: "T10",
    q: `bonjour, résumer ce dépôt ${GH}`,
    expected_target: "repository",
    expected_pipeline: "repo_analysis_llm",
  },
]);

async function runCase(row) {
  const { turnComprehension, turnLoop, understanding } =
    runAgentUnderstandingPhase(row.q, []);
  const justIntent = evaluateJustIntent(row.q);
  const hit = await runConversationShortCircuit(row.q, {
    history: [],
    turnComprehension,
    turnLoop,
    justIntent,
    queryUnderstanding: understanding,
    expectedTargetShadow: row.expected_target,
    getDeterministicSocialResponse: (qq) => getIdentityDeterministicReply(qq),
  });
  const event = buildRoutingObserveEvent(row.q, {
    hit,
    justIntent,
    requestFrame: understanding.requestFrame,
    expectedTargetShadow: row.expected_target,
  });
  return { hit, event, justIntent };
}

describe("OBS-ROUTING-FRAME-SC — shadow observe, routes inchangées", () => {
  it("événement sans scores ni cible extraite inventée", async () => {
    const { event } = await runCase(ROUTING_OBSERVE_MATRIX.find((r) => r.id === "T2"));
    assert.equal(event.event, ROUTING_OBSERVE_EVENT);
    assert.equal(event.phase, "routing_observe");
    assert.equal(event.expected_target_shadow, "assistant");
    assert.equal(event.domain_target, null);
    assert.equal(event.target_gap, true);
    assert.equal("social_likelihood" in event, false);
    assert.equal("factual_likelihood" in event, false);
    assert.ok(Array.isArray(event.observed_target_signals_shadow));
  });

  it("T2 reste simple_factual_lookup ; shadow social visible", async () => {
    const { hit, event } = await runCase(
      ROUTING_OBSERVE_MATRIX.find((r) => r.id === "T2"),
    );
    assert.equal(hit?.path, "simple_factual_lookup");
    assert.equal(event.selected_pipeline, "simple_factual_lookup");
    assert.equal(event.first_winning_guard, "isSimpleFactualQuestion");
    assert.equal(event.is_simple_factual_question, true);
    assert.equal(event.candidate_route_shadow, "social_deterministic");
    assert.equal(event.cost_class, "very_high");
    assert.equal(event.defer_to_llm, true);
  });

  it("T1 reste social_deterministic", async () => {
    const { hit, event } = await runCase(
      ROUTING_OBSERVE_MATRIX.find((r) => r.id === "T1"),
    );
    assert.equal(hit?.path, "social_deterministic");
    assert.equal(event.selected_pipeline, "social_deterministic");
    assert.equal(event.just_intent, "social/social_checkin");
    assert.equal(event.cost_class, "low");
    assert.equal(event.domain_target, null);
    assert.equal(event.target_gap, true);
  });

  it("M1/M3/M7 restent fallthrough", async () => {
    for (const id of ["M1", "M3", "M7"]) {
      const { hit, event } = await runCase(
        ROUTING_OBSERVE_MATRIX.find((r) => r.id === id),
      );
      assert.equal(hit, null, id);
      assert.equal(event.selected_pipeline, null, id);
      assert.equal(event.first_winning_guard, "no_short_circuit", id);
    }
  });

  it("M5/T10 restent REPO_ANALYSIS ; M6 WEB_SUMMARY", async () => {
    const m5 = await runCase(ROUTING_OBSERVE_MATRIX.find((r) => r.id === "M5"));
    assert.equal(m5.hit?.path, "repo_analysis_llm");
    assert.equal(m5.hit?.forcedIntentContractId, "REPO_ANALYSIS");
    const t10 = await runCase(ROUTING_OBSERVE_MATRIX.find((r) => r.id === "T10"));
    assert.equal(t10.hit?.path, "repo_analysis_llm");
    const m6 = await runCase(ROUTING_OBSERVE_MATRIX.find((r) => r.id === "M6"));
    assert.equal(m6.hit?.path, "document_synthesis_llm");
    assert.equal(m6.hit?.webSummary, true);
    assert.equal(m6.event.maybe_web_target, true);
  });

  it("matrice complète : target_gap si expected fourni, domain_target jamais assistant", async () => {
    const rows = [];
    for (const row of ROUTING_OBSERVE_MATRIX) {
      const { event } = await runCase(row);
      assert.notEqual(event.domain_target, "assistant");
      assert.equal(event.target_gap, true);
      assert.equal(event.expected_target_shadow, row.expected_target);
      rows.push({
        id: row.id,
        selected: event.selected_pipeline,
        shadow: event.candidate_route_shadow,
        reason: event.first_winning_guard,
        cost: event.cost_class,
      });
    }
    assert.equal(rows.length, ROUTING_OBSERVE_MATRIX.length);
  });
});
