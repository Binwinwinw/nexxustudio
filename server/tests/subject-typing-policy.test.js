import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  SUBJECT_OBJECT_TYPES,
  buildSubjectTypeClarifyReply,
  classifySubjectCategoryExtended,
  mapObjectTypeToSubjectCategory,
  matchSubjectTypeSlot,
  resolveSubjectTyping,
  resolveSubjectTypingFromQuery,
  resumeSubjectTypeClarification,
} from "../src/agent/policies/qualification/subjectTypingPolicy.js";
import { classifySubjectCategory, SUBJECT_CATEGORIES } from "../src/agent/utils/familiarityIntentGuards.js";
import { buildFamiliarityReply } from "../src/agent/micro/replies/familiarityReplyBuilder.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { resumePendingClarification } from "../src/agent/policies/qualification/pendingClarificationResumePolicy.js";

describe("subjectTypingPolicy — batterie #28", () => {
  it("Jaguar → candidates vehicle/animal/brand + disambiguation", () => {
    const typing = resolveSubjectTyping("Jaguar");
    assert.equal(typing.subject_value, "Jaguar");
    assert.deepEqual(typing.subject_type_candidates, [
      "vehicle",
      "animal",
      "brand",
    ]);
    assert.equal(typing.requires_subject_disambiguation, true);
    const clarify = buildSubjectTypeClarifyReply(typing);
    assert.match(clarify, /Jaguar/i);
    assert.match(clarify, /voiture|automobile/i);
    assert.match(clarify, /animal|félin/i);
  });

  it("Solana → crypto_asset ou place", () => {
    const typing = resolveSubjectTyping("Solana");
    assert.equal(typing.requires_subject_disambiguation, true);
    assert.ok(typing.subject_type_candidates.includes("crypto_asset"));
    assert.ok(typing.subject_type_candidates.includes("place"));
  });

  it("Dior → fashion_house / brand / person", () => {
    const typing = resolveSubjectTyping("Dior");
    assert.equal(typing.requires_subject_disambiguation, true);
    assert.equal(typing.subject_type_candidates.length, 3);
  });

  it("Italie → pas d'ambiguïté de type", () => {
    const typing = resolveSubjectTyping("Italie");
    assert.equal(typing.requires_subject_disambiguation, false);
  });

  it("mapObjectTypeToSubjectCategory — vehicle → person_entity", () => {
    assert.equal(
      mapObjectTypeToSubjectCategory(SUBJECT_OBJECT_TYPES.VEHICLE),
      SUBJECT_CATEGORIES.PERSON_ENTITY,
    );
  });

  it("classifySubjectCategory étendu via objectType", () => {
    assert.equal(
      classifySubjectCategory({ objectType: "vehicle", label: "Jaguar" }),
      SUBJECT_CATEGORIES.PERSON_ENTITY,
    );
    assert.equal(
      classifySubjectCategoryExtended({ objectType: "crypto_asset" }),
      SUBJECT_CATEGORIES.CONCEPT_METHOD,
    );
  });

  it("matchSubjectTypeSlot — voiture → vehicle", () => {
    const slot = matchSubjectTypeSlot("je parle de la voiture", {
      topic: "jaguar",
      candidateSlots: ["vehicle", "animal", "brand"],
    });
    assert.equal(slot, "vehicle");
  });
});

describe("subjectTypingPolicy — intégration short-circuit + resume", () => {
  it("tu connais Jaguar → clarification type (familiarity)", () => {
    const reply = buildFamiliarityReply("tu connais Jaguar ?");
    assert.ok(reply);
    assert.match(reply, /en tant que/i);
    assert.match(reply, /Jaguar/i);
  });

  it("infos sur Jaguar → subject_type_clarify (info-seeking)", async () => {
    const hit = await runConversationShortCircuit(
      "quelles informations as-tu sur Jaguar",
    );
    assert.equal(hit?.path, "subject_type_clarify");
    assert.match(hit?.reply, /Jaguar/i);
  });

  it("reprise après clarification Jaguar voiture", () => {
    const history = [
      { role: "user", content: "tu connais Jaguar ?" },
      {
        role: "assistant",
        content:
          "Tu parles de **Jaguar** en tant que voiture / marque automobile, animal ou marque ?\nPrécise le type visé et je réponds sur la bonne piste.",
      },
    ];
    const resumed = resumePendingClarification("la marque automobile", history);
    assert.equal(resumed.status, "clarification_resolved");
    assert.equal(resumed.slotFilled, "vehicle");
    assert.match(resumed.reply, /automobile|Jaguar/i);
  });

  it("reprise Solana crypto", () => {
    const typing = resolveSubjectTyping("Solana");
    const clarify = buildSubjectTypeClarifyReply(typing);
    const history = [
      { role: "user", content: "infos sur Solana" },
      { role: "assistant", content: clarify },
    ];
    const resumed = resumePendingClarification("la blockchain crypto", history);
    assert.equal(resumed.status, "clarification_resolved");
    assert.equal(resumed.slotFilled, "crypto_asset");
    assert.match(resumed.reply, /Solana/i);
  });
});

describe("subjectTypingPolicy — resumeSubjectTypeClarification direct", () => {
  it("animal jaguar", () => {
    const out = resumeSubjectTypeClarification("le felin", {
      topic: "jaguar",
      candidateSlots: ["vehicle", "animal", "brand"],
    });
    assert.equal(out.slotFilled, "animal");
    assert.match(out.reply, /félin|jaguar/i);
  });
});
