/**
 * P0 — Passage unique obligatoire pour actions à effet de bord (TCB).
 * Doctrine : fail-closed, journalisé, sans chemin alternatif pour les outils agents.
 */
import crypto from "node:crypto";
import { auditLogger } from "../security/auditLogger.js";
import securityHooks from "./securityHooks.js";
import { TOOL_REGISTRY } from "../agent/utils/toolRegistry.js";
import { WEB_SEARCH_EGRESS_HOSTS } from "./networkEgressPolicy.js";
import { validateEgressUrl } from "../security/ssrfProtection.js";
import { runPostEditHooks } from "./postEdit/postEditHook.js";

export const PRIVILEGED_ACTION_TYPES = Object.freeze({
  FILE_READ: "file_read",
  FILE_WRITE: "file_write",
  COMMAND_EXECUTE: "command_execute",
  HTTP_REQUEST: "http_request",
  MCP_TOOL: "mcp_tool",
  TOOL_INVOKE: "tool_invoke",
});

export const GATE_BLOCK_REASONS = Object.freeze({
  GATE_UNAVAILABLE: "gate_unavailable",
  PRE_HOOK_BLOCKED: "pre_hook_blocked",
  CONFIRMATION_REQUIRED: "confirmation_required",
  AUDIT_FAIL_CLOSED: "audit_fail_closed",
  EXECUTION_FAILED: "execution_failed",
  POST_HOOK_BLOCKED: "post_hook_blocked",
});

function registryMeta(toolName = "") {
  return TOOL_REGISTRY.find((t) => t.name === toolName) || null;
}

/**
 * Normalise un appel outil Citadelle → action canonique pour les hooks.
 */
export function mapToolInvocationToAction(toolName, args = {}, context = {}) {
  const meta = registryMeta(toolName);
  const getArg = (idx, key) => {
    if (Array.isArray(args)) return args[idx];
    if (typeof args === "object" && args !== null) return args[key] ?? args[idx];
    return args;
  };

  const base = {
    id: null,
    source: context.source || "toolExecutor",
    sessionId: context.sessionId || "default",
    toolName,
    sideEffects: Boolean(meta?.sideEffects),
    riskLevel: meta?.riskLevel || "UNKNOWN",
    expertKey: context.activeExpert?.key || null,
    workspaceRoot: context.projectRoot || null,
  };

  switch (toolName) {
    case "writeFile":
      return {
        ...base,
        type: PRIVILEGED_ACTION_TYPES.FILE_WRITE,
        path: getArg(0, "path"),
        content: getArg(1, "content"),
        operation: "write",
      };
    case "buildProject":
      return {
        ...base,
        type: PRIVILEGED_ACTION_TYPES.FILE_WRITE,
        path: getArg(0, "projectName"),
        operation: "create",
        description: "buildProject scaffold",
      };
    case "validateLint": {
      const target = getArg(0, "path") || ".";
      return {
        ...base,
        type: PRIVILEGED_ACTION_TYPES.COMMAND_EXECUTE,
        command: `npx eslint ${target}`,
        cwd: context.projectRoot || process.cwd(),
      };
    }
    case "validateBuild":
      return {
        ...base,
        type: PRIVILEGED_ACTION_TYPES.COMMAND_EXECUTE,
        command: "npm run build",
        cwd: context.projectRoot || process.cwd(),
      };
    case "webSearch":
      return {
        ...base,
        type: PRIVILEGED_ACTION_TYPES.HTTP_REQUEST,
        toolName: "webSearch",
        url: `serper:search?q=${encodeURIComponent(String(getArg(0, "query") || ""))}`,
        method: "GET",
        egressHosts: [...WEB_SEARCH_EGRESS_HOSTS],
        sideEffects: true,
        riskLevel: "HIGH",
      };
    case "webSummarize":
      return {
        ...base,
        type: PRIVILEGED_ACTION_TYPES.HTTP_REQUEST,
        toolName: "webSummarize",
        url: String(getArg(0, "url") || ""),
        method: "GET",
        sideEffects: true,
        riskLevel: "HIGH",
      };
    case "workspaceSearch":
    case "pulse":
      return {
        ...base,
        type: PRIVILEGED_ACTION_TYPES.FILE_READ,
        path: getArg(0, "path") || getArg(0, "directory") || getArg(0, "query") || ".",
        operation: "read",
      };
    default:
      return {
        ...base,
        type: PRIVILEGED_ACTION_TYPES.TOOL_INVOKE,
        operation: "invoke",
        payload: args,
      };
  }
}

export function mapMcpToolToAction(toolName, args = {}, context = {}) {
  return {
    id: null,
    type: PRIVILEGED_ACTION_TYPES.MCP_TOOL,
    source: context.source || "mcp-bridge",
    sessionId: context.sessionId || "default",
    toolName,
    mcpServer: context.serverPath || null,
    payload: args,
    sideEffects: true,
    riskLevel: "HIGH",
    operation: "mcp_tool_call",
  };
}

function buildHookAuditPayload(pre, extra = {}) {
  const payload = { ...extra };
  if (pre?.policySnapshot) payload.policy_snapshot = pre.policySnapshot;
  if (pre?.verdict) payload.verdict = pre.verdict;
  if (pre?.hook) payload.hook_id = pre.hook;
  if (pre?.trail?.length) payload.evaluation_trail = pre.trail;
  if (securityHooks.shouldEmitStrictAuditTrail?.() && pre?.trail?.length) {
    payload.evaluation_trail = pre.trail;
  }
  return payload;
}

async function safeAudit(action, payload) {
  try {
    return auditLogger.logEvent(action, payload);
  } catch (err) {
    const wrapped = new Error(`Audit System Failure (Fail-Safe): ${err.message}`);
    wrapped.code = GATE_BLOCK_REASONS.AUDIT_FAIL_CLOSED;
    throw wrapped;
  }
}

function blockedResponse({
  reason,
  code = GATE_BLOCK_REASONS.PRE_HOOK_BLOCKED,
  action = null,
  pre = null,
  requiresConfirmation = false,
  hookId = null,
  details = null,
}) {
  return {
    success: false,
    blocked: true,
    requiresConfirmation,
    code,
    error: reason,
    actionId: action?.id || null,
    pre,
    hookId,
    details,
  };
}

/**
 * Point de passage unique — toute exécution outil/MCP à effet de bord DOIT passer ici.
 * @param {object} action
 * @param {() => Promise<*>} executorFn
 */
export async function executePrivilegedAction(action, executorFn) {
  if (typeof executorFn !== "function") {
    return blockedResponse({
      code: GATE_BLOCK_REASONS.GATE_UNAVAILABLE,
      reason: "executorFn manquant — exécution refusée (fail-closed)",
    });
  }

  if (!securityHooks || typeof securityHooks.validatePrivilegedAction !== "function") {
    return blockedResponse({
      code: GATE_BLOCK_REASONS.GATE_UNAVAILABLE,
      reason: "securityHooks.validatePrivilegedAction indisponible — fail-closed",
    });
  }

  const enriched = {
    ...action,
    id: action.id || crypto.randomUUID(),
    startedAt: Date.now(),
  };

  let pre;
  try {
    pre = await securityHooks.validatePrivilegedAction(enriched);
  } catch (err) {
    return blockedResponse({
      code: GATE_BLOCK_REASONS.GATE_UNAVAILABLE,
      reason: `Erreur gate pre-hook : ${err.message}`,
      action: enriched,
    });
  }

  if (!pre.allowed) {
    try {
      await safeAudit(
        "PRIVILEGED_ACTION_BLOCKED",
        buildHookAuditPayload(pre, {
          actionId: enriched.id,
          type: enriched.type,
          source: enriched.source,
          sessionId: enriched.sessionId,
          toolName: enriched.toolName || null,
          reason: pre.reason,
          hook: pre.hook || null,
          requiresConfirmation: Boolean(pre.requiresConfirmation),
        }),
      );
    } catch (err) {
      return blockedResponse({
        code: GATE_BLOCK_REASONS.AUDIT_FAIL_CLOSED,
        reason: err.message,
        action: enriched,
      });
    }

    if (pre.requiresConfirmation) {
      return blockedResponse({
        code: GATE_BLOCK_REASONS.CONFIRMATION_REQUIRED,
        reason:
          pre.reason ||
          "Confirmation requise — exécution stoppée (P0). Désactivez /confirm ou attendez l'orchestrateur UI.",
        action: enriched,
        pre,
        requiresConfirmation: true,
      });
    }

    return blockedResponse({
      reason: pre.reason || "Action bloquée par pre-hook",
      action: enriched,
      pre,
    });
  }

  try {
    await safeAudit(
      "PRIVILEGED_ACTION_ALLOWED",
      buildHookAuditPayload(pre, {
        actionId: enriched.id,
        type: enriched.type,
        source: enriched.source,
        sessionId: enriched.sessionId,
        toolName: enriched.toolName || null,
        riskLevel: enriched.riskLevel || null,
      }),
    );
  } catch (err) {
    return blockedResponse({
      code: GATE_BLOCK_REASONS.AUDIT_FAIL_CLOSED,
      reason: err.message,
      action: enriched,
    });
  }

  if (
    enriched.type === PRIVILEGED_ACTION_TYPES.HTTP_REQUEST &&
    enriched.url &&
    !String(enriched.url).startsWith("serper:")
  ) {
    const ssrf = await validateEgressUrl(enriched.url);
    if (ssrf.blocked) {
      try {
        await safeAudit(
          "PRIVILEGED_ACTION_BLOCKED",
          buildHookAuditPayload(pre, {
            actionId: enriched.id,
            type: enriched.type,
            reason: `SSRF preflight : ${ssrf.reason}`,
            hook_id: "networkEgressHook",
            url: enriched.url,
          }),
        );
      } catch (err) {
        return blockedResponse({
          code: GATE_BLOCK_REASONS.AUDIT_FAIL_CLOSED,
          reason: err.message,
          action: enriched,
        });
      }
      return blockedResponse({
        reason: `SSRF preflight bloqué : ${ssrf.reason}`,
        action: enriched,
        pre,
      });
    }
  }

  let result;
  try {
    result = await executorFn();
  } catch (err) {
    try {
      await safeAudit("PRIVILEGED_ACTION_FAILED", {
        actionId: enriched.id,
        type: enriched.type,
        error: err.message,
      });
    } catch (auditErr) {
      return blockedResponse({
        code: GATE_BLOCK_REASONS.AUDIT_FAIL_CLOSED,
        reason: auditErr.message,
        action: enriched,
      });
    }
    return blockedResponse({
      code: GATE_BLOCK_REASONS.EXECUTION_FAILED,
      reason: err.message,
      action: enriched,
    });
  }

  if (enriched.type === PRIVILEGED_ACTION_TYPES.FILE_WRITE && enriched.operation !== "mkdir") {
    const post = await runPostEditHooks(enriched, securityHooks._evaluatorState?.() || {});
    if (!post.ok) {
      try {
        await safeAudit(
          "PRIVILEGED_ACTION_POST_BLOCKED",
          buildHookAuditPayload(pre, {
            actionId: enriched.id,
            type: enriched.type,
            hook_id: post.hookId,
            reason: post.message,
            details: post.details,
            evaluation_trail: post.trail,
            note: "file_write_applied_post_validation_failed",
          }),
        );
      } catch (err) {
        return blockedResponse({
          code: GATE_BLOCK_REASONS.AUDIT_FAIL_CLOSED,
          reason: err.message,
          action: enriched,
        });
      }
      return blockedResponse({
        code: GATE_BLOCK_REASONS.POST_HOOK_BLOCKED,
        reason: post.message,
        action: enriched,
        pre: { hook: post.hookId, trail: post.trail },
        hookId: post.hookId,
        details: post.details,
      });
    }
    if (post.trail?.length) {
      try {
        await safeAudit("PRIVILEGED_ACTION_POST_OK", {
          actionId: enriched.id,
          type: enriched.type,
          hook_id: "post_edit_chain",
          evaluation_trail: post.trail,
        });
      } catch (err) {
        return blockedResponse({
          code: GATE_BLOCK_REASONS.AUDIT_FAIL_CLOSED,
          reason: err.message,
          action: enriched,
        });
      }
    }
  }

  try {
    securityHooks.postPrivilegedAction?.(enriched, result);
    await safeAudit("PRIVILEGED_ACTION_COMPLETED", {
      actionId: enriched.id,
      type: enriched.type,
      source: enriched.source,
      sessionId: enriched.sessionId,
      toolName: enriched.toolName || null,
    });
  } catch (err) {
    return blockedResponse({
      code: GATE_BLOCK_REASONS.AUDIT_FAIL_CLOSED,
      reason: err.message,
      action: enriched,
    });
  }

  return {
    success: true,
    blocked: false,
    result,
    actionId: enriched.id,
  };
}

export function formatGateBlockedMessage(gateResult = {}) {
  if (gateResult.requiresConfirmation) {
    return (
      `[HOOK_CONFIRMATION_REQUIRED] ${gateResult.error}\n` +
      "💡 L'exécution est stoppée tant qu'aucune approbation runtime n'est branchée (P0 fail-closed)."
    );
  }
  if (gateResult.code === GATE_BLOCK_REASONS.POST_HOOK_BLOCKED) {
    const hook = gateResult.hookId || gateResult.pre?.hook || "post_edit";
    const details = gateResult.details ? `\n${gateResult.details}` : "";
    return (
      `[POST_HOOK_BLOCKED:${hook}] ${gateResult.error || "Validation post-écriture échouée"}` +
      `${details}\n` +
      "💡 Le fichier a été écrit mais la validation post-action a échoué — corrigez et réessayez."
    );
  }
  return `[HOOK_BLOCKED] ${gateResult.error || "Action privilégiée refusée"}`;
}
