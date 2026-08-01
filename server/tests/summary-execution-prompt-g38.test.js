import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  classifySummaryContract,
  SUMMARY_CONTRACTS,
  SUMMARY_INTENTS,
} from "../src/agent/policies/summary/index.js";
import { resolveSummaryContractShortCircuit } from "../src/agent/policies/summary/index.js";
import {
  SUMMARY_EXECUTION_MODES,
  buildSummaryExecutionSystemAddon,
  buildTextSummarySystemAddon,
  buildWebSummarySystemAddon,
  resolveSummaryExecutionMode,
  splitWebPayloadMainAndChrome,
  buildSummaryExecutionValidationContext,
} from "../src/agent/policies/summary/index.js";
import {
  validateDocumentSynthesisReply,
  isExternalKnowledgeLeakReply,
  isWebLayoutPollutionReply,
  scoreWebMainContentFocus,
} from "../src/agent/policies/documentSynthesisValidator.js";

const PASTED_ARTICLE = `Résume ce passage :

La photosynthèse convertit l'énergie lumineuse en énergie chimique. Les chloroplastes absorbent la lumière et produisent du glucose.`;

const PASTED_WITH_URL_MENTION = `Résume ce texte :

Ce document cite https://example.com mais explique uniquement la photosynthèse et le rôle des chloroplastes dans la production de glucose.`;

const MOCK_WEB_PAYLOAD = `Menu principal
Accueil
Contact
Newsletter
L'inflation ralentit à 2,4% selon les données publiées ce trimestre par l'institut national.
Les ménages constatent une baisse progressive des prix alimentaires depuis janvier.
Footer du site
Mentions légales
Politique de cookies`;

describe("G38.1 — summaryExecutionMode", () => {
  it("TEXT_SUMMARY → mode text", () => {
    const contract = classifySummaryContract(PASTED_ARTICLE);
    assert.equal(contract.contract, SUMMARY_CONTRACTS.TEXT_SUMMARY);
    assert.equal(resolveSummaryExecutionMode(contract), SUMMARY_EXECUTION_MODES.TEXT);
  });

  it("WEB_SUMMARY → mode web", () => {
    const contract = classifySummaryContract(
      "résume cette page https://news.example.com/article",
    );
    assert.equal(contract.contract, SUMMARY_CONTRACTS.WEB_SUMMARY);
    assert.equal(resolveSummaryExecutionMode(contract), SUMMARY_EXECUTION_MODES.WEB);
  });

  it("texte collé mentionnant une URL reste TEXT_SUMMARY", () => {
    const contract = classifySummaryContract(PASTED_WITH_URL_MENTION);
    assert.equal(contract.intent, SUMMARY_INTENTS.USER_PROVIDED_TEXT);
    assert.equal(resolveSummaryExecutionMode(contract), SUMMARY_EXECUTION_MODES.TEXT);
  });
});

describe("G38.1 — prompts système distincts", () => {
  it("TEXT_SUMMARY addon — fidélité stricte, pas de contexte externe", () => {
    const contract = classifySummaryContract(PASTED_ARTICLE);
    const addon = buildTextSummarySystemAddon(PASTED_ARTICLE, contract);
    assert.match(addon, /TEXT_SUMMARY/i);
    assert.match(addon, /uniquement le contenu fourni/i);
    assert.match(addon, /aucun contexte externe/i);
    assert.doesNotMatch(addon, /navigation|footer|chrome/i);
  });

  it("WEB_SUMMARY addon — main content + exclusion chrome", () => {
    const contract = classifySummaryContract(
      "résume cet article : https://shop.example.com/produit",
    );
    const addon = buildWebSummarySystemAddon("résume cet article", contract);
    assert.match(addon, /WEB_SUMMARY/i);
    assert.match(addon, /contenu principal/i);
    assert.match(addon, /navigation|footer|promos|widgets/i);
    assert.doesNotMatch(addon, /uniquement le contenu fourni par l'utilisateur/i);
  });

  it("short-circuit injecte reflectiveHint selon le contrat", () => {
    const textHit = resolveSummaryContractShortCircuit(PASTED_ARTICLE);
    const webHit = resolveSummaryContractShortCircuit(
      "résume cette page https://blog.example.com/post",
    );
    assert.equal(textHit.summaryExecutionMode, SUMMARY_EXECUTION_MODES.TEXT);
    assert.equal(webHit.summaryExecutionMode, SUMMARY_EXECUTION_MODES.WEB);
    assert.match(textHit.reflectiveHint, /TEXT_SUMMARY/i);
    assert.match(webHit.reflectiveHint, /WEB_SUMMARY/i);
  });
});

describe("G38.1 — sélection contenu principal web", () => {
  it("splitWebPayloadMainAndChrome isole le corps article", () => {
    const split = splitWebPayloadMainAndChrome(MOCK_WEB_PAYLOAD);
    assert.match(split.mainContent, /inflation/i);
    assert.match(split.mainContent, /ménages|menages/i);
    assert.match(split.chromeContent, /menu principal/i);
    assert.match(split.chromeContent, /mentions legales|mentions légales/i);
    assert.doesNotMatch(split.mainContent, /politique de cookies/i);
  });

  it("scoreWebMainContentFocus pénalise la pollution layout", () => {
    const split = splitWebPayloadMainAndChrome(MOCK_WEB_PAYLOAD);
    const good = scoreWebMainContentFocus(
      "L'inflation ralentit à 2,4% et les ménages constatent une baisse des prix alimentaires.",
      split,
    );
    const bad = scoreWebMainContentFocus(
      "Le menu principal du footer propose newsletter et mentions légales.",
      split,
    );
    assert.equal(good.polluted, false);
    assert.equal(bad.polluted, true);
  });
});

describe("G38.1 — validator différencié", () => {
  const sourceText =
    "La photosynthèse convertit l'énergie lumineuse en énergie chimique via les chloroplastes.";

  it("TEXT_SUMMARY — rejette fuite de connaissance externe", () => {
    const result = validateDocumentSynthesisReply(
      "Selon Wikipedia, la photosynthèse est un processus biologique fondamental depuis des millions d'années.",
      { sourceText },
      buildSummaryExecutionValidationContext({
        contract: SUMMARY_CONTRACTS.TEXT_SUMMARY,
        source: { type: "pasted" },
      }),
    );
    assert.ok(isExternalKnowledgeLeakReply(result.sanitized));
    assert.ok(result.issues.includes("text_summary_external_knowledge_leak"));
    assert.equal(result.executionMode, SUMMARY_EXECUTION_MODES.TEXT);
  });

  it("WEB_SUMMARY — rejette pollution layout", () => {
    const split = splitWebPayloadMainAndChrome(MOCK_WEB_PAYLOAD);
    const result = validateDocumentSynthesisReply(
      "Le menu principal du site propose un footer avec newsletter et politique de cookies.",
      { sourceText: MOCK_WEB_PAYLOAD },
      buildSummaryExecutionValidationContext({
        contract: SUMMARY_CONTRACTS.WEB_SUMMARY,
        source: { type: "url" },
      }),
    );
    assert.ok(isWebLayoutPollutionReply(result.sanitized));
    assert.ok(
      result.issues.some((issue) =>
        ["web_summary_layout_pollution", "web_summary_chrome_focus"].includes(issue),
      ),
    );
    assert.equal(result.executionMode, SUMMARY_EXECUTION_MODES.WEB);
    assert.ok(scoreWebMainContentFocus(result.sanitized, split).polluted);
  });

  it("buildSummaryExecutionSystemAddon expose mode + addon", () => {
    const contract = classifySummaryContract(PASTED_ARTICLE);
    const built = buildSummaryExecutionSystemAddon(contract, PASTED_ARTICLE);
    assert.equal(built.mode, SUMMARY_EXECUTION_MODES.TEXT);
    assert.ok(built.addon);
  });
});
