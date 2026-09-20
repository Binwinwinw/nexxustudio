/**
 * Batterie permanente — Packs 1/2/3/4/5/6/7 + identité interne.
 * Preuve : cd server && npm run premerge
 * Fiche : docs/CONVERSATIONAL_REGRESSIONS.md
 *
 * Ne pas importer agent.js (Ollama). SC déterministe seulement.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { getIdentityDeterministicReply } from "../src/agent/utils/intent-guards/identityIntentGuards.js";
import { buildTurnComprehension } from "../src/agent/policies/conversation/turnComprehension.js";
import {
  extractConversationState,
  CONTINUITY_TURN_PHASES,
  resolveSubjectAngleFollowupShortCircuit,
} from "../src/agent/micro/continuity/conversationContinuityContext.js";
import { resolveExploratorySubjectAngleShortCircuit } from "../src/agent/policies/conversation/conversationFramingPolicy.js";
import { classifyConversationTurn } from "../src/agent/micro/classifiers/conversationTurnType.js";
import { resolveMetaFeedbackShortCircuit } from "../src/agent/micro/replies/metaFeedbackReplyBuilder.js";
import { lookupRoutingCase } from "../src/agent/policies/routing/routingCaseDictionary.js";
import { isMetaKnownPeerProductQuery } from "../src/agent/policies/meta/metaCapabilitiesPolicy.js";
import { resolveSocialFamiliarityProbeShortCircuit } from "../src/agent/utils/intent-guards/familiarityIntentGuards.js";
import {
  extractConfirmationProposition,
  isConfirmationCheckArticulation,
  resolveGenericConfirmationCheck,
} from "../src/agent/policies/conversation/confirmationCheckArticulation.js";
import { resolveInternalReferentConfirmationCheck } from "../src/agent/policies/routing/internalReferentsAuthorityGate.js";

const scOpts = {
  getDeterministicSocialResponse: (q) => getIdentityDeterministicReply(q),
};

const LIVE_HARNESS =
  "rien de spécial j'essaie de travailler sur le deepseek harness, je ne sais pas si tu connais?";
const LIVE_PYTHON =
  "rien de spécial j'essaie de travailler sur le langage python, je ne sais pas si tu connais ?";
const LIVE_PYTHON_T4 =
  "oui plutôt la syntaxe du python, tu peux te renseigner pour moi stp ??";
const LIVE_SALUT = "salut qu'est ce que tu fais de beau ?";
const LIVE_SALUT_REPLY =
  "Salut ! Rien de fou de mon côté — prêt à t'aider sur ton chantier. On attaque quoi ?";

const CITADELLE_REPLY =
  "La Citadelle, c'est la plateforme. NEXXUS est l'assistant IA qui y tourne.";
const NEXXUS_REPLY =
  "NEXXUS, c'est moi : l'assistant IA de La Citadelle.";

const EPISTEMIC_LONG =
  /n'ai pas assez d'éléments|piste.*destination|Je n'ai pas assez d'éléments fiables/i;
const PISTE = /piste|destination/i;

function liveTcOpts(query) {
  return {
    ...scOpts,
    turnComprehension: buildTurnComprehension(query, []),
    turnLoop: {},
  };
}

function openingHistory(subjectQuery) {
  const open = resolveExploratorySubjectAngleShortCircuit(subjectQuery);
  return [
    { role: "user", content: LIVE_SALUT },
    { role: "assistant", content: LIVE_SALUT_REPLY },
    { role: "user", content: subjectQuery },
    { role: "assistant", content: open.reply },
  ];
}

describe("Pack 1 — continuité après ouverture", () => {
  it("python + syntaxe → même sujet, web OK, pas piste", async () => {
    const open = resolveExploratorySubjectAngleShortCircuit(LIVE_PYTHON);
    assert.equal(open?.path, "subject_angle_explore");
    const history = [
      { role: "user", content: "salut salut" },
      { role: "assistant", content: "Salut !" },
      { role: "user", content: LIVE_PYTHON },
      { role: "assistant", content: open.reply },
    ];
    assert.equal(
      extractConversationState(history).turnPhase,
      CONTINUITY_TURN_PHASES.ANGLE_CHOICE_PENDING,
    );
    const hit = await runConversationShortCircuit(LIVE_PYTHON_T4, { history });
    assert.notEqual(hit?.path, "subject_angle_explore");
    assert.match(hit?.continuityEffectiveQuery || "", /syntaxe/i);
    assert.match(hit?.continuityEffectiveQuery || "", /python/i);
    assert.equal(hit?.preferWebResearch, true);
    assert.doesNotMatch(hit?.reply || "", /piste, mais pas encore la destination/i);
  });

  it("harness + architecture → même sujet, web OK, pas piste", async () => {
    const history = openingHistory(LIVE_HARNESS);
    const q = "oui plutôt l'architecture, tu peux te renseigner pour moi stp ??";
    const follow = resolveSubjectAngleFollowupShortCircuit(q, history);
    assert.ok(follow);
    assert.match(follow.effectiveQuery || "", /architecture/i);
    assert.match(follow.effectiveQuery || "", /deepseek harness/i);
    const hit = await runConversationShortCircuit(q, { history });
    assert.notEqual(hit?.path, "subject_angle_explore");
    assert.equal(hit?.preferWebResearch, true);
    assert.doesNotMatch(hit?.reply || "", PISTE);
  });

  it("après python, excel → nouveau cadre, pas avis-sur-python", async () => {
    const open = resolveExploratorySubjectAngleShortCircuit(LIVE_PYTHON);
    const history = [
      { role: "user", content: LIVE_PYTHON },
      { role: "assistant", content: open.reply },
    ];
    const q = "est ce que tu connais excel ??";
    assert.equal(resolveSubjectAngleFollowupShortCircuit(q, history), null);
    const hit = await runConversationShortCircuit(q, { history });
    assert.equal(hit?.path, "subject_angle_explore");
    assert.match(hit?.reply || "", /excel/i);
    assert.doesNotMatch(hit?.reply || "", /langage python/i);
  });

  it("hors sujet après ouverture → méta, pas 2e ouverture", async () => {
    const history = openingHistory(LIVE_HARNESS);
    const q = "ta réponse était hors sujet";
    assert.equal(resolveSubjectAngleFollowupShortCircuit(q, history), null);
    const hit = await runConversationShortCircuit(q, { history });
    assert.notEqual(hit?.path, "subject_angle_explore");
    assert.notEqual(hit?.path, "general_knowledge_continuity_carryover");
  });

  it("C'est quoi la Citadelle ? → pas avalé par la continuité d'angle", async () => {
    const history = openingHistory(LIVE_HARNESS);
    const q = "C'est quoi la Citadelle ?";
    assert.equal(resolveSubjectAngleFollowupShortCircuit(q, history), null);
    const hit = await runConversationShortCircuit(q, { history, ...scOpts });
    assert.notEqual(hit?.path, "subject_angle_explore");
    assert.equal(hit?.preferWebResearch, false);
    assert.match(hit?.reply || "", /plateforme/i);
  });
});

describe("Pack 2 — meta-feedback vs reprise", () => {
  it("d'accord → pas méta", async () => {
    assert.notEqual(classifyConversationTurn("d'accord").turnType, "meta_feedback");
    const hit = await runConversationShortCircuit("d'accord", scOpts);
    assert.notEqual(hit?.path, "meta_feedback_deterministic");
  });

  it("donc Nexxus c'est l'assistant → reprise, pas méta", async () => {
    const full =
      "donc nexxus c'est l'assistant et la citadelle c'est la plateforme";
    const short = "donc nexxus c'est l'assistant";
    for (const q of [full, short]) {
      assert.notEqual(classifyConversationTurn(q).turnType, "meta_feedback");
      assert.equal(resolveMetaFeedbackShortCircuit(q), null);
      assert.notEqual(lookupRoutingCase(q).winning_rule, "meta_feedback");
      const hit = await runConversationShortCircuit(q, scOpts);
      assert.notEqual(hit?.path, "meta_feedback_deterministic");
    }
  });

  it("ta réponse était hors sujet → méta inchangé", async () => {
    const q = "ta réponse était hors sujet";
    assert.equal(classifyConversationTurn(q).turnType, "meta_feedback");
    const hit = await runConversationShortCircuit(q, scOpts);
    assert.equal(hit?.path, "meta_feedback_deterministic");
  });

  it("C'est quoi la Citadelle ? → pas méta, pas web", async () => {
    const q = "C'est quoi la citadelle ??";
    const hit = await runConversationShortCircuit(q, scOpts);
    assert.notEqual(hit?.path, "meta_feedback_deterministic");
    assert.equal(hit?.preferWebResearch, false);
    assert.match(hit?.reply || "", /plateforme/i);
  });
});

describe("Pack 3 — sonde sociale vs refus épistémique", () => {
  it("deepseek harness, tu connais → honnête + option recherche", async () => {
    const q = "deepseek harness, tu connais";
    assert.equal(isMetaKnownPeerProductQuery(q), false);
    assert.equal(resolveExploratorySubjectAngleShortCircuit(q), null);
    const probe = resolveSocialFamiliarityProbeShortCircuit(q);
    assert.match(probe?.reply || "", /deepseek harness/i);
    assert.match(probe.reply, /renseigner/i);
    const hit = await runConversationShortCircuit(q, { history: [] });
    assert.notEqual(hit?.path, "meta_capabilities_peer_assistants_deterministic");
    assert.notEqual(hit?.path, "epistemic_honesty_deterministic");
    assert.notEqual(hit?.path, "subject_angle_explore");
    assert.equal(hit?.preferWebResearch, false);
    assert.doesNotMatch(hit?.reply || "", EPISTEMIC_LONG);
    assert.doesNotMatch(hit?.reply || "", /chat\.deepseek/i);
  });

  it("tu connais ? sans NP → clarification courte, pas refus long", async () => {
    const q = "tu connais ?";
    assert.equal(resolveExploratorySubjectAngleShortCircuit(q), null);
    const hit = await runConversationShortCircuit(q, { history: [], ...scOpts });
    assert.notEqual(hit?.path, "subject_angle_explore");
    assert.notEqual(hit?.path, "epistemic_honesty_deterministic");
    assert.doesNotMatch(hit?.reply || "", EPISTEMIC_LONG);
    assert.match(hit?.reply || "", /sujet/i);
  });

  it("explique le fonctionnement du harness → pas de sonde, pas de refus long", async () => {
    const q = "explique le fonctionnement du harness";
    assert.equal(resolveSocialFamiliarityProbeShortCircuit(q), null);
    assert.equal(resolveExploratorySubjectAngleShortCircuit(q), null);
    const hit = await runConversationShortCircuit(q, { history: [] });
    assert.notEqual(hit?.path, "epistemic_honesty_deterministic");
    assert.doesNotMatch(hit?.reply || "", EPISTEMIC_LONG);
  });

  it("ta réponse était hors sujet → méta inchangé", async () => {
    const hit = await runConversationShortCircuit("ta réponse était hors sujet", {
      history: [],
    });
    assert.equal(hit?.path, "meta_feedback_deterministic");
  });
});

describe("Identité interne — gate référents", () => {
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
      q: "la citadelle c'est quoi ?",
      referent: "La Citadelle",
      reply: CITADELLE_REPLY,
    },
    {
      q: "La Citadelle, c'est quoi ?",
      referent: "La Citadelle",
      reply: CITADELLE_REPLY,
    },
    {
      q: "la citadelle, mais c'est quoi ça ?",
      referent: "La Citadelle",
      reply: CITADELLE_REPLY,
    },
    {
      q: "À quoi sert La Citadelle ?",
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
  ];

  for (const { q, referent, reply } of battery) {
    it(`${q} → gate référents, pas factual générique`, async () => {
      const sc = await runConversationShortCircuit(q, liveTcOpts(q));
      assert.ok(sc?.reply);
      assert.equal(sc.internalReferent, referent);
      assert.equal(sc.internalReferentAuthority, true);
      assert.equal(sc.preferWebResearch, false);
      assert.notEqual(sc.path, "simple_factual_lookup");
      assert.notEqual(sc.path, "information_seeking_full_pipeline");
      assert.doesNotMatch(sc.reply, PISTE);
      assert.match(sc.reply, /NEXXUS/i);
      if (reply) assert.equal(sc.reply, reply);
      if (referent === "Nexxus Studio") assert.match(sc.reply, /studio/i);
    });
  }

  it("si j'ai bien compris + ne pas confondre nexxus / citadelle → validation", async () => {
    const q =
      "haaaa ok donc il ne faut pas confondre nexxus et la citadelle si j'ai bien compris?";
    const sc = await runConversationShortCircuit(q, liveTcOpts(q));
    assert.equal(sc?.path, "general_knowledge_deterministic");
    assert.equal(sc.preferWebResearch, false);
    assert.match(sc.reply, /^Oui\./);
    assert.match(sc.reply, /NEXXUS/i);
    assert.match(sc.reply, /Citadelle/i);
    assert.doesNotMatch(sc.reply, PISTE);
    assert.doesNotMatch(sc.reply, /papoter/i);
  });
});

const CONFIRM_REPLY =
  "Oui. NEXXUS, c'est l'assistant. La Citadelle, c'est la plateforme. Il ne faut pas les confondre.";
const REJECT_REPLY =
  "Non. NEXXUS, c'est l'assistant. La Citadelle, c'est la plateforme.";
const PYTHON_CONFIRM_REPLY =
  "Oui. Python est bien un langage de programmation.";

describe("Pack 5 — articulations FR de validation", () => {
  it("dictionnaire : marqueur en tête ou queue, virgule strippée", () => {
    assert.equal(
      isConfirmationCheckArticulation("Nexxus c'est l'assistant, si j'ai bien compris"),
      true,
    );
    assert.equal(
      extractConfirmationProposition(
        "Si j'ai bien compris, Nexxus c'est l'assistant",
      ),
      "nexxus c'est l'assistant",
    );
    assert.equal(
      extractConfirmationProposition(
        "Nexxus c'est l'assistant, si j'ai bien compris",
      ),
      "nexxus c'est l'assistant",
    );
  });

  it("Nexxus = assistant, tête et queue → Oui + distinguo", async () => {
    for (const q of [
      "Nexxus c'est l'assistant, si j'ai bien compris",
      "Si j'ai bien compris, Nexxus c'est l'assistant",
    ]) {
      assert.equal(resolveInternalReferentConfirmationCheck(q)?.reply, CONFIRM_REPLY);
      const sc = await runConversationShortCircuit(q, liveTcOpts(q));
      assert.equal(sc?.reply, CONFIRM_REPLY);
      assert.equal(sc?.path, "general_knowledge_deterministic");
      assert.equal(sc.preferWebResearch, false);
      assert.doesNotMatch(sc.reply, /Salut|papoter|piste|destination/i);
    }
  });

  it("Citadelle = plateforme, tête et queue → Oui + distinguo", async () => {
    for (const q of [
      "La Citadelle c'est la plateforme, si j'ai bien compris",
      "Si j'ai bien compris, La Citadelle c'est la plateforme",
    ]) {
      const sc = await runConversationShortCircuit(q, liveTcOpts(q));
      assert.equal(sc?.reply, CONFIRM_REPLY);
    }
  });

  it("Python = langage, tête et queue → Oui générique", async () => {
    for (const q of [
      "Python c'est un langage de programmation, si j'ai bien compris",
      "Si j'ai bien compris, Python c'est un langage de programmation",
    ]) {
      assert.equal(resolveGenericConfirmationCheck(q)?.reply, PYTHON_CONFIRM_REPLY);
      const sc = await runConversationShortCircuit(q, liveTcOpts(q));
      assert.equal(sc?.reply, PYTHON_CONFIRM_REPLY);
      assert.equal(sc?.confirmationCheck, true);
      assert.ok(!sc?.internalReferentAuthority);
      assert.doesNotMatch(sc.reply, /Salut|papoter|piste|destination/i);
    }
  });

  it("swap référents → Non + distinguo", async () => {
    const platform = "Nexxus c'est la plateforme, si j'ai bien compris";
    const assistant = "Si j'ai bien compris, La Citadelle c'est l'assistant";
    assert.equal(
      (await runConversationShortCircuit(platform, liveTcOpts(platform)))?.reply,
      REJECT_REPLY,
    );
    assert.equal(
      (await runConversationShortCircuit(assistant, liveTcOpts(assistant)))?.reply,
      REJECT_REPLY,
    );
  });
});

describe("Pack 6 — questions sociales / conversationnelles", () => {
  const PISTE_OR_WEB = /piste|destination/i;
  const phatic = [
    "qu'est ce tu racontes de beau?",
    "quoi de neuf ?",
    "qu'y a-t-il de nouveau ?",
    "tu racontes quoi ?",
    "il y a du nouveau ?",
  ];

  for (const q of phatic) {
    it(`${q} → rail social, pas factuel générique`, async () => {
      const sc = await runConversationShortCircuit(q, liveTcOpts(q));
      assert.ok(sc?.reply);
      assert.equal(sc.path, "social_deterministic");
      assert.equal(sc.socialPatternName, "social/phatic_checkin");
      assert.notEqual(sc.path, "simple_factual_lookup");
      assert.notEqual(sc.path, "epistemic_verify_external");
      assert.ok(!sc.preferWebResearch);
      assert.doesNotMatch(sc.reply, PISTE_OR_WEB);
    });
  }

  it("salut, comment ca va ? → check-in social", async () => {
    const q = "salut, comment ca va ?";
    const sc = await runConversationShortCircuit(q, liveTcOpts(q));
    assert.equal(sc?.path, "social_deterministic");
    assert.ok(!sc?.preferWebResearch);
    assert.match(sc.reply, /va bien|Tout va bien/i);
    assert.doesNotMatch(sc.reply, PISTE_OR_WEB);
  });
});

const IDENTITY_LEAK =
  /Pour répondre à|donnée factuelle directe|reformulation préalable|Nexxus Studio/i;
const IDENTITY_NAME_CANON = /NEXXUS/i;
const CITADELLE_ORG = /La Citadelle/i;

describe("Pack 7 — attributs identité assistant", () => {
  it("salut salut, comment t'appelles tu ??? → Citadelle, pas Studio", async () => {
    const q = "salut salut, comment t'appelles tu ???";
    const sc = await runConversationShortCircuit(q, liveTcOpts(q));
    assert.ok(sc?.reply);
    assert.equal(sc.path, "social_deterministic");
    assert.match(sc.reply, IDENTITY_NAME_CANON);
    assert.match(sc.reply, CITADELLE_ORG);
    assert.doesNotMatch(sc.reply, /Nexxus Studio/i);
    assert.doesNotMatch(sc.reply, IDENTITY_LEAK);
  });

  const birthQs = [
    "quelle est ta date de naissance ??",
    "quand es-tu né ?",
  ];
  for (const q of birthQs) {
    it(`${q} → identité, pas lookup`, async () => {
      const sc = await runConversationShortCircuit(q, liveTcOpts(q));
      assert.ok(sc?.reply);
      assert.notEqual(sc.path, "simple_factual_lookup");
      assert.ok(!sc.deferToLlm);
      assert.ok(!sc.preferWebResearch);
      assert.match(sc.reply, /pas de date de naissance/i);
      assert.doesNotMatch(sc.reply, IDENTITY_LEAK);
    });
  }

  it("quelle est ta date de naissance ?? — 2e fois, même rail", async () => {
    const q = "quelle est ta date de naissance ??";
    const a = await runConversationShortCircuit(q, liveTcOpts(q));
    const b = await runConversationShortCircuit(q, liveTcOpts(q));
    assert.equal(a?.path, b?.path);
    assert.equal(a?.reply, b?.reply);
    assert.doesNotMatch(b.reply, /Pour répondre à|donnée factuelle/i);
  });

  it("quel âge as-tu ? → pas d'âge biologique", async () => {
    const q = "quel âge as-tu ?";
    const sc = await runConversationShortCircuit(q, liveTcOpts(q));
    assert.notEqual(sc?.path, "simple_factual_lookup");
    assert.match(sc.reply, /âge biologique|age biologique/i);
    assert.doesNotMatch(sc.reply, IDENTITY_LEAK);
  });

  it("qui t'a créé ? → indisponibilité, pas d'invention", async () => {
    const q = "qui t'a créé ?";
    const sc = await runConversationShortCircuit(q, liveTcOpts(q));
    assert.ok(sc?.reply);
    assert.notEqual(sc.path, "simple_factual_lookup");
    assert.match(sc.reply, /Je ne dispose pas de cette information/i);
    assert.doesNotMatch(sc.reply, IDENTITY_LEAK);
  });

  it("pour quelle organisation travailles-tu ? → La Citadelle", async () => {
    const q = "pour quelle organisation travailles-tu ?";
    const sc = await runConversationShortCircuit(q, liveTcOpts(q));
    assert.notEqual(sc?.path, "simple_factual_lookup");
    assert.match(sc.reply, CITADELLE_ORG);
    assert.doesNotMatch(sc.reply, /Nexxus Studio/i);
  });

  it("date de naissance de Victor Hugo → pas le rail identité", async () => {
    const q = "quelle est la date de naissance de Victor Hugo ?";
    const sc = await runConversationShortCircuit(q, liveTcOpts(q));
    assert.doesNotMatch(sc?.reply || "", /pas de date de naissance réelle/i);
    assert.notEqual(sc?.path, "social_deterministic");
  });

  it("date de naissance de mon enfant → pas le rail identité", async () => {
    const q = "quelle est la date de naissance de mon enfant ?";
    const sc = await runConversationShortCircuit(q, liveTcOpts(q));
    assert.doesNotMatch(sc?.reply || "", /pas de date de naissance réelle/i);
    assert.notEqual(sc?.path, "social_deterministic");
  });
});

describe("Follow-up — qui est NEXXUS (référent nommé)", () => {
  const whoQs = [
    "qui est nexxus ??",
    "qui est NEXXUS ?",
    "c'est qui NEXXUS ?",
  ];
  for (const q of whoQs) {
    it(`${q} → référent Nexxus, pas lookup`, async () => {
      const sc = await runConversationShortCircuit(q, liveTcOpts(q));
      assert.equal(sc?.internalReferent, "Nexxus");
      assert.equal(sc.internalReferentAuthority, true);
      assert.equal(sc.reply, NEXXUS_REPLY);
      assert.notEqual(sc.path, "simple_factual_lookup");
      assert.ok(!sc.deferToLlm);
      assert.ok(!sc.preferWebResearch);
      assert.doesNotMatch(sc.reply, IDENTITY_LEAK);
    });
  }

  it("Pack 7 T4 naissance inchangé", async () => {
    const q = "quelle est ta date de naissance ?";
    const sc = await runConversationShortCircuit(q, liveTcOpts(q));
    assert.equal(sc?.path, "general_knowledge_deterministic");
    assert.match(sc.reply, /pas de date de naissance/i);
  });

  it("Pack 7 T5 nom inchangé", async () => {
    const q = "comment t'appelles-tu ?";
    const sc = await runConversationShortCircuit(q, liveTcOpts(q));
    assert.equal(sc?.path, "general_knowledge_deterministic");
    assert.match(sc.reply, /NEXXUS/i);
    assert.match(sc.reply, /La Citadelle/i);
    assert.doesNotMatch(sc.reply, /Nexxus Studio/i);
  });

  const thirdParty = [
    "qui est Victor Hugo ?",
    "qui est cette personne ?",
  ];
  for (const q of thirdParty) {
    it(`${q} → pas le référent NEXXUS`, async () => {
      const sc = await runConversationShortCircuit(q, liveTcOpts(q));
      assert.notEqual(sc?.internalReferent, "Nexxus");
      assert.notEqual(sc?.reply, NEXXUS_REPLY);
    });
  }
});
