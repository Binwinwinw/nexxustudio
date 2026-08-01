import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  PEDAGOGY_SOFT_CANONICAL_CANADA_QUERY,
  PEDAGOGY_SOFT_CANONICAL_REDIS_QUERY,
  PEDAGOGY_SOFT_CANONICAL_REVOLUTION_QUERY,
  PEDAGOGY_SOFT_CANONICAL_SCHOOL_QUERY,
  PEDAGOGY_SOFT_CANONICAL_VOLCANO_QUERY,
  isPedagogySoftOverviewSatisfiable,
  resolvePedagogySoftOverviewShortCircuit,
} from "../src/agent/policies/pedagogySoftOverviewPolicy.js";
import {
  isPedagogySoftOverviewRequest,
  parsePedagogySoftOverviewTask,
  PEDAGOGY_SOFT_DOMAINS,
} from "../src/agent/utils/pedagogySoftOverviewIntentGuards.js";
import { isTechnicalOverviewRequest } from "../src/agent/utils/technicalOverviewIntentGuards.js";
import { isPedagogicalOverviewRequest } from "../src/agent/utils/pedagogicalOverviewIntentGuards.js";
import { hasDocumentSynthesisShell } from "../src/agent/policies/document/index.js";
import {
  CLARIFICATION_DECISIONS,
  evaluateClarificationDecision,
} from "../src/agent/policies/clarificationDecisionPolicy.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { resolvePipelineFallback } from "../src/agent/utils/genericGreetingGuards.js";

describe("pedagogySoftOverviewPolicy — batterie #35", () => {
  it("Révolution française → pedagogy_soft_overview_deterministic", async () => {
    assert.equal(
      isPedagogySoftOverviewRequest(PEDAGOGY_SOFT_CANONICAL_REVOLUTION_QUERY),
      true,
    );
    const task = parsePedagogySoftOverviewTask(
      PEDAGOGY_SOFT_CANONICAL_REVOLUTION_QUERY,
    );
    assert.equal(task?.domain, PEDAGOGY_SOFT_DOMAINS.HISTORY);
    assert.match(task?.subject || "", /revolution francaise/);

    const hit = await runConversationShortCircuit(
      PEDAGOGY_SOFT_CANONICAL_REVOLUTION_QUERY,
    );
    assert.equal(hit?.path, "pedagogy_soft_overview_deterministic");
    assert.match(hit?.reply, /Révolution française|revolution francaise/i);
    assert.match(hit?.reply, /Bastille|1789/i);
    assert.match(hit?.reply, /approfondir un angle/i);
    assert.notEqual(hit?.path, "familiarity_domain_overview_deterministic");
  });

  it("géographie du Canada → pedagogy_soft, pas technical_overview", async () => {
    assert.equal(
      isPedagogySoftOverviewRequest(PEDAGOGY_SOFT_CANONICAL_CANADA_QUERY),
      true,
    );
    assert.equal(
      isTechnicalOverviewRequest(PEDAGOGY_SOFT_CANONICAL_CANADA_QUERY),
      false,
    );

    const hit = await runConversationShortCircuit(
      PEDAGOGY_SOFT_CANONICAL_CANADA_QUERY,
    );
    assert.equal(hit?.path, "pedagogy_soft_overview_deterministic");
    assert.match(hit?.reply, /Canada/i);
    assert.match(hit?.reply, /relief|climat/i);
  });

  it("volcans + l'essentiel → pedagogy_soft, pas document_synthesis", async () => {
    assert.equal(
      isPedagogySoftOverviewRequest(PEDAGOGY_SOFT_CANONICAL_VOLCANO_QUERY),
      true,
    );
    assert.equal(
      hasDocumentSynthesisShell(PEDAGOGY_SOFT_CANONICAL_VOLCANO_QUERY),
      false,
    );

    const hit = await runConversationShortCircuit(
      PEDAGOGY_SOFT_CANONICAL_VOLCANO_QUERY,
    );
    assert.equal(hit?.path, "pedagogy_soft_overview_deterministic");
    assert.match(hit?.reply, /volcan/i);
    assert.match(hit?.reply, /magma|tectonique/i);
  });

  it("curriculum scolaire 6e → pas pedagogy_soft", () => {
    assert.equal(
      isPedagogySoftOverviewRequest(PEDAGOGY_SOFT_CANONICAL_SCHOOL_QUERY),
      false,
    );
    assert.equal(
      isPedagogicalOverviewRequest(PEDAGOGY_SOFT_CANONICAL_SCHOOL_QUERY),
      true,
    );
    assert.equal(
      resolvePedagogySoftOverviewShortCircuit(
        PEDAGOGY_SOFT_CANONICAL_SCHOOL_QUERY,
      ),
      null,
    );
  });

  it("explique Redis → technical_overview, pas pedagogy_soft", () => {
    assert.equal(
      isPedagogySoftOverviewRequest(PEDAGOGY_SOFT_CANONICAL_REDIS_QUERY),
      false,
    );
    assert.equal(
      isTechnicalOverviewRequest(PEDAGOGY_SOFT_CANONICAL_REDIS_QUERY),
      true,
    );
  });

  it("clarification gate → can_answer_now + signal pedagogy_soft_overview", () => {
    const decision = evaluateClarificationDecision(
      PEDAGOGY_SOFT_CANONICAL_REVOLUTION_QUERY,
      [],
    );
    assert.equal(decision.decision, CLARIFICATION_DECISIONS.CAN_ANSWER_NOW);
    assert.equal(decision.reason, "pedagogy_soft_overview_answerable");
    assert.ok(decision.signals.includes("pedagogy_soft_overview"));
    assert.ok(!decision.signals.includes("subject_reference_resume"));
  });

  it("recovery empty_short_circuit → fiche structurée", () => {
    const reply = resolvePipelineFallback({
      query: PEDAGOGY_SOFT_CANONICAL_VOLCANO_QUERY,
      history: [],
      reason: "empty_short_circuit_llm",
    });
    assert.match(reply, /volcan/i);
    assert.match(reply, /essentiel|Définition/i);
  });
});
