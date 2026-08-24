import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  resolveGeneralKnowledgeVolumeTier,
  resolveGeneralKnowledgeNumPredict,
  buildGeneralKnowledgeSystemAddon,
  buildGeneralKnowledgeUserPrompt,
  isGeneralKnowledgeContractViolation,
  requiresGeneralKnowledgeComposerContract,
  GK_VOLUME_TIER_LIGHT,
  GK_VOLUME_TIER_STANDARD,
  GK_VOLUME_TIER_DEEP,
} from "../src/agent/micro/replies/generalKnowledgeComposerContract.js";
import {
  finalRendererAgent,
  resolveComposerNumPredict,
} from "../src/agent/agents/finalRendererAgent.js";
import {
  getComposerSystemPrompt,
  resolveComposerContractMode,
  RESPONSE_MODES,
} from "../src/agent/config/modeResponseContracts.js";
import {
  resolveFactualResearchOutputShape,
  FACTUAL_RESEARCH_SHAPE_STRUCTURED_REPORT,
} from "../src/agent/policies/web/factualResearchDeliverablePolicy.js";

const ZORIN_WHAT = "C'est quoi Zorin OS ?";
const ZORIN_YES_NO = "Oui ou non : Zorin est-il Windows-friendly ?";
const ZORIN_DUAL_BOOT = "Installe Zorin en dual-boot, étape par étape";
const P5_REPORT = "Rapport : résumé exécutif + analyse de marché";
const MULTI_STEP_CODE =
  "Écris une fonction Python qui parse un CSV puis affiche un tableau des erreurs";

const SHORT_YES = "Oui. Zorin vise les venus de Windows.";

function optionsFor(query, extraPacket = {}) {
  return finalRendererAgent._resolveComposerOptions({
    user_query: query,
    user_intent: "unknown",
    mode: "EPISTEMIC",
    ...extraPacket,
  });
}

describe("volume adaptatif — table de décision", () => {
  it("Zorin « c'est quoi » sans web → light", () => {
    assert.equal(resolveGeneralKnowledgeVolumeTier(ZORIN_WHAT), GK_VOLUME_TIER_LIGHT);
    assert.equal(requiresGeneralKnowledgeComposerContract(ZORIN_WHAT), true);
  });

  it("Zorin « c'est quoi » avec web → standard", () => {
    assert.equal(
      resolveGeneralKnowledgeVolumeTier(ZORIN_WHAT, { hasWebEvidence: true }),
      GK_VOLUME_TIER_STANDARD,
    );
  });

  it("oui/non Zorin → light", () => {
    assert.equal(resolveGeneralKnowledgeVolumeTier(ZORIN_YES_NO), GK_VOLUME_TIER_LIGHT);
  });

  it("dual-boot étape par étape → deep (how-to / install, pas raccourci)", () => {
    assert.equal(
      resolveGeneralKnowledgeVolumeTier(ZORIN_DUAL_BOOT),
      GK_VOLUME_TIER_DEEP,
    );
  });

  it("rapport P5 → deep via shape lecture seule", () => {
    assert.equal(
      resolveFactualResearchOutputShape(P5_REPORT),
      FACTUAL_RESEARCH_SHAPE_STRUCTURED_REPORT,
    );
    assert.equal(resolveGeneralKnowledgeVolumeTier(P5_REPORT), GK_VOLUME_TIER_DEEP);
  });

  it("recette / en détail / composé restent hors light", () => {
    assert.equal(
      resolveGeneralKnowledgeVolumeTier("connais tu la recette de la carbonara"),
      GK_VOLUME_TIER_DEEP,
    );
    assert.equal(
      resolveGeneralKnowledgeVolumeTier("c'est quoi Zorin OS en détail"),
      GK_VOLUME_TIER_DEEP,
    );
    assert.equal(
      resolveGeneralKnowledgeVolumeTier(
        "connais tu la nissan skyline gtr et quelle est l annee du premier modele chez nissan",
      ),
      GK_VOLUME_TIER_STANDARD,
    );
  });
});

describe("volume adaptatif — addon GK light vs deep", () => {
  it("light : pas de « généreuse », pas d'interdit 2 phrases, pas 6 sections", () => {
    const addon = buildGeneralKnowledgeSystemAddon(ZORIN_WHAT);
    assert.match(addon, /2 à 5 phrases/i);
    assert.doesNotMatch(addon, /généreuse/i);
    assert.doesNotMatch(addon, /tronquée à 2 phrases/i);
    assert.doesNotMatch(addon, /max 6 sections/i);
    assert.doesNotMatch(addon, /Détails utiles/i);
  });

  it("light + web : sources en fin, pas de dump SERP", () => {
    const addon = buildGeneralKnowledgeSystemAddon(ZORIN_WHAT, {
      hasWebEvidence: true,
      volumeTier: GK_VOLUME_TIER_STANDARD,
    });
    assert.match(addon, /Sources en appui ou en fin/i);
    assert.match(addon, /pas de dump SERP/i);
    assert.doesNotMatch(addon, /généreuse/i);
  });

  it("deep recette : structure et interdit 2 phrases conservés", () => {
    const addon = buildGeneralKnowledgeSystemAddon(
      "connais tu la recette de la carbonara",
    );
    assert.match(addon, /Ingrédients et étapes/i);
    assert.match(addon, /tronquée à 2 phrases/i);
  });

  it("user prompt light reste court", () => {
    const prompt = buildGeneralKnowledgeUserPrompt(ZORIN_WHAT);
    assert.match(prompt, /Quelques phrases naturelles/i);
    assert.doesNotMatch(prompt, /détails utiles/i);
  });
});

describe("volume adaptatif — budgets + forceShort", () => {
  it("mapping numPredict : light 700, standard 900, deep GK 4000", () => {
    assert.equal(resolveGeneralKnowledgeNumPredict(GK_VOLUME_TIER_LIGHT), 700);
    assert.equal(resolveGeneralKnowledgeNumPredict(GK_VOLUME_TIER_STANDARD), 900);
    assert.equal(resolveGeneralKnowledgeNumPredict(GK_VOLUME_TIER_DEEP), 4000);
  });

  it("Zorin sans web : GK light, forceShort conservé, pas 4000", () => {
    const opts = optionsFor(ZORIN_WHAT);
    assert.equal(opts.volumeTier, GK_VOLUME_TIER_LIGHT);
    assert.equal(opts.generalKnowledge, true);
    assert.equal(opts.forceShort, true);
    assert.equal(opts.useFactual, false);
    assert.equal(resolveComposerNumPredict(opts, { user_query: ZORIN_WHAT }), 700);
  });

  it("Zorin avec web : standard, forceShort annulé, 900", () => {
    const opts = optionsFor(ZORIN_WHAT, {
      meta: { web_consulted_at: 1 },
      expert_outputs: [
        {
          stage: "web_research",
          content: "Zorin OS is a Linux distribution aimed at Windows users.",
        },
      ],
    });
    assert.equal(opts.volumeTier, GK_VOLUME_TIER_STANDARD);
    assert.equal(opts.forceShort, false);
    assert.equal(resolveComposerNumPredict(opts, { user_query: ZORIN_WHAT }), 900);
  });

  it("dual-boot : deep, forceShort annulé, budget 1200 (pas coupé à 400)", () => {
    const opts = optionsFor(ZORIN_DUAL_BOOT);
    assert.equal(opts.volumeTier, GK_VOLUME_TIER_DEEP);
    assert.equal(opts.forceShort, false);
    assert.equal(
      resolveComposerNumPredict(opts, { user_query: ZORIN_DUAL_BOOT }),
      1200,
    );
  });

  it("P5 : 2200 inchangé", () => {
    assert.equal(
      resolveComposerNumPredict(
        { factualResearch: true, volumeTier: GK_VOLUME_TIER_DEEP },
        { user_query: P5_REPORT },
      ),
      2200,
    );
  });

  it("code / repo / multi-étapes : 4000 inchangé", () => {
    assert.equal(
      resolveComposerNumPredict({ codeDelivery: true, volumeTier: GK_VOLUME_TIER_DEEP }),
      4000,
    );
    assert.equal(
      resolveComposerNumPredict({ repoAnalysis: true, volumeTier: GK_VOLUME_TIER_DEEP }),
      4000,
    );
    const opts = optionsFor(MULTI_STEP_CODE);
    assert.equal(opts.volumeTier, GK_VOLUME_TIER_DEEP);
    assert.ok(opts.codeDelivery || opts.volumeTier === GK_VOLUME_TIER_DEEP);
    assert.equal(
      resolveComposerNumPredict(opts, { user_query: MULTI_STEP_CODE }) >= 1200,
      true,
    );
  });
});

describe("volume adaptatif — validator / contrats périphériques", () => {
  it("oui/non utile < 80 : pas de violation de brièveté", () => {
    assert.ok(SHORT_YES.length < 80);
    assert.equal(isGeneralKnowledgeContractViolation(ZORIN_YES_NO, SHORT_YES), false);
    assert.equal(isGeneralKnowledgeContractViolation(ZORIN_WHAT, SHORT_YES), false);
  });

  it("menu mots-clés : violation conservée sur GK light", () => {
    const bad =
      "Tu veux critere ou carbonara ou cacio e pepe ou pates traditionnelles bolognaise";
    assert.equal(
      isGeneralKnowledgeContractViolation("c'est quoi la Tour Eiffel", bad),
      true,
    );
  });

  it("prompt light : pas de max 6 sections, pas SIMPLE_FAST hard-cut", () => {
    const opts = optionsFor(ZORIN_WHAT);
    const prompt = getComposerSystemPrompt(
      { user_query: ZORIN_WHAT, mode: "EPISTEMIC" },
      opts,
    );
    assert.doesNotMatch(prompt, /max 6 sections/i);
    assert.equal(
      resolveComposerContractMode({ user_query: ZORIN_WHAT }, opts),
      RESPONSE_MODES.COMPOSER,
    );
  });

  it("prompt standard/deep peut garder la structure", () => {
    const deepAddon = buildGeneralKnowledgeSystemAddon(
      "tu connais le boeuf bourguignon",
    );
    assert.match(deepAddon, /FORMAT OBLIGATOIRE/i);
    const p5Prompt = getComposerSystemPrompt(
      { user_query: P5_REPORT, mode: "EPISTEMIC" },
      { useFactual: true, volumeTier: GK_VOLUME_TIER_DEEP, factualResearch: true },
    );
    assert.match(p5Prompt, /max 6 sections/i);
  });
});
