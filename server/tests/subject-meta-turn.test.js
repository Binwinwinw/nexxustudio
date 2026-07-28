import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  classifyConversationTurn,
  isReferentialEntityMention,
} from "../src/agent/micro/classifiers/conversationTurnType.js";
import { resolveMetaFeedbackShortCircuit } from "../src/agent/micro/replies/metaFeedbackReplyBuilder.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { buildSubjectInterpretedState } from "../src/agent/micro/subject/subjectInterpretedState.js";
import { resolveLauncherGuideShortCircuit } from "../src/agent/micro/replies/launcherGuideBuilder.js";
import {
  clearSubjectSessionMemory,
  rememberResolvedSubject,
} from "../src/agent/micro/subject/subjectSessionMemory.js";
import { ENTITY_IDS } from "../src/agent/micro/subject/subjectEntityIds.js";
import { SUBJECT_NATURES } from "../src/agent/micro/subject/subjectIntelligenceLayer.js";

const SESSION = "test-meta-turn";

const META_NFS_QUERY =
  "attention il parle d'un sujet qu'il ne maitrise pas il faut qu'on revoit le fichier qui traitait de nfs je pense";

const FORGE_HISTORY = [
  {
    role: "user",
    content:
      "Cadrage projet calculatrice React Vite avec Forge, livrables MVP plotly",
  },
  {
    role: "assistant",
    content: "Je cadrerais la demande Forge avec react-plotly et Vite.",
  },
];

beforeEach(() => {
  clearSubjectSessionMemory(SESSION);
});

describe("conversationTurnType", () => {
  it("détecte meta_feedback sur remarque NFS fichier", () => {
    const turn = classifyConversationTurn(META_NFS_QUERY, { history: FORGE_HISTORY });
    assert.equal(turn.turnType, "meta_feedback");
    assert.equal(turn.disableSubjectCarryOver, true);
    assert.equal(turn.disableLauncherHints, true);
    assert.ok(isReferentialEntityMention(META_NFS_QUERY));
  });

  it("NFS lancement reste task_request", () => {
    const turn = classifyConversationTurn("comment faire pour lancer Need for Speed");
    assert.equal(turn.turnType, "task_request");
    assert.equal(turn.disableLauncherHints, false);
  });
});

describe("meta feedback short-circuit", () => {
  it("pas de Steam/OS sur tour méta", async () => {
    rememberResolvedSubject(SESSION, {
      resolvedEntityId: ENTITY_IDS.PUBLIC_GAME_NFS,
      canonical: "need for speed",
      label: "Need for Speed",
      nature: SUBJECT_NATURES.PUBLIC_KNOWN,
      confidence: "high",
    });

    const hit = await runConversationShortCircuit(META_NFS_QUERY, {
      history: FORGE_HISTORY,
      sessionId: SESSION,
    });
    assert.ok(hit);
    assert.equal(hit.path, "meta_feedback_deterministic");
    assert.doesNotMatch(hit.reply, /Tu sembles vouloir installer/i);
    assert.doesNotMatch(hit.reply, /indique ton OS et la source/i);
    assert.match(hit.reply, /faux positif|Forge|cadrage|méta|feedback/i);
  });

  it("launcher ignoré si méta", async () => {
    const launcher = await resolveLauncherGuideShortCircuit(META_NFS_QUERY, {
      history: FORGE_HISTORY,
      sessionId: SESSION,
    });
    assert.equal(launcher, null);
  });

  it("SIL sans carry-over NFS sur méta", () => {
    rememberResolvedSubject(SESSION, {
      resolvedEntityId: ENTITY_IDS.PUBLIC_GAME_NFS,
      canonical: "need for speed",
      label: "Need for Speed",
      nature: SUBJECT_NATURES.PUBLIC_KNOWN,
      confidence: "high",
    });

    const interpreted = buildSubjectInterpretedState({
      query: META_NFS_QUERY,
      sessionId: SESSION,
      history: FORGE_HISTORY,
    });
    assert.equal(interpreted.turn.turnType, "meta_feedback");
    assert.notEqual(interpreted.state.memoryRecall, true);
    assert.equal(interpreted.state.source, "meta_turn_skip_resolution");
  });
});

describe("resolveMetaFeedbackShortCircuit", () => {
  it("topic forge quand historique Forge", () => {
    const hit = resolveMetaFeedbackShortCircuit(META_NFS_QUERY, {
      history: FORGE_HISTORY,
    });
    assert.ok(hit?.reply);
    assert.match(hit.reply, /Forge|React|Vite/i);
  });
});
