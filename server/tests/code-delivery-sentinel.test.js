import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateCodeDeliverySentinels,
  mustNotBeGreeting,
  mustDeliverCode,
  mustRespectRequestedLanguage,
  mustNotAskClarificationWhenSpecSufficient,
  mustIncludeMultiFileStructure,
  SENTINEL_IDS,
} from "../src/agent/policies/code/codeDeliverySentinels.js";
import { GENERIC_READY_GREETING } from "../src/agent/utils/genericGreetingGuards.js";
import {
  CODE_DELIVERY_GOLDEN_QUERIES,
  CODE_DELIVERY_PRODUCTION_BUG_QUERIES,
  GOLDEN_QUERY_CATEGORIES,
} from "./fixtures/codeDeliveryGoldenQueries.js";

describe("codeDeliverySentinels — unitaires", () => {
  it("rejette la salutation générique", () => {
    assert.equal(mustNotBeGreeting(GENERIC_READY_GREETING).pass, false);
    assert.equal(mustNotBeGreeting("✅ Objectif\n```python\nprint(1)\n```").pass, true);
  });

  it("rejette l'absence de code livré", () => {
    assert.equal(mustDeliverCode("✅ Objectif seulement, pas de code.").pass, false);
    assert.equal(
      mustDeliverCode(
        "📋\n```python\ndef ok():\n    return 'livré'\n\nif __name__ == '__main__':\n    print(ok())\n```",
        "python",
      ).pass,
      true,
    );
  });

  it("détecte le mauvais langage", () => {
    const wrong = "```php\n<?php echo 1;\n```";
    assert.equal(mustRespectRequestedLanguage(wrong, "python").pass, false);
    assert.equal(
      mustRespectRequestedLanguage("```python\ndef f(): pass\n```", "python").pass,
      true,
    );
  });

  it("rejette clarification sans livrable sur spec suffisante", () => {
    const query = "Génère un script Python complet pour lire un CSV.";
    const bad = "Peux-tu préciser le format exact attendu ?";
    const good =
      "Voici le code.\n```python\nimport csv\nwith open('f.csv') as f: pass\n```";
    assert.equal(mustNotAskClarificationWhenSpecSufficient(bad, query).pass, false);
    assert.equal(mustNotAskClarificationWhenSpecSufficient(good, query).pass, true);
  });

  it("exige la structure multi-fichiers", () => {
    const single = "```html\n<!DOCTYPE html>\n```";
    const multi = "📁 index.html\n```html\n<!DOCTYPE html>\n```\n📁 style.css\n```css\nbody{}\n```";
    assert.equal(mustIncludeMultiFileStructure(single).pass, false);
    assert.equal(mustIncludeMultiFileStructure(multi).pass, true);
  });
});

describe("codeDeliverySentinels — golden responses", () => {
  for (const scenario of CODE_DELIVERY_GOLDEN_QUERIES) {
    it(`[${scenario.id}] golden passe toutes les sentinelles actives`, () => {
      const evaluation = evaluateCodeDeliverySentinels(scenario.goldenResponse, scenario);
      assert.equal(
        evaluation.pass,
        true,
        `Échecs: ${JSON.stringify(evaluation.failures)}`,
      );
    });
  }
});

describe("codeDeliverySentinels — catégorie production_bug", () => {
  it("contient au moins un cas incident terrain", () => {
    assert.ok(CODE_DELIVERY_PRODUCTION_BUG_QUERIES.length >= 2);
  });

  it("les cas prod couvrent anti-salutation et anti-clarification", () => {
    assert.ok(
      CODE_DELIVERY_PRODUCTION_BUG_QUERIES.some((c) =>
        c.responseForbidden.some((f) => /tout est pr/i.test(f)),
      ),
    );
    assert.ok(
      CODE_DELIVERY_PRODUCTION_BUG_QUERIES.some((c) =>
        c.responseForbidden.some((f) => /peux-tu pr[eé]ciser|il me manque/i.test(f)),
      ),
    );
    assert.ok(
      CODE_DELIVERY_PRODUCTION_BUG_QUERIES.some(
        (c) => c.category === GOLDEN_QUERY_CATEGORIES.PRODUCTION_BUG,
      ),
    );
    assert.ok(
      CODE_DELIVERY_PRODUCTION_BUG_QUERIES.some((c) =>
        (c.incident || "").length > 20,
      ),
    );
  });

  it("rejette une fausse réponse type incident prod (salutation)", () => {
    const scenario = CODE_DELIVERY_PRODUCTION_BUG_QUERIES[0];
    const evaluation = evaluateCodeDeliverySentinels(GENERIC_READY_GREETING, scenario);
    assert.equal(evaluation.pass, false);
    assert.ok(
      evaluation.failures.some((f) => f.id === SENTINEL_IDS.MUST_NOT_BE_GREETING),
    );
  });
});
