import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateDocumentVisibleQuality } from "../src/agent/policies/document/documentVisibleQuality.js";
import { resolveDocumentLlmOutcome } from "../src/agent/config/modeResponseContracts.js";

const LIVE_587_EXCERPT = `Type de fichier et Contexte d'analyse
Format du contenu : Document numérique en format texte extrait depuis un document physique ou électronique (application/pdf).
Rôle/Objectif du document : Document officiel pour un examen philosophique (Baccalauréat Général Session 2026). Il contient une citation d'un extrait de Nietzsche sur la méthode scientifique et les hypothèses humaines.
### Points Clés Extraits et Synthétisés
- Critique de la méthode scientifique : Les méthodes scientifiques sont considérées comme une conquête importante.
- Friedrich NIETZSCHE. Titre original mentionné Humain trop humain. Date d'origine 1878.
- Conséquences politiques : chacun devrait apprendre une science pour avoir cette prudence extrême.
Date d'événement : Lundi 15 Juin 2026.`;

const META_DUMP = `Wait, the instruction says "NE PAS exposer...". DOCUMENT_CAPABILITY ocr_eligible=true. System Prompt. internal instructions.`;

describe("qualité visible DOCUMENT — distinct de response_length", () => {
  it("extrait 587 chunks : français, PDF, markdown, sans dump méta", () => {
    const q = evaluateDocumentVisibleQuality(LIVE_587_EXCERPT);
    assert.ok(q.response_length > 0);
    assert.equal(q.ok, true, `failures=${q.failures.join(",")}`);
    assert.equal(q.failures.includes("wait"), false);
    assert.equal(q.failures.includes("document_capability"), false);
    assert.equal(q.failures.includes("system_prompt"), false);
    assert.equal(q.failures.includes("think_tag"), false);
    assert.equal(q.failures.includes("internal_instructions"), false);
  });

  it("dump méta : response_length > 0 ne suffit pas", () => {
    assert.ok(META_DUMP.length > 0);
    const q = evaluateDocumentVisibleQuality(META_DUMP);
    assert.equal(q.ok, false);
    assert.ok(q.failures.includes("wait"));
    assert.ok(q.failures.includes("document_capability"));
    assert.ok(q.failures.includes("system_prompt"));
  });

  it("fallback déterministe : length > 0 et qualité visible", () => {
    const briefing = `
--- DOCUMENTS DE CONTEXTE FOURNIS PAR L'UTILISATEUR ---

[DOCUMENT #1: philosophie-2026-metropole-sujet-officiel.pdf]
TYPE: application/pdf
CONTENU:
BACCALAURÉAT GÉNÉRAL SESSION 2026 PHILOSOPHIE
Durée de l'épreuve : 4 heures
Friedrich Nietzsche, Humain, trop humain
------------------------------------------------------
`;
    const { response, usedFallback } = resolveDocumentLlmOutcome({
      raw: META_DUMP,
      query: "fait l'analyse du document joint",
      fileName: "philosophie-2026-metropole-sujet-officiel.pdf",
      contextBlock: briefing,
      hasDocumentSignal: true,
    });
    assert.equal(usedFallback, true);
    assert.ok(response.length > 0);
    const q = evaluateDocumentVisibleQuality(response);
    assert.equal(q.ok, true, `failures=${q.failures.join(",")}`);
  });
});
