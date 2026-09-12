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
import {
  extractConversationState,
  CONTINUITY_TURN_PHASES,
  resolveSubjectAngleFollowupShortCircuit,
} from "../src/agent/micro/continuity/conversationContinuityContext.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { getIdentityDeterministicReply } from "../src/agent/utils/intent-guards/identityIntentGuards.js";
import { evaluateJustIntent } from "../src/agent/policies/intent/justIntentDetectionPolicy.js";
import { shouldDeferShortCircuitToFullPipeline } from "../src/agent/policies/routing/practicalAdviceRoutingGuard.js";

const CREOLE_MQ =
  "Est-ce que tu connais le créole dans les Antilles Françaises par exemple en Martinique ??";
const CREOLE_EN_MQ = "Connais-tu le créole en Martinique ?";
const SPEAK_MQ = "Je parle de la Martinique, pas du créole";
const PRINCIPAL_XY = "Le principal n'est pas le créole, c'est la Martinique";
const LIVE_CORRECTION =
  "le principale dans la demande n'était pas est ce que tu connais la martinique, c'était est ce que tu connais le créole";
const LIVE_HARNESS =
  "rien de spécial j'essaie de travailler sur le deepseek harness, je ne sais pas si tu connais?";
const LIVE_PYTHON =
  "rien de spécial j'essaie de travailler sur le langage python, je ne sais pas si tu connais ?";
const LIVE_PYTHON_T4 =
  "oui plutôt la syntaxe du python, tu peux te renseigner pour moi stp ??";
const LIVE_SALUT = "salut qu'est ce que tu fais de beau ?";
const LIVE_SALUT_REPLY =
  "Salut ! Rien de fou de mon côté — prêt à t'aider sur ton chantier. On attaque quoi ?";

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
    assert.match(angle?.reply || "", /Je vois le/i);
    assert.match(angle?.reply || "", /côté usage/i);
    assert.match(angle?.reply || "", /architecture/i);
    assert.doesNotMatch(angle?.reply || "", /quelle partie/i);
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

describe("cadrage — sujet avant sonde tu connais vide", () => {
  it("deepseek harness avant « tu connais » → ouverture, pas refus, pas web", async () => {
    const roles = resolveSubjectContextRoles(LIVE_HARNESS);
    assert.equal(roles.subject, "deepseek harness");

    const angle = resolveExploratorySubjectAngleShortCircuit(LIVE_HARNESS);
    assert.equal(angle?.path, "subject_angle_explore");
    assert.match(angle?.reply || "", /deepseek harness/i);
    assert.match(angle?.reply || "", /Je vois le/i);
    assert.doesNotMatch(angle?.reply || "", /quelle partie/i);
    assert.doesNotMatch(angle?.reply || "", /éléments fiables/i);
    assert.equal(angle?.preferWebResearch, false);
    assert.equal(angle?.blockWebUntilFramingStable, true);

    const hit = await runConversationShortCircuit(LIVE_HARNESS, { history: [] });
    assert.equal(hit?.path, "subject_angle_explore");
    assert.equal(hit?.preferWebResearch, false);
    assert.equal(hit?.blockWebUntilFramingStable, true);
    assert.doesNotMatch(hit?.reply || "", /éléments fiables/i);
  });

  it("explique le fonctionnement du harness → pas d'ouverture", () => {
    assert.equal(
      resolveExploratorySubjectAngleShortCircuit(
        "explique le fonctionnement du harness",
      ),
      null,
    );
  });

  it("C'est quoi la Citadelle ? → pas d'ouverture (gate référents ailleurs)", async () => {
    assert.equal(
      resolveExploratorySubjectAngleShortCircuit("C'est quoi la Citadelle ?"),
      null,
    );
    const hit = await runConversationShortCircuit("C'est quoi la Citadelle ?", {
      history: [],
    });
    assert.notEqual(hit?.path, "subject_angle_explore");
  });

  it("tu connais ? sans NP → pas d'ouverture", () => {
    assert.equal(resolveSubjectContextRoles("tu connais ?").subject, null);
    assert.equal(resolveExploratorySubjectAngleShortCircuit("tu connais ?"), null);
    assert.equal(resolveExploratorySubjectAngleShortCircuit("tu connais"), null);
  });

  it("ta réponse était hors sujet → pas d'ouverture", async () => {
    assert.equal(
      resolveExploratorySubjectAngleShortCircuit("ta réponse était hors sujet"),
      null,
    );
    const hit = await runConversationShortCircuit("ta réponse était hors sujet", {
      history: [],
    });
    assert.notEqual(hit?.path, "subject_angle_explore");
  });
});

describe("oracle live — salut puis deepseek harness", () => {
  it("T2 → subject_angle_explore, pas refus, pas web, pas clarify framework", async () => {
    const history = [
      { role: "user", content: LIVE_SALUT },
      { role: "assistant", content: LIVE_SALUT_REPLY },
    ];
    const justIntent = evaluateJustIntent(LIVE_HARNESS);
    const hit = await runConversationShortCircuit(LIVE_HARNESS, {
      history,
      justIntent,
      getDeterministicSocialResponse: (q) => getIdentityDeterministicReply(q),
    });
    assert.equal(hit?.path, "subject_angle_explore");
    assert.match(hit?.reply || "", /Je vois le/i);
    assert.match(hit?.reply || "", /deepseek harness/i);
    assert.match(hit?.reply || "", /côté usage/i);
    assert.match(hit?.reply || "", /architecture/i);
    assert.doesNotMatch(hit?.reply || "", /framework|projet interne/i);
    assert.doesNotMatch(hit?.reply || "", /éléments (fiables|vérifiés)/i);
    assert.equal(hit?.preferWebResearch, false);
    assert.equal(hit?.blockWebUntilFramingStable, true);
    assert.equal(hit?.deferToLlm, false);
    assert.equal(shouldDeferShortCircuitToFullPipeline(hit, LIVE_HARNESS), false);
  });
});

describe("continuité après ouverture subject_angle_explore", () => {
  function openingHistory(subjectQuery = LIVE_HARNESS) {
    const open = resolveExploratorySubjectAngleShortCircuit(subjectQuery);
    return [
      { role: "user", content: LIVE_SALUT },
      { role: "assistant", content: LIVE_SALUT_REPLY },
      { role: "user", content: subjectQuery },
      { role: "assistant", content: open.reply },
    ];
  }

  it("ouverture reconnue : sujet tenu, angle en attente", () => {
    const state = extractConversationState(openingHistory());
    assert.equal(state.turnPhase, CONTINUITY_TURN_PHASES.ANGLE_CHOICE_PENDING);
    assert.match(state.activeSubject || "", /deepseek harness/i);
  });

  it("oui plutôt l'architecture + renseigne-toi → même sujet, web OK, pas piste", async () => {
    const history = openingHistory();
    const q =
      "oui plutôt l'architecture, tu peux te renseigner pour moi stp ??";
    const follow = resolveSubjectAngleFollowupShortCircuit(q, history);
    assert.ok(follow);
    assert.match(follow.effectiveQuery || "", /architecture/i);
    assert.match(follow.effectiveQuery || "", /deepseek harness/i);
    assert.equal(follow.preferWebResearch, true);
    assert.equal(follow.path, "information_seeking_full_pipeline");

    const hit = await runConversationShortCircuit(q, { history });
    assert.notEqual(hit?.path, "subject_angle_explore");
    assert.notEqual(hit?.path, "meta_capabilities_prediction_limits_deterministic");
    assert.match(hit?.continuityEffectiveQuery || "", /architecture/i);
    assert.match(hit?.continuityEffectiveQuery || "", /deepseek harness/i);
    assert.equal(hit?.preferWebResearch, true);
    assert.doesNotMatch(hit?.reply || "", /piste|destination/i);
  });

  it("usage seul → suite sur le sujet, pas une 2e ouverture", async () => {
    const history = openingHistory();
    const hit = await runConversationShortCircuit("usage", { history });
    assert.notEqual(hit?.path, "subject_angle_explore");
    assert.match(hit?.continuityEffectiveQuery || "", /usage/i);
    assert.match(hit?.continuityEffectiveQuery || "", /deepseek harness/i);
    assert.equal(hit?.preferWebResearch, false);
  });

  it("refactor + avis → avis sur le chantier, pas pronostic méta", async () => {
    const history = openingHistory();
    const q =
      "ajouter des outils, refactor en python, quel est ton avis ?";
    const hit = await runConversationShortCircuit(q, { history });
    assert.notEqual(
      hit?.path,
      "meta_capabilities_prediction_limits_deterministic",
    );
    assert.notEqual(hit?.path, "subject_angle_explore");
    assert.match(hit?.continuityEffectiveQuery || "", /deepseek harness/i);
    assert.match(hit?.continuityEffectiveQuery || q, /avis|refactor|python/i);
  });

  it("C'est quoi la Citadelle ? → pas avalé par la continuité d'angle", async () => {
    const history = openingHistory();
    const follow = resolveSubjectAngleFollowupShortCircuit(
      "C'est quoi la Citadelle ?",
      history,
    );
    assert.equal(follow, null);
  });

  it("ta réponse était hors sujet → méta inchangé", async () => {
    const history = openingHistory();
    const follow = resolveSubjectAngleFollowupShortCircuit(
      "ta réponse était hors sujet",
      history,
    );
    assert.equal(follow, null);
    const hit = await runConversationShortCircuit("ta réponse était hors sujet", {
      history,
    });
    assert.notEqual(hit?.path, "subject_angle_explore");
    assert.notEqual(hit?.path, "general_knowledge_continuity_carryover");
  });

  it("autre sujet → on lâche le fil ouvert, sans coller le harness", async () => {
    const history = openingHistory();
    const q = "parlons plutôt de la cuisine, tu as une recette de carbonara ?";
    const follow = resolveSubjectAngleFollowupShortCircuit(q, history);
    assert.equal(follow, null);
    const hit = await runConversationShortCircuit(q, { history });
    assert.doesNotMatch(hit?.continuityEffectiveQuery || "", /deepseek harness/i);
    assert.notEqual(hit?.path, "subject_angle_explore");
  });

  it("python T3→T4 : plutôt la syntaxe + renseigne-toi → sujet+angle, pas piste", async () => {
    const open = resolveExploratorySubjectAngleShortCircuit(LIVE_PYTHON);
    assert.equal(open?.path, "subject_angle_explore");
    assert.match(open?.reply || "", /langage python|python/i);

    const history = [
      { role: "user", content: "salut salut" },
      { role: "assistant", content: "Salut !" },
      { role: "user", content: "quoi de neuf ?" },
      { role: "assistant", content: "Je suis dispo. Tu veux qu'on bosse sur quoi ?" },
      { role: "user", content: LIVE_PYTHON },
      { role: "assistant", content: open.reply },
    ];
    const state = extractConversationState(history);
    assert.equal(state.turnPhase, CONTINUITY_TURN_PHASES.ANGLE_CHOICE_PENDING);

    const follow = resolveSubjectAngleFollowupShortCircuit(LIVE_PYTHON_T4, history);
    assert.ok(follow);
    assert.match(follow.effectiveQuery || "", /syntaxe/i);
    assert.match(follow.effectiveQuery || "", /python/i);
    assert.equal(follow.preferWebResearch, true);
    assert.doesNotMatch(follow.effectiveQuery || "", /piste|destination/i);

    const hit = await runConversationShortCircuit(LIVE_PYTHON_T4, { history });
    assert.notEqual(hit?.path, "subject_angle_explore");
    assert.match(hit?.continuityEffectiveQuery || "", /syntaxe/i);
    assert.match(hit?.continuityEffectiveQuery || "", /python/i);
    assert.equal(hit?.preferWebResearch, true);
    assert.doesNotMatch(hit?.reply || "", /piste, mais pas encore la destination/i);
  });

  it("après python, tu connais excel → nouveau cadre, pas avis-sur-python", async () => {
    const open = resolveExploratorySubjectAngleShortCircuit(LIVE_PYTHON);
    const history = [
      { role: "user", content: LIVE_PYTHON },
      { role: "assistant", content: open.reply },
    ];
    const follow = resolveSubjectAngleFollowupShortCircuit(
      "est ce que tu connais excel ??",
      history,
    );
    assert.equal(follow, null);
    const hit = await runConversationShortCircuit("est ce que tu connais excel ??", {
      history,
    });
    assert.equal(hit?.path, "subject_angle_explore");
    assert.match(hit?.reply || "", /excel/i);
    assert.doesNotMatch(hit?.reply || "", /langage python/i);
    assert.doesNotMatch(hit?.continuityEffectiveQuery || "", /Avis concret sur/i);
  });
});


