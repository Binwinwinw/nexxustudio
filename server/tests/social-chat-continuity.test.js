import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isSocialChatThreadActive,
  isSoftSocialChatFollowup,
  isWellbeingCheckinIntent,
  isPhaticSocialCheckinIntent,
  resolveCulturalReferenceHypothesis,
  resolveSocialChatContinuityShortCircuit,
  isShortDevWorkOfferFollowup,
  hasPostRepairSocialClose,
  hasEmotionResolvedSignal,
} from "../src/agent/policies/social/index.js";
import {
  isDebugDiagnosticRequest,
  isDebugDiagnosticSignal,
} from "../src/agent/utils/intent-guards/debugDiagnosticIntentGuards.js";
import { evaluateConversationMove } from "../src/agent/policies/conversation/conversationMovePolicy.js";
import { classifyDebugDiagnosticMove } from "../src/agent/micro/replies/debugDiagnosticComposer.js";
import { isGeneralKnowledgeRequest } from "../src/agent/utils/intent-guards/generalKnowledgeIntentGuards.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { evaluateJustIntent } from "../src/agent/policies/intent/justIntentDetectionPolicy.js";
import {
  CLARIFICATION_DECISIONS,
  evaluateClarificationDecision,
} from "../src/agent/policies/routing/clarificationDecisionPolicy.js";

const CHAT_HISTORY = [
  { role: "user", content: "yop yop" },
  {
    role: "assistant",
    content: "Salut ! Sur quoi veux-tu travailler aujourd'hui ?",
  },
  {
    role: "user",
    content: "bah on discute un peu avant di tu veux bien",
  },
  {
    role: "assistant",
    content:
      "Oui bien sûr, on peut discuter. Tu as un sujet en tête ou quelque chose de particulier à faire ?",
  },
];

describe("social chat continuity — sujet court après chat_invite", () => {
  it("détecte le fil papoter ouvert", () => {
    assert.equal(isSocialChatThreadActive(CHAT_HISTORY), true);
  });

  it("accepte un mot / groupe de mots comme follow-up soft", () => {
    for (const q of ["musique", "les jeux video", "IA", "la citadelle"]) {
      assert.equal(isSoftSocialChatFollowup(q), true, q);
    }
  });

  it("refuse une demande métier claire", () => {
    assert.equal(
      isSoftSocialChatFollowup("crée un site html pour mon portfolio"),
      false,
    );
    assert.equal(
      resolveSocialChatContinuityShortCircuit(
        "crée un site html pour mon portfolio",
        { history: CHAT_HISTORY },
      ),
      null,
    );
  });

  it("aide HTML courte après papoter → relance technique locale, pas guided", async () => {
    const q = "tu peux m'aider à modifier du code html ?";
    const liveHistory = [
      { role: "user", content: "yélélé'y, salut" },
      {
        role: "assistant",
        content:
          "Salut ! Si tu veux on peut papoter ou je t'aide à cadrer un projet, clarifier un besoin, structurer des livrables. Qu'est-ce que tu veux faire ?",
      },
      { role: "user", content: "tu vas bien ??" },
      { role: "assistant", content: "Tout va bien ici." },
    ];
    assert.equal(isSoftSocialChatFollowup(q), true);
    assert.equal(isShortDevWorkOfferFollowup(q), true);
    const policyHit = resolveSocialChatContinuityShortCircuit(q, {
      history: liveHistory,
    });
    assert.equal(policyHit?.path, "exploratory_conversation_light");
    assert.equal(policyHit?.deferToLlm, false);
    assert.equal(policyHit?.skipComposer, true);
    assert.equal(policyHit?.devTechnicalNudge, true);
    assert.match(policyHit?.reply || "", /HTML/i);
    assert.match(policyHit?.reply || "", /design|structure|responsive|bug/i);

    const sc = await runConversationShortCircuit(q, { history: liveHistory });
    assert.equal(sc?.path, "exploratory_conversation_light");
    assert.notEqual(sc?.path, "guided_creation_scoping");
    assert.equal(sc?.deferToLlm, false);
    assert.equal(sc?.skipComposer, true);
    assert.ok(sc?.reply);
    assert.doesNotMatch(sc?.reply || "", /GUIDED_CREATION|Forge/i);
  });

  it("améliore présentation portfolio HTML après papoter+work_ready ≠ SharePoint", async () => {
    const q =
      "et bien on va directement attaquer du lourd, as tu des connaissances en html car je voudrais que tu proposes une amélioration de la présentation de mon portefolio. Pourrais tu m'aider??";
    const liveHistory = [
      { role: "user", content: "salut" },
      {
        role: "assistant",
        content:
          "Salut ! Si tu veux on peut papoter ou je t'aide à cadrer un projet, clarifier un besoin, structurer des livrables. Qu'est-ce que tu veux faire ?",
      },
      { role: "user", content: "comment vas tu ?" },
      { role: "assistant", content: "Tout va bien ici." },
      {
        role: "user",
        content: "tous tes programmes sont prêt à travailler ?",
      },
      { role: "assistant", content: "Prêt — on lance quoi ?" },
    ];
    assert.equal(isShortDevWorkOfferFollowup(q), true);
    const sc = await runConversationShortCircuit(q, { history: liveHistory });
    assert.notEqual(sc?.path, "web_project_scoping_clarify");
    assert.notEqual(sc?.path, "guided_creation_scoping");
    assert.equal(sc?.path, "exploratory_conversation_light");
    assert.equal(sc?.deferToLlm, false);
    assert.equal(sc?.skipComposer, true);
    assert.match(sc?.reply || "", /présentation|design|structure|responsive/i);
    assert.doesNotMatch(sc?.reply || "", /SharePoint|intranet|WordPress/i);
  });

  it("même phrase HTML portfolio sans historique → relance technique (HTTP entity pivot)", async () => {
    const q =
      "et bien on va directement attaquer du lourd, as tu des connaissances en html car je voudrais que tu proposes une amélioration de la présentation de mon portefolio. Pourrais tu m'aider??";
    const hit = resolveSocialChatContinuityShortCircuit(q, { history: [] });
    assert.equal(hit?.devTechnicalNudge, true);
    assert.equal(hit?.path, "exploratory_conversation_light");
    const sc = await runConversationShortCircuit(q, { history: [] });
    assert.equal(sc?.path, "exploratory_conversation_light");
    assert.equal(sc?.deferToLlm, false);
    assert.equal(sc?.skipComposer, true);
    assert.notEqual(sc?.path, "information_seeking_full_pipeline");
  });

  it("aide CSS courte après papoter → relance technique locale", async () => {
    const q = "tu peux m'aider à corriger cette page css ?";
    assert.equal(isSoftSocialChatFollowup(q), true);
    assert.equal(isShortDevWorkOfferFollowup(q), true);
    const sc = await runConversationShortCircuit(q, { history: CHAT_HISTORY });
    assert.equal(sc?.path, "exploratory_conversation_light");
    assert.notEqual(sc?.path, "guided_creation_scoping");
    assert.equal(sc?.deferToLlm, false);
    assert.equal(sc?.skipComposer, true);
    assert.match(sc?.reply || "", /CSS/i);
  });

  it("sujet court non dev après papoter → exploratory LLM inchangé", async () => {
    const hit = await runConversationShortCircuit("musique", {
      history: CHAT_HISTORY,
    });
    assert.equal(hit?.path, "exploratory_conversation_light");
    assert.equal(hit?.deferToLlm, true);
    assert.equal(hit?.skipComposer, undefined);
    assert.equal(hit?.reply, null);
  });

  it("demande vague projet longue après papoter → guided_creation inchangé", async () => {
    const q =
      "j'aimerais créer un agent IA en langage python tu pourrais m'aider à le faire ?";
    assert.equal(isShortDevWorkOfferFollowup(q), false);
    const sc = await runConversationShortCircuit(q, { history: CHAT_HISTORY });
    assert.equal(sc?.path, "guided_creation_scoping");
    assert.notEqual(sc?.devTechnicalNudge, true);
  });

  it("HTML collé après papoter ≠ relance technique courte", () => {
    const q = [
      "voici mon portfolio une page html qu'il faut améliorer :",
      '<!DOCTYPE html><html lang="fr"><body><p>ok</p></body></html>',
    ].join("\n");
    assert.equal(isShortDevWorkOfferFollowup(q), false);
    const hit = resolveSocialChatContinuityShortCircuit(q, {
      history: CHAT_HISTORY,
    });
    assert.notEqual(hit?.devTechnicalNudge, true);
    assert.notEqual(Boolean(hit?.reply && hit?.devTechnicalNudge), true);
  });

  it("refuse les questions factuelles / info-seeking (pas exploratory chat)", async () => {
    for (const q of [
      "c'est quoi la photosynthèse ?",
      "quelle est la capitale de la France ?",
      "combien font 12 fois 8 ?",
    ]) {
      assert.equal(isSoftSocialChatFollowup(q), false, q);
      assert.equal(
        resolveSocialChatContinuityShortCircuit(q, { history: CHAT_HISTORY }),
        null,
        q,
      );
    }
    const hit = await runConversationShortCircuit(
      "c'est quoi la photosynthèse ?",
      { history: CHAT_HISTORY },
    );
    assert.notEqual(hit?.path, "exploratory_conversation_light");
    assert.notEqual(hit?.socialChatContinuity, true);
  });

  it("refuse symptôme corporel → personal_discomfort, pas exploratory LLM", async () => {
    const q = "j'ai fais caca bleu tu saurais d'ou ca peut venir ?";
    const history = [
      ...CHAT_HISTORY,
      {
        role: "user",
        content: "j'ai mal au ventre qu'est ce que tu peux faire pour cela ?",
      },
      {
        role: "assistant",
        content:
          "Désolé que tu te sentes pas bien — je ne suis pas un médecin. Tu veux plutôt discuter ?",
      },
    ];
    assert.equal(isSoftSocialChatFollowup(q), false);
    assert.equal(
      resolveSocialChatContinuityShortCircuit(q, { history }),
      null,
    );
    const hit = await runConversationShortCircuit(q, { history });
    assert.equal(hit?.path, "social_deterministic");
    assert.equal(hit?.socialPatternName, "social/personal_discomfort");
    assert.match(hit?.reply || "", /pas m[eé]decin/i);
    assert.doesNotMatch(hit?.reply || "", /synthèse experte|consigne utilisateur/i);
  });

  it("pipi + d'où → variante curiosité (apostrophes normalisées)", async () => {
    const q = "j'ai pipi au lit d'ou ça peut venir ?";
    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.socialPatternName, "social/personal_discomfort");
    assert.match(hit?.reply || "", /d['']?o[uù] ça vient|pas m[eé]decin/i);
    assert.doesNotMatch(hit?.reply || "", /Désolé que tu te sentes pas bien/i);
  });

  it("pivot branche → whimsical social, pas web/COMPOSER", async () => {
    const q = "je crois que je vais aller m'asseoir sur une branche";
    const history = [
      {
        role: "user",
        content: "j'ai mal au ventre qu'est ce que tu peux faire pour cela ?",
      },
      {
        role: "assistant",
        content:
          "Désolé que tu te sentes pas bien — je ne suis pas un médecin. Tu veux plutôt discuter ou passer à autre chose ?",
      },
    ];
    assert.equal(isSocialChatThreadActive(history), true);
    const hit = await runConversationShortCircuit(q, { history });
    assert.equal(hit?.path, "social_deterministic");
    assert.equal(hit?.socialPatternName, "social/whimsical_pivot");
    assert.doesNotMatch(hit?.reply || "", /Molière|Forge|handoff/i);
  });

  it("refuse jugement méta assistant → meta SGT reflective, pas exploratory LLM", async () => {
    const history = [
      { role: "user", content: "bonjour comment ca va là dedans ?" },
      {
        role: "assistant",
        content:
          "Bonjour ! Si tu veux on peut papoter ou je t'aide à cadrer un projet, clarifier un besoin, structurer des livrables. Qu'est-ce que tu veux faire ?",
      },
    ];
    const q = "est-ce qu'on peut dire que tu es de bons conseils ??";
    assert.equal(isSoftSocialChatFollowup(q), false);
    assert.equal(
      resolveSocialChatContinuityShortCircuit(q, { history }),
      null,
    );
    const hit = await runConversationShortCircuit(q, { history });
    assert.equal(hit?.path, "meta_conversation_reflective");
    assert.equal(hit?.deferToLlm, true);
    assert.equal(hit?.metaSubKind, "assistant_trust");
    assert.match(hit?.reflectiveHint || "", /VARIANTE SGT \(assistant_trust\)/i);
    assert.match(hit?.reflectiveHint || "", /NEXXUS/i);
    assert.match(hit?.reflectiveHint || "", /mod[eè]le de langage/i);
    assert.match(hit?.reflectiveHint || "", /INTERDIT/i);
    assert.ok(!hit?.reply);
  });

  it("mini-reprises après chat_invite → restent en social, pas general/explain", async () => {
    const history = [
      { role: "user", content: "salut et si on papotait ?" },
      {
        role: "assistant",
        content:
          "Salut ! Si tu veux on peut papoter ou je t'aide à cadrer un projet, clarifier un besoin, structurer des livrables. Qu'est-ce que tu veux faire ?",
      },
      { role: "user", content: "salut et si on papotait ?" },
      {
        role: "assistant",
        content: "Salut — ok, je t'écoute. De quel sujet tu as envie qu'on parle ?",
      },
    ];

    for (const q of ["comment ?", "hein ?", "et ?", "pourquoi ?"]) {
      assert.equal(isSoftSocialChatFollowup(q), false, q);
      const cont = resolveSocialChatContinuityShortCircuit(q, { history });
      assert.equal(cont?.path, "social_deterministic", q);
      assert.equal(cont?.socialOpenThreadHold, true, q);
      assert.equal(cont?.deferToLlm, false, q);

      const hit = await runConversationShortCircuit(q, { history });
      assert.equal(hit?.path, "social_deterministic", q);
      assert.notEqual(hit?.path, "exploratory_conversation_light", q);
      assert.notEqual(hit?.deferToLlm, true, q);
      assert.match(hit?.reply || "", /sujet|papoter|penches/i, q);
      assert.doesNotMatch(hit?.reply || "", /synthèse experte|Pas de titres/i, q);
    }
  });

  it("pourquoi le ciel est bleu hors mini-reprise nue (pas hold social)", () => {
    const history = [
      {
        role: "assistant",
        content: "Salut — ok, je t'écoute. De quel sujet tu as envie qu'on parle ?",
      },
    ];
    const q = "pourquoi le ciel est bleu ?";
    const cont = resolveSocialChatContinuityShortCircuit(q, { history });
    assert.notEqual(cont?.socialOpenThreadHold, true);
    assert.notEqual(cont?.path, "social_deterministic");
  });

  it("vouvoiement « comment allez vous monsieur ou madame » = check-in, pas composer", async () => {
    const history = [
      { role: "user", content: "bonsoir" },
      {
        role: "assistant",
        content:
          "Salut ! Si tu veux on peut papoter ou je t'aide à cadrer un projet, clarifier un besoin, structurer des livrables. Qu'est-ce que tu veux faire ?",
      },
    ];
    const q = "comment allez vous monsieur ou madame ??";
    assert.equal(isWellbeingCheckinIntent(q), true);
    assert.equal(isSoftSocialChatFollowup(q), false);
    assert.equal(resolveSocialChatContinuityShortCircuit(q, { history }), null);
    const hit = await runConversationShortCircuit(q, { history });
    assert.equal(hit?.path, "social_deterministic");
    assert.notEqual(hit?.path, "exploratory_conversation_light");
    assert.ok(hit?.reply);
    assert.match(hit?.reply || "", /je vais bien, merci/i);
    assert.match(hit?.reply || "", /\bvous\b/i);
    assert.doesNotMatch(hit?.reply || "", /\b(?:tu|te|ton|ta|tes)\b/i);
    assert.doesNotMatch(hit?.reply || "", /Je vois la piste/i);
    const just = evaluateJustIntent(q);
    assert.equal(just?.domain, "social");
    assert.equal(just?.action, "social_checkin");
  });

  it("check-in wellbeing après offre papoter → social_deterministic, pas exploratory", async () => {
    const history = [
      { role: "user", content: "salut salut" },
      {
        role: "assistant",
        content:
          "Salut ! Si tu veux on peut papoter ou je t'aide à cadrer un projet, clarifier un besoin, structurer des livrables. Qu'est-ce que tu veux faire ?",
      },
    ];
    const q = "comment ça va ?";
    assert.equal(isWellbeingCheckinIntent(q), true);
    assert.equal(isSoftSocialChatFollowup(q), false);
    assert.equal(resolveSocialChatContinuityShortCircuit(q, { history }), null);
    const hit = await runConversationShortCircuit(q, { history });
    assert.equal(hit?.path, "social_deterministic");
    assert.notEqual(hit?.path, "exploratory_conversation_light");
    assert.ok(hit?.reply);
    assert.doesNotMatch(hit?.reply || "", /on discute de quoi/i);
  });

  it("typo « comment cava » = même check-in santé déterministe", async () => {
    const replies = new Set();
    for (const q of ["comment cava ?", "comment ca va ???", "comment vas tu ?"]) {
      assert.equal(isWellbeingCheckinIntent(q), true, q);
      const hit = await runConversationShortCircuit(q);
      assert.equal(hit?.path, "social_deterministic", q);
      assert.ok(hit?.reply, q);
      assert.ok(
        (hit?.reply || "").length <= 28,
        `réponse trop longue (${(hit?.reply || "").length}): ${q} → ${hit?.reply}`,
      );
      assert.match(
        hit?.reply || "",
        /^(?:Ça va bien, merci\.|Tout va bien ici\.|Ça va, merci\.)$/,
      );
      assert.doesNotMatch(
        hit?.reply || "",
        /avancer|discut|papoter|aujourd'?hui|étymolog|parce que/i,
      );
      replies.add(hit?.reply);
    }
    // Même intention canonique → une seule formulation (pas de divergence).
    assert.equal(replies.size, 1);
  });

  it("critique méta check-in incohérent → pattern court, pas culture générale", async () => {
    const q =
      'sais tu que " comment ca va " et "comment vas tu" peuvent être considéré comme de la même valeur mais alors pourquoi as tu répondu de deux façons complètement différente et surtout l\'une complètement à l\'ouest ????';
    assert.equal(isWellbeingCheckinIntent(q), false);
    assert.equal(isGeneralKnowledgeRequest(q), false);
    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "social_deterministic");
    assert.equal(hit?.socialPatternName, "social/checkin_consistency");
    assert.ok((hit?.reply || "").length < 120);
    assert.match(hit?.reply || "", /même check-in|même réponse courte/i);
    assert.doesNotMatch(
      hit?.reply || "",
      /ancien français|micro-délestage|étymolog|routing|exposé|token/i,
    );

    const gated = await runConversationShortCircuit(q, {
      turnComprehension: {
        responseExpectations: { mayFinalizeSocial: false },
        dominance: { workPresent: true },
      },
    });
    assert.equal(gated?.path, "social_deterministic");
    assert.equal(gated?.socialPatternName, "social/checkin_consistency");
    assert.notEqual(gated?.path, "general_knowledge_full_pipeline");
  });

  it("réponse bizarre / peur → tone_repair court, pas exploratory ni web", async () => {
    const history = [
      { role: "user", content: "hello c'est cool pour toi ca va bien ??" },
      { role: "assistant", content: "Ça va, merci." },
    ];
    const q = "okok tu m'as fais peur avec ta réponse bizarre là";
    assert.equal(isSoftSocialChatFollowup(q), false);
    const hit = await runConversationShortCircuit(q, { history });
    assert.equal(hit?.path, "social_deterministic");
    assert.equal(hit?.socialPatternName, "social/tone_repair");
    assert.ok((hit?.reply || "").length < 100);
    assert.doesNotMatch(hit?.reply || "", /anxiété|sources web|peur\b.{0,20}gérer/i);
  });

  it("peur disparue / induit en erreur → tone_repair, pas debug_diagnostic", async () => {
    const q =
      "ton comportement m'as induit en erreur et ma peur n'est pas justifée elle a disparu";
    assert.equal(isSoftSocialChatFollowup(q), false);
    assert.equal(hasEmotionResolvedSignal(q), true);
    assert.equal(hasPostRepairSocialClose(q), true);
    assert.equal(isDebugDiagnosticSignal(q), false);
    assert.equal(isDebugDiagnosticRequest(q), false);
    assert.equal(classifyDebugDiagnosticMove(q), null);
    const move = evaluateConversationMove(q);
    assert.notEqual(move?.pipelinePath, "debug_diagnostic_clarify");
    assert.notEqual(move?.family, "debug_diagnostic");
    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "social_deterministic");
    assert.equal(hit?.socialPatternName, "social/tone_repair");
    assert.ok((hit?.reply || "").length < 100);
    assert.match(hit?.reply || "", /retomb|laisse ça|tant mieux/i);
    assert.doesNotMatch(
      hit?.reply || "",
      /composant|symptôme|log|diagnostic|outil|version/i,
    );
  });

  it("re-salutation dans fil papoter → social_deterministic, pas exploratory", async () => {
    const history = [
      { role: "user", content: "salut salut" },
      {
        role: "assistant",
        content:
          "Salut ! Si tu veux on peut papoter ou je t'aide à cadrer un projet. Qu'est-ce que tu veux faire ?",
      },
      { role: "user", content: "comment ça va ?" },
      { role: "assistant", content: "Oui bien sûr, on discute de quoi ?" },
    ];
    assert.equal(isSoftSocialChatFollowup("salut salut"), false);
    const hit = await runConversationShortCircuit("salut salut", { history });
    assert.equal(hit?.path, "social_deterministic");
    assert.notEqual(hit?.path, "exploratory_conversation_light");
  });

  it("qu'est-ce que tu fais après check-in → phatic social, pas exploratory LLM", async () => {
    const history = [
      { role: "user", content: "salut salut" },
      {
        role: "assistant",
        content:
          "Salut ! Si tu veux on peut papoter ou je t'aide à cadrer un projet. Qu'est-ce que tu veux faire ?",
      },
      { role: "user", content: "comment ça va ?" },
      {
        role: "assistant",
        content: "Ça va bien de mon côté. Tu veux avancer sur quoi aujourd'hui ?",
      },
    ];
    const q = "ben rien de spé et toi qu'est-ce que tu fais ?";
    assert.equal(isPhaticSocialCheckinIntent(q), true);
    assert.equal(isSoftSocialChatFollowup(q), false);
    const hit = await runConversationShortCircuit(q, { history });
    assert.equal(hit?.path, "social_deterministic");
    assert.equal(hit?.socialPatternName, "social/phatic_checkin");
    assert.notEqual(hit?.path, "exploratory_conversation_light");
    assert.ok(hit?.reply);
    assert.doesNotMatch(hit?.reply || "", /L'utilisateur me demande/i);
  });

  it("short-circuit → exploratory_conversation_light + rewrite", async () => {
    const hit = await runConversationShortCircuit("musique", {
      history: CHAT_HISTORY,
    });
    assert.equal(hit?.path, "exploratory_conversation_light");
    assert.equal(hit?.deferToLlm, true);
    assert.equal(hit?.socialChatContinuity, true);
    assert.match(hit?.continuityEffectiveQuery || "", /musique/i);
    assert.match(hit?.reflectiveHint || "", /CHAT SOCIAL CONTINU/i);
  });

  it("clarification gate reste can_answer_now", () => {
    const decision = evaluateClarificationDecision("les jeux video", {
      history: CHAT_HISTORY,
    });
    assert.equal(decision.decision, CLARIFICATION_DECISIONS.CAN_ANSWER_NOW);
  });

  it("continuité après un tour sur le sujet", async () => {
    const history = [
      ...CHAT_HISTORY,
      { role: "user", content: "musique" },
      {
        role: "assistant",
        content:
          "La musique, ça ouvre plein de portes. Jazz, électro, bandes-son… Tu penches vers quoi ?",
      },
    ];
    // fil encore actif via l'offre « on discute » plus haut
    assert.equal(isSocialChatThreadActive(history), true);
    const hit = await runConversationShortCircuit("surtout le jazz", {
      history,
    });
    assert.equal(hit?.socialChatContinuity, true);
    assert.equal(hit?.deferToLlm, true);
  });

  it("proposition floue NXT → couche épistémique + hypothèse WWE NXT, pas clarify générique", async () => {
    const q =
      "heuuuum ben je pense à un sport ou il y a la ligue NXT, ça te dit quelque chose ???";
    assert.equal(isSoftSocialChatFollowup(q), true);
    const hyp = resolveCulturalReferenceHypothesis(q);
    assert.equal(hyp?.id, "wwe_nxt");
    assert.equal(hyp?.confidence, "medium");
    const hit = await runConversationShortCircuit(q, { history: CHAT_HISTORY });
    assert.equal(hit?.path, "social_deterministic");
    assert.equal(hit?.culturalHypothesis, true);
    assert.ok(hit?.epistemicResolution);
    assert.equal(hit?.epistemicResolution?.action, "targeted_clarify");
    assert.notEqual(hit?.path, "request_interpreter_clarify");
    assert.doesNotMatch(hit?.reply || "", /quel sujet exactement/i);
    assert.match(hit?.reply || "", /WWE NXT/i);
    assert.match(hit?.reply || "", /Si oui/i);
  });

  it("terme culturel déjà nommé (WWE NXT) → exploration sans mini-clarify", () => {
    const hit = resolveSocialChatContinuityShortCircuit(
      "on parle de la WWE NXT",
      { history: CHAT_HISTORY },
    );
    assert.equal(hit?.culturalHypothesis, undefined);
    assert.equal(hit?.deferToLlm, true);
    assert.match(hit?.continuityEffectiveQuery || "", /WWE NXT/i);
  });

  it("image jointe après fil papoter → pipeline Vision, pas exploratory_conversation_light", async () => {
    const papoterHistory = [
      {
        role: "assistant",
        content:
          "Bonjour ! Si tu veux on peut papoter ou je t'aide à cadrer un projet. Qu'est-ce que tu veux faire ?",
      },
    ];
    const attachments = [
      {
        mimetype: "image/png",
        originalname: "capture.png",
        buffer: Buffer.from("fake"),
      },
    ];
    const hit = await runConversationShortCircuit(
      "fait une description de l'image",
      { history: papoterHistory, attachments },
    );
    assert.equal(hit?.path, "attached_vision_full_pipeline");
    assert.equal(hit?.deferToFullPipeline, true);
    assert.notEqual(hit?.socialChatContinuity, true);
  });
});
