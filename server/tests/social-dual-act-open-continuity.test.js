/**
 * P1-D — dual-acte social (ack + phatique) et open_exploration en continuité small talk.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  classifySocialPattern,
  hasAffectiveSocialAckSignal,
  isPhaticSocialCheckinIntent,
  isSocialAckPhaticDualAct,
} from "../src/agent/policies/social/socialPatternPolicy.js";
import {
  decomposeRequest,
  inventoryRequestUnits,
} from "../src/agent/policies/routing/requestDecompositionPolicy.js";
import {
  isOpenExplorationFrame,
  isSocialLeisureRelance,
} from "../src/agent/policies/conversation/openExplorationFramePolicy.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { isRepoAnalysisRequest } from "../src/agent/utils/intent-guards/repoAnalysisIntentGuards.js";
import { evaluateJustIntent } from "../src/agent/policies/intent/justIntentDetectionPolicy.js";

const DUAL_Q =
  "content de savoir que tout va bien pour toi, sinon tu fais quoi de beau ?";

const SOCIAL_HISTORY = [
  { role: "user", content: "comment ca va ?" },
  { role: "assistant", content: "Tout va bien ici." },
  { role: "user", content: "tu fais quoi de beau ?" },
  { role: "assistant", content: "Je suis là, je surveille La Citadelle." },
];

function assertNoGhostFamiliarity(reply = "") {
  assert.doesNotMatch(reply, /Tu parles de/i);
  assert.doesNotMatch(reply, /Tu Fais de Bon/i);
}

describe("SOCIAL-DUAL-ACT", () => {
  it("SOCIAL-DUAL-ACT-01 — ack + phatique, deux unités, ack dans la réponse", async () => {
    assert.equal(isPhaticSocialCheckinIntent(DUAL_Q), true);
    assert.equal(hasAffectiveSocialAckSignal(DUAL_Q), true);
    assert.equal(isSocialAckPhaticDualAct(DUAL_Q), true);

    const types = inventoryRequestUnits(DUAL_Q).map((u) => u.unitType);
    assert.ok(types.includes("social_ack"), `inventory=${types.join(",")}`);
    assert.ok(types.includes("social_phatic"), `inventory=${types.join(",")}`);

    const decomp = decomposeRequest(DUAL_Q);
    assert.ok(decomp.unitCount >= 2);
    assert.ok(decomp.unitTypes.includes("social_ack"));
    assert.ok(decomp.unitTypes.includes("social_phatic"));

    const history = [{ role: "assistant", content: "Tout va bien ici." }];
    const hit = await runConversationShortCircuit(DUAL_Q, { history });
    assert.equal(hit?.path, "social_deterministic");
    assert.equal(hit?.socialPatternName, "social/phatic_checkin");
    assert.match(hit?.reply || "", /c['’]est gentil/i);
    assertNoGhostFamiliarity(hit?.reply || "");
    assert.equal(evaluateJustIntent(DUAL_Q).action, "social_checkin");
  });

  it("SOCIAL-DUAL-ACT-02 — variantes ack + phatique", async () => {
    for (const q of [
      "C'est gentil, et toi tu fais quoi de beau ?",
      "Tant mieux ; sinon, tu fais quoi ?",
      "Content de savoir ça — tu fais quoi de bon ?",
    ]) {
      assert.equal(isSocialAckPhaticDualAct(q), true, q);
      const hit = await runConversationShortCircuit(q);
      assert.equal(hit?.path, "social_deterministic", q);
      assert.equal(hit?.socialPatternName, "social/phatic_checkin", q);
      assert.match(hit?.reply || "", /c['’]est gentil/i, q);
      assert.doesNotMatch(hit?.reply || "", /Tu parles de/i, q);
    }
  });
});

describe("SOCIAL-OPEN-CONTINUITY", () => {
  it("SOCIAL-OPEN-CONTINUITY-03 — après small talk, pas de menu", async () => {
    const q = "Qu'est-ce qu'on devrait faire maintenant ?";
    assert.equal(isSocialLeisureRelance(q, SOCIAL_HISTORY), true);
    assert.equal(isOpenExplorationFrame(q, SOCIAL_HISTORY), false);
    const hit = await runConversationShortCircuit(q, { history: SOCIAL_HISTORY });
    assert.equal(hit?.path, "social_deterministic");
    assert.equal(hit?.socialPatternName, "social/leisure_relance");
    assert.doesNotMatch(hit?.reply || "", /\n\n1\.\s+discussion libre/);
    assert.doesNotMatch(hit?.reply || "", /Choisis un numéro/i);
    assert.notEqual(hit?.path, "guided_choice");
  });

  it("OPEN-EXPLORATION-REGRESSION-04 — hors continuité, menu conservé si applicable", async () => {
    const withProject = "Qu'est-ce qu'on devrait faire maintenant pour le projet ?";
    assert.equal(isOpenExplorationFrame(withProject), false);
    assert.equal(isSocialLeisureRelance(withProject), false);

    const start = "Je ne sais pas par où commencer, qu'est-ce qu'on devrait faire ?";
    assert.equal(isOpenExplorationFrame(start), true);
    assert.equal(isSocialLeisureRelance(start), false);
    const hit = await runConversationShortCircuit(start);
    assert.equal(hit?.socialPatternName, "social/open_prompt");
    assert.match(hit?.reply || "", /\n\n1\.\s+discussion libre/);
  });
});

describe("SOCIAL-BOUNDARY-05", () => {
  it("create / repo analysis inchangés", async () => {
    const cv = await runConversationShortCircuit("Fais-moi un CV moderne");
    assert.notEqual(cv?.socialPatternName, "social/phatic_checkin");
    assert.notEqual(cv?.socialPatternName, "social/leisure_relance");

    const html = await runConversationShortCircuit("Crée une page HTML");
    assert.notEqual(html?.socialPatternName, "social/open_prompt");

    const gh = "Analyse ce dépôt GitHub : https://github.com/rasbt/LLMs-from-scratch";
    assert.equal(isRepoAnalysisRequest(gh), true);
    const repo = await runConversationShortCircuit(gh);
    assert.notEqual(repo?.path, "social_deterministic");
    assert.ok(
      repo?.path === "repo_analysis_llm" ||
        repo?.forcedIntentContractId === "REPO_ANALYSIS" ||
        repo == null,
    );
  });
});
