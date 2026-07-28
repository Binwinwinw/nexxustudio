import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  resolveSubject,
  getGraphEntity,
  listEntityIdsByRelation,
  getEntityPlatforms,
  hasRelation,
  SUBJECT_GRAPH_ENTITIES,
} from "../src/agent/micro/subject/subjectGraph.js";
import { ENTITY_IDS } from "../src/agent/micro/subject/subjectEntityIds.js";
import { lookupKnownEntity } from "../src/agent/micro/subject/knownEntityQuickLookup.js";
import { lookupInternalEntity } from "../src/agent/micro/subject/internalEntityRegistry.js";
import {
  clearSubjectSessionMemory,
  extractAndRememberProjectAnchor,
} from "../src/agent/micro/subject/subjectSessionMemory.js";
import { buildSubjectInterpretedState } from "../src/agent/micro/subject/subjectInterpretedState.js";
import { SUBJECT_NATURES } from "../src/agent/micro/subject/subjectIntelligenceLayer.js";

const SESSION = "test-subject-graph";

beforeEach(() => {
  clearSubjectSessionMemory(SESSION);
});

describe("Subject Graph — résolution", () => {
  it("alias nfs → public:game:need-for-speed", () => {
    const out = resolveSubject("nfs", { domain: "public" });
    assert.equal(out.entityId, ENTITY_IDS.PUBLIC_GAME_NFS);
    assert.equal(out.confidence, "high");
    assert.ok(hasRelation(out.entityId, "is_game"));
  });

  it("need 4 speed → même entité", () => {
    const out = resolveSubject("need 4 speed", { domain: "public" });
    assert.equal(out.entityId, ENTITY_IDS.PUBLIC_GAME_NFS);
  });

  it("eclipse → ambigu + candidats", () => {
    const out = resolveSubject("eclipse", { domain: "public" });
    assert.equal(out.entityId, ENTITY_IDS.PUBLIC_AMBIGUOUS_ECLIPSE);
    assert.equal(out.ambiguous, true);
    assert.ok(out.candidates.length >= 2);
    assert.ok(out.candidates.some((c) => c.relations?.includes("is_ide")));
  });

  it("forge → interne", () => {
    const out = resolveSubject("forge", { domain: "internal" });
    assert.equal(out.entityId, ENTITY_IDS.INTERNAL_FORGE);
    assert.ok(hasRelation(out.entityId, "is_forge_pipeline"));
  });

  it("session Atlas → session:project:atlas", () => {
    extractAndRememberProjectAnchor("le projet Atlas", SESSION);
    const out = resolveSubject("Atlas", {
      sessionContext: { activeProjectNames: ["Atlas"] },
    });
    assert.match(out.entityId, /^session:project:atlas$/);
    assert.ok(out.entity.relations.includes("is_internal_project"));
  });

  it("plateformes NFS depuis le graphe", () => {
    const platforms = getEntityPlatforms(ENTITY_IDS.PUBLIC_GAME_NFS);
    assert.ok(platforms.includes("Steam"));
    assert.ok(platforms.includes("EA App"));
  });

  it("listEntityIdsByRelation is_game inclut NFS", () => {
    const ids = listEntityIdsByRelation("is_game");
    assert.ok(ids.includes(ENTITY_IDS.PUBLIC_GAME_NFS));
  });
});

describe("Subject Graph — compat registres", () => {
  it("lookupKnownEntity délègue au graphe", () => {
    const hit = lookupKnownEntity("NFS");
    assert.equal(hit.resolvedEntityId, ENTITY_IDS.PUBLIC_GAME_NFS);
    assert.equal(hit.label, "Need for Speed");
  });

  it("lookupInternalEntity délègue au graphe", () => {
    const hit = lookupInternalEntity("citadelle");
    assert.equal(hit.resolvedEntityId, ENTITY_IDS.INTERNAL_CITADELLE);
  });

  it("SIL Atlas session inchangé", () => {
    extractAndRememberProjectAnchor("le projet Atlas", SESSION);
    const interpreted = buildSubjectInterpretedState({
      query: "comment lancer Atlas",
      sessionId: SESSION,
    });
    assert.equal(interpreted.state.nature, SUBJECT_NATURES.INTERNAL_STUDIO);
    assert.equal(interpreted.state.memoryRecall, true);
  });
});

describe("Subject Graph — entités", () => {
  it("registre non vide et IDs stables", () => {
    assert.ok(Object.keys(SUBJECT_GRAPH_ENTITIES).length >= 10);
    assert.ok(getGraphEntity(ENTITY_IDS.PUBLIC_GAME_NFS));
  });
});
