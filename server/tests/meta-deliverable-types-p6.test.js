import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  classifyMetaConversationIntent,
  isMetaDeliverableTypesIntent,
  threadHasReliableInvestorFactualContext,
} from "../src/agent/utils/metaConversationIntentGuards.js";
import {
  resolveMetaConversationRoute,
  DELIVERABLE_TYPES_CLARIFY_REPLY,
} from "../src/agent/micro/replies/metaConversationReplyBuilder.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import {
  evaluateJustIntent,
  resolveIntentDomain,
} from "../src/agent/policies/intent/justIntentDetectionPolicy.js";
import { INTENT_DOMAINS, INTENT_ACTIONS } from "../../shared/justIntentCatalog.js";

const SERIES_A_HISTORY = [
  {
    role: "user",
    content:
      "recherche web marché streaming films indépendants pour une levée de fonds de série A, rapport professionnel avec citations",
  },
  {
    role: "assistant",
    content:
      "## Résumé Exécutif\nLimites : aucune métrique chiffrée…\n\n## Analyse de Marché\n…\n\n## Sources\n[1] https://example.com",
  },
];

describe("P6 deliverable_types — patterns + contexte + JUST", () => {
  it("A : Quels formats peux-tu produire ? → meta/deliverable_types", () => {
    const q = "Quels formats peux-tu produire ?";
    assert.equal(isMetaDeliverableTypesIntent(q), true);
    assert.equal(classifyMetaConversationIntent(q)?.kind, "deliverable_types");
    assert.equal(resolveIntentDomain(q), INTENT_DOMAINS.META);
    const just = evaluateJustIntent(q);
    assert.equal(just.domain, INTENT_DOMAINS.META);
    assert.equal(just.action, INTENT_ACTIONS.DELIVERABLE_TYPES);
  });

  it("B : Tu peux livrer quoi pour mon projet ? → clarify sans contexte", async () => {
    const q = "Tu peux livrer quoi pour mon projet ?";
    assert.equal(isMetaDeliverableTypesIntent(q), true);
    const route = resolveMetaConversationRoute(q, { history: [] });
    assert.equal(route?.subKind, "deliverable_types");
    assert.equal(route?.reply, DELIVERABLE_TYPES_CLARIFY_REPLY);
    assert.doesNotMatch(route?.reply || "", /Série A|pitch deck|investisseur/i);

    const hit = await runConversationShortCircuit(q, { history: [] });
    assert.equal(hit?.path, "meta_conversation_deterministic");
    assert.equal(hit?.reply, DELIVERABLE_TYPES_CLARIFY_REPLY);
  });

  it("C : même phrase + fil FACTUAL Série A → catalogue contextualisé", async () => {
    const q = "quel type de livrable pourrais tu fournir";
    assert.equal(threadHasReliableInvestorFactualContext(SERIES_A_HISTORY), true);
    const route = resolveMetaConversationRoute(q, {
      history: SERIES_A_HISTORY,
    });
    assert.match(route?.reply || "", /pitch deck Série A/i);
    assert.match(route?.reply || "", /investisseur/i);

    const hit = await runConversationShortCircuit(q, {
      history: SERIES_A_HISTORY,
    });
    assert.equal(hit?.path, "meta_conversation_deterministic");
    assert.match(hit?.reply || "", /Série A/i);
  });

  it("D : même phrase sans contexte FACTUAL → pas de Série A", async () => {
    const q = "quel type de livrable pourrais tu fournir";
    assert.equal(threadHasReliableInvestorFactualContext([]), false);
    const route = resolveMetaConversationRoute(q, { history: [] });
    assert.equal(route?.reply, DELIVERABLE_TYPES_CLARIFY_REPLY);
    assert.doesNotMatch(route?.reply || "", /Série A|pitch deck|investisseur/i);

    const hit = await runConversationShortCircuit(q, { history: [] });
    assert.equal(hit?.reply, DELIVERABLE_TYPES_CLARIFY_REPLY);
  });

  it("E : bug / site / code / pitch mandat → pas deliverable_types", () => {
    const hard = [
      "corrige le bug dans le login",
      "fais un site web pour ma startup",
      "crée un pitch deck de 10 slides",
      "fournis un patch pour le bug crash",
    ];
    for (const q of hard) {
      assert.equal(
        isMetaDeliverableTypesIntent(q),
        false,
        `ne doit pas être meta: ${q}`,
      );
      assert.notEqual(resolveIntentDomain(q), INTENT_DOMAINS.META, q);
    }
  });

  it("F : JUST label meta/deliverable_types sans forcer clarify JUST", () => {
    const just = evaluateJustIntent("formats de sortie possibles");
    assert.equal(just.domain, "meta");
    assert.equal(just.action, "deliverable_types");
    assert.equal(just.strategy, "build_v1");
    assert.equal(just.canBuildDirectly, true);
  });

  it("patterns P6 élargis", () => {
    const qs = [
      "quels formats tu peux fournir",
      "que peux-tu générer",
      "quels rendus possibles",
      "quelles sorties tu peux produire",
      "sous quelles formes",
      "quels supports peux-tu livrer",
      "types de documents que tu sais faire",
    ];
    for (const q of qs) {
      assert.equal(isMetaDeliverableTypesIntent(q), true, q);
    }
  });

  it("contexte : streaming seul sans Série A → pas catalogue investisseur", () => {
    const history = [
      {
        role: "user",
        content: "parle-moi du streaming indépendant",
      },
      {
        role: "assistant",
        content: "Le streaming évolue vite.",
      },
    ];
    assert.equal(threadHasReliableInvestorFactualContext(history), false);
    const route = resolveMetaConversationRoute(
      "quel type de livrable pourrais tu fournir",
      { history },
    );
    assert.equal(route?.reply, DELIVERABLE_TYPES_CLARIFY_REPLY);
  });
});
