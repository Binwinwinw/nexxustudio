import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  FORMAL_LETTER_CANONICAL_RESILIATION_CANAL_QUERY,
  FORMAL_LETTER_CANONICAL_RESILIATION_LIBRARY_QUERY,
  isFormalLetterTemplateRequest,
  extractFormalLetterTemplateSlots,
  buildFormalLetterTemplateReply,
  resolveFormalLetterTemplateShortCircuit,
  resolveFormalLetterTemplateIntentContractId,
} from "../src/agent/policies/delivery/index.js";
import {
  resolveIntentContract,
  shouldSkipWebSearchForIntent,
} from "../src/agent/config/intentContractRegistry.js";
import { isInformationSeekingWithTarget } from "../src/agent/utils/informationSeekingIntentGuards.js";
import { isDocumentSynthesisExcluded } from "../src/agent/policies/document/index.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import {
  buildRequestWorkup,
  understandQuery,
} from "../src/agent/policies/conversation/conversationQueryUnderstanding.js";
import { resolveActionDecision } from "../src/agent/policies/orchestration/index.js";
import {
  enforceModeContract,
  RESPONSE_MODES,
} from "../src/agent/config/modeResponseContracts.js";

describe("formalLetterTemplatePolicy", () => {
  it("détecte résiliation Canal+ modèle type", () => {
    assert.equal(
      isFormalLetterTemplateRequest(FORMAL_LETTER_CANONICAL_RESILIATION_CANAL_QUERY),
      true,
    );
    const slots = extractFormalLetterTemplateSlots(
      FORMAL_LETTER_CANONICAL_RESILIATION_CANAL_QUERY,
    );
    assert.equal(slots.kind, "resiliation");
    assert.equal(slots.recipientKey, "canal_plus");
    assert.match(slots.recipientLabel || "", /Canal\+/);
  });

  it("produit un template avec placeholders", () => {
    const reply = buildFormalLetterTemplateReply(
      FORMAL_LETTER_CANONICAL_RESILIATION_CANAL_QUERY,
      extractFormalLetterTemplateSlots(
        FORMAL_LETTER_CANONICAL_RESILIATION_CANAL_QUERY,
      ),
    );
    assert.match(reply, /\[Nom Prénom\]/);
    assert.match(reply, /\[Numéro d'abonné/);
    assert.match(reply, /Résiliation/);
    assert.match(reply, /Canal\+/);
    assert.doesNotMatch(reply, /sujet de niche/i);
  });

  it("produit un template bibliothèque sans logique télécom", () => {
    const query =
      "modèle de lettre de résiliation pour mon abonnement à la bibliothèque de Lyon";
    const slots = extractFormalLetterTemplateSlots(query);
    assert.equal(slots.recipientKey, "library");
    assert.equal(slots.libraryCity, "Lyon");
    const reply = buildFormalLetterTemplateReply(query, slots);
    assert.match(reply, /Service des abonnements/);
    assert.match(reply, /Bibliothèque municipale de Lyon/);
    assert.match(reply, /votre règlement/);
    assert.match(reply, /carte d'abonné/);
    assert.doesNotMatch(reply, /échéance de la période en cours/);
    assert.doesNotMatch(reply, /conditions de mon contrat/);
  });

  it("bibliothèque générique sans ville → placeholder", () => {
    const reply = buildFormalLetterTemplateReply(
      FORMAL_LETTER_CANONICAL_RESILIATION_LIBRARY_QUERY,
      extractFormalLetterTemplateSlots(FORMAL_LETTER_CANONICAL_RESILIATION_LIBRARY_QUERY),
    );
    assert.match(reply, /\[Nom de la ville\]/);
    assert.match(reply, /date souhaitée de fin/);
  });

  it("n'aspire pas une dissertation", () => {
    assert.equal(
      isFormalLetterTemplateRequest("rédige ma dissertation sur la laïcité"),
      false,
    );
  });

  it("contrat intent → FORMAL_LETTER_TEMPLATE, pas de web", () => {
    const { contract } = resolveIntentContract(
      FORMAL_LETTER_CANONICAL_RESILIATION_CANAL_QUERY,
      {},
    );
    assert.equal(contract.id, "FORMAL_LETTER_TEMPLATE");
    assert.equal(
      shouldSkipWebSearchForIntent(
        FORMAL_LETTER_CANONICAL_RESILIATION_CANAL_QUERY,
        {},
      ),
      true,
    );
  });

  it("exclu de information_seeking niche et document_synthesis", () => {
    assert.equal(
      isInformationSeekingWithTarget(
        "je cherche des informations sur courrier de résiliation Canal+ modèle type",
      ),
      false,
    );
    assert.equal(
      isDocumentSynthesisExcluded(FORMAL_LETTER_CANONICAL_RESILIATION_CANAL_QUERY),
      true,
    );
  });
});

describe("formalLetterTemplate — routage pipeline", () => {
  it("short-circuit → formal_letter_template_deterministic", async () => {
    const hit = await runConversationShortCircuit(
      FORMAL_LETTER_CANONICAL_RESILIATION_CANAL_QUERY,
    );
    assert.equal(hit?.path, "formal_letter_template_deterministic");
    assert.ok(hit?.reply);
    assert.match(hit.reply, /Canal\+/);
    assert.doesNotMatch(hit?.reply, /Forge|cadrage projet|sujet de niche/i);
  });

  it("cycle → evidence none, profil chat direct", () => {
    const u = understandQuery(FORMAL_LETTER_CANONICAL_RESILIATION_CANAL_QUERY);
    const cycle = buildRequestWorkup(
      FORMAL_LETTER_CANONICAL_RESILIATION_CANAL_QUERY,
      u,
    );
    assert.equal(cycle.evidence_requirement.level, "none");
    assert.equal(
      resolveFormalLetterTemplateIntentContractId(
        u,
        FORMAL_LETTER_CANONICAL_RESILIATION_CANAL_QUERY,
      ),
      "FORMAL_LETTER_TEMPLATE",
    );

    const action = resolveActionDecision(
      FORMAL_LETTER_CANONICAL_RESILIATION_CANAL_QUERY,
      u,
      cycle.intent_assessment,
      cycle.evidence_requirement,
    );
    assert.equal(action.profile, "chat");
    assert.equal(action.orchestratorMode, "direct");
    assert.equal(action.capabilities.web, false);
    assert.equal(action.capabilities.expertReasoning, false);
  });

  it("resolveFormalLetterTemplateShortCircuit structure", () => {
    const hit = resolveFormalLetterTemplateShortCircuit(
      "modèle de lettre de résiliation abonnement Orange",
    );
    assert.equal(hit?.path, "formal_letter_template_deterministic");
    assert.match(hit?.reply || "", /Orange/);
  });

  it("INSTANT + sectionedComposite ne tronque pas le template (6 lignes max sinon)", () => {
    const full = buildFormalLetterTemplateReply(
      FORMAL_LETTER_CANONICAL_RESILIATION_CANAL_QUERY,
      extractFormalLetterTemplateSlots(FORMAL_LETTER_CANONICAL_RESILIATION_CANAL_QUERY),
    );
    const truncated = enforceModeContract(RESPONSE_MODES.INSTANT, full, {});
    const preserved = enforceModeContract(RESPONSE_MODES.INSTANT, full, {
      allowRefusal: false,
      sectionedComposite: true,
    });
    assert.ok(full.split("\n").length > 6);
    assert.ok(truncated.split("\n").length <= 6);
    assert.equal(preserved, full);
    assert.match(preserved, /TSA 86712/);
    assert.match(preserved, /Cordialement/);
  });
});
