import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  ATTACHMENT_TASKS,
  classifyAttachmentTask,
  FILE_ANALYSIS_CONTRACT_ID,
  FILE_ANALYSIS_DEPTHS,
  resolveFileAnalysisDepth,
  isFileAnalysisWorkRequest,
  isFileAnalysisRequestWithoutSource,
  buildFileAnalysisAwaitingSourceReply,
  formatFileAnalysisReply,
  evaluateFileAnalysisSufficiency,
  shouldApplyFileAnalysisSourceRail,
} from "../src/agent/policies/attachment/index.js";
import {
  classifyCodeIntent,
  isCodeIntentRequest,
} from "../src/agent/policies/code/codeIntentPolicy.js";
import { shouldBypassDocumentAnalysisRoute } from "../src/agent/policies/code/codeReviewRoutingGuard.js";
import { resolveWantsAnalysisFromTriage } from "../src/agent/classifiers/intentTriageClassifier.js";
import { analyzeSourceFileContent } from "../src/agent/analysis/analyzers/index.js";
import { isDocumentAnalysisIntent } from "../src/agent/utils/conversation/conversationGuards.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";

const JS_FILE = [{ originalname: "server-index-clean.js" }];

const EXPRESS_SNIPPET = `
import express from 'express';
const app = express();
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});
app.get('/api/chat', (req, res) => res.json({ ok: true }));
app.listen(3000, () => console.log('up'));
`;

describe("FILE_ANALYSIS_V1 — profondeur et routing", () => {
  it("sans PJ : analyses un fichier + dispo → attendre la source, pas code_review", () => {
    const q = "j'aimerais que tu analyses un fichier es tu disponible ?";
    assert.equal(isFileAnalysisWorkRequest(q), true);
    assert.equal(isFileAnalysisRequestWithoutSource(q, { attachments: [] }), true);
    assert.equal(
      buildFileAnalysisAwaitingSourceReply(q),
      "Oui, je suis disponible. Joins le fichier et indique si tu veux une analyse simple, complète ou critique.",
    );
    assert.equal(
      isFileAnalysisRequestWithoutSource(q, {
        attachments: [{ originalname: "app.js" }],
      }),
      false,
    );
  });

  it("analyse le fichier + .js → doc_analyze, pas code_review", () => {
    const q = "analyse le fichier";
    const hit = classifyAttachmentTask(q, JS_FILE);
    assert.equal(hit.task, ATTACHMENT_TASKS.DOC_ANALYZE);
    assert.equal(hit.outputContract, FILE_ANALYSIS_CONTRACT_ID);
    assert.equal(hit.fileAnalysisDepth, FILE_ANALYSIS_DEPTHS.SIMPLE);
    assert.equal(classifyCodeIntent(q, { attachments: JS_FILE }), null);
    assert.equal(isCodeIntentRequest(q, { attachments: JS_FILE }), false);
    assert.equal(isDocumentAnalysisIntent(q, JS_FILE), true);
    assert.equal(shouldBypassDocumentAnalysisRoute(q, null, JS_FILE), false);
    assert.equal(resolveWantsAnalysisFromTriage(null, q, JS_FILE), true);
  });

  it("analyse complète → profondeur complete + sections", () => {
    const q = "analyse complète du fichier";
    assert.equal(resolveFileAnalysisDepth(q), FILE_ANALYSIS_DEPTHS.COMPLETE);
    const hit = classifyAttachmentTask(q, JS_FILE);
    assert.equal(hit.task, ATTACHMENT_TASKS.DOC_ANALYZE);
    assert.equal(hit.fileAnalysisDepth, FILE_ANALYSIS_DEPTHS.COMPLETE);
  });

  it("analyse critique → profondeur critique", () => {
    const q = "analyse critique du fichier";
    assert.equal(resolveFileAnalysisDepth(q), FILE_ANALYSIS_DEPTHS.CRITIQUE);
    assert.equal(isFileAnalysisWorkRequest(q), true);
    const hit = classifyAttachmentTask(q, JS_FILE);
    assert.equal(hit.fileAnalysisDepth, FILE_ANALYSIS_DEPTHS.CRITIQUE);
  });

  it("corrige / revue / faille restent hors FILE_ANALYSIS", () => {
    assert.equal(
      classifyAttachmentTask("corrige le fichier", JS_FILE).task,
      ATTACHMENT_TASKS.CODE_FIX,
    );
    assert.equal(
      classifyAttachmentTask("revue le fichier joint", JS_FILE).task,
      ATTACHMENT_TASKS.CODE_REVIEW,
    );
    assert.equal(
      classifyAttachmentTask("trouve la faille de sécurité", JS_FILE).task,
      ATTACHMENT_TASKS.SECURITY_AUDIT,
    );
    assert.equal(isFileAnalysisWorkRequest("corrige le fichier"), false);
    assert.equal(isFileAnalysisWorkRequest("trouve la faille"), false);
    assert.equal(
      classifyCodeIntent("corrige le fichier", { attachments: JS_FILE })?.kind,
      "code_correction",
    );
  });

  it("HTML + analyser reste doc_analyze document", () => {
    const q = "voici un html à analyser";
    const files = [{ originalname: "page.html" }];
    const hit = classifyAttachmentTask(q, files);
    assert.equal(hit.task, ATTACHMENT_TASKS.DOC_ANALYZE);
    assert.equal(hit.fileKind, "document");
    assert.equal(hit.outputContract, FILE_ANALYSIS_CONTRACT_ID);
  });
});

describe("FILE_ANALYSIS_V1 — trame et garde", () => {
  it("server-index-clean.js — trame complète ancrée", () => {
    const { report } = analyzeSourceFileContent(EXPRESS_SNIPPET, {
      path: "server-index-clean.js",
      ext: "js",
    });
    assert.match(report.roleLabel, /serveur|API HTTP/i);
    const reply = formatFileAnalysisReply(
      report,
      FILE_ANALYSIS_DEPTHS.CRITIQUE,
      "analyse critique du fichier",
    );
    assert.match(reply, /FILE_ANALYSIS_V1/);
    assert.match(reply, /Identification du fichier/);
    assert.match(reply, /Structure interne/);
    assert.match(reply, /Fonctionnement observable/);
    assert.match(reply, /Points positifs/);
    assert.match(reply, /Faiblesses/);
    assert.match(reply, /Risques/);
    assert.match(reply, /Points à vérifier/);
    assert.match(reply, /Priorités/);
    assert.match(reply, /server-index-clean\.js/);
    const check = evaluateFileAnalysisSufficiency({
      query: "analyse critique du fichier",
      reply,
      fileName: "server-index-clean.js",
      artifactsPresent: true,
    });
    assert.equal(check.ok, true, check.reasons.join(","));
    assert.equal(
      shouldApplyFileAnalysisSourceRail({
        task: "doc_analyze",
        fileName: "server-index-clean.js",
        content: EXPRESS_SNIPPET,
      }),
      true,
    );
    assert.equal(
      shouldApplyFileAnalysisSourceRail({
        task: "doc_analyze",
        fileName: "cv.pdf",
        content: EXPRESS_SNIPPET,
      }),
      false,
    );
  });

  it("refuse générique et faux vide", () => {
    const generic = evaluateFileAnalysisSufficiency({
      query: "analyse complète du fichier",
      reply: "Voici des axes d'amélioration génériques pour tout projet.",
      fileName: "server-index-clean.js",
      artifactsPresent: true,
    });
    assert.equal(generic.ok, false);
    assert.ok(generic.reasons.includes("generic_unanchored"));

    const empty = evaluateFileAnalysisSufficiency({
      query: "analyse complète du fichier",
      reply: "Le fichier est trop court pour une analyse.",
      fileName: "server-index-clean.js",
      artifactsPresent: true,
    });
    assert.equal(empty.ok, false);
    assert.ok(empty.reasons.includes("false_empty"));
  });

  it("simple n'exige pas les 8 sections", () => {
    const { report } = analyzeSourceFileContent(EXPRESS_SNIPPET, {
      path: "server-index-clean.js",
      ext: "js",
    });
    const reply = formatFileAnalysisReply(
      report,
      FILE_ANALYSIS_DEPTHS.SIMPLE,
      "analyse le fichier",
    );
    assert.match(reply, /Identification/);
    assert.match(reply, /Remarques principales/);
    assert.doesNotMatch(reply, /### Priorités/);
    const check = evaluateFileAnalysisSufficiency({
      query: "analyse le fichier",
      reply,
      fileName: "server-index-clean.js",
      artifactsPresent: true,
    });
    assert.equal(check.ok, true, check.reasons.join(","));
  });
});

describe("FILE_ANALYSIS — sans source", () => {
  it("SC : analyses un fichier + dispo → pas REPO_ANALYSIS / pas web", async () => {
    const q = "j'aimerais que tu analyses un fichier es tu disponible ?";
    const hit = await runConversationShortCircuit(q, { attachments: [] });
    assert.equal(hit?.path, "CLARIFY");
    assert.equal(hit?.route, "file_analysis_awaiting_source");
    assert.equal(hit?.forcedIntentContractId, undefined);
    assert.match(hit?.reply || "", /disponible/i);
    assert.match(hit?.reply || "", /Joins le fichier/i);
    assert.doesNotMatch(hit?.reply || "", /REPO_ANALYSIS|github|grammar|j'aimerai /i);
  });

  it("SC : wantsAnalysis=true sans PJ n'empêche pas l'attente de source", async () => {
    const q = "j'aimerais que tu analyses un fichier es tu disponible ?";
    const hit = await runConversationShortCircuit(q, {
      attachments: [],
      wantsAnalysis: true,
    });
    assert.equal(hit?.path, "CLARIFY");
    assert.equal(hit?.route, "file_analysis_awaiting_source");
    assert.match(hit?.reply || "", /disponible/i);
  });
});
