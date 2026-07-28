/**
 * Passage unique des commandes Forge → privilegedActionGate (shellRunnerHook).
 * @see ADR-20260609-Hooks-Governance-v1 — Phase C
 */
import { exec } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import {
  executePrivilegedAction,
  formatGateBlockedMessage,
  PRIVILEGED_ACTION_TYPES,
} from "../../hooks/privilegedActionGate.js";
import { DEFAULT_WORKSPACE_ROOT } from "../../hooks/pathBoundary.js";

const execAsync = promisify(exec);

export class ForgeShellCommandBlocked extends Error {
  constructor(gateOutcome = {}) {
    super(formatGateBlockedMessage(gateOutcome));
    this.name = "ForgeShellCommandBlocked";
    this.gateOutcome = gateOutcome;
  }
}

async function executeShell(command, cwd, timeoutMs = 120_000) {
  console.log(`[ForgeShell] Executing: "${command}" in ${cwd}`);
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024 * 5,
    });
    return {
      success: true,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    };
  } catch (error) {
    console.warn(`[ForgeShell] Command failed: "${command}"`, error.message);
    return {
      success: false,
      stdout: error.stdout?.trim() || "",
      stderr: error.stderr?.trim() || error.message,
      code: error.code,
    };
  }
}

/**
 * Exécute une commande shell Forge via la gate (allowlist Phase C).
 * @param {string} command
 * @param {string} cwd - Répertoire absolu ou relatif au workspace
 * @param {object} context - { sessionId, stage, timeoutMs }
 */
export async function runForgeCommand(command, cwd, context = {}) {
  const absCwd = path.resolve(cwd);
  const cwdRelative = path
    .relative(DEFAULT_WORKSPACE_ROOT, absCwd)
    .replace(/\\/g, "/");

  const outcome = await executePrivilegedAction(
    {
      type: PRIVILEGED_ACTION_TYPES.COMMAND_EXECUTE,
      source: "forge",
      forgeCommand: true,
      command: String(command || "").trim(),
      cwd: cwdRelative,
      sessionId: context.sessionId || "forge",
      workspaceRoot: DEFAULT_WORKSPACE_ROOT,
      sideEffects: true,
      riskLevel: "HIGH",
      stage: context.stage || null,
    },
    async () =>
      executeShell(
        command,
        absCwd,
        context.timeoutMs ?? context.timeout ?? 120_000,
      ),
  );

  if (!outcome.success) {
    throw new ForgeShellCommandBlocked(outcome);
  }

  return outcome.result;
}
