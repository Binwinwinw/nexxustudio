import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { extractObscureReferenceHint } from "../src/agent/policies/epistemic/index.js";
import {
  resolveSubjectContextRoles,
  resolveFramingCorrection,
  resolveExploratorySubjectAngleShortCircuit,
  resolveFramingCorrectionShortCircuit,
} from "../src/agent/policies/conversation/conversationFramingPolicy.js";
import { resolveSocialChatContinuityShortCircuit } from "../src/agent/policies/social/socialChatContinuityPolicy.js";
import { extractConversationState } from "../src/agent/micro/continuity/conversationContinuityContext.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";

const CREOLE_MQ =
  "Est-ce que tu connais le créole dans les Antilles Françaises par exemple en Martinique ??";
const CREOLE_EN_MQ = "Connais-tu le créole en Martinique ?";
const SPEAK_MQ = "Je parle de la Martinique, pas du créole";
const PRINCIPAL_XY = "Le principal n'est pas le créole, c'est la Martinique";
const LIVE_CORRECTION =
  "le principale dans la demande n'était pas est ce que tu connais la martinique, c'était est ce que tu connais le créole";

describe("cadrage sujet / contexte — hypothèse premier tour", () => {
  it("créole + par exemple en Martinique → sujet créole, Martinique exemple", () => {
    const roles = resolveSubjectContextRoles(CREOLE_MQ);
    assert.equal(roles.subject, "creole");
    assert.equal(roles.example, "martinique");
    assert.match(roles.context || "", /antilles/);
    assert.equal(extractObscureReferenceHint(CREOLE_MQ), null);
  });

  it("Connais-tu le créole en Martinique ? → sujet créole, lieu contexte", () => {
    const roles = resolveSubjectContextRoles(CREOLE_EN_MQ);
    assert.equal(roles.subject, "creole");
    assert.equal(roles.context, "martinique");
    assert.equal(roles.example, null);
  });

  it("Par exemple en Martinique → exemple, pas sujet", () => {
    const roles = resolveSubjectContextRoles("Par exemple en Martinique");
    assert.equal(roles.example, "martinique");
    assert.equal(roles.subject, null);
  });
});

describe("cadrage — correction utilisateur", () => {
  it("je parle de Y, pas de X → Y remplace X", () => {
    const hit = resolveFramingCorrection(SPEAK_MQ);
    assert.equal(hit?.subject, "martinique");
    assert.equal(hit?.rejected, "creole");
  });

  it("le principal n'est pas X, c'est Y → Y remplace X", () => {
    const hit = resolveFramingCorrection(PRINCIPAL_XY);
    assert.equal(hit?.subject, "martinique");
    assert.equal(hit?.rejected, "creole");
  });

  it("correction live : créole remplace Martinique", () => {
    const hit = resolveFramingCorrection(LIVE_CORRECTION);
    assert.equal(hit?.subject, "creole");
    assert.equal(hit?.rejected, "martinique");
  });
});

describe("cadrage — short-circuits", () => {
  it("tour 1 : relance d'angle sur créole, pas « Tu parles de Martinique ? »", async () => {
    const angle = resolveExploratorySubjectAngleShortCircuit(CREOLE_MQ);
    assert.equal(angle?.path, "subject_angle_explore");
    assert.match(angle?.reply || "", /creole|créole/i);
    assert.match(angle?.reply || "", /quelle partie/i);
    assert.doesNotMatch(angle?.reply || "", /Tu parles de Martinique/i);
    assert.equal(angle?.preferWebResearch, false);

    const hit = await runConversationShortCircuit(CREOLE_MQ, { history: [] });
    assert.equal(hit?.path, "subject_angle_explore");
    assert.doesNotMatch(hit?.reply || "", /Tu parles de Martinique/i);
    assert.equal(hit?.preferWebResearch, false);
  });

  it("je parle de la Martinique, pas du créole → sujet Martinique", async () => {
    const hit = await runConversationShortCircuit(SPEAK_MQ, { history: [] });
    assert.equal(hit?.path, "framing_correction");
    assert.match(hit?.reply || "", /martinique/i);
    assert.match(hit?.reply || "", /pas de creole|pas de créole/i);
  });

  it("après clarify Martinique, correction créole : pas de rewrite On discute de", async () => {
    const history = [
      { role: "user", content: CREOLE_MQ },
      {
        role: "assistant",
        content: "Tu parles de Martinique ? Si oui, je vois.",
      },
    ];
    const state = extractConversationState(history);
    assert.equal(state.turnPhase, "subject_confirmation_pending");
    assert.match(state.activeSubjectLabel || "", /Martinique/i);

    const social = resolveSocialChatContinuityShortCircuit(LIVE_CORRECTION, {
      history,
    });
    assert.equal(social, null);

    const hit = await runConversationShortCircuit(LIVE_CORRECTION, { history });
    assert.equal(hit?.path, "framing_correction");
    assert.match(hit?.reply || "", /creole|créole/i);
    assert.equal(hit?.continuityEffectiveQuery, undefined);
    assert.doesNotMatch(hit?.reply || "", /On discute de/i);
    assert.equal(hit?.preferWebResearch, false);
    assert.equal(hit?.blockWebUntilFramingStable, true);
  });

  it("aucun web tant que le sujet n'est pas stable (B + correction)", () => {
    assert.equal(
      resolveExploratorySubjectAngleShortCircuit(CREOLE_EN_MQ)
        ?.blockWebUntilFramingStable,
      true,
    );
    assert.equal(
      resolveFramingCorrectionShortCircuit(LIVE_CORRECTION)?.preferWebResearch,
      false,
    );
  });
});
