import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildHtmlProjectSystemAddon,
  evaluateHtmlProjectDelivery,
  HTML_PROJECT_PROFILES,
  isHtmlProjectDeliverable,
  isHtmlProjectQualityViolation,
  resolveHtmlProjectProfile,
} from "../src/agent/policies/htmlProjectDeliveryPolicy.js";

const NOTION_WORKSHOP_QUERY =
  "sais tu créer un atelier d'initiation à l'application NOTION sous forme de fichier html avec header sidebar sur les différents thèmes comme menus?";

describe("htmlProjectDeliveryPolicy", () => {
  it("reconnaît tout livrable HTML explicite (pas seulement atelier)", () => {
    assert.equal(isHtmlProjectDeliverable(NOTION_WORKSHOP_QUERY), true);
    assert.equal(
      isHtmlProjectDeliverable("crée une landing page html pour mon produit SaaS avec hero et CTA"),
      true,
    );
    assert.equal(
      isHtmlProjectDeliverable("génère un template html responsive de test"),
      true,
    );
    assert.equal(isHtmlProjectDeliverable("Salut"), false);
  });

  it("résout les sous-profils", () => {
    assert.equal(resolveHtmlProjectProfile(NOTION_WORKSHOP_QUERY), HTML_PROJECT_PROFILES.WORKSHOP);
    assert.equal(
      resolveHtmlProjectProfile("landing page html vitrine startup"),
      HTML_PROJECT_PROFILES.LANDING,
    );
    assert.equal(
      resolveHtmlProjectProfile("dashboard html tableau de bord admin"),
      HTML_PROJECT_PROFILES.DASHBOARD,
    );
    assert.equal(
      resolveHtmlProjectProfile("template html maquette demo"),
      HTML_PROJECT_PROFILES.TEMPLATE,
    );
    assert.equal(
      resolveHtmlProjectProfile("fichier html sidebar sections notion"),
      HTML_PROJECT_PROFILES.WORKSHOP,
    );
  });

  it("construit directement quand le cadrage est suffisant", () => {
    const eval_ = evaluateHtmlProjectDelivery(NOTION_WORKSHOP_QUERY);
    assert.equal(eval_.strategy, "build_v1");
    assert.equal(eval_.canBuildDirectly, true);
    assert.equal(eval_.clarificationQuestions.length, 0);
  });

  it("propose clarification ciblée si la demande est trop vague", () => {
    const eval_ = evaluateHtmlProjectDelivery("fais une page html");
    assert.equal(eval_.isHtmlProject, true);
    assert.equal(eval_.strategy, "clarify_then_build");
    assert.ok(eval_.clarificationQuestions.length >= 2);
    assert.ok(eval_.clarificationQuestions.length <= 5);
  });

  it("part sur défauts intelligents pour un template de test", () => {
    const eval_ = evaluateHtmlProjectDelivery("crée un template html de démo responsive");
    assert.equal(eval_.profile, HTML_PROJECT_PROFILES.TEMPLATE);
    assert.equal(eval_.strategy, "build_with_smart_defaults");
    assert.equal(eval_.canBuildDirectly, true);
  });

  it("n'impose pas la règle sidebar sur une landing", () => {
    const minimalLanding = `\`\`\`html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SaaS Landing</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; }
    .hero { padding: 2rem; text-align: center; }
    @media (max-width: 768px) { .hero { padding: 1rem; } }
  </style>
</head>
<body>
  <header><h1>Mon SaaS</h1></header>
  <main>
    <section class="hero"><h2>Hero principal</h2><p>Proposition de valeur claire pour le produit.</p></section>
    <section><h2>Bénéfices</h2><p>Détail des avantages pour l'utilisateur cible.</p></section>
  </main>
</body>
</html>
\`\`\``;
    const q = "landing page html pour mon SaaS avec hero et sections";
    assert.equal(isHtmlProjectQualityViolation(q, minimalLanding), false);
  });

  it("injecte le contrat projet HTML général dans le prompt", () => {
    const addon = buildHtmlProjectSystemAddon("page html portfolio avec header et sections");
    assert.match(addon, /HTML_PROJECT_DELIVERY_V1/i);
    assert.match(addon, /pas seulement un « atelier »/i);
    assert.doesNotMatch(addon, /CONTRAT QUALITÉ HTML ATELIER/);
  });

  it("injecte le sous-contrat atelier seulement pour un atelier", () => {
    const addon = buildHtmlProjectSystemAddon(NOTION_WORKSHOP_QUERY);
    assert.match(addon, /HTML_WORKSHOP_QUALITY_V1/i);
    assert.match(addon, /CONSTRUCTION V1 DIRECTE/i);
  });

  it("n'interprète pas « fiches de révisions pour maîtriser HTML » comme projet web", () => {
    const q =
      "creer des fiches de revisions afin maitriser le html et ses regles";
    assert.equal(isHtmlProjectDeliverable(q), false);
    assert.equal(evaluateHtmlProjectDelivery(q).isHtmlProject, false);
  });
});
