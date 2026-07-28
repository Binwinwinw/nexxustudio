import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import {
  validateSyntaxFile,
  isSyntaxValidationEnabled,
} from "../src/hooks/postEdit/syntaxValidator.js";
import { runPostEditHooks } from "../src/hooks/postEdit/postEditHook.js";
import {
  executePrivilegedAction,
  GATE_BLOCK_REASONS,
  PRIVILEGED_ACTION_TYPES,
} from "../src/hooks/privilegedActionGate.js";
import { DEFAULT_WORKSPACE_ROOT } from "../src/hooks/pathBoundary.js";
import { PROJECTS_ROOT } from "../src/forge/utils/projectPaths.js";

const TEST_DIR = path.join(PROJECTS_ROOT, `_post-syntax-${process.pid}`);

describe("postEditSyntaxHook — validateurs", () => {
  beforeEach(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
  });

  it("JSON valide → OK", async () => {
    const file = path.join(TEST_DIR, "ok.json");
    await fs.writeFile(file, '{"a":1}', "utf8");
    const r = await validateSyntaxFile(file);
    assert.equal(r.valid, true);
    assert.equal(r.validator, "json");
  });

  it("JSON invalide → DENY", async () => {
    const file = path.join(TEST_DIR, "bad.json");
    await fs.writeFile(file, "{ invalid", "utf8");
    const r = await validateSyntaxFile(file);
    assert.equal(r.valid, false);
    assert.equal(r.validator, "json");
  });

  it("Python invalide → DENY via py_compile", async () => {
    const file = path.join(TEST_DIR, "bad.py");
    await fs.writeFile(file, "def oops(\n  pass\n", "utf8");
    const r = await validateSyntaxFile(file);
    assert.equal(r.valid, false);
    assert.equal(r.validator, "py_compile");
  });

  it("Python valide → OK", async () => {
    const file = path.join(TEST_DIR, "ok.py");
    await fs.writeFile(file, "def ok():\n    return 1\n", "utf8");
    const r = await validateSyntaxFile(file);
    assert.equal(r.valid, true);
  });
});

describe("postEditSyntaxHook — intégration gate", () => {
  const relJson = path
    .relative(DEFAULT_WORKSPACE_ROOT, path.join(TEST_DIR, "gate-bad.json"))
    .replace(/\\/g, "/");

  beforeEach(async () => {
    process.env.POST_EDIT_SYNTAX = "on";
    process.env.POST_EDIT_TESTS = "off";
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
  });

  it("executePrivilegedAction POST_HOOK_BLOCKED sur JSON invalide", async () => {
    const abs = path.join(TEST_DIR, "gate-bad.json");
    const outcome = await executePrivilegedAction(
      {
        type: PRIVILEGED_ACTION_TYPES.FILE_WRITE,
        path: relJson,
        content: "{ not-json",
        toolName: "writeFile",
        sessionId: "post-syntax-test",
        workspaceRoot: DEFAULT_WORKSPACE_ROOT,
        sideEffects: true,
        riskLevel: "HIGH",
      },
      async () => {
        await fs.writeFile(abs, "{ not-json", "utf8");
        return "written";
      },
    );

    assert.equal(outcome.success, false);
    assert.equal(outcome.code, GATE_BLOCK_REASONS.POST_HOOK_BLOCKED);
    assert.match(outcome.error, /POST_HOOK_BLOCKED:postEditSyntaxHook|Syntaxe invalide/i);
    const onDisk = await fs.readFile(abs, "utf8");
    assert.equal(onDisk, "{ not-json");
  });

  it("runPostEditHooks ignore mkdir", async () => {
    const post = await runPostEditHooks(
      {
        type: PRIVILEGED_ACTION_TYPES.FILE_WRITE,
        operation: "mkdir",
        path: "projects/foo",
      },
      { isActive: () => false },
    );
    assert.equal(post.ok, true);
  });

  it("isSyntaxValidationEnabled respecte POST_EDIT_SYNTAX=off", () => {
    process.env.POST_EDIT_SYNTAX = "off";
    assert.equal(isSyntaxValidationEnabled(), false);
    process.env.POST_EDIT_SYNTAX = "on";
    assert.equal(isSyntaxValidationEnabled(), true);
  });
});
