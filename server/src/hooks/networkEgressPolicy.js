/**
 * Politique d'egress réseau — allowlist progressive (Phase D).
 * NETWORK_EGRESS_MODE : off | llm_providers | allowlist (défaut) | strict
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TRUSTED_DOMAIN_PATTERNS } from "../agent/policies/web/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_MCP_SERVERS_DIR = path.resolve(
  __dirname,
  "../../config/mcp/servers",
);

export const NETWORK_EGRESS_MODES = Object.freeze({
  OFF: "off",
  LLM_PROVIDERS: "llm_providers",
  ALLOWLIST: "allowlist",
  STRICT: "strict",
});

/** Rollout Phase D — allowlist de base */
export const NETWORK_DOMAIN_ALLOWLIST = Object.freeze([
  /^duckduckgo\.com$/i,
  /^lite\.duckduckgo\.com$/i,
  /^([a-z0-9-]+\.)*duckduckgo\.com$/i,
  /^registry\.npmjs\.org$/i,
  /^([a-z0-9-]+\.)*github\.com$/i,
  /^raw\.githubusercontent\.com$/i,
  /^generativelanguage\.googleapis\.com$/i,
  /^([a-z0-9-]+\.)*googleapis\.com$/i,
  /^([a-z0-9-]+\.)*gemini\.google\.com$/i,
  ...TRUSTED_DOMAIN_PATTERNS,
]);

export const WEB_SEARCH_EGRESS_HOSTS = Object.freeze([
  "duckduckgo.com",
  "lite.duckduckgo.com",
]);

export function getNetworkEgressMode() {
  const mode = String(process.env.NETWORK_EGRESS_MODE || NETWORK_EGRESS_MODES.ALLOWLIST)
    .trim()
    .toLowerCase();
  if (Object.values(NETWORK_EGRESS_MODES).includes(mode)) return mode;
  return NETWORK_EGRESS_MODES.ALLOWLIST;
}

export function hostnameMatchesAllowlist(hostname = "") {
  const host = String(hostname).toLowerCase();
  return NETWORK_DOMAIN_ALLOWLIST.some((re) => re.test(host));
}

export function isLocalMcpServerPath(serverPath = "") {
  if (!serverPath) return false;
  const resolved = path.resolve(serverPath);
  const root = path.resolve(DEFAULT_MCP_SERVERS_DIR);
  return resolved === root || resolved.startsWith(`${root}${path.sep}`);
}

export function extractHttpHostname(action = {}) {
  const rawUrl = action.url || action.payload?.url || "";
  if (!rawUrl || String(rawUrl).startsWith("serper:")) return null;
  try {
    return new URL(String(rawUrl).trim()).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * @returns {'allow'|'deny'|'require_approval'}
 */
export function classifyNetworkEgress(action = {}, state = {}) {
  if (state.isActive?.("/no-network")) {
    return { decision: "deny", reason: "/no-network actif — egress HTTP/MCP interdit" };
  }

  const mode = getNetworkEgressMode();
  if (mode === NETWORK_EGRESS_MODES.OFF) {
    return { decision: "allow", reason: "NETWORK_EGRESS_MODE=off" };
  }

  if (action.type === "mcp_tool") {
    if (isLocalMcpServerPath(action.mcpServer)) {
      return { decision: "allow", reason: "mcp_local_registered" };
    }
    if (state.isActive?.("/confirm")) {
      return {
        decision: "require_approval",
        reason: "MCP externe — confirmation requise (fail-closed P0)",
      };
    }
    return { decision: "deny", reason: "MCP externe hors répertoire autorisé" };
  }

  if (action.type !== "http_request") {
    return { decision: "allow", reason: "not_http" };
  }

  if (mode === NETWORK_EGRESS_MODES.LLM_PROVIDERS) {
    if (action.toolName === "webSearch" || action.toolName === "webSummarize") {
      return {
        decision: "deny",
        reason: "NETWORK_EGRESS_MODE=llm_providers — webSearch/webSummarize désactivés",
      };
    }
    return { decision: "allow", reason: "llm_providers_pass_through" };
  }

  if (action.toolName === "webSearch") {
    const allowed = (action.egressHosts || WEB_SEARCH_EGRESS_HOSTS).every((host) =>
      hostnameMatchesAllowlist(host),
    );
    if (!allowed) {
      return { decision: "deny", reason: "webSearch — hôte egress hors allowlist" };
    }
    return { decision: "allow", reason: "webSearch_allowlist" };
  }

  const hostname = extractHttpHostname(action);
  if (!hostname) {
    if (action.toolName === "webSearch") {
      return { decision: "allow", reason: "webSearch_query_only" };
    }
    return { decision: "deny", reason: "http_request_sans_url_valide" };
  }

  if (hostnameMatchesAllowlist(hostname)) {
    return { decision: "allow", reason: "domain_allowlist", hostname };
  }

  if (mode === NETWORK_EGRESS_MODES.STRICT) {
    return { decision: "deny", reason: `domaine hors allowlist (strict) : ${hostname}` };
  }

  if (state.isActive?.("/confirm")) {
    return {
      decision: "require_approval",
      reason: `Domaine non allowlisté — confirmation requise : ${hostname}`,
      hostname,
    };
  }

  return { decision: "deny", reason: `domaine hors allowlist : ${hostname}` };
}
