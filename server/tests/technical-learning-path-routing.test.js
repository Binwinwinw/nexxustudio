import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isTechnicalLearningPathRequest,
  isJvmJavaScriptHybridLearningTopic,
  parseTechnicalLearningPath,
  extractLearningDomain,
  extractTargetStack,
} from "../src/agent/utils/technicalLearningPathIntentGuards.js";
import {
  resolveTechnicalLearningPathShortCircuit,
  resolveTechnicalLearningPathLocalFallback,
  resolveCssLearningPathLocalFallback,
  isCssLearningTopic,
} from "../src/agent/micro/replies/technicalLearningPathComposer.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { isTechnicalOverviewRequest } from "../src/agent/utils/technicalOverviewIntentGuards.js";
import { shouldDeferShortCircuitToFullPipeline } from "../src/agent/policies/routing/practicalAdviceRoutingGuard.js";

describe("technicalLearningPath — lot 12 / regression JVM", () => {
  const JVM_QUERY =
    "je veux créer des fiches de connaissances afin maitriser la jvm pour javascript";

  it("fiches JVM pour JavaScript → technical_learning_path (pas technical_overview)", async () => {
    assert.equal(isTechnicalLearningPathRequest(JVM_QUERY), true);
    assert.equal(isTechnicalOverviewRequest(JVM_QUERY), false);
    assert.match(extractLearningDomain(JVM_QUERY) || "", /jvm/i);
    assert.match(extractTargetStack(JVM_QUERY) || "", /javascript/i);

    const slots = parseTechnicalLearningPath(JVM_QUERY);
    assert.equal(slots?.deliverable, "knowledge_sheets");
    assert.equal(slots?.goal, "mastery");

    const hit = await runConversationShortCircuit(JVM_QUERY);
    assert.equal(hit?.path, "technical_learning_path");
    assert.equal(hit?.technicalLearningPath, true);
    assert.ok(hit?.reply, "réponse blueprint déterministe attendue");
    assert.equal(hit?.deferToLlm, undefined);
  });

  it("explique Redis reste technical_overview", () => {
    const q = "explique Redis";
    assert.equal(isTechnicalLearningPathRequest(q), false);
    assert.equal(isTechnicalOverviewRequest(q), true);
  });

  it("plan d'apprentissage React", () => {
    const q = "je veux un plan d apprentissage pour React en profondeur";
    assert.equal(isTechnicalLearningPathRequest(q), true);
    assert.equal(parseTechnicalLearningPath(q)?.deliverable, "roadmap");

    const fallback = resolveTechnicalLearningPathLocalFallback(q);
    assert.ok(fallback);
    assert.match(fallback, /Composants et props/i);
    assert.doesNotMatch(fallback, /Mécanismes clés/i);
  });

  it("pas de defer orchestrateur — livraison blueprint locale", () => {
    const hit = resolveTechnicalLearningPathShortCircuit(JVM_QUERY);
    assert.equal(shouldDeferShortCircuitToFullPipeline(hit, JVM_QUERY), false);
    assert.ok(hit?.reply);
    assert.match(hit.reply, /JavaScript sur la JVM \(GraalVM \/ héritage Nashorn\)/i);
    assert.match(hit.reply, /Module 1 — Cartographie JVM et JavaScript/i);
    assert.doesNotMatch(hit.reply, /Plan local structuré/i);
  });

  it("fiches JVM+JS → reformulation GraalVM + plan dédié", () => {
    assert.equal(isJvmJavaScriptHybridLearningTopic(JVM_QUERY), true);

    const fallback = resolveTechnicalLearningPathLocalFallback(JVM_QUERY);
    assert.ok(fallback);
    assert.match(fallback, /JavaScript sur la JVM \(GraalVM \/ héritage Nashorn\)/i);
    assert.match(fallback, /Recadrage/i);
    assert.match(fallback, /Module 1 — Cartographie JVM et JavaScript/i);
    assert.match(fallback, /GraalVM JavaScript/i);
    assert.match(fallback, /Migration Nashorn/i);
  });

  it("fiches JSX → technical_learning_path + fallback structuré", () => {
    const q =
      "je veux créer des fiches de connaissances afin maitriser le JSX et ses règles";
    assert.equal(isTechnicalLearningPathRequest(q), true);
    assert.equal(isTechnicalOverviewRequest(q), false);
    assert.match(extractLearningDomain(q) || "", /jsx/i);

    const fallback = resolveTechnicalLearningPathLocalFallback(q);
    assert.ok(fallback);
    assert.match(fallback, /Module 1 — Rôle et syntaxe JSX/i);
    assert.match(fallback, /interpolation/i);
  });

  it("fiches CSS → technical_learning_path + fallback cascade/layout", () => {
    const q =
      "je veux créer des fiches de connaissances afin maitriser le css et ses règles";
    assert.equal(isTechnicalLearningPathRequest(q), true);
    assert.equal(isTechnicalOverviewRequest(q), false);
    assert.equal(isCssLearningTopic(q, parseTechnicalLearningPath(q)), true);
    assert.match(extractLearningDomain(q) || "", /css/i);

    const fallback = resolveCssLearningPathLocalFallback(q);
    assert.ok(fallback);
    assert.match(fallback, /Tu veux \*\*maîtriser CSS\*\*/i);
    assert.match(fallback, /Module 1 — Syntaxe, sélecteurs et unités/i);
    assert.match(fallback, /Module 2 — Cascade, héritage et spécificité/i);
    assert.match(fallback, /Flexbox et Grid/i);
    assert.match(fallback, /Responsive design/i);
    assert.match(fallback, /DevTools/i);
    assert.doesNotMatch(fallback, /Mécanismes clés/i);

    const hit = resolveTechnicalLearningPathShortCircuit(q);
    assert.ok(hit?.reply);
    assert.match(hit.reply, /Cascade, héritage et spécificité/i);
  });

  it("fiches de révisions HTML — présentation lisible + contrat de forme", async () => {
    const q =
      "creer des fiches de revisions afin maitriser le html et ses regles";
    assert.equal(isTechnicalLearningPathRequest(q), true);

    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "technical_learning_path");
    assert.ok(hit?.reply);

    const { meetsTechnicalLearningPathPresentationContract } = await import(
      "../src/agent/micro/replies/technicalLearningPathComposer.js"
    );
    assert.equal(meetsTechnicalLearningPathPresentationContract(hit.reply), true);
    assert.match(hit.reply, /Structure du document/i);
    assert.match(hit.reply, /\*\*En bref\*\*/);
    assert.match(hit.reply, /\*\*Comment avancer\*\*/);
    assert.doesNotMatch(hit.reply, /Mécanismes clés/i);
    assert.doesNotMatch(hit.reply, /Plan local structuré/i);
  });

  it("HTML pilote — mini-questions sous Auto-vérification (recommandé)", async () => {
    const { meetsTechnicalLearningPathPresentationContract } = await import(
      "../src/agent/micro/replies/technicalLearningPathComposer.js"
    );
    const q =
      "creer des fiches de revisions afin maitriser le html et ses regles";

    const hit = await runConversationShortCircuit(q);
    assert.ok(hit?.reply);
    assert.equal(meetsTechnicalLearningPathPresentationContract(hit.reply), true);
    assert.match(hit.reply, /\*\*Pour te tester\*\*/);
    assert.match(hit.reply, /Quelle différence entre `<section>` et `<article>` \?/);
    assert.match(hit.reply, /Quand faut-il utiliser un tableau plutôt qu'une liste \?/);

    const moduleBlocks = hit.reply.split(/^## Module /m).slice(1);
    assert.equal(moduleBlocks.length, 6);
    for (const block of moduleBlocks) {
      const testSection = block.split("**Pour te tester**")[1]?.trim() || "";
      const questionCount = (testSection.match(/^\d+\./gm) || []).length;
      assert.ok(questionCount >= 1 && questionCount <= 2);
    }
  });

  it("CSS lot 2 — mini-questions sous Auto-vérification (recommandé)", async () => {
    const { meetsTechnicalLearningPathPresentationContract } = await import(
      "../src/agent/micro/replies/technicalLearningPathComposer.js"
    );
    const q =
      "je veux créer des fiches de connaissances afin maitriser le css et ses regles";

    const hit = await runConversationShortCircuit(q);
    assert.ok(hit?.reply);
    assert.equal(meetsTechnicalLearningPathPresentationContract(hit.reply), true);
    assert.match(hit.reply, /\*\*Pour te tester\*\*/);
    assert.match(hit.reply, /Quelle différence entre héritage et cascade \?/);
    assert.match(hit.reply, /Quand choisir Flexbox plutôt que Grid pour une mise en page \?/);

    const moduleBlocks = hit.reply.split(/^## Module /m).slice(1);
    assert.equal(moduleBlocks.length, 6);
    for (const block of moduleBlocks) {
      const testSection = block.split("**Pour te tester**")[1]?.trim() || "";
      const questionCount = (testSection.match(/^\d+\./gm) || []).length;
      assert.ok(questionCount >= 1 && questionCount <= 2);
    }
  });

  it("JavaScript lot 3 — mini-questions concrètes, vérifiables en console (recommandé)", async () => {
    const { meetsTechnicalLearningPathPresentationContract } = await import(
      "../src/agent/micro/replies/technicalLearningPathComposer.js"
    );
    const q =
      "je veux créer des fiches de connaissances afin maitriser javascript";

    const hit = await runConversationShortCircuit(q);
    assert.ok(hit?.reply);
    assert.equal(meetsTechnicalLearningPathPresentationContract(hit.reply), true);
    assert.match(hit.reply, /\*\*Pour te tester\*\*/);
    assert.match(hit.reply, /Quelle différence entre `let` et `const`/);
    assert.match(hit.reply, /Quelle différence entre `map` et `forEach`/);
    assert.match(hit.reply, /quel ordre s'affiche \?/i);

    const moduleBlocks = hit.reply.split(/^## Module /m).slice(1);
    assert.equal(moduleBlocks.length, 6);
    for (const block of moduleBlocks) {
      const testSection = block.split("**Pour te tester**")[1]?.trim() || "";
      const questionCount = (testSection.match(/^\d+\./gm) || []).length;
      assert.ok(questionCount >= 1 && questionCount <= 2);
    }
  });

  it("React lot 4 — mini-questions modèle mental framework (recommandé)", async () => {
    const { meetsTechnicalLearningPathPresentationContract } = await import(
      "../src/agent/micro/replies/technicalLearningPathComposer.js"
    );
    const q = "je veux créer des fiches de connaissances afin maitriser react";

    const hit = await runConversationShortCircuit(q);
    assert.ok(hit?.reply);
    assert.equal(meetsTechnicalLearningPathPresentationContract(hit.reply), true);
    assert.match(hit.reply, /\*\*Pour te tester\*\*/);
    assert.match(hit.reply, /Quelle différence entre une prop et un state/);
    assert.match(hit.reply, /re-render et un remount/);
    assert.match(hit.reply, /index du tableau comme `key`/);

    const moduleBlocks = hit.reply.split(/^## Module /m).slice(1);
    assert.equal(moduleBlocks.length, 6);
    for (const block of moduleBlocks) {
      const testSection = block.split("**Pour te tester**")[1]?.trim() || "";
      const questionCount = (testSection.match(/^\d+\./gm) || []).length;
      assert.ok(questionCount >= 1 && questionCount <= 2);
    }
  });

  it("Node.js lot 5 — mini-questions runtime et environnement (recommandé)", async () => {
    const { meetsTechnicalLearningPathPresentationContract } = await import(
      "../src/agent/micro/replies/technicalLearningPathComposer.js"
    );
    const q =
      "je veux créer des fiches de connaissances afin maitriser nodejs";

    const hit = await runConversationShortCircuit(q);
    assert.ok(hit?.reply);
    assert.equal(meetsTechnicalLearningPathPresentationContract(hit.reply), true);
    assert.match(hit.reply, /\*\*Pour te tester\*\*/);
    assert.match(hit.reply, /`document` ou `window`/);
    assert.match(hit.reply, /port occupé/);
    assert.match(hit.reply, /`path\.join\(\)`/);

    const moduleBlocks = hit.reply.split(/^## Module /m).slice(1);
    assert.equal(moduleBlocks.length, 6);
    for (const block of moduleBlocks) {
      const testSection = block.split("**Pour te tester**")[1]?.trim() || "";
      const questionCount = (testSection.match(/^\d+\./gm) || []).length;
      assert.ok(questionCount >= 1 && questionCount <= 2);
    }
  });

  it("TypeScript lot 7 — mini-questions types vs valeurs (recommandé)", async () => {
    const { meetsTechnicalLearningPathPresentationContract } = await import(
      "../src/agent/micro/replies/technicalLearningPathComposer.js"
    );
    const q =
      "je veux créer des fiches de connaissances afin maitriser typescript";

    const hit = await runConversationShortCircuit(q);
    assert.ok(hit?.reply);
    assert.equal(meetsTechnicalLearningPathPresentationContract(hit.reply), true);
    assert.match(hit.reply, /\*\*Pour te tester\*\*/);
    assert.match(hit.reply, /`any` et `unknown`/);
    assert.match(hit.reply, /union `A \| B`/);
    assert.match(hit.reply, /union discriminée/);

    const moduleBlocks = hit.reply.split(/^## Module /m).slice(1);
    assert.equal(moduleBlocks.length, 6);
    for (const block of moduleBlocks) {
      const testSection = block.split("**Pour te tester**")[1]?.trim() || "";
      const questionCount = (testSection.match(/^\d+\./gm) || []).length;
      assert.ok(questionCount >= 1 && questionCount <= 2);
    }
  });

  it("SQL lot 8 — mini-questions opératoires sur petites tables (recommandé)", async () => {
    const { meetsTechnicalLearningPathPresentationContract } = await import(
      "../src/agent/micro/replies/technicalLearningPathComposer.js"
    );
    const q =
      "je veux créer des fiches de connaissances afin maitriser sql";

    const hit = await runConversationShortCircuit(q);
    assert.ok(hit?.reply);
    assert.equal(meetsTechnicalLearningPathPresentationContract(hit.reply), true);
    assert.match(hit.reply, /\*\*Pour te tester\*\*/);
    assert.match(hit.reply, /WHERE filtre-t-il avant ou après le GROUP BY \?/);
    assert.match(hit.reply, /LEFT JOIN si aucune ligne ne correspond/);
    assert.match(hit.reply, /DELETE et TRUNCATE/);

    const moduleBlocks = hit.reply.split(/^## Module /m).slice(1);
    assert.equal(moduleBlocks.length, 6);
    for (const block of moduleBlocks) {
      const testSection = block.split("**Pour te tester**")[1]?.trim() || "";
      const questionCount = (testSection.match(/^\d+\./gm) || []).length;
      assert.ok(questionCount >= 1 && questionCount <= 2);
    }
  });

  it("Express + Fastify lot 6 — frameworks HTTP Node (recommandé)", async () => {
    const { meetsTechnicalLearningPathPresentationContract } = await import(
      "../src/agent/micro/replies/technicalLearningPathComposer.js"
    );

    const expressQ =
      "je veux créer des fiches de connaissances afin maitriser express";
    const fastifyQ =
      "je veux créer des fiches de connaissances afin maitriser fastify";

    const expressHit = await runConversationShortCircuit(expressQ);
    const fastifyHit = await runConversationShortCircuit(fastifyQ);

    for (const hit of [expressHit, fastifyHit]) {
      assert.equal(hit?.path, "technical_learning_path");
      assert.ok(hit?.reply);
      assert.equal(meetsTechnicalLearningPathPresentationContract(hit.reply), true);
      assert.match(hit.reply, /\*\*Pour te tester\*\*/);
    }

    assert.match(expressHit.reply, /`req\.params`, `req\.query` et `req\.body`/);
    assert.match(expressHit.reply, /appeler `next\(\)`/);
    assert.match(expressHit.reply, /handler `async`/);

    assert.match(fastifyHit.reply, /schema-first/);
    assert.match(fastifyHit.reply, /`fastify\.register\(\)`/);
    assert.match(fastifyHit.reply, /Dans quel hook placer une vérification d'auth/);

    for (const reply of [expressHit.reply, fastifyHit.reply]) {
      const moduleBlocks = reply.split(/^## Module /m).slice(1);
      assert.equal(moduleBlocks.length, 6);
      for (const block of moduleBlocks) {
        const testSection = block.split("**Pour te tester**")[1]?.trim() || "";
        const questionCount = (testSection.match(/^\d+\./gm) || []).length;
        assert.ok(questionCount >= 1 && questionCount <= 2);
      }
    }
  });

  it("Python lot 11 — mini-questions langage généraliste (recommandé)", async () => {
    const { meetsTechnicalLearningPathPresentationContract } = await import(
      "../src/agent/micro/replies/technicalLearningPathComposer.js"
    );
    const q =
      "je veux créer des fiches de connaissances afin maitriser python";

    const hit = await runConversationShortCircuit(q);
    assert.ok(hit?.reply);
    assert.equal(meetsTechnicalLearningPathPresentationContract(hit.reply), true);
    assert.match(hit.reply, /\*\*Pour te tester\*\*/);
    assert.match(hit.reply, /list et un tuple/);
    assert.match(hit.reply, /`def f\(items=\[\]\)`/);
    assert.match(hit.reply, /virtualenv \(venv\)/);

    const moduleBlocks = hit.reply.split(/^## Module /m).slice(1);
    assert.equal(moduleBlocks.length, 6);
    for (const block of moduleBlocks) {
      const testSection = block.split("**Pour te tester**")[1]?.trim() || "";
      const questionCount = (testSection.match(/^\d+\./gm) || []).length;
      assert.ok(questionCount >= 1 && questionCount <= 2);
    }
  });

  it("JVM+JS lot 14 — runtime Java ↔ JS (recommandé)", async () => {
    const { meetsTechnicalLearningPathPresentationContract } = await import(
      "../src/agent/micro/replies/technicalLearningPathComposer.js"
    );
    const q = JVM_QUERY;

    const hit = await runConversationShortCircuit(q);
    assert.ok(hit?.reply);
    assert.equal(meetsTechnicalLearningPathPresentationContract(hit.reply), true);
    assert.match(hit.reply, /\*\*Pour te tester\*\*/);
    assert.match(hit.reply, /JavaScript sur la JVM/);
    assert.match(hit.reply, /Node\.js et avec GraalVM/);
    assert.match(hit.reply, /Nashorn/);
    assert.match(hit.reply, /contexte polyglot GraalVM/);

    const moduleBlocks = hit.reply.split(/^## Module /m).slice(1);
    assert.equal(moduleBlocks.length, 6);
    for (const block of moduleBlocks) {
      const testSection = block.split("**Pour te tester**")[1]?.trim() || "";
      const questionCount = (testSection.match(/^\d+\./gm) || []).length;
      assert.ok(questionCount >= 1 && questionCount <= 2);
    }
  });

  it("JSX lot 13 — syntaxe et rendu (recommandé)", async () => {
    const { meetsTechnicalLearningPathPresentationContract } = await import(
      "../src/agent/micro/replies/technicalLearningPathComposer.js"
    );
    const q =
      "je veux créer des fiches de connaissances afin maitriser jsx";

    const hit = await runConversationShortCircuit(q);
    assert.ok(hit?.reply);
    assert.equal(meetsTechnicalLearningPathPresentationContract(hit.reply), true);
    assert.match(hit.reply, /\*\*Pour te tester\*\*/);
    assert.match(hit.reply, /`<div>` et `<Card>`/);
    assert.match(hit.reply, /`{{ margin: 8 }}`/);
    assert.match(hit.reply, /`className` remplace `class`/);

    const moduleBlocks = hit.reply.split(/^## Module /m).slice(1);
    assert.equal(moduleBlocks.length, 6);
    for (const block of moduleBlocks) {
      const testSection = block.split("**Pour te tester**")[1]?.trim() || "";
      const questionCount = (testSection.match(/^\d+\./gm) || []).length;
      assert.ok(questionCount >= 1 && questionCount <= 2);
    }
  });

  it("Tailwind lot 12 — utility-first (recommandé)", async () => {
    const { meetsTechnicalLearningPathPresentationContract } = await import(
      "../src/agent/micro/replies/technicalLearningPathComposer.js"
    );
    const q =
      "je veux créer des fiches de connaissances afin maitriser tailwind";

    const hit = await runConversationShortCircuit(q);
    assert.ok(hit?.reply);
    assert.equal(meetsTechnicalLearningPathPresentationContract(hit.reply), true);
    assert.match(hit.reply, /\*\*Pour te tester\*\*/);
    assert.match(hit.reply, /utilities dans le markup/);
    assert.match(hit.reply, /`md:flex`/);
    assert.match(hit.reply, /`@apply`/);
    assert.match(hit.reply, /purge/);

    const moduleBlocks = hit.reply.split(/^## Module /m).slice(1);
    assert.equal(moduleBlocks.length, 6);
    for (const block of moduleBlocks) {
      const testSection = block.split("**Pour te tester**")[1]?.trim() || "";
      const questionCount = (testSection.match(/^\d+\./gm) || []).length;
      assert.ok(questionCount >= 1 && questionCount <= 2);
    }
  });

  it("Docker + Git lots 9–10 — ops concrètes (recommandé)", async () => {
    const { meetsTechnicalLearningPathPresentationContract } = await import(
      "../src/agent/micro/replies/technicalLearningPathComposer.js"
    );

    const dockerQ =
      "je veux créer des fiches de connaissances afin maitriser docker";
    const gitQ =
      "je veux créer des fiches de connaissances afin maitriser git";

    const dockerHit = await runConversationShortCircuit(dockerQ);
    const gitHit = await runConversationShortCircuit(gitQ);

    for (const hit of [dockerHit, gitHit]) {
      assert.equal(hit?.path, "technical_learning_path");
      assert.ok(hit?.reply);
      assert.equal(meetsTechnicalLearningPathPresentationContract(hit.reply), true);
      assert.match(hit.reply, /\*\*Pour te tester\*\*/);
    }

    assert.match(dockerHit.reply, /image Docker et un conteneur/);
    assert.match(dockerHit.reply, /bind mount et un volume nommé/);
    assert.match(dockerHit.reply, /EXPOSE dans un Dockerfile/);

    assert.match(gitHit.reply, /`git fetch` et `git pull`/);
    assert.match(gitHit.reply, /merge et rebase/);
    assert.match(gitHit.reply, /`git revert` et `git reset --hard`/);

    for (const reply of [dockerHit.reply, gitHit.reply]) {
      const moduleBlocks = reply.split(/^## Module /m).slice(1);
      assert.equal(moduleBlocks.length, 6);
      for (const block of moduleBlocks) {
        const testSection = block.split("**Pour te tester**")[1]?.trim() || "";
        const questionCount = (testSection.match(/^\d+\./gm) || []).length;
        assert.ok(questionCount >= 1 && questionCount <= 2);
      }
    }
  });

  it("15/15 stacks — Pour te tester sur chaque blueprint", async () => {
    const queries = [
      "creer des fiches de revisions afin maitriser le html et ses regles",
      "je veux créer des fiches de connaissances afin maitriser le css et ses regles",
      "je veux créer des fiches de connaissances afin maitriser javascript",
      "je veux créer des fiches de connaissances afin maitriser nodejs",
      "je veux créer des fiches de connaissances afin maitriser express",
      "je veux créer des fiches de connaissances afin maitriser fastify",
      "je veux créer des fiches de connaissances afin maitriser typescript",
      "je veux créer des fiches de connaissances afin maitriser react",
      "je veux créer des fiches de connaissances afin maitriser tailwind",
      "je veux créer des fiches de connaissances afin maitriser python",
      "je veux créer des fiches de connaissances afin maitriser sql",
      "je veux créer des fiches de connaissances afin maitriser docker",
      "je veux créer des fiches de connaissances afin maitriser git",
      "je veux créer des fiches de connaissances afin maitriser jsx",
      JVM_QUERY,
    ];

    for (const q of queries) {
      const hit = await runConversationShortCircuit(q);
      assert.ok(hit?.reply, q);
      assert.match(hit.reply, /\*\*Pour te tester\*\*/, q);
    }
  });

  it("React / JSX — même canal déterministe + frontière linguistique", async () => {
    const { meetsTechnicalLearningPathPresentationContract } = await import(
      "../src/agent/micro/replies/technicalLearningPathComposer.js"
    );

    const reactQ = "je veux créer des fiches de connaissances afin maitriser react";
    const jsxQ =
      "je veux créer des fiches de connaissances afin maitriser le jsx et ses regles";
    const compositeQ = "fiches pour maitriser react et jsx";

    const reactHit = await runConversationShortCircuit(reactQ);
    const jsxHit = await runConversationShortCircuit(jsxQ);
    const compositeHit = await runConversationShortCircuit(compositeQ);

    for (const hit of [reactHit, jsxHit, compositeHit]) {
      assert.equal(hit?.path, "technical_learning_path");
      assert.ok(hit?.reply);
      assert.equal(meetsTechnicalLearningPathPresentationContract(hit.reply), true);
      assert.doesNotMatch(hit.reply, /Plan local structuré/i);
    }

    assert.match(reactHit.reply, /Composants et props/i);
    assert.doesNotMatch(reactHit.reply, /Rôle et syntaxe JSX/i);

    assert.match(jsxHit.reply, /Rôle et syntaxe JSX/i);
    assert.doesNotMatch(jsxHit.reply, /Composants et props/i);

    assert.match(compositeHit.reply, /Rôle et syntaxe JSX/i);
    assert.doesNotMatch(compositeHit.reply, /Composants et props/i);
  });
});
