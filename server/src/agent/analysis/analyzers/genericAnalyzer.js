/**
 * Adaptateur générique — fichiers sans rubric dédiée.
 */
import { SOURCE_FILE_ROLES } from "../sourceFileAnalysisContract.js";

/**
 * @param {string} content
 * @param {{ path: string, ext: string, bytes: number, lines: number }} meta
 */
export function analyzeGenericSource(content, meta) {
  const lines = content.split(/\r?\n/);
  const nonEmpty = lines.filter((l) => l.trim()).length;
  const preview = lines.slice(0, 20).filter((l) => l.trim()).slice(0, 8);

  return {
    access: "read_full",
    path: meta.path,
    ext: meta.ext,
    bytes: meta.bytes,
    lines: meta.lines,
    role: SOURCE_FILE_ROLES.UNKNOWN,
    roleLabel: "Fichier source (analyse générique)",
    summary:
      "Aucun adaptateur spécialisé pour cette extension — rapport générique basé sur la structure textuelle. Demande un angle (sécurité, config, API) pour affiner.",
    structure: [
      `${nonEmpty} lignes non vides sur ${meta.lines}`,
      preview.length
        ? `Amorces : ${preview.map((l) => l.trim().slice(0, 40)).join(" · ")}`
        : "Fichier vide ou presque",
    ],
    strengths: [
      "Fichier lisible en UTF-8 dans l’allowlist workspace.",
      "Aperçu structurel immédiat (lignes non vides, amorces) sans exécution.",
    ],
    findings: [
      {
        id: "F1",
        claim:
          "Pas de rubric dédiée pour cette extension — profondeur d’analyse limitée par conception.",
        severity: "info",
      },
      {
        id: "F2",
        claim:
          "Sans hypothèse de rôle métier, les risques spécifiques (sécurité, schéma, UI) ne sont pas évalués.",
        severity: "low",
      },
      {
        id: "F3",
        claim:
          "Structure textuelle seule : pas de validation de syntaxe, encodage binaire ni dépendances externes.",
        severity: "info",
      },
    ],
    unknowns: [
      "Rôle exact du fichier dans le système non déterminé.",
      "Dépendances et consommateurs non explorés.",
    ],
    recommendations: [
      "Préciser le rôle attendu (config, script, data, template) pour une revue ciblée.",
      "Fournir l’extension attendue ou un chemin sous `projects/` avec adaptateur dédié si disponible.",
    ],
    confidence: "low",
    analyzer: "generic",
  };
}
