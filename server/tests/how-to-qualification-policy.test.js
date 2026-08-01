import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  classifyHowToScopeAndRisk,
  buildHowToAmbiguousClarifyReply,
  buildHowToSimpleLocalContent,
  buildHowToProceduralLlmSystemAddon,
  enforceHowToProceduralDirectness,
  buildHowToProceduralDirectFallback,
  isHowToProceduralPseudoClarify,
  isHowToProceduralTopicViolation,
  isHowToProceduralSocialDrift,
  isHowToProceduralContractViolation,
  HOW_TO_QUALIFICATIONS,
} from "../src/agent/policies/qualification/howToQualificationPolicy.js";
import {
  INSUFFICIENT_SIGNAL_REFUSAL,
  enforceModeContract,
  RESPONSE_MODES,
} from "../src/agent/config/modeResponseContracts.js";
import {
  decomposeRequest,
  allWorkUnitsSatisfiable,
  canServeMultiUnitPartialDecomposition,
} from "../src/agent/policies/requestDecompositionPolicy.js";
import {
  buildMultiUnitCompositeReply,
  canServeMultiUnitComposite,
} from "../src/agent/micro/replies/multiUnitReplyBuilder.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";

const smoothieMultiUnitQuery =
  "salut salut comment ca va ??? héy j'ai besoin de l'heure, de la date du jour et savoir si tu sais comment on fait un smoothie???";

const airplaneMultiUnitQuery =
  "salut salut comment ca va ??? héy j'ai besoin de l'heure, de la date du jour et savoir si tu sais comment on fait un avion???";

describe("howToQualificationPolicy — batterie #25", () => {
  it("smoothie → simple_benign_local", () => {
    const { qualification } = classifyHowToScopeAndRisk("comment on fait un smoothie ?");
    assert.equal(qualification, HOW_TO_QUALIFICATIONS.SIMPLE_BENIGN_LOCAL);
    assert.match(
      buildHowToSimpleLocalContent("comment on fait un smoothie ?", "natural"),
      /smoothie/i,
    );
  });

  it("soupe → simple_benign_local, pas clarification_gate", () => {
    const q = "comment faire une bonne soupe ??";
    const { qualification } = classifyHowToScopeAndRisk(q);
    assert.equal(qualification, HOW_TO_QUALIFICATIONS.SIMPLE_BENIGN_LOCAL);
    const reply = buildHowToSimpleLocalContent(q, "natural");
    assert.match(reply, /soupe/i);
    assert.match(reply, /mijot/i);
    assert.doesNotMatch(reply, /objectif principal/i);
  });

  it("soupe standalone → how_to_simple_local via short-circuit", async () => {
    const hit = await runConversationShortCircuit("comment faire une bonne soupe ??");
    assert.equal(hit?.path, "how_to_simple_local");
    assert.match(hit.reply, /soupe/i);
    assert.doesNotMatch(hit.reply, /objectif principal/i);
  });

  it("avion sans qualificateur → ambiguous", () => {
    const { qualification } = classifyHowToScopeAndRisk("comment on fait un avion ?");
    assert.equal(qualification, HOW_TO_QUALIFICATIONS.AMBIGUOUS);
    const clarify = buildHowToAmbiguousClarifyReply("comment on fait un avion ?");
    assert.match(clarify, /papier/i);
    assert.match(clarify, /maquette/i);
    assert.match(clarify, /vrai avion/i);
  });

  it("avion en papier → simple_benign_local", () => {
    const { qualification } = classifyHowToScopeAndRisk(
      "comment on fait un avion en papier ?",
    );
    assert.equal(qualification, HOW_TO_QUALIFICATIONS.SIMPLE_BENIGN_LOCAL);
    assert.match(
      buildHowToSimpleLocalContent("comment on fait un avion en papier ?", "natural"),
      /avion en papier/i,
    );
  });

  it("vrai avion → complex_but_benign", () => {
    const { qualification } = classifyHowToScopeAndRisk(
      "comment on fabrique un vrai avion ?",
    );
    assert.equal(qualification, HOW_TO_QUALIFICATIONS.COMPLEX_BUT_BENIGN);
  });

  it("standalone avion → how_to_clarify, pas pseudo-how-to", async () => {
    const hit = await runConversationShortCircuit("comment on fait un avion ?");
    assert.equal(hit?.path, "how_to_clarify");
    assert.match(hit.reply, /papier|maquette|vrai avion/i);
    assert.doesNotMatch(hit.reply, /étape par étape/i);
  });

  it("multi_unit avion + date/heure → partial clarify", async () => {
    const decomposition = decomposeRequest(airplaneMultiUnitQuery);
    const howTo = decomposition.units.find((u) => u.unitType === "how_to_request");
    assert.equal(howTo?.howToQualification, HOW_TO_QUALIFICATIONS.AMBIGUOUS);
    assert.equal(allWorkUnitsSatisfiable(decomposition), false);
    assert.equal(canServeMultiUnitPartialDecomposition(decomposition), true);
    assert.equal(canServeMultiUnitComposite(decomposition), false);

    const composite = buildMultiUnitCompositeReply(decomposition);
    assert.ok(composite?.partial);
    assert.match(composite.reply, /Nous sommes/i);
    assert.match(composite.reply, /papier|maquette|vrai avion/i);
    assert.doesNotMatch(composite.reply, /étape par étape/i);

    const hit = await runConversationShortCircuit(airplaneMultiUnitQuery, {
      requestDecomposition: decomposition,
    });
    assert.equal(hit?.path, "multi_unit_partial_clarify");
  });

  it("multi_unit smoothie reste fully satisfiable", async () => {
    const decomposition = decomposeRequest(smoothieMultiUnitQuery);
    const howTo = decomposition.units.find((u) => u.unitType === "how_to_request");
    assert.equal(howTo?.howToQualification, HOW_TO_QUALIFICATIONS.SIMPLE_BENIGN_LOCAL);
    assert.equal(allWorkUnitsSatisfiable(decomposition), true);
    assert.equal(canServeMultiUnitComposite(decomposition), true);

    const hit = await runConversationShortCircuit(smoothieMultiUnitQuery, {
      requestDecomposition: decomposition,
    });
    assert.equal(hit?.path, "multi_unit_deterministic");
    assert.match(hit.reply, /smoothie/i);
  });

  it("tiramisu → simple_benign_local avec procédure concrète", () => {
    const q = "comment faire un bon tiramisu";
    const { qualification } = classifyHowToScopeAndRisk(q);
    assert.equal(qualification, HOW_TO_QUALIFICATIONS.SIMPLE_BENIGN_LOCAL);
    const reply = buildHowToSimpleLocalContent(q, "natural");
    assert.match(reply, /tiramisu/i);
    assert.match(reply, /mascarpone|biscuit|café|cacao/i);
    assert.doesNotMatch(reply, /réunis ce qu'il te faut, avance étape par étape/i);
  });

  it("tiramisu standalone → how_to_simple_local, pas culture générale", async () => {
    const hit = await runConversationShortCircuit("comment faire un bon tiramisu");
    assert.equal(hit?.path, "how_to_simple_local");
    assert.match(hit.reply, /tiramisu/i);
    assert.doesNotMatch(hit.reply, /tarte aux pommes/i);
  });

  it("recette du tiramisu → how_to_procedural_llm, pas lexique ni GK", async () => {
    const hit = await runConversationShortCircuit("tu connais la recette du tiramisu");
    assert.equal(hit?.path, "how_to_procedural_llm");
    assert.equal(hit?.deferToLlm, true);
    assert.match(hit.reflectiveHint, /tiramisu/i);
    assert.match(hit.reflectiveHint, /INTERDIT/i);
  });

  it("et la recette du tiramisu → how_to_procedural_llm, pas general_knowledge", async () => {
    const hit = await runConversationShortCircuit("et la recette du tiramisu");
    assert.equal(hit?.path, "how_to_procedural_llm");
    assert.notEqual(hit?.path, "general_knowledge_full_pipeline");
  });
});

describe("howToQualificationPolicy — verrou P3 procedural", () => {
  it("addon interdit explicitement INSUFFICIENT_SIGNAL_REFUSAL", () => {
    const addon = buildHowToProceduralLlmSystemAddon(
      "comment on fait un ordinateur de bureau pour bureautique",
    );
    assert.match(addon, /INTERDIT/i);
    assert.match(addon, /Je vois la piste/i);
    assert.match(addon, /ordinateur/i);
  });

  it("enforceHowToProceduralDirectness remplace un refus par un canevas", () => {
    const q = "comment on fait un ordinateur de bureau pour bureautique";
    const out = enforceHowToProceduralDirectness(INSUFFICIENT_SIGNAL_REFUSAL, q);
    assert.equal(isHowToProceduralPseudoClarify(out), false);
    assert.match(out, /ordinateur de bureau pour bureautique|ordinateur/i);
    assert.match(out, /^1\)/m);
  });

  it("enforceModeContract HOW_TO_PROCEDURAL purge le refus canonique", () => {
    const out = enforceModeContract(
      RESPONSE_MODES.HOW_TO_PROCEDURAL,
      INSUFFICIENT_SIGNAL_REFUSAL,
      { allowRefusal: false, howToProcedural: true },
    );
    assert.equal(out, "");
  });

  it("fallback culinaire produit des étapes numérotées", () => {
    const out = buildHowToProceduralDirectFallback("comment faire une tarte aux pommes");
    assert.match(out, /tarte aux pommes/i);
    assert.match(out, /^1\)/m);
    assert.doesNotMatch(out, /Je vois la piste/i);
  });

  const FRACTIONS_QUERY = "comment on fait une soustraction de fractions";

  it("détecte smalltalk hors-sujet sur path how-to (G14 topic)", () => {
    const drift =
      "Bonjour ! Tout va bien ici. Comment puis-je t'aider aujourd'hui ?";
    assert.equal(isHowToProceduralSocialDrift(drift), true);
    assert.equal(isHowToProceduralTopicViolation(drift, FRACTIONS_QUERY), true);
    assert.equal(isHowToProceduralContractViolation(drift, FRACTIONS_QUERY), true);
  });

  it("enforce remplace smalltalk par canevas procédural ancré sujet", () => {
    const drift =
      "Bonjour ! Tout va bien ici. Comment puis-je t'aider aujourd'hui ?";
    const out = enforceHowToProceduralDirectness(drift, FRACTIONS_QUERY);
    assert.doesNotMatch(out, /comment puis-je t'aider/i);
    assert.match(out, /soustraction de fractions|fraction/i);
    assert.match(out, /^1\)/m);
  });

  it("réponse procédurale valide — pas de faux positif topic", () => {
    const ok =
      "Pour soustraire des fractions :\n1) Mets les fractions au même dénominateur.\n2) Soustrais les numérateurs.\n3) Simplifie le résultat.";
    assert.equal(isHowToProceduralContractViolation(ok, FRACTIONS_QUERY), false);
  });
});
