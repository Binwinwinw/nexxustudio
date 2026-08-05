import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  suppressesBuildIntentForTechnicalLearning,
  isTechnicalLearningPathRequest,
} from "../src/agent/utils/technicalLearningPathIntentGuards.js";
import { isHtmlProjectDeliverable } from "../src/agent/policies/delivery/index.js";
import {
  evaluateJustIntent,
  buildJustIntentAddon,
} from "../src/agent/policies/intent/justIntentDetectionPolicy.js";
import {
  INTENT_DOMAINS,
  INTENT_ACTIONS,
  DELIVERABLE_TYPES,
} from "../../shared/justIntentCatalog.js";
import { formatJustIntentSummary } from "../../shared/justIntentCatalog.js";
import { resolveTechnicalLearningPathLocalFallback } from "../src/agent/micro/replies/technicalLearningPathComposer.js";

const LEARN_CASES = [
  {
    label: "créer fiches révisions HTML",
    query:
      "creer des fiches de revisions afin maitriser le html et ses regles",
    stack: /Structure du document/i,
  },
  {
    label: "générer fiches JavaScript",
    query: "generer des fiches pour maitriser javascript",
    stack: /Syntaxe et types/i,
  },
  {
    label: "faire plan révision CSS",
    query: "faire un plan de revision pour le css",
    stack: /Syntaxe, sélecteurs/i,
  },
  {
    label: "préparer fiches cours Python",
    query: "preparer des fiches de cours sur python",
    stack: /Syntaxe et structures de base/i,
  },
  {
    label: "résumé pour apprendre React",
    query: "faire un resume pour apprendre react",
    stack: /Composants et props/i,
  },
  {
    label: "exercices JavaScript",
    query: "generer un exercice sur javascript",
    stack: /Syntaxe et types/i,
  },
  {
    label: "plan pour maîtriser SQL",
    query: "preparer un plan pour maitriser sql",
    stack: /SELECT, filtrage/i,
  },
];

const BUILD_CASES = [
  {
    label: "créer page HTML portfolio",
    query: "creer une page html pour mon portfolio avec header et sections",
  },
  {
    label: "générer script Python utilitaire",
    query: "generer un script python pour parser un csv",
  },
  {
    label: "résumé exécutif sans stack tech",
    query: "generer un resume executif pour la reunion produit",
  },
  {
    label: "dissertation rédactionnelle",
    query: "redige une dissertation sur l intelligence artificielle",
  },
];

describe("technicalLearning — préemption build vs apprentissage", () => {
  for (const item of LEARN_CASES) {
    it(`${item.label} → preempt, pas build`, () => {
      assert.equal(suppressesBuildIntentForTechnicalLearning(item.query), true);
      assert.equal(isTechnicalLearningPathRequest(item.query), true);
      assert.equal(isHtmlProjectDeliverable(item.query), false);

      const ev = evaluateJustIntent(item.query);
      assert.equal(ev.domain, INTENT_DOMAINS.GENERAL);
      assert.equal(ev.action, INTENT_ACTIONS.PLAN);
      assert.equal(ev.deliverable, DELIVERABLE_TYPES.PLAIN_ANSWER);
      assert.ok(ev.signals.includes("preempt:technical_learning_path"));
      assert.doesNotMatch(formatJustIntentSummary(ev), /Page HTML/i);
      assert.doesNotMatch(formatJustIntentSummary(ev), /\bCode\b/);
      assert.equal(buildJustIntentAddon(item.query), "");

      const fallback = resolveTechnicalLearningPathLocalFallback(item.query);
      assert.ok(fallback);
      assert.match(fallback, item.stack);
    });
  }

  for (const item of BUILD_CASES) {
    it(`${item.label} → pas de preempt apprentissage`, () => {
      assert.equal(suppressesBuildIntentForTechnicalLearning(item.query), false);
      assert.doesNotMatch(
        evaluateJustIntent(item.query).signals.join(" "),
        /preempt:technical_learning_path/,
      );
    });
  }

  it("créer page HTML reste web_html/create", () => {
    const q = BUILD_CASES[0].query;
    const ev = evaluateJustIntent(q);
    assert.equal(ev.domain, INTENT_DOMAINS.WEB_HTML);
    assert.equal(ev.action, INTENT_ACTIONS.CREATE);
    assert.equal(ev.deliverable, DELIVERABLE_TYPES.HTML);
  });
});
