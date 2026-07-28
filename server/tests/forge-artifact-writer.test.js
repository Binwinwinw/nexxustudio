import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import securityHooks from "../src/hooks/securityHooks.js";
import { evaluateHookChain, HOOK_VERDICTS } from "../src/hooks/hookRegistry.js";
import { PROJECTS_ROOT } from "../src/forge/utils/projectPaths.js";
import {
  writeForgeArtifact,
  ForgeArtifactWriteBlocked,
} from "../src/forge/utils/forgeArtifactWriter.js";
import { PRIVILEGED_ACTION_TYPES } from "../src/hooks/privilegedActionGate.js";

const TEST_SLUG = `_gate-test-${process.pid}`;

function evaluatorState() {
  return {
    activeHooks: securityHooks.activeHooks,
    freezeDirectory: securityHooks.freezeDirectory,
    readOnlyDirectories: securityHooks.readOnlyDirectories,
    workspaceRoot: securityHooks.workspaceRoot,
    auditStrict: securityHooks.auditStrict,
    isActive: (name) => securityHooks.isActive(name),
    requiresConfirmation: (action) => securityHooks._requiresConfirmation(action),
  };
}

describe("artifactWriteHook — registre", () => {
  it("autorise une écriture Forge sous projects/", async () => {
    const outcome = await evaluateHookChain(
      {
        type: PRIVILEGED_ACTION_TYPES.FILE_WRITE,
        source: "forge",
        forgeArtifact: true,
        path: `projects/${TEST_SLUG}/handoff.json`,
      },
      evaluatorState(),
    );
    assert.equal(outcome.allowed, true);
    assert.ok(outcome.trail.some((t) => t.hookId === "artifactWriteHook"));
  });

  it("DENY si écriture Forge hors projects/", async () => {
    const outcome = await evaluateHookChain(
      {
        type: PRIVILEGED_ACTION_TYPES.FILE_WRITE,
        source: "forge",
        forgeArtifact: true,
        path: "server/src/evil.txt",
      },
      evaluatorState(),
    );
    assert.equal(outcome.allowed, false);
    assert.equal(outcome.verdict, HOOK_VERDICTS.DENY);
    assert.equal(outcome.hookId, "artifactWriteHook");
  });
});

describe("forgeArtifactWriter — intégration gate", () => {
  const testDir = path.join(PROJECTS_ROOT, TEST_SLUG);
  const testFile = path.join(testDir, "artifact-gate.txt");

  beforeEach(async () => {
    securityHooks.deactivate("/confirm");
    securityHooks.deactivate("/freeze");
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  it("écrit via executePrivilegedAction", async () => {
    const result = await writeForgeArtifact(testFile, "gate-ok", {
      sessionId: "forge-test-session",
      stage: "test",
    });
    assert.equal(result.path, `projects/${TEST_SLUG}/artifact-gate.txt`.replace(/\\/g, "/"));
    const content = await fs.readFile(testFile, "utf8");
    assert.equal(content, "gate-ok");
  });

  it("lève ForgeArtifactWriteBlocked hors projects/", async () => {
    const outside = path.resolve(PROJECTS_ROOT, "..", "server", `_evil-${TEST_SLUG}.txt`);
    await assert.rejects(
      () =>
        writeForgeArtifact(outside, "hack", {
          sessionId: "forge-test-session",
        }),
      (err) => {
        assert.ok(err instanceof ForgeArtifactWriteBlocked);
        assert.match(err.message, /HOOK_BLOCKED|projects/i);
        return true;
      },
    );
  });

  it("respecte /confirm fail-closed", async () => {
    securityHooks.activate("/confirm");
    const blockedFile = path.join(testDir, "confirm-blocked.txt");
    await assert.rejects(
      () =>
        writeForgeArtifact(blockedFile, "nope", {
          sessionId: "forge-confirm-test",
        }),
      (err) => {
        assert.ok(err instanceof ForgeArtifactWriteBlocked);
        assert.match(err.message, /CONFIRMATION_REQUIRED|confirm/i);
        return true;
      },
    );
  });
});
