/**
 * Post-hooks ciblés après file_write (Phase E).
 * @see ADR-20260609-Hooks-Governance-v1 — Phase E
 */
import path from "node:path";
import { PRIVILEGED_ACTION_TYPES } from "../privilegedActionGate.js";
import { DEFAULT_WORKSPACE_ROOT } from "../pathBoundary.js";
import { isSyntaxValidationEnabled, validateSyntaxFile } from "./syntaxValidator.js";
import { shouldRunPostEditTests, runTargetedTests } from "./testRunner.js";

export const POST_HOOK_POLICY_VERSION = "1.2.0";

export const POST_HOOK_REGISTRY = Object.freeze([
  {
    id: "postEditSyntaxHook",
    family: "post_action",
    priority: "E1",
    alwaysOn: true,
    commands: [],
    triggers: ["file_write"],
  },
  {
    id: "postEditTestHook",
    family: "post_action",
    priority: "E2",
    alwaysOn: false,
    commands: ["/test-required"],
    triggers: ["file_write"],
  },
]);

function resolveAbsolutePath(action = {}) {
  const workspaceRoot = action.workspaceRoot || DEFAULT_WORKSPACE_ROOT;
  const rel = action.path || action.file_path;
  if (!rel) return null;
  return path.isAbsolute(rel) ? path.resolve(rel) : path.resolve(workspaceRoot, rel);
}

function shouldRunPostEdit(action = {}) {
  if (action.type !== PRIVILEGED_ACTION_TYPES.FILE_WRITE) return false;
  if (action.operation === "mkdir") return false;
  if (!action.path && !action.file_path) return false;
  return true;
}

/**
 * @returns {Promise<{ ok: boolean, hookId?: string, message?: string, details?: string, trail?: object[] }>}
 */
export async function runPostEditHooks(action = {}, state = {}) {
  if (!shouldRunPostEdit(action)) {
    return { ok: true, trail: [] };
  }

  if (action.skipPostEditSyntax) {
    return {
      ok: true,
      trail: [
        {
          hookId: "postEditSyntaxHook",
          skipped: true,
          reason: "skipPostEditSyntax",
        },
      ],
    };
  }

  const absolutePath = resolveAbsolutePath(action);
  const relativePath = String(action.path || action.file_path || "").replace(/\\/g, "/");
  const trail = [];

  if (isSyntaxValidationEnabled()) {
    const syntax = await validateSyntaxFile(absolutePath, action.content ?? null);
    trail.push({
      hookId: "postEditSyntaxHook",
      valid: syntax.valid,
      skipped: Boolean(syntax.skipped),
      validator: syntax.validator || null,
      reason: syntax.reason || null,
    });

    if (!syntax.valid && !syntax.skipped) {
      return {
        ok: false,
        hookId: "postEditSyntaxHook",
        message: `Syntaxe invalide (${syntax.validator}) : ${syntax.reason}`,
        details: syntax.details,
        trail,
      };
    }
  }

  if (shouldRunPostEditTests(relativePath, state)) {
    const tests = await runTargetedTests(
      absolutePath,
      relativePath,
      action.workspaceRoot || DEFAULT_WORKSPACE_ROOT,
    );
    trail.push({
      hookId: "postEditTestHook",
      valid: tests.valid,
      skipped: Boolean(tests.skipped),
      runner: tests.runner || null,
      reason: tests.reason || null,
    });

    if (!tests.valid && !tests.skipped) {
      return {
        ok: false,
        hookId: "postEditTestHook",
        message: `Tests échoués (${tests.runner}) : ${tests.reason}`,
        details: tests.details,
        trail,
      };
    }
  }

  return { ok: true, trail };
}
