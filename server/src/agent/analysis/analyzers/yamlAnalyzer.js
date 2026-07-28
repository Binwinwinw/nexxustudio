/**
 * Adaptateur YAML — schéma, secrets, duplication, ambiguïtés config.
 */
import { SOURCE_FILE_ROLES } from "../sourceFileAnalysisContract.js";

const SECRET_KEY_RE =
  /\b(password|secret|api[_-]?key|token|private[_-]?key|access[_-]?key)\b/i;

/**
 * @param {string} content
 * @param {{ path: string, ext: string, bytes: number, lines: number }} meta
 */
export function analyzeYamlSource(content, meta) {
  const findings = [];
  const strengths = [];
  const structure = [];
  const recommendations = [];
  const unknowns = [];
  let i = 1;
  const push = (claim, severity, evidence) => {
    findings.push({ id: `F${i++}`, claim, severity, evidence });
  };

  const lines = content.split(/\r?\n/);
  const topKeys = [];
  for (const line of lines) {
    const m = line.match(/^([A-Za-z0-9_.-]+)\s*:/);
    if (m) topKeys.push(m[1]);
  }
  const uniqueTop = [...new Set(topKeys)];
  structure.push(`Clés de premier niveau : ${uniqueTop.slice(0, 12).join(", ") || "(aucune)"}`);

  const isCi = /jobs:|steps:|on:|workflow/i.test(content);
  const isCompose = /services:|image:|docker-compose/i.test(content);
  const isK8s = /apiVersion:|kind:|metadata:/i.test(content);

  if (isCi) structure.push("Profil probable : CI/CD (jobs/steps)");
  if (isCompose) structure.push("Profil probable : Docker Compose / services");
  if (isK8s) structure.push("Profil probable : manifeste Kubernetes");

  strengths.push("Format déclaratif YAML — configuration versionnable.");
  if (uniqueTop.length >= 2) {
    strengths.push("Plusieurs sections de premier niveau — structure lisible.");
  } else {
    strengths.push("Fichier court — clés de premier niveau faciles à parcourir.");
  }

  const secretLines = lines.filter((l) => SECRET_KEY_RE.test(l) && /:\s*\S+/.test(l));
  if (secretLines.length) {
    push(
      "Clés potentiellement sensibles (password/secret/token/api_key) avec valeurs — risque de secret en clair.",
      "high",
      secretLines[0].trim().slice(0, 80),
    );
    recommendations.push(
      "Externaliser les secrets (vault / env / secret store) ; ne pas committer de credentials.",
    );
  }

  const tabIndent = lines.some((l) => /^\t+/.test(l));
  if (tabIndent) {
    push("Indentation par tabulations — source fréquente d’ambiguïté YAML.", "medium");
  }

  const dupKeys = topKeys.filter((k, idx) => topKeys.indexOf(k) !== idx);
  if (dupKeys.length) {
    push(
      `Clés de premier niveau dupliquées : ${[...new Set(dupKeys)].join(", ")} — la dernière gagne selon le parseur.`,
      "medium",
    );
  }

  if (/latest\b/.test(content) && isCompose) {
    push("Tags d’image \`latest\` — builds non reproductibles.", "low");
    recommendations.push("Épingler des digests / versions d’images explicites.");
  }

  if (findings.length < 3) {
    push(
      "Validité des clés imbriquées et types non vérifiée sans schéma (JSON Schema / CRD) ni parseur cible.",
      "info",
    );
  }
  if (findings.length < 3 && isCompose) {
    push(
      "Réseaux, volumes et dépendances inter-services ne sont pas simulés — conflits de ports ou secrets montés restent possibles.",
      "low",
    );
  }
  if (findings.length < 3) {
    push(
      "Variables d’environnement et interpolations (`${…}`) ne sont pas résolues — valeurs effectives inconnues.",
      "info",
    );
  }

  unknowns.push(
    "Sans schéma (JSON Schema / CRD) ni environnement cible, la validité sémantique reste partielle.",
  );
  unknowns.push("Les valeurs interpolées (\`\${…}\`) ne sont pas résolues ici.");

  if (!recommendations.length) {
    recommendations.push("Documenter le rôle du fichier et les environnements concernés.");
  }
  if (recommendations.length < 2) {
    recommendations.push(
      "Ajouter un schéma ou des commentaires de section pour réduire les ambiguïtés YAML.",
    );
  }

  const roleLabel = isCi
    ? "Config CI/CD"
    : isCompose
      ? "Config orchestration conteneurs"
      : isK8s
        ? "Manifeste Kubernetes"
        : "Configuration YAML";

  return {
    access: "read_full",
    path: meta.path,
    ext: meta.ext,
    bytes: meta.bytes,
    lines: meta.lines,
    role: SOURCE_FILE_ROLES.CONFIG,
    roleLabel,
    summary: `${roleLabel}. Analyse des clés, risques de secrets et cohérence déclarative — sans exécution du pipeline/runtime.`,
    structure,
    strengths,
    findings,
    unknowns,
    recommendations: recommendations.slice(0, 5),
    confidence: secretLines.length ? "high" : "medium",
    analyzer: "yaml",
  };
}
