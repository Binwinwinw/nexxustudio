import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import {
  beginSessionWorkTurn,
  commitSessionWorkTurn,
  clearSessionWorkMemoryForTests,
  createEmptySessionWorkMemory,
} from "../src/agent/memory/sessionWorkMemory.js";
import {
  DOCUMENTARY_MANDATE_PATH,
  buildDocumentaryMandate,
  readDocumentaryMandate,
  resolveDocumentaryMandateForCommit,
} from "../src/agent/policies/conversation/documentaryMandatePolicy.js";
import { assessConversationTopicShift } from "../src/agent/micro/continuity/topicShiftGuard.js";
import { extractCreateGoalFromText } from "../src/agent/policies/conversation/activeGoalPolicy.js";

const TEST_SESSION = "test-documentary-mandate-session";

const FIRST_ACT_QUERY = "je veux faire des fiches pédagogiques";
const SUBJECT_FOLLOWUP = "À propos du logiciel Hermès Desktop";
const WEB_FOLLOWUP =
  "À propos du logiciel Hermès Desktop, si tu ne connais pas cherche sur le web";
const NAMED_CREATE_QUERY =
  "je veux créer une carte de visite avec mes coordonnées";
const HTML_CREATE_QUERY =
  "crée un fichier HTML avec une sidebar et un header";
const WORKSHOP_QUERY =
  "préparer un atelier formation avec objectifs et déroulé pour les animateurs";
const CULINARY_QUERY = "donne-moi une recette de bourguignon carbonara";

const CONSUMER_TECH_HISTORY = [
  { role: "user", content: "comparatif iphone vs galaxy flagship" },
  { role: "assistant", content: "Les deux restent des smartphones haut de gamme." },
];

function persistFromHit(sessionId, shortCircuit, query = FIRST_ACT_QUERY) {
  return commitSessionWorkTurn({
    sessionId,
    turnTimestamp: new Date("2026-09-27T12:00:00.000Z").toISOString(),
    query,
    documentaryMandate: resolveDocumentaryMandateForCommit({
      shortCircuit,
      query,
      history: [],
      priorState: createEmptySessionWorkMemory(sessionId),
    }),
  });
}

describe("documentaryMandate — session continuity", () => {
  beforeEach(() => {
    clearSessionWorkMemoryForTests(TEST_SESSION);
  });

  it("1–2. path first-act persiste le sibling, sans dépendre du reply", async () => {
    const hit = await runConversationShortCircuit(FIRST_ACT_QUERY);
    assert.equal(hit?.path, DOCUMENTARY_MANDATE_PATH);
    const saved = persistFromHit(TEST_SESSION, { path: hit.path });
    assert.deepEqual(saved.documentaryMandate, buildDocumentaryMandate());
    assert.equal(saved.documentaryMandate.source, DOCUMENTARY_MANDATE_PATH);
    assert.equal(saved.documentaryMandate.reply, undefined);
    assert.equal(saved.documentaryMandate.query, undefined);
  });

  it("3. beginSessionWorkTurn restitue le mandat dans priorState", async () => {
    const hit = await runConversationShortCircuit(FIRST_ACT_QUERY);
    persistFromHit(TEST_SESSION, { path: hit.path });
    const next = beginSessionWorkTurn({
      sessionId: TEST_SESSION,
      now: new Date("2026-09-27T12:01:00.000Z"),
    });
    assert.deepEqual(
      readDocumentaryMandate(next.priorState),
      buildDocumentaryMandate(),
    );
  });

  it("4. un tour qui apporte un sujet conserve le mandat", async () => {
    persistFromHit(TEST_SESSION, { path: DOCUMENTARY_MANDATE_PATH });
    const prior = beginSessionWorkTurn({
      sessionId: TEST_SESSION,
      now: new Date("2026-09-27T12:02:00.000Z"),
    }).priorState;
    const next = resolveDocumentaryMandateForCommit({
      shortCircuit: { path: "information_seeking_full_pipeline" },
      query: SUBJECT_FOLLOWUP,
      history: [
        { role: "user", content: FIRST_ACT_QUERY },
        { role: "assistant", content: "D'accord, on peut construire des fiches." },
      ],
      priorState: prior,
    });
    assert.deepEqual(next, buildDocumentaryMandate());
  });

  it("5. une demande web liée conserve le mandat, sans pipeline web", async () => {
    persistFromHit(TEST_SESSION, { path: DOCUMENTARY_MANDATE_PATH });
    const prior = beginSessionWorkTurn({
      sessionId: TEST_SESSION,
      now: new Date("2026-09-27T12:03:00.000Z"),
    }).priorState;
    const next = resolveDocumentaryMandateForCommit({
      shortCircuit: { path: "information_seeking_full_pipeline" },
      query: WEB_FOLLOWUP,
      history: [
        { role: "user", content: FIRST_ACT_QUERY },
        { role: "assistant", content: "D'accord, on peut construire des fiches." },
      ],
      priorState: prior,
    });
    assert.deepEqual(next, buildDocumentaryMandate());
  });

  it("6. un create nommé incompatible invalide le mandat", () => {
    assert.ok(extractCreateGoalFromText(NAMED_CREATE_QUERY));
    persistFromHit(TEST_SESSION, { path: DOCUMENTARY_MANDATE_PATH });
    const prior = beginSessionWorkTurn({
      sessionId: TEST_SESSION,
      now: new Date("2026-09-27T12:04:00.000Z"),
    }).priorState;
    const next = resolveDocumentaryMandateForCommit({
      shortCircuit: { path: "named_create_start" },
      query: NAMED_CREATE_QUERY,
      history: [],
      priorState: prior,
    });
    assert.equal(next, null);
  });

  it("7. topic shift strong_new_task invalide le mandat", () => {
    const shift = assessConversationTopicShift(
      HTML_CREATE_QUERY,
      CONSUMER_TECH_HISTORY,
    );
    assert.equal(shift.detected, true);
    assert.equal(shift.reason, "strong_new_task");
    persistFromHit(TEST_SESSION, { path: DOCUMENTARY_MANDATE_PATH });
    const prior = beginSessionWorkTurn({
      sessionId: TEST_SESSION,
      now: new Date("2026-09-27T12:05:00.000Z"),
    }).priorState;
    const next = resolveDocumentaryMandateForCommit({
      shortCircuit: null,
      query: HTML_CREATE_QUERY,
      history: CONSUMER_TECH_HISTORY,
      priorState: prior,
    });
    assert.equal(next, null);
  });

  it("8. topic shift task_domain_reset invalide le mandat", () => {
    const shift = assessConversationTopicShift(
      WORKSHOP_QUERY,
      CONSUMER_TECH_HISTORY,
    );
    assert.equal(shift.detected, true);
    assert.equal(shift.reason, "task_domain_reset");
    persistFromHit(TEST_SESSION, { path: DOCUMENTARY_MANDATE_PATH });
    const prior = beginSessionWorkTurn({
      sessionId: TEST_SESSION,
      now: new Date("2026-09-27T12:06:00.000Z"),
    }).priorState;
    const next = resolveDocumentaryMandateForCommit({
      shortCircuit: null,
      query: WORKSHOP_QUERY,
      history: CONSUMER_TECH_HISTORY,
      priorState: prior,
    });
    assert.equal(next, null);
  });

  it("9. incompatible_domains seul ne l’invalide pas", () => {
    const shift = assessConversationTopicShift(
      CULINARY_QUERY,
      CONSUMER_TECH_HISTORY,
    );
    assert.equal(shift.detected, true);
    assert.equal(shift.reason, "incompatible_domains");
    persistFromHit(TEST_SESSION, { path: DOCUMENTARY_MANDATE_PATH });
    const prior = beginSessionWorkTurn({
      sessionId: TEST_SESSION,
      now: new Date("2026-09-27T12:07:00.000Z"),
    }).priorState;
    const next = resolveDocumentaryMandateForCommit({
      shortCircuit: null,
      query: CULINARY_QUERY,
      history: CONSUMER_TECH_HISTORY,
      priorState: prior,
    });
    assert.deepEqual(next, buildDocumentaryMandate());
  });

  it("10. lastRoutingResult n’est pas une source d’autorité", () => {
    const poisoned = {
      ...createEmptySessionWorkMemory(TEST_SESSION),
      documentaryMandate: null,
      lastRoutingResult: {
        path: DOCUMENTARY_MANDATE_PATH,
        pipelinePath: DOCUMENTARY_MANDATE_PATH,
      },
    };
    const next = resolveDocumentaryMandateForCommit({
      shortCircuit: { path: "social_deterministic" },
      query: "ok",
      history: [],
      priorState: poisoned,
    });
    assert.equal(next, null);
  });

  it("11. activeGoal reste un champ distinct, format inchangé", () => {
    const empty = createEmptySessionWorkMemory(TEST_SESSION);
    assert.equal(empty.activeGoal, null);
    assert.equal(empty.documentaryMandate, null);
    const saved = commitSessionWorkTurn({
      sessionId: TEST_SESSION,
      turnTimestamp: new Date("2026-09-27T12:08:00.000Z").toISOString(),
      query: FIRST_ACT_QUERY,
      activeGoal: { label: "carte de visite", kind: "create", source: "test" },
      documentaryMandate: buildDocumentaryMandate(),
    });
    assert.equal(saved.activeGoal.kind, "create");
    assert.equal(saved.activeGoal.label, "carte de visite");
    assert.deepEqual(saved.documentaryMandate, buildDocumentaryMandate());
    assert.notEqual(saved.documentaryMandate, saved.activeGoal);
  });
});
