import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  classifySummaryContract,
  assertInvariantSummaryContract,
  SUMMARY_INTENTS,
  SUMMARY_CONTRACTS,
  SUMMARY_RESOLUTION_STRATEGIES,
  SUMMARY_MISSING_REASONS,
  isSummaryKnownEntityContract,
} from "../src/agent/policies/summaryContractRouter.js";
import { resolveSummaryContractShortCircuit } from "../src/agent/policies/summaryContractShortCircuit.js";
import {
  buildSummaryContractTelemetry,
  recordSummaryContractTelemetry,
} from "../src/agent/telemetry/summaryContractTelemetry.js";
import {
  CLARIFICATION_DECISIONS,
  evaluateClarificationDecision,
} from "../src/agent/policies/clarificationDecisionPolicy.js";
import { evaluateJustIntent } from "../src/agent/policies/justIntentDetectionPolicy.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";

const INTERSTELLAR_QUERY =
  "pourrais-tu faire un résumé du film Interstellar ?";

const PASTED_BLOCK = `La Révolution française commence en 1789. Les États généraux se réunissent à Versailles. La prise de la Bastille marque un tournant décisif pour le peuple parisien.`;

const PASSAGE_QUERY = `Résume ce passage :\n\n${PASTED_BLOCK}`;

const INTERSTELLAR_PASSAGE_QUERY = `Résume ce passage sur Interstellar :\n\n${PASTED_BLOCK}`;

const MOCK_ATTACHMENT = Object.freeze([{ name: "chapitre3.pdf", type: "application/pdf" }]);

/**
 * @param {ReturnType<typeof classifySummaryContract>} contract
 * @param {{
 *   intent?: string,
 *   contract?: string,
 *   pipelinePath?: string,
 *   clarification?: boolean,
 *   forbidDocumentRequest?: boolean,
 *   resolutionStrategy?: string,
 *   missingReason?: string,
 * }} expect
 */
function assertSummaryContractExpectation(contract, expect) {
  assert.ok(contract, "contrat summary attendu");
  assertInvariantSummaryContract(contract);

  if (expect.intent) {
    assert.equal(contract.intent, expect.intent);
  }
  if (expect.contract) {
    assert.equal(contract.contract, expect.contract);
  }
  if (expect.pipelinePath) {
    assert.equal(contract.routing.pipelinePath, expect.pipelinePath);
  }
  if (expect.clarification !== undefined) {
    assert.equal(contract.clarification.needed, expect.clarification);
  }
  if (expect.forbidDocumentRequest !== undefined) {
    assert.equal(contract.routing.forbidDocumentRequest, expect.forbidDocumentRequest);
  }
  if (expect.resolutionStrategy) {
    assert.equal(contract.resolution.strategy, expect.resolutionStrategy);
  }
  if (expect.missingReason) {
    assert.equal(contract.source.missing_reason, expect.missingReason);
  }
}

/** @type {Array<{ id: string, query: string, attachments?: unknown[], expect: object, skipContract?: boolean }>} */
const CLASSIFICATION_BATTERY = [
  {
    id: "G38-T01",
    query: INTERSTELLAR_QUERY,
    expect: {
      intent: SUMMARY_INTENTS.KNOWN_ENTITY,
      contract: SUMMARY_CONTRACTS.DIRECT_SUMMARY,
      pipelinePath: "cultural_content_summary",
      clarification: false,
      forbidDocumentRequest: true,
      resolutionStrategy: SUMMARY_RESOLUTION_STRATEGIES.CULTURAL_ENTITY_DETECTED,
    },
  },
  {
    id: "G38-T02",
    query: "résume Dune",
    expect: {
      intent: SUMMARY_INTENTS.KNOWN_ENTITY,
      contract: SUMMARY_CONTRACTS.DIRECT_SUMMARY,
      pipelinePath: "cultural_content_summary",
      clarification: false,
      forbidDocumentRequest: true,
      resolutionStrategy: SUMMARY_RESOLUTION_STRATEGIES.SMART_DEFAULT_KNOWN_ENTITY,
    },
  },
  {
    id: "G38-T03",
    query: "fais un résumé de la série Breaking Bad",
    expect: {
      intent: SUMMARY_INTENTS.KNOWN_ENTITY,
      contract: SUMMARY_CONTRACTS.DIRECT_SUMMARY,
      pipelinePath: "cultural_content_summary",
      clarification: false,
      forbidDocumentRequest: true,
      resolutionStrategy: SUMMARY_RESOLUTION_STRATEGIES.CULTURAL_ENTITY_DETECTED,
    },
  },
  {
    id: "G38-T04",
    query: "résume le roman 1984",
    expect: {
      intent: SUMMARY_INTENTS.KNOWN_ENTITY,
      contract: SUMMARY_CONTRACTS.DIRECT_SUMMARY,
      pipelinePath: "cultural_content_summary",
      clarification: false,
      forbidDocumentRequest: true,
      resolutionStrategy: SUMMARY_RESOLUTION_STRATEGIES.CULTURAL_ENTITY_DETECTED,
    },
  },
  {
    id: "G38-T05",
    query: "synthèse du documentaire Cosmos",
    expect: {
      intent: SUMMARY_INTENTS.KNOWN_ENTITY,
      contract: SUMMARY_CONTRACTS.DIRECT_SUMMARY,
      pipelinePath: "cultural_content_summary",
      clarification: false,
      forbidDocumentRequest: true,
      resolutionStrategy: SUMMARY_RESOLUTION_STRATEGIES.CULTURAL_ENTITY_DETECTED,
    },
  },
  {
    id: "G38-T06",
    query: "résume l'histoire de la Révolution française",
    expect: {
      intent: SUMMARY_INTENTS.KNOWN_ENTITY,
      contract: SUMMARY_CONTRACTS.DIRECT_SUMMARY,
      pipelinePath: "cultural_content_summary",
      clarification: false,
      forbidDocumentRequest: true,
      resolutionStrategy: SUMMARY_RESOLUTION_STRATEGIES.SMART_DEFAULT_KNOWN_ENTITY,
    },
  },
  {
    id: "G38-T07",
    query: PASSAGE_QUERY,
    expect: {
      intent: SUMMARY_INTENTS.USER_PROVIDED_TEXT,
      contract: SUMMARY_CONTRACTS.TEXT_SUMMARY,
      pipelinePath: "document_synthesis_llm",
      clarification: false,
      forbidDocumentRequest: false,
      resolutionStrategy: SUMMARY_RESOLUTION_STRATEGIES.EXPLICIT_SOURCE_PROVIDED,
    },
  },
  {
    id: "G38-T08",
    query: "résume ce texte",
    expect: {
      intent: SUMMARY_INTENTS.USER_PROVIDED_TEXT,
      contract: SUMMARY_CONTRACTS.TEXT_SUMMARY,
      pipelinePath: "document_synthesis_clarify",
      clarification: true,
      forbidDocumentRequest: false,
      resolutionStrategy: SUMMARY_RESOLUTION_STRATEGIES.MISSING_SOURCE_CLARIFY,
    },
  },
  {
    id: "G38-T09",
    query: "résume ce texte",
    attachments: [...MOCK_ATTACHMENT],
    expect: {
      intent: SUMMARY_INTENTS.USER_PROVIDED_TEXT,
      contract: SUMMARY_CONTRACTS.TEXT_SUMMARY,
      pipelinePath: "document_synthesis_llm",
      clarification: false,
      forbidDocumentRequest: false,
      resolutionStrategy: SUMMARY_RESOLUTION_STRATEGIES.EXPLICIT_SOURCE_PROVIDED,
    },
  },
  {
    id: "G38-T10",
    query: "résume le document joint",
    attachments: [...MOCK_ATTACHMENT],
    expect: {
      intent: SUMMARY_INTENTS.USER_PROVIDED_TEXT,
      contract: SUMMARY_CONTRACTS.TEXT_SUMMARY,
      pipelinePath: "document_synthesis_llm",
      clarification: false,
      forbidDocumentRequest: false,
      resolutionStrategy: SUMMARY_RESOLUTION_STRATEGIES.EXPLICIT_SOURCE_PROVIDED,
    },
  },
  {
    id: "G38-T11",
    query: "résume ce passage",
    expect: {
      intent: SUMMARY_INTENTS.USER_PROVIDED_TEXT,
      contract: SUMMARY_CONTRACTS.TEXT_SUMMARY,
      pipelinePath: "document_synthesis_clarify",
      clarification: true,
      forbidDocumentRequest: false,
      resolutionStrategy: SUMMARY_RESOLUTION_STRATEGIES.MISSING_SOURCE_CLARIFY,
    },
  },
  {
    id: "G38-T12",
    query: "résume ce passage",
    expect: {
      missingReason: SUMMARY_MISSING_REASONS.DOCUMENT_ANCHOR_WITHOUT_CONTENT,
    },
  },
  {
    id: "G38-T13",
    query: "résume cette page https://example.com/article",
    expect: {
      intent: SUMMARY_INTENTS.WEB_PAGE,
      contract: SUMMARY_CONTRACTS.WEB_SUMMARY,
      pipelinePath: "document_synthesis_llm",
      clarification: false,
      forbidDocumentRequest: false,
      resolutionStrategy: SUMMARY_RESOLUTION_STRATEGIES.WEB_URL_DETECTED,
    },
  },
  {
    id: "G38-T14",
    query: "résume cette page",
    expect: {
      intent: SUMMARY_INTENTS.WEB_PAGE,
      contract: SUMMARY_CONTRACTS.WEB_SUMMARY,
      pipelinePath: "document_synthesis_clarify",
      clarification: true,
      forbidDocumentRequest: false,
      resolutionStrategy: SUMMARY_RESOLUTION_STRATEGIES.MISSING_SOURCE_CLARIFY,
    },
  },
  {
    id: "G38-T15",
    query: "résume cette page",
    expect: {
      missingReason: SUMMARY_MISSING_REASONS.URL_EXPECTED_ABSENT,
    },
  },
  {
    id: "G38-T16",
    query: "résume cet article : https://news.example.com/story",
    expect: {
      intent: SUMMARY_INTENTS.WEB_PAGE,
      contract: SUMMARY_CONTRACTS.WEB_SUMMARY,
      pipelinePath: "document_synthesis_llm",
      clarification: false,
      forbidDocumentRequest: false,
      resolutionStrategy: SUMMARY_RESOLUTION_STRATEGIES.WEB_URL_DETECTED,
    },
  },
  {
    id: "G38-T17",
    query: "résume le chapitre 3",
    attachments: [...MOCK_ATTACHMENT],
    expect: {
      intent: SUMMARY_INTENTS.EXCERPT_OR_CHAPTER,
      contract: SUMMARY_CONTRACTS.TEXT_SUMMARY,
      pipelinePath: "document_synthesis_llm",
      clarification: false,
      forbidDocumentRequest: false,
      resolutionStrategy: SUMMARY_RESOLUTION_STRATEGIES.EXCERPT_WITH_SOURCE,
    },
  },
  {
    id: "G38-T18",
    query: "résume le chapitre 3 de Dune",
    expect: {
      intent: SUMMARY_INTENTS.EXCERPT_OR_CHAPTER,
      contract: SUMMARY_CONTRACTS.TEXT_SUMMARY,
      pipelinePath: "document_synthesis_clarify",
      clarification: true,
      forbidDocumentRequest: false,
      resolutionStrategy: SUMMARY_RESOLUTION_STRATEGIES.EXCERPT_MISSING_SOURCE,
    },
  },
  {
    id: "G38-T19",
    query: "résume le chapitre 3 de Dune",
    expect: {
      missingReason: SUMMARY_MISSING_REASONS.CHAPTER_REFERENCE_WITHOUT_SOURCE,
    },
  },
  {
    id: "G38-T20",
    query: "résume ce livre",
    expect: {
      intent: SUMMARY_INTENTS.AMBIGUOUS,
      contract: SUMMARY_CONTRACTS.CLARIFY_SUMMARY_KIND,
      pipelinePath: "clarification_gate",
      clarification: true,
      forbidDocumentRequest: false,
      resolutionStrategy: SUMMARY_RESOLUTION_STRATEGIES.AMBIGUOUS_REQUIRES_CLARIFY,
    },
  },
  {
    id: "G38-T21",
    query: "résume ce livre",
    expect: {
      missingReason: SUMMARY_MISSING_REASONS.AMBIGUOUS_WORK_REFERENCE,
    },
  },
  {
    id: "G38-T22",
    query: "résume cette œuvre",
    expect: {
      intent: SUMMARY_INTENTS.AMBIGUOUS,
      contract: SUMMARY_CONTRACTS.CLARIFY_SUMMARY_KIND,
      pipelinePath: "clarification_gate",
      clarification: true,
      forbidDocumentRequest: false,
      resolutionStrategy: SUMMARY_RESOLUTION_STRATEGIES.AMBIGUOUS_REQUIRES_CLARIFY,
    },
  },
  {
    id: "G38-T23",
    query: INTERSTELLAR_PASSAGE_QUERY,
    expect: {
      intent: SUMMARY_INTENTS.USER_PROVIDED_TEXT,
      contract: SUMMARY_CONTRACTS.TEXT_SUMMARY,
      pipelinePath: "document_synthesis_llm",
      clarification: false,
      forbidDocumentRequest: false,
      resolutionStrategy: SUMMARY_RESOLUTION_STRATEGIES.EXPLICIT_SOURCE_PROVIDED,
    },
  },
  {
    id: "G38-T25",
    query: "résume",
    expect: {
      intent: SUMMARY_INTENTS.USER_PROVIDED_TEXT,
      pipelinePath: "document_synthesis_clarify",
      clarification: true,
      forbidDocumentRequest: false,
      resolutionStrategy: SUMMARY_RESOLUTION_STRATEGIES.MISSING_SOURCE_CLARIFY,
    },
  },
  {
    id: "G38-T26",
    query: "résume",
    expect: {
      missingReason: SUMMARY_MISSING_REASONS.SHELL_WITHOUT_ANY_SOURCE,
    },
  },
];

describe("G38 — classification pure (table-driven)", () => {
  for (const item of CLASSIFICATION_BATTERY) {
    it(`${item.id} — ${item.query.slice(0, 48)}`, () => {
      const contract = classifySummaryContract(item.query, {
        attachments: item.attachments || [],
      });
      assertSummaryContractExpectation(contract, item.expect);
    });
  }
});

describe("G38 — invariants transverses", () => {
  const KNOWN_ENTITY_QUERIES = [
    INTERSTELLAR_QUERY,
    "résume Dune",
    "fais un résumé de la série Breaking Bad",
    "résume le roman 1984",
    "synthèse du documentaire Cosmos",
    "résume l'histoire de la Révolution française",
    "pourrais-tu résumer interstellar stp",
    "summary of the matrix movie",
  ];

  for (const query of KNOWN_ENTITY_QUERIES) {
    it(`INV-1 — known_entity forbidDocumentRequest : ${query.slice(0, 40)}`, () => {
      const contract = classifySummaryContract(query);
      assert.ok(isSummaryKnownEntityContract(contract), `attendu known_entity pour: ${query}`);
      assert.equal(contract.routing.forbidDocumentRequest, true);
      assert.equal(contract.clarification.needed, false);
      assertInvariantSummaryContract(contract);
    });
  }

  it("INV-4 — precedence explicit source over known entity (G38-T23/T24)", () => {
    const contract = classifySummaryContract(INTERSTELLAR_PASSAGE_QUERY);
    assert.notEqual(contract.intent, SUMMARY_INTENTS.KNOWN_ENTITY);
    assert.equal(contract.intent, SUMMARY_INTENTS.USER_PROVIDED_TEXT);
    assert.equal(contract.routing.forbidDocumentRequest, false);
    assert.equal(contract.resolution.strategy, SUMMARY_RESOLUTION_STRATEGIES.EXPLICIT_SOURCE_PROVIDED);
  });

  it("runtime assertion — known_entity sans forbidDocumentRequest lève", () => {
    assert.throws(
      () =>
        assertInvariantSummaryContract({
          family: "summary",
          intent: SUMMARY_INTENTS.KNOWN_ENTITY,
          routing: { forbidDocumentRequest: false },
          clarification: { needed: false },
          source: { required: false, provided: false },
        }),
      /INV-1/,
    );
  });
});

describe("G38 — clarification gates", () => {
  it("G38-T27 — Interstellar → CAN_ANSWER_NOW (no downstream override)", () => {
    const contract = classifySummaryContract(INTERSTELLAR_QUERY);
    assert.equal(contract.routing.forbidDocumentRequest, true);

    const evaluation = evaluateJustIntent(INTERSTELLAR_QUERY);
    const decision = evaluateClarificationDecision(INTERSTELLAR_QUERY, evaluation);
    assert.equal(decision.decision, CLARIFICATION_DECISIONS.CAN_ANSWER_NOW);
    assert.ok(
      decision.signals.some((s) =>
        ["summary_known_entity_answerable", "cultural_content_summary_g37"].includes(s),
      ),
    );
    assert.ok(!decision.signals.includes("document_synthesis_missing_source"));
  });

  it("G38-T28 — Interstellar short-circuit pas document_synthesis_clarify", async () => {
    const hit = await runConversationShortCircuit(INTERSTELLAR_QUERY);
    assert.ok(hit);
    assert.equal(hit.path, "cultural_content_summary");
    assert.notEqual(hit.path, "document_synthesis_clarify");
  });

  it("G38-T29 — résume ce texte → summary_missing_source", () => {
    const contract = classifySummaryContract("résume ce texte");
    assert.equal(contract.clarification.needed, true);

    const decision = evaluateClarificationDecision("résume ce texte", evaluateJustIntent("résume ce texte"));
    assert.equal(decision.decision, CLARIFICATION_DECISIONS.NEEDS_CLARIFICATION);
    assert.ok(decision.signals.includes("summary_missing_source"));
  });

  it("G38-T30 — résume ce livre → options clarify known_entity | user_provided_text", () => {
    const contract = classifySummaryContract("résume ce livre");
    assert.equal(contract.intent, SUMMARY_INTENTS.AMBIGUOUS);
    assert.deepEqual(contract.clarification.options, [
      SUMMARY_INTENTS.KNOWN_ENTITY,
      SUMMARY_INTENTS.USER_PROVIDED_TEXT,
    ]);

    const decision = evaluateClarificationDecision("résume ce livre", evaluateJustIntent("résume ce livre"));
    assert.equal(decision.decision, CLARIFICATION_DECISIONS.NEEDS_CLARIFICATION);
    assert.ok(decision.signals.includes("summary_ambiguous_kind"));
  });

  it("seuls cas bloquants clarifient — known_entity jamais clarify", () => {
    const direct = CLASSIFICATION_BATTERY.filter(
      (item) => item.expect.clarification === false && item.expect.intent === SUMMARY_INTENTS.KNOWN_ENTITY,
    );
    for (const item of direct) {
      const contract = classifySummaryContract(item.query, {
        attachments: item.attachments || [],
      });
      assert.equal(contract.clarification.needed, false, item.id);
    }
  });
});

describe("G38 — télémétrie pipelineTelemetryCtx.summaryContract", () => {
  it("buildSummaryContractTelemetry — champs minimaux diagnostiques", () => {
    const contract = classifySummaryContract(INTERSTELLAR_QUERY);
    const telemetry = buildSummaryContractTelemetry(contract);

    assert.equal(telemetry.intent, SUMMARY_INTENTS.KNOWN_ENTITY);
    assert.equal(telemetry.contract, SUMMARY_CONTRACTS.DIRECT_SUMMARY);
    assert.equal(
      telemetry.resolutionStrategy,
      SUMMARY_RESOLUTION_STRATEGIES.CULTURAL_ENTITY_DETECTED,
    );
    assert.equal(telemetry.pipelinePath, "cultural_content_summary");
    assert.equal(telemetry.forbidDocumentRequest, true);
    assert.equal(telemetry.sourceProvided, false);
    assert.equal(telemetry.clarificationNeeded, false);
    assert.equal(telemetry.missingReason, null);
    assert.ok(telemetry.entityLabel);
  });

  it("recordSummaryContractTelemetry — injecte dans pipelineTelemetryCtx", () => {
    const contract = classifySummaryContract("résume ce texte");
    const pipelineTelemetryCtx = {};
    const payload = recordSummaryContractTelemetry({
      contract,
      phase: "classify",
      pipelineTelemetryCtx,
    });

    assert.equal(pipelineTelemetryCtx.summaryContract, payload);
    assert.equal(payload.missingReason, SUMMARY_MISSING_REASONS.DOCUMENT_ANCHOR_WITHOUT_CONTENT);
    assert.equal(payload.clarificationNeeded, true);
  });
});

describe("G38 — short-circuit piloté par contrat", () => {
  it("Interstellar → cultural_content_summary deferToLlm + summaryContractDriven", () => {
    const hit = resolveSummaryContractShortCircuit(INTERSTELLAR_QUERY);
    assert.ok(hit?.summaryContractDriven);
    assert.equal(hit.path, "cultural_content_summary");
    assert.equal(hit.deferToLlm, true);
    assert.equal(hit.summaryContract.intent, SUMMARY_INTENTS.KNOWN_ENTITY);
    assert.equal(hit.summaryContract.routing.forbidDocumentRequest, true);
  });

  it("passage collé → TEXT_SUMMARY document_synthesis_llm", () => {
    const hit = resolveSummaryContractShortCircuit(PASSAGE_QUERY);
    assert.equal(hit.path, "document_synthesis_llm");
    assert.ok(hit.deferToLlm || hit.reply);
    assert.equal(hit.summaryContract.contract, SUMMARY_CONTRACTS.TEXT_SUMMARY);
  });

  it("résume ce livre → clarification_gate avec reply", () => {
    const hit = resolveSummaryContractShortCircuit("résume ce livre");
    assert.equal(hit.path, "clarification_gate");
    assert.ok(hit.reply?.includes("résumé général"));
    assert.ok(hit.summaryContract.clarification.options.length >= 2);
  });

  it("runConversationShortCircuit consomme options.summaryContract", async () => {
    const contract = classifySummaryContract(INTERSTELLAR_QUERY);
    const hit = await runConversationShortCircuit(INTERSTELLAR_QUERY, { summaryContract: contract });
    assert.equal(hit.path, "cultural_content_summary");
    assert.equal(hit.summaryContract?.intent, SUMMARY_INTENTS.KNOWN_ENTITY);
    assert.equal(hit.summaryContractTelemetry?.forbidDocumentRequest, true);
  });
});
