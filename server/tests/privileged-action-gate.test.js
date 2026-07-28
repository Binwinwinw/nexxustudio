import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import securityHooks from "../src/hooks/securityHooks.js";
import {
  executePrivilegedAction,
  mapToolInvocationToAction,
  mapMcpToolToAction,
  formatGateBlockedMessage,
  GATE_BLOCK_REASONS,
  PRIVILEGED_ACTION_TYPES,
} from "../src/hooks/privilegedActionGate.js";
import toolExecutor from "../src/agent/utils/toolExecutor.js";

describe("privilegedActionGate — P0 enforcement", () => {
  const initialHooks = new Set(securityHooks.activeHooks);

  beforeEach(() => {
    securityHooks.deactivate("/careful");
    securityHooks.deactivate("/freeze");
    securityHooks.deactivate("/read-only");
    securityHooks.deactivate("/confirm");
    securityHooks.deactivate("/protect-secrets");
    securityHooks.setAuditStrict(false);
    securityHooks.freezeDirectory = null;
    securityHooks.readOnlyDirectories = new Set();
  });

  afterEach(() => {
    securityHooks.activeHooks = new Set(initialHooks);
  });

  it("mapToolInvocationToAction — writeFile → file_write", () => {
    const action = mapToolInvocationToAction(
      "writeFile",
      { path: "src/foo.js", content: "x" },
      { sessionId: "s1" },
    );
    assert.equal(action.type, PRIVILEGED_ACTION_TYPES.FILE_WRITE);
    assert.equal(action.path, "src/foo.js");
    assert.equal(action.sessionId, "s1");
  });

  it("bloque file_write hors /freeze (fail-closed)", async () => {
    securityHooks.setFreezeDirectory(process.cwd());

    const outcome = await executePrivilegedAction(
      {
        type: PRIVILEGED_ACTION_TYPES.FILE_WRITE,
        path: "/tmp/outside-freeze/test.txt",
        source: "test",
        sessionId: "gate-test",
        sideEffects: true,
        riskLevel: "CRITICAL",
      },
      async () => "should-not-run",
    );

    assert.equal(outcome.success, false);
    assert.equal(outcome.blocked, true);
    assert.match(outcome.error, /freeze|hors de/i);
  });

  it("bloque command_execute destructive via /careful", async () => {
    securityHooks.activate("/careful");

    const outcome = await executePrivilegedAction(
      {
        type: PRIVILEGED_ACTION_TYPES.COMMAND_EXECUTE,
        command: "rm -rf node_modules",
        source: "test",
        sessionId: "gate-test",
      },
      async () => "should-not-run",
    );

    assert.equal(outcome.success, false);
    assert.match(outcome.error, /careful|destructive|rm/i);
  });

  it("stoppe l'exécution si /confirm actif sur action critique", async () => {
    securityHooks.activate("/confirm");

    const outcome = await executePrivilegedAction(
      {
        type: PRIVILEGED_ACTION_TYPES.FILE_WRITE,
        path: "src/safe.js",
        source: "test",
        sessionId: "gate-test",
        riskLevel: "CRITICAL",
        sideEffects: true,
      },
      async () => "should-not-run",
    );

    assert.equal(outcome.success, false);
    assert.equal(outcome.requiresConfirmation, true);
    assert.equal(outcome.code, GATE_BLOCK_REASONS.CONFIRMATION_REQUIRED);
    assert.match(formatGateBlockedMessage(outcome), /CONFIRMATION_REQUIRED/);
  });

  it("autorise et exécute une action sans hook bloquant", async () => {
    const outcome = await executePrivilegedAction(
      {
        type: PRIVILEGED_ACTION_TYPES.TOOL_INVOKE,
        toolName: "knowledgeSearch",
        source: "test",
        sessionId: "gate-test",
        riskLevel: "LOW",
        sideEffects: false,
      },
      async () => ({ ok: true, value: 42 }),
    );

    assert.equal(outcome.success, true);
    assert.deepEqual(outcome.result, { ok: true, value: 42 });
    assert.ok(outcome.actionId);
  });

  it("bloque writeFile .env via sensitiveFilesHook (always-on)", async () => {
    const outcome = await executePrivilegedAction(
      {
        type: PRIVILEGED_ACTION_TYPES.FILE_WRITE,
        path: ".env",
        source: "test",
        sessionId: "gate-test",
        workspaceRoot: process.cwd(),
      },
      async () => "should-not-run",
    );

    assert.equal(outcome.success, false);
    assert.match(outcome.error, /protect-secrets|sensible/i);
  });

  it("validatePrivilegedAction retourne policySnapshot", async () => {
    securityHooks.activate("/careful");
    const pre = await securityHooks.validatePrivilegedAction({
      type: PRIVILEGED_ACTION_TYPES.COMMAND_EXECUTE,
      command: "echo ok",
      id: "test-action",
    });
    assert.equal(pre.allowed, true);
    assert.ok(pre.policySnapshot?.policy_version);
    assert.ok(Array.isArray(pre.trail));
  });

  it("mapMcpToolToAction — MCP passe par mcp_tool", () => {
    const action = mapMcpToolToAction("echo", { msg: "hi" }, {
      serverPath: "/data/mcp/echo.js",
      sessionId: "mcp-1",
    });
    assert.equal(action.type, PRIVILEGED_ACTION_TYPES.MCP_TOOL);
    assert.equal(action.toolName, "echo");
    assert.equal(action.mcpServer, "/data/mcp/echo.js");
  });
});

describe("privilegedActionGate — intégration toolExecutor", () => {
  beforeEach(() => {
    securityHooks.deactivate("/careful");
    securityHooks.deactivate("/freeze");
    securityHooks.deactivate("/read-only");
    securityHooks.deactivate("/confirm");
    securityHooks.freezeDirectory = null;
  });

  it("toolExecutor passe par le gate — writeFile bloqué hors freeze", async () => {
    securityHooks.setFreezeDirectory(process.cwd());

    const out = await toolExecutor.executeDirect(
      "writeFile",
      { path: "/etc/passwd", content: "hack" },
      { sessionId: "tool-gate-test", activeExpert: { key: "forge", name: "Forge" } },
    );

    assert.match(out, /HOOK_BLOCKED|freeze|hors de/i);
  });
});
