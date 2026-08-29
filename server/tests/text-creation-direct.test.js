import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { analyzeConversationIntentFrame } from "../src/agent/policies/intent/conversationIntentFrame.js";
import { detectTaskKind } from "../src/agent/policies/intent/requestIntentFrame.js";
import {
  FORMAL_LETTER_CANONICAL_RESILIATION_CANAL_QUERY,
  isFormalLetterTemplateRequest,
} from "../src/agent/policies/delivery/formalLetterTemplatePolicy.js";
import { shouldAllowClarifyThenBuild } from "../src/agent/utils/context/deliverableMandateGuards.js";
import {
  buildTextCreationRenderFormatHint,
  extractTextCreationRenderFormat,
  isExplicitTextCreationRequest,
  isInformationSeekingWithTarget,
} from "../src/agent/utils/intent-guards/informationSeekingIntentGuards.js";
import {
  INSUFFICIENT_SIGNAL_REFUSAL,
  isInsufficientSignalRefusal,
} from "../src/agent/config/modeResponseContracts.js";
import {
  applySimpleFastDeliveryPipeline,
  resolveSimpleFastAllowRefusal,
} from "../src/agent/paths/simpleFastPath.js";

function assertTextCreationDirect(hit) {
  assert.equal(hit?.path, "text_creation_direct");
  assert.equal(hit?.preferWebResearch, false);
  assert.equal(hit?.deferToLlm, true);
  assert.equal(hit?.enforce?.allowRefusal, false);
  assert.notEqual(hit?.path, "social_deterministic");
  assert.notEqual(hit?.path, "information_seeking_full_pipeline");
  assert.doesNotMatch(String(hit?.reply || ""), /Je vois la piste/i);
  assert.notEqual(String(hit?.reply || ""), INSUFFICIENT_SIGNAL_REFUSAL);
}

describe("text_creation_direct — D0 création textuelle", () => {
  it("positif : poème + sujet → génération directe, pas social/explain/web/piste", async () => {
    const q = "Écris un poème sur la pollution informatique";
    assert.equal(isExplicitTextCreationRequest(q), true);
    assert.equal(isInformationSeekingWithTarget(q), false);
    assert.notEqual(detectTaskKind(q), "explain");
    const frame = analyzeConversationIntentFrame(q);
    assert.equal(frame.socialOnly, false);
    assert.equal(frame.task.present, true);

    const hit = await runConversationShortCircuit(q);
    assertTextCreationDirect(hit);
    assert.equal(hit?.outputFormat, null);
    assert.equal(hit?.reflectiveHint, null);
  });

  it("format : même demande + PDF → contrainte de rendu via reflectiveHint (pas export fichier)", async () => {
    const q = "Écris un poème sur la pollution informatique en PDF";
    assert.equal(isExplicitTextCreationRequest(q), true);
    assert.equal(isInformationSeekingWithTarget(q), false);
    assert.equal(extractTextCreationRenderFormat(q), "pdf");
    assert.equal(shouldAllowClarifyThenBuild(q), false);
    assert.notEqual(detectTaskKind(q), "explain");

    const hit = await runConversationShortCircuit(q);
    assertTextCreationDirect(hit);
    assert.equal(hit?.outputFormat, "pdf");
    const hint = String(hit?.reflectiveHint || "");
    assert.match(hint, /contrainte de rendu/i);
    assert.match(hint, /PDF/i);
    assert.match(hint, /N'affirme pas qu'un fichier PDF/i);
    assert.equal(hint, buildTextCreationRenderFormatHint("pdf"));
  });

  it("format markdown → hint Markdown, pas PDF", async () => {
    const q = "Écris un poème sur la pollution informatique en markdown";
    const hit = await runConversationShortCircuit(q);
    assertTextCreationDirect(hit);
    assert.equal(hit?.outputFormat, "markdown");
    assert.match(String(hit?.reflectiveHint || ""), /Markdown/i);
    assert.doesNotMatch(String(hit?.reflectiveHint || ""), /\bPDF\b/);
  });

  it("négatif info : Teams 365 inchangé", async () => {
    const q = "je cherche des infos sur Teams 365";
    assert.equal(isExplicitTextCreationRequest(q), false);
    assert.equal(isInformationSeekingWithTarget(q), true);
    assert.equal(detectTaskKind(q), "explain");
    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "information_seeking_full_pipeline");
  });

  it("négatif social : comment ça va inchangé", async () => {
    const q = "comment ça va";
    assert.equal(isExplicitTextCreationRequest(q), false);
    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "social_deterministic");
    assert.notEqual(hit?.path, "text_creation_direct");
  });

  it("négatif lettre : isFormalLetterTemplateRequest inchangé", async () => {
    const q = FORMAL_LETTER_CANONICAL_RESILIATION_CANAL_QUERY;
    assert.equal(isFormalLetterTemplateRequest(q), true);
    assert.equal(isExplicitTextCreationRequest(q), false);
    const hit = await runConversationShortCircuit(q);
    assert.notEqual(hit?.path, "text_creation_direct");
    assert.equal(hit?.path, "formal_letter_template_deterministic");
  });
});

describe("text_creation_direct — D1 no clarify / allowRefusal SIMPLE_FAST", () => {
  const POEM_Q = "Écris un poème sur la pollution informatique";

  it("SC pose allowRefusal false ; SIMPLE_FAST honore le flag SC", async () => {
    const hit = await runConversationShortCircuit(POEM_Q);
    assertTextCreationDirect(hit);
    assert.equal(hit?.enforce?.allowRefusal, false);
    assert.equal(
      resolveSimpleFastAllowRefusal({
        query: POEM_Q,
        scAllowRefusal: hit.enforce.allowRefusal,
      }),
      false,
    );
    // Sans flag SC : la query seule ne bloque pas encore — le flag est requis.
    assert.equal(resolveSimpleFastAllowRefusal({ query: POEM_Q }), true);
  });

  it("refus « piste » LLM → strip sous SC allowRefusal false (pas livré)", async () => {
    const hit = await runConversationShortCircuit(POEM_Q);
    const delivery = await applySimpleFastDeliveryPipeline({
      query: POEM_Q,
      rawResult: INSUFFICIENT_SIGNAL_REFUSAL,
      scAllowRefusal: hit?.enforce?.allowRefusal,
    });
    assert.equal(isInsufficientSignalRefusal(delivery.text), false);
    assert.doesNotMatch(String(delivery.text || ""), /Je vois la piste/i);
    assert.doesNotMatch(String(delivery.text || ""), /objectif en une phrase/i);
  });

  it("refus légitime préservé hors création textuelle (pas de scAllowRefusal)", async () => {
    const q = "salut";
    const delivery = await applySimpleFastDeliveryPipeline({
      query: q,
      rawResult: INSUFFICIENT_SIGNAL_REFUSAL,
    });
    assert.equal(isInsufficientSignalRefusal(delivery.text), true);
  });

  it("demande ambiguë hors rail text_creation — pas de SC enforce", async () => {
    const q = "écris quelque chose de beau";
    assert.equal(isExplicitTextCreationRequest(q), false);
    const hit = await runConversationShortCircuit(q);
    assert.notEqual(hit?.path, "text_creation_direct");
  });
});

const CHAT_INVITE_HISTORY = [
  { role: "user", content: "salut" },
  {
    role: "assistant",
    content:
      "Salut ! Si tu veux on peut papoter ou je t'aide à cadrer un projet. Qu'est-ce que tu veux faire ?",
  },
];

describe("text_creation_direct — D2 continuité sujet après invitation", () => {
  it("positif : sujet nommé puis écris un poème → text_creation_direct", async () => {
    const history = [
      ...CHAT_INVITE_HISTORY,
      { role: "user", content: "la pollution informatique" },
      {
        role: "assistant",
        content: "Ah la pollution informatique — tu veux en discuter ?",
      },
    ];
    const q = "écris un poème";
    assert.equal(isExplicitTextCreationRequest(q), false);
    assert.equal(isExplicitTextCreationRequest(q, { history }), true);

    const hit = await runConversationShortCircuit(q, { history });
    assertTextCreationDirect(hit);
    assert.match(String(hit?.continuityEffectiveQuery || ""), /pollution informatique/i);
    assert.match(String(hit?.reflectiveHint || ""), /sujet du fil/i);
    assert.notEqual(hit?.path, "exploratory_conversation_light");
  });

  it("négatif : sujet court seul après invitation → exploratory (pas création)", async () => {
    const q = "musique";
    assert.equal(isExplicitTextCreationRequest(q, { history: CHAT_INVITE_HISTORY }), false);
    const hit = await runConversationShortCircuit(q, {
      history: CHAT_INVITE_HISTORY,
    });
    assert.equal(hit?.path, "exploratory_conversation_light");
    assert.equal(hit?.socialChatContinuity, true);
    assert.notEqual(hit?.path, "text_creation_direct");
  });

  it("négatif : écris un poème sans sujet ni fil → pas text_creation_direct", async () => {
    const q = "écris un poème";
    assert.equal(isExplicitTextCreationRequest(q), false);
    const hit = await runConversationShortCircuit(q, {
      history: CHAT_INVITE_HISTORY,
    });
    assert.notEqual(hit?.path, "text_creation_direct");
  });

  it("négatif FP : opinion 1re personne puis poème → pas coller le small-talk comme sujet", async () => {
    const history = [
      ...CHAT_INVITE_HISTORY,
      { role: "user", content: "j'adore les chats" },
      { role: "assistant", content: "Les chats, top sujet." },
    ];
    const q = "écris un poème";
    assert.equal(isExplicitTextCreationRequest(q, { history }), false);
    const hit = await runConversationShortCircuit(q, { history });
    assert.notEqual(hit?.path, "text_creation_direct");
    assert.doesNotMatch(String(hit?.continuityEffectiveQuery || ""), /adore les chats/i);
  });

  it("positif : sujet topical court (musique) puis poème → text_creation", async () => {
    const history = [
      ...CHAT_INVITE_HISTORY,
      { role: "user", content: "musique" },
      { role: "assistant", content: "La musique, ça ouvre des portes." },
    ];
    const q = "écris un poème";
    const hit = await runConversationShortCircuit(q, { history });
    assertTextCreationDirect(hit);
    assert.match(String(hit?.continuityEffectiveQuery || ""), /musique/i);
  });
});

describe("text_creation_direct — D5 preuves contrat / transitions", () => {
  it("shell désir : je voudrais un poème + sujet → text_creation, pas web", async () => {
    const q = "je voudrais un poème sur la pollution informatique";
    const hit = await runConversationShortCircuit(q);
    assertTextCreationDirect(hit);
    assert.equal(hit?.preferWebResearch, false);
    assert.equal(hit?.textCreation, true);
    assert.equal(shouldAllowClarifyThenBuild(q), false);
  });

  it("shell fais-moi : poème + sujet → text_creation", async () => {
    const q = "fais-moi un poème sur les robots";
    const hit = await runConversationShortCircuit(q);
    assertTextCreationDirect(hit);
    assert.equal(isInformationSeekingWithTarget(q), false);
  });

  it("cas 3 renforcé : Teams 365 = info-seeking, pas création ni social seul", async () => {
    const q = "je cherche des infos sur Teams 365";
    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "information_seeking_full_pipeline");
    assert.notEqual(hit?.path, "text_creation_direct");
    assert.notEqual(hit?.path, "social_deterministic");
    assert.equal(hit?.textCreation, undefined);
    assert.equal(isExplicitTextCreationRequest(q), false);
  });

  it("cas 4 renforcé : comment ça va = social, pas création / pas info-seeking pipeline", async () => {
    const q = "comment ça va";
    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "social_deterministic");
    assert.notEqual(hit?.path, "text_creation_direct");
    assert.notEqual(hit?.path, "information_seeking_full_pipeline");
    assert.equal(isExplicitTextCreationRequest(q), false);
  });

  it("cas 5 renforcé : lettre Canal+ = template lettre, pas text_creation_direct", async () => {
    const q = FORMAL_LETTER_CANONICAL_RESILIATION_CANAL_QUERY;
    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "formal_letter_template_deterministic");
    assert.notEqual(hit?.path, "text_creation_direct");
    assert.equal(isFormalLetterTemplateRequest(q), true);
    assert.equal(isExplicitTextCreationRequest(q), false);
  });

  it("transition : poème complet après invite → text_creation (pas exploratory)", async () => {
    const q = "Écris un poème sur la pollution informatique";
    const hit = await runConversationShortCircuit(q, {
      history: CHAT_INVITE_HISTORY,
    });
    assertTextCreationDirect(hit);
    assert.notEqual(hit?.path, "exploratory_conversation_light");
    assert.notEqual(hit?.socialChatContinuity, true);
  });

  it("transition D2+D3 : sujet du fil + écris un poème en PDF → rendu PDF, pas export", async () => {
    const history = [
      ...CHAT_INVITE_HISTORY,
      { role: "user", content: "la pollution informatique" },
      {
        role: "assistant",
        content: "Ah la pollution informatique — tu veux en discuter ?",
      },
    ];
    const q = "écris un poème en PDF";
    const hit = await runConversationShortCircuit(q, { history });
    assertTextCreationDirect(hit);
    assert.equal(hit?.outputFormat, "pdf");
    assert.match(String(hit?.continuityEffectiveQuery || ""), /pollution informatique/i);
    assert.match(String(hit?.reflectiveHint || ""), /PDF/i);
    assert.match(String(hit?.reflectiveHint || ""), /sujet du fil|Mandat complet/i);
    assert.match(String(hit?.reflectiveHint || ""), /N'affirme pas qu'un fichier PDF/i);
  });

  it("transition D1 : livraison SIMPLE_FAST refuse la piste sur création", async () => {
    const q = "Écris un conte sur la forêt";
    const hit = await runConversationShortCircuit(q);
    assertTextCreationDirect(hit);
    const delivery = await applySimpleFastDeliveryPipeline({
      query: q,
      rawResult: INSUFFICIENT_SIGNAL_REFUSAL,
      scAllowRefusal: hit.enforce.allowRefusal,
    });
    assert.doesNotMatch(String(delivery.text || ""), /Je vois la piste/i);
    assert.equal(isInsufficientSignalRefusal(delivery.text), false);
  });
});
