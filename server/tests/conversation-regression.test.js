import test from "node:test";
import assert from "node:assert/strict";

import agent from "../src/agent/agent.js";
import OllamaStreamProcessor from "../src/agent/utils/ollamaStreamProcessor.js";
import responseThinkingCleaner from "../src/agent/utils/responseThinkingCleaner.js";
import { validateOrchestratorPacket } from "../src/agent/validators/pipelineValidators.js";

function includesAll(text, patterns = []) {
  const lower = text.toLowerCase();
  return patterns.every((pattern) => lower.includes(pattern.toLowerCase()));
}

function includesNone(text, patterns = []) {
  const lower = text.toLowerCase();
  return patterns.every((pattern) => !lower.includes(pattern.toLowerCase()));
}

const SOCIAL_CASES = [
  {
    name: "salutation courte avec expert forcé",
    query: "bonjour comment ça va la dedans ???",
    forcedExpertKey: "expert_mentor",
    required: ["tout va bien ici"],
    forbidden: [
      "products",
      "nutrition",
      "éthique",
      "je suis désolé",
      "intelligence artificielle",
    ],
  },
  {
    name: "identité et fonctionnalités",
    query:
      "bonjour, comment t'appelles tu et quelles sont tes fonctionnalités??",
    forcedExpertKey: "expert_mentor",
    required: ["coordinateur souverain", "citadel"],
    forbidden: [
      "constraints",
      "generate and output the response",
      "that's the forge's job",
      "intelligence artificielle",
    ],
  },
  {
    name: "message social taquin",
    query:
      "héy héy héy pourquoi tu es pressé comme a tu as autre chose à faire ??? tu réponds très vite , c'est bluffant",
    forcedExpertKey: "expert_mentor",
    required: ["répons", "rapid"],
    forbidden: [
      "produits de santé",
      "nutrition",
      "éthique",
      "je me souviens",
      "contenu spécifique",
    ],
  },
];

for (const scenario of SOCIAL_CASES) {
  test(`conversation regression: ${scenario.name}`, async () => {
    const streamed = [];
    const response = await agent.run(scenario.query, [], {
      forcedExpertKey: scenario.forcedExpertKey,
      onContent: (token) => streamed.push(token),
    });

    assert.ok(
      includesAll(response, scenario.required),
      `Réponse inattendue: ${response}`,
    );
    assert.ok(
      includesNone(response, scenario.forbidden),
      `Réponse contaminée: ${response}`,
    );
    assert.equal(streamed.join(""), response);
  });
}

test("conversation regression: current date uses deterministic one-line fast-path", async () => {
  const response = await agent.run("quelle est la date du jour ?");

  assert.match(
    response,
    /^Nous sommes le\s+\p{L}+[\p{L}\s-]*\s+\d{2}\s+\p{L}+[\p{L}\s-]*\s+\d{4}\.$/u,
  );
  assert.doesNotMatch(response, /je ne peux pas|désolé|recherche web|limite/i);
});

test("conversation regression: current time uses deterministic one-line fast-path", async () => {
  const response = await agent.run("il est quelle heure ?");

  assert.match(response, /^Il est\s+\d{2}:\d{2}\.$/);
  assert.doesNotMatch(response, /je ne peux pas|désolé|recherche web|limite/i);
});

test("conversation regression: agents architecture stays functional and concise", async () => {
  const response = await agent.run(
    "est-ce que dans la citadelle il y a des agents et des sous-agents ???",
  );

  assert.ok(
    includesAll(response, ["agent principal", "agents specialises", "forge"]),
  );
  assert.ok(
    includesNone(response, [
      "maître-agent",
      "maitre-agent",
      "structure trinitaire",
      "souveraineté absolue",
      "entité centrale",
    ]),
    `Réponse trop cérémonielle: ${response}`,
  );

  const sentenceCount = response
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean).length;
  assert.ok(sentenceCount <= 4, `Réponse trop longue: ${response}`);
});

test("conversation regression: short non-analytical query forces short response override", () => {
  const packet = {
    user_query: "c'est quoi ?",
    user_intent: "unknown",
    mode: "EPISTEMIC",
  };

  assert.equal(
    finalRendererAgent.shouldForceShortResponse(packet),
    true,
    "Une question courte non analytique doit forcer le mode conversationnel court",
  );
});

test("conversation regression: short analytical query does not force short response", () => {
  const packet = {
    user_query: "pourquoi le système fonctionne-t-il ainsi ?",
    user_intent: "unknown",
    mode: "EPISTEMIC",
  };

  assert.equal(
    finalRendererAgent.shouldForceShortResponse(packet),
    false,
    "Une question courte analytique doit pouvoir rester en mode épistémique",
  );
});

test("schema validation allows OrchestratorPacket with user_query", () => {
  const packet = {
    user_intent: "unknown",
    user_query: "quel est le score ?",
    mode: "OPERATIONAL",
    expert_outputs: [],
    evidence: [],
    vision_briefing: null,
    risk_level: "low",
    budget: {
      total_budget_ms: 0,
      elapsed_ms: 0,
      remaining_ms: 0,
      exhausted: false,
      expert_budget: {
        total_budget_ms: 0,
        elapsed_ms: 0,
        remaining_ms: 0,
        exhausted: false,
        stages: {},
      },
      stages: {},
    },
    quick_answer: null,
    system_prompt_used: null,
  };

  assert.doesNotThrow(() => {
    validateOrchestratorPacket(packet);
  });
});

test("response thinking cleaner removes all internal reflection markers", () => {
  const testCases = [
    {
      input: "Bonjour.<think>Pensée interne</think>Réponse.",
      shouldNotContain: ["<think>", "Pensée interne"],
    },
    {
      input: "Point 1.\n\n**Raisonnement**: Analyse interne.\n\nPoint 2.",
      shouldNotContain: ["**Raisonnement**", "Analyse interne"],
    },
    {
      input: "Début.<action>Exécution</action>Fin.",
      shouldNotContain: ["<action>", "Exécution"],
    },
  ];

  for (const testCase of testCases) {
    const cleaned = responseThinkingCleaner.clean(testCase.input);
    for (const forbidden of testCase.shouldNotContain) {
      assert.ok(
        !cleaned.includes(forbidden),
        `Cleaner did not remove "${forbidden}" from: ${cleaned}`,
      );
    }
  }
});

test("response cleaner detects escaped thinking patterns", () => {
  const textsWithThinking = [
    "Bonjour.\n\n**Thinking Process:**\nAnalysis...",
    "Response <think>internal</think> here",
    "Action <action>perform</action> now",
    "# **Raisonnement**\nLogique interne.",
  ];

  for (const text of textsWithThinking) {
    assert.ok(
      responseThinkingCleaner.hasEscapedThinking(text),
      `Failed to detect thinking in: ${text}`,
    );
  }
});

test("stream processor handles thinking and visible text in one chunk", () => {
  const visible = [];
  const processor = new OllamaStreamProcessor({
    onChunk: (chunk) => visible.push(chunk),
  });
  const sample =
    "Salut !<think>réflexion interne</think> Ça va bien, et toi ?";

  processor.processToken(sample);
  processor.finalize();

  assert.equal(processor.getResult().currentResponse, "Salut ! Ça va bien, et toi ?");
  assert.ok(visible.join("").includes("Salut"));
});

test("stream processor strips think blocks from visible response", () => {
  const processor = new OllamaStreamProcessor();
  const sample = "Bonjour<think>internal chain of thought</think> visible";

  for (const char of sample) {
    processor.processToken(char);
  }

  const result = processor.getResult();
  assert.equal(result.currentResponse, "Bonjour visible");
  assert.ok(
    result.fullResponse.includes("<think>internal chain of thought</think>"),
  );
});

test("stream processor handles 100 percent think blocks", () => {
  const processor = new OllamaStreamProcessor();
  const sample =
    "<think>This is a 100% internal reasoning chain that yields no visible text.</think>";

  for (const char of sample) {
    processor.processToken(char);
  }

  processor.finalize();
  const result = processor.getResult();

  // Cleaned think block should be set as fallback instead of a white screen
  assert.ok(result.currentResponse.length > 0);
  assert.equal(
    result.currentResponse,
    "This is a 100% internal reasoning chain that yields no visible text.",
  );
});

test("stream processor detects and blocks plain text leaked English plans", () => {
  const processor = new OllamaStreamProcessor();
  const sample =
    "**Thinking Process:**\n* Start with a clear plan.\n* Step 1: We will need to check the parameters.\n* Step 2: Then we must return the results.";

  for (const char of sample) {
    processor.processToken(char);
  }

  processor.finalize();
  const result = processor.getResult();

  // English plan should be stripped — pas de salutation générique injectée ici
  assert.equal(result.currentResponse, "");
});

// Importation des agents et de la factory LLM pour mocker les dépendances
import { criticAgent } from "../src/agent/agents/criticAgent.js";
import { runPipeline } from "../src/agent/orchestrator/runPipeline.js";
import { getClientForModel } from "../src/llm/llmFactory.js";
import { routerAgent } from "../src/agent/agents/routerAgent.js";
import { retrievalAgent } from "../src/agent/agents/retrievalAgent.js";
import { finalRendererAgent } from "../src/agent/agents/finalRendererAgent.js";

test("criticAgent rejects draft with rejected_unsupported if claims lack fact_ids or hypothesis_ids", async () => {
  const queryEnvelope = {
    query_id: "q_unsupported_test",
    user_query: "Quelle est la vitesse de la Citadelle ?",
    context: {},
    constraints: {},
  };
  const draft = {
    question_reformulated: "Quelle est la vitesse de la Citadelle ?",
    answer_summary: "La Citadelle se déplace à une allure constante.",
    confirmed_section: [
      { text: "La Citadelle se déplace à une allure constante." },
    ],
    claim_map: [
      {
        claim_id: "claim_1",
        text: "La Citadelle se déplace à une allure constante.",
        section: "confirmed",
        // Aucun fact_ids ou hypothesis_ids fourni !
      },
    ],
  };

  // Mock le client LLM pour simuler un retour conforme mais invalide au niveau du claim
  const client = getClientForModel("deepseek-r1:8b");
  const originalChat = client.chat;
  client.chat = async () => {
    return JSON.stringify({
      report_id: "rep_test",
      query_id: "q_unsupported_test",
      status: "ok",
      overall_verdict: "approved", // L'évaluation brute simule une approbation
      summary: "Test evaluation",
      claim_reviews: [
        {
          claim_id: "claim_1",
          claim_text: "La Citadelle se déplace à une allure constante.",
          section: "confirmed",
          verdict: "unsupported",
          severity: "high",
          fact_ids: [],
          hypothesis_ids: [],
          reason: "Aucun support factuel trouvé",
        },
      ],
      required_fixes: [],
      approved_answer: {
        question_reformulated: "Quelle est la vitesse de la Citadelle ?",
        answer_summary: "Aucune information.",
        confirmed_section: [],
        probable_section: [],
        unknown_section: ["Inconnu"],
        next_checks: [],
      },
    });
  };

  try {
    const report = await criticAgent.review({
      queryEnvelope,
      draft,
      facts: [],
      hypotheses: [],
    });

    assert.equal(report.overall_verdict, "rejected_unsupported");
    assert.equal(report.approved_answer.confirmed_section.length, 0);
  } finally {
    client.chat = originalChat;
  }
});

test("runPipeline aborts early and returns failed_safe when RAG is empty", async () => {
  const queryEnvelope = {
    query_id: "q_empty_rag_test",
    user_query: "This query will simulate empty retrieval results.",
    context: {},
    constraints: {},
  };

  const originalPlan = routerAgent.plan;
  const originalCollect = retrievalAgent.collect;
  const originalRender = finalRendererAgent.render;

  routerAgent.plan = async () => ({
    route: "verified_pipeline",
    retrieval_count: 3,
  });
  retrievalAgent.collect = async () => []; // RAG vide
  finalRendererAgent.render = async () => ({
    rendered_text:
      "Cette information n'est pas disponible dans les archives de la Citadelle. 😄",
  });

  try {
    const result = await runPipeline(queryEnvelope);

    assert.equal(result.status, "failed_safe");
    assert.ok(result.response_text.includes("disponible dans les archives"));
  } finally {
    routerAgent.plan = originalPlan;
    retrievalAgent.collect = originalCollect;
    finalRendererAgent.render = originalRender;
  }
});

import webSearchSource from "../src/agent/retrieval/webSearchSource.js";
import { expertWebSearch } from "../src/agent/agents/expertWebSearch.js";

test("webSearchSource maps raw search results to EvidenceRecord schema correctly", async () => {
  const queryEnvelope = {
    query_id: "q_web_unit_test",
    user_query: "test query",
    context: {},
    constraints: {},
  };

  const originalRun = expertWebSearch.run;
  expertWebSearch.run = async () => ({
    expert: "expert_web_search",
    query: "test query",
    sources: [
      {
        title: "Wikipedia Test Page",
        url: "https://en.wikipedia.org/wiki/Test",
        snippet: "This is a test page snippet.",
        confidence: 0.85,
        consulted_at: "2026-05-18T19:00:00.000Z",
      },
    ],
    summary: "Wikipedia Test Page summary",
    confidence: 0.85,
    requires_human_caution: false,
    failure_mode: null,
  });

  try {
    const results = await webSearchSource.search(queryEnvelope);

    assert.equal(results.length, 1);
    const first = results[0];
    assert.equal(first.source_type, "web");
    assert.equal(first.source_name, "Wikipedia Test Page");
    assert.ok(first.content.includes("Snippet: This is a test page snippet."));
    assert.equal(first.locator.url, "https://en.wikipedia.org/wiki/Test");
    assert.equal(first.trust_level, "high");
  } finally {
    expertWebSearch.run = originalRun;
  }
});

test("retrievalAgent correctly invokes and reranks webSearchSource under verified pipeline", async () => {
  const queryEnvelope = {
    query_id: "q_web_integration_test",
    user_query: "test web query",
    context: {},
    constraints: {},
  };

  const retrievalPlan = {
    allowed_sources: ["web"],
    reasoning_budget: "medium",
  };

  const originalRun = expertWebSearch.run;
  expertWebSearch.run = async () => ({
    expert: "expert_web_search",
    query: "test web query",
    sources: [
      {
        title: "Secondary Page",
        url: "https://example.com/2",
        snippet: "Low confidence page.",
        confidence: 0.5,
        consulted_at: "2026-05-18T19:00:00.000Z",
      },
      {
        title: "Primary Trusted Page",
        url: "https://en.wikipedia.org/wiki/Primary",
        snippet: "Wikipedia high confidence page.",
        confidence: 0.9,
        consulted_at: "2026-05-18T19:00:00.000Z",
      },
    ],
    summary: "Web summary",
    confidence: 0.7,
    requires_human_caution: false,
    failure_mode: null,
  });

  try {
    const evidence = await retrievalAgent.collect({
      queryEnvelope,
      retrievalPlan,
    });

    assert.equal(evidence.length, 2);
    // Le premier résultat doit être Wikipedia en raison du score final plus élevé (trust_level high vs low)
    assert.equal(evidence[0].source_name, "Primary Trusted Page");
    assert.equal(evidence[0].trust_level, "high");
    assert.equal(evidence[1].source_name, "Secondary Page");
    assert.equal(evidence[1].trust_level, "low");
  } finally {
    expertWebSearch.run = originalRun;
  }
});
