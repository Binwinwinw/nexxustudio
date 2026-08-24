import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isRepoAnalysisRequest,
  extractRepoTarget,
  deriveRepoAnalysisWebQuery,
} from "../src/agent/utils/intent-guards/repoAnalysisIntentGuards.js";
import {
  REPO_ANALYSIS_CANONICAL_LOCAL_QUERY,
  REPO_ANALYSIS_CANONICAL_GITHUB_QUERY,
  resolveRepoAnalysisShortCircuit,
  buildUnconfirmedRepoTargetReply,
} from "../src/agent/policies/analysis/index.js";
import {
  REPO_ANALYSIS_CONTRACT_ID,
  validateRepoAnalysisReport,
  getRepoAnalysisSystemPrompt,
} from "../src/agent/analysis/repoAnalysisContract.js";
import { resolveIntentContract } from "../src/agent/config/intentContractRegistry.js";
import { resolveDocumentSynthesisShortCircuit } from "../src/agent/policies/document/index.js";
import { isResearchThenSummarizeRequest } from "../src/agent/policies/routing/researchThenSummarizePolicy.js";
import { isExistingSourceAnalysisRequest } from "../src/agent/utils/intent-guards/localFileUriIntentGuards.js";
import { evaluateJustIntent } from "../src/agent/policies/intent/justIntentDetectionPolicy.js";
import { INTENT_DOMAINS } from "../../shared/justIntentCatalog.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";

/** Incident : brief de doc Spec Kit routé vers projects/Git (Revue + Repo Git). */
const SPEC_KIT_DOC_BRIEF = `Tu veux créer une documentation qui sert à la fois de mémoire (pour ne pas oublier les règles Spec Kit) et de guide d'application.

Spec Kit — Fiche Mémo
Définir ce qu'on veut construire avant de coder, via des specs exécutables.

Workflow : /speckit.constitution, /speckit.specify, /speckit.plan, /speckit.tasks, /speckit.implement.

Matrice de Décision
Situation Commande Fréquence Artefact
Démarrage projet /speckit.constitution 1 fois specs/constitution.md
Nouvelle feature /speckit.specify Par feature specs/feature-spec.md
Review qualité /speckit.checklist Avant merge Checklist personnalisée

Checklist Démarrage Projet Spec Kit
Prérequis
 uv installé
 Agent IA configuré (Copilot/Cursor/etc.)
 Repo Git initialisé
Initialisation
 uv tool install specify-cli
 specify init mon-projet --integration cursor
Premiers Artefacts
 /speckit.constitution exécuté
 /speckit.specify pour la première feature
 Tâches converties en GitHub Issues (optionnel)

Où Stocker Cette Documentation ?
Dans le repo : docs/spec-kit/ (versionné avec le code)
Format : Markdown
Structure : docs/spec-kit/README.md, workflow.md, templates.md, checklist.md

Principes de Maintenance
1 doc = 1 propriétaire
Mise à jour à chaque changement de workflow Spec Kit
Revue trimestrielle des templates et checklists
Format lean : tableaux, listes, exemples > longs paragraphes
`;

describe("REPO_ANALYSIS_V1 — intent", () => {
  it("détecte analyse dépôt local projects/", () => {
    assert.equal(isRepoAnalysisRequest(REPO_ANALYSIS_CANONICAL_LOCAL_QUERY), true);
    const t = extractRepoTarget(REPO_ANALYSIS_CANONICAL_LOCAL_QUERY);
    assert.equal(t?.kind, "workspace_projects");
    assert.match(t?.localRelative || "", /projects\/demo-citadelle/);
  });

  it("détecte URL GitHub", () => {
    assert.equal(isRepoAnalysisRequest(REPO_ANALYSIS_CANONICAL_GITHUB_QUERY), true);
    const t = extractRepoTarget(REPO_ANALYSIS_CANONICAL_GITHUB_QUERY);
    assert.equal(t?.label, "JuliusBrussee/caveman");
    assert.match(deriveRepoAnalysisWebQuery(REPO_ANALYSIS_CANONICAL_GITHUB_QUERY), /github\.com/);
  });

  it("ne confond pas avec fichier seul", () => {
    const q =
      "analyse le fichier index.html qui est dans le dossier projects/demo-citadelle/";
    assert.equal(isExistingSourceAnalysisRequest(q), true);
    assert.equal(isRepoAnalysisRequest(q), false);
  });

  it("ne vole pas research-then-summarize", () => {
    const q =
      'j\'ai entendu parler d\'un dépôt github dont le nom est "caveman" vas te renseigner là dessus et fait moi un résumé consistant sur son utilité et sa conception';
    assert.equal(isResearchThenSummarizeRequest(q), true);
    assert.equal(isRepoAnalysisRequest(q), false);
  });

  it("ne prend pas un brief Spec Kit pour une revue projects/Git", () => {
    const q = SPEC_KIT_DOC_BRIEF;
    assert.equal(isRepoAnalysisRequest(q), false);
    const t = extractRepoTarget(q);
    assert.notEqual(t?.localRelative, "projects/Git");
    assert.notEqual(t?.repo, "Git");
  });

  it("garde revue + repo dans la même phrase", () => {
    assert.equal(isRepoAnalysisRequest("fais une revue de ce repo"), true);
  });

  it("n'extrait pas « Repo Git » comme slug local", () => {
    const t = extractRepoTarget("analyse le repo Git");
    assert.notEqual(t?.kind, "named_repo");
    assert.notEqual(t?.localRelative, "projects/Git");
  });

  it("sujet documentation sans locator ≠ revue de dépôt", () => {
    assert.equal(
      isRepoAnalysisRequest("analyse cette documentation Spec Kit et le guide d'application"),
      false,
    );
  });
});

describe("REPO_ANALYSIS_V1 — routing", () => {
  it("contrat REPO_ANALYSIS (pas DOCUMENT_ANALYSIS)", () => {
    const { contract } = resolveIntentContract(REPO_ANALYSIS_CANONICAL_GITHUB_QUERY);
    assert.equal(contract.id, "REPO_ANALYSIS");
    assert.notEqual(contract.id, "DOCUMENT_ANALYSIS");
  });

  it("exclut document_synthesis_clarify", () => {
    assert.equal(
      resolveDocumentSynthesisShortCircuit(REPO_ANALYSIS_CANONICAL_LOCAL_QUERY),
      null,
    );
  });

  it("justIntent ANALYSIS + preempt repo", () => {
    const evaluation = evaluateJustIntent(REPO_ANALYSIS_CANONICAL_LOCAL_QUERY);
    assert.equal(evaluation.domain, INTENT_DOMAINS.ANALYSIS);
    assert.ok(evaluation.signals.includes("preempt:repo_analysis"));
  });

  it("short-circuit local déterministe review-grade", async () => {
    const hit = await runConversationShortCircuit(REPO_ANALYSIS_CANONICAL_LOCAL_QUERY);
    assert.equal(hit?.path, "repo_analysis_deterministic");
    assert.match(hit?.reply || "", /REPO_ANALYSIS_V1/);
    assert.match(hit?.reply || "", /Points forts/);
    assert.match(hit?.reply || "", /Problèmes \/ risques/);
    assert.match(hit?.reply || "", /Actions recommandées/);
    assert.doesNotMatch(hit?.reply || "", /colle le passage|PDF/i);
  });

  it("short-circuit GitHub → defer LLM + contrat", async () => {
    const hit = await runConversationShortCircuit(REPO_ANALYSIS_CANONICAL_GITHUB_QUERY);
    assert.equal(hit?.path, "repo_analysis_llm");
    assert.equal(hit?.deferToLlm, true);
    assert.equal(hit?.forcedIntentContractId, "REPO_ANALYSIS");
    assert.ok(hit?.webQueryOverride);
  });

  it("brief Spec Kit ne short-circuit pas vers REPO_ANALYSIS", async () => {
    const hit = await runConversationShortCircuit(SPEC_KIT_DOC_BRIEF);
    assert.notEqual(hit?.path, "repo_analysis_deterministic");
    assert.notEqual(hit?.path, "repo_analysis_not_found");
    assert.notEqual(hit?.path, "repo_analysis_llm");
    assert.doesNotMatch(hit?.reply || "", /projects\/Git/);
  });

  it("chemin local introuvable → arrêt, pas de rapport review-grade", () => {
    const hit = resolveRepoAnalysisShortCircuit(
      "analyse le dépôt projects/Git",
    );
    assert.equal(hit?.path, "repo_analysis_target_unconfirmed");
    assert.match(hit?.reply || "", /analyse factuelle refusée/i);
    assert.doesNotMatch(hit?.reply || "", /Langages principaux/);
    assert.doesNotMatch(hit?.reply || "", /Points forts/);
    assert.equal(hit?.deferToLlm, undefined);
  });

  it("dépôt sans cible confirmée → arrêt, pas de pipeline LLM", () => {
    const hit = resolveRepoAnalysisShortCircuit("analyse le dépôt");
    assert.equal(hit?.path, "repo_analysis_target_unconfirmed");
    assert.equal(hit?.deferToLlm, undefined);
    assert.match(hit?.reply || "", /cible non confirmée/i);
    assert.match(hit?.reply || "", /pas de rapport de revue/i);
  });

  it("recadrage documentation nomme le vrai sujet", () => {
    const reply = buildUnconfirmedRepoTargetReply({
      query: "analyse cette documentation Spec Kit",
      target: { kind: "unresolved", label: "(cible non résolue)" },
      reason: "unresolved",
    });
    assert.match(reply, /documentation/i);
    assert.match(reply, /pas une revue de codebase/i);
  });
});

describe("REPO_ANALYSIS_V1 — rapport local + deep sample", () => {
  it("rapport demo-citadelle passe les minima", () => {
    const hit = resolveRepoAnalysisShortCircuit(REPO_ANALYSIS_CANONICAL_LOCAL_QUERY);
    assert.equal(hit?.path, "repo_analysis_deterministic");
    const quality = hit?.repoTarget?.quality;
    assert.equal(quality?.ok, true, (quality?.failures || []).join(", "));
  });

  it("prompt système expose le rubric + findings code", () => {
    const prompt = getRepoAnalysisSystemPrompt();
    assert.match(prompt, new RegExp(REPO_ANALYSIS_CONTRACT_ID));
    assert.match(prompt, /Langages principaux/);
    assert.match(prompt, /Actions recommandées/);
    assert.match(prompt, /findings ancrés/);
  });

  it("demo-citadelle — findings code ancrés (html + js)", async () => {
    const hit = await runConversationShortCircuit(REPO_ANALYSIS_CANONICAL_LOCAL_QUERY);
    assert.equal(hit?.path, "repo_analysis_deterministic");
    assert.match(hit?.reply || "", /Findings code \(échantillon\)/);
    assert.match(hit?.reply || "", /SOURCE_FILE_ANALYSIS_V1/);
    assert.match(hit?.reply || "", /index\.html/);
    assert.match(hit?.reply || "", /app\.js/);
    assert.match(
      hit?.reply || "",
      /atelier|thème|hero|aria|accessib|Google Fonts|landing|skip/i,
    );

    const direct = resolveRepoAnalysisShortCircuit(REPO_ANALYSIS_CANONICAL_LOCAL_QUERY);
    const reportQuality = direct?.repoTarget?.quality;
    assert.equal(reportQuality?.ok, true, (reportQuality?.failures || []).join(", "));
  });

  it("selectDeepSampleFiles priorise index.html puis app.js", async () => {
    const { selectDeepSampleFiles } = await import(
      "../src/agent/analysis/repoDeepSample.js"
    );
    const picked = selectDeepSampleFiles([
      "style.css",
      "app.js",
      "index.html",
      "readme.md",
    ]);
    assert.deepEqual(picked, ["index.html", "app.js"]);
  });
});
