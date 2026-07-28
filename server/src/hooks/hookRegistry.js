/**
 * Registre unifié des hooks — évaluation déterministe CRITICAL → HIGH → MEDIUM.
 * @see ADR-20260609-Hooks-Governance-v1
 */
import path from "node:path";
import {
  resolveCanonicalWithinRoot,
  DEFAULT_WORKSPACE_ROOT,
  isPathWithinDirectory,
  isWriteAllowedInReadOnlyZones,
  normalizePathForPolicy,
} from "./pathBoundary.js";

export const FORGE_ARTIFACTS_ROOT = path.join(DEFAULT_WORKSPACE_ROOT, "projects");

import { classifyNetworkEgress } from "./networkEgressPolicy.js";
import { validateResolvedAddresses } from "../security/ssrfProtection.js";

export { POST_HOOK_REGISTRY, POST_HOOK_POLICY_VERSION } from "./postEdit/postEditHook.js";

export const HOOK_POLICY_VERSION = "1.2.0";

export const HOOK_VERDICTS = Object.freeze({
  ALLOW: "ALLOW",
  DENY: "DENY",
  REQUIRE_APPROVAL: "REQUIRE_APPROVAL",
  ALLOW_WITH_CONSTRAINTS: "ALLOW_WITH_CONSTRAINTS",
});

export const HOOK_FAMILIES = Object.freeze({
  PRE_ACTION: "pre_action",
  CONFIRMATION: "confirmation",
  POST_ACTION: "post_action",
  AUDIT: "audit",
  SESSION: "session",
  DATA: "data",
});

const RISK_ORDER = Object.freeze({
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
});

export const FORGE_SHELL_ALLOWLIST = Object.freeze([
  /^npm\s+install(?:\s+--no-audit)?$/i,
  /^npm\s+run\s+build$/i,
]);

const DESTRUCTIVE_COMMAND_PATTERNS = [
  /rm\s+(-rf|--recursive)\s+/i,
  /drop\s+table/i,
  /DROP\s+DATABASE/i,
  /git\s+push\s+--force/i,
  /git\s+push\s+-f\b/i,
  /git\s+reset\s+--hard/i,
  /docker\s+system\s+prune/i,
  /chmod\s+777/i,
  /chmod\s+-R\s+777/i,
  /:>\s*\/etc\//i,
  /:>\s*\/boot\//i,
  /\/etc\//i,
  /\/boot\//i,
  /\/root\//i,
  /node_modules\//i,
  /package-lock\.json$/i,
  /yarn\.lock$/i,
  /pnpm-lock\.yaml$/i,
];

const SENSITIVE_FILE_PATTERNS = [
  /(^|\/)\.env(\.|$)/i,
  /(^|\/)\.env$/i,
  /\.pem$/i,
  /\.key$/i,
  /(^|\/)id_rsa$/i,
  /(^|\/)id_ed25519$/i,
  /(^|\/)credentials\.json$/i,
  /(^|\/)secrets\.json$/i,
  /(^|\/)service-account.*\.json$/i,
];

function allow(hookId, extra = {}) {
  return { verdict: HOOK_VERDICTS.ALLOW, hookId, ...extra };
}

function deny(hookId, reason, extra = {}) {
  return { verdict: HOOK_VERDICTS.DENY, hookId, reason, ...extra };
}

function requireApproval(hookId, reason, extra = {}) {
  return {
    verdict: HOOK_VERDICTS.REQUIRE_APPROVAL,
    hookId,
    reason,
    requiresConfirmation: true,
    ...extra,
  };
}

function allowWithConstraints(hookId, constraints = {}) {
  return {
    verdict: HOOK_VERDICTS.ALLOW_WITH_CONSTRAINTS,
    hookId,
    constraints,
  };
}

export function isSensitiveFilePath(filePath = "") {
  const normalized = normalizePathForPolicy(filePath);
  return SENSITIVE_FILE_PATTERNS.some((re) => re.test(normalized));
}

export function getDestructiveCommandSuggestion(command = "") {
  const suggestions = {
    "rm\\s+(-rf|--recursive)\\s+.*node_modules":
      "Utilise `npm run clean` ou supprime node_modules manuellement",
    "git\\s+push\\s+--force":
      "Utilise `git push` normal, ou `git push --force-with-lease`",
    "drop\\s+table": "Utilise une migration plutôt que DROP TABLE direct",
    "chmod\\s+777": "Utilise des permissions plus restrictives (ex: 755)",
  };

  for (const [pattern, suggestion] of Object.entries(suggestions)) {
    if (new RegExp(pattern, "i").test(command)) return suggestion;
  }
  return "Revise cette commande pour éviter les opérations destructrices";
}

function fileOperation(action = {}) {
  const type = action.type || "";
  if (action.operation === "mkdir") return "write";
  if (type === "file_write") return "write";
  if (type === "file_read") return "read";
  if (action.operation === "write" || action.operation === "create") return "write";
  return "read";
}

function isForgePrivilegedAction(action = {}) {
  return action.source === "forge" || Boolean(action.forgeArtifact || action.forgeCommand);
}

function actionTriggers(hook, action) {
  if (!hook.triggers?.length) return true;
  return hook.triggers.includes(action.type);
}

function hookIsActive(hook, state) {
  if (hook.alwaysOn) return true;
  if (!hook.commands?.length) return false;
  return hook.commands.some((cmd) => state.isActive(cmd));
}

export function buildPolicySnapshot(state = {}) {
  return {
    policy_version: HOOK_POLICY_VERSION,
    active_commands: Array.from(state.activeHooks || []),
    freeze_directory: state.freezeDirectory || null,
    read_only_directories: Array.from(state.readOnlyDirectories || []),
    workspace_root: state.workspaceRoot || DEFAULT_WORKSPACE_ROOT,
    audit_strict: Boolean(state.auditStrict),
    protect_secrets: state.isActive?.("/protect-secrets") ?? false,
    evaluated_at: new Date().toISOString(),
  };
}

function evaluateSensitiveFiles(action, state) {
  const filePath = action.path || action.file_path;
  if (!filePath) return allow("sensitiveFilesHook");

  const op = fileOperation(action);
  const sensitive = isSensitiveFilePath(filePath);

  if (sensitive && op === "write") {
    return deny(
      "sensitiveFilesHook",
      `/protect-secrets : écriture interdite sur fichier sensible (${filePath})`,
      {
        suggestion:
          "Ne modifie pas les fichiers de secrets directement — utilise un gestionnaire dédié.",
        severity: "critical",
      },
    );
  }

  if (sensitive && op === "read" && state.isActive("/protect-secrets")) {
    return deny(
      "sensitiveFilesHook",
      `/protect-secrets : lecture restreinte sur fichier sensible (${filePath})`,
      {
        suggestion: "Désactive /protect-secrets uniquement si l'accès est explicitement requis.",
        severity: "critical",
      },
    );
  }

  return allow("sensitiveFilesHook");
}

function evaluateDangerousCommand(action) {
  const command = action.command || action.payload?.command;
  if (!command) return allow("dangerousCommandHook");

  const isForge = isForgePrivilegedAction(action);

  for (const pattern of DESTRUCTIVE_COMMAND_PATTERNS) {
    if (pattern.test(command)) {
      const prefix = isForge
        ? "Commande Forge destructive interdite"
        : "/careful bloqué : commande destructive détectée";
      return deny("dangerousCommandHook", `${prefix} (${pattern})`, {
        suggestion: getDestructiveCommandSuggestion(command),
        severity: "critical",
      });
    }
  }

  return allow("dangerousCommandHook");
}

function evaluateForgeShell(action) {
  if (!isForgePrivilegedAction(action) || action.type !== "command_execute") {
    return allow("shellRunnerHook");
  }

  const command = String(action.command || "").trim();
  if (!command) {
    return deny("shellRunnerHook", "Commande Forge vide", { severity: "high" });
  }

  if (!FORGE_SHELL_ALLOWLIST.some((re) => re.test(command))) {
    return deny(
      "shellRunnerHook",
      `Commande Forge non autorisée : ${command}`,
      {
        suggestion:
          "Allowlist Phase C : npm install [--no-audit], npm run build",
        severity: "high",
      },
    );
  }

  const workspaceRoot = action.workspaceRoot || DEFAULT_WORKSPACE_ROOT;
  const cwdInput = action.cwd;
  if (!cwdInput) {
    return deny("shellRunnerHook", "cwd requis pour commande Forge", {
      severity: "high",
    });
  }

  const absCwd = path.isAbsolute(cwdInput)
    ? path.resolve(cwdInput)
    : path.resolve(workspaceRoot, cwdInput);
  const rel = path.relative(FORGE_ARTIFACTS_ROOT, absCwd);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return deny(
      "shellRunnerHook",
      `cwd Forge hors projects/ : ${cwdInput}`,
      {
        suggestion: "Les commandes Forge doivent s'exécuter dans un projet sous projects/.",
        severity: "high",
      },
    );
  }

  return allow("shellRunnerHook");
}

function evaluatePathBoundary(action, state) {
  const filePath = action.path || action.file_path;
  if (!filePath) return allow("pathBoundaryHook");

  const op = fileOperation(action);
  const workspaceRoot = action.workspaceRoot || state.workspaceRoot || DEFAULT_WORKSPACE_ROOT;

  if (action.type === "file_read" || action.type === "file_write") {
    try {
      const canonical = resolveCanonicalWithinRoot(workspaceRoot, filePath);
      const constrained = allowWithConstraints("pathBoundaryHook", {
        canonicalPath: canonical,
        workspaceRoot,
      });

      if (state.isActive("/freeze") && state.freezeDirectory && op === "write") {
        if (!isPathWithinDirectory(filePath, state.freezeDirectory)) {
          return deny(
            "pathBoundaryHook",
            `/freeze bloqué : ${filePath} est hors de ${state.freezeDirectory}`,
            {
              suggestion: `Utilise un fichier dans ${state.freezeDirectory} ou désactive /freeze`,
              severity: "high",
            },
          );
        }
      }

      if (state.isActive("/read-only") && op === "write") {
        if (!isWriteAllowedInReadOnlyZones(filePath, state.readOnlyDirectories)) {
          return deny(
            "pathBoundaryHook",
            `/read-only bloqué : écriture non autorisée dans ${filePath}`,
            {
              suggestion:
                "Utilise /confirm pour autoriser cette écriture, ou désactive /read-only",
              severity: "high",
            },
          );
        }
      }

      return constrained;
    } catch (err) {
      return deny("pathBoundaryHook", err.message, { severity: "high" });
    }
  }

  return allow("pathBoundaryHook");
}

function evaluateArtifactWrite(action) {
  if (action.source !== "forge" && !action.forgeArtifact) {
    return allow("artifactWriteHook");
  }

  const filePath = action.path;
  if (!filePath) {
    return deny("artifactWriteHook", "Écriture Forge sans chemin cible", {
      severity: "high",
    });
  }

  const workspaceRoot = action.workspaceRoot || DEFAULT_WORKSPACE_ROOT;
  const absolute = path.resolve(workspaceRoot, filePath);
  const rel = path.relative(FORGE_ARTIFACTS_ROOT, absolute);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return deny(
      "artifactWriteHook",
      `Écriture Forge hors projects/ interdite (${filePath})`,
      {
        suggestion: "Les artefacts Forge doivent résider sous projects/.",
        severity: "high",
      },
    );
  }

  return allow("artifactWriteHook");
}

async function evaluateNetworkEgress(action, state) {
  const policy = classifyNetworkEgress(action, state);

  if (policy.decision === "deny") {
    return deny("networkEgressHook", policy.reason, {
      suggestion: "Activez /no-network off ou utilisez un domaine allowlisté.",
      severity: "high",
      hostname: policy.hostname || null,
    });
  }

  if (policy.decision === "require_approval") {
    return requireApproval("networkEgressHook", policy.reason, {
      severity: "high",
      hostname: policy.hostname || null,
    });
  }

  const hostname =
    policy.hostname ||
    (action.url && !String(action.url).startsWith("serper:")
      ? (() => {
          try {
            return new URL(String(action.url).trim()).hostname.toLowerCase();
          } catch {
            return null;
          }
        })()
      : null);

  if (hostname && action.type === "http_request") {
    const ssrf = await validateResolvedAddresses(hostname);
    if (ssrf.blocked) {
      return deny("networkEgressHook", `SSRF bloqué : ${ssrf.reason}`, {
        severity: "critical",
        hostname,
        resolved: ssrf.resolved || null,
      });
    }
  }

  return allow("networkEgressHook");
}

function evaluateConfirmation(action, state) {
  if (!state.isActive("/confirm")) return allow("confirmationRequiredHook");
  if (!state.requiresConfirmation(action)) return allow("confirmationRequiredHook");

  const label = action.type || action.toolName || "action";
  return requireApproval(
    "confirmationRequiredHook",
    `⚠️ Action critique détectée : ${label}`,
    {
      context: {
        actionId: action.id,
        sessionId: action.sessionId,
        toolName: action.toolName,
        path: action.path,
        command: action.command,
      },
      severity: "high",
    },
  );
}

export const HOOK_REGISTRY = Object.freeze([
  {
    id: "sensitiveFilesHook",
    family: HOOK_FAMILIES.DATA,
    priority: "P0",
    riskLevel: "CRITICAL",
    commands: ["/protect-secrets"],
    triggers: ["file_read", "file_write"],
    alwaysOn: true,
    evaluate: evaluateSensitiveFiles,
  },
  {
    id: "dangerousCommandHook",
    family: HOOK_FAMILIES.PRE_ACTION,
    priority: "P0",
    riskLevel: "CRITICAL",
    commands: ["/careful"],
    triggers: ["command_execute"],
    alwaysOn: false,
    evaluate: evaluateDangerousCommand,
  },
  {
    id: "shellRunnerHook",
    family: HOOK_FAMILIES.PRE_ACTION,
    priority: "P1",
    riskLevel: "HIGH",
    commands: [],
    triggers: ["command_execute"],
    alwaysOn: true,
    evaluate: evaluateForgeShell,
  },
  {
    id: "artifactWriteHook",
    family: HOOK_FAMILIES.PRE_ACTION,
    priority: "P1",
    riskLevel: "HIGH",
    commands: [],
    triggers: ["file_write"],
    alwaysOn: true,
    evaluate: evaluateArtifactWrite,
  },
  {
    id: "pathBoundaryHook",
    family: HOOK_FAMILIES.PRE_ACTION,
    priority: "P0",
    riskLevel: "HIGH",
    commands: ["/freeze", "/read-only", "/workspace-only"],
    triggers: ["file_read", "file_write"],
    alwaysOn: true,
    evaluate: evaluatePathBoundary,
  },
  {
    id: "networkEgressHook",
    family: HOOK_FAMILIES.PRE_ACTION,
    priority: "P1",
    riskLevel: "HIGH",
    commands: ["/no-network"],
    triggers: ["http_request", "mcp_tool"],
    alwaysOn: true,
    evaluate: evaluateNetworkEgress,
  },
  {
    id: "confirmationRequiredHook",
    family: HOOK_FAMILIES.CONFIRMATION,
    priority: "P0",
    riskLevel: "HIGH",
    commands: ["/confirm"],
    triggers: null,
    alwaysOn: false,
    evaluate: evaluateConfirmation,
  },
  {
    id: "auditTrailHook",
    family: HOOK_FAMILIES.AUDIT,
    priority: "P0",
    riskLevel: "MEDIUM",
    commands: ["/audit-strict"],
    triggers: null,
    alwaysOn: false,
    evaluate: async () => allow("auditTrailHook"),
  },
]);

function sortHooks(registry) {
  return [...registry].sort(
    (a, b) => (RISK_ORDER[a.riskLevel] ?? 9) - (RISK_ORDER[b.riskLevel] ?? 9),
  );
}

function hookApplies(hook, action, state) {
  if (hook.id === "artifactWriteHook") {
    return isForgePrivilegedAction(action) && action.type === "file_write";
  }
  if (hook.id === "shellRunnerHook") {
    return (
      action.type === "command_execute" &&
      (action.source === "forge" || Boolean(action.forgeCommand))
    );
  }
  if (hook.id === "dangerousCommandHook") {
    if (action.type !== "command_execute") return false;
    if (action.source === "forge" || action.forgeCommand) return true;
    return hookIsActive(hook, state);
  }
  if (hook.id === "networkEgressHook") {
    return action.type === "http_request" || action.type === "mcp_tool";
  }
  if (!hookIsActive(hook, state)) return false;
  if (hook.triggers === null) {
    return hook.id === "confirmationRequiredHook"
      ? state.isActive("/confirm")
      : hook.id === "auditTrailHook";
  }
  return actionTriggers(hook, action);
}

/**
 * Évalue la chaîne de hooks P0. Court-circuit sur DENY / REQUIRE_APPROVAL.
 * @param {object} action
 * @param {object} state - État SecurityHooks (activeHooks, freeze, etc.)
 */
export async function evaluateHookChain(action = {}, state = {}) {
  const policySnapshot = buildPolicySnapshot(state);
  const trail = [];
  const applicable = sortHooks(HOOK_REGISTRY).filter((hook) => {
    if (hook.id === "auditTrailHook") return false;
    return hookApplies(hook, action, state);
  });

  for (const hook of applicable) {
    const result = await hook.evaluate(action, state);
    const entry = {
      hookId: hook.id,
      verdict: result.verdict,
      reason: result.reason || null,
      riskLevel: hook.riskLevel,
    };
    trail.push(entry);

    if (result.verdict === HOOK_VERDICTS.DENY) {
      return {
        allowed: false,
        verdict: HOOK_VERDICTS.DENY,
        hookId: result.hookId || hook.id,
        reason: result.reason,
        suggestion: result.suggestion || null,
        severity: result.severity || hook.riskLevel,
        trail,
        policySnapshot,
      };
    }

    if (result.verdict === HOOK_VERDICTS.REQUIRE_APPROVAL) {
      return {
        allowed: false,
        requiresConfirmation: true,
        verdict: HOOK_VERDICTS.REQUIRE_APPROVAL,
        hookId: result.hookId || hook.id,
        reason: result.reason,
        context: result.context || null,
        severity: result.severity || hook.riskLevel,
        trail,
        policySnapshot,
      };
    }
  }

  return {
    allowed: true,
    verdict: HOOK_VERDICTS.ALLOW,
    hookId: "hook_chain",
    trail,
    policySnapshot,
  };
}

export function isAuditStrictMode(state = {}) {
  return Boolean(state.auditStrict) || state.isActive?.("/audit-strict");
}
