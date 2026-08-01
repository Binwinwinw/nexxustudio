import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  VOICE_CONTINUITY_CONTRACT,
  resolveVoiceContinuityContext,
  buildVoiceContinuityPromptAddon,
  hasGrandiloquentVoiceMarkers,
  shouldBlockGenericInsufficientRefusal,
  shouldSuppressPrematureClarify,
  shouldDeferSocialRouting,
  applyVoiceContinuityVisibleText,
} from "../src/agent/policies/posture/index.js";
import {
  evaluateClarificationDecision,
  CLARIFICATION_DECISIONS,
} from "../src/agent/policies/clarificationDecisionPolicy.js";
import { resolveIntentComposition } from "../src/agent/policies/intentCompositionPolicy.js";
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
import { resolveSimpleFastAllowRefusal } from "../src/agent/paths/simpleFastPath.js";

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
});
