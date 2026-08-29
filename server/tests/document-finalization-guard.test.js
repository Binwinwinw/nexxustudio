import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  detectDocumentRepetition,
  detectDocumentTruncation,
  finalizeDocumentAnalysisText,
  measureDocumentFinalization,
  FINALIZATION_STATUS,
  PARTIAL_INTERRUPT_MARKER,
} from "../src/agent/policies/document/documentFinalizationGuard.js";
import {
  evaluateFileAnalysisSufficiency,
  FILE_ANALYSIS_DEPTHS,
} from "../src/agent/policies/attachment/fileAnalysisContract.js";

function buildLoopedBaseUtilisateur() {
  const section = [
    "## Base utilisateur",
    "",
    "La base utilisateur regroupe les comptes, rôles et droits d'accès du système.",
  ].join("\n");
  return [
    "# Analyse du document sujet.pdf",
    "",
    "### Identification",
    "Fichier PDF joint : sujet.pdf.",
    "",
    section,
    "",
    section,
    "",
    section,
    "",
    "Ensuite le flux décrit encore la base utilisateur contient des donn",
  ].join("\n");
}

describe("documentFinalizationGuard — contrat sortie PDF", () => {
  it("détecte répétition (≥3) et troncature mid-phrase", () => {
    const raw = buildLoopedBaseUtilisateur();
    const measures = measureDocumentFinalization(raw, {
      query: "analyse le fichier",
    });
    assert.equal(detectDocumentRepetition(raw), true);
    assert.equal(measures.repetition_detected, true);
    assert.equal(detectDocumentTruncation(raw, "analyse le fichier"), true);
    assert.equal(measures.truncation_detected, true);
  });

  it("collapse + marqueur → pas de boucle livrée, statut explicite", () => {
    const raw = buildLoopedBaseUtilisateur();
    const out = finalizeDocumentAnalysisText(raw, {
      query: "analyse le fichier",
      sectionsExpected: 8,
    });
    assert.ok(
      out.finalization_status === FINALIZATION_STATUS.COMPLETE ||
        out.finalization_status === FINALIZATION_STATUS.PARTIAL_EXPLICIT,
    );
    const baseCount = (out.text.match(/## Base utilisateur/gi) || []).length;
    assert.ok(baseCount < 3, `encore ${baseCount} titres Base utilisateur`);
    assert.equal(detectDocumentRepetition(out.text), false);
    if (out.finalization_status === FINALIZATION_STATUS.PARTIAL_EXPLICIT) {
      assert.match(out.text, /Analyse partielle — génération interrompue/);
    } else {
      assert.equal(detectDocumentTruncation(out.text, "analyse le fichier"), false);
    }
  });

  it("texte propre → complete, sans marqueur partiel", () => {
    const clean = [
      "# Analyse de sujet.pdf",
      "",
      "### Identification",
      "Document PDF : sujet.pdf.",
      "",
      "### Structure",
      "Trois parties visibles dans l'extrait.",
      "",
      "### Fonctionnement",
      "Le texte décrit le sujet de l'épreuve.",
    ].join("\n");
    const out = finalizeDocumentAnalysisText(clean, {
      query: "analyse le fichier",
    });
    assert.equal(out.finalization_status, FINALIZATION_STATUS.COMPLETE);
    assert.doesNotMatch(out.text, new RegExp(PARTIAL_INTERRUPT_MARKER));
    assert.equal(out.measures.repetition_detected, false);
  });

  it("critic FILE_ANALYSIS OK si finalisation complete/partial_explicit", () => {
    const raw = buildLoopedBaseUtilisateur();
    const finalized = finalizeDocumentAnalysisText(raw, {
      query: "analyse le fichier",
    });
    const critic = evaluateFileAnalysisSufficiency({
      query: "analyse le fichier",
      reply: finalized.text,
      depth: FILE_ANALYSIS_DEPTHS.SIMPLE,
      fileName: "sujet.pdf",
      artifactsPresent: true,
      sourceKind: "pdf",
      finalization: finalized,
    });
    assert.equal(critic.checks.repetition_absent, true);
    assert.equal(critic.checks.final_output_complete, true);
    assert.equal(critic.ok, true);
  });

  it("critic refuse finalization_status manquant quand finalization fournie vide", () => {
    const critic = evaluateFileAnalysisSufficiency({
      query: "analyse le fichier",
      reply: "### Identification\nFichier sujet.pdf. Structure courte.",
      depth: FILE_ANALYSIS_DEPTHS.SIMPLE,
      fileName: "sujet.pdf",
      artifactsPresent: true,
      sourceKind: "pdf",
      finalization: { finalization_status: "", measures: {} },
    });
    assert.equal(critic.checks.final_output_complete, false);
    assert.ok(critic.reasons.includes("missing_finalization_status"));
  });

  it("sans objet finalization — stubs (JS/SQL) restent permissifs sur répétition", () => {
    const critic = evaluateFileAnalysisSufficiency({
      query: "analyse le fichier",
      reply: "### Identification\napp.js\n### Structure\nExpress.",
      depth: FILE_ANALYSIS_DEPTHS.SIMPLE,
      fileName: "app.js",
      artifactsPresent: true,
      sourceKind: "js",
    });
    assert.equal(critic.checks.repetition_absent, true);
    assert.equal(critic.checks.final_output_complete, true);
  });

  it("rejected_incomplete → critic pas OK (final_output_complete false)", () => {
    const out = finalizeDocumentAnalysisText("");
    assert.equal(out.finalization_status, FINALIZATION_STATUS.REJECTED_INCOMPLETE);
    assert.match(out.text, /Analyse partielle — génération interrompue/);
    const critic = evaluateFileAnalysisSufficiency({
      query: "analyse le fichier",
      reply: out.text,
      depth: FILE_ANALYSIS_DEPTHS.SIMPLE,
      fileName: "sujet.pdf",
      artifactsPresent: true,
      sourceKind: "pdf",
      finalization: out,
    });
    assert.equal(critic.checks.final_output_complete, false);
    assert.equal(critic.ok, false);
    assert.ok(critic.reasons.includes("finalization_incomplete"));
  });
});
