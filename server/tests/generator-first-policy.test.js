import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isGeneratorFirstIntent,
  isExistingFilePathAnalysisRequest,
} from "../../shared/generatorFirstPolicy.js";

const ANALYZE_DEMO =
  "bonjour tu veux bien faire une analyse du fichier qui se trouve dans le chemin projects/demo-citadelle/index.html";

const CREATE_INDEX =
  "Crée un fichier complet index.html. Sois extrêmement bref (< 30 lignes). Le code DOIT contenir exactement ces mots : 'slide 1', 'quiz', 'contacts', 'Q&A', 'sidebar' et 'navigation'.";

describe("generatorFirstPolicy — ADR-015", () => {
  it("bloque Forge sur analyse d'un chemin projects/.../index.html", () => {
    assert.equal(isExistingFilePathAnalysisRequest(ANALYZE_DEMO), true);
    assert.equal(isGeneratorFirstIntent(ANALYZE_DEMO), false);
  });

  it("autorise Generator-First sur création explicite fichier complet index.html", () => {
    assert.equal(isExistingFilePathAnalysisRequest(CREATE_INDEX), false);
    assert.equal(isGeneratorFirstIntent(CREATE_INDEX), true);
  });

  it("index.html seul dans un chemin sans create → pas Generator-First", () => {
    const q =
      "peux tu me dire ce que contient projects/demo-citadelle/index.html s'il te plaît ?";
    assert.equal(isGeneratorFirstIntent(q), false);
  });

  it("force override bypass pm", () => {
    assert.equal(isGeneratorFirstIntent("bypass pm pour index.html analyse"), true);
  });

  it("analyse sans verbe create → jamais Generator-First", () => {
    assert.equal(
      isGeneratorFirstIntent(
        "fais une analyse du fichier complet index.html joint à la conversation",
      ),
      false,
    );
  });

  it("Forme B dossier + filename — pas Generator-First", () => {
    const q =
      "analyse le fichier index.html qui est dans le dossier projects/demo-citadelle/";
    assert.equal(isExistingFilePathAnalysisRequest(q), true);
    assert.equal(isGeneratorFirstIntent(q), false);
  });
});
