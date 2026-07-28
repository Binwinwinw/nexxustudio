import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { isAnalyticalCritiqueIntent } from "../src/agent/utils/analyticalCritiqueIntentGuards.js";
import { isDocumentAnalysisIntent } from "../src/agent/utils/conversationGuards.js";
import {
  buildAnalyticalCritiqueFallback,
  getAnalyticalCritiqueSystemHint,
} from "../src/agent/micro/replies/analyticalCritiqueReplyBuilder.js";

const LONG_RUNTIME_PASTE = `
Verdict technique
1 Réponse méta OK si le texte commence par Sur mes fonctionnalités actuelles
2 Même réponse = variante ignorée — ancien template options structurées sans sur-promesse
3 Forge → refus — pas d'intent Forge en runtime ancien → SIMPLE_FAST + refus
Preuve : le serveur n'exécute pas le patch actuel. grep à zéro pour cadrer une idée.
Sous-intents capability_learn capability_gaps forge_status. Tests passent en local.
Décalage nodemon npm run start short-circuit meta_conversation_deterministic capability_gaps.
Synthèse : matcher ≠ réfléchir. Cause probable instance Node non rechargée.
`.trim();

describe("analyticalCritiqueIntentGuards", () => {
  it("détecte le pavé de test UI (Analyse ce qui suit + routage)", () => {
    const q =
      "Analyse ce qui suit :\n\nTon pavé contient analyse, verdict, runtime, patch.\n" +
      "Le pipeline va-t-il le classer en Document Analysis extractif ou en méta-analyse argumentative ?\n" +
      "Si mauvais routage : Points clés extraits.\nSi bon routage : ## Objet, ## Lecture.";
    assert.ok(isAnalyticalCritiqueIntent(q));
    assert.equal(isDocumentAnalysisIntent(q), false);
  });

  it("détecte une demande explicite courte (analyser une analyse)", () => {
    const q =
      "j'ai fait la citadelle analyser une analyse — quel échec : elle a seulement extrait des points clés.";
    assert.ok(isAnalyticalCritiqueIntent(q));
    assert.equal(isDocumentAnalysisIntent(q), false);
  });

  it("détecte un pavé diagnostic runtime (méta-analyse, pas document)", () => {
    assert.ok(isAnalyticalCritiqueIntent(LONG_RUNTIME_PASTE));
    assert.equal(isDocumentAnalysisIntent(LONG_RUNTIME_PASTE), false);
  });

  it("rejette les pièces jointes texte (vrai document analysis)", () => {
    const attachments = [{ mimetype: "application/pdf", originalname: "rapport.pdf" }];
    assert.equal(isAnalyticalCritiqueIntent("analyse ce document " + "x".repeat(200), attachments), false);
  });

  it("hint interdit l'extraction extractive", () => {
    const hint = getAnalyticalCritiqueSystemHint();
    assert.match(hint, /INTERDIT.*Points clés extraits/i);
    assert.match(hint, /Chaîne causale/i);
  });

  it("fallback structurel (pas liste de faits)", () => {
    const fb = buildAnalyticalCritiqueFallback(LONG_RUNTIME_PASTE);
    assert.match(fb, /## Objet de la demande/);
    assert.match(fb, /décalage code/i);
    assert.ok(!/Points clés extraits/i.test(fb));
  });
});
