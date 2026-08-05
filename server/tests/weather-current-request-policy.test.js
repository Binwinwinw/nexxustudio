import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  WEATHER_CANONICAL_DOCUMENT_COMMENT_QUERY,
  WEATHER_CANONICAL_FDF_QUERY,
  WEATHER_CANONICAL_MIAMI_QUERY,
  WEATHER_CANONICAL_NARRATIVE_QUERY,
  WEATHER_CANONICAL_PASTED_NARRATIVE_QUERY,
  buildWeatherCurrentRecoveryMessage,
  buildWeatherCurrentWebQuery,
  isNarrativeOrExpressiveWeatherUtterance,
  isQuotedOrPastedWeatherContext,
  isWeatherCurrentRequest,
  parseWeatherCurrentTask,
  resolveWeatherCurrentShortCircuit,
} from "../src/agent/policies/web/index.js";
import {
  CLARIFICATION_DECISIONS,
  evaluateClarificationDecision,
} from "../src/agent/policies/routing/clarificationDecisionPolicy.js";
import { evaluateJustIntent } from "../src/agent/policies/intent/justIntentDetectionPolicy.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { resolvePipelineFallback } from "../src/agent/utils/genericGreetingGuards.js";
import { shouldEscalateSimpleFactualToFullPipeline } from "../src/agent/utils/informationSeekingIntentGuards.js";
import { resolveKnowledgeEnrichmentPolicy } from "../src/agent/policies/routing/knowledgeEnrichmentPolicy.js";

describe("weatherCurrentRequestPolicy — détection", () => {
  it("Miami — requête météo actuelle exploitable", () => {
    assert.equal(isWeatherCurrentRequest(WEATHER_CANONICAL_MIAMI_QUERY), true);
    const task = parseWeatherCurrentTask(WEATHER_CANONICAL_MIAMI_QUERY);
    assert.equal(task?.location, "miami");
    assert.equal(task?.metric, "température");
  });

  it("Fort-de-France — shell tu as la météo", () => {
    assert.equal(isWeatherCurrentRequest(WEATHER_CANONICAL_FDF_QUERY), true);
    assert.match(
      buildWeatherCurrentWebQuery(WEATHER_CANONICAL_FDF_QUERY) || "",
      /Fort-de-France|fort de france/i,
    );
  });

  it("narration expressive — pas de trigger", () => {
    assert.equal(
      isWeatherCurrentRequest(WEATHER_CANONICAL_NARRATIVE_QUERY),
      false,
    );
    assert.equal(
      isNarrativeOrExpressiveWeatherUtterance(
        WEATHER_CANONICAL_NARRATIVE_QUERY,
      ),
      true,
    );
  });

  it("passage collé + résume — pas de trigger", () => {
    assert.equal(
      isQuotedOrPastedWeatherContext(WEATHER_CANONICAL_PASTED_NARRATIVE_QUERY),
      true,
    );
    assert.equal(
      isWeatherCurrentRequest(WEATHER_CANONICAL_PASTED_NARRATIVE_QUERY),
      false,
    );
  });

  it("commentaire documentaire — pas de trigger", () => {
    assert.equal(
      isWeatherCurrentRequest(WEATHER_CANONICAL_DOCUMENT_COMMENT_QUERY),
      false,
    );
  });
});

describe("weatherCurrentRequestPolicy — routage + fallback", () => {
  it("short-circuit → simple_factual_lookup + web prioritaire", async () => {
    const hit = await runConversationShortCircuit(
      WEATHER_CANONICAL_MIAMI_QUERY,
    );
    assert.equal(hit?.path, "simple_factual_lookup");
    assert.equal(hit?.deferToFullPipeline, true);
    assert.equal(hit?.preferWebResearch, true);
    assert.equal(hit?.weatherCurrent, true);
    assert.ok(hit?.weatherWebQuery);
    assert.match(hit.weatherWebQuery, /miami/i);
  });

  it("narration — pas de short-circuit météo", async () => {
    const hit = await runConversationShortCircuit(
      WEATHER_CANONICAL_NARRATIVE_QUERY,
    );
    assert.notEqual(hit?.weatherCurrent, true);
  });

  it("clarification gate → can_answer_now + signal weather", () => {
    const decision = evaluateClarificationDecision(
      WEATHER_CANONICAL_MIAMI_QUERY,
      evaluateJustIntent(WEATHER_CANONICAL_MIAMI_QUERY),
    );
    assert.equal(decision.decision, CLARIFICATION_DECISIONS.CAN_ANSWER_NOW);
    assert.ok(decision.signals.includes("weather_current_request"));
  });

  it("enrichment → webQuery météo", () => {
    const enrich = resolveKnowledgeEnrichmentPolicy(
      WEATHER_CANONICAL_MIAMI_QUERY,
    );
    assert.equal(enrich.preferWebResearch, true);
    assert.equal(enrich.domain, "weather_current");
    assert.ok(enrich.webQuery);
    assert.match(enrich.webQuery, /miami/i);
  });

  it("escalade simple_factual après LLM vide", () => {
    assert.equal(
      shouldEscalateSimpleFactualToFullPipeline(
        WEATHER_CANONICAL_MIAMI_QUERY,
        "empty_short_circuit_llm",
      ),
      true,
    );
  });

  it("fallback pipeline — pas géographie/histoire", () => {
    const fallback = resolvePipelineFallback({
      query: WEATHER_CANONICAL_MIAMI_QUERY,
      reason: "empty_short_circuit_llm",
    });
    assert.match(fallback, /météo actuelle|Miami/i);
    assert.doesNotMatch(fallback, /géographie|histoire|précise l'angle/i);
  });

  it("resolveWeatherCurrentShortCircuit — structure", () => {
    const hit = resolveWeatherCurrentShortCircuit(WEATHER_CANONICAL_MIAMI_QUERY);
    assert.equal(hit?.path, "simple_factual_lookup");
    assert.equal(hit?.kind, "weather_current");
    assert.ok(hit?.weatherWebQuery);
  });

  it("recovery message — honnête et ciblé", () => {
    const msg = buildWeatherCurrentRecoveryMessage(
      WEATHER_CANONICAL_MIAMI_QUERY,
      "empty_short_circuit_llm",
    );
    assert.match(msg, /Miami/i);
    assert.doesNotMatch(msg, /géographie|histoire/i);
  });

  it("orchestrateur — web échoué → fallback honnête rapide (pas raisonneur)", async () => {
    const { expertWebSearch } = await import(
      "../src/agent/agents/expertWebSearch.js"
    );
    const { SovereignOrchestrator } = await import(
      "../src/agent/orchestrator/SovereignOrchestrator.js"
    );
    const originalRun = expertWebSearch.run;
    expertWebSearch.run = async (envelope) => ({
      expert: "expert_web_search",
      query: envelope?.query || "",
      sources: [],
      summary: "",
      confidence: 0,
      requires_human_caution: true,
      failure_mode: "web_search_error",
      stage: "web_research",
      content: "Recherche web infructueuse",
    });

    try {
      const orchestrator = new SovereignOrchestrator({});
      const started = Date.now();
      const result = await orchestrator.orchestrate(
        WEATHER_CANONICAL_MIAMI_QUERY,
        [],
        {
          forcedExpertKey: "expert_web_search",
          webSearchQuery: buildWeatherCurrentWebQuery(
            WEATHER_CANONICAL_MIAMI_QUERY,
          ),
          intent: "normal_conversation",
        },
      );
      const elapsed = Date.now() - started;

      assert.equal(typeof result, "string");
      assert.match(result, /Je n'ai pas réussi à récupérer la météo actuelle pour Miami/i);
      assert.doesNotMatch(result, /géographie|histoire|précise l'angle/i);
      assert.ok(elapsed < 60_000, `fallback trop lent: ${elapsed}ms`);
    } finally {
      expertWebSearch.run = originalRun;
    }
  });
});
