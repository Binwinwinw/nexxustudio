import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isCapabilityQuery,
} from "../src/agent/utils/intent-guards/intentGuards.js";
import {
  isAnalyticalTechnicalRequest,
  isDocumentAnalysisIntent,
  isTaskCapabilityAskWithoutPayload,
  buildTaskCapabilityAskReply,
  TASK_CAPABILITY_ASK_SITE_REPLY,
} from "../src/agent/utils/conversation/conversationGuards.js";
import { classifyIntent } from "../src/agent/utils/intent-guards/intentClassifier.js";
import { resolveIntentContract } from "../src/agent/config/intentContractRegistry.js";
import {
  runConversationShortCircuit,
  shouldEvaluateConversationShortCircuit,
} from "../src/agent/micro/classifiers/intentShortCircuit.js";

const INCIDENT =
  "et bien j'ai besoin de ton aide pourras tu analyser un site si je te colle au prochain message son adresse ?";

const EXECUTE_WITH_URL =
  "analyse ce site : https://example.com et dis-moi ce qui ne va pas";

const GOLDEN_MIXED =
  "analyse la conception de notre citadelle qu'est-ce que tu peux faire pour améliorer certaines parties du code ??? peux-tu m'aider ???";

const SHAREPOINT =
  "je voudrais créer un site avec sharepoint pourras tu m'aider à faire cela";

describe("CAPABILITY_QUERY_VS_DIAGNOSTIC_FIX", () => {
  it("incident — pourras-tu analyser un site (payload au prochain tour) → capacité, pas DIAGNOSTIC", async () => {
    assert.equal(isCapabilityQuery(INCIDENT), true);
    assert.equal(isTaskCapabilityAskWithoutPayload(INCIDENT), true);
    assert.equal(isAnalyticalTechnicalRequest(INCIDENT), false);
    assert.equal(isDocumentAnalysisIntent(INCIDENT), false);
    assert.notEqual(classifyIntent(INCIDENT).intent, "expert_task");
    assert.notEqual(resolveIntentContract(INCIDENT, {}).contract.id, "DIAGNOSTIC");
    assert.equal(
      shouldEvaluateConversationShortCircuit({
        wantsAnalysis: true,
        query: INCIDENT,
      }),
      true,
    );
    const hit = await runConversationShortCircuit(INCIDENT, {
      getDeterministicSocialResponse: () => null,
      wantsAnalysis: true,
    });
    assert.equal(hit?.path, "task_capability_ask_deterministic");
    assert.equal(hit?.reply, TASK_CAPABILITY_ASK_SITE_REPLY);
    assert.match(buildTaskCapabilityAskReply(INCIDENT), /URL/i);
  });

  it("analyse ce site + URL → toujours tâche, pas mode d'emploi", async () => {
    assert.equal(isTaskCapabilityAskWithoutPayload(EXECUTE_WITH_URL), false);
    assert.equal(isAnalyticalTechnicalRequest(EXECUTE_WITH_URL), true);
    const hit = await runConversationShortCircuit(EXECUTE_WITH_URL, {
      getDeterministicSocialResponse: () => null,
      wantsAnalysis: true,
    });
    assert.notEqual(hit?.path, "task_capability_ask_deterministic");
  });

  it("golden mixte analyse + peux-tu m'aider → reste analytique", () => {
    assert.equal(isTaskCapabilityAskWithoutPayload(GOLDEN_MIXED), false);
    assert.equal(isAnalyticalTechnicalRequest(GOLDEN_MIXED), true);
    assert.equal(classifyIntent(GOLDEN_MIXED).intent, "expert_task");
  });

  it("sharepoint pourras-tu m'aider → pas un ask d'analyse sans payload", () => {
    assert.equal(isTaskCapabilityAskWithoutPayload(SHAREPOINT), false);
  });

  it("PJ déjà là → pas un ask sans payload", () => {
    assert.equal(
      isTaskCapabilityAskWithoutPayload("pourras tu analyser le fichier", [
        { originalname: "doc.txt", mimetype: "text/plain" },
      ]),
      false,
    );
  });
});
