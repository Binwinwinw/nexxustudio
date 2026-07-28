/* server/src/security/fileSafety.js */
import {
  resolveCanonicalWithinRoot,
  DEFAULT_WORKSPACE_ROOT,
} from "../hooks/pathBoundary.js";

/**
 * Utilitaire de sécurisation des accès fichiers (Citadelle v4.2+)
 * Délègue à pathBoundary (realpath + boundary check).
 */
export class FileSafety {
  /**
   * Valide et résout un chemin de fichier de manière sécurisée.
   * @param {string} root - Dossier racine autorisé.
   * @param {string} relativePath - Chemin fourni par l'agent ou l'utilisateur.
   * @returns {string} - Chemin absolu et canonique.
   */
  static validatePath(root, relativePath) {
    return resolveCanonicalWithinRoot(root || DEFAULT_WORKSPACE_ROOT, relativePath);
  }

  /**
   * Normalise un nom de projet pour éviter les injections de noms de fichiers.
   * @param {string} name
   * @returns {string}
   */
  static normalizeProjectName(name) {
    return name
      .replace(/[^a-zA-Z0-9\-_]/g, "_")
      .substring(0, 64)
      .toLowerCase();
  }
}

export default FileSafety;
