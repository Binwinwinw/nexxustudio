/**
 * Contraintes exécutables — docs/agents/intent-families-philosophy.md
 *
 * Chaque principe de la philosophie possède au moins une assertion ici.
 * Si un principe n'a plus de couverture, ce fichier doit échouer en CI.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  INTENT_FAMILIES_V1,
  getIntentFamilyCanonicalMatrixV1,
  validateIntentFamilyRegistryV1,
  resolveIntentFamilyFromRegistry,
} from "../src/agent/policies/intentFamilyRegistry.js";
import {
  TECHNICAL_LEARNING_BLUEPRINTS,
  normalizeTechnicalLearningTarget,
  resolveTechnicalLearningBlueprint,
} from "../src/agent/micro/replies/technicalLearningBlueprints.js";
import {
  parseTechnicalLearningPath,
  suppressesBuildIntentForTechnicalLearning,
} from "../src/agent/utils/technicalLearningPathIntentGuards.js";
import {
  buildTechnicalLearningPathOutlineFallback,
  resolveTechnicalLearningPathLocalFallback,
} from "../src/agent/micro/replies/technicalLearningPathComposer.js";
import {
  evaluateJustIntent,
  buildJustIntentAddon,
} from "../src/agent/policies/justIntentDetectionPolicy.js";
import { isHtmlProjectDeliverable } from "../src/agent/policies/htmlProjectDeliveryPolicy.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import {
  buildConnectorResolutionContext,
  resolveConnectorChain,
  validateConnectorRegistryV1,
} from "../src/agent/policies/connectorRegistry.js";
import {
  INTENT_DOMAINS,
  INTENT_ACTIONS,
  DELIVERABLE_TYPES,
} from "../../shared/justIntentCatalog.js";
import { analyzeRequestIntentFrame } from "../src/agent/policies/requestIntentFrame.js";
import {
  decomposeRequest,
  allWorkUnitsSatisfiable,
  shouldPreemptMultiSegment,
} from "../src/agent/policies/requestDecompositionPolicy.js";
import {
  CLARIFICATION_DECISIONS,
  evaluateClarificationDecision,
} from "../src/agent/policies/clarificationDecisionPolicy.js";
import {
  isMathSimpleSatisfiable,
  MATH_SIMPLE_CANONICAL_FACTORIZE_QUERY,
} from "../src/agent/policies/mathSimplePolicy.js";

const SMOOTHIE_MULTI_UNIT_QUERY =
  "salut salut comment ca va ??? héy j'ai besoin de l'heure, de la date du jour et savoir si tu sais comment on fait un smoothie???";

/** Stacks documentées dans intent-families-philosophy.md § blueprint */
const DOCUMENTED_STACK_IDS = [
  "html",
  "css",
  "javascript",
  "nodejs",
  "typescript",
  "react",
  "jsx",
  "tailwind",
  "python",
  "sql",
  "docker",
  "express",
  "fastify",
  "git",
  "jvm_javascript",
];

const GENERIC_FALLBACK_MARKER = /Mécanismes clés/i;

const LEARN_HTML_QUERY =
  "creer des fiches de revisions afin maitriser le html et ses regles";

const INTENT_FRAME_V1_1_CASES = [
  {
    principle: "technical_learning_path ≠ technical_overview",
    query: "explique Redis",
    expectedFamily: "technical_overview",
  },
  {
    principle: "technical_learning_path ≠ career_learning_path",
    query: "comment devenir développeur web en reconversion",
    expectedFamily: "career_learning_path",
  },
  {
    principle: "learn stack — fiches maîtriser",
    query: LEARN_HTML_QUERY,
    expectedFamily: "technical_learning_path",
  },
];

const PROMISE_BOUNDARY_CASES = [
  {
    principle: "technical_learning_path ≠ technical_overview",
    query: "explique Redis",
    expectedFamily: "technical_overview",
  },
  {
    principle: "technical_learning_path ≠ career_learning_path",
    query: "comment devenir développeur web en reconversion",
    expectedFamily: "career_learning_path",
  },
  {
    principle: "technical_learning_path ≠ debug_diagnostic",
    query: "pourquoi mon Redis crash avec cette erreur ECONNREFUSED",
    expectedFamily: "debug_diagnostic",
  },
  {
    principle: "technical_learning_path ≠ compare_choose",
    query: "Redis vs Memcached que choisir pour un cache session",
    expectedFamily: "compare_choose",
  },
];

const SEMANTIC_PRIORITY_CASES = [
  {
    label: "JVM+JS avant JavaScript",
    query:
      "je veux créer des fiches de connaissances afin maitriser la jvm pour javascript",
    expectedBlueprint: "jvm_javascript",
  },
  {
    label: "JSX avant React",
    query: "fiches pour react jsx et ses regles",
    expectedBlueprint: "jsx",
  },
  {
    label: "Node.js avant JavaScript",
    query: "je veux créer des fiches de connaissances afin maitriser nodejs",
    expectedBlueprint: "nodejs",
  },
  {
    label: "Express avant Node.js",
    query: "fiches pour apprendre express sur node",
    expectedBlueprint: "express",
  },
  {
    label: "Fastify avant Node.js et Express",
    query: "fiches pour apprendre fastify sur node",
    expectedBlueprint: "fastify",
  },
];

const NEGATIVE_GUARD_CASES = [
  {
    label: "résumé exécutif sans stack tech",
    query: "generer un resume executif pour la reunion produit",
    expectPreempt: false,
  },
  {
    label: "dissertation rédactionnelle",
    query: "redige une dissertation sur l intelligence artificielle",
    expectPreempt: false,
    expectDomain: INTENT_DOMAINS.WRITING,
  },
  {
    label: "page HTML portfolio explicite",
    query: "creer une page html pour mon portfolio avec header et sections",
    expectPreempt: false,
    expectDomain: INTENT_DOMAINS.WEB_HTML,
    expectHtmlProject: true,
  },
];

const LEARN_VS_BUILD_OBLIGATORY_CASES = [
  LEARN_HTML_QUERY,
  "generer des fiches pour maitriser javascript",
  "generer un exercice sur javascript",
  "preparer un plan pour maitriser sql",
];

describe("philosophie familles — contraintes exécutables (doc → tests)", () => {
  describe("chaîne de vérité", () => {
    it("famille — registre v1 valide + matrice canonique", () => {
      const report = validateIntentFamilyRegistryV1();
      assert.equal(report.ok, true, report.errors.join("\n"));
      assert.ok(getIntentFamilyCanonicalMatrixV1().length >= 15);
    });

    it("slots — parseTechnicalLearningPath sur requête canonique", () => {
      const slots = parseTechnicalLearningPath(LEARN_HTML_QUERY);
      assert.equal(slots?.intent, "technical_learning_path");
      assert.ok(slots?.domainLabel);
      assert.equal(slots?.goal, "mastery");
    });

    it("blueprint — chaque stack doc a 4–8 modules structurés", () => {
      for (const id of DOCUMENTED_STACK_IDS) {
        const bp = TECHNICAL_LEARNING_BLUEPRINTS.find((entry) => entry.id === id);
        assert.ok(bp, `blueprint manquant pour ${id}`);
        assert.ok(
          bp.modules.length >= 4 && bp.modules.length <= 8,
          `${id}: ${bp.modules.length} modules`,
        );
        for (const mod of bp.modules) {
          assert.ok(mod.title && mod.objective && mod.mastery);
        }
      }
    });

    it("justIntent — preempt aligné, pas web_html/create", async () => {
      const ev = evaluateJustIntent(LEARN_HTML_QUERY);
      assert.notEqual(ev.domain, INTENT_DOMAINS.WEB_HTML);
      assert.ok(ev.signals.includes("preempt:technical_learning_path"));
      assert.equal(buildJustIntentAddon(LEARN_HTML_QUERY), "");

      const hit = await runConversationShortCircuit(LEARN_HTML_QUERY);
      assert.equal(hit?.path, "technical_learning_path");
    });

    it("connector — registre valide + local_deterministic pour technical_learning_path", async () => {
      const connectorReport = validateConnectorRegistryV1();
      assert.equal(connectorReport.ok, true, connectorReport.errors.join("\n"));

      const shortCircuit = await runConversationShortCircuit(LEARN_HTML_QUERY);
      assert.equal(shortCircuit?.path, "technical_learning_path");
      assert.ok(shortCircuit?.reply);

      const resolved = resolveConnectorChain(
        buildConnectorResolutionContext({
          query: LEARN_HTML_QUERY,
          shortCircuit,
          intentFamily: resolveIntentFamilyFromRegistry(LEARN_HTML_QUERY),
          pipelinePath: "technical_learning_path",
        }),
      );
      assert.equal(resolved?.primary?.id, "local_deterministic");
    });
  });

  describe("une promesse = une famille (pas une famille par techno)", () => {
    it("aucune famille registre nommée par stack HTML/CSS/JS…", () => {
      const stackLikeIds = INTENT_FAMILIES_V1.filter((f) =>
        /^(html|css|javascript|nodejs|python|react|docker|git)$/.test(f.id),
      );
      assert.equal(stackLikeIds.length, 0);
    });

    it("toutes les requêtes canoniques stack → couloir technical_learning_path", () => {
      const matrix = getIntentFamilyCanonicalMatrixV1();
      const stackRows = matrix.filter((row) => row.familyId === "technical_learning_path");
      assert.ok(stackRows.length >= DOCUMENTED_STACK_IDS.length);

      for (const row of stackRows) {
        assert.equal(row.expectedPath, "technical_learning_path");
        assert.equal(row.familyId, "technical_learning_path");
      }
    });
  });

  describe("une stack fréquente = un blueprint (couloir unique)", () => {
    it("15 stacks documentées présentes dans le registre", () => {
      const ids = TECHNICAL_LEARNING_BLUEPRINTS.map((bp) => bp.id);
      for (const id of DOCUMENTED_STACK_IDS) {
        assert.ok(ids.includes(id), `stack doc absente du registre: ${id}`);
      }
    });

    it("stack reconnue → jamais fallback générique « Mécanismes clés »", () => {
      for (const id of DOCUMENTED_STACK_IDS) {
        const row = getIntentFamilyCanonicalMatrixV1().find(
          (r) => r.familyId === "technical_learning_path" && r.query.includes(id === "jvm_javascript" ? "jvm" : id.replace("_", "")),
        );
        const query =
          row?.query ||
          `je veux créer des fiches de connaissances afin maitriser ${id === "jvm_javascript" ? "la jvm pour javascript" : id}`;
        const fallback = resolveTechnicalLearningPathLocalFallback(query);
        assert.ok(fallback, `pas de fallback pour ${id}`);
        assert.doesNotMatch(
          fallback,
          GENERIC_FALLBACK_MARKER,
          `fallback générique pour stack documentée ${id}`,
        );
      }
    });

    it("stack inconnue → fallback générique propre autorisé", () => {
      const q =
        "je veux créer des fiches de connaissances afin maitriser protobuf";
      assert.equal(resolveTechnicalLearningBlueprint(q), null);
      const fallback = buildTechnicalLearningPathOutlineFallback(q);
      assert.match(fallback, GENERIC_FALLBACK_MARKER);
    });
  });

  describe("IntentFrame v1.1 — familyHint aligné sur les frontières de promesse", () => {
    for (const item of INTENT_FRAME_V1_1_CASES) {
      it(`frame → ${item.expectedFamily}: ${item.principle}`, () => {
        const frame = analyzeRequestIntentFrame(item.query);
        assert.equal(
          frame.familyHint?.id,
          item.expectedFamily,
          `familyHint pour: ${item.query}`,
        );
        assert.equal(frame.conversation.socialOnly, false);
      });
    }

    it("socialOnly → pas de familyHint métier", () => {
      const frame = analyzeRequestIntentFrame("comment tu vas ?");
      assert.equal(frame.conversation.socialOnly, true);
      assert.equal(frame.familyHint, null);
    });
  });

  describe("promesses distinctes — nouvelle famille seulement si promesse change", () => {
    for (const item of PROMISE_BOUNDARY_CASES) {
      it(item.principle, () => {
        const matrix = getIntentFamilyCanonicalMatrixV1();
        const row = matrix.find((r) => r.query === item.query);
        assert.ok(row, `cas canonique manquant: ${item.query}`);
        assert.equal(row.familyId, item.expectedFamily);
      });
    }
  });

  describe("le plus spécifique gagne — hiérarchie sémantique", () => {
    for (const item of SEMANTIC_PRIORITY_CASES) {
      it(item.label, () => {
        assert.equal(normalizeTechnicalLearningTarget(item.query), item.expectedBlueprint);
        const bp = resolveTechnicalLearningBlueprint(item.query);
        assert.equal(bp?.id, item.expectedBlueprint);
      });
    }

    it("Node.js ≠ JavaScript — contenu de plan disjoint", () => {
      const nodeQ = "je veux créer des fiches de connaissances afin maitriser nodejs";
      const jsQ = "je veux créer des fiches de connaissances afin maitriser javascript";
      const nodeFb = resolveTechnicalLearningPathLocalFallback(nodeQ);
      const jsFb = resolveTechnicalLearningPathLocalFallback(jsQ);
      assert.match(nodeFb, /Runtime Node vs navigateur/i);
      assert.match(jsFb, /DOM et événements/i);
      assert.doesNotMatch(nodeFb, /DOM et événements/i);
    });

    it("Express ≠ Node.js — framework HTTP vs runtime", () => {
      assert.equal(
        normalizeTechnicalLearningTarget(
          "je veux créer des fiches de connaissances afin maitriser express",
        ),
        "express",
      );
      assert.equal(
        normalizeTechnicalLearningTarget(
          "fiches pour apprendre express sur node",
        ),
        "express",
      );

      const expressFb = resolveTechnicalLearningPathLocalFallback(
        "je veux créer des fiches de connaissances afin maitriser express",
      );
      const nodeFb = resolveTechnicalLearningPathLocalFallback(
        "je veux créer des fiches de connaissances afin maitriser nodejs",
      );
      assert.match(expressFb, /Middleware et chaîne next/i);
      assert.match(nodeFb, /Modules, npm et package.json/i);
      assert.doesNotMatch(expressFb, /Runtime Node vs navigateur/i);
      assert.doesNotMatch(nodeFb, /Router modulaire/i);
    });

    it("Fastify ≠ Express ≠ Node.js — frameworks HTTP vs runtime", () => {
      const fastifyFb = resolveTechnicalLearningPathLocalFallback(
        "je veux créer des fiches de connaissances afin maitriser fastify",
      );
      const expressFb = resolveTechnicalLearningPathLocalFallback(
        "je veux créer des fiches de connaissances afin maitriser express",
      );
      const nodeFb = resolveTechnicalLearningPathLocalFallback(
        "je veux créer des fiches de connaissances afin maitriser nodejs",
      );

      assert.match(fastifyFb, /JSON Schema et validation/i);
      assert.match(fastifyFb, /Plugins et encapsulation/i);
      assert.doesNotMatch(fastifyFb, /Middleware et chaîne next/i);
      assert.doesNotMatch(fastifyFb, /Runtime Node vs navigateur/i);

      assert.match(expressFb, /Middleware et chaîne next/i);
      assert.doesNotMatch(expressFb, /Hooks lifecycle/i);

      assert.match(nodeFb, /Runtime Node vs navigateur/i);
      assert.doesNotMatch(nodeFb, /JSON Schema et validation/i);
    });
  });

  describe("traces = vérité métier (justIntent vs couloir)", () => {
    it("apprendre HTML — couloir + preempt + pas htmlProject", async () => {
      assert.equal(suppressesBuildIntentForTechnicalLearning(LEARN_HTML_QUERY), true);
      assert.equal(isHtmlProjectDeliverable(LEARN_HTML_QUERY), false);

      const ev = evaluateJustIntent(LEARN_HTML_QUERY);
      assert.equal(ev.domain, INTENT_DOMAINS.GENERAL);
      assert.equal(ev.action, INTENT_ACTIONS.PLAN);
      assert.equal(ev.deliverable, DELIVERABLE_TYPES.PLAIN_ANSWER);

      const hit = await runConversationShortCircuit(LEARN_HTML_QUERY);
      assert.equal(hit?.path, "technical_learning_path");
    });
  });

  describe("négatifs aussi soignés que positifs", () => {
    for (const item of NEGATIVE_GUARD_CASES) {
      it(item.label, () => {
        assert.equal(
          suppressesBuildIntentForTechnicalLearning(item.query),
          item.expectPreempt,
        );
        if (item.expectDomain) {
          assert.equal(evaluateJustIntent(item.query).domain, item.expectDomain);
        }
        if (item.expectHtmlProject === true) {
          assert.equal(isHtmlProjectDeliverable(item.query), true);
        }
      });
    }
  });

  describe("niveaux de sévérité — contraintes par tier (doc § sévérité)", () => {
    it("[INTERDIT] DOCUMENTED_STACK_IDS → jamais « Mécanismes clés »", () => {
      for (const id of DOCUMENTED_STACK_IDS) {
        const query =
          getIntentFamilyCanonicalMatrixV1().find(
            (r) =>
              r.familyId === "technical_learning_path" &&
              (r.label?.toLowerCase().includes(id.replace("_", " ")) ||
                r.query.includes(id === "jvm_javascript" ? "jvm" : id)),
          )?.query ||
          `je veux créer des fiches de connaissances afin maitriser ${id === "jvm_javascript" ? "la jvm pour javascript" : id}`;
        const fallback = resolveTechnicalLearningPathLocalFallback(query);
        assert.doesNotMatch(
          fallback,
          GENERIC_FALLBACK_MARKER,
          `interdit: fallback générique pour ${id}`,
        );
      }
    });

    it("[OBLIGATOIRE] learn vs build → preempt + couloir technical_learning_path", async () => {
      for (const query of LEARN_VS_BUILD_OBLIGATORY_CASES) {
        assert.equal(suppressesBuildIntentForTechnicalLearning(query), true);

        const ev = evaluateJustIntent(query);
        assert.ok(
          ev.signals.includes("preempt:technical_learning_path"),
          `preempt manquant: ${query.slice(0, 50)}`,
        );
        assert.notEqual(ev.domain, INTENT_DOMAINS.WEB_HTML);

        const hit = await runConversationShortCircuit(query);
        assert.equal(
          hit?.path,
          "technical_learning_path",
          `couloir incorrect: ${query.slice(0, 50)}`,
        );
      }
    });

    it("[FORT] chaque requête canonique registre → une seule famille", () => {
      for (const row of getIntentFamilyCanonicalMatrixV1()) {
        const matches = INTENT_FAMILIES_V1.filter((f) => f.detect(row.query)).map(
          (f) => f.id,
        );
        assert.equal(
          matches.length,
          1,
          `fort: « ${row.label} » → [${matches.join(", ")}], attendu ${row.familyId}`,
        );
        assert.equal(matches[0], row.familyId);
      }
    });

    it("[RECOMMANDÉ] blueprints documentés exposent llmAddonLine (qualité LLM)", () => {
      for (const id of DOCUMENTED_STACK_IDS) {
        const bp = TECHNICAL_LEARNING_BLUEPRINTS.find((entry) => entry.id === id);
        assert.ok(bp?.llmAddonLine?.length > 20, `llmAddonLine manquant pour ${id}`);
      }
    });

    it("[FACULTATIF] connector expose enrichissement web sans imposer le couloir", async () => {
      const adminCtx = await (async () => {
        const q = "comment déclarer mes impôts en ligne";
        const shortCircuit = await runConversationShortCircuit(q);
        return buildConnectorResolutionContext({
          query: q,
          shortCircuit,
          intentFamily: resolveIntentFamilyFromRegistry(q),
          pipelinePath: shortCircuit?.path,
        });
      })();

      const adminPlan = resolveConnectorChain(adminCtx);
      assert.equal(adminPlan.primary?.id, "full_pipeline_orchestrator");
      assert.ok(
        adminPlan.chain.some((c) => c.id === "expert_web_search"),
        "facultatif: enrichissement web disponible pour admin_procedure",
      );

      const learnPlan = resolveConnectorChain(
        buildConnectorResolutionContext({
          query: LEARN_HTML_QUERY,
          shortCircuit: await runConversationShortCircuit(LEARN_HTML_QUERY),
          intentFamily: resolveIntentFamilyFromRegistry(LEARN_HTML_QUERY),
          pipelinePath: "technical_learning_path",
        }),
      );
      assert.equal(
        learnPlan.primary?.id,
        "local_deterministic",
        "facultatif: blueprint local sans web forcé sur technical_learning_path",
      );
      assert.ok(
        !learnPlan.chain.some((c) => c.id === "expert_web_search"),
        "facultatif: pas de web en chaîne sur technical_learning_path",
      );
    });
  });

  describe("satisfiable → déterministe — multi-unit préempte les couloirs composites", () => {
    it("batterie #24 — inventaire complet + préemption multi_segment", async () => {
      const decomposition = decomposeRequest(SMOOTHIE_MULTI_UNIT_QUERY);
      assert.equal(allWorkUnitsSatisfiable(decomposition), true);
      assert.equal(shouldPreemptMultiSegment(decomposition), true);

      const hit = await runConversationShortCircuit(SMOOTHIE_MULTI_UNIT_QUERY, {
        requestDecomposition: decomposition,
      });
      assert.equal(hit?.path, "multi_unit_deterministic");
      assert.ok(hit?.reply);
      assert.doesNotMatch(hit.reply, /Je vois la piste/i);
    });
  });

  describe("satisfiable → déterministe — maths élémentaires", () => {
    it("batterie #30 — factorisation quadratique sans clarification", async () => {
      assert.equal(
        isMathSimpleSatisfiable(MATH_SIMPLE_CANONICAL_FACTORIZE_QUERY),
        true,
      );

      const evaluation = evaluateJustIntent(MATH_SIMPLE_CANONICAL_FACTORIZE_QUERY);
      const decision = evaluateClarificationDecision(
        MATH_SIMPLE_CANONICAL_FACTORIZE_QUERY,
        evaluation,
      );
      assert.equal(decision.decision, CLARIFICATION_DECISIONS.CAN_ANSWER_NOW);
      assert.ok(decision.signals.includes("math_simple"));

      const hit = await runConversationShortCircuit(
        MATH_SIMPLE_CANONICAL_FACTORIZE_QUERY,
      );
      assert.equal(hit?.path, "math_simple_deterministic");
      assert.match(hit?.reply, /\(x\+2\)\(x\+3\)/);
      assert.doesNotMatch(hit?.reply, /Je vois la piste/i);
    });
  });
});
