import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isFamiliarityIntent,
  getFamiliarityDeterministicReply,
  parseFamiliarityQuery,
  resolveFamiliarityReplyMode,
  FAMILIARITY_REPLY_MODES,
  classifySubjectCategory,
  classifyPlaceSubtype,
  classifyPersonSubtype,
  resolveFamiliaritySubject,
  formatSubjectSurfaceForm,
  familiarityUsesMainEntityOpening,
  FAMILIARITY_MAIN_ENTITY_OPENING_RULE,
  SUBJECT_CATEGORIES,
  PLACE_SUBTYPES,
  PERSON_SUBTYPES,
} from "../src/agent/utils/familiarityIntentGuards.js";
import {
  enforceModeContract,
  evaluateEpistemicRefusal,
  INSUFFICIENT_SIGNAL_REFUSAL,
  RESPONSE_MODES,
} from "../src/agent/config/modeResponseContracts.js";

describe("contrat familiarité — détection", () => {
  it('détecte « est-ce que tu connais Teams 365 ? »', () => {
    const query = "est-ce que tu connais Teams 365 ?";
    assert.equal(isFamiliarityIntent(query), true);
    assert.equal(parseFamiliarityQuery(query)?.kind, "recognition");
  });

  it("détecte les variantes de reconnaissance", () => {
    for (const query of [
      "Tu connais Obsidian ?",
      "Tu connais Docker ?",
      "Tu sais ce que c'est que RAG ?",
      "Tu connais le musée du Louvre ?",
    ]) {
      assert.equal(isFamiliarityIntent(query), true, query);
    }
  });

  it("détecte les questions de définition et d'aide", () => {
    assert.equal(parseFamiliarityQuery("C'est quoi Docker ?")?.kind, "definition");
    assert.equal(
      parseFamiliarityQuery("Tu peux m'aider sur Teams 365 ?")?.kind,
      "help",
    );
  });

  it("exclut les requêtes techniques", () => {
    assert.equal(
      isFamiliarityIntent("analyse ce fichier docker compose"),
      false,
    );
  });
});

describe("contrat familiarité — catégories sémantiques", () => {
  it("classe Teams 365 en tool_platform", () => {
    const subject = resolveFamiliaritySubject("teams 365");
    assert.equal(classifySubjectCategory(subject), SUBJECT_CATEGORIES.TOOL_PLATFORM);
  });

  it("classe le RAG en concept_method", () => {
    const subject = resolveFamiliaritySubject("rag");
    assert.equal(classifySubjectCategory(subject), SUBJECT_CATEGORIES.CONCEPT_METHOD);
  });

  it("classe le Louvre en place_institution", () => {
    const subject = resolveFamiliaritySubject("musée du louvre");
    assert.equal(classifySubjectCategory(subject), SUBJECT_CATEGORIES.PLACE_INSTITUTION);
  });

  it("classe OpenAI en person_entity", () => {
    const subject = resolveFamiliaritySubject("openai");
    assert.equal(classifySubjectCategory(subject), SUBJECT_CATEGORIES.PERSON_ENTITY);
  });

  it("classe l'Italie en country_region", () => {
    const subject = resolveFamiliaritySubject("l italie");
    assert.equal(classifyPlaceSubtype(subject), PLACE_SUBTYPES.COUNTRY_REGION);
    assert.equal(subject.label, "l'Italie");
  });

  it("classe Rome en city_place", () => {
    const subject = resolveFamiliaritySubject("rome");
    assert.equal(classifyPlaceSubtype(subject), PLACE_SUBTYPES.CITY_PLACE);
    assert.equal(subject.label, "Rome");
  });
});

describe("contrat familiarité — forme de surface", () => {
  it("reconstruit l'Italie depuis « l italie »", () => {
    assert.equal(formatSubjectSurfaceForm("l italie"), "l'Italie");
    assert.equal(formatSubjectSurfaceForm("l'Italie"), "l'Italie");
  });

  it("reconstruit le musée du Louvre", () => {
    assert.equal(
      formatSubjectSurfaceForm("le musee du louvre"),
      "le musée du Louvre",
    );
  });

  it("reconstruit la Martinique", () => {
    assert.equal(formatSubjectSurfaceForm("la martinique"), "la Martinique");
  });
});

describe("contrat familiarité — réponses par registre", () => {
  function assertSimpleRecognition(reply, labelPattern) {
    assert.match(reply, labelPattern);
    const lines = reply.split("\n").filter(Boolean);
    assert.ok(lines.length <= 2, `trop de lignes : ${lines.length}`);
    assert.doesNotMatch(reply, /je peux t'aider concernant/i);
    assert.doesNotMatch(reply, /Je peux t'en parler simplement/i);
  }

  it("Teams 365 — reconnaissance brève outil", () => {
    const reply = getFamiliarityDeterministicReply("Tu connais Teams 365 ?");
    assertSimpleRecognition(reply, /Oui, je connais Teams 365/i);
    assert.match(reply, /aperçu ou tu as une question précise|t'en parle rapidement/i);
  });

  it("Docker — définition technique courte", () => {
    const reply = getFamiliarityDeterministicReply("C'est quoi Docker ?");
    assert.match(reply, /Docker/i);
    assert.match(reply, /conteneur/i);
    assert.match(reply, /aperçu|aide concrète|implémenter/i);
  });

  it("Louvre — reconnaissance brève lieu", () => {
    const reply = getFamiliarityDeterministicReply("Tu connais le musée du Louvre ?");
    assertSimpleRecognition(reply, /je connais le musée du Louvre/i);
    assert.match(reply, /t'en parle rapidement|aperçu ou tu as une question précise/i);
    assert.doesNotMatch(reply, /\bconfigurer\b/i);
  });

  it("Martinique — reconnaissance brève pays", () => {
    const reply = getFamiliarityDeterministicReply("Tu connais la Martinique ?");
    assertSimpleRecognition(reply, /je connais la Martinique/i);
    assert.doesNotMatch(reply, /\bconfigurer\b/i);
    assert.doesNotMatch(reply, /L Martinique/i);
  });

  it("Italie — reconnaissance brève avec forme linguistique correcte", () => {
    const reply = getFamiliarityDeterministicReply("Tu connais l'Italie ?");
    assertSimpleRecognition(reply, /je connais l'Italie/i);
    assert.doesNotMatch(reply, /L Italie/i);
    assert.doesNotMatch(reply, /voyage, culture, histoire/i);
  });

  it("France — reconnaissance brève pays", () => {
    const reply = getFamiliarityDeterministicReply("Tu connais la France ?");
    assertSimpleRecognition(reply, /je connais la France/i);
  });

  it("Rome — reconnaissance brève ville", () => {
    const reply = getFamiliarityDeterministicReply("Tu connais Rome ?");
    assertSimpleRecognition(reply, /je connais Rome/i);
    assert.doesNotMatch(reply, /configurer/i);
  });

  it("Paris — reconnaissance brève ville", () => {
    const reply = getFamiliarityDeterministicReply("Tu connais Paris ?");
    assertSimpleRecognition(reply, /je connais Paris/i);
  });

  it("OpenAI — reconnaissance brève organisation", () => {
    const reply = getFamiliarityDeterministicReply("Tu connais OpenAI ?");
    assertSimpleRecognition(reply, /OpenAI/i);
    assert.doesNotMatch(reply, /\bconfigurer\b/i);
  });

  it("Michael Jackson — extrait l'entité principale et corrige l'orthographe", () => {
    const rawSubject = "mickael jackson et quelques-unes de ses chansons";
    const subject = resolveFamiliaritySubject(rawSubject);
    assert.equal(subject.label, "Michael Jackson");
    assert.equal(classifyPersonSubtype(subject), PERSON_SUBTYPES.CELEBRITY);
    assert.equal(classifySubjectCategory(subject), SUBJECT_CATEGORIES.PERSON_ENTITY);
    assert.doesNotMatch(subject.label, /Quelques-unes|Et Quelques/i);
  });

  it("Michael Jackson — registre célébrité brève", () => {
    const query = "Tu connais mickael jackson et quelques-unes de ses chansons ?";
    const reply = getFamiliarityDeterministicReply(query);
    assertSimpleRecognition(reply, /je connais Michael Jackson/i);
    assert.doesNotMatch(reply, /Quelques-unes De Ses Chansons/i);
    assert.doesNotMatch(reply, /Et Quelques/i);
    assert.doesNotMatch(reply, /carrière, de ses chansons/i);
  });

  it("Michael Jackson — patron « et ses albums »", () => {
    const rawSubject = "michael jackson et ses albums";
    const subject = resolveFamiliaritySubject(rawSubject);
    assert.equal(subject.label, "Michael Jackson");
    assert.equal(classifyPersonSubtype(subject), PERSON_SUBTYPES.CELEBRITY);
    assert.equal(familiarityUsesMainEntityOpening(subject, rawSubject), true);

    const reply = getFamiliarityDeterministicReply("Tu connais michael jackson et ses albums ?");
    assert.match(reply, /je connais Michael Jackson/i);
    assert.doesNotMatch(reply, /ses albums/i);
    assert.doesNotMatch(reply, /Et Ses Albums/i);
  });

  it("Taylor Swift — patron « et quelques chansons »", () => {
    const rawSubject = "taylor swift et quelques chansons";
    const subject = resolveFamiliaritySubject(rawSubject);
    assert.equal(subject.label, "Taylor Swift");
    assert.equal(classifyPersonSubtype(subject), PERSON_SUBTYPES.CELEBRITY);
    assert.equal(familiarityUsesMainEntityOpening(subject, rawSubject), true);

    const reply = getFamiliarityDeterministicReply("Tu connais taylor swift et quelques chansons ?");
    assertSimpleRecognition(reply, /je connais Taylor Swift/i);
    assert.doesNotMatch(reply, /Quelques Chansons/i);
  });

  it("règle main_entity_only — ouverture sur entité, pas sur complément", () => {
    const cases = [
      "mickael jackson et quelques-unes de ses chansons",
      "michael jackson et ses albums",
      "taylor swift et quelques chansons",
    ];
    for (const rawSubject of cases) {
      const subject = resolveFamiliaritySubject(rawSubject);
      assert.equal(
        familiarityUsesMainEntityOpening(subject, rawSubject),
        true,
        rawSubject,
      );
      const reply = getFamiliarityDeterministicReply(`Tu connais ${rawSubject} ?`);
      const opening = reply.split("\n")[0];
      assert.doesNotMatch(opening, /\bEt Quelques\b/i, rawSubject);
      assert.doesNotMatch(opening, /\bDe Ses\b/i, rawSubject);
      assert.doesNotMatch(opening, /\bSes Albums\b/i, rawSubject);
    }
  });

  it("RAG — définition concept brève", () => {
    const reply = getFamiliarityDeterministicReply("Tu connais le RAG ?");
    assertSimpleRecognition(reply, /RAG/i);
    assert.doesNotMatch(reply, /\bconfigurer\b/i);
  });

  it("respecte le contrat INSTANT sans refus épistémique", () => {
    const reply = getFamiliarityDeterministicReply("Tu connais Docker ?");
    const out = enforceModeContract(RESPONSE_MODES.INSTANT, reply, {
      allowRefusal: false,
    });
    assert.notEqual(out, INSUFFICIENT_SIGNAL_REFUSAL);
  });

  it("bénéficie de l'exception épistémique familiarity_recognition", () => {
    const out = evaluateEpistemicRefusal({
      query: "Tu connais Teams 365 ?",
      responseText: "",
      allowRefusal: true,
    });
    assert.equal(out.shouldRefuse, false);
    assert.equal(out.reason, "familiarity_recognition");
  });
});

describe("contrat familiarité — mode simple_known_subject", () => {
  const SIMPLE_CASES = [
    { query: "Tu connais la pétanque ?", label: /pétanque/i, forbidden: /Petanque|je peux t'aider concernant/i },
    { query: "Tu connais le football ?", label: /football/i, forbidden: /je peux t'aider concernant/i },
    { query: "Tu connais l'Italie ?", label: /l'Italie/i, forbidden: /voyage, culture, histoire|je peux t'aider concernant/i },
    { query: "Tu connais Michael Jackson ?", label: /Michael Jackson/i, forbidden: /je peux t'aider concernant/i },
    { query: "Tu connais le musée du Louvre ?", label: /musée du Louvre/i, forbidden: /je peux t'aider concernant|préparer une visite/i },
  ];

  for (const { query, label, forbidden } of SIMPLE_CASES) {
    it(`reconnaissance brève — ${query}`, () => {
      const parsed = parseFamiliarityQuery(query);
      const subject = resolveFamiliaritySubject(parsed.rawSubject);
      assert.equal(
        resolveFamiliarityReplyMode(parsed, subject),
        FAMILIARITY_REPLY_MODES.SIMPLE_KNOWN_SUBJECT,
      );

      const reply = getFamiliarityDeterministicReply(query);
      assert.match(reply, /Oui, je connais/i);
      assert.match(reply, label);
      assert.doesNotMatch(reply, forbidden);
      assert.ok(reply.split("\n").filter(Boolean).length <= 2);
    });
  }
});
