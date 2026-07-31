import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  ATTACHMENT_TASKS,
  classifyAttachmentTask,
  isCodeAttachmentTask,
  isDocumentAttachmentTask,
  formatAttachmentTaskSummary,
  shouldSuppressSummaryContractForAttachment,
  shouldRouteAttachmentTaskToFullPipeline,
} from "../src/agent/policies/attachmentTaskPolicy.js";
import { classifySummaryContract } from "../src/agent/policies/summaryContractRouter.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { shouldDeferShortCircuitToFullPipeline } from "../src/agent/policies/practicalAdviceRoutingGuard.js";
import {
  buildAttachmentInterpretationSystemAddon,
  extractLinkedAssetRefs,
} from "../src/agent/policies/attachmentInterpretationPolicy.js";
import { applySimpleFastDeliveryPipeline } from "../src/agent/paths/simpleFastPath.js";
import {
  shouldBypassDocumentAnalysisRoute,
  hasCodeAttachmentSignal,
} from "../src/agent/policies/codeReviewRoutingGuard.js";
import {
  classifyCodeIntent,
  isCodeIntentRequest,
} from "../src/agent/policies/codeIntentPolicy.js";
import { hasTextAttachments } from "../src/agent/utils/conversationGuards.js";
import {
  isDocxFile,
  isLegacyDocFile,
  extractDocxToText,
} from "../src/services/document-analysis/docxExtractor.js";
import { enforceFileContextGuard } from "../src/agent/policies/guards/index.js";
import { inflateRawSync, deflateRawSync } from "node:zlib";

describe("attachmentTaskPolicy", () => {
  it("AGENTS.md + plan d'améliorations → doc_improve", () => {
    const c = classifyAttachmentTask(
      "Analyse le fichier joint et propose un contenu amélioré",
      [{ originalname: "AGENTS.md" }],
    );
    assert.equal(c.task, ATTACHMENT_TASKS.DOC_IMPROVE);
    assert.equal(isDocumentAttachmentTask(c.task), true);
    assert.match(formatAttachmentTaskSummary(c), /doc_improve/);
  });

  it("script.php + corrige → code_fix + bypass DOCUMENT", () => {
    const files = [{ originalname: "script.php" }];
    const q = "corrige le fichier joint";
    const c = classifyAttachmentTask(q, files);
    assert.equal(c.task, ATTACHMENT_TASKS.CODE_FIX);
    assert.equal(isCodeAttachmentTask(c.task), true);
    assert.equal(shouldBypassDocumentAnalysisRoute(q, null, files), true);
    assert.equal(isCodeIntentRequest(q, { attachments: files }), true);
    assert.equal(
      classifyCodeIntent(q, { attachments: files })?.kind,
      "code_correction",
    );
  });

  it("notes.docx + résumé → doc_summarize", () => {
    const c = classifyAttachmentTask("résume le document joint", [
      { originalname: "notes.docx" },
    ]);
    assert.equal(c.task, ATTACHMENT_TASKS.DOC_SUMMARIZE);
    assert.equal(hasTextAttachments([{ originalname: "notes.docx" }]), true);
  });

  it("app.py + refactor → code_refactor + bypass DOCUMENT", () => {
    const files = [{ originalname: "app.py" }];
    const q = "refactorise le fichier joint";
    const c = classifyAttachmentTask(q, files);
    assert.equal(c.task, ATTACHMENT_TASKS.CODE_REFACTOR);
    assert.equal(shouldBypassDocumentAnalysisRoute(q, null, files), true);
    assert.equal(
      classifyCodeIntent(q, { attachments: files })?.kind,
      "code_refactor",
    );
  });

  it("index.html + revue → code_review signal", () => {
    assert.equal(
      hasCodeAttachmentSignal([{ originalname: "index.html" }], ""),
      true,
    );
    const c = classifyAttachmentTask("analyse le fichier joint", [
      { originalname: "index.html" },
    ]);
    assert.equal(c.task, ATTACHMENT_TASKS.CODE_REVIEW);
  });

  it("sans PJ → unmatched", () => {
    const c = classifyAttachmentTask("bonjour", []);
    assert.equal(c.matched, false);
    assert.equal(c.task, null);
  });

  it("maintenance.html + audit sécurité → security_audit", () => {
    const c = classifyAttachmentTask(
      "analyse le fichier joint pour un audit sécurité",
      [{ originalname: "maintenance.html" }],
    );
    assert.equal(c.task, ATTACHMENT_TASKS.SECURITY_AUDIT);
    assert.equal(isCodeAttachmentTask(c.task), true);
    assert.equal(shouldRouteAttachmentTaskToFullPipeline(
      "analyse le fichier joint pour un audit sécurité",
      [{ originalname: "maintenance.html" }],
    ), true);
  });

  it("index.html + analyse + contenu amélioré → suppress TEXT_SUMMARY", () => {
    const q = "Analyse le fichier joint et propose un contenu amélioré";
    const files = [{ originalname: "index.html" }];
    const c = classifyAttachmentTask(q, files);
    assert.equal(c.task, ATTACHMENT_TASKS.DOC_IMPROVE);
    assert.equal(c.fileKind, "code");
    assert.equal(shouldSuppressSummaryContractForAttachment(q, files), true);
    assert.equal(shouldRouteAttachmentTaskToFullPipeline(q, files), true);
    assert.equal(classifySummaryContract(q, { attachments: files }), null);
  });

  it("notes.docx + résumé → TEXT_SUMMARY autorisé (pas de suppress improve)", () => {
    const q = "résume le document joint";
    const files = [{ originalname: "notes.docx" }];
    assert.equal(shouldSuppressSummaryContractForAttachment(q, files), false);
    assert.ok(classifySummaryContract(q, { attachments: files }));
  });
});

describe("attachment task routing precedence", () => {
  it("short-circuit → attachment_task_full_pipeline (pas document_synthesis_llm)", async () => {
    const q = "Analyse le fichier joint et propose un contenu amélioré";
    const files = [{ originalname: "index.html" }];
    const sc = await runConversationShortCircuit(q, { attachments: files });
    assert.equal(sc?.path, "attachment_task_full_pipeline");
    assert.equal(sc?.deferToFullPipeline, true);
    assert.equal(sc?.attachmentTask, ATTACHMENT_TASKS.DOC_IMPROVE);
    assert.equal(shouldDeferShortCircuitToFullPipeline(sc, q), true);
    assert.notEqual(sc?.path, "document_synthesis_llm");
  });

  it("garde interprétation mentionne home.js / non visible", () => {
    const html =
      '<script type="module" src="home.js"></script><link href="style.css" rel="stylesheet">';
    assert.deepEqual(extractLinkedAssetRefs(html), ["home.js", "style.css"]);
    const addon = buildAttachmentInterpretationSystemAddon({
      attachments: [{ originalname: "index.html" }],
      fileContents: { "index.html": html },
    });
    assert.match(addon, /home\.js/);
    assert.match(addon, /non visible dans ce fichier/i);
  });

  it("applySimpleFastDeliveryPipeline n'explose plus sur presentationOutline", async () => {
    const out = await applySimpleFastDeliveryPipeline({
      query: "bonjour",
      rawResult: "Réponse courte de test.",
      presentationOutline: false,
    });
    assert.ok(String(out.text || "").length > 0);
  });
});

describe("fileContextGuard soft multi-shapes", () => {
  it("soft pour fix avec fence + PJ connue", () => {
    const response =
      "Correctif pour script.php\n\n" +
      "Version corrigée :\n\n" +
      "```php\n<?php\nfunction add($a, $b) { return $a + $b; }\n```\n\n" +
      "Le return manquant bloquait l'exécution.";
    const enforced = enforceFileContextGuard({
      query: "corrige le fichier joint",
      response,
      attachments: [{ originalname: "script.php" }],
    });
    assert.equal(enforced.blocked, false);
    assert.match(enforced.delivered, /Version corrigée/);
  });

  it("soft pour résumé ancré sur PJ", () => {
    const response =
      "Résumé de brief.docx\n\n" +
      "1. Contexte projet\n" +
      "2. Objectifs principaux\n" +
      "3. Prochaines étapes\n" +
      "En bref : le document cadre le lancement et les livrables attendus.";
    const enforced = enforceFileContextGuard({
      query: "résume le document joint",
      response,
      attachments: [{ originalname: "brief.docx" }],
    });
    assert.equal(enforced.blocked, false);
    assert.match(enforced.delivered, /Résumé de brief\.docx/);
  });
});

describe("docxExtractor", () => {
  it("détecte docx / legacy doc", () => {
    assert.equal(isDocxFile("", "notes.docx"), true);
    assert.equal(isLegacyDocFile("", "notes.doc"), true);
    assert.equal(isDocxFile("", "notes.doc"), false);
  });

  it("extrait le texte d'un docx minimal ZIP", () => {
    const xml =
      '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      "<w:body><w:p><w:r><w:t>Bonjour Word</w:t></w:r></w:p></w:body></w:document>";
    const xmlBuf = Buffer.from(xml, "utf8");
    const compressed = deflateRawSync(xmlBuf);
    const name = Buffer.from("word/document.xml", "utf8");

    // Local file header
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(xmlBuf.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);

    const localOffset = 0;
    const fileData = Buffer.concat([local, compressed]);

    // Central directory
    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(xmlBuf.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(localOffset, 42);
    name.copy(central, 46);

    const centralOffset = fileData.length;
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(1, 8);
    eocd.writeUInt16LE(1, 10);
    eocd.writeUInt32LE(central.length, 12);
    eocd.writeUInt32LE(centralOffset, 16);
    eocd.writeUInt16LE(0, 20);

    const zip = Buffer.concat([fileData, central, eocd]);
    // sanity: inflate path used by extractor
    assert.ok(inflateRawSync(compressed).includes("Bonjour"));

    const result = extractDocxToText(zip, "mini.docx");
    assert.equal(result.ok, true);
    assert.match(result.text, /Bonjour Word/);
  });

  it("échec explicite sur buffer vide", () => {
    const result = extractDocxToText(Buffer.alloc(0), "empty.docx");
    assert.equal(result.ok, false);
    assert.match(result.message, /buffer vide/i);
  });
});
