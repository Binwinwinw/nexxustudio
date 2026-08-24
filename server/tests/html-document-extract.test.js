import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  extractHtmlDocumentViews,
  buildHtmlDocumentAnalysisReply,
  evaluateHtmlDocumentCriticChecks,
  HTML_DOC_AVAILABILITY,
} from "../src/agent/analysis/analyzers/htmlDocumentExtract.js";
import {
  classifyAttachmentTask,
  ATTACHMENT_TASKS,
  shouldRouteAttachmentTaskToFullPipeline,
  resolveIngestStatus,
} from "../src/agent/policies/attachment/index.js";
import {
  isCodeIntentRequest,
  shouldBypassDocumentAnalysisRoute,
} from "../src/agent/policies/code/index.js";
import { isDocumentAnalysisIntent } from "../src/agent/utils/conversation/conversationGuards.js";

const FREEPIK_HTML = `<!DOCTYPE html>
<html lang="fr">
<head>
  <title>Un dessin animÃ© d'un homme tenant un appareil photo | Image Premium gÃ©nÃ©rÃ©e Ã  base dâIA</title>
  <meta name="description" content="TÃ©lÃ©chargez cette image gÃ©nÃ©rÃ©e par IA sur Freepik.">
  <meta property="og:title" content="Dessin animÃ© homme appareil photo">
  <meta property="og:description" content="Image Premium gÃ©nÃ©rÃ©e Ã  base dâIA">
  <meta property="og:image" content="https://img.freepik.com/premium-photo/cartoon-man-camera.jpg">
  <meta property="og:image:alt" content="Un dessin animÃ© d'un homme tenant un appareil photo">
  <link rel="canonical" href="https://www.freepik.com/premium-photo/cartoon-man-camera">
  <script>window.__I18N__={fr:{},en:{},es:{}};</script>
  <script src="/app.js"></script>
  <script src="/chunk-1.js"></script>
  <script src="/chunk-2.js"></script>
  <script src="/chunk-3.js"></script>
  <script src="/chunk-4.js"></script>
  <style>.shell{display:none}</style>
  <link rel="stylesheet" href="/app.css">
  <link rel="stylesheet" href="/theme.css">
</head>
<body>
  <div id="app"></div>
  <script>/* ${"x".repeat(800)} */</script>
</body>
</html>`;

const FILE = {
  originalname:
    "Un-dessin-anime-d-un-homme-tenant-un-appareil-photo-avec-un-appareil-photo-dans-sa-main-_-Image-Premium-generee-a-base-dIA.html",
};

describe("html document extract — Freepik fixture", () => {
  it("n'est pas empty / too_short malgré peu de texte visible", () => {
    const views = extractHtmlDocumentViews(FREEPIK_HTML, {
      fileName: FILE.originalname,
      mime: "text/html",
    });
    assert.equal(views.availability, HTML_DOC_AVAILABILITY.DOCUMENT_AVAILABLE);
    assert.ok(views.flags.includes("metadata_available"));
    assert.ok(views.flags.includes("image_reference_available"));
    assert.ok(views.flags.includes("visible_text_low_or_moderate"));
    assert.ok(views.flags.includes("heavy_script_boilerplate"));
    assert.ok(views.flags.includes("encoding_issue_detected"));
    assert.equal(resolveIngestStatus("", null, views), "ok");
    assert.notEqual(views.availability, HTML_DOC_AVAILABILITY.EMPTY_FILE);
  });

  it("fermeture : voici un html à analyser → doc_analyze · document", () => {
    const q = "voici un html à analyser";
    const hit = classifyAttachmentTask(q, [FILE]);
    assert.equal(hit.task, ATTACHMENT_TASKS.DOC_ANALYZE);
    assert.equal(hit.fileKind, "document");
    assert.equal(isCodeIntentRequest(q, { attachments: [FILE] }), false);
    assert.equal(isDocumentAnalysisIntent(q, [FILE]), true);
    assert.equal(shouldBypassDocumentAnalysisRoute(q, null, [FILE]), false);
    assert.equal(shouldRouteAttachmentTaskToFullPipeline(q, [FILE]), false);
  });

  it("réponse ancrée analyse le document, jamais vide/trop court", () => {
    const q = "voici un html à analyser";
    const views = extractHtmlDocumentViews(FREEPIK_HTML, {
      fileName: FILE.originalname,
      mime: "text/html",
    });
    const reply = buildHtmlDocumentAnalysisReply(views, q);
    assert.match(reply, /Freepik|canonique|Open Graph/i);
    assert.match(reply, /titre/i);
    assert.doesNotMatch(reply, /fichier vide|trop court pour une analyse/i);
    assert.match(reply, /pas jointe|localement/i);

    const critic = evaluateHtmlDocumentCriticChecks({
      query: q,
      task: ATTACHMENT_TASKS.DOC_ANALYZE,
      fileKind: "document",
      views,
      reply,
    });
    assert.equal(critic.ok, true);
    assert.equal(critic.checks.extracted_artifacts_present, true);
    assert.equal(critic.checks.task_contract_matches_user_request, true);
  });

  it("critique refuse code_review + faux vide", () => {
    const q = "voici un html à analyser";
    const views = extractHtmlDocumentViews(FREEPIK_HTML, {
      fileName: FILE.originalname,
      mime: "text/html",
    });
    const wrong = evaluateHtmlDocumentCriticChecks({
      query: q,
      task: ATTACHMENT_TASKS.CODE_REVIEW,
      fileKind: "code",
      views,
      reply: "Fichier vide ou trop court pour une analyse. Renvoie un fichier.",
    });
    assert.equal(wrong.ok, false);
    assert.ok(wrong.reasons.includes("wrong_contract_code_review"));
    assert.ok(wrong.reasons.includes("false_empty"));
    assert.equal(wrong.repair, "reclassify_doc_analyze");
  });

  it("html + faille → pas doc_analyze", () => {
    const q = "auditer le code et chercher une faille";
    const hit = classifyAttachmentTask(q, [FILE]);
    assert.ok(
      hit.task === ATTACHMENT_TASKS.SECURITY_AUDIT ||
        hit.task === ATTACHMENT_TASKS.CODE_REVIEW,
    );
    assert.equal(hit.fileKind, "code");
  });
});
