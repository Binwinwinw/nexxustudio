import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  SUBJECT_REFERENCE_CANONICAL_IMPLICIT_QUERY,
  SUBJECT_REFERENCE_CANONICAL_INFOS_POLITIQUE_QUERY,
  SUBJECT_REFERENCE_CANONICAL_PARLER_PHP_QUERY,
  SUBJECT_REFERENCE_CANONICAL_RESUME_DIOR_QUERY,
  SUBJECT_REFERENCE_CANONICAL_REVIENS_ITALIE_QUERY,
  resolveSubjectReferenceResumeShortCircuit,
} from "../src/agent/policies/familiarity/index.js";
import { isConversationMemoryRecallRequest } from "../src/agent/utils/conversation/conversationGuards.js";
import {
  CLARIFICATION_DECISIONS,
  evaluateClarificationDecision,
} from "../src/agent/policies/routing/clarificationDecisionPolicy.js";
import {
  evaluateJustIntent,
  isSimpleFactualQuestion,
} from "../src/agent/policies/intent/justIntentDetectionPolicy.js";
import {
  resolveConversationSubjectReference,
  SUBJECT_REFERENCE_RESOLUTION,
  subjectsMatch,
  applyVirginSessionResumeGuard,
} from "../src/agent/micro/continuity/sessionSubjectReferenceGuards.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { resolvePipelineFallback } from "../src/agent/utils/conversation/genericGreetingGuards.js";
import { FAMILIARITY_DOMAIN_CANONICAL_POLITIQUE_QUERY } from "../src/agent/policies/familiarity/index.js";

const DIOR_HISTORY = [
  {
    role: "user",
    content: "Tu t'y connais en Dior ?",
  },
  {
    role: "assistant",
    content:
      "Oui, je peux t'aider sur Dior : mode, histoire de la maison, parfums et produits, actualité. Tu veux un aperçu général ou une question précise ?",
  },
];

const ITALIE_HISTORY = [
  { role: "user", content: "Tu connais l'Italie ?" },
  {
    role: "assistant",
    content: "Oui, je connais l'Italie.\nTu veux que je t'en parle rapidement ?",
  },
];

describe("sessionSubjectReferenceGuards — résolution", () => {
  it("subjectsMatch — dior / Dior", () => {
    assert.equal(subjectsMatch("dior", "Dior"), true);
  });

  it("nouveau sujet explicite — pas de reprise session", () => {
    const resolution = resolveConversationSubjectReference(
      "politique française",
      [],
      SUBJECT_REFERENCE_CANONICAL_INFOS_POLITIQUE_QUERY,
    );
    assert.equal(
      resolution.resolution,
      SUBJECT_REFERENCE_RESOLUTION.CURRENT_TURN_SUBJECT,
    );
    assert.equal(resolution.contextual_resume, false);
  });

  it("reprise Dior — match session", () => {
    const resolution = resolveConversationSubjectReference(
      "Dior",
      DIOR_HISTORY,
      SUBJECT_REFERENCE_CANONICAL_RESUME_DIOR_QUERY,
    );
    assert.equal(
      resolution.resolution,
      SUBJECT_REFERENCE_RESOLUTION.PREVIOUS_SESSION_SUBJECT,
    );
    assert.equal(resolution.contextual_resume, true);
  });

  it("référence implicite sans historique — none", () => {
    const resolution = resolveConversationSubjectReference(
      "",
      [],
      SUBJECT_REFERENCE_CANONICAL_IMPLICIT_QUERY,
    );
    assert.equal(resolution.resolution, SUBJECT_REFERENCE_RESOLUTION.NONE);
  });

  it("session vierge — pas de contextual_resume forcé", () => {
    const resolution = applyVirginSessionResumeGuard(
      {
        resolution: SUBJECT_REFERENCE_RESOLUTION.PREVIOUS_SESSION_SUBJECT,
        contextual_resume: true,
        source: "session_subject_match",
        subject: "recette culinaires",
      },
      [],
    );
    assert.equal(
      resolution.resolution,
      SUBJECT_REFERENCE_RESOLUTION.CURRENT_TURN_SUBJECT,
    );
    assert.equal(resolution.contextual_resume, false);
    assert.match(resolution.source, /virgin_session_guard/);
  });
});

describe("subjectReferenceResumePolicy — batterie #34b", () => {
  it("cas 1 — tu as des infos sur politique française → nouveau sujet", async () => {
    assert.equal(
      isSimpleFactualQuestion(SUBJECT_REFERENCE_CANONICAL_INFOS_POLITIQUE_QUERY),
      false,
    );
    const hit = await runConversationShortCircuit(
      SUBJECT_REFERENCE_CANONICAL_INFOS_POLITIQUE_QUERY,
    );
    assert.equal(hit?.path, "familiarity_domain_overview_deterministic");
    assert.match(hit?.reply, /Oui, je peux t'aider/i);
    assert.match(hit?.reply, /politique/i);
    assert.match(hit?.reply, /institutions|partis/i);
    assert.doesNotMatch(hit?.reply, /On peut reprendre/i);
    assert.doesNotMatch(hit?.reply, /géographie|précise l'angle/i);
  });

  it("cas 2 — sinon s'agissant de Dior (session) → reprise", async () => {
    const hit = await runConversationShortCircuit(
      SUBJECT_REFERENCE_CANONICAL_RESUME_DIOR_QUERY,
      { history: DIOR_HISTORY },
    );
    assert.equal(hit?.path, "subject_reference_resume_deterministic");
    assert.match(hit?.reply, /On peut reprendre sur Dior/i);
    assert.match(hit?.reply, /mode|maison|parfums/i);
    assert.match(hit?.reply, /revenir sur quel angle/i);
  });

  it("cas 3 — Dior jamais vu → nouveau sujet sans faux souvenir", async () => {
    const hit = await runConversationShortCircuit(
      SUBJECT_REFERENCE_CANONICAL_RESUME_DIOR_QUERY,
    );
    assert.equal(hit?.path, "familiarity_domain_overview_deterministic");
    assert.match(hit?.reply, /Oui, je peux t'aider sur Dior/i);
    assert.doesNotMatch(hit?.reply, /On peut reprendre/i);
  });

  it("cas 4 — sinon à ce sujet sans antécédent → clarification", async () => {
    const hit = await runConversationShortCircuit(
      SUBJECT_REFERENCE_CANONICAL_IMPLICIT_QUERY,
    );
    assert.equal(hit?.path, "subject_reference_clarify");
    assert.match(hit?.reply, /pas sûr du sujet|Redonne-moi le nom du sujet/i);
    assert.doesNotMatch(hit?.reply, /géographie|précise l'angle/i);
  });

  it("on peut parler de PHP → disponibilité technique", async () => {
    const hit = await runConversationShortCircuit(
      SUBJECT_REFERENCE_CANONICAL_PARLER_PHP_QUERY,
    );
    assert.equal(hit?.path, "familiarity_domain_overview_deterministic");
    assert.match(hit?.reply, /PHP/i);
    assert.match(hit?.reply, /syntaxe|frameworks/i);
  });

  it("revenir à l'Italie (session) → reprise", async () => {
    const hit = await runConversationShortCircuit(
      SUBJECT_REFERENCE_CANONICAL_REVIENS_ITALIE_QUERY,
      { history: ITALIE_HISTORY },
    );
    assert.equal(hit?.path, "subject_reference_resume_deterministic");
    assert.match(hit?.reply, /repren(?:dre|ons) sur.*Italie/i);
  });

  it("clarification gate — can_answer_now pour sujet explicite", () => {
    const decision = evaluateClarificationDecision(
      SUBJECT_REFERENCE_CANONICAL_INFOS_POLITIQUE_QUERY,
      evaluateJustIntent(SUBJECT_REFERENCE_CANONICAL_INFOS_POLITIQUE_QUERY),
    );
    assert.equal(decision.decision, CLARIFICATION_DECISIONS.CAN_ANSWER_NOW);
    assert.ok(decision.signals.includes("subject_reference_resume"));
  });

  it("legacy #34 — t'y connais politique toujours routé", async () => {
    const hit = await runConversationShortCircuit(
      FAMILIARITY_DOMAIN_CANONICAL_POLITIQUE_QUERY,
    );
    assert.equal(hit?.path, "familiarity_domain_overview_deterministic");
    assert.match(hit?.reply, /politique/i);
  });

  it("fallback empty_short_circuit_llm — pas géographie", () => {
    const fallback = resolvePipelineFallback({
      query: SUBJECT_REFERENCE_CANONICAL_INFOS_POLITIQUE_QUERY,
      reason: "empty_short_circuit_llm",
    });
    assert.match(fallback, /politique/i);
    assert.doesNotMatch(fallback, /géographie|précise l'angle/i);
  });

  it("resolveSubjectReferenceResumeShortCircuit — structure reprise", () => {
    const hit = resolveSubjectReferenceResumeShortCircuit(
      SUBJECT_REFERENCE_CANONICAL_RESUME_DIOR_QUERY,
      { history: DIOR_HISTORY },
    );
    assert.equal(hit?.path, "subject_reference_resume_deterministic");
    assert.equal(hit?.contextual_resume, true);
  });

  it("premier tour session vierge — pas de « on peut reprendre »", async () => {
    const q = "Est-ce que tu t'y connais en recette culinaires ?";
    const hit = await runConversationShortCircuit(q, { history: [] });
    assert.equal(hit?.path, "familiarity_domain_overview_deterministic");
    assert.match(hit?.reply, /Oui, je peux t'aider/i);
    assert.doesNotMatch(hit?.reply, /On peut reprendre/i);
  });

  it("aide projet Excel / horloge — PAS familiarity_domain_overview", async () => {
    const excel =
      'aide moi à propos de ce projet : sur excel, je veux créer "un tableau de bord" qui va afficher des calendriers permettant : 1 - de noter des rendez-vous 2 - de noter des congés';
    const clock =
      "aide moi à propos de ce projet : sur une horloge qui fait calculatrice scientifique et analogique";

    for (const q of [excel, clock]) {
      assert.equal(
        resolveSubjectReferenceResumeShortCircuit(q),
        null,
        `subject_reference ne doit pas capturer: ${q.slice(0, 48)}…`,
      );
      const hit = await runConversationShortCircuit(q);
      assert.ok(
        !String(hit?.path || "").startsWith("familiarity_domain_overview"),
        `ne doit pas router familiarity overview: ${hit?.path}`,
      );
      assert.ok(
        !String(hit?.path || "").startsWith("lexicon_science_format_table"),
        `ne doit pas router lexicon sciences: ${hit?.path}`,
      );
      assert.doesNotMatch(
        String(hit?.reply || ""),
        /Dis-moi ce que tu veux creuser|Tu veux un aperçu général/i,
      );
    }

    // Non-régression : vrai shell « à propos de » domaine.
    const domaine = "sinon, à propos de PHP";
    const domaineHit = await runConversationShortCircuit(domaine);
    assert.equal(domaineHit?.path, "familiarity_domain_overview_deterministic");
    assert.match(domaineHit?.reply || "", /PHP/i);
  });

  it("ICHIGO — introduction entité, pas conversation_recall", async () => {
    const q =
      "si je te dis ICHIGO est ce que tu trouveras de quoi je veux parler ???";
    assert.equal(isConversationMemoryRecallRequest(q), false);
    const hit = resolveSubjectReferenceResumeShortCircuit(q, {
      history: [
        {
          role: "user",
          content:
            'j\'ai entendu parler d\'un dépôt github dont le nom est "caveman" vas te renseigner là dessus',
        },
        { role: "assistant", content: "Caveman est un plugin pour compresser les tokens..." },
      ],
    });
    assert.equal(hit?.path, "subject_reference_entity_clarify");
    assert.match(hit?.reply, /ichigo/i);
    assert.match(hit?.reply, /personnage|marque|projet/i);
    assert.doesNotMatch(hit?.reply, /Caveman|plugin/i);

    const shortHit = await runConversationShortCircuit(q, {
      history: [
        {
          role: "user",
          content:
            'j\'ai entendu parler d\'un dépôt github dont le nom est "caveman"',
        },
        { role: "assistant", content: "Caveman est un plugin..." },
      ],
    });
    assert.equal(shortHit?.path, "subject_reference_entity_clarify");
    assert.notEqual(shortHit?.path, "conversation_recall");
  });
});
