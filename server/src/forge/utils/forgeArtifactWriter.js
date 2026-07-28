/**
 * Passage unique des écritures Forge → privilegedActionGate (artifactWriteHook).
 * @see ADR-20260609-Hooks-Governance-v1 — Phase B
 */
import fs from "fs/promises";
import path from "node:path";
import {
  executePrivilegedAction,
  formatGateBlockedMessage,
  PRIVILEGED_ACTION_TYPES,
} from "../../hooks/privilegedActionGate.js";
import { DEFAULT_WORKSPACE_ROOT } from "../../hooks/pathBoundary.js";

export class ForgeArtifactWriteBlocked extends Error {
  constructor(gateOutcome = {}) {
    super(formatGateBlockedMessage(gateOutcome));
    this.name = "ForgeArtifactWriteBlocked";
    this.gateOutcome = gateOutcome;
  }
}

function toWorkspaceRelativePath(absolutePath) {
  return path.relative(DEFAULT_WORKSPACE_ROOT, absolutePath).replace(/\\/g, "/");
}

/**
 * Écrit un artefact Forge via la gate (obligatoire — pas de fs.writeFile direct).
 * @param {string} absolutePath - Chemin absolu sous projects/
 * @param {string} content
 * @param {object} context - { sessionId, stage }
 */
export async function writeForgeArtifact(absolutePath, content, context = {}) {
  const resolved = path.resolve(absolutePath);
  const relativePath = toWorkspaceRelativePath(resolved);

  const outcome = await executePrivilegedAction(
    {
      type: PRIVILEGED_ACTION_TYPES.FILE_WRITE,
      source: "forge",
      forgeArtifact: true,
      path: relativePath,
      sessionId: context.sessionId || "forge",
      workspaceRoot: DEFAULT_WORKSPACE_ROOT,
      sideEffects: true,
      riskLevel: "HIGH",
      operation: "write",
      stage: context.stage || null,
      artifactKind: context.artifactKind || null,
      skipPostEditSyntax: Boolean(context.skipPostEditSyntax),
      content,
    },
    async () => {
      await fs.mkdir(path.dirname(resolved), { recursive: true });
      await fs.writeFile(resolved, content, "utf8");
      return {
        path: relativePath,
        bytes: Buffer.byteLength(String(content), "utf8"),
      };
    },
  );

  if (!outcome.success) {
    throw new ForgeArtifactWriteBlocked(outcome);
  }

  return outcome.result;
}

/**
 * Crée un répertoire projet Forge via la gate (mkdir sous projects/).
 * @param {string} absoluteProjectPath
 * @param {object} context - { sessionId, stage }
 */
export async function ensureForgeProjectDirectory(absoluteProjectPath, context = {}) {
  const resolved = path.resolve(absoluteProjectPath);
  const relativePath = toWorkspaceRelativePath(resolved);

  const outcome = await executePrivilegedAction(
    {
      type: PRIVILEGED_ACTION_TYPES.FILE_WRITE,
      source: "forge",
      forgeArtifact: true,
      operation: "mkdir",
      path: relativePath,
      sessionId: context.sessionId || "forge",
      workspaceRoot: DEFAULT_WORKSPACE_ROOT,
      sideEffects: true,
      riskLevel: "HIGH",
      stage: context.stage || null,
      artifactKind: "project_dir",
    },
    async () => {
      await fs.mkdir(resolved, { recursive: true });
      return { path: relativePath, operation: "mkdir" };
    },
  );

  if (!outcome.success) {
    throw new ForgeArtifactWriteBlocked(outcome);
  }

  return outcome.result;
}
