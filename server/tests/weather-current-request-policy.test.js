import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  WEATHER_CANONICAL_DOCUMENT_COMMENT_QUERY,
  WEATHER_CANONICAL_FDF_QUERY,
  WEATHER_CANONICAL_MIAMI_QUERY,
  WEATHER_CANONICAL_NARRATIVE_QUERY,
  WEATHER_CANONICAL_PASTED_NARRATIVE_QUERY,
  buildWeatherCurrentFactualReply,
  buildWeatherCurrentRecoveryMessage,
  buildWeatherCurrentWebQuery,
  isNonTerrestrialWeatherLocation,
  extractLastWeatherLocationFromHistory,
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
import { resolvePipelineFallback } from "../src/agent/utils/conversation/genericGreetingGuards.js";
import { shouldEscalateSimpleFactualToFullPipeline } from "../src/agent/utils/intent-guards/informationSeekingIntentGuards.js";
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

  it("suivi sans lieu — hérite Martinique du tour précédent", async () => {
    const prior =
      "quel temps fait il en martinique à l'heure actuelle?";
    const follow =
      "quelle est la température, est ce qu'il fait jour ou il fait nuit ?";
    const history = [
      { role: "user", content: prior },
      {
        role: "assistant",
        content: "Météo actuelle en Martinique : environ 26°C.",
      },
    ];

    assert.equal(isWeatherCurrentRequest(follow), false);
    assert.equal(extractLastWeatherLocationFromHistory(history), "martinique");
    assert.equal(isWeatherCurrentRequest(follow, { history }), true);

    const task = parseWeatherCurrentTask(follow, { history });
    assert.equal(task?.location, "martinique");
    assert.equal(task?.locationSource, "carryover");
    assert.match(task?.metric || "", /température|jour/i);

    const hit = await runConversationShortCircuit(follow, { history });
    assert.equal(hit?.weatherCurrent, true);
    assert.equal(hit?.path, "simple_factual_lookup");
    assert.equal(hit?.weatherLocationSource, "carryover");
    assert.match(String(hit?.weatherWebQuery || ""), /martinique/i);
  });

  it("Martinique — quel temps … à l'heure actuelle → lieu martinique (pas horloge)", async () => {
    const q =
      "quel temps fait il en martinique à l'heure actuelle?";
    assert.equal(isWeatherCurrentRequest(q), true);
    const task = parseWeatherCurrentTask(q);
    assert.equal(task?.location, "martinique");
    assert.doesNotMatch(task?.location || "", /heure/i);
    assert.match(buildWeatherCurrentWebQuery(q) || "", /martinique/i);
    assert.doesNotMatch(
      buildWeatherCurrentWebQuery(q) || "",
      /heure actuelle/i,
    );

    const { resolveMultiSegmentPlan } = await import(
      "../src/agent/micro/parsing/multiSegmentResponsePlan.js"
    );
    const plan = resolveMultiSegmentPlan(q);
    assert.notEqual(plan.primaryGoal, "time_lookup");
    assert.equal(plan.signalOnly, false);
    assert.equal(plan.preamble, null);

    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.weatherCurrent, true);
    assert.equal(hit?.path, "simple_factual_lookup");
    assert.match(String(hit?.weatherWebQuery || ""), /martinique/i);
    assert.doesNotMatch(String(hit?.reply || ""), /^Il est \d/i);
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

  it("recovery message — borné + une alternative, pas de liste", () => {
    const msg = buildWeatherCurrentRecoveryMessage(
      WEATHER_CANONICAL_MIAMI_QUERY,
      "empty_short_circuit_llm",
    );
    assert.match(msg, /Miami/i);
    assert.match(msg, /meteofrance\.com/i);
    assert.doesNotMatch(msg, /géographie|histoire|option\s*1|voici quelques/i);
  });

  it("factual reply — temp + condition + source principale", () => {
    const reply = buildWeatherCurrentFactualReply(
      "Quelle est la météo actuelle en Martinique ?",
      [
        {
          url: "https://www.meteofrance.com/previsions-meteo-france/fort-de-france/97200",
          title: "Météo Fort-de-France",
          snippet:
            "Actuellement à Fort-de-France : ciel partiellement nuageux, 29 °C, vent faible.",
        },
        {
          url: "https://example.com/autre",
          title: "Autre",
          snippet: "Lien générique sans donnée.",
        },
      ],
    );
    assert.ok(reply);
    assert.match(reply, /Martinique|29/i);
    assert.match(reply, /29\s*°C/i);
    assert.match(reply, /partiellement nuageux|nuageux/i);
    assert.match(reply, /meteofrance\.com/i);
    assert.doesNotMatch(reply, /option\s*[123]|je n'ai pas accès|navigateur/i);
    assert.ok(
      (reply.match(/https?:\/\//g) || []).length <= 1,
      "une seule source principale attendue",
    );
  });

  it("factual reply — sans température → condition ancrée + source", () => {
    const reply = buildWeatherCurrentFactualReply(WEATHER_CANONICAL_FDF_QUERY, [
      {
        url: "https://weather.com/fr-FR/temps/aujourdhuid/l/Fort+de+France",
        title: "Temps Fort-de-France",
        snippet: "Conditions actuelles stables, averses possibles en soirée.",
      },
    ]);
    assert.ok(reply);
    assert.match(reply, /Fort-de-France|averses?/i);
    assert.match(reply, /weather\.com/i);
    assert.doesNotMatch(reply, /voici (?:trois|quelques) (?:liens|options)/i);
  });

  it("factual reply — Mars hors périmètre terrestre (pas de pluie inventée)", () => {
    assert.equal(isNonTerrestrialWeatherLocation("Mars"), true);
    const reply = buildWeatherCurrentFactualReply(
      "quel temps fait il sur mars à l'heure actuelle?",
      [
        {
          url: "https://meteofrance.com/",
          title: "Météo France",
          snippet: "Prévisions mars : pluie possible sur plusieurs régions.",
        },
      ],
    );
    assert.match(reply, /pas un lieu de météo terrestre|NASA/i);
    assert.doesNotMatch(reply, /Météo actuelle en Mars\s*:\s*pluie/i);
  });

  it("factual reply — homepage marketing France → null (pas de blurb)", () => {
    const reply = buildWeatherCurrentFactualReply(
      "quel temps fait il en france à l'heure actuelle?",
      [
        {
          url: "https://meteofrance.com/",
          title: "METEO FRANCE",
          snippet:
            "Retrouvez les prévisions METEO France de Météo-France à 15 jours, les prévisions météos locales gratuites.",
        },
      ],
    );
    assert.equal(reply, null);
  });

  it("short-circuit Mars → réponse bornée sans web", async () => {
    const hit = await runConversationShortCircuit(
      "quel temps fait il sur mars à l'heure actuelle?",
    );
    assert.equal(hit?.weatherCurrent, true);
    assert.equal(hit?.deferToFullPipeline, false);
    assert.equal(hit?.preferWebResearch, false);
    assert.match(hit?.reply || "", /pas un lieu de météo terrestre|NASA/i);
    assert.equal(hit?.weatherWebQuery, null);
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
      assert.match(result, /Je n'ai pas pu récupérer la météo temps réel pour Miami/i);
      assert.match(result, /meteofrance\.com/i);
      assert.doesNotMatch(result, /géographie|histoire|précise l'angle/i);
      assert.ok(elapsed < 60_000, `fallback trop lent: ${elapsed}ms`);
    } finally {
      expertWebSearch.run = originalRun;
    }
  });

  it("orchestrateur — web OK → réponse factuelle immédiate", async () => {
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
      sources: [
        {
          url: "https://www.meteofrance.com/previsions-meteo-outremer/martinique",
          title: "Météo Martinique",
          snippet: "Temps actuel : ensoleillé, 30 °C, alizé modéré.",
          confidence: 0.9,
        },
      ],
      summary: "ensoleillé 30 °C Martinique",
      confidence: 0.9,
      requires_human_caution: false,
      stage: "web_research",
      content: "ensoleillé 30 °C",
    });

    try {
      const orchestrator = new SovereignOrchestrator({});
      const result = await orchestrator.orchestrate(
        "Quelle est la météo actuelle en Martinique ?",
        [],
        {
          forcedExpertKey: "expert_web_search",
          webSearchQuery: "météo actuelle Martinique température maintenant",
          intent: "normal_conversation",
        },
      );

      assert.equal(typeof result, "string");
      assert.match(result, /30\s*°C/i);
      assert.match(result, /meteofrance\.com|Météo-France/i);
      assert.doesNotMatch(
        result,
        /je n'ai pas accès|option\s*[123]|voici quelques liens/i,
      );
    } finally {
      expertWebSearch.run = originalRun;
    }
  });
});
