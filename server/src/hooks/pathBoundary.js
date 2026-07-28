/**
 * Résolution canonique des chemins — fusion FileSafety + realpath (anti-symlink).
 */
import fs from "node:fs";
import path from "node:path";

export const DEFAULT_WORKSPACE_ROOT = path.resolve(process.cwd(), "..");

function realpathExisting(targetPath) {
  return fs.realpathSync.native(targetPath);
}

/**
 * Résout le préfixe existant le plus profond (fichier cible peut ne pas exister).
 */
function resolveExistingPrefix(targetPath) {
  let checkPath = path.resolve(targetPath);
  const rootDrive = path.parse(checkPath).root;

  while (checkPath && checkPath !== rootDrive) {
    try {
      return realpathExisting(checkPath);
    } catch (err) {
      if (err?.code !== "ENOENT") throw err;
      checkPath = path.dirname(checkPath);
    }
  }

  return realpathExisting(rootDrive);
}

function assertWithinRoot(realRoot, candidatePath) {
  const relativeToRoot = path.relative(realRoot, candidatePath);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    throw new Error(
      `VIOLATION DE PÉRIMÈTRE : Accès hors racine bloqué (${candidatePath})`,
    );
  }
  if (!candidatePath.startsWith(realRoot)) {
    throw new Error(
      "VIOLATION DE FRONTIÈRE : Le chemin résolu est en dehors de la racine.",
    );
  }
}

/**
 * Valide qu'un chemin relatif reste dans la racine workspace après résolution canonique.
 * @param {string} root - Racine autorisée
 * @param {string} relativePath - Chemin fourni par l'agent
 * @returns {string} Chemin absolu validé
 */
export function resolveCanonicalWithinRoot(root, relativePath) {
  if (!relativePath || typeof relativePath !== "string") {
    throw new Error("Chemin de fichier invalide ou manquant.");
  }

  const absoluteRoot = path.resolve(root);
  const realRoot = realpathExisting(absoluteRoot);
  const resolvedPath = path.resolve(realRoot, relativePath);

  assertWithinRoot(realRoot, resolvedPath);

  const realPrefix = resolveExistingPrefix(resolvedPath);
  assertWithinRoot(realRoot, realPrefix);

  return resolvedPath;
}

export function normalizePathForPolicy(filePath = "") {
  return String(filePath).replace(/\\/g, "/");
}

export function isPathWithinDirectory(filePath, directory) {
  if (!directory) return true;
  const normalizedPath = normalizePathForPolicy(filePath);
  const normalizedDir = normalizePathForPolicy(directory);
  return normalizedPath.startsWith(normalizedDir);
}

export function isWriteAllowedInReadOnlyZones(filePath, readOnlyDirectories = new Set()) {
  const normalizedPath = normalizePathForPolicy(filePath);
  for (const dir of readOnlyDirectories) {
    if (normalizedPath.startsWith(normalizePathForPolicy(dir))) {
      return true;
    }
  }
  return false;
}
