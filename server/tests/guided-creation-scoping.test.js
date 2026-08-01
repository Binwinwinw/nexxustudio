import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isCodeCreateRequest,
  resolveCodeCreateLocalFallback,
} from "../src/agent/policies/codeCreateFallbackPolicy.js";
import {
  isGuidedCreationScopingRequest,
  isObviousCodeDeliverableRequest,
  extractCreationConstraints,
  buildGuidedCreationScopingSystemAddon,
  resolveGuidedCreationScopingShortCircuit,
} from "../src/agent/policies/guided/index.js";
import { isClearConstructiveDeliverable } from "../src/agent/policies/constructiveDeliveryPolicy.js";
import { isCodeGenerationRequest } from "../src/agent/policies/codeDeliveryPolicy.js";
import { isTechnicalOverviewRequest } from "../src/agent/utils/technicalOverviewIntentGuards.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { evaluateJustIntent } from "../src/agent/policies/justIntentDetectionPolicy.js";
import { INTENT_DOMAINS, INTENT_ACTIONS } from "../../shared/justIntentCatalog.js";
import {
  buildGuidedCreationRouteTelemetry,
  countBlockingQuestions,
  analyzeGuidedCreationResponse,
  recordGuidedCreationScopingTelemetry,
} from "../src/agent/telemetry/guidedCreationScopingTelemetry.js";

const PYTHON_AGENT_QUERY =
  "j'aimerais créer un agent IA en langage python tu pourrais m'aider à le faire ?";

const HTML_MEMBER_QUERY =
  "j'aimerais créer une application de gestion de carte de membre en html n'ayant pas beaucoup de membres on pourra gérer les données avec des json tu pourrais m'aider à le faire ?";

const PYTHON_TODO_QUERY =
  "tu saurais me fournir le code en python pour une todo-list qui fait des rappels avec une horloge numérique";

describe("guidedCreationScopingPolicy", () => {
  it("code/create agent Python → guided_creation_scoping + deferToLlm", async () => {
    const ji = evaluateJustIntent(PYTHON_AGENT_QUERY);
    assert.equal(ji.domain, INTENT_DOMAINS.CODE);
    assert.equal(ji.action, INTENT_ACTIONS.CREATE);
    assert.equal(isGuidedCreationScopingRequest(PYTHON_AGENT_QUERY), true);

    const hit = await runConversationShortCircuit(PYTHON_AGENT_QUERY);
    assert.equal(hit?.path, "guided_creation_scoping");
    assert.equal(hit?.deferToLlm, true);
    assert.equal(hit?.guidedCreationScoping, true);
    assert.notEqual(hit?.path, "architecture_design_deterministic");
    assert.notEqual(hit?.path, "technical_overview");
  });

  it("web_html/create carte membre JSON → guided_creation_scoping, pas web_project_scoping_clarify", async () => {
    const ji = evaluateJustIntent(HTML_MEMBER_QUERY);
    assert.equal(ji.domain, INTENT_DOMAINS.WEB_HTML);
    assert.equal(ji.action, INTENT_ACTIONS.CREATE);

    const constraints = extractCreationConstraints(HTML_MEMBER_QUERY);
    assert.ok(constraints.some((c) => c.key === "persistance"));
    assert.ok(constraints.some((c) => c.key === "domaine"));

    const hit = await runConversationShortCircuit(HTML_MEMBER_QUERY);
    assert.equal(hit?.path, "guided_creation_scoping");
    assert.equal(hit?.deferToLlm, true);
    assert.notEqual(hit?.path, "web_project_scoping_clarify");
  });

  it("contrat LLM interdit taxonomies génériques et matrices 3 approches", () => {
    const addon = buildGuidedCreationScopingSystemAddon(HTML_MEMBER_QUERY);
    assert.match(addon, /GUIDED_CREATION_SCOPING/i);
    assert.match(addon, /INTERDIT.*SharePoint/i);
    assert.match(addon, /INTERDIT.*3 approches/i);
    assert.match(addon, /AU MAXIMUM 2 questions/i);
    assert.match(addon, /persistance/i);
  });

  it("resolveGuidedCreationScopingShortCircuit expose reflectiveHint", () => {
    const hit = resolveGuidedCreationScopingShortCircuit(PYTHON_AGENT_QUERY);
    assert.equal(hit?.path, "guided_creation_scoping");
    assert.ok(hit?.reflectiveHint?.length > 80);
  });

  it("fallback déterministe reste disponible si LLM échoue (code/create)", () => {
    assert.equal(isCodeCreateRequest(PYTHON_AGENT_QUERY), true);
    const fallback = resolveCodeCreateLocalFallback(PYTHON_AGENT_QUERY);
    assert.ok(fallback);
    assert.ok(!fallback.includes("aperçu localement"));
  });

  it("explique Redis reste technical_overview", () => {
    assert.equal(isTechnicalOverviewRequest("explique Redis"), true);
    assert.equal(isGuidedCreationScopingRequest("explique Redis"), false);
  });

  it("todo Python + rappels + horloge — bypass scoping, livrable code direct", async () => {
    assert.equal(isObviousCodeDeliverableRequest(PYTHON_TODO_QUERY), true);
    assert.equal(isGuidedCreationScopingRequest(PYTHON_TODO_QUERY), false);
    assert.equal(resolveGuidedCreationScopingShortCircuit(PYTHON_TODO_QUERY), null);
    assert.equal(isCodeGenerationRequest(PYTHON_TODO_QUERY), true);
    assert.equal(isClearConstructiveDeliverable(PYTHON_TODO_QUERY), true);

    const hit = await runConversationShortCircuit(PYTHON_TODO_QUERY);
    assert.notEqual(hit?.path, "guided_creation_scoping");
  });
});

describe("guidedCreationScopingTelemetry", () => {
  it("constraints_extracted sur agent Python", () => {
    const route = buildGuidedCreationRouteTelemetry(PYTHON_AGENT_QUERY);
    assert.ok(route.constraints_extracted.length >= 2);
    assert.ok(route.constraints_extracted.some((c) => c.startsWith("langage:")));
    assert.ok(route.constraints_extracted.some((c) => c.startsWith("cible:")));
  });

  it("blocking_questions_count — respecte budget 2", () => {
    const good =
      "Tu veux un agent CLI ou avec mémoire ?\nEt tu vises un modèle local ou une API ?";
    const bad =
      "1) Quel langage ?\n2) Quel framework ?\n3) Quelle base ?\n4) Quel hébergeur ?";
    assert.equal(countBlockingQuestions(good), 2);
    assert.ok(countBlockingQuestions(bad) > 2);
  });

  it("détecte drift taxonomie générique hors contexte", () => {
    const analysis = analyzeGuidedCreationResponse(
      "Tu veux SharePoint, WordPress ou un intranet ?",
      HTML_MEMBER_QUERY,
      extractCreationConstraints(HTML_MEMBER_QUERY),
    );
    assert.ok(analysis.drift_signals.includes("generic_taxonomy"));
    assert.equal(analysis.contract_compliant, false);
  });

  it("recordGuidedCreationScopingTelemetry route + served", () => {
    const metrics = {};
    const ctx = { guidedCreationScoping: {} };
    const turnTelemetry = {
      setMetric: (key, value) => {
        metrics[key] = value;
      },
    };

    recordGuidedCreationScopingTelemetry({
      query: HTML_MEMBER_QUERY,
      phase: "route",
      turnTelemetry,
      pipelineTelemetryCtx: ctx,
    });
    assert.ok(Array.isArray(metrics.constraints_extracted));
    assert.ok(metrics.constraints_count >= 3);

    recordGuidedCreationScopingTelemetry({
      query: HTML_MEMBER_QUERY,
      text:
        "Oui, HTML + JSON convient pour peu de membres. On peut structurer un CRUD simple. " +
        "Tu veux aussi l'export PDF des cartes ?",
      phase: "served",
      turnTelemetry,
      pipelineTelemetryCtx: ctx,
    });
    assert.equal(metrics.blocking_questions_count, 1);
    assert.equal(metrics.guided_creation_compliant, true);
    assert.equal(ctx.guidedCreationScoping.has_concrete_next_step, true);
  });
});
