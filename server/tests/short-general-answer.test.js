import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { shouldDeferShortCircuitToFullPipeline } from "../src/agent/policies/routing/practicalAdviceRoutingGuard.js";
import {
  isShortGeneralAnswerRequest,
  resolveShortGeneralAnswerShortCircuit,
  SHORT_GENERAL_ANSWER_PATH,
  SHORT_GENERAL_ANSWER_ROUTE,
  SHORT_GENERAL_ANSWER_CONTRACT,
  WINDOWS_7_SHORT_GENERAL_REPLY,
  WINDOWS_8_SHORT_GENERAL_REPLY,
  WINDOWS_8_SHORT_GENERAL_REPLY_EN,
} from "../src/agent/policies/conversation/shortGeneralAnswerPolicy.js";
import { tryFileAnalysisAwaitingSource } from "../src/agent/policies/attachment/fileAnalysisContract.js";
import { isRepoAnalysisRequest } from "../src/agent/utils/intent-guards/repoAnalysisIntentGuards.js";

const WIN7_OPINION = "que penses tu de windows 7 ?";
const CHAT_HISTORY = [
  { role: "user", content: "salut salut" },
  {
    role: "assistant",
    content:
      "Salut ! Si tu veux on peut papoter ou je t'aide à cadrer un projet, clarifier un besoin, structurer des livrables. Qu'est-ce que tu veux faire ?",
  },
];

describe("short_general_answer", () => {
  it("Windows 7 opinion → conversational_light déterministe, dates officielles", async () => {
    assert.equal(isShortGeneralAnswerRequest(WIN7_OPINION), true);
    const resolved = resolveShortGeneralAnswerShortCircuit(WIN7_OPINION);
    assert.equal(resolved?.path, SHORT_GENERAL_ANSWER_PATH);
    assert.equal(resolved?.route, SHORT_GENERAL_ANSWER_ROUTE);
    assert.equal(resolved?.contract, SHORT_GENERAL_ANSWER_CONTRACT);
    assert.equal(resolved?.deferToLlm, false);
    assert.equal(resolved?.reply, WINDOWS_7_SHORT_GENERAL_REPLY);
    assert.match(resolved?.reply || "", /13 janvier 2015/);
    assert.match(resolved?.reply || "", /14 janvier 2020/);
    assert.doesNotMatch(resolved?.reply || "", /donn[ée]es v[ée]rifi[ée]es/i);

    const hit = await runConversationShortCircuit(WIN7_OPINION, {
      history: CHAT_HISTORY,
    });
    assert.equal(hit?.path, SHORT_GENERAL_ANSWER_PATH);
    assert.equal(hit?.route, SHORT_GENERAL_ANSWER_ROUTE);
    assert.equal(hit?.deferToLlm, false);
    assert.equal(shouldDeferShortCircuitToFullPipeline(hit, WIN7_OPINION), false);
    assert.match(hit?.reply || "", /13 janvier 2015/);
    assert.match(hit?.reply || "", /14 janvier 2020/);
    assert.notEqual(hit?.path, "exploratory_conversation_light");
  });

  it("Windows 8 opinion → conversational_light déterministe, pas web/Sovereign", async () => {
    const q = "que penses tu de windows 8";
    const hit = await runConversationShortCircuit(q, { history: CHAT_HISTORY });
    assert.equal(hit?.path, SHORT_GENERAL_ANSWER_PATH);
    assert.equal(hit?.route, SHORT_GENERAL_ANSWER_ROUTE);
    assert.equal(hit?.deferToLlm, false);
    assert.equal(hit?.preferWebResearch, false);
    assert.equal(shouldDeferShortCircuitToFullPipeline(hit, q), false);
    assert.equal(hit?.reply, WINDOWS_8_SHORT_GENERAL_REPLY);
    assert.match(hit?.reply || "", /12 janvier 2016/);
    assert.match(hit?.reply || "", /10 janvier 2023/);
    assert.doesNotMatch(hit?.reply || "", /g2\.com|tecnovortex|softonic/i);
    assert.doesNotMatch(hit?.reply || "", /donn[ée]es v[ée]rifi[ée]es/i);
  });

  it("Win8 + réponds en anglais → anglais, pas français", async () => {
    const q = "Réponds en anglais : que penses tu de windows 8";
    const { resolveOutputLanguagePolicy } = await import(
      "../src/agent/policies/posture/outputLanguagePolicy.js"
    );
    const policy = resolveOutputLanguagePolicy(q);
    assert.equal(policy.outputLanguage, "en");
    const hit = await runConversationShortCircuit(q, {
      history: CHAT_HISTORY,
      languagePolicy: policy,
    });
    assert.equal(hit?.path, SHORT_GENERAL_ANSWER_PATH);
    assert.equal(hit?.reply, WINDOWS_8_SHORT_GENERAL_REPLY_EN);
  });

  it("avis Linux sans fiche → conversational_light déterministe, pas SIMPLE_FAST", async () => {
    const q = "que penses-tu de Linux ?";
    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, SHORT_GENERAL_ANSWER_PATH);
    assert.equal(hit?.route, SHORT_GENERAL_ANSWER_ROUTE);
    assert.equal(hit?.deferToLlm, false);
    assert.ok(hit?.reply);
    assert.match(hit?.reply || "", /Linux/i);
    assert.doesNotMatch(hit?.reply || "", /janvier 20/);
    assert.equal(hit?.preferWebResearch, false);
    assert.equal(shouldDeferShortCircuitToFullPipeline(hit, q), false);
  });

  it("compare Windows 7 / 11 migration → pas short_general_answer", async () => {
    const q =
      "compare Windows 7 et Windows 11 pour une migration d'entreprise";
    assert.equal(isShortGeneralAnswerRequest(q), false);
    assert.equal(resolveShortGeneralAnswerShortCircuit(q), null);
    const hit = await runConversationShortCircuit(q);
    assert.notEqual(hit?.path, SHORT_GENERAL_ANSWER_PATH);
  });

  it("support actuel Windows 7 → pas short_general_answer", async () => {
    const q = "quel est le support actuel de Windows 7 ?";
    assert.equal(isShortGeneralAnswerRequest(q), false);
    const hit = await runConversationShortCircuit(q);
    assert.notEqual(hit?.path, SHORT_GENERAL_ANSWER_PATH);
  });

  it("analyse document PDF → pas short_general_answer", async () => {
    const q = "analyse ce document Windows 7.pdf";
    assert.equal(isShortGeneralAnswerRequest(q), false);
    const hit = await runConversationShortCircuit(q);
    assert.notEqual(hit?.path, SHORT_GENERAL_ANSWER_PATH);
    const awaiting = tryFileAnalysisAwaitingSource(q, { attachments: [] });
    if (awaiting) {
      assert.notEqual(awaiting.pipelinePath, SHORT_GENERAL_ANSWER_PATH);
    }
  });

  it("analyse dépôt GitHub → pas short_general_answer", () => {
    const q =
      "analyse ce dépôt Windows 7 avec https://github.com/microsoft/windows";
    assert.equal(isShortGeneralAnswerRequest(q), false);
    assert.equal(isRepoAnalysisRequest(q), true);
  });

  it("PJ jointe → pas short_general_answer", () => {
    assert.equal(
      isShortGeneralAnswerRequest(WIN7_OPINION, {
        attachments: [{ name: "note.txt" }],
      }),
      false,
    );
  });
});
