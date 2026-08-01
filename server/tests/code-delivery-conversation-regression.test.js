import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSystemPrompt } from "../src/agent/prompts/systemPromptBuilder.js";
import { getComposerSystemPrompt } from "../src/agent/config/modeResponseContracts.js";
import { shouldBypassSimpleFast } from "../src/agent/config/intentContractRegistry.js";
import { isGenericReadyGreeting } from "../src/agent/utils/genericGreetingGuards.js";
import {
  detectCodeDeliveryLanguage,
  resolveCodeDeliveryLanguage,
  isCodeGenerationRequest,
  buildCodeDeliveryAddon,
  hasCodeDeliveryStructure,
  CODE_DELIVERY_SECTION_MARKERS,
} from "../src/agent/policies/code/codeDeliveryPolicy.js";
import { evaluateCodeDeliverySentinels } from "../src/agent/policies/code/codeDeliverySentinels.js";
import {
  CODE_DELIVERY_GOLDEN_QUERIES,
  CODE_DELIVERY_DEMO_QUERIES,
  CODE_DELIVERY_PRODUCTION_BUG_QUERIES,
  GOLDEN_QUERY_CATEGORIES,
} from "./fixtures/codeDeliveryGoldenQueries.js";

function includesAll(text, patterns = []) {
  const body = String(text || "").toLowerCase();
  return patterns.every((p) => body.includes(String(p).toLowerCase()));
}

function includesNone(text, patterns = []) {
  const body = String(text || "").toLowerCase();
  return patterns.every((p) => !body.includes(String(p).toLowerCase()));
}

function buildPromptForQuery(query) {
  return buildSystemPrompt(
    [],
    false,
    { phase: "DISCOVERY", score: 0 },
    "BALANCED",
    "",
    {},
    true,
    false,
    null,
    "NORMAL",
    false,
    null,
    query,
  );
}

describe("code delivery golden queries — régression policy & prompt", () => {
  for (const scenario of CODE_DELIVERY_GOLDEN_QUERIES) {
    it(`[${scenario.id}] détecte le langage ${scenario.language}`, () => {
      const detected = detectCodeDeliveryLanguage(scenario.query);
      const resolved = resolveCodeDeliveryLanguage(scenario.query);

      const pythonFallbackIds = new Set([
        "python-nombre-premier",
        "prod-clarification-inutile-algo-python",
      ]);
      if (scenario.language === "python" && pythonFallbackIds.has(scenario.id)) {
        assert.equal(detected, null, "fallback Python sans mot-clé explicite");
        assert.equal(resolved, "python");
      } else {
        assert.equal(detected, scenario.language, `détection pour: ${scenario.query}`);
        assert.equal(resolved, scenario.language);
      }

      assert.equal(isCodeGenerationRequest(scenario.query), true);
      assert.equal(shouldBypassSimpleFast(scenario.query, {}, {}), true);
    });

    it(`[${scenario.id}] injecte les règles langage dans le modificateur`, () => {
      const addon = buildCodeDeliveryAddon(scenario.query);
      assert.ok(addon.length > 0, "modificateur vide");
      assert.match(addon, /LIVRAISON CODE MULTI-LANGAGES/);
      assert.ok(
        includesAll(addon, scenario.promptMustInclude),
        `Règles manquantes dans l'addon pour ${scenario.id}: ${addon.slice(0, 400)}`,
      );

      if (scenario.expectsMultiFile) {
        assert.match(addon, /MULTI-FICHIERS/);
      }
    });

    it(`[${scenario.id}] propage le modificateur dans buildSystemPrompt`, () => {
      const prompt = buildPromptForQuery(scenario.query);
      assert.match(prompt, /\[MODIFICATEUR: LIVRAISON CODE MULTI-LANGAGES/);
      assert.match(prompt, /\[SECTION: SOUVERAINETÉ & SÉCURITÉ\]/);
      assert.ok(
        includesAll(prompt, scenario.promptMustInclude.slice(0, 2)),
        `Prompt incomplet pour ${scenario.id}`,
      );
    });

    it(`[${scenario.id}] valide la réponse golden de référence`, () => {
      assert.ok(scenario.goldenResponse, "goldenResponse manquante");
      assert.ok(
        hasCodeDeliveryStructure(scenario.goldenResponse, scenario.language),
        `Structure invalide pour golden ${scenario.id}`,
      );

      for (const marker of CODE_DELIVERY_SECTION_MARKERS) {
        assert.ok(
          scenario.goldenResponse.includes(marker),
          `Marqueur ${marker} absent dans golden ${scenario.id}`,
        );
      }

      assert.ok(
        includesAll(scenario.goldenResponse, scenario.responseMustInclude),
        `Contenu golden incomplet pour ${scenario.id}`,
      );
      assert.ok(
        includesNone(scenario.goldenResponse, scenario.responseForbidden),
        `Contenu interdit présent dans golden ${scenario.id}`,
      );

      const sentinelEval = evaluateCodeDeliverySentinels(scenario.goldenResponse, scenario);
      assert.equal(
        sentinelEval.pass,
        true,
        `[${scenario.id}] sentinelles: ${JSON.stringify(sentinelEval.failures)}`,
      );
    });
  }
});

describe("code delivery golden queries — stratification catégories", () => {
  it("sépare démo et bugs production", () => {
    assert.ok(CODE_DELIVERY_DEMO_QUERIES.length >= 8);
    assert.ok(CODE_DELIVERY_PRODUCTION_BUG_QUERIES.length >= 2);
    assert.equal(
      CODE_DELIVERY_GOLDEN_QUERIES.length,
      CODE_DELIVERY_DEMO_QUERIES.length + CODE_DELIVERY_PRODUCTION_BUG_QUERIES.length,
    );
  });

  it("chaque cas prod documente un incident", () => {
    for (const scenario of CODE_DELIVERY_PRODUCTION_BUG_QUERIES) {
      assert.equal(scenario.category, GOLDEN_QUERY_CATEGORIES.PRODUCTION_BUG);
      assert.ok(scenario.incident?.length > 10, `incident manquant: ${scenario.id}`);
      assert.ok(scenario.observedAt, `observedAt manquant: ${scenario.id}`);
    }
  });
});

describe("code delivery golden queries — composer & garde-fous", () => {
  it("getComposerSystemPrompt inclut le modificateur pour chaque langage distinct", () => {
    const languages = [...new Set(CODE_DELIVERY_GOLDEN_QUERIES.map((c) => c.language))];
    assert.ok(languages.length >= 6, "couverture multi-langages insuffisante");

    for (const lang of languages) {
      const scenario = CODE_DELIVERY_GOLDEN_QUERIES.find((c) => c.language === lang);
      const prompt = getComposerSystemPrompt({
        user_query: scenario.query,
        risk_level: "low",
      });
      assert.match(prompt, /LIVRAISON CODE MULTI-LANGAGES/, `Composer sans addon pour ${lang}`);
    }
  });

  it("les requêtes golden ne doivent pas être classées comme salutation générique", () => {
    for (const scenario of CODE_DELIVERY_GOLDEN_QUERIES) {
      assert.equal(
        isGenericReadyGreeting(scenario.query),
        false,
        `Requête golden traitée comme salutation: ${scenario.id}`,
      );
    }
  });
});

const LIVE_ENABLED = process.env.CODE_DELIVERY_LIVE === "1";

(LIVE_ENABLED ? describe : describe.skip)(
  "code delivery golden queries — régression conversationnelle live (CODE_DELIVERY_LIVE=1)",
  () => {
    it("importe agent uniquement en mode live", async () => {
      const { default: agent } = await import("../src/agent/agent.js");
      assert.ok(typeof agent.run === "function");
    });

    for (const scenario of CODE_DELIVERY_GOLDEN_QUERIES) {
      it(`[live:${scenario.id}] ${scenario.label}`, async () => {
        const { default: agent } = await import("../src/agent/agent.js");
        const streamed = [];
        const response = await agent.run(scenario.query, [], {
          onContent: (token) => streamed.push(token),
        });

        assert.ok(response && response.trim().length > 80, `Réponse trop courte: ${response}`);
        assert.ok(
          includesNone(response, scenario.responseForbidden),
          `[${scenario.id}] Réponse contaminée: ${response.slice(0, 500)}`,
        );

        const markerHits = CODE_DELIVERY_SECTION_MARKERS.filter((m) =>
          response.includes(m),
        ).length;
        assert.ok(
          markerHits >= 3,
          `[${scenario.id}] Structure insuffisante (${markerHits}/5 marqueurs): ${response.slice(0, 400)}`,
        );

        assert.ok(
          includesAll(response, scenario.responseMustInclude.slice(0, Math.min(3, scenario.responseMustInclude.length))),
          `[${scenario.id}] Contenu attendu absent: ${response.slice(0, 500)}`,
        );

        const sentinelEval = evaluateCodeDeliverySentinels(response, scenario);
        assert.equal(
          sentinelEval.pass,
          true,
          `[${scenario.id}] sentinelles live: ${JSON.stringify(sentinelEval.failures)}`,
        );

        assert.equal(streamed.join(""), response);
      });
    }
  },
);
