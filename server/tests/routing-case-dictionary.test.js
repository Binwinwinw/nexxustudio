import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  ROUTING_CASES,
  lookupRoutingCase,
  validateRoutingCaseDictionary,
} from "../src/agent/policies/routing/routingCaseDictionary.js";
import { inferActiveGoal } from "../src/agent/policies/conversation/activeGoalPolicy.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import {
  enforceModeContract,
  INSUFFICIENT_SIGNAL_REFUSAL,
  RESPONSE_MODES,
} from "../src/agent/config/modeResponseContracts.js";

const OPERATIONAL_INVITE = {
  role: "assistant",
  content:
    "Salut ! Si tu veux on peut papoter ou je t'aide à cadrer un projet, clarifier un besoin, structurer des livrables. Qu'est-ce que tu veux faire ?",
};

const CARTE_HISTORY = [
  { role: "user", content: "salut" },
  OPERATIONAL_INVITE,
  {
    role: "user",
    content:
      "je veux créer une carte de visite avec mes coordonnées et d'autres informations donc comment pourrais je présenter cette carte?",
  },
  {
    role: "assistant",
    content: "On part sur **carte de visite**. Recto, contact, support.",
  },
];

function assertNoPiste(text) {
  assert.doesNotMatch(String(text || ""), /Je vois la piste/i);
  assert.notEqual(text, INSUFFICIENT_SIGNAL_REFUSAL);
}

describe("routingCaseDictionary — fiches stables", () => {
  it("audit : ids uniques, plages, canonical + counter + reason", () => {
    const report = validateRoutingCaseDictionary();
    assert.deepEqual(report.errors, []);
    assert.equal(report.ok, true);
  });

  for (const fiche of ROUTING_CASES) {
    it(`${fiche.id} : canonicalQueries matchent, counterQueries non`, () => {
      for (const q of fiche.canonicalQueries) {
        const ctx =
          fiche.id === "active_goal_elliptic_followup"
            ? { history: CARTE_HISTORY, activeGoal: inferActiveGoal(CARTE_HISTORY) }
            : {};
        const lookup = lookupRoutingCase(q, ctx);
        assert.equal(lookup.winning_rule, fiche.id, q);
        assert.equal(lookup.final_path, fiche.path, q);
        assert.equal(lookup.forbidPiste, true, q);
        assert.ok(lookup.reason, q);
      }
      for (const q of fiche.counterQueries) {
        const lookup = lookupRoutingCase(q, {});
        assert.notEqual(lookup.winning_rule, fiche.id, q);
      }
    });
  }
});

describe("routingCaseDictionary — incidents + goulot", () => {
  it("check-in après invitation opérationnelle → social, pas piste", async () => {
    const history = [{ role: "user", content: "bonsoir" }, OPERATIONAL_INVITE];
    const q = "comment allez vous monsieur ou madame ??";
    const lookup = lookupRoutingCase(q, { history });
    assert.equal(lookup.winning_rule, "social_wellbeing_checkin");
    assert.equal(lookup.piste_blocked_by_dictionary, true);
    const hit = await runConversationShortCircuit(q, { history });
    assert.equal(hit?.path, "social_deterministic");
    assert.equal(hit?.winning_rule, "social_wellbeing_checkin");
    assertNoPiste(hit?.reply);
  });

  it("greeting pur → social, pas piste", async () => {
    const q = "bonsoir";
    assert.equal(lookupRoutingCase(q).winning_rule, "greeting_only");
    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "social_deterministic");
    assertNoPiste(hit?.reply);
  });

  it("gratitude → social, pas piste", async () => {
    const q = "merci";
    assert.equal(lookupRoutingCase(q).winning_rule, "gratitude_ack");
    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "social_deterministic");
    assertNoPiste(hit?.reply);
  });

  it("open_prompt → orientation, pas piste", async () => {
    const q = "qu'est-ce qu'on peut faire ?";
    assert.equal(lookupRoutingCase(q).winning_rule, "open_exploration_prompt");
    const hit = await runConversationShortCircuit(q);
    assert.ok(hit?.reply);
    assertNoPiste(hit?.reply);
  });

  it("meta feedback → meta_feedback, pas piste", async () => {
    const q = "ta réponse était hors sujet";
    assert.equal(lookupRoutingCase(q).winning_rule, "meta_feedback");
    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "meta_feedback_deterministic");
    assertNoPiste(hit?.reply);
  });

  it("create nommé → named_create_start", async () => {
    const q = "créer une carte de visite";
    assert.equal(lookupRoutingCase(q).winning_rule, "explicit_named_create");
    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "named_create_start");
    assertNoPiste(hit?.reply);
  });

  it("activeGoal + et en HTML ? → carryover", async () => {
    const q = "et en HTML ?";
    const lookup = lookupRoutingCase(q, { history: CARTE_HISTORY });
    assert.equal(lookup.winning_rule, "active_goal_elliptic_followup");
    const hit = await runConversationShortCircuit(q, { history: CARTE_HISTORY });
    assert.equal(hit?.path, "active_goal_continue");
    assert.match(hit?.reply || "", /HTML/i);
    assertNoPiste(hit?.reply);
  });

  it("COMPOSER texte vide sur check-in social → jamais INSUFFICIENT_SIGNAL_REFUSAL", () => {
    const out = enforceModeContract(RESPONSE_MODES.COMPOSER, "", {
      query: "comment allez-vous ?",
      allowRefusal: true,
    });
    assert.notEqual(out, INSUFFICIENT_SIGNAL_REFUSAL);
    assertNoPiste(out);
  });

  it("COMPOSER texte vide sur greeting → jamais piste", () => {
    const out = enforceModeContract(RESPONSE_MODES.COMPOSER, "", {
      query: "salut",
      allowRefusal: true,
    });
    assert.notEqual(out, INSUFFICIENT_SIGNAL_REFUSAL);
    assertNoPiste(out);
  });

  it("HTML joint + axes d'améliorations → pas de piste COMPOSER", () => {
    const q =
      "analyse le fichier joint pour proposer des axes d'améliorations de celui-ci";
    const lookup = lookupRoutingCase(q, {
      attachments: [
        { originalname: "Guide de remédiation 3ème _ Programmes 2025.html" },
      ],
    });
    assert.equal(lookup.winning_rule, "document_attached_guard");
    assert.equal(lookup.forbidPiste, true);
    const out = enforceModeContract(RESPONSE_MODES.COMPOSER, "", {
      query: q,
      allowRefusal: true,
      attachedDocument: true,
    });
    assert.notEqual(out, INSUFFICIENT_SIGNAL_REFUSAL);
    assertNoPiste(out);
  });

  it("demande opérationnelle floue peut encore émettre la piste", () => {
    const out = enforceModeContract(RESPONSE_MODES.SIMPLE_FAST, "", {
      query: "fais quelque chose",
      allowRefusal: true,
    });
    assert.equal(out, INSUFFICIENT_SIGNAL_REFUSAL);
  });
});
