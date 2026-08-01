import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateEpistemicRefusal } from "../src/agent/config/modeResponseContracts.js";
import {
  buildConstructiveDeliveryFallback,
  buildConstructiveDeliverySystemAddon,
  buildConstructiveDeliveryUserPrompt,
  isClearConstructiveDeliverable,
  isCodeDeliveryContractViolation,
  isDefensiveDeliveryRefusal,
  isNotionWorkshopDeliverable,
  NOTION_WORKSHOP_DEFAULT_MODULES,
  resolveConstructiveDeliveryModules,
} from "../src/agent/policies/delivery/index.js";
import { enforceModeContract } from "../src/agent/config/modeResponseContracts.js";
import { isCodeGenerationRequest } from "../src/agent/policies/codeDeliveryPolicy.js";

const NOTION_WORKSHOP_QUERY =
  "sais tu créer un atelier d'initiation à l'application NOTION sous forme de fichier html avec header sidebar sur les différents thèmes comme menus?";

describe("constructiveDeliveryPolicy", () => {
  it("reconnaît l'atelier Notion HTML comme livrable constructif clair", () => {
    assert.equal(isCodeGenerationRequest(NOTION_WORKSHOP_QUERY), true);
    assert.equal(isClearConstructiveDeliverable(NOTION_WORKSHOP_QUERY), true);
    assert.equal(isNotionWorkshopDeliverable(NOTION_WORKSHOP_QUERY), true);
  });

  it("propose les modules pédagogiques Notion par défaut", () => {
    const modules = resolveConstructiveDeliveryModules(NOTION_WORKSHOP_QUERY);
    assert.equal(modules.length, NOTION_WORKSHOP_DEFAULT_MODULES.length);
    assert.match(modules.join(" "), /Découvrir Notion/i);
    assert.match(modules.join(" "), /Cas pratique final/i);
  });

  it("injecte la doctrine constructive dans le prompt système", () => {
    const addon = buildConstructiveDeliverySystemAddon(NOTION_WORKSHOP_QUERY);
    assert.match(addon, /MODE CONSTRUCTION/i);
    assert.match(addon, /INTERDIT/i);
    assert.match(addon, /Découvrir Notion|sidebar verticale/i);
  });

  it("injecte header/sidebar et modules dans le prompt utilisateur", () => {
    const prompt = buildConstructiveDeliveryUserPrompt(NOTION_WORKSHOP_QUERY);
    assert.match(prompt, /STRATÉGIE|MODE PROJET HTML/i);
    assert.match(prompt, /atelier|Sidebar VERTICALE/i);
    assert.match(prompt, /Collaboration et partage/i);
    assert.match(prompt, /profil atelier/i);
  });

  it("bypass le refus épistémique pour un livrable code clair", () => {
    const verdict = evaluateEpistemicRefusal({ query: NOTION_WORKSHOP_QUERY });
    assert.equal(verdict.shouldRefuse, false);
    assert.equal(verdict.reason, "constructive_code_delivery_v1");
  });

  it("ignore une salutation sans livrable", () => {
    assert.equal(isClearConstructiveDeliverable("Salut, ça va ?"), false);
  });

  it("détecte un refus défensif sur livrable clair", () => {
    const refusal =
      "Je n'ai pas assez d'éléments fiables pour répondre correctement à votre demande. Veuillez préciser le langage.";
    assert.equal(isDefensiveDeliveryRefusal(refusal), true);
    assert.equal(
      isCodeDeliveryContractViolation(NOTION_WORKSHOP_QUERY, refusal),
      true,
    );
  });

  it("purge le refus défensif dans enforceModeContract (codeDelivery)", () => {
    const refusal =
      "Je n'ai pas assez d'éléments fiables pour répondre correctement. Précise ta demande.";
    const cleaned = enforceModeContract("COMPOSER", refusal, {
      allowRefusal: false,
      codeDelivery: true,
    });
    assert.equal(cleaned, "");
  });

  it("fournit un repli HTML Notion de niveau production", () => {
    const fallback = buildConstructiveDeliveryFallback(NOTION_WORKSHOP_QUERY);
    assert.match(fallback, /```html/i);
    assert.match(fallback, /<aside/i);
    assert.match(fallback, /@media/i);
    assert.match(fallback, /Cas pratique final/i);
    assert.doesNotMatch(fallback, /©\s*2023/i);
  });
});
