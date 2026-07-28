import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  classifySummaryContract,
  SUMMARY_CONTRACTS,
  SUMMARY_INTENTS,
} from "../src/agent/policies/summaryContractRouter.js";
import { resolveSummaryContractShortCircuit } from "../src/agent/policies/summaryContractShortCircuit.js";
import {
  isKnownEntityDirectSummaryExecution,
  shouldEnforceKnownEntitySummaryTerminalLock,
  buildKnownEntitySummarySoberFallback,
  resolveKnownEntitySummaryCatchOutcome,
  resolveKnownEntityComposerGateOutcome,
  recordKnownEntitySummaryExecutionTelemetry,
  KNOWN_ENTITY_PIPELINE_PATH,
  KNOWN_ENTITY_FALLBACK_PIPELINE_PATH,
  KNOWN_ENTITY_EXECUTION_PATHS,
  KNOWN_ENTITY_CONTRACT_VIOLATIONS,
  countSummarySentences,
} from "../src/agent/policies/knownEntitySummaryExecutionPolicy.js";
import { validateKnownEntitySummaryReply } from "../src/agent/policies/knownEntitySummaryValidator.js";
import { buildCulturalContentSummarySystemAddon } from "../src/agent/micro/replies/generalKnowledgeComposerContract.js";

const IDIOCRACY_QUERY =
  "pourrais-tu faire un résumé du film idiocracy?";

const INTERSTELLAR_QUERY =
  "pourrais-tu faire un résumé du film Interstellar ?";

const IDIOCRACY_HALLUCINATION = `Oui, je connais Idiocrasie.
C'est quoi ? Idiocrasie est un film satirique sorti en 2006 réalisé par Mike Judge et étoffé par des voix talentueuses comme Adam Sandler.
Où ça vient ? Le film est né des esprits créatifs de Mike Judge et Bill Pillman.
Pourquoi c'est connu ? Il est célèbre pour son humour incisif.
Joe Bauers (voix d'Adam Sandler) devient la personne la plus intelligente grâce à un stimulant cognitif expérimental.`;

const IDIOCRACY_GOOD = `Idiocracy est une satire de Mike Judge (2006). Un soldat moyen, Joe Bauers, est cryogénisé et se réveille 500 ans plus tard dans un monde où l'intelligence moyenne a fortement chuté, ce qui fait de lui l'homme le plus intelligent du moment. Aux côtés de Rita, il tente de comprendre cette société absurde dominée par la consommation et les médias débiles.`;

function buildDirectSummaryShortCircuit(query = IDIOCRACY_QUERY) {
  const contract = classifySummaryContract(query);
  const hit = resolveSummaryContractShortCircuit(query, [], [], { contract });
  assert.ok(hit);
  return hit;
}

describe("G38.2 — execution lock", () => {
  it("isKnownEntityDirectSummaryExecution — true pour cultural_content_summary G38", () => {
    const hit = buildDirectSummaryShortCircuit(IDIOCRACY_QUERY);
    assert.equal(hit.path, KNOWN_ENTITY_PIPELINE_PATH);
    assert.equal(hit.summaryContract.contract, SUMMARY_CONTRACTS.DIRECT_SUMMARY);
    assert.equal(isKnownEntityDirectSummaryExecution(hit), true);
  });

  it("isKnownEntityDirectSummaryExecution — false hors known_entity", () => {
    assert.equal(
      isKnownEntityDirectSummaryExecution({ path: "guided_creation_scoping" }),
      false,
    );
  });

  /** @type {Array<{ id: string, query: string }>} */
  const TERMINAL_LOCK_BATTERY = [
    { id: "G38.2-T01", query: IDIOCRACY_QUERY },
    { id: "G38.2-T02", query: INTERSTELLAR_QUERY },
    { id: "G38.2-T03", query: "résume Dune" },
  ];

  for (const row of TERMINAL_LOCK_BATTERY) {
    it(`${row.id} shouldEnforceKnownEntitySummaryTerminalLock`, () => {
      const hit = buildDirectSummaryShortCircuit(row.query);
      assert.equal(shouldEnforceKnownEntitySummaryTerminalLock(hit), true);
    });
  }

  it("resolveKnownEntitySummaryCatchOutcome — SIMPLE_FAST throw → fallback borné", () => {
    const hit = buildDirectSummaryShortCircuit();
    const outcome = resolveKnownEntitySummaryCatchOutcome(
      new Error("SIMPLE_FAST_FAILED: timeout"),
      hit,
    );
    assert.ok(outcome);
    assert.equal(outcome.pipelinePath, KNOWN_ENTITY_FALLBACK_PIPELINE_PATH);
    assert.equal(
      outcome.reason,
      KNOWN_ENTITY_CONTRACT_VIOLATIONS.SIMPLE_FAST_FAILED,
    );
    assert.equal(outcome.executionPath, KNOWN_ENTITY_EXECUTION_PATHS.SIMPLE_FAST_FALLBACK);
    assert.equal(outcome.composerBypassed, true);
    assert.ok(outcome.validationIssues.includes("simple_fast_execution_failed"));
  });

  it("resolveKnownEntitySummaryCatchOutcome — throw hors known_entity → null", () => {
    const outcome = resolveKnownEntitySummaryCatchOutcome(
      new Error("SIMPLE_FAST_FAILED"),
      { path: "how_to_procedural" },
    );
    assert.equal(outcome, null);
  });

  it("resolveKnownEntityComposerGateOutcome — bloque escalade COMPOSER", () => {
    const hit = buildDirectSummaryShortCircuit();
    const telem = { summaryContract: { intent: SUMMARY_INTENTS.KNOWN_ENTITY, contract: SUMMARY_CONTRACTS.DIRECT_SUMMARY } };
    const outcome = resolveKnownEntityComposerGateOutcome(hit, telem);
    assert.ok(outcome);
    assert.equal(outcome.pipelinePath, KNOWN_ENTITY_FALLBACK_PIPELINE_PATH);
    assert.equal(
      outcome.contractViolation,
      KNOWN_ENTITY_CONTRACT_VIOLATIONS.COMPOSER_ESCALATION_BLOCKED,
    );
    assert.equal(outcome.executionPath, KNOWN_ENTITY_EXECUTION_PATHS.COMPOSER_LEAK_BLOCKED);
    assert.equal(outcome.composerBypassed, true);
  });

  it("buildKnownEntitySummarySoberFallback — refus sobre, pas invention", () => {
    const hit = buildDirectSummaryShortCircuit();
    const text = buildKnownEntitySummarySoberFallback(IDIOCRACY_QUERY, {
      summaryContract: hit.summaryContract,
    });
    assert.match(text, /synopsis fiable en local/i);
    assert.match(text, /idiocracy/i);
    assert.doesNotMatch(text, /adam sandler/i);
  });

  it("recordKnownEntitySummaryExecutionTelemetry — champs G38.2", () => {
    const metrics = new Map();
    const turnTelemetry = {
      setMetric(key, value) {
        metrics.set(key, value);
      },
    };
    const pipelineTelemetryCtx = { summaryContract: { intent: SUMMARY_INTENTS.KNOWN_ENTITY } };

    const payload = recordKnownEntitySummaryExecutionTelemetry({
      pipelineTelemetryCtx,
      turnTelemetry,
      executionPath: KNOWN_ENTITY_EXECUTION_PATHS.SIMPLE_FAST_TERMINAL,
      composerBypassed: true,
      validationIssues: [],
      sentenceCount: 4,
    });

    assert.equal(payload.summary_execution_path, "simple_fast_terminal");
    assert.equal(payload.composer_bypassed, true);
    assert.equal(payload.summary_response_sentence_count, 4);
    assert.equal(metrics.get("composer_bypassed"), true);
    assert.equal(metrics.get("summary_execution_path"), "simple_fast_terminal");
    assert.ok(pipelineTelemetryCtx.knownEntitySummaryExecution);
  });
});

describe("G38.2 — prompt borné", () => {
  it("buildCulturalContentSummarySystemAddon — 3-5 phrases, pas de rubriques encyclopédiques", () => {
    const addon = buildCulturalContentSummarySystemAddon(IDIOCRACY_QUERY);
    assert.match(addon, /3 à 5 phrases/i);
    assert.match(addon, /idiocracy/i);
    assert.match(addon, /INTERDIT/i);
    assert.match(addon, /C'est quoi/i);
    assert.match(addon, /casting|acteurs/i);
    assert.doesNotMatch(addon, /4 à 8 phrases/i);
    assert.doesNotMatch(addon, /d'où ça vient, pourquoi c'est connu/i);
  });
});

describe("G38.2 — validator factuel léger", () => {
  it("rejette hallucination Idiocracy prod (rubriques + casting + prémisse)", () => {
    const result = validateKnownEntitySummaryReply(IDIOCRACY_HALLUCINATION, {
      query: IDIOCRACY_QUERY,
      entityLabel: "idiocracy",
    });
    assert.equal(result.valid, false);
    assert.ok(result.issues.includes("known_entity_encyclopedic_rubric"));
    assert.ok(result.issues.includes("known_entity_speculative_premise"));
    assert.ok(result.issues.includes("known_entity_uncertain_casting"));
    assert.match(result.sanitized, /synopsis fiable en local/i);
  });

  it("accepte synopsis court factuel", () => {
    const result = validateKnownEntitySummaryReply(IDIOCRACY_GOOD, {
      query: IDIOCRACY_QUERY,
      entityLabel: "idiocracy",
    });
    assert.equal(result.valid, true);
    assert.equal(result.issues.length, 0);
    assert.equal(result.sanitized, IDIOCRACY_GOOD);
    assert.ok(result.sentenceCount >= 3 && result.sentenceCount <= 6);
  });

  it("countSummarySentences — compte les phrases", () => {
    assert.equal(countSummarySentences("Une phrase. Deux phrases."), 2);
  });
});
