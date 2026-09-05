import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { runConversationShortCircuit, shouldEvaluateConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { shouldRunWordGuardSimpleFast } from "../src/agent/paths/simpleFastPath.js";
import {
  isExplicitDocumentAttachmentTurn,
  isLightMetaValidationRelance,
  isSocialLightLatencyTurn,
} from "../src/agent/policies/routing/routingLatencyContracts.js";
import { shouldRouteAttachmentTaskToFullPipeline } from "../src/agent/policies/attachment/attachmentTaskPolicy.js";

const PDF = [{ originalname: "sujet.pdf", mimetype: "application/pdf" }];
const SOCIAL_CASES = [
  "bonjour, comment vas tu ?",
  "comment se portent tes circuits ?",
  "c'est une réponse acceptable à part cela, qu'est ce que tu veux faire ?",
];
const DOC_CASES = [
  "tu pourrais faire un résumé du fichier joint ?",
  "peux-tu analyser ce document ?",
  "résume le PDF joint",
];

describe("ROUTING_LATENCY_CONTRACTS_V1", () => {
  it("social léger → SC déterministe, pas de defer LLM", async () => {
    for (const q of SOCIAL_CASES) {
      assert.equal(isSocialLightLatencyTurn(q), true, q);
      const hit = await runConversationShortCircuit(q);
      assert.equal(hit?.path, "social_deterministic", q);
      assert.ok(hit?.reply, q);
      assert.equal(hit?.deferToLlm, false, q);
      assert.equal(hit?.skipPlanner, true, q);
      assert.equal(hit?.skipSovereign, true, q);
      assert.doesNotMatch(hit.reply, /orchestrat|architecture|local-first/i);
      assert.equal(
        shouldRunWordGuardSimpleFast({
          wordsCount: q.split(/\s+/).length,
          query: q,
        }),
        false,
        q,
      );
    }
  });

  it("validation méta légère détectée", () => {
    assert.equal(
      isLightMetaValidationRelance(
        "c'est une réponse acceptable à part cela, qu'est ce que tu veux faire ?",
      ),
      true,
    );
  });

  it("document + PJ → SC attachment, pas conversation générale", async () => {
    for (const q of DOC_CASES) {
      assert.equal(isExplicitDocumentAttachmentTurn(q, PDF), true, q);
      assert.equal(shouldRouteAttachmentTaskToFullPipeline(q, PDF), true, q);
      assert.equal(
        shouldEvaluateConversationShortCircuit({
          wantsAnalysis: true,
          query: q,
          attachments: PDF,
        }),
        true,
        q,
      );
      const hit = await runConversationShortCircuit(q, {
        wantsAnalysis: true,
        attachments: PDF,
      });
      assert.equal(hit?.path, "attachment_task_full_pipeline", q);
      assert.equal(hit?.deferToFullPipeline, true, q);
      assert.notEqual(hit?.path, "social_deterministic", q);
      assert.equal(
        shouldRunWordGuardSimpleFast({
          wordsCount: 8,
          query: q,
          attachments: PDF,
        }),
        false,
        q,
      );
    }
  });

  it("analyse PDF sans PJ → SC toujours sauté si wantsAnalysis (pas d'attachement)", () => {
    assert.equal(
      shouldEvaluateConversationShortCircuit({
        wantsAnalysis: true,
        query: "analyse ce PDF",
      }),
      false,
    );
  });

  it("non-régression — check-in, small talk, tâche sans PJ", async () => {
    const checkin = await runConversationShortCircuit("salut, comment ça va ?");
    assert.equal(checkin?.path, "social_deterministic");

    const phatic = await runConversationShortCircuit("que fais tu ?");
    assert.equal(phatic?.socialPatternName, "social/phatic_checkin");

    const expert = "analyse ce timeout redis dans le pipeline sans fichier";
    assert.equal(isExplicitDocumentAttachmentTurn(expert, []), false);
    assert.equal(isSocialLightLatencyTurn(expert), false);

    const general = "c'est quoi une liste en python";
    assert.equal(isSocialLightLatencyTurn(general), false);
    assert.equal(isExplicitDocumentAttachmentTurn(general, PDF), false);
  });
});
