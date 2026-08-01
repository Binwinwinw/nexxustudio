import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  EXISTING_SOURCE_CANONICAL_TEAMS_HTML_QUERY,
  EXISTING_SOURCE_CANONICAL_DEMO_CITADELLE_QUERY,
  EXISTING_SOURCE_FOLDER_PLUS_FILENAME_QUERY,
  resolveExistingSourceAnalysisShortCircuit,
  isExistingSourceAnalysisSatisfiable,
  resolveWorkspaceReadablePath,
} from "../src/agent/policies/analysis/index.js";
import {
  extractLocalFileReference,
  isExistingSourceAnalysisRequest,
  isLocalFileReference,
} from "../src/agent/utils/localFileUriIntentGuards.js";
import {
  resolveFileTarget,
} from "../src/agent/utils/fileTargetResolver.js";
import { isHtmlProjectDeliverable } from "../src/agent/policies/delivery/index.js";
import { isGuidedCreationScopingRequest } from "../src/agent/policies/guided/index.js";
import {
  isExistingFilePathAnalysisRequest,
  isGeneratorFirstIntent,
} from "../../shared/generatorFirstPolicy.js";
import {
  CLARIFICATION_DECISIONS,
  evaluateClarificationDecision,
} from "../src/agent/policies/clarificationDecisionPolicy.js";
import { evaluateJustIntent } from "../src/agent/policies/justIntentDetectionPolicy.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { resolveDocumentSynthesisShortCircuit } from "../src/agent/policies/document/index.js";
import { INTENT_DOMAINS, INTENT_ACTIONS } from "../../shared/justIntentCatalog.js";

describe("localFileUriIntentGuards", () => {
  it("extrait file:/// + atelier-teams-365.html", () => {
    const ref = extractLocalFileReference(EXISTING_SOURCE_CANONICAL_TEAMS_HTML_QUERY);
    assert.ok(ref);
    assert.equal(ref.kind, "local_file_uri");
    assert.match(ref.filename, /atelier-teams-365\.html/i);
  });

  it("analyser + URI → existing source analysis", () => {
    assert.equal(isExistingSourceAnalysisRequest(EXISTING_SOURCE_CANONICAL_TEAMS_HTML_QUERY), true);
  });

  it("crée une page html → pas existing source", () => {
    assert.equal(isExistingSourceAnalysisRequest("crée une page html pour mon portfolio"), false);
  });
});

describe("existing_source_analysis — routage", () => {
  it("short-circuit dédié — pas document_synthesis_clarify", async () => {
    const hit = await runConversationShortCircuit(EXISTING_SOURCE_CANONICAL_TEAMS_HTML_QUERY);
    assert.equal(hit?.path, "existing_source_analysis_clarify_access");
    assert.match(hit?.reply || "", /atelier-teams-365\.html/i);
    assert.match(hit?.reply || "", /file:\/\/\//i);
    assert.doesNotMatch(hit?.reply || "", /colle le passage/i);

    const docSynth = resolveDocumentSynthesisShortCircuit(
      EXISTING_SOURCE_CANONICAL_TEAMS_HTML_QUERY,
    );
    assert.equal(docSynth, null);
  });

  it("pas web_html/create via isHtmlProjectDeliverable", () => {
    assert.equal(isHtmlProjectDeliverable(EXISTING_SOURCE_CANONICAL_TEAMS_HTML_QUERY), false);
  });

  it("justIntent — domaine ANALYSIS, pas WEB_HTML", () => {
    const evaluation = evaluateJustIntent(EXISTING_SOURCE_CANONICAL_TEAMS_HTML_QUERY);
    assert.equal(evaluation.domain, INTENT_DOMAINS.ANALYSIS);
    assert.notEqual(evaluation.domain, INTENT_DOMAINS.WEB_HTML);
    assert.ok(evaluation.signals.includes("preempt:existing_source_analysis"));
  });

  it("clarification gate — can_answer_now", () => {
    const evaluation = evaluateJustIntent(EXISTING_SOURCE_CANONICAL_TEAMS_HTML_QUERY);
    const decision = evaluateClarificationDecision(
      EXISTING_SOURCE_CANONICAL_TEAMS_HTML_QUERY,
      evaluation,
    );
    assert.equal(decision.decision, CLARIFICATION_DECISIONS.CAN_ANSWER_NOW);
    assert.ok(decision.signals.includes("existing_source_analysis"));
  });

  it("resolveExistingSourceAnalysisShortCircuit — structure", () => {
    const hit = resolveExistingSourceAnalysisShortCircuit(
      EXISTING_SOURCE_CANONICAL_TEAMS_HTML_QUERY,
    );
    assert.equal(hit?.path, "existing_source_analysis_clarify_access");
    assert.equal(hit?.kind, "local_file_inaccessible");
    assert.ok(isExistingSourceAnalysisSatisfiable(EXISTING_SOURCE_CANONICAL_TEAMS_HTML_QUERY));
    assert.ok(isLocalFileReference(EXISTING_SOURCE_CANONICAL_TEAMS_HTML_QUERY));
  });
});

describe("existing_source_analysis — projects/ workspace", () => {
  it("extrait projects/demo-citadelle/index.html", () => {
    const ref = extractLocalFileReference(EXISTING_SOURCE_CANONICAL_DEMO_CITADELLE_QUERY);
    assert.ok(ref);
    assert.equal(ref.kind, "workspace_relative");
    assert.match(ref.uri, /projects\/demo-citadelle\/index\.html/i);
  });

  it("justIntent ANALYSIS/REVIEW — pas WEB_HTML create", () => {
    const evaluation = evaluateJustIntent(EXISTING_SOURCE_CANONICAL_DEMO_CITADELLE_QUERY);
    assert.equal(evaluation.domain, INTENT_DOMAINS.ANALYSIS);
    assert.equal(evaluation.action, INTENT_ACTIONS.REVIEW);
    assert.notEqual(evaluation.domain, INTENT_DOMAINS.WEB_HTML);
  });

  it("pas guided_creation ni Generator-First", () => {
    assert.equal(isGuidedCreationScopingRequest(EXISTING_SOURCE_CANONICAL_DEMO_CITADELLE_QUERY), false);
    assert.equal(isGeneratorFirstIntent(EXISTING_SOURCE_CANONICAL_DEMO_CITADELLE_QUERY), false);
    assert.equal(isHtmlProjectDeliverable(EXISTING_SOURCE_CANONICAL_DEMO_CITADELLE_QUERY), false);
  });

  it("résout et lit le fichier sous projects/", () => {
    const ref = extractLocalFileReference(EXISTING_SOURCE_CANONICAL_DEMO_CITADELLE_QUERY);
    const resolved = resolveWorkspaceReadablePath(ref);
    assert.equal(resolved.ok, true);
    assert.match(resolved.relativePath || "", /projects\/demo-citadelle\/index\.html/i);
  });

  it("short-circuit déterministe — analyse réelle, pas clarify file:///", async () => {
    const hit = await runConversationShortCircuit(EXISTING_SOURCE_CANONICAL_DEMO_CITADELLE_QUERY);
    assert.equal(hit?.path, "existing_source_analysis_deterministic");
    assert.match(hit?.reply || "", /demo-citadelle\/index\.html/i);
    assert.match(hit?.reply || "", /Problèmes \/ risques|Points solides/i);
    assert.match(hit?.reply || "", /Pourquoi ce rôle/i);
    assert.doesNotMatch(hit?.reply || "", /file:\/\/\//i);
    assert.notEqual(hit?.path, "guided_creation_scoping");
  });
});

describe("existing_source_analysis — Forme B dossier + filename", () => {
  it("compose projects/demo-citadelle/ + index.html", () => {
    const hit = resolveFileTarget(EXISTING_SOURCE_FOLDER_PLUS_FILENAME_QUERY);
    assert.equal(hit.resolution_mode, "folder_plus_filename");
    assert.equal(hit.resolved_path, "projects/demo-citadelle/index.html");
    assert.equal(hit.confidence, "high");

    const ref = extractLocalFileReference(EXISTING_SOURCE_FOLDER_PLUS_FILENAME_QUERY);
    assert.ok(ref);
    assert.equal(ref.uri, "projects/demo-citadelle/index.html");
    assert.equal(ref.resolution_mode, "folder_plus_filename");
  });

  it("isExistingSourceAnalysisRequest — Forme B", () => {
    assert.equal(
      isExistingSourceAnalysisRequest(EXISTING_SOURCE_FOLDER_PLUS_FILENAME_QUERY),
      true,
    );
  });

  it("justIntent ANALYSIS — pas web_html/create", () => {
    const evaluation = evaluateJustIntent(EXISTING_SOURCE_FOLDER_PLUS_FILENAME_QUERY);
    assert.equal(evaluation.domain, INTENT_DOMAINS.ANALYSIS);
    assert.notEqual(evaluation.domain, INTENT_DOMAINS.WEB_HTML);
    assert.ok(evaluation.signals.includes("preempt:existing_source_analysis"));
  });

  it("pas document_synthesis_clarify ni Generator-First", async () => {
    assert.equal(
      resolveDocumentSynthesisShortCircuit(EXISTING_SOURCE_FOLDER_PLUS_FILENAME_QUERY),
      null,
    );
    assert.equal(isGeneratorFirstIntent(EXISTING_SOURCE_FOLDER_PLUS_FILENAME_QUERY), false);
    assert.equal(isGuidedCreationScopingRequest(EXISTING_SOURCE_FOLDER_PLUS_FILENAME_QUERY), false);

    const hit = await runConversationShortCircuit(
      EXISTING_SOURCE_FOLDER_PLUS_FILENAME_QUERY,
    );
    assert.equal(hit?.path, "existing_source_analysis_deterministic");
    assert.match(hit?.reply || "", /demo-citadelle\/index\.html/i);
    assert.doesNotMatch(hit?.reply || "", /colle le passage|PDF/i);
  });

  it("variantes phrasing — dans projects/…", () => {
    const q = "analyse app.js dans projects/demo-citadelle/";
    const hit = resolveFileTarget(q);
    assert.equal(hit.resolution_mode, "folder_plus_filename");
    assert.equal(hit.resolved_path, "projects/demo-citadelle/app.js");
  });

  it("fichier manquant → not_found ancré, pas PDF", () => {
    const q =
      "analyse le fichier missing-nope.html qui est dans le dossier projects/demo-citadelle/";
    const hit = resolveExistingSourceAnalysisShortCircuit(q);
    assert.equal(hit?.path, "existing_source_analysis_not_found");
    assert.match(hit?.reply || "", /missing-nope\.html/i);
    assert.match(hit?.reply || "", /demo-citadelle/i);
    assert.doesNotMatch(hit?.reply || "", /PDF/i);
  });

  it("cible web générique (https) → WEB_SUMMARY, pas existing_source", async () => {
    const q =
      "fait une analyse pour résumer ce site : https://moncoachscolaire.fr/";
    assert.equal(extractLocalFileReference(q), null);
    assert.equal(isLocalFileReference(q), false);
    assert.equal(resolveExistingSourceAnalysisShortCircuit(q), null);
    assert.equal(isExistingFilePathAnalysisRequest(q), false);

    const history = [
      { role: "user", content: "ok donc on peut discuter" },
      {
        role: "assistant",
        content:
          "Oui bien sûr, on peut discuter. Tu as un sujet en tête ou quelque chose de particulier à faire ?",
      },
    ];
    const sc = await runConversationShortCircuit(q, { history });
    assert.equal(sc?.webSummary, true);
    assert.equal(sc?.deferToLlm, true);
    assert.notEqual(sc?.path, "existing_source_analysis_clarify_access");
    assert.match(sc?.summaryContract?.source?.url || "", /moncoachscolaire\.fr/i);
  });

  it("domaine nu (sans https) → WEB_SUMMARY fetchable", async () => {
    const q = "résume ce site : moncoachscolaire.fr";
    assert.equal(extractLocalFileReference(q), null);
    const sc = await runConversationShortCircuit(q, { history: [] });
    assert.equal(sc?.webSummary, true);
    assert.equal(sc?.summaryContract?.source?.url, "https://moncoachscolaire.fr");
  });

  it("URL HTTPS avec …/fichier.ext → pas faux positif chemin local", async () => {
    const q =
      "fait une analyse pour résumer ce site : https://example.com/app/index.php?page=home";
    assert.equal(extractLocalFileReference(q), null);
    assert.equal(resolveExistingSourceAnalysisShortCircuit(q), null);
    const sc = await runConversationShortCircuit(q, { history: [] });
    assert.equal(sc?.webSummary, true);
  });
});


