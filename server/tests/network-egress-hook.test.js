import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import securityHooks from "../src/hooks/securityHooks.js";
import {
  evaluateHookChain,
  HOOK_VERDICTS,
  HOOK_POLICY_VERSION,
} from "../src/hooks/hookRegistry.js";
import {
  classifyNetworkEgress,
  hostnameMatchesAllowlist,
  NETWORK_EGRESS_MODES,
  getNetworkEgressMode,
  isLocalMcpServerPath,
} from "../src/hooks/networkEgressPolicy.js";
import {
  executePrivilegedAction,
  mapToolInvocationToAction,
  PRIVILEGED_ACTION_TYPES,
} from "../src/hooks/privilegedActionGate.js";
import { DEFAULT_MCP_SERVERS_DIR } from "../src/mcp/mcp-bridge.js";

const ORIGINAL_MODE = process.env.NETWORK_EGRESS_MODE;

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

describe("networkEgressPolicy — allowlist", () => {
  it("autorise duckduckgo et registry.npmjs.org", () => {
    assert.equal(hostnameMatchesAllowlist("duckduckgo.com"), true);
    assert.equal(hostnameMatchesAllowlist("lite.duckduckgo.com"), true);
    assert.equal(hostnameMatchesAllowlist("registry.npmjs.org"), true);
    assert.equal(hostnameMatchesAllowlist("api.evil.example"), false);
  });

  it("webSearch ALLOW en mode allowlist", () => {
    process.env.NETWORK_EGRESS_MODE = NETWORK_EGRESS_MODES.ALLOWLIST;
    const decision = classifyNetworkEgress(
      {
        type: PRIVILEGED_ACTION_TYPES.HTTP_REQUEST,
        toolName: "webSearch",
        egressHosts: ["duckduckgo.com", "lite.duckduckgo.com"],
      },
      { isActive: () => false },
    );
    assert.equal(decision.decision, "allow");
  });

  it("webSummarize DENY si domaine inconnu (allowlist sans /confirm)", () => {
    process.env.NETWORK_EGRESS_MODE = NETWORK_EGRESS_MODES.ALLOWLIST;
    const decision = classifyNetworkEgress(
      {
        type: PRIVILEGED_ACTION_TYPES.HTTP_REQUEST,
        toolName: "webSummarize",
        url: "https://evil-unknown.example/page",
      },
      { isActive: () => false },
    );
    assert.equal(decision.decision, "deny");
  });

  it("webSummarize ALLOW sur wikipedia.org", () => {
    process.env.NETWORK_EGRESS_MODE = NETWORK_EGRESS_MODES.ALLOWLIST;
    const decision = classifyNetworkEgress(
      {
        type: PRIVILEGED_ACTION_TYPES.HTTP_REQUEST,
        toolName: "webSummarize",
        url: "https://fr.wikipedia.org/wiki/Test",
      },
      { isActive: () => false },
    );
    assert.equal(decision.decision, "allow");
  });

  it("/no-network bloque tout HTTP", () => {
    const decision = classifyNetworkEgress(
      {
        type: PRIVILEGED_ACTION_TYPES.HTTP_REQUEST,
        toolName: "webSearch",
        egressHosts: ["duckduckgo.com"],
      },
      { isActive: (cmd) => cmd === "/no-network" },
    );
    assert.equal(decision.decision, "deny");
  });

  it("MCP local ALLOW", () => {
    const localPath = `${DEFAULT_MCP_SERVERS_DIR}/echo-server.js`;
    assert.equal(isLocalMcpServerPath(localPath), true);
    const decision = classifyNetworkEgress(
      {
        type: PRIVILEGED_ACTION_TYPES.MCP_TOOL,
        mcpServer: localPath,
      },
      { isActive: () => false },
    );
    assert.equal(decision.decision, "allow");
  });

  it("MCP externe REQUIRE_APPROVAL si /confirm", () => {
    const decision = classifyNetworkEgress(
      {
        type: PRIVILEGED_ACTION_TYPES.MCP_TOOL,
        mcpServer: "C:/tmp/external-mcp.js",
      },
      { isActive: (cmd) => cmd === "/confirm" },
    );
    assert.equal(decision.decision, "require_approval");
  });
});

describe("networkEgressHook — registre", () => {
  beforeEach(() => {
    process.env.NETWORK_EGRESS_MODE = NETWORK_EGRESS_MODES.ALLOWLIST;
    securityHooks.deactivate("/no-network");
    securityHooks.deactivate("/confirm");
  });

  it("policy_version 1.2.0", () => {
    assert.equal(HOOK_POLICY_VERSION, "1.2.0");
  });

  it("DENY webSummarize loopback via SSRF", async () => {
    const outcome = await evaluateHookChain(
      {
        type: PRIVILEGED_ACTION_TYPES.HTTP_REQUEST,
        toolName: "webSummarize",
        url: "http://127.0.0.1/admin",
      },
      evaluatorState(),
    );
    assert.equal(outcome.allowed, false);
    assert.equal(outcome.hookId, "networkEgressHook");
    assert.equal(outcome.verdict, HOOK_VERDICTS.DENY);
  });

  it("DENY avec /no-network actif", async () => {
    securityHooks.activate("/no-network");
    const outcome = await evaluateHookChain(
      {
        type: PRIVILEGED_ACTION_TYPES.HTTP_REQUEST,
        toolName: "webSearch",
        egressHosts: ["duckduckgo.com"],
      },
      evaluatorState(),
    );
    assert.equal(outcome.allowed, false);
    assert.match(outcome.reason, /no-network/i);
  });

  it("mapToolInvocationToAction webSearch → http_request + egressHosts", () => {
    const action = mapToolInvocationToAction("webSearch", { query: "test" }, { sessionId: "s1" });
    assert.equal(action.type, PRIVILEGED_ACTION_TYPES.HTTP_REQUEST);
    assert.equal(action.toolName, "webSearch");
    assert.ok(action.egressHosts?.includes("duckduckgo.com"));
  });

  it("executePrivilegedAction bloque SSRF preflight localhost", async () => {
    const outcome = await executePrivilegedAction(
      {
        type: PRIVILEGED_ACTION_TYPES.HTTP_REQUEST,
        toolName: "webSummarize",
        url: "http://localhost:3000/secret",
        sessionId: "egress-test",
        sideEffects: true,
        riskLevel: "HIGH",
      },
      async () => "should-not-run",
    );
    assert.equal(outcome.success, false);
    assert.match(outcome.error, /SSRF|loopback|bloqu|allowlist|localhost/i);
  });
});

describe("networkEgressPolicy — rollout llm_providers", () => {
  it("bloque webSearch en mode llm_providers", () => {
    process.env.NETWORK_EGRESS_MODE = NETWORK_EGRESS_MODES.LLM_PROVIDERS;
    assert.equal(getNetworkEgressMode(), NETWORK_EGRESS_MODES.LLM_PROVIDERS);
    const decision = classifyNetworkEgress(
      { type: PRIVILEGED_ACTION_TYPES.HTTP_REQUEST, toolName: "webSearch" },
      { isActive: () => false },
    );
    assert.equal(decision.decision, "deny");
    process.env.NETWORK_EGRESS_MODE = ORIGINAL_MODE;
  });
});
