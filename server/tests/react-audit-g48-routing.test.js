import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isReactAuditRequest,
  shouldDeferReactAuditToSnippetCodeReview,
  isReactAuditExcluded,
  extractReactAuditRootPath,
} from "../src/agent/utils/reactAuditIntentGuards.js";
import {
  classifyReactAuditContract,
  REACT_AUDIT_INTENTS,
  REACT_AUDIT_CLI_BASE_FLAGS,
} from "../src/agent/policies/reactAuditContractRouter.js";
import { resolveReactAuditShortCircuit } from "../src/agent/policies/reactAuditShortCircuit.js";
import { resolveReactAuditShortCircuitEmit } from "../src/agent/policies/reactAuditShortCircuit.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { resolveIntentContract } from "../src/agent/config/intentContractRegistry.js";

const WORKSPACE = "d:/Hostinger/public_html/nexxustudio";

describe("G48.1 — react audit guards", () => {
  it("G48-T01 détecte audit repo React", () => {
    assert.equal(
      isReactAuditRequest("audite le repo React sur ce projet vite", {
        workspaceRoot: WORKSPACE,
        packageJsonHasReact: true,
      }),
      true,
    );
  });

  it("G48-T02 exclut snippet collé → pas G48", () => {
    const snippet =
      "```jsx\nfunction App() {\n  const [x, setX] = useState(0);\n  return <div>{x}</div>;\n}\n```\nqu'en penses-tu ?";
    assert.equal(shouldDeferReactAuditToSnippetCodeReview(snippet), true);
    assert.equal(isReactAuditRequest(snippet), false);
  });

  it("G48-T03 exclut explain concept React", () => {
    const q = "explique ce que fait useEffect dans un composant React";
    assert.equal(isReactAuditExcluded(q), true);
    assert.equal(isReactAuditRequest(q), false);
  });

  it("G48-T04 diff vs main", () => {
    const contract = classifyReactAuditContract(
      "audite mes changements react vs main",
      { workspaceRoot: WORKSPACE, packageJsonHasReact: true },
    );
    assert.equal(contract?.intent, REACT_AUDIT_INTENTS.DIFF_SCAN);
    assert.equal(contract?.scan.diffBase, "main");
    assert.ok(contract?.scan.cliArgs.includes("--diff"));
  });

  it("G48-T05 score seul", () => {
    const contract = classifyReactAuditContract("quel est le score santé react du front", {
      workspaceRoot: WORKSPACE,
      packageJsonHasReact: true,
    });
    assert.equal(contract?.intent, REACT_AUDIT_INTENTS.SCORE_ONLY);
    assert.ok(contract?.scan.cliArgs.includes("--score"));
  });

  it("G48-T06 ambigu → clarify discriminante (defer LLM)", () => {
    const contract = classifyReactAuditContract("audite mon front", {});
    assert.equal(contract?.intent, REACT_AUDIT_INTENTS.AMBIGUOUS);
    assert.match(contract?.clarification?.question || "", /UX|React Doctor/i);
    const hit = resolveReactAuditShortCircuit("audite mon front");
    assert.equal(hit?.path, "react_audit_clarify");
    const emitHit = resolveReactAuditShortCircuitEmit("audite mon front");
    assert.equal(emitHit?.deferToLlm, true);
    assert.equal(emitHit?.reply, null);
  });

  it("G48-T07 flags CLI invariants", () => {
    assert.ok(REACT_AUDIT_CLI_BASE_FLAGS.includes("--json"));
    assert.ok(REACT_AUDIT_CLI_BASE_FLAGS.includes("--no-telemetry"));
    assert.ok(REACT_AUDIT_CLI_BASE_FLAGS.includes("--no-score"));
    assert.equal(REACT_AUDIT_CLI_BASE_FLAGS.includes("--offline"), false);
  });

  it("G48-T08 short-circuit repo_scan", async () => {
    const hit = await runConversationShortCircuit(
      "fais un audit react-doctor sur le repo",
      { workspaceRoot: WORKSPACE, packageJsonHasReact: true },
    );
    assert.equal(hit?.path, "react_audit_deterministic");
    assert.equal(hit?.reactAuditDriven, true);
    assert.match(hit?.reply || "", /REACT_AUDIT_V1|G48\.2/i);
  });

  it("G48-T09 bloque contrat orchestrateur", () => {
    const { matchedBy } = resolveIntentContract("audite le repo react vite", {
      workspaceRoot: WORKSPACE,
      packageJsonHasReact: true,
    });
    assert.equal(matchedBy, "g48_react_audit_block");
  });

  it("G48-T10 chemin explicite", () => {
    assert.equal(
      extractReactAuditRootPath("audite react sur d:\\Hostinger\\public_html\\nexxustudio"),
      "d:\\Hostinger\\public_html\\nexxustudio",
    );
  });

  it("G48-T11 audit sécurité + PJ HTML → hors React Doctor", () => {
    const q = "analyse le fichier joint pour un audit sécurité";
    const files = [{ originalname: "maintenance.html" }];
    assert.equal(isReactAuditExcluded(q, { attachments: files }), true);
    assert.equal(isReactAuditRequest(q, { attachments: files }), false);
    assert.equal(classifyReactAuditContract(q, { attachments: files }), null);
  });

  it("G48-T12 sidebar Cockpit + audit impact → hors React Doctor", async () => {
    const q =
      "je me pose des questions sur ta sidebar, je pense qu'il sera possible de combiner les menus suivant dans le boutons réglages il y aurait alors gouvernance, triage, audits & télémétrie, hooks, audit impact, artefacts et supprimer forge async. Qu'en penses tu ?";
    assert.equal(isReactAuditExcluded(q), true);
    assert.equal(isReactAuditRequest(q), false);
    assert.equal(classifyReactAuditContract(q), null);
    const hit = await runConversationShortCircuit(q, {});
    assert.notEqual(hit?.path, "react_audit_clarify");
    assert.equal(hit?.path, "meta_conversation_reflective");
    assert.equal(hit?.metaSubKind, "cockpit_ui_feedback");
  });
});

describe("G48 vs attachment security_audit", () => {
  it("short-circuit → attachment_task_full_pipeline security_audit", async () => {
    const q = "analyse le fichier joint pour un audit sécurité";
    const files = [{ originalname: "maintenance.html" }];
    const hit = await runConversationShortCircuit(q, { attachments: files });
    assert.equal(hit?.path, "attachment_task_full_pipeline");
    assert.equal(hit?.attachmentTask, "security_audit");
    assert.notEqual(hit?.path, "react_audit_clarify");
  });
});
