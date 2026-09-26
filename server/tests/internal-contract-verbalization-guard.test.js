import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  detectInternalContractVerbalization,
  sanitizeInternalContractVerbalization,
} from "../src/agent/utils/quality-safety/internalContractVerbalizationGuard.js";
import { resolveInternalLeakFallback } from "../src/agent/policies/social/socialPatternPolicy.js";
import {
  enforceModeContract,
  RESPONSE_MODES,
} from "../src/agent/config/modeResponseContracts.js";
import { emitOnContent } from "../src/agent/utils/runtime/streamTextChunks.js";

const OBSERVED_LEAK =
  "Il faut que j'utilise du tutoiement obligatoire sans vouvoiement possible dans la réponse brève de 1 à 2 phrases maximum.";
const USEFUL_TAIL =
  "D'accord, tu veux des fiches pédagogiques sur Hermes Agent ?";
const OBSERVED = `${OBSERVED_LEAK} ${USEFUL_TAIL}`;
const HERMES_QUERY = "je veux faire des fiches pédagogiques sur hermes agent";
const HERMES_CTX = { query: HERMES_QUERY };

describe("internalContractVerbalizationGuard", () => {
  it("A — paraphrase observée : préambule retiré, suite conservée", () => {
    assert.equal(
      detectInternalContractVerbalization(OBSERVED, HERMES_CTX)?.kind,
      "preamble",
    );
    const out = sanitizeInternalContractVerbalization(OBSERVED, HERMES_CTX);
    assert.equal(out, USEFUL_TAIL);
    assert.doesNotMatch(out, /tutoiement obligatoire|vouvoiement possible|1 à 2 phrases/i);
  });

  it("B — adresse + longueur + agentif/prescriptif → détection", () => {
    const text =
      "Je dois utiliser le tutoiement obligatoire et 1 à 2 phrases maximum. On peut commencer.";
    assert.equal(
      detectInternalContractVerbalization(text, HERMES_CTX)?.kind,
      "preamble",
    );
    assert.equal(
      sanitizeInternalContractVerbalization(text, HERMES_CTX),
      "On peut commencer.",
    );
  });

  it("C — trois catégories de contrat → détection", () => {
    const text =
      "Il faut que j'utilise du tutoiement obligatoire sans vouvoiement, en français, 1 à 2 phrases maximum. Voici le fond.";
    assert.equal(
      detectInternalContractVerbalization(text, HERMES_CTX)?.kind,
      "preamble",
    );
    assert.equal(
      sanitizeInternalContractVerbalization(text, HERMES_CTX),
      "Voici le fond.",
    );
  });

  it("D — demande pédagogique tutoiement/vouvoiement préservée", () => {
    const query = "Explique-moi le tutoiement et le vouvoiement.";
    const text =
      "Il faut que j'utilise du tutoiement obligatoire sans vouvoiement possible dans la réponse brève de 1 à 2 phrases maximum. Le tutoiement, c'est tutoyer.";
    assert.equal(detectInternalContractVerbalization(text, { query }), null);
    assert.equal(sanitizeInternalContractVerbalization(text, { query }), text);
  });

  it("E — contrainte utilisateur « 1 à 2 phrases » préservée", () => {
    const query = "Réponds en 1 à 2 phrases.";
    const text = "Oui, je m'en tiens à l'essentiel. On part sur tes fiches Hermes.";
    assert.equal(detectInternalContractVerbalization(text, { query }), null);
    assert.equal(
      enforceModeContract(RESPONSE_MODES.SIMPLE_FAST, text, { query }),
      text,
    );
  });

  it("F — mot isolé tutoiement → pas de détection", () => {
    const text = "Le tutoiement est une forme d'adresse.";
    assert.equal(detectInternalContractVerbalization(text), null);
    assert.equal(sanitizeInternalContractVerbalization(text), text);
  });

  it("G — SIMPLE_FAST normal tutoie sans verbaliser la règle", () => {
    const text = "D'accord, tu veux des fiches pédagogiques sur Hermes Agent ?";
    assert.equal(detectInternalContractVerbalization(text), null);
    assert.equal(
      enforceModeContract(RESPONSE_MODES.SIMPLE_FAST, text),
      text,
    );
  });

  it("H — fuite seule → fallback interne non vide", () => {
    const out = sanitizeInternalContractVerbalization(OBSERVED_LEAK, HERMES_CTX);
    assert.equal(out, resolveInternalLeakFallback(""));
    assert.ok(out.trim().length > 0);
    assert.doesNotMatch(out, /tutoiement obligatoire/i);
  });

  it("I — enforceModeContract + emitOnContent : jamais le préambule", () => {
    const sanitized = enforceModeContract(
      RESPONSE_MODES.SIMPLE_FAST,
      OBSERVED,
      HERMES_CTX,
    );
    assert.equal(sanitized, USEFUL_TAIL);
    const chunks = [];
    emitOnContent(sanitized, (token) => chunks.push(token));
    const streamed = chunks.join("");
    assert.equal(streamed, USEFUL_TAIL);
    assert.doesNotMatch(streamed, /Il faut que j['’]utilise|tutoiement obligatoire/i);
  });

  it("J — premier passage Vault simulé sans query/history : texte inchangé", () => {
    assert.equal(detectInternalContractVerbalization(OBSERVED), null);
    assert.equal(sanitizeInternalContractVerbalization(OBSERVED), OBSERVED);
    const pass1 = enforceModeContract(RESPONSE_MODES.SIMPLE_FAST, OBSERVED);
    assert.equal(pass1, OBSERVED);
    assert.notEqual(pass1, resolveInternalLeakFallback(""));
  });

  it("K — second passage SIMPLE_FAST avec query Hermes : préambule retiré", () => {
    const pass2 = enforceModeContract(
      RESPONSE_MODES.SIMPLE_FAST,
      OBSERVED,
      HERMES_CTX,
    );
    assert.equal(pass2, USEFUL_TAIL);
    assert.doesNotMatch(pass2, /tutoiement obligatoire|vouvoiement possible/i);
    assert.ok(pass2.trim().length > 0);
  });

  it("L — double passage : fuite retirée seulement au second", () => {
    const pass1 = enforceModeContract(RESPONSE_MODES.SIMPLE_FAST, OBSERVED);
    assert.equal(pass1, OBSERVED);
    const pass2 = enforceModeContract(
      RESPONSE_MODES.SIMPLE_FAST,
      pass1,
      HERMES_CTX,
    );
    assert.equal(pass2, USEFUL_TAIL);
    assert.doesNotMatch(pass2, /Il faut que j['’]utilise|tutoiement obligatoire/i);
  });

  it("M — query pédagogique : premier passage inerte, second préserve", () => {
    const query = "Explique-moi le tutoiement et le vouvoiement.";
    const text =
      "Il faut que j'utilise du tutoiement obligatoire sans vouvoiement possible dans la réponse brève de 1 à 2 phrases maximum. Le tutoiement, c'est tutoyer.";
    const pass1 = enforceModeContract(RESPONSE_MODES.SIMPLE_FAST, text);
    assert.equal(pass1, text);
    const pass2 = enforceModeContract(RESPONSE_MODES.SIMPLE_FAST, pass1, {
      query,
    });
    assert.equal(pass2, text);
    assert.notEqual(pass2, resolveInternalLeakFallback(""));
  });

  it("N — contrainte utilisateur « 1 à 2 phrases » : pas de fallback", () => {
    const query = "Réponds en 1 à 2 phrases.";
    const text =
      "Oui, je m'en tiens à l'essentiel. On part sur tes fiches Hermes.";
    const pass1 = enforceModeContract(RESPONSE_MODES.SIMPLE_FAST, text);
    const pass2 = enforceModeContract(RESPONSE_MODES.SIMPLE_FAST, pass1, {
      query,
    });
    assert.equal(pass1, text);
    assert.equal(pass2, text);
    assert.notEqual(pass2, resolveInternalLeakFallback(""));
  });

  it("O — fuite seule + query non pédagogique : fallback interne non vide", () => {
    const out = enforceModeContract(
      RESPONSE_MODES.SIMPLE_FAST,
      OBSERVED_LEAK,
      HERMES_CTX,
    );
    assert.equal(out, resolveInternalLeakFallback(""));
    assert.ok(out.trim().length > 0);
    assert.doesNotMatch(out, /tutoiement obligatoire/i);
  });
});
