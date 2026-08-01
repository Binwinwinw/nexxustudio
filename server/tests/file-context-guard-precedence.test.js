import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  ATTACHMENT_TASKS,
  classifyAttachmentTask,
} from "../src/agent/policies/attachment/index.js";
import { shouldBypassDocumentAnalysisRoute } from "../src/agent/policies/code/codeReviewRoutingGuard.js";
import {
  GUARD_MODES,
  buildAttachmentResponseState,
  enforceFileContextGuard,
  evaluateFileContextGuard,
} from "../src/agent/policies/guards/index.js";

describe("fileContextGuard precedence — réponse métier > soft-guard", () => {
  it("PJ + doc_improve + réponse longue → jamais écrasée (append_only / overrideLocked)", () => {
    const query = "Analyse le fichier joint et propose un contenu amélioré";
    const attachments = [{ originalname: "AGENTS.md" }];
    const task = classifyAttachmentTask(query, attachments).task;
    assert.equal(task, ATTACHMENT_TASKS.DOC_IMPROVE);

    const response =
      "Analyse du fichier AGENTS.md\n\n" +
      "1. Type : guide d'orchestration agents.\n" +
      "2. Points clés : sécurité, redirections IDE, docs/agents.\n" +
      "3. Propositions d'amélioration : contrats de sortie, index skills, lien IA-SETUP.md.\n" +
      "4. Structure recommandée : mission, priorités, archive.\n" +
      "Voici un plan concret pour renforcer le document sans perdre la lisibilité.";

    const state = buildAttachmentResponseState({
      query,
      response,
      attachments,
      attachmentTask: task,
      sourceBacked: true,
    });
    assert.equal(state.hasConcreteAttachmentAnswer, true);
    assert.equal(state.sourceBacked, true);
    assert.equal(state.overrideLocked, true);
    assert.equal(state.guardMode, GUARD_MODES.APPEND_ONLY);

    const enforced = enforceFileContextGuard({
      query,
      response,
      attachments,
      attachmentTask: task,
      sourceBacked: true,
    });
    assert.equal(enforced.blocked, false);
    assert.equal(enforced.overrideLocked, true);
    assert.match(enforced.delivered, /Analyse du fichier AGENTS\.md/);
    assert.match(enforced.delivered, /Propositions d'amélioration/);
    assert.doesNotMatch(enforced.delivered, /je ne peux pas affirmer l'existence/i);
    // La réponse métier reste le préfixe ; au plus une note suffixe.
    assert.ok(enforced.delivered.startsWith(response.trimEnd()));
  });

  it("PJ code .php + code_refactor → bypass DOCUMENT, sortie conservée", () => {
    const query = "refactorise le fichier joint";
    const attachments = [{ originalname: "script.php" }];
    const task = classifyAttachmentTask(query, attachments).task;
    assert.equal(task, ATTACHMENT_TASKS.CODE_REFACTOR);
    assert.equal(shouldBypassDocumentAnalysisRoute(query, null, attachments), true);

    const response =
      "Refactor de script.php\n\n" +
      "Avant / après : extraction d'une fonction pure.\n\n" +
      "```php\n<?php\nfunction normalize($s) { return trim(strtolower($s)); }\n```\n\n" +
      "Comportement inchangé, lisibilité améliorée.";

    const enforced = enforceFileContextGuard({
      query,
      response,
      attachments,
      attachmentTask: task,
      sourceBacked: true,
    });
    assert.equal(enforced.blocked, false);
    assert.equal(enforced.overrideLocked, true);
    assert.match(enforced.delivered, /Refactor de script\.php/);
    assert.match(enforced.delivered, /```php/);
    assert.doesNotMatch(enforced.delivered, /je ne peux pas affirmer l'existence/i);
  });

  it("PJ .docx + résumé → sortie conservée même si mentions d'autres fichiers", () => {
    const query = "résume le document joint";
    const attachments = [{ originalname: "brief.docx" }];
    const task = classifyAttachmentTask(query, attachments).task;
    assert.equal(task, ATTACHMENT_TASKS.DOC_SUMMARIZE);

    const response =
      "Résumé de brief.docx\n\n" +
      "1. Contexte du projet et périmètre.\n" +
      "2. Objectifs principaux pour le trimestre.\n" +
      "3. Le document renvoie aussi à roadmap.md et notes.txt pour le détail.\n" +
      "En bref : lancement cadré, livrables clairs, prochaines étapes listées.";

    const enforced = enforceFileContextGuard({
      query,
      response,
      attachments,
      attachmentTask: task,
      sourceBacked: true,
    });
    assert.equal(enforced.blocked, false);
    assert.match(enforced.delivered, /Résumé de brief\.docx/);
    assert.match(enforced.delivered, /En bref/);
    assert.doesNotMatch(enforced.delivered, /je ne peux pas affirmer l'existence/i);
    assert.ok(
      enforced.softened === true || enforced.overrideLocked === true,
      "doit rester append-only / overrideLocked",
    );
  });

  it("PJ .doc legacy → incapacité spécifique, pas faux positif « fichier manquant »", () => {
    const query = "résume le document joint";
    const attachments = [{ originalname: "legacy.doc" }];
    const incapacity =
      "[DOC - format .doc (binaire legacy) non supporté pour l'extraction locale]\n" +
      "Convertis en .docx, .md ou .txt, ou colle l'extrait à résumer.";

    const evaluated = evaluateFileContextGuard({
      query,
      response: incapacity,
      attachments,
      attachmentTask: ATTACHMENT_TASKS.DOC_SUMMARIZE,
      sourceBacked: true,
    });
    assert.equal(evaluated.ok, true);
    assert.equal(evaluated.action, "no_op");
    assert.equal(evaluated.guardMode, GUARD_MODES.NO_OP);

    const enforced = enforceFileContextGuard({
      query,
      response: incapacity,
      attachments,
      attachmentTask: ATTACHMENT_TASKS.DOC_SUMMARIZE,
      sourceBacked: true,
    });
    assert.equal(enforced.blocked, false);
    assert.match(enforced.delivered, /binaire legacy/i);
    assert.doesNotMatch(enforced.delivered, /je ne peux pas affirmer l'existence/i);
    assert.doesNotMatch(enforced.delivered, /Références non vérifiables/i);
  });

  it("non-régression : concrete attachment answer cannot be replaced by soft-guard fallback", () => {
    const response =
      "Correctif pour app.py\n\n```python\ndef main():\n    print('ok')\n```\n\n" +
      "La garde ne doit jamais substituer ce livrable par un refus générique, " +
      "même si utils.py est cité en passant.";
    const original = response;
    const enforced = enforceFileContextGuard({
      query: "corrige le fichier joint",
      response,
      attachments: [{ originalname: "app.py" }],
      attachmentTask: ATTACHMENT_TASKS.CODE_FIX,
      sourceBacked: true,
    });
    assert.equal(enforced.blocked, false);
    assert.ok(enforced.delivered.startsWith(original.trimEnd()));
    assert.doesNotMatch(enforced.delivered, /^Je ne peux pas affirmer/i);
  });
});
