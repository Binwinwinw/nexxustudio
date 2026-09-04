import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isAttachmentWorkRequest,
  isAttachmentPresentWithoutWorkRequest,
  isMisplacedClarificationReply,
  hasContentEvidence,
  evaluateAttachmentReadMandate,
  buildAttachmentMandateRepairReply,
  resolveAttachmentFraming,
  classifyAttachmentTask,
  reconcileCriticFileUseVerdict,
  ATTACHMENT_TASKS,
  MANDATE_DEFECTS,
  ATTACHMENT_READ_MANDATE_RULE,
  ATTACHMENT_READ_MANDATE_CONTRACT,
} from "../src/agent/policies/attachment/index.js";
import { evaluateFileContextGuard } from "../src/agent/policies/guards/fileContextGuard.js";
import { evaluateClarificationDecision } from "../src/agent/policies/routing/clarificationDecisionPolicy.js";
import { INSUFFICIENT_SIGNAL_REFUSAL } from "../src/agent/config/modeResponseContracts.js";
import { isImageOnlyAttachments } from "../src/agent/utils/conversation/conversationGuards.js";

const GUIDE_HTML = {
  originalname: "Guide de remédiation 3ème _ Programmes 2025.html",
};
const INGESTED = `
Guide de remédiation 3ème — Programmes 2025
Compétences travaillées : lecture, écriture, calcul mental.
Séance 1 : diagnostic des écarts au programme.
Séance 2 : ateliers différenciés par groupe de besoin.
`;
const QUERY =
  "analyse le fichier joint pour proposer des axes d'améliorations de celui-ci";

describe("attachmentReadMandate — doctrine", () => {
  it("détecte une demande de travail sur joint", () => {
    assert.equal(isAttachmentWorkRequest(QUERY, [GUIDE_HTML]), true);
    assert.equal(isAttachmentWorkRequest("comment ça va ?", []), false);
    assert.equal(isAttachmentWorkRequest("fais quelque chose", []), false);
  });

  it("piste = clarification mal placée", () => {
    assert.equal(isMisplacedClarificationReply(INSUFFICIENT_SIGNAL_REFUSAL), true);
    assert.equal(isMisplacedClarificationReply("Séance 1 : diagnostic des écarts"), false);
  });

  it("preuve d'ancrage : tokens du fichier, pas le verbe métier", () => {
    assert.equal(
      hasContentEvidence(
        "Le guide vise la remédiation : séance 1 diagnostic, puis ateliers différenciés.",
        INGESTED,
      ),
      true,
    );
    assert.equal(
      hasContentEvidence(
        "Voici des axes d'amélioration génériques pour tout document HTML.",
        INGESTED,
      ),
      false,
    );
  });

  it("piste + joint → défauts clarification + ancrage ensemble", () => {
    const verdict = evaluateAttachmentReadMandate({
      query: QUERY,
      attachments: [GUIDE_HTML],
      ingestedText: INGESTED,
      reply: INSUFFICIENT_SIGNAL_REFUSAL,
    });
    assert.equal(verdict.applies, true);
    assert.equal(verdict.ok, false);
    assert.ok(verdict.defects.includes(MANDATE_DEFECTS.MISPLACED_CLARIFICATION));
    assert.ok(verdict.defects.includes(MANDATE_DEFECTS.UNANCHORED));
    assert.ok(verdict.layers.includes("clarification"));
    assert.ok(verdict.layers.includes("anchoring"));
    assert.equal(verdict.rule, ATTACHMENT_READ_MANDATE_RULE);
  });

  it("sans lecture → unread, pas d'analyse inventée", () => {
    const verdict = evaluateAttachmentReadMandate({
      query: QUERY,
      attachments: [GUIDE_HTML],
      ingestedText: "",
      reply: "Voici des axes d'amélioration pour ton HTML.",
    });
    assert.ok(verdict.defects.includes(MANDATE_DEFECTS.UNREAD));
    const repair = buildAttachmentMandateRepairReply({
      query: QUERY,
      attachments: [GUIDE_HTML],
      ingestedText: "",
      defects: verdict.defects,
    });
    assert.match(repair, /Lecture obligatoire/i);
    assert.doesNotMatch(repair, /Je vois la piste/i);
  });

  it("fichier lu + extraits dans la réponse → ok", () => {
    const verdict = evaluateAttachmentReadMandate({
      query: QUERY,
      attachments: [GUIDE_HTML],
      ingestedText: INGESTED,
      reply:
        "Le Guide de remédiation 3ème ancre la séance 1 sur le diagnostic des écarts, puis des ateliers différenciés.",
    });
    assert.equal(verdict.ok, true);
    assert.deepEqual(verdict.defects, []);
  });
});

describe("attachmentReadMandate — chemin de décision", () => {
  it("clarification : joint + analyse → can_answer_now", () => {
    const d = evaluateClarificationDecision(QUERY, {}, null, [], [GUIDE_HTML]);
    assert.equal(d.decision, "can_answer_now");
    assert.match(d.reason, /attachment_work/);
  });

  it("file guard : piste remplacée par ancrage, pas pass-through", () => {
    const guard = evaluateFileContextGuard({
      query: QUERY,
      response: INSUFFICIENT_SIGNAL_REFUSAL,
      attachments: [GUIDE_HTML],
      ingestedText: INGESTED,
    });
    assert.equal(guard.ok, false);
    assert.equal(guard.action, "blocked");
    assert.match(guard.blockedMessage, /Preuves lues/i);
    assert.match(guard.blockedMessage, /diagnostic des écarts/i);
    assert.doesNotMatch(guard.blockedMessage, /Je vois la piste/i);
  });

  it("file guard : réponse vide + joint → pas un pass silencieux", () => {
    const guard = evaluateFileContextGuard({
      query: QUERY,
      response: "",
      attachments: [GUIDE_HTML],
      ingestedText: INGESTED,
    });
    assert.equal(guard.ok, false);
    assert.equal(guard.action, "blocked");
  });
});

describe("attachmentReadMandate — contrat + frontières", () => {
  it("contrat expose trigger, preuves, arrêts, clarify, priorité", () => {
    const c = ATTACHMENT_READ_MANDATE_CONTRACT;
    assert.equal(c.id, "ATTACHMENT_READ_MANDATE_V1");
    assert.ok(c.trigger.anyOf.length >= 2);
    assert.equal(c.evidenceMinima.distinctiveTokens, 2);
    assert.ok(c.legitimateStops.includes("unreadable"));
    assert.ok(c.clarificationForbiddenWhen.includes("readable_file_even_if_improve_is_vague"));
    assert.deepEqual(c.framingPriority, ["request_nature", "work_verb", "file_type"]);
    assert.equal(c.frontiers.image_only_attachment, "no_mandate_vision");
  });

  it("HTML pédagogique + améliorer → document (verbe > type)", () => {
    const framing = resolveAttachmentFraming(QUERY, [GUIDE_HTML]);
    assert.equal(framing.fileKind, "document");
    assert.equal(framing.winner, "work_verb");
    assert.equal(classifyAttachmentTask(QUERY, [GUIDE_HTML]).task, ATTACHMENT_TASKS.DOC_IMPROVE);
  });

  it("HTML + corriger / sécu → code (nature > verbe > type)", () => {
    const files = [{ originalname: "index.html" }];
    const fix = resolveAttachmentFraming("corrige le fichier joint", files);
    assert.equal(fix.fileKind, "code");
    assert.equal(fix.winner, "request_nature");
    const secQuery = "analyse le fichier joint pour un audit sécurité";
    const sec = resolveAttachmentFraming(secQuery, files);
    assert.equal(sec.winner, "request_nature");
    assert.equal(classifyAttachmentTask(secQuery, files).task, ATTACHMENT_TASKS.SECURITY_AUDIT);
  });

  it("PJ illisible → arrêt, pas d'axes inventés", () => {
    const verdict = evaluateAttachmentReadMandate({
      query: QUERY,
      attachments: [GUIDE_HTML],
      ingestedText: "",
      readStatus: "unreadable",
      reply: "",
    });
    assert.ok(verdict.defects.includes(MANDATE_DEFECTS.UNREAD));
    const repair = buildAttachmentMandateRepairReply({
      query: QUERY,
      attachments: [GUIDE_HTML],
      readStatus: "unreadable",
      defects: verdict.defects,
    });
    assert.match(repair, /illisible/i);
    assert.doesNotMatch(repair, /Je vois la piste/i);
  });

  it("PJ vide → arrêt légitime", () => {
    const verdict = evaluateAttachmentReadMandate({
      query: QUERY,
      attachments: [GUIDE_HTML],
      ingestedText: "   ",
      readStatus: "empty",
      reply: "Voici des axes génériques.",
    });
    assert.ok(verdict.defects.includes(MANDATE_DEFECTS.UNREAD));
  });

  it("PJ présente sans demande exploitable → mandat inactif, clarify licite", () => {
    assert.equal(isAttachmentWorkRequest("salut", [GUIDE_HTML]), false);
    assert.equal(isAttachmentPresentWithoutWorkRequest("salut", [GUIDE_HTML]), true);
    const verdict = evaluateAttachmentReadMandate({
      query: "salut",
      attachments: [GUIDE_HTML],
      ingestedText: INGESTED,
      reply: "Tout va bien ici.",
    });
    assert.equal(verdict.applies, false);
    const d = evaluateClarificationDecision("fais quelque chose", {}, null, [], [GUIDE_HTML]);
    assert.notEqual(d.reason, "attachment_work_no_objective_clarify");
  });

  it("amélioration vague + fichier lisible → mandat, pas clarify objectif", () => {
    const q = "améliore ça";
    assert.equal(isAttachmentWorkRequest(q, [GUIDE_HTML]), true);
    const d = evaluateClarificationDecision(q, {}, null, [], [GUIDE_HTML]);
    assert.equal(d.decision, "can_answer_now");
    const generic = evaluateAttachmentReadMandate({
      query: q,
      attachments: [GUIDE_HTML],
      ingestedText: INGESTED,
      reply: "Voici des axes d'amélioration génériques pour tout document HTML.",
    });
    assert.ok(generic.defects.includes(MANDATE_DEFECTS.UNANCHORED));
  });
});

describe("attachmentReadMandate — trois dérives encore bloquées", () => {
  it("D1 réponse générique sans usage du joint", () => {
    const v = evaluateAttachmentReadMandate({
      query: QUERY,
      attachments: [GUIDE_HTML],
      ingestedText: INGESTED,
      reply: "Un document HTML se structure mieux avec des titres clairs.",
    });
    assert.equal(v.ok, false);
    assert.ok(v.defects.includes(MANDATE_DEFECTS.UNANCHORED));
  });

  it("D2 clarification d'objectif alors que le joint est la cible", () => {
    const v = evaluateAttachmentReadMandate({
      query: QUERY,
      attachments: [GUIDE_HTML],
      ingestedText: INGESTED,
      reply: INSUFFICIENT_SIGNAL_REFUSAL,
    });
    assert.ok(v.defects.includes(MANDATE_DEFECTS.MISPLACED_CLARIFICATION));
    const d = evaluateClarificationDecision(QUERY, {}, null, [], [GUIDE_HTML]);
    assert.equal(d.decision, "can_answer_now");
  });

  it("D3 mauvais cadrage document/code sur HTML pédagogique", () => {
    const framing = resolveAttachmentFraming(QUERY, [GUIDE_HTML]);
    assert.equal(framing.fileKind, "document");
    assert.notEqual(framing.winner, "file_type");
    const analyseHtml = classifyAttachmentTask("analyse le fichier joint", [
      { originalname: "index.html" },
    ]);
    assert.equal(analyseHtml.fileKind, "document");
    assert.equal(analyseHtml.task, ATTACHMENT_TASKS.DOC_ANALYZE);
    const codeReview = classifyAttachmentTask("revue le fichier joint", [
      { originalname: "index.html" },
    ]);
    assert.equal(codeReview.fileKind, "code");
  });
});

describe("critic file-use reconcile", () => {
  it("annule file_not_used si la réponse ancre le briefing", () => {
    const out = reconcileCriticFileUseVerdict(
      {
        verdict: "fail",
        reasons: ["file_not_used", "generic_answer_without_document"],
      },
      "Le Guide de remédiation 3ème ancre la séance 1 sur le diagnostic des écarts, puis des ateliers différenciés.",
      INGESTED,
    );
    assert.equal(out.verdict, "ok");
    assert.deepEqual(out.reasons, []);
  });
});

describe("attachmentReadMandate — image raster ≠ document vide", () => {
  const QUERY_ANALYSE = "analyse le fichier";
  const RASTERS = [
    { originalname: "capture.png", mimetype: "image/png" },
    { originalname: "photo.jpg", mimetype: "image/jpeg" },
    { originalname: "photo.jpeg", mimetype: "image/jpeg" },
    { originalname: "clip.gif", mimetype: "image/gif" },
    { originalname: "shot.webp", mimetype: "image/webp" },
  ];
  const JPEG = RASTERS[1];

  it("isImageOnlyAttachments : image/* (pas PNG seulement)", () => {
    for (const file of RASTERS) {
      assert.equal(isImageOnlyAttachments([file]), true, file.mimetype);
    }
    assert.equal(isImageOnlyAttachments([{ mimetype: "image/jpeg" }]), true);
    assert.equal(isImageOnlyAttachments([RASTERS[0], GUIDE_HTML]), false);
    assert.equal(
      isImageOnlyAttachments([{ mimetype: "image/svg+xml", originalname: "icon.svg" }]),
      false,
    );
    assert.equal(
      isImageOnlyAttachments([{ originalname: "photo.jpg" }]),
      true,
    );
  });

  for (const file of RASTERS) {
    it(`trigger lexical inactif sur ${file.mimetype} (${file.originalname})`, () => {
      assert.equal(isAttachmentWorkRequest(QUERY_ANALYSE, [file]), false);
      assert.equal(isAttachmentPresentWithoutWorkRequest(QUERY_ANALYSE, [file]), false);
      const verdict = evaluateAttachmentReadMandate({
        query: QUERY_ANALYSE,
        attachments: [file],
        ingestedText: "",
        reply: "",
      });
      assert.equal(verdict.applies, false);
      assert.equal(verdict.ok, true);
    });
  }

  it("HTML texte reste sous mandat", () => {
    assert.equal(isAttachmentWorkRequest(QUERY_ANALYSE, [GUIDE_HTML]), true);
  });

  it("JPEG : file guard ne remplace pas par « fichier vide »", () => {
    const guard = evaluateFileContextGuard({
      query: QUERY_ANALYSE,
      response: "Un bouton Login, fond sombre.",
      attachments: [JPEG],
      ingestedText: "",
    });
    assert.notEqual(guard.action, "blocked");
    assert.doesNotMatch(String(guard.blockedMessage || ""), /fichier vide|trop court/i);
  });

  it("JPEG : vision_briefing compte comme lisible", () => {
    const guard = evaluateFileContextGuard({
      query: QUERY_ANALYSE,
      response: "Capture d'écran : dashboard Nexxus, latence 3 min.",
      attachments: [JPEG],
      ingestedText: "--- BRIEFING VISUEL ---\nDashboard Nexxus, latence 3 min.\n---",
    });
    assert.notEqual(guard.action, "blocked");
    assert.doesNotMatch(String(guard.blockedMessage || ""), /fichier vide|trop court/i);
  });

  it("JPEG : clarify image+analyse → can_answer_now", () => {
    const d = evaluateClarificationDecision(QUERY_ANALYSE, {}, null, [], [JPEG]);
    assert.equal(d.decision, "can_answer_now");
    assert.match(d.reason, /vision_image/);
  });

  it("JPEG / GIF / WebP : repair → incertitude vision, pas fichier vide", () => {
    for (const file of [JPEG, RASTERS[3], RASTERS[4]]) {
      const repair = buildAttachmentMandateRepairReply({
        query: QUERY_ANALYSE,
        attachments: [file],
        ingestedText: "",
        defects: [MANDATE_DEFECTS.UNREAD],
      });
      assert.doesNotMatch(repair, /trop court pour une analyse/i, file.mimetype);
      assert.match(repair, /renvoyer|recadrer|décrire/i);
    }
  });
});
