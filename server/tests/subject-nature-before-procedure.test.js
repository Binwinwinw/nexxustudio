import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  extractProcedureTargetSubject,
  evaluateProcedureSubjectNatureGate,
  SUBJECT_NATURES,
  buildSubjectInterpretedState,
} from "../src/agent/micro/subject/subjectNatureResolver.js";
import { lookupKnownEntity } from "../src/agent/micro/subject/knownEntityQuickLookup.js";
import { resolveProcedureShortCircuit } from "../src/agent/micro/replies/procedureReplyBuilder.js";
import { normalizeSubject } from "../src/agent/micro/subject/subjectNormalizer.js";
import { SUBJECT_CONFIDENCE } from "../src/agent/micro/subject/subjectConfidence.js";
import { USAGE_INTENTS } from "../src/agent/micro/subject/subjectUsageIntent.js";
import { ENTITY_IDS } from "../src/agent/micro/subject/subjectEntityIds.js";
import { evaluateAmbiguityContract } from "../src/agent/micro/subject/subjectAmbiguityContract.js";
import { planProcedureIntent, SUBJECT_ROUTER_ACTIONS } from "../src/agent/micro/subject/subjectIntentRouter.js";
import { resolveDeterministicRouteHint, DETERMINISTIC_ROUTES } from "../src/agent/micro/subject/subjectRoutingHints.js";
import {
  clearSubjectSessionMemory,
  extractAndRememberProjectAnchor,
} from "../src/agent/micro/subject/subjectSessionMemory.js";
import { detectMixedDomainSignals } from "../src/agent/micro/subject/subjectDomainSignals.js";
import { DELIBERATION_MODES } from "../src/agent/micro/subject/subjectDeliberationPolicy.js";
import { resolveMiniResearch } from "../src/agent/micro/subject/miniResearchGate.js";
import { isThinGenericProcedureReply } from "../src/agent/micro/replies/procedureReplyBuilder.js";

const SESSION = "test-subject-memory";
const MIXED_QUERY =
  "comment faire pour lancer un projet qui déclenche le jeu need for speed";

beforeEach(() => {
  clearSubjectSessionMemory(SESSION);
});

describe("mixed domain — projet + NFS", () => {
  it("détecte collision interne + public", () => {
    const mixed = detectMixedDomainSignals(MIXED_QUERY);
    assert.equal(mixed.mixedDomain, true);
    assert.ok(mixed.publicEntities.length >= 1);
  });

  it("nature composite_mixed + délibération mini", async () => {
    const interpreted = buildSubjectInterpretedState({ query: MIXED_QUERY });
    assert.equal(interpreted.state.nature, SUBJECT_NATURES.COMPOSITE_MIXED);
    assert.equal(interpreted.policy.deliberationMode, DELIBERATION_MODES.MINI);
    assert.equal(interpreted.policy.requiresReasonedReply, true);
  });

  it("ne renvoie pas la procédure générale vide", async () => {
    const hit = await resolveProcedureShortCircuit(MIXED_QUERY);
    assert.ok(hit);
    assert.notEqual(hit.path, "procedure_deterministic");
    assert.doesNotMatch(hit.reply, /procédure générale applicable/i);
    assert.match(hit.reply, /Need for Speed|deux registres|projet/i);
  });

  it("gate async bloque allowProcedure", async () => {
    const gate = await evaluateProcedureSubjectNatureGate(MIXED_QUERY);
    assert.equal(gate.allowProcedure, false);
    assert.ok(gate.deliberation?.enrichedReply || gate.reply);
  });
});

describe("resolvedEntityId ≠ canonical", () => {
  it("nfs canonical pointe vers ID jeu stable", () => {
    const hit = lookupKnownEntity("nfs");
    assert.equal(normalizeSubject("nfs").canonical, "need for speed");
    assert.equal(hit.resolvedEntityId, ENTITY_IDS.PUBLIC_GAME_NFS);
  });
});

describe("ambiguity contract", () => {
  it("eclipse → mustClarify", () => {
    const interpreted = buildSubjectInterpretedState({
      query: "comment lancer eclipse",
    });
    assert.equal(interpreted.ambiguity.mustClarify, true);
  });

  it("NFS seul → allowDirectAnswer", () => {
    const interpreted = buildSubjectInterpretedState({
      query: "comment faire pour lancer Need for Speed",
    });
    assert.equal(interpreted.ambiguity.allowDirectAnswer, true);
  });
});

describe("intent router + route hints", () => {
  it("NFS execute_launch → launcher_guide_builder", () => {
    const interpreted = buildSubjectInterpretedState({
      query: "comment faire pour lancer Need for Speed",
    });
    assert.equal(
      resolveDeterministicRouteHint(interpreted.state),
      DETERMINISTIC_ROUTES.LAUNCHER_GUIDE_BUILDER,
    );
    assert.equal(interpreted.state.usage, USAGE_INTENTS.EXECUTE_LAUNCH);
  });
});

describe("session memory — Atlas", () => {
  it("projet Atlas puis lance Atlas → interne rappelé", () => {
    extractAndRememberProjectAnchor("le projet Atlas", SESSION);
    const interpreted = buildSubjectInterpretedState({
      query: "comment lancer Atlas",
      sessionId: SESSION,
    });
    assert.equal(interpreted.state.nature, SUBJECT_NATURES.INTERNAL_STUDIO);
    assert.equal(interpreted.state.memoryRecall, true);
  });
});

describe("procedure gate", () => {
  it("projet forge → allow_procedure", async () => {
    const gate = await evaluateProcedureSubjectNatureGate(
      "comment faire pour lancer un projet qui déclenche la forge",
    );
    assert.equal(gate.allowProcedure, true);
    assert.equal(gate.plan?.action, SUBJECT_ROUTER_ACTIONS.ALLOW_PROCEDURE);
  });

  it("eclipse → disambiguate", async () => {
    const gate = await evaluateProcedureSubjectNatureGate("comment lancer eclipse");
    assert.equal(gate.allowProcedure, false);
    assert.equal(gate.plan?.action, SUBJECT_ROUTER_ACTIONS.DISAMBIGUATE);
  });
});

describe("thin generic blocker", () => {
  it("repère procédure générale pauvre", () => {
    assert.ok(
      isThinGenericProcedureReply(
        "Voici une procédure générale applicable : 1. Clarifier l'objectif",
      ),
    );
  });
});
