import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isSocialChatThreadActive,
  isSoftSocialChatFollowup,
  resolveCulturalReferenceHypothesis,
  resolveSocialChatContinuityShortCircuit,
} from "../src/agent/policies/social/index.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import {
  CLARIFICATION_DECISIONS,
  evaluateClarificationDecision,
} from "../src/agent/policies/clarificationDecisionPolicy.js";

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
