import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isArchitectureDesignIntent,
  isWebArtifactBuildExclusionForArchitectureDesign,
  isSpreadsheetBuildExclusionForArchitectureDesign,
  isSpreadsheetCreateRequest,
  classifyArchitectureDesignSignal,
  getArchitectureDesignDeterministicReply,
  extractArchitectureTopic,
} from "../src/agent/utils/intent-guards/architectureDesignIntentGuards.js";
import { buildArchitectureDesignReply } from "../src/agent/micro/replies/architectureDesignReplyBuilder.js";
import { isAnalyticalTechnicalRequest } from "../src/agent/utils/conversation/conversationGuards.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { classifyIntent } from "../src/agent/utils/intent-guards/intentClassifier.js";
import {
  resolveIntentContract,
  getExpectedResponseMode,
} from "../src/agent/config/intentContractRegistry.js";
import { RESPONSE_MODES } from "../src/agent/config/modeResponseContracts.js";

const CODE_REVIEWER_QUERY =
  "comment créer un code-reviewer qui analyse tout le code d'un projet, identifie les erreurs et propose plusieurs solutions selon la logique de dev senior";

import { ARCHITECTURE_DESIGN_SMOKE_V1_1 } from "./fixtures/architectureDesignSmokeV1_1.js";
import { isGuidedCreationScopingRequest } from "../src/agent/policies/guided/index.js";
import {
  isProjectIdeaCritiqueRequest,
  isIdeationIntent,
} from "../src/agent/utils/intent-guards/ideationIntentGuards.js";
import { resolveNamedCreateStartShortCircuit } from "../src/agent/policies/conversation/currentTurnAnchoringPolicy.js";
import { resolveConversationTurnFamilyShortCircuit } from "../src/agent/policies/conversation/conversationTurnRoutingPolicy.js";
import { resolvePosture } from "../src/agent/policies/posture/posturePolicy.js";
import { POSTURES } from "../src/agent/policies/posture/sessionModeState.js";
import { isSubstantiveWorkRequest } from "../src/agent/utils/conversation/genericGreetingGuards.js";

describe("architectureDesignIntentGuards", () => {
  it("détecte « comment créer un code-reviewer »", () => {
    assert.equal(isArchitectureDesignIntent(CODE_REVIEWER_QUERY), true);
    assert.equal(classifyArchitectureDesignSignal(CODE_REVIEWER_QUERY), "explorable");
  });

  it("exclut les demandes d'exécution immédiate", () => {
    assert.equal(
      isArchitectureDesignIntent("lance l'indexation de mon projet maintenant"),
      false,
    );
  });

  it("exclut du garde analytique technique", () => {
    assert.equal(isAnalyticalTechnicalRequest(CODE_REVIEWER_QUERY), false);
    assert.equal(isAnalyticalTechnicalRequest("debug ce timeout api"), true);
  });

  it("propose 3 approches + recommandation P5 + prochain pas", () => {
    const reply = buildArchitectureDesignReply(CODE_REVIEWER_QUERY);
    assert.ok(reply);
    assert.match(reply, /3 approches/i);
    assert.match(reply, /Je partirais plutôt sur/i);
    assert.match(reply, /intermédiaire|intermediaire/i);
    assert.match(reply, /\*\*Prochain pas\*\*/i);
    assert.match(reply, /review senior/i);
    assert.ok(!reply.includes("skill-industrial-maturation"));
  });

  it("base déterministe sans P5 conserve le framing vague", () => {
    const reply = getArchitectureDesignDeterministicReply(CODE_REVIEWER_QUERY);
    assert.ok(reply);
    assert.match(reply, /3 approches/i);
    assert.ok(!/Je partirais plutôt sur/i.test(reply));
  });

  it("extrait le sujet code-reviewer", () => {
    const topic = extractArchitectureTopic(CODE_REVIEWER_QUERY);
    assert.match(topic, /code[- ]?reviewer/i);
  });
});

describe("architectureDesignIntentGuards — exclusion artefacts web (P2)", () => {
  const SHAREPOINT_QUERY =
    "je voudrais créer un site avec sharepoint pourras tu m'aider à faire cela";

  const WEB_EXCLUSION_CASES = [
    SHAREPOINT_QUERY,
    "je veux créer un site web vitrine pour mon activité",
    "comment créer une page html pour mon association",
    "aide-moi à faire un intranet sharepoint",
    "je souhaite construire un site avec wordpress",
    "peux-tu m'aider à créer un landing page pour mon produit",
  ];

  const ARCHITECTURE_KEEP_CASES = [
    CODE_REVIEWER_QUERY,
    "comment créer une architecture RAG pour mon agent de support",
    "je voudrais construire un pipeline de revue de code senior",
    "propose-moi plusieurs approches pour un linter automatique",
  ];

  const GUIDED_CREATION_CASES = [
    "comment créer un code-reviewer qui analyse tout le code d'un projet",
    "je veux créer un bot assistant qui audite la qualité du code",
  ];

  for (const query of WEB_EXCLUSION_CASES) {
    it(`exclut architecture_design : ${query.slice(0, 55)}…`, async () => {
      assert.equal(isWebArtifactBuildExclusionForArchitectureDesign(query), true);
      assert.equal(isArchitectureDesignIntent(query), false);
      const hit = await runConversationShortCircuit(query);
      assert.notEqual(hit?.path, "architecture_design_deterministic");
      if (query === SHAREPOINT_QUERY) {
        assert.equal(hit?.path, "web_project_scoping_clarify");
      }
    });
  }

  const EXCEL_DASHBOARD_QUERY =
    'aide moi à propos de ce projet sur excel, je veux créer "un tableau de bord" qui va afficher des calendriers (jours - semaines - années) permettant : 1 - de noter des rendez-vous dans un calendrier avec code couleurs (vert - bleu - rouge) accessible en cliquant sur le bouton "Rendez-vous" 2 - de noter des congés dans un calendrier avec un autre système coloré accessible en cliquant sur le bouton congés (datedebut-datefin)';

  const SPREADSHEET_EXCLUSION_CASES = [
    EXCEL_DASHBOARD_QUERY,
    "je veux créer un tableau de bord excel avec calendrier rendez-vous et congés",
    "comment créer un classeur xlsx pour suivre des rendez-vous",
  ];

  for (const query of SPREADSHEET_EXCLUSION_CASES) {
    it(`exclut spreadsheet architecture_design : ${query.slice(0, 55)}…`, async () => {
      assert.equal(isSpreadsheetBuildExclusionForArchitectureDesign(query), true);
      assert.equal(isArchitectureDesignIntent(query), false);
      const hit = await runConversationShortCircuit(query);
      assert.notEqual(hit?.path, "architecture_design_deterministic");
      assert.doesNotMatch(
        String(hit?.reply || ""),
        /Approche intermédiaire \(RAG \+ règles\)|3 approches distinctes/i,
      );
    });
  }

  it("conserve architecture_design pour RAG agent (pas Excel)", () => {
    const q = "comment créer une architecture RAG pour mon agent de support";
    assert.equal(isSpreadsheetBuildExclusionForArchitectureDesign(q), false);
    assert.equal(isArchitectureDesignIntent(q), true);
  });

  it("typo jev eux + fichier excel → create spreadsheet, pas architecture", () => {
    const q =
      "jev eux créer un fichier excel avec un tableau de bord de gestion de rendez vous avec un calendrier affichant le jour et le nom de la personne";
    assert.equal(isSpreadsheetCreateRequest(q), true);
    assert.equal(isArchitectureDesignIntent(q), false);
  });

  it("générateur de blagues + critique d'idée ≠ architecture RAG", async () => {
    const q =
      "je voudrais créer un générateur de blagues avec IA est ce que ce projet te parait pertinent??? ne me complimente pas, ne soit pas obligatoirement d'accord avec moi, trouves des failles et pose des questions si nécessaire.";
    assert.equal(isProjectIdeaCritiqueRequest(q), true);
    assert.equal(isArchitectureDesignIntent(q), false);
    assert.equal(isSubstantiveWorkRequest(q), false);
    const posture = resolvePosture(q);
    assert.equal(posture.posture, POSTURES.ADVISOR);
    assert.notEqual(posture.breakReason, "execution_mandate");
    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "project_idea_critique");
    assert.equal(hit?.deferToLlm, true);
    assert.match(String(hit?.reflectiveHint || ""), /failles/i);
    assert.doesNotMatch(String(hit?.reply || ""), /RAG \+ règles|3 approches/i);
  });

  for (const query of GUIDED_CREATION_CASES) {
    it(`route guided_creation_scoping : ${query.slice(0, 55)}…`, async () => {
      assert.equal(isGuidedCreationScopingRequest(query), true);
      assert.equal(isArchitectureDesignIntent(query), false);
      const hit = await runConversationShortCircuit(query);
      assert.equal(hit?.path, "guided_creation_scoping");
      assert.equal(hit?.deferToLlm, true);
    });
  }

  for (const query of ARCHITECTURE_KEEP_CASES) {
    it(`conserve architecture_design : ${query.slice(0, 55)}…`, async () => {
      assert.equal(isWebArtifactBuildExclusionForArchitectureDesign(query), false);
      assert.equal(isArchitectureDesignIntent(query), true);
      const hit = await runConversationShortCircuit(query);
      assert.equal(hit?.path, "architecture_design_deterministic");
    });
  }
});

describe("architecture design — routage pipeline", () => {
  it("short-circuit avant orchestrateur lourd", async () => {
    const hit = await runConversationShortCircuit(CODE_REVIEWER_QUERY);
    assert.ok(hit);
    assert.equal(hit.path, "architecture_design_deterministic");
    assert.equal(hit.mode, RESPONSE_MODES.OPEN_PROPOSITION);
    assert.match(hit.reply, /3 approches/i);
  });

  it("intentClassifier évite EXPERT_TASK", () => {
    const intent = classifyIntent(CODE_REVIEWER_QUERY);
    assert.equal(intent.intent, "normal_conversation");
    assert.notEqual(intent.intent, "expert_task");
  });

  it("registry résout ARCHITECTURE_OPTIONS", () => {
    const { contract } = resolveIntentContract(CODE_REVIEWER_QUERY, {});
    assert.equal(contract.id, "ARCHITECTURE_OPTIONS");
    assert.equal(getExpectedResponseMode(CODE_REVIEWER_QUERY), RESPONSE_MODES.OPEN_PROPOSITION);
  });
});

describe("architecture design — smoke registry v1.1", () => {
  for (const smoke of ARCHITECTURE_DESIGN_SMOKE_V1_1) {
    it(`[${smoke.id}] ${smoke.query.slice(0, 60)}…`, async () => {
      const expectMatch = smoke.expectMatch !== false;

      if (smoke.guidedCreation) {
        assert.equal(
          isGuidedCreationScopingRequest(smoke.query),
          true,
          `${smoke.id}: guidedCreation`,
        );
        assert.equal(
          isArchitectureDesignIntent(smoke.query),
          false,
          `${smoke.id}: not architecture when guided`,
        );
        const { contract } = resolveIntentContract(smoke.query, {});
        assert.equal(
          contract.id,
          smoke.expectedContract || "GUIDED_CREATION_SCOPING",
          `${smoke.id}: contract`,
        );
        const hit = await runConversationShortCircuit(smoke.query);
        assert.equal(hit?.path, smoke.expectedPath, `${smoke.id}: path`);
        assert.equal(hit?.deferToLlm, true, `${smoke.id}: deferToLlm`);
        return;
      }

      assert.equal(
        isArchitectureDesignIntent(smoke.query),
        expectMatch,
        `${smoke.id}: isArchitectureDesignIntent`,
      );

      if (smoke.analytical !== undefined) {
        assert.equal(
          isAnalyticalTechnicalRequest(smoke.query),
          smoke.analytical,
          `${smoke.id}: isAnalyticalTechnicalRequest`,
        );
      }

      if (!expectMatch) {
        const hit = await runConversationShortCircuit(smoke.query);
        assert.notEqual(hit?.path, "architecture_design_deterministic");
        if (smoke.expectedIntent) {
          assert.equal(classifyIntent(smoke.query).intent, smoke.expectedIntent);
        }
        return;
      }

      const { contract } = resolveIntentContract(smoke.query, {});
      assert.equal(contract.id, smoke.expectedContract, `${smoke.id}: contract`);

      assert.equal(
        getExpectedResponseMode(smoke.query),
        RESPONSE_MODES.OPEN_PROPOSITION,
        `${smoke.id}: responseMode`,
      );

      if (smoke.expectedIntent) {
        assert.equal(
          classifyIntent(smoke.query).intent,
          smoke.expectedIntent,
          `${smoke.id}: intent`,
        );
      }

      const hit = await runConversationShortCircuit(smoke.query);
      assert.ok(hit, `${smoke.id}: short-circuit`);
      assert.equal(hit.path, smoke.expectedPath, `${smoke.id}: path`);
      assert.equal(hit.mode, RESPONSE_MODES.OPEN_PROPOSITION, `${smoke.id}: mode`);

      if (smoke.deferToLlm) {
        assert.equal(hit.deferToLlm, true, `${smoke.id}: deferToLlm`);
        assert.ok(hit.reflectiveHint, `${smoke.id}: reflectiveHint`);
        return;
      }

      const reply = hit.reply || getArchitectureDesignDeterministicReply(smoke.query);
      assert.ok(reply, `${smoke.id}: reply`);

      for (const pattern of smoke.mustMatchReply || []) {
        assert.match(reply, pattern, `${smoke.id}: mustMatchReply ${pattern}`);
      }

      for (const forbidden of smoke.mustNotContainReply || []) {
        assert.ok(
          !reply.toLowerCase().includes(forbidden.toLowerCase()),
          `${smoke.id}: mustNotContain "${forbidden}"`,
        );
      }
    });
  }
});

describe("ARCHITECTURE_SMOKE_BOT_RAG_LINTER", () => {
  const BOT = "je veux créer un bot assistant qui audite la qualité du code";
  const RAG = "comment mettre en place un agent RAG local pour mon dépôt";
  const LINTER =
    "propose moi plusieurs approches pour un linter intelligent sur mon repo";

  it("bot audit : skip named_create, SC guided_creation_scoping", async () => {
    assert.equal(isGuidedCreationScopingRequest(BOT), true);
    assert.equal(isArchitectureDesignIntent(BOT), false);
    assert.equal(resolveNamedCreateStartShortCircuit(BOT), null);
    const hit = await runConversationShortCircuit(BOT);
    assert.equal(hit?.path, "guided_creation_scoping");
    assert.equal(hit?.deferToLlm, true);
  });

  it("RAG dépôt : G46 ideation cède, SC architecture", async () => {
    assert.equal(isArchitectureDesignIntent(RAG), true);
    assert.equal(isIdeationIntent(RAG), true);
    assert.equal(isGuidedCreationScopingRequest(RAG), false);
    assert.equal(resolveConversationTurnFamilyShortCircuit(RAG), null);
    const hit = await runConversationShortCircuit(RAG);
    assert.equal(hit?.path, "architecture_design_deterministic");
    assert.match(hit?.reply || "", /3 approches/i);
  });

  it("linter repo : G46 ideation cède, SC architecture", async () => {
    assert.equal(isArchitectureDesignIntent(LINTER), true);
    assert.equal(isIdeationIntent(LINTER), true);
    assert.equal(resolveConversationTurnFamilyShortCircuit(LINTER), null);
    const hit = await runConversationShortCircuit(LINTER);
    assert.equal(hit?.path, "architecture_design_deterministic");
    assert.match(hit?.reply || "", /3 approches/i);
  });

  it("non-régression : carte de visite named_create ; SharePoint web ; Python guided ; idéation ouverte", async () => {
    const carte = "créer une carte de visite";
    assert.equal(isGuidedCreationScopingRequest(carte), false);
    assert.equal(resolveNamedCreateStartShortCircuit(carte)?.path, "named_create_start");
    const carteHit = await runConversationShortCircuit(carte);
    assert.equal(carteHit?.path, "named_create_start");

    const sharepoint =
      "je voudrais créer un site avec sharepoint pourras tu m'aider à faire cela";
    assert.equal(resolveNamedCreateStartShortCircuit(sharepoint), null);
    const spHit = await runConversationShortCircuit(sharepoint);
    assert.equal(spHit?.path, "web_project_scoping_clarify");

    const python =
      "j'aimerais créer un agent IA en langage python tu pourrais m'aider à le faire ?";
    const pyHit = await runConversationShortCircuit(python);
    assert.equal(pyHit?.path, "guided_creation_scoping");

    const openIdea = "Quel projet IA je pourrais lancer ?";
    assert.equal(isArchitectureDesignIntent(openIdea), false);
    const ideaHit = await runConversationShortCircuit(openIdea);
    assert.equal(ideaHit?.path, "ideation_deterministic");
  });
});
