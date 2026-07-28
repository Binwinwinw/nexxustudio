import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import securityHooks from "../src/hooks/securityHooks.js";
import {
  evaluateHookChain,
  HOOK_VERDICTS,
  HOOK_POLICY_VERSION,
  isSensitiveFilePath,
  buildPolicySnapshot,
} from "../src/hooks/hookRegistry.js";
import { resolveCanonicalWithinRoot, DEFAULT_WORKSPACE_ROOT } from "../src/hooks/pathBoundary.js";
import { PRIVILEGED_ACTION_TYPES } from "../src/hooks/privilegedActionGate.js";

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

describe("hookRegistry — policy snapshot", () => {
  it("embarque policy_version et hooks actifs", () => {
    securityHooks.activate("/careful");
    const snap = buildPolicySnapshot(evaluatorState());
    assert.equal(snap.policy_version, HOOK_POLICY_VERSION);
    assert.ok(snap.active_commands.includes("/careful"));
  });
});

describe("hookRegistry — sensitiveFilesHook", () => {
  const initialHooks = new Set(securityHooks.activeHooks);

  beforeEach(() => {
    securityHooks.deactivate("/protect-secrets");
  });

  afterEach(() => {
    securityHooks.activeHooks = new Set(initialHooks);
  });

  it("détecte les chemins sensibles", () => {
    assert.equal(isSensitiveFilePath(".env"), true);
    assert.equal(isSensitiveFilePath("config/secrets.json"), true);
    assert.equal(isSensitiveFilePath("src/index.js"), false);
  });

  it("bloque toujours l'écriture .env (always-on)", async () => {
    const outcome = await evaluateHookChain(
      {
        type: PRIVILEGED_ACTION_TYPES.FILE_WRITE,
        path: ".env",
        workspaceRoot: DEFAULT_WORKSPACE_ROOT,
      },
      evaluatorState(),
    );
    assert.equal(outcome.allowed, false);
    assert.equal(outcome.verdict, HOOK_VERDICTS.DENY);
    assert.equal(outcome.hookId, "sensitiveFilesHook");
  });

  it("bloque la lecture .env si /protect-secrets actif", async () => {
    securityHooks.activate("/protect-secrets");
    const outcome = await evaluateHookChain(
      {
        type: PRIVILEGED_ACTION_TYPES.FILE_READ,
        path: ".env",
        workspaceRoot: DEFAULT_WORKSPACE_ROOT,
      },
      evaluatorState(),
    );
    assert.equal(outcome.allowed, false);
    assert.match(outcome.reason, /protect-secrets/i);
  });
});

describe("hookRegistry — pathBoundaryHook", () => {
  it("rejette un chemin hors workspace", () => {
    assert.throws(
      () => resolveCanonicalWithinRoot(DEFAULT_WORKSPACE_ROOT, "../../../etc/passwd"),
      /PÉRIMÈTRE|FRONTIÈRE/i,
    );
  });

  it("accepte un chemin relatif dans le workspace", () => {
    const canonical = resolveCanonicalWithinRoot(DEFAULT_WORKSPACE_ROOT, "server/package.json");
    assert.ok(canonical.startsWith(path.resolve(DEFAULT_WORKSPACE_ROOT)));
  });

  it("DENY si écriture hors /freeze", async () => {
    securityHooks.setFreezeDirectory(path.join(DEFAULT_WORKSPACE_ROOT, "server"));
    const outcome = await evaluateHookChain(
      {
        type: PRIVILEGED_ACTION_TYPES.FILE_WRITE,
        path: "projects/outside.txt",
        workspaceRoot: DEFAULT_WORKSPACE_ROOT,
      },
      evaluatorState(),
    );
    assert.equal(outcome.allowed, false);
    assert.match(outcome.reason, /freeze/i);
    securityHooks.deactivate("/freeze");
    securityHooks.freezeDirectory = null;
  });
});

describe("hookRegistry — ordre déterministe", () => {
  it("court-circuite sur DENY CRITICAL avant HIGH", async () => {
    securityHooks.activate("/careful");
    const outcome = await evaluateHookChain(
      {
        type: PRIVILEGED_ACTION_TYPES.FILE_WRITE,
        path: ".env",
        workspaceRoot: DEFAULT_WORKSPACE_ROOT,
      },
      evaluatorState(),
    );
    assert.equal(outcome.hookId, "sensitiveFilesHook");
    assert.equal(outcome.trail[0].hookId, "sensitiveFilesHook");
  });
});
