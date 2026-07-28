import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isAssistantUtteranceClarifyRequest,
} from "../src/agent/policies/assistantUtteranceClarifyPolicy.js";
import { isMetaAssistantBehaviorRequest } from "../src/agent/utils/metaAssistantBehaviorGuards.js";
import { resolveMetaAssistantBehaviorShortCircuit } from "../src/agent/policies/metaAssistantBehaviorPolicy.js";
import { classifyConversationTurn } from "../src/agent/micro/classifiers/conversationTurnType.js";
import { resolveMetaFeedbackShortCircuit } from "../src/agent/micro/replies/metaFeedbackReplyBuilder.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { isPresentationOutlineRequest } from "../src/agent/utils/presentationOutlineIntentGuards.js";
import { resolveIntentContract } from "../src/agent/config/intentContractRegistry.js";
import { resolveComprehensionGroundingShortCircuit } from "../src/agent/policies/comprehensionGroundingPolicy.js";
import { isComprehensionDemonstrationRequest } from "../src/agent/utils/metaAssistantBehaviorGuards.js";

const SALUT_HISTORY = [
  { role: "user", content: "salut salut" },
  {
    role: "assistant",
    content:
      "Salut ! Je suis là — code, doc, archi ou simple papoter. Qu'est-ce qui t'intéresse ?",
  },
];

const TOUR4 =
  "on voit encore que tu ne veut pas réfléchir mais uniquement répondre et à ce moment là tu ne peux pas réfléchir pour répondre correctement";

describe("G44 — assistant utterance clarify", () => {
  it("G44-T01 détecte « de quel projet tu parles »", () => {
    assert.equal(
      isAssistantUtteranceClarifyRequest("de quel projet tu parles???", {
        history: SALUT_HISTORY,
      }),
      true,
    );
  });

  it("G44-T02 pas meta_feedback sur clarification référentielle", () => {
    const turn = classifyConversationTurn("de quel projet tu parles???", {
      history: SALUT_HISTORY,
    });
    assert.equal(turn.turnType, "task_request");
    assert.equal(turn.shortCircuit, false);
    assert.equal(
      resolveMetaFeedbackShortCircuit("de quel projet tu parles???", {
        history: SALUT_HISTORY,
      }),
      null,
    );
  });

  it("G44-T03 short-circuit utterance clarify avec explication projet générique", async () => {
    const hit = await runConversationShortCircuit("de quel projet tu parles???", {
      history: SALUT_HISTORY,
    });
    assert.equal(hit?.path, "assistant_utterance_clarify_deterministic");
    assert.match(hit?.reply || "", /formule d'accueil générique/i);
    assert.doesNotMatch(hit?.reply || "", /jeu|launcher|nfs/i);
  });
});

describe("G44 — meta assistant behavior (critique réflexion)", () => {
  it("G44-T04 détecte « tu ne veux pas réfléchir »", () => {
    assert.equal(isMetaAssistantBehaviorRequest(TOUR4), true);
  });

  it("G44-T05 short-circuit sans plan de présentation", async () => {
    const hit = await runConversationShortCircuit(TOUR4, {
      history: [
        ...SALUT_HISTORY,
        { role: "user", content: "de quel projet tu parles???" },
        {
          role: "assistant",
          content: "Formule générique — pas de projet actif.",
        },
        { role: "user", content: "je n'ai pas compris ce que tu as dit" },
        { role: "assistant", content: "J'ai mal interprété." },
      ],
    });
    assert.equal(hit?.path, "meta_assistant_behavior_deterministic");
    assert.match(hit?.reply || "", /façon de répondre|rails/i);
    assert.doesNotMatch(hit?.reply || "", /Laquelle t'intéresse/i);
    assert.doesNotMatch(hit?.reply || "", /auto-réflexion/i);
  });

  it("G44-T06 bloque PRESENTATION_OUTLINE et contrat orchestrateur", () => {
    assert.equal(isPresentationOutlineRequest(TOUR4), false);
    const { matchedBy } = resolveIntentContract(TOUR4, {});
    assert.equal(matchedBy, "g44_sil_meta_ideation_block");
  });

  it("G44-T07 réponse méta situationalisée", () => {
    const hit = resolveMetaAssistantBehaviorShortCircuit(TOUR4, {
      history: SALUT_HISTORY,
    });
    assert.match(hit?.reply || "", /projet en cours|formule générique/i);
    assert.match(hit?.reply || "", /sans plan de présentation/i);
  });

  it("G44-T08 idéation « mettre sur pied » sans orchestrateur", async () => {
    const q = "quel projet pourrions nous mettre sur pied ???";
    const hit = await runConversationShortCircuit(q, { history: SALUT_HISTORY });
    assert.equal(hit?.path, "ideation_deterministic");
    assert.equal(hit?.deferToLlm, undefined);
    assert.doesNotMatch(hit?.reply || "", /Bibliothèque Virtuelle/i);
  });

  it("G44-T09 compréhension « à quel moment » → grounding G45", async () => {
    const q =
      "d'accord je comprends mais à quel moment pourrais tu montrer que tu comprends ce que je dis ???";
    const fullHistory = [
      ...SALUT_HISTORY,
      { role: "user", content: "quel projet pourrions nous mettre sur pied ???" },
      {
        role: "assistant",
        content: "Voici 3 pistes concrètes : RAG local, automatisation, mini-app.",
      },
      { role: "user", content: "je n'ai pas compris ce que tu as dit" },
      { role: "assistant", content: "J'ai mal interprété ta demande précédente." },
      { role: "user", content: TOUR4 },
      { role: "assistant", content: "Tu as raison de pointer ça — ce tour porte sur ma façon de répondre." },
    ];
    assert.equal(isComprehensionDemonstrationRequest(q), true);
    const hit = await runConversationShortCircuit(q, { history: fullHistory });
    assert.equal(hit?.path, "comprehension_grounding_deterministic");
    assert.match(hit?.reply || "", /retiens de notre conversation|retiens/i);
    assert.match(hit?.reply || "", /mettre sur pied|La Citadelle/i);
    assert.match(hit?.reply || "", /reformuler|premiers pas/i);
    assert.doesNotMatch(hit?.reply || "", /nominaux/i);
  });

  it("G45-T01 repair idéation ancrée Citadelle", async () => {
    const hit = await runConversationShortCircuit("je n'ai pas compris ce que tu as dit", {
      history: [
        ...SALUT_HISTORY,
        { role: "user", content: "quel projet pourrions nous mettre sur pied ???" },
        { role: "assistant", content: "Voici 3 pistes concrètes." },
      ],
    });
    assert.equal(hit?.path, "assistant_repair_deterministic");
    assert.match(hit?.reply || "", /projet concret|La Citadelle/i);
    assert.match(hit?.reply || "", /trop génériques|trop lourd/i);
  });

  it("G45-T02 meta behavior exclut compréhension", () => {
    const q =
      "à quel moment pourrais tu montrer que tu comprends ce que je dis ???";
    assert.equal(resolveMetaAssistantBehaviorShortCircuit(q, { history: [] }), null);
    const grounding = resolveComprehensionGroundingShortCircuit(q, {
      history: SALUT_HISTORY,
    });
    assert.equal(grounding?.path, "comprehension_grounding_deterministic");
  });
});
