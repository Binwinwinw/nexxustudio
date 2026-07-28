import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

import {
  setLexiconLearningDataDir,
  invalidatePromotedLexiconCache,
  getPromotedLexiconMap,
  readLexiconProposals,
  readLexiconLearningEvents,
} from "../src/agent/micro/lexicon/lexiconLearningStore.js";
import { assessLexiconPromotionCandidate, LEXICON_GATE_DECISIONS } from "../src/agent/micro/lexicon/lexiconPromotionGate.js";
import { observeLexiconLearning } from "../src/agent/micro/lexicon/lexiconLearningOrchestrator.js";
import { getFamiliarityDeterministicReply, hasStaticLexiconEntry } from "../src/agent/utils/familiarityIntentGuards.js";
import { LEXICON_PROPOSAL_STATUS } from "../src/agent/micro/lexicon/subjectPromotionCandidateBuilder.js";

let tempDir = "";

function enableLexiconLearning() {
  process.env.LEXICON_LEARNING = "1";
}

function disableLexiconLearning() {
  delete process.env.LEXICON_LEARNING;
}

function carnavalSubject() {
  return {
    label: "Le carnaval",
    known: false,
    category: "unknown_subject",
    subjectShape: "cultural_event_or_festival",
    resolutionMode: "inferred",
    definition:
      "fête ou tradition culturelle — autour de Le carnaval, on retrouve des coutumes, des symboles et des célébrations familières.",
  };
}

function observeCarnaval(sessionId, query = "Tu connais le carnaval ?") {
  return observeLexiconLearning({
    query,
    parsed: { rawSubject: "le carnaval", kind: "recognition" },
    subject: carnavalSubject(),
    sessionId,
    hasStaticLexiconEntry,
  });
}

describe("lexicon promotion — gate", () => {
  it("observe seulement avec une occurrence", () => {
    const gate = assessLexiconPromotionCandidate(
      {
        id: "lexprop_carnaval",
        canonicalKey: "carnaval",
        subjectShape: "cultural_event_or_festival",
        occurrences: 1,
        distinctSessions: 1,
      },
      { hasStaticLexiconEntry },
    );
    assert.equal(gate.decision, LEXICON_GATE_DECISIONS.OBSERVE_ONLY);
  });

  it("auto-promotion faible risque après 3 occurrences", () => {
    const gate = assessLexiconPromotionCandidate(
      {
        id: "lexprop_carnaval",
        canonicalKey: "carnaval",
        subjectShape: "cultural_event_or_festival",
        occurrences: 3,
        distinctSessions: 1,
        aliases: ["carnaval", "le carnaval"],
      },
      { hasStaticLexiconEntry },
    );
    assert.equal(gate.decision, LEXICON_GATE_DECISIONS.AUTO_PROMOTED);
    assert.ok(gate.confidence >= 0.72);
  });

  it("propose sans auto-promotion pour sujet générique", () => {
    const gate = assessLexiconPromotionCandidate(
      {
        id: "lexprop_xyz",
        canonicalKey: "xyztopic",
        subjectShape: "generic_topic",
        occurrences: 4,
        distinctSessions: 2,
      },
      { hasStaticLexiconEntry },
    );
    assert.equal(gate.decision, LEXICON_GATE_DECISIONS.PROPOSED);
    assert.ok(gate.reasons.includes("review_required_shape"));
  });
});

describe("lexicon learning — orchestrateur", () => {
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lexicon-learning-"));
    setLexiconLearningDataDir(tempDir);
    invalidatePromotedLexiconCache();
    enableLexiconLearning();
  });

  afterEach(() => {
    disableLexiconLearning();
    invalidatePromotedLexiconCache();
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("journalise puis auto-promotion après 3 observations carnaval", () => {
    observeCarnaval("sess-a");
    observeCarnaval("sess-a", "est-ce que tu connais le carnaval");
    const third = observeCarnaval("sess-b", "tu connais le carnaval ?");

    assert.equal(third.gate.decision, LEXICON_GATE_DECISIONS.AUTO_PROMOTED);

    const promoted = getPromotedLexiconMap();
    assert.ok(promoted.carnaval);
    assert.equal(promoted.carnaval.label, "Le carnaval");
    assert.equal(promoted.carnaval.source, "governed_auto_promotion");

    const proposals = readLexiconProposals();
    assert.equal(proposals.lexprop_carnaval.status, LEXICON_PROPOSAL_STATUS.PROMOTED);

    const events = readLexiconLearningEvents(10);
    assert.ok(events.some((e) => e.type === "promoted" && e.canonicalKey === "carnaval"));
  });

  it("résout le sujet promu comme connu au tour suivant", () => {
    observeCarnaval("sess-a");
    observeCarnaval("sess-a");
    observeCarnaval("sess-b");

    invalidatePromotedLexiconCache();

    const reply = getFamiliarityDeterministicReply("Tu connais le carnaval ?", {
      lexiconLearning: false,
    });
    assert.match(reply, /je connais/i);
    assert.match(reply, /carnaval/i);
  });

  it("reste inactif si LEXICON_LEARNING désactivé", () => {
    disableLexiconLearning();
    const out = observeCarnaval("sess-a");
    assert.equal(out, null);
    assert.equal(Object.keys(getPromotedLexiconMap()).length, 0);
  });
});
