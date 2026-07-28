import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildNotionWorkshopProductionDelivery,
  extractHtmlFromDelivery,
  isHtmlWorkshopQualityViolation,
  evaluateHtmlWorkshopQuality,
  buildHtmlWorkshopRepairUserAddon,
} from "../src/agent/policies/htmlWorkshopDeliveryContract.js";
import {
  buildHtmlProjectSystemAddon,
  isHtmlWorkshopDeliverable,
} from "../src/agent/policies/htmlProjectDeliveryPolicy.js";
import { buildNotionWorkshopProductionHtml } from "../src/agent/templates/notionWorkshopHtmlTemplate.js";
import { htmlWorkshopQualityPolicy } from "../src/agent/quality/policies/htmlWorkshopQualityPolicy.js";
import {
  QUALITY_STOP_REASONS,
  runContractQualityLoop,
} from "../src/agent/quality/contractQualityLoop.js";
import { HTML_WORKSHOP_QUALITY_CONTRACT_ID } from "../src/agent/policies/htmlWorkshopDeliveryContract.js";

const NOTION_WORKSHOP_QUERY =
  "sais tu créer un atelier d'initiation à l'application NOTION sous forme de fichier html avec header sidebar sur les différents thèmes comme menus?";

const MINIMAL_HORIZONTAL_NAV = `\`\`\`html
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Notion</title><style>nav a{display:inline-block;padding:8px;}</style></head>
<body>
<header><h1>Atelier Notion</h1><nav><a href="#a">A</a><a href="#b">B</a></nav></header>
<main>
<section id="a"><h2>A</h2><p>Court.</p></section>
<section id="b"><h2>B</h2><p>Court.</p></section>
</main>
<footer>© 2023 Atelier</footer>
</body>
</html>
\`\`\``;

describe("htmlWorkshopDeliveryContract", () => {
  it("détecte une demande d'atelier HTML", () => {
    assert.equal(isHtmlWorkshopDeliverable(NOTION_WORKSHOP_QUERY), true);
    assert.equal(isHtmlWorkshopDeliverable("Salut"), false);
  });

  it("rejette une maquette nav horizontale sans aside", () => {
    assert.equal(isHtmlWorkshopQualityViolation(NOTION_WORKSHOP_QUERY, MINIMAL_HORIZONTAL_NAV), true);
  });

  it("accepte le gabarit production Notion", () => {
    const delivery = buildNotionWorkshopProductionDelivery();
    assert.equal(isHtmlWorkshopQualityViolation(NOTION_WORKSHOP_QUERY, delivery), false);
    const html = extractHtmlFromDelivery(delivery);
    assert.match(html, /<aside[\s>]/i);
    assert.match(html, /@media\s*\(/i);
    assert.match(html, /IntersectionObserver/i);
    assert.equal((html.match(/<section[\s>]/gi) || []).length, 6);
    assert.doesNotMatch(html, /©\s*2023/i);
  });

  it("injecte le sous-contrat atelier via le contrat projet HTML", () => {
    const addon = buildHtmlProjectSystemAddon(NOTION_WORKSHOP_QUERY);
    assert.match(addon, /HTML_PROJECT_DELIVERY_V1/i);
    assert.match(addon, /HTML_WORKSHOP_QUALITY_V1/i);
    assert.match(addon, /aside/i);
    assert.match(addon, /Cas pratique final/i);
  });

  it("gabarit HTML contient contenu pédagogique riche", () => {
    const html = buildNotionWorkshopProductionHtml();
    assert.match(html, /Découvrir Notion/i);
    assert.match(html, /Bases de données/i);
    assert.match(html, /Hub perso/i);
    assert.match(html, /skip-link/i);
    assert.match(html, /footer-year/i);
  });

  it("evaluateHtmlWorkshopQuality reste aligné sur isHtmlWorkshopQualityViolation", () => {
    const bad = evaluateHtmlWorkshopQuality(NOTION_WORKSHOP_QUERY, MINIMAL_HORIZONTAL_NAV);
    assert.equal(bad.quality, "fail");
    assert.equal(isHtmlWorkshopQualityViolation(NOTION_WORKSHOP_QUERY, MINIMAL_HORIZONTAL_NAV), true);
    assert.ok(bad.reasons.length >= 1);

    const goodDelivery = buildNotionWorkshopProductionDelivery();
    const good = evaluateHtmlWorkshopQuality(NOTION_WORKSHOP_QUERY, goodDelivery);
    assert.equal(good.quality, "pass");
    assert.equal(isHtmlWorkshopQualityViolation(NOTION_WORKSHOP_QUERY, goodDelivery), false);
  });

  it("htmlWorkshopQualityPolicy : applies + repair via ContractQualityLoop", async () => {
    assert.equal(htmlWorkshopQualityPolicy.id, HTML_WORKSHOP_QUALITY_CONTRACT_ID);
    assert.equal(htmlWorkshopQualityPolicy.applies({ query: NOTION_WORKSHOP_QUERY }), true);
    assert.equal(htmlWorkshopQualityPolicy.applies({ query: "bonjour" }), false);
    assert.equal(
      htmlWorkshopQualityPolicy.applies({
        query:
          "Crée une page HTML/CSS/JS pour présenter X, enregistre dans projects/demo",
      }),
      false,
    );

    const goodDelivery = buildNotionWorkshopProductionDelivery();
    const out = await runContractQualityLoop(
      htmlWorkshopQualityPolicy,
      MINIMAL_HORIZONTAL_NAV,
      {
        query: NOTION_WORKSHOP_QUERY,
        systemPrompt: "s",
        userPrompt: "u",
        generate: async () => goodDelivery,
      },
    );
    assert.equal(out.repairAttempts, 1);
    assert.equal(out.finalQuality.quality, "pass");
    assert.equal(out.stopReason, QUALITY_STOP_REASONS.PASS);
    assert.ok(out.initialQuality.score < out.finalQuality.score);

    const repairAddon = buildHtmlWorkshopRepairUserAddon(out.initialQuality);
    assert.match(repairAddon, /HTML_WORKSHOP_QUALITY_V1/);
  });
});
