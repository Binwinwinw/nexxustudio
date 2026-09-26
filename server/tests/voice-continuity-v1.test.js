import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  VOICE_CONTINUITY_CONTRACT,
  resolveVoiceContinuityContext,
  buildVoiceContinuityPromptAddon,
  hasGrandiloquentVoiceMarkers,
  shouldBlockGenericInsufficientRefusal,
  isCausalWhyExplainRequest,
  shouldSuppressPrematureClarify,
  shouldDeferSocialRouting,
  applyVoiceContinuityVisibleText,
} from "../src/agent/policies/posture/index.js";
import {
  evaluateClarificationDecision,
  CLARIFICATION_DECISIONS,
} from "../src/agent/policies/routing/clarificationDecisionPolicy.js";
import { resolveIntentComposition } from "../src/agent/policies/intent/intentCompositionPolicy.js";
import {
  getModeSystemPrompt,
  getComposerSystemPrompt,
  MODE_SYSTEM_PROMPTS,
  RESPONSE_MODES,
  enforceModeContract,
  INSUFFICIENT_SIGNAL_REFUSAL,
} from "../src/agent/config/modeResponseContracts.js";
import { POSTURES } from "../src/agent/policies/posture/index.js";
import { buildPostureDeliveryAddon } from "../src/agent/policies/posture/index.js";
import {
  resolveSimpleFastAllowRefusal,
  applySimpleFastDeliveryPipeline,
  shouldRunWordGuardSimpleFast,
} from "../src/agent/paths/simpleFastPath.js";
import { enforceSimpleFactualDirectness } from "../src/agent/micro/replies/simpleFactualComposer.js";
import { buildSubstantiveRecoveryMessage } from "../src/agent/utils/conversation/genericGreetingGuards.js";
import { hasExplicitDeliverableAndSubject } from "../src/agent/utils/context/deliverableMandateGuards.js";

describe("VOICE_CONTINUITY_V1", () => {
  it("sujet/format ancré → bloque refus générique + addon l’interdit", () => {
    const ctx = resolveVoiceContinuityContext({
      pedagogicalStructured: true,
      formatAnchored: true,
      subjectAnchored: true,
      postureDecision: { posture: POSTURES.CONVERSATIONAL, source: "default" },
    });
    assert.equal(ctx.contract, VOICE_CONTINUITY_CONTRACT);
    assert.equal(ctx.block_generic_insufficient_refusal, true);
    const addon = buildVoiceContinuityPromptAddon(ctx);
    assert.match(addon, /VOICE_CONTINUITY_V1/);
    assert.match(addon, /INTERDIT : refus/i);
    assert.match(addon, /tutoi/i);
  });

  it("demande floue → refus générique encore possible", () => {
    const ctx = resolveVoiceContinuityContext({
      postureDecision: { posture: POSTURES.MENTOR, source: "inferred" },
    });
    assert.equal(ctx.block_generic_insufficient_refusal, false);
    const addon = buildVoiceContinuityPromptAddon(ctx);
    assert.match(addon, /sous-spécifiée/i);
    assert.match(addon, /mentor/i);
  });

  it("getModeSystemPrompt injecte la ligne continuité", () => {
    const prompt = getModeSystemPrompt(RESPONSE_MODES.COMPOSER);
    assert.match(prompt, /VOIX NEXXUS \(continuité\)/);
    assert.match(prompt, /TUTOIEMENT OBLIGATOIRE/);
  });

  it("OPEN_PROPOSITION n’est plus théâtral (gardien souverain)", () => {
    const raw = MODE_SYSTEM_PROMPTS.OPEN_PROPOSITION;
    assert.equal(hasGrandiloquentVoiceMarkers(raw), false);
    assert.doesNotMatch(raw, /gardien souverain/i);
    assert.match(raw, /sobre/i);
    const viaGetter = getModeSystemPrompt(RESPONSE_MODES.OPEN_PROPOSITION);
    assert.equal(hasGrandiloquentVoiceMarkers(viaGetter), false);
  });

  it("R1 — requête ancrée bloque refus piste (enforce + simpleFast)", () => {
    const q =
      "explique le cycle de la lune sous forme de tableau avec des détails";
    assert.equal(shouldBlockGenericInsufficientRefusal(q), true);
    assert.equal(resolveSimpleFastAllowRefusal({ query: q }), false);
    const stripped = enforceModeContract(
      RESPONSE_MODES.SIMPLE_FAST,
      INSUFFICIENT_SIGNAL_REFUSAL,
      { query: q, allowRefusal: true },
    );
    assert.equal(stripped, "");
  });

  it("R1 — pour quelle raison + sujet nommé bloque refus piste (COMPOSER)", () => {
    const q = "pour quelle raison la lune est aussi loin de la terre ??";
    assert.equal(shouldBlockGenericInsufficientRefusal(q), true);
    assert.equal(resolveSimpleFastAllowRefusal({ query: q }), false);
    const stripped = enforceModeContract(
      RESPONSE_MODES.COMPOSER,
      INSUFFICIENT_SIGNAL_REFUSAL,
      { query: q, allowRefusal: true },
    );
    assert.equal(stripped, "");
    const fallback = enforceSimpleFactualDirectness(INSUFFICIENT_SIGNAL_REFUSAL, q);
    assert.match(fallback, /Lune|marées|3,8/i);
    assert.doesNotMatch(fallback, /piste|destination/i);
    assert.equal(
      isCausalWhyExplainRequest(
        "j'aimerais savoir pour quelle raison la lune est aussi loin de la terre ??",
      ),
      true,
    );
  });

  it("R1 — flou non ancré peut encore émettre le refus", () => {
    const q = "fais quelque chose";
    assert.equal(shouldBlockGenericInsufficientRefusal(q), false);
    const out = enforceModeContract(RESPONSE_MODES.SIMPLE_FAST, "", {
      query: q,
      allowRefusal: true,
    });
    assert.equal(out, INSUFFICIENT_SIGNAL_REFUSAL);
  });

  it("R6 — styleHints mentor arrivent au composer", () => {
    const delivery = buildPostureDeliveryAddon({
      posture: POSTURES.MENTOR,
      intensity: "normal",
      styleHints: ["socratic", "low_dump"],
    });
    assert.match(delivery, /POSTURE_DELIVERY_V1/);
    assert.match(delivery, /DELIVERY MENTOR/);

    const prompt = getComposerSystemPrompt(
      {
        user_query: "guide-moi",
        meta: {
          postureDecision: {
            posture: POSTURES.MENTOR,
            intensity: "normal",
            styleHints: ["socratic", "low_dump"],
          },
        },
      },
      {},
    );
    assert.match(prompt, /POSTURE_DELIVERY_V1/);
    assert.match(prompt, /styleHints: socratic/);
  });

  it("R2/R7 — cleanVisible retire la grandiloquence", () => {
    const out = enforceModeContract(
      RESPONSE_MODES.COMPOSER,
      "Je suis le gardien souverain de La Citadelle et je t'aide.",
      { allowRefusal: false, query: "salut" },
    );
    assert.doesNotMatch(out, /gardien souverain/i);
    assert.match(out, /assistant de La Citadelle/i);
    assert.equal(
      applyVoiceContinuityVisibleText("entité souveraine"),
      "assistant",
    );
  });

  it("R4 — table ancrée → can_answer_now (pas clarify prématuré)", () => {
    const q =
      "explique le cycle de la lune sous forme de tableau avec des détails";
    assert.equal(shouldSuppressPrematureClarify(q), true);
    const d = evaluateClarificationDecision(q, {}, null, [], []);
    assert.equal(d.decision, CLARIFICATION_DECISIONS.CAN_ANSWER_NOW);
    assert.equal(d.reason, "voice_anchor_no_premature_clarify");
  });

  it("R5 — greeting + mandat → social deferred ; bonjour seul reste social", () => {
    const work =
      "Bonjour, explique le cycle de la lune sous forme de tableau détaillé";
    assert.equal(shouldDeferSocialRouting(work), true);
    const c = resolveIntentComposition(work);
    assert.equal(c.social_weight, "deferred_to_response");
    assert.equal(shouldDeferSocialRouting("bonjour"), false);
  });

  const INCIDENT_FICHES =
    "je veux faire des fiches à propos de l'utilisation du logiciel Hermes Agent";

  it("A — fiches + Hermes Agent : bloque piste, texte final non vide", async () => {
    assert.equal(hasExplicitDeliverableAndSubject(INCIDENT_FICHES), true);
    assert.equal(shouldBlockGenericInsufficientRefusal(INCIDENT_FICHES), true);
    assert.equal(resolveSimpleFastAllowRefusal({ query: INCIDENT_FICHES }), false);
    const stripped = enforceModeContract(
      RESPONSE_MODES.SIMPLE_FAST,
      INSUFFICIENT_SIGNAL_REFUSAL,
      { query: INCIDENT_FICHES, allowRefusal: true },
    );
    assert.equal(stripped, "");
    const delivery = await applySimpleFastDeliveryPipeline({
      query: INCIDENT_FICHES,
      rawResult: INSUFFICIENT_SIGNAL_REFUSAL,
    });
    assert.ok(String(delivery.text || "").trim().length > 0);
    assert.doesNotMatch(delivery.text, /Je vois la piste|pas encore la destination/i);
  });

  it("B — documentation sur X : piste absente, texte non vide", async () => {
    const q = "je veux créer une documentation sur React";
    assert.equal(hasExplicitDeliverableAndSubject(q), true);
    assert.equal(shouldBlockGenericInsufficientRefusal(q), true);
    assert.equal(resolveSimpleFastAllowRefusal({ query: q }), false);
    const delivery = await applySimpleFastDeliveryPipeline({
      query: q,
      rawResult: INSUFFICIENT_SIGNAL_REFUSAL,
    });
    assert.ok(String(delivery.text || "").trim().length > 0);
    assert.doesNotMatch(delivery.text, /Je vois la piste/i);
  });

  it("C — aide-moi : refus piste encore possible", () => {
    const q = "aide-moi";
    assert.equal(hasExplicitDeliverableAndSubject(q), false);
    assert.equal(shouldBlockGenericInsufficientRefusal(q), false);
    const out = enforceModeContract(RESPONSE_MODES.SIMPLE_FAST, "", {
      query: q,
      allowRefusal: true,
    });
    assert.equal(out, INSUFFICIENT_SIGNAL_REFUSAL);
  });

  it("D — fiches sans sujet : ancrage combo inactif", () => {
    const q = "je veux faire des fiches";
    assert.equal(hasExplicitDeliverableAndSubject(q), false);
    assert.equal(shouldBlockGenericInsufficientRefusal(q), false);
  });

  it("E — sujet seul : ancrage combo inactif", () => {
    const q = "Hermes Agent";
    assert.equal(hasExplicitDeliverableAndSubject(q), false);
    assert.equal(shouldBlockGenericInsufficientRefusal(q), false);
  });

  it("F — ambigu court sans livrable ni sujet : piste conservée", () => {
    const q = "fais un truc";
    assert.equal(hasExplicitDeliverableAndSubject(q), false);
    assert.equal(shouldBlockGenericInsufficientRefusal(q), false);
    const out = enforceModeContract(RESPONSE_MODES.SIMPLE_FAST, "", {
      query: q,
      allowRefusal: true,
    });
    assert.equal(out, INSUFFICIENT_SIGNAL_REFUSAL);
  });

  it("G — recovery vide après blocage : fallback existant, pas le piste", async () => {
    const recovery = buildSubstantiveRecoveryMessage(
      INCIDENT_FICHES,
      "empty_simple_fast",
    );
    assert.ok(recovery.trim().length > 0);
    assert.doesNotMatch(recovery, /Je vois la piste|pas encore la destination/i);
    const delivery = await applySimpleFastDeliveryPipeline({
      query: INCIDENT_FICHES,
      rawResult: "",
    });
    assert.ok(String(delivery.text || "").trim().length > 0);
    assert.doesNotMatch(delivery.text, /Je vois la piste|pas encore la destination/i);
    assert.equal(delivery.usedRecoveryFallback, true);
  });

  it("H — word_guard inchangé ; ancrage voix existant intact", () => {
    assert.equal(
      shouldRunWordGuardSimpleFast({ wordsCount: 13, query: INCIDENT_FICHES }),
      true,
    );
    assert.equal(shouldRunWordGuardSimpleFast({ wordsCount: 15 }), false);
    const anchored =
      "explique le cycle de la lune sous forme de tableau avec des détails";
    assert.equal(shouldBlockGenericInsufficientRefusal(anchored), true);
    assert.equal(shouldBlockGenericInsufficientRefusal("documentation"), false);
    assert.equal(shouldBlockGenericInsufficientRefusal("je veux une fiche"), false);
  });

  it("A′ — jumeau sans accents : fiches a propos de X", () => {
    const q =
      "je veux faire des fiches a propos de l utilisation du logiciel Hermes Agent";
    assert.equal(hasExplicitDeliverableAndSubject(q), true);
    assert.equal(shouldBlockGenericInsufficientRefusal(q), true);
    assert.equal(resolveSimpleFastAllowRefusal({ query: q }), false);
  });

  it("A″ — pédagogiques / pedagogiques hors combo, ancrage inchangé", () => {
    const withAccent =
      "je veux faire des fiches pédagogiques à propos de l'utilisation du logiciel Hermes Agent";
    const withoutAccent =
      "je veux faire des fiches pedagogiques a propos de l utilisation du logiciel Hermes Agent";
    assert.equal(hasExplicitDeliverableAndSubject(withAccent), true);
    assert.equal(hasExplicitDeliverableAndSubject(withoutAccent), true);
    assert.equal(shouldBlockGenericInsufficientRefusal(withAccent), true);
    assert.equal(shouldBlockGenericInsufficientRefusal(withoutAccent), true);
  });
});
