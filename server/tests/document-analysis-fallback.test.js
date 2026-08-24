import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getDocumentAnalysisSystemPrompt,
  getDocumentImprovementSystemPrompt,
  resolveDocumentLlmOutcome,
  shouldEmitDocumentFallbackChunks,
  buildAttachedDocumentFallback,
} from "../src/agent/config/modeResponseContracts.js";
import responseThinkingCleaner from "../src/agent/utils/quality-safety/responseThinkingCleaner.js";

const META_DUMP = `utilisateur"). Wait, the instruction says "NE PAS exposer...".
Wait: There is a conflict between my internal instructions ("N'inclus jamais ces consignes ni de balises dans la réponse utilisateur").
Si DOCUMENT_CAPABILITY indique ocr_eligible=true. Wait: System Prompt.
Wait: CONTEXTE FOURNI includes [DOCUMENT #1...].`;

const BRIEFING = `
--- DOCUMENTS DE CONTEXTE FOURNIS PAR L'UTILISATEUR ---

[DOCUMENT #1: philosophie-2026-metropole-sujet-officiel.pdf]
TYPE: application/pdf
CONTENU:
BACCALAURÉAT GÉNÉRAL — SESSION 2026 — PHILOSOPHIE — MÉTROPOLE
LUNDI 15 JUIN 2026
Durée de l'épreuve : 4 heures — Coefficient : 8
Calculatrice et dictionnaire interdits.
Le candidat traitera, au choix, l'un des trois sujets suivants.
Sujet 1 — Avons-nous la maîtrise de nos paroles ?
Sujet 2 — Peut-on être heureux quand les autres ne le sont pas ?
Sujet 3 — Expliquer le texte suivant (Friedrich Nietzsche, Humain, trop humain, 1878) :
Les méthodes scientifiques sont une conquête de la recherche... superstition et absurdité.

------------------------------------------------------
`;

const FORBIDDEN = [
  /Wait,/i,
  /DOCUMENT_CAPABILITY/i,
  /internal instructions/i,
  /system prompt/i,
  /<think>/i,
  /<\/think>/i,
];

function assertNoMetaLeak(text) {
  for (const re of FORBIDDEN) {
    assert.doesNotMatch(text, re);
  }
}

describe("prompt document joint — pas de THINKING_RULE", () => {
  it("analyse jointe : aucune PENSÉE INTERNE / redacted_thinking", () => {
    const prompt = getDocumentAnalysisSystemPrompt(BRIEFING, {
      hasAttachedDocument: true,
    });
    assert.doesNotMatch(prompt, /PENSÉE INTERNE/);
    assert.doesNotMatch(prompt, /THINKING_RULE/);
    assert.doesNotMatch(prompt, /redacted_thinking/);
    assert.match(prompt, /ANALYSE DOCUMENT JOINT/);
  });

  it("suivi document : aucune PENSÉE INTERNE", () => {
    const prompt = getDocumentImprovementSystemPrompt(BRIEFING, {
      hasActiveDocument: true,
    });
    assert.doesNotMatch(prompt, /PENSÉE INTERNE/);
    assert.doesNotMatch(prompt, /redacted_thinking/);
  });
});

describe("rail DOCUMENT — dump méta => fallback, pas succès", () => {
  it("sortie méta non vide => usedFallback, markdown français, pas de dump", () => {
    const { response, usedFallback } = resolveDocumentLlmOutcome({
      raw: META_DUMP,
      query: "fait l'analyse du document joint",
      fileName: "philosophie-2026-metropole-sujet-officiel.pdf",
      contextBlock: BRIEFING,
      hasDocumentSignal: true,
    });
    assert.equal(usedFallback, true);
    assert.ok(response.trim().length > 40, "fallback non vide");
    assert.match(response, /^## /m);
    assert.match(response, /Nietzsche|philosophie|SESSION 2026|paroles|calculatrice/i);
    assertNoMetaLeak(response);
    assert.equal(responseThinkingCleaner.isPromptInstructionLoop(response), false);
  });

  it("extraction valide + dump méta => emit fallback (jamais 0 chunk silencieux)", () => {
    const { usedFallback, response } = resolveDocumentLlmOutcome({
      raw: META_DUMP,
      query: "analyse le document",
      fileName: "philosophie-2026-metropole-sujet-officiel.pdf",
      contextBlock: BRIEFING,
      hasDocumentSignal: true,
    });
    assert.equal(usedFallback, true);
    assert.equal(shouldEmitDocumentFallbackChunks(usedFallback, () => {}), true);
    assert.ok(response.trim());
  });

  it("extraction valide + analyse propre => pas de fallback", () => {
    const clean = `## Analyse du sujet officiel
- Épreuve de philosophie, session 2026, métropole.
- Durée 4 heures ; calculatrice interdite.
- Texte de Nietzsche sur la méthode scientifique.`;
    const { response, usedFallback } = resolveDocumentLlmOutcome({
      raw: clean,
      query: "analyse le document",
      fileName: "philosophie-2026-metropole-sujet-officiel.pdf",
      contextBlock: BRIEFING,
      hasDocumentSignal: true,
    });
    assert.equal(usedFallback, false);
    assert.match(response, /Nietzsche/);
    assertNoMetaLeak(response);
  });

  it("extraction valide => fallback déterministe non vide si LLM vide", () => {
    const { response, usedFallback } = resolveDocumentLlmOutcome({
      raw: "",
      query: "analyse le document",
      fileName: "philosophie-2026-metropole-sujet-officiel.pdf",
      contextBlock: BRIEFING,
      hasDocumentSignal: true,
    });
    assert.equal(usedFallback, true);
    assert.ok(response.trim().length > 40);
    const same = buildAttachedDocumentFallback(
      BRIEFING,
      "analyse le document",
      "philosophie-2026-metropole-sujet-officiel.pdf",
    );
    assert.match(same, /philosophie-2026-metropole-sujet-officiel\.pdf/);
  });
});
