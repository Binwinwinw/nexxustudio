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
  extractNominalDocumentSubject,
  isExplicitNominalDocumentDeliverable,
  requiresStructuredContentComposerBudget,
  resolveConstructiveDeliveryModules,
} from "../src/agent/policies/delivery/index.js";
import { enforceModeContract } from "../src/agent/config/modeResponseContracts.js";
import { isCodeGenerationRequest } from "../src/agent/policies/code/codeDeliveryPolicy.js";
import { resolveIntentContract } from "../src/agent/config/intentContractRegistry.js";
import { isPresentationOutlineRequest } from "../src/agent/utils/intent-guards/presentationOutlineIntentGuards.js";

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

  it("détecte une fiche explicite pour budget composer long", () => {
    assert.equal(
      requiresStructuredContentComposerBudget(
        "tu pourras me faire une fiche traitant de l'usage de copilot dans excel ?",
      ),
      true,
    );
  });

  it("livrable nominal fiche Copilot Excel → DIRECT_EXPLANATION, pas PRESENTATION_OUTLINE", () => {
    const query =
      "j'ai trouver l'utilisation de excel se voit améliorée avec l'intégration de l'IA copilot dans ses fonctionnalités, tu pourras me faire une fiche traitant de l'usage de copilot dans excel ?";
    assert.equal(isExplicitNominalDocumentDeliverable(query), true);
    assert.equal(isPresentationOutlineRequest(query), false);
    const subject = extractNominalDocumentSubject(query);
    assert.match(String(subject || ""), /copilot/i);
    assert.match(String(subject || ""), /excel/i);

    for (const userIntent of ["expert_task", "unknown", "strategic"]) {
      const { contract, matchedBy } = resolveIntentContract(query, {
        user_intent: userIntent,
      });
      assert.equal(contract.id, "DIRECT_EXPLANATION", `intent=${userIntent}`);
      assert.match(matchedBy, /isExplicitNominalDocumentDeliverable/);
      assert.notEqual(contract.responseMode, "OPEN_PROPOSITION");
    }
  });

  it("détecte une suite sticky fiche via contexte expert", () => {
    assert.equal(
      requiresStructuredContentComposerBudget(
        "là tu me montres des choix alors que ceux-ci m'embrouillent, j'ai déjà une idée, travaillons déjà mon idée",
        [{ content: "Fiche d'usage rapide — Copilot dans Excel" }],
      ),
      true,
    );
    assert.equal(
      requiresStructuredContentComposerBudget(
        "travaillons déjà mon idée ensuite nous verrons",
        [{ content: "bonjour général sans sujet" }],
      ),
      false,
    );
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
