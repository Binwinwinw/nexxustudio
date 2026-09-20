import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { isNamedDefinitionRequest } from "../src/agent/utils/intent-guards/informationSeekingIntentGuards.js";
import { getIdentityDeterministicReply } from "../src/agent/utils/intent-guards/identityIntentGuards.js";
import { buildTurnComprehension } from "../src/agent/policies/conversation/turnComprehension.js";
import {
  matchInternalReferent,
  resolveInternalReferentAuthorityHit,
  resolveUnnamedInternalIdentityHit,
  isOperatingPlatformNameAsk,
  resolveInternalReferentConfirmationCheck,
} from "../src/agent/policies/routing/internalReferentsAuthorityGate.js";

const scOpts = {
  getDeterministicSocialResponse: (q) => getIdentityDeterministicReply(q),
};

const CITADELLE_REPLY =
  "La Citadelle, c'est la plateforme. NEXXUS est l'assistant IA qui y tourne.";
const NEXXUS_REPLY =
  "NEXXUS, c'est moi : l'assistant IA de La Citadelle.";

function liveOpts(query) {
  return {
    ...scOpts,
    turnComprehension: buildTurnComprehension(query, []),
    turnLoop: {},
  };
}

function assertDirectReferent(sc, referent) {
  assert.ok(sc?.reply, "réponse directe attendue");
  assert.equal(sc.internalReferent, referent);
  assert.equal(sc.internalReferentAuthority, true);
  assert.equal(sc.preferWebResearch, false);
  assert.notEqual(sc.path, "simple_factual_lookup");
  assert.notEqual(sc.path, "information_seeking_full_pipeline");
  assert.doesNotMatch(sc.reply, /piste|destination/i);
}

describe("internal referents authority gate", () => {
  it("match : La Citadelle / Nexxus / Nexxus Studio ; pas le nom commun", () => {
    assert.equal(matchInternalReferent("C'est quoi la Citadelle ?"), "La Citadelle");
    assert.equal(matchInternalReferent("C'est quoi Nexxus ?"), "Nexxus");
    assert.equal(matchInternalReferent("C'est quoi Nexxus Studio ?"), "Nexxus Studio");
    assert.equal(matchInternalReferent("C'est quoi une citadelle ?"), null);
    assert.equal(matchInternalReferent("Explique-moi la féodalité."), null);
    assert.equal(resolveInternalReferentAuthorityHit("C'est quoi une citadelle ?"), null);
  });

  it("C'est quoi la Citadelle ? — plateforme, pas la fiche qui-es-tu", async () => {
    const sc = await runConversationShortCircuit("C'est quoi la citadelle ??", scOpts);
    assert.notEqual(sc?.path, "information_seeking_full_pipeline");
    assert.equal(sc?.preferWebResearch, false);
    assert.equal(sc?.internalReferent, "La Citadelle");
    assert.equal(sc.reply, CITADELLE_REPLY);
  });

  it("la citadelle c'est quoi ? — même referent, pas simple_fast vide", async () => {
    const sc = await runConversationShortCircuit("la citadelle c'est quoi ?", liveOpts("la citadelle c'est quoi ?"));
    assertDirectReferent(sc, "La Citadelle");
    assert.equal(sc.path, "general_knowledge_deterministic");
    assert.equal(sc.reply, CITADELLE_REPLY);
    assert.notEqual(sc?.path, "simple_fast");
    assert.equal(isNamedDefinitionRequest("la citadelle c'est quoi ?"), false);
  });

  it("La Citadelle, c'est quoi ? — virgule, même referent", async () => {
    const q = "La Citadelle, c'est quoi ?";
    const sc = await runConversationShortCircuit(q, liveOpts(q));
    assertDirectReferent(sc, "La Citadelle");
    assert.equal(sc.path, "general_knowledge_deterministic");
    assert.equal(sc.reply, CITADELLE_REPLY);
    assert.equal(isNamedDefinitionRequest(q), false);
  });

  it("X c'est quoi générique — pas de référent, pas de définition nommée", async () => {
    const generics = [
      "Ce truc, c'est quoi ?",
      "Cette erreur, c'est quoi ?",
      "La meilleure option, c'est quoi ?",
      "Ce mot, c'est quoi ?",
    ];
    for (const q of generics) {
      assert.equal(isNamedDefinitionRequest(q), false, q);
      const sc = await runConversationShortCircuit(q, liveOpts(q));
      assert.ok(!sc?.internalReferentAuthority, q);
      assert.notEqual(sc?.internalReferent, "La Citadelle", q);
      assert.notEqual(sc?.internalReferent, "Nexxus", q);
      assert.notEqual(sc?.path, "information_seeking_full_pipeline", q);
      assert.notEqual(sc?.reply, CITADELLE_REPLY, q);
      assert.notEqual(sc?.reply, NEXXUS_REPLY, q);
    }
  });

  it("Qui es-tu ? — identité locale, pas de web", async () => {
    const sc = await runConversationShortCircuit("Qui es-tu ?", scOpts);
    assert.equal(sc?.path, "social_deterministic");
    assert.notEqual(sc?.path, "information_seeking_full_pipeline");
    assert.ok(!sc?.preferWebResearch);
    assert.match(sc.reply, /NEXXUS/i);
  });

  it("Dans quel environnement tu tournes ? — pas information_seeking web", async () => {
    const sc = await runConversationShortCircuit(
      "Dans quel environnement tu tournes ?",
      scOpts,
    );
    assert.notEqual(sc?.path, "information_seeking_full_pipeline");
    assert.ok(!sc?.preferWebResearch);
  });

  it("C'est quoi Nexxus ? — pas de web", async () => {
    const sc = await runConversationShortCircuit("C'est quoi Nexxus ?", scOpts);
    assert.notEqual(sc?.path, "information_seeking_full_pipeline");
    assert.equal(sc?.preferWebResearch, false);
    assert.ok(sc?.reply);
    assert.match(sc.reply, /assistant/i);
    assert.doesNotMatch(sc.reply, /^Salut !/i);
    assert.equal(sc?.internalReferent, "Nexxus");
  });

  it("C'est quoi une citadelle ? — inchangé, pipeline info", async () => {
    const sc = await runConversationShortCircuit("C'est quoi une citadelle ?", scOpts);
    assert.equal(sc?.path, "information_seeking_full_pipeline");
    assert.equal(sc?.preferWebResearch, true);
    assert.ok(!sc?.internalReferentAuthority);
  });

  it("Explique-moi la féodalité. — pas capturé par le gate", async () => {
    const sc = await runConversationShortCircuit("Explique-moi la féodalité.", scOpts);
    assert.ok(!sc?.internalReferentAuthority);
    assert.notEqual(sc?.path, "information_seeking_full_pipeline");
  });

  it("Quelle heure est-il ? — datetime, pas de web", async () => {
    const sc = await runConversationShortCircuit("Quelle heure est-il ?", scOpts);
    assert.equal(sc?.path, "datetime_deterministic");
    assert.ok(!sc?.preferWebResearch);
    assert.ok(!sc?.internalReferentAuthority);
  });

  it("Résume-moi cet article. — synthèse, pas de web", async () => {
    const sc = await runConversationShortCircuit("Résume-moi cet article.", scOpts);
    assert.equal(sc?.path, "document_synthesis_clarify");
    assert.ok(!sc?.preferWebResearch);
    assert.ok(!sc?.internalReferentAuthority);
  });

  it("plateforme d’opération sans nom propre → La Citadelle", () => {
    const q = "comment s'appelle la plateforme sur laquelle tu opères";
    assert.equal(isOperatingPlatformNameAsk(q), true);
    assert.equal(matchInternalReferent(q), null);
    assert.equal(resolveUnnamedInternalIdentityHit(q)?.referent, "La Citadelle");
    assert.equal(resolveInternalReferentAuthorityHit(q)?.referent, "La Citadelle");
    assert.equal(isOperatingPlatformNameAsk("comment s'appelle la plateforme Steam"), false);
  });

  it("qui est NEXXUS → filet unnamed ; tiers exclus", () => {
    assert.equal(
      resolveUnnamedInternalIdentityHit("qui est nexxus ??")?.reply,
      NEXXUS_REPLY,
    );
    assert.equal(
      resolveUnnamedInternalIdentityHit("c'est qui NEXXUS ?")?.reply,
      NEXXUS_REPLY,
    );
    assert.equal(resolveUnnamedInternalIdentityHit("qui est Victor Hugo ?"), null);
    assert.equal(resolveUnnamedInternalIdentityHit("qui est cette personne ?"), null);
  });
});

const CONFIRM_REPLY =
  "Oui. NEXXUS, c'est l'assistant. La Citadelle, c'est la plateforme. Il ne faut pas les confondre.";
const REJECT_REPLY =
  "Non. NEXXUS, c'est l'assistant. La Citadelle, c'est la plateforme.";

describe("si j'ai bien compris — validation référents", () => {
  it("suffixe : ne pas confondre nexxus et la citadelle → oui", async () => {
    const q =
      "haaaa ok donc il ne faut pas confondre nexxus et la citadelle si j'ai bien compris?";
    const hit = resolveInternalReferentConfirmationCheck(q);
    assert.equal(hit?.reply, CONFIRM_REPLY);
    const sc = await runConversationShortCircuit(q, liveOpts(q));
    assert.equal(sc?.path, "general_knowledge_deterministic");
    assert.equal(sc.reply, CONFIRM_REPLY);
    assert.doesNotMatch(sc.reply, /papoter|piste|destination/i);
    assert.equal(sc.preferWebResearch, false);
  });

  it("préfixe : même proposition → oui", async () => {
    const q =
      "si j'ai bien compris il ne faut pas confondre nexxus et la citadelle";
    const sc = await runConversationShortCircuit(q, liveOpts(q));
    assert.equal(sc?.reply, CONFIRM_REPLY);
  });

  it("nexxus c'est la plateforme → non", async () => {
    const q = "si j'ai bien compris nexxus c'est la plateforme ?";
    assert.equal(resolveInternalReferentConfirmationCheck(q)?.reply, REJECT_REPLY);
    const sc = await runConversationShortCircuit(q, liveOpts(q));
    assert.equal(sc?.reply, REJECT_REPLY);
  });

  it("sans marqueur de validation → pas ce rail", () => {
    assert.equal(
      resolveInternalReferentConfirmationCheck(
        "donc nexxus c'est l'assistant et la citadelle c'est la plateforme",
      ),
      null,
    );
  });

  it("copule simple Nexxus = assistant, tête ou queue", async () => {
    for (const q of [
      "Nexxus c'est l'assistant, si j'ai bien compris",
      "Si j'ai bien compris, Nexxus c'est l'assistant",
    ]) {
      assert.equal(resolveInternalReferentConfirmationCheck(q)?.reply, CONFIRM_REPLY);
      const sc = await runConversationShortCircuit(q, liveOpts(q));
      assert.equal(sc?.reply, CONFIRM_REPLY);
      assert.equal(sc?.path, "general_knowledge_deterministic");
      assert.doesNotMatch(sc.reply, /papoter|piste|destination|Salut/i);
    }
  });

  it("copule simple Citadelle = plateforme, tête ou queue", async () => {
    for (const q of [
      "La Citadelle c'est la plateforme, si j'ai bien compris",
      "Si j'ai bien compris, La Citadelle c'est la plateforme",
    ]) {
      assert.equal(resolveInternalReferentConfirmationCheck(q)?.reply, CONFIRM_REPLY);
      const sc = await runConversationShortCircuit(q, liveOpts(q));
      assert.equal(sc?.reply, CONFIRM_REPLY);
    }
  });

  it("swap Nexxus = plateforme / Citadelle = assistant → non", async () => {
    const platform = "Nexxus c'est la plateforme, si j'ai bien compris";
    const assistant = "Si j'ai bien compris, La Citadelle c'est l'assistant";
    assert.equal(resolveInternalReferentConfirmationCheck(platform)?.reply, REJECT_REPLY);
    assert.equal(resolveInternalReferentConfirmationCheck(assistant)?.reply, REJECT_REPLY);
    assert.equal(
      (await runConversationShortCircuit(platform, liveOpts(platform)))?.reply,
      REJECT_REPLY,
    );
    assert.equal(
      (await runConversationShortCircuit(assistant, liveOpts(assistant)))?.reply,
      REJECT_REPLY,
    );
  });
});

describe("FIX-IDENTITY-QUESTIONS-DIRECT-ANSWER — live TC", () => {
  const battery = [
    {
      q: "comment t'appelles tu ??",
      referent: "Nexxus",
      reply: NEXXUS_REPLY,
    },
    {
      q: "comment s'appelle la plateforme sur laquelle tu opères",
      referent: "La Citadelle",
      reply: CITADELLE_REPLY,
    },
    {
      q: "c'est quoi la Citadelle ?",
      referent: "La Citadelle",
      reply: CITADELLE_REPLY,
    },
    {
      q: "c'est quoi Nexxus ?",
      referent: "Nexxus",
      reply: NEXXUS_REPLY,
    },
    {
      q: "c'est quoi Nexxus Studio ?",
      referent: "Nexxus Studio",
    },
    {
      q: "qui es-tu ?",
      referent: "Nexxus",
      reply: NEXXUS_REPLY,
    },
    {
      q: "qui est nexxus ??",
      referent: "Nexxus",
      reply: NEXXUS_REPLY,
    },
    {
      q: "c'est qui NEXXUS ?",
      referent: "Nexxus",
      reply: NEXXUS_REPLY,
    },
  ];

  for (const { q, referent, reply } of battery) {
    it(`${q} → gate référents, pas factual générique`, async () => {
      const sc = await runConversationShortCircuit(q, liveOpts(q));
      assertDirectReferent(sc, referent);
      assert.match(sc.reply, /NEXXUS/i);
      if (reply) assert.equal(sc.reply, reply);
      if (referent === "Nexxus Studio") {
        assert.match(sc.reply, /studio/i);
      }
    });
  }
});
