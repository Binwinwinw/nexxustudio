import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  classifyUnknownSubjectShape,
  enrichSubjectResolution,
  extractCandidateSubject,
  SUBJECT_RESOLUTION_MODES,
  SUBJECT_SHAPES,
} from "../src/agent/micro/classifiers/subjectUnderstanding.js";
import {
  getFamiliarityDeterministicReply,
  resolveKnownOrUnknownSubject,
  resolveSubjectFromLabel,
} from "../src/agent/utils/familiarityIntentGuards.js";
import { getFamiliarityFollowupDeterministicReply } from "../src/agent/utils/familiarityFollowupGuards.js";

describe("subject understanding — shape & inférence", () => {
  it("classifie un événement culturel inconnu", () => {
    assert.equal(
      classifyUnknownSubjectShape("carnaval", "le carnaval"),
      SUBJECT_SHAPES.CULTURAL_EVENT,
    );
  });

  it("classifie un sport inconnu", () => {
    assert.equal(
      classifyUnknownSubjectShape("handball", "le handball"),
      SUBJECT_SHAPES.SPORT_OR_GAME,
    );
  });

  it("enrichit un sujet inconnu avec définition inférée", () => {
    const enriched = enrichSubjectResolution(
      { label: "le carnaval", known: false, definition: null },
      "carnaval",
    );
    assert.equal(enriched.resolutionMode, SUBJECT_RESOLUTION_MODES.INFERRED);
    assert.equal(enriched.subjectShape, SUBJECT_SHAPES.CULTURAL_EVENT);
    assert.ok(enriched.definition);
    assert.match(enriched.definition, /fête|tradition|culturelle/i);
  });

  it("conserve le lexique quand disponible", () => {
    const enriched = enrichSubjectResolution(
      {
        label: "la pétanque",
        known: true,
        definition: "sport de boules provençal",
      },
      "petanque",
    );
    assert.equal(enriched.resolutionMode, SUBJECT_RESOLUTION_MODES.LEXICON);
    assert.equal(enriched.definition, "sport de boules provençal");
  });
});

describe("subject understanding — flux familiarité sans lexique", () => {
  it("carnaval — reconnaissance + aperçu après oui", () => {
    const proposal = getFamiliarityDeterministicReply("Tu connais le carnaval ?");
    assert.match(proposal, /je connais/i);
    assert.match(proposal, /carnaval/i);
    assert.match(proposal, /Tu veux que je t'en parle rapidement/i);

    const history = [
      { role: "user", content: "Tu connais le carnaval ?" },
      { role: "assistant", content: proposal },
    ];
    const reply = getFamiliarityFollowupDeterministicReply("oui", history);
    assert.match(reply, /D'accord, voici un aperçu rapide/i);
    assert.match(reply, /carnaval/i);
    assert.match(reply, /fête|tradition|culturelle/i);
    assert.doesNotMatch(reply, /De quoi veux-tu partir/i);
  });

  it("handball — sujet sport inféré", () => {
    const subject = resolveKnownOrUnknownSubject("le handball");
    assert.equal(subject.resolutionMode, SUBJECT_RESOLUTION_MODES.INFERRED);
    assert.equal(subject.subjectShape, SUBJECT_SHAPES.SPORT_OR_GAME);
    assert.ok(subject.definition);
  });

  it("resolveSubjectFromLabel infère kermesse sans entrée lexique", () => {
    const subject = resolveSubjectFromLabel("la kermesse");
    assert.ok(subject);
    assert.equal(subject.resolutionMode, SUBJECT_RESOLUTION_MODES.INFERRED);
    assert.match(subject.definition, /fête|tradition/i);
  });

  it("extractCandidateSubject isole l'entité principale", () => {
    const { candidate, normalized } = extractCandidateSubject("tu connais le carnaval de nice");
    assert.match(candidate, /carnaval/i);
    assert.ok(normalized);
  });
});
