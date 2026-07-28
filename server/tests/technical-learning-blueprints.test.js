import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  TECHNICAL_LEARNING_BLUEPRINTS,
  normalizeTechnicalLearningTarget,
  resolveTechnicalLearningBlueprint,
  hasDedicatedTechnicalLearningBlueprint,
} from "../src/agent/micro/replies/technicalLearningBlueprints.js";
import {
  buildTechnicalLearningPathOutlineFallback,
  resolveTechnicalLearningPathLocalFallback,
  buildTechnicalLearningPathSystemAddonFromSlots,
} from "../src/agent/micro/replies/technicalLearningPathComposer.js";
import { parseTechnicalLearningPath } from "../src/agent/utils/technicalLearningPathIntentGuards.js";

const GENERIC_MARKER = /Mécanismes clés/i;

const STACK_CASES = [
  {
    id: "html",
    query: "je veux créer des fiches de connaissances afin maitriser le html",
    module1: /Structure du document/i,
    hint: /structure document, sémantique/i,
  },
  {
    id: "css",
    query:
      "je veux créer des fiches de connaissances afin maitriser le css et ses règles",
    module1: /Syntaxe, sélecteurs et unités/i,
    hint: /cascade, spécificité/i,
  },
  {
    id: "javascript",
    query:
      "je veux créer des fiches de connaissances afin maitriser javascript",
    module1: /Syntaxe et types/i,
    hint: /closures, collections/i,
  },
  {
    id: "tailwind",
    query:
      "je veux créer des fiches de connaissances afin maitriser tailwind",
    module1: /Philosophie utility-first/i,
    hint: /utility-first/i,
  },
  {
    id: "python",
    query: "je veux créer des fiches de connaissances afin maitriser python",
    module1: /Syntaxe et structures de base/i,
    hint: /structures de données, fonctions/i,
  },
  {
    id: "jsx",
    query:
      "je veux créer des fiches de connaissances afin maitriser le jsx et ses règles",
    module1: /Rôle et syntaxe JSX/i,
    hint: /fragments, rendu conditionnel/i,
  },
  {
    id: "typescript",
    query:
      "je veux créer des fiches de connaissances afin maitriser typescript",
    module1: /Types de base et inférence/i,
    hint: /generics, narrowing/i,
  },
  {
    id: "react",
    query: "je veux créer des fiches de connaissances afin maitriser react",
    module1: /Composants et props/i,
    hint: /hooks, composition/i,
  },
  {
    id: "sql",
    query: "je veux créer des fiches de connaissances afin maitriser sql",
    module1: /SELECT, filtrage et tri/i,
    hint: /JOIN, agrégations/i,
  },
  {
    id: "docker",
    query: "je veux créer des fiches de connaissances afin maitriser docker",
    module1: /Images, conteneurs et modèle mental/i,
    hint: /Dockerfile, build\/layers, volumes/i,
  },
  {
    id: "git",
    query: "je veux créer des fiches de connaissances afin maitriser git",
    module1: /Dépôt, commits et historique/i,
    hint: /branches, remote/i,
  },
  {
    id: "nodejs",
    query: "je veux créer des fiches de connaissances afin maitriser nodejs",
    module1: /Runtime Node vs navigateur/i,
    hint: /npm, fs\/path, HTTP/i,
  },
  {
    id: "express",
    query: "je veux créer des fiches de connaissances afin maitriser express",
    module1: /App Express et routing HTTP/i,
    hint: /middleware, Router/i,
  },
  {
    id: "fastify",
    query: "je veux créer des fiches de connaissances afin maitriser fastify",
    module1: /Fastify vs Express et modèle mental/i,
    hint: /JSON Schema, plugins/i,
  },
];

describe("technicalLearningBlueprints — registre unifié", () => {
  it("contient les blueprints dédiés attendus", () => {
    const ids = TECHNICAL_LEARNING_BLUEPRINTS.map((bp) => bp.id);
    assert.deepEqual(
      ids.sort(),
      [
        "css",
        "docker",
        "express",
        "fastify",
        "git",
        "html",
        "javascript",
        "jsx",
        "jvm_javascript",
        "nodejs",
        "python",
        "react",
        "sql",
        "tailwind",
        "typescript",
      ].sort(),
    );
  });

  for (const stack of STACK_CASES) {
    it(`${stack.id} → blueprint dédié, jamais fallback générique`, () => {
      const slots = parseTechnicalLearningPath(stack.query);
      const blueprintId = normalizeTechnicalLearningTarget(stack.query, slots);
      assert.equal(blueprintId, stack.id);
      assert.equal(hasDedicatedTechnicalLearningBlueprint(stack.id), true);

      const blueprint = resolveTechnicalLearningBlueprint(stack.query, slots);
      assert.ok(blueprint);
      assert.ok(blueprint.modules.length >= 4);

      const fallback = resolveTechnicalLearningPathLocalFallback(stack.query);
      assert.ok(fallback);
      assert.match(fallback, stack.module1);
      assert.doesNotMatch(fallback, GENERIC_MARKER);

      const addon = buildTechnicalLearningPathSystemAddonFromSlots(slots);
      assert.match(addon, /BLUEPRINT DÉDIÉ/i);
      assert.match(addon, stack.hint);
    });
  }

  it("alias js / ecmascript → javascript", () => {
    assert.equal(
      normalizeTechnicalLearningTarget("maitriser js avec des fiches"),
      "javascript",
    );
    assert.equal(
      normalizeTechnicalLearningTarget("fiches pour ecmascript"),
      "javascript",
    );
  });

  it("jsx explicite prioritaire sur react", () => {
    const q = "fiches pour react jsx et ses regles";
    assert.equal(normalizeTechnicalLearningTarget(q), "jsx");
  });

  it("Node.js prioritaire sur JavaScript quand le runtime est visé", () => {
    const nodeQ = "je veux créer des fiches de connaissances afin maitriser nodejs";
    const jsQ = "je veux créer des fiches de connaissances afin maitriser javascript";

    assert.equal(normalizeTechnicalLearningTarget(nodeQ), "nodejs");
    assert.equal(normalizeTechnicalLearningTarget(jsQ), "javascript");

    const nodeFallback = resolveTechnicalLearningPathLocalFallback(nodeQ);
    const jsFallback = resolveTechnicalLearningPathLocalFallback(jsQ);

    assert.match(nodeFallback, /Runtime Node vs navigateur/i);
    assert.match(nodeFallback, /npm/i);
    assert.doesNotMatch(nodeFallback, /DOM et événements/i);

    assert.match(jsFallback, /Syntaxe et types/i);
    assert.match(jsFallback, /DOM et événements/i);
    assert.doesNotMatch(jsFallback, /Runtime Node vs navigateur/i);
  });

  it("apprendre node → blueprint Node.js (formulation courte)", () => {
    assert.equal(normalizeTechnicalLearningTarget("apprendre node"), "nodejs");
  });

  it("plan d apprentissage React → blueprint React (pas JSX)", () => {
    const q = "je veux un plan d apprentissage pour React en profondeur";
    const slots = parseTechnicalLearningPath(q);
    assert.equal(normalizeTechnicalLearningTarget(q, slots), "react");
    const fallback = resolveTechnicalLearningPathLocalFallback(q);
    assert.ok(fallback);
    assert.match(fallback, /Composants et props/i);
    assert.doesNotMatch(fallback, GENERIC_MARKER);
  });

  it("JVM+JS hybride → jvm_javascript avant javascript", () => {
    const q =
      "je veux créer des fiches de connaissances afin maitriser la jvm pour javascript";
    const slots = parseTechnicalLearningPath(q);
    assert.equal(normalizeTechnicalLearningTarget(q, slots), "jvm_javascript");
    const fallback = buildTechnicalLearningPathOutlineFallback(q, slots);
    assert.match(fallback, /GraalVM/i);
    assert.doesNotMatch(fallback, GENERIC_MARKER);
  });

  it("stack inconnue → fallback générique propre", () => {
    const q =
      "je veux créer des fiches de connaissances afin maitriser protobuf";
    const slots = parseTechnicalLearningPath(q);
    assert.equal(normalizeTechnicalLearningTarget(q, slots), null);
    assert.equal(resolveTechnicalLearningBlueprint(q, slots), null);

    const fallback = buildTechnicalLearningPathOutlineFallback(q, slots);
    assert.ok(fallback);
    assert.match(fallback, GENERIC_MARKER);
    assert.match(fallback, /Socle et vocabulaire/i);
  });
});
