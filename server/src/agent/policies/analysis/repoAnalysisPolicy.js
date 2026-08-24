/**
 * repo_analysis — revue de dépôt (local projects/ ou distant GitHub).
 * Contrat REPO_ANALYSIS_V1 — pas DOCUMENT social/explain.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isRepoAnalysisRequest,
  extractRepoTarget,
  deriveRepoAnalysisWebQuery,
  looksLikeDocumentationSubject,
} from "../../utils/intent-guards/repoAnalysisIntentGuards.js";
import {
  REPO_ANALYSIS_CONTRACT_ID,
  formatRepoAnalysisReply,
  getRepoAnalysisSystemPrompt,
} from "../../analysis/repoAnalysisContract.js";
import { analyzeLocalRepoDirectory } from "../../analysis/localRepoAnalyzer.js";

export const REPO_ANALYSIS_RULE = "repo_analysis_v1";
export { REPO_ANALYSIS_CONTRACT_ID, getRepoAnalysisSystemPrompt };

export const REPO_ANALYSIS_CANONICAL_LOCAL_QUERY =
  "analyse le dépôt projects/demo-citadelle";

export const REPO_ANALYSIS_CANONICAL_GITHUB_QUERY =
  "analyse le dépôt https://github.com/JuliusBrussee/caveman";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const WORKSPACE_ROOT = path.resolve(__dirname, "../../../../../");
const PROJECTS_ROOT = path.resolve(WORKSPACE_ROOT, "projects");

/**
 * @param {string} [relative]
 * @returns {{ ok: boolean, absolutePath?: string, relativePath?: string, reason?: string }}
 */
export function resolveLocalRepoPath(relative = "") {
  const rel = String(relative || "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/+$/, "");
  if (!rel.startsWith("projects/")) {
    return { ok: false, reason: "outside_allowlist" };
  }
  const absolutePath = path.resolve(WORKSPACE_ROOT, rel);
  if (
    absolutePath !== PROJECTS_ROOT &&
    !absolutePath.startsWith(PROJECTS_ROOT + path.sep)
  ) {
    return { ok: false, reason: "outside_allowlist", absolutePath };
  }
  try {
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isDirectory()) {
      return {
        ok: false,
        reason: "not_found",
        absolutePath,
        relativePath: rel,
      };
    }
  } catch {
    return {
      ok: false,
      reason: "not_found",
      absolutePath,
      relativePath: rel,
    };
  }
  return {
    ok: true,
    absolutePath,
    relativePath: rel,
  };
}

/**
 * Arrêt déterministe — pas de rapport review-grade sans cible accessible.
 * @param {{ query?: string, target?: object, reason?: string }} [input]
 * @returns {string}
 */
export function buildUnconfirmedRepoTargetReply(input = {}) {
  const query = String(input.query || "");
  const target = input.target || {};
  const rawLabel = target.localRelative || target.label || null;
  const label =
    rawLabel && !/cible non r[eé]solue/i.test(rawLabel) ? rawLabel : null;
  const docSubject = looksLikeDocumentationSubject(query);
  const subject = docSubject
    ? "documentation (guide / mémo / specs)"
    : "revue de dépôt";
  const source = label
    ? `\`${label}\` — introuvable ou non vérifié`
    : "aucune cible dépôt confirmée";
  const expected = docSubject
    ? "analyse ou production de la documentation, pas une revue de codebase"
    : "revue technique d'un dépôt accessible";
  const next = docSubject
    ? "Recadrage : envoie le document à analyser, ou un chemin `projects/<slug>` / URL GitHub si tu veux vraiment une revue de dépôt."
    : "Donne un objet vérifiable : `projects/<slug>` existant, ou `https://github.com/owner/repo`. Si le besoin est une documentation, envoie le texte ou le fichier — pas un dépôt.";

  return [
    "**Cible non confirmée — analyse factuelle refusée.**",
    "",
    `- **Sujet** : ${subject}`,
    `- **Source** : ${source}`,
    `- **Réponse attendue** : ${expected}`,
    "",
    "Je m'arrête ici : pas de stack inventée, pas de rapport de revue.",
    "",
    next,
  ].join("\n");
}

function emitUnconfirmedRepoTarget(query, target, reason) {
  return {
    path: "repo_analysis_target_unconfirmed",
    kind:
      reason === "not_found"
        ? "local_workspace_missing"
        : "repo_target_unconfirmed",
    reply: buildUnconfirmedRepoTargetReply({ query, target, reason }),
    repoTarget: target,
    step: "📂 Cible dépôt non confirmée — arrêt...",
  };
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isRepoAnalysisSatisfiable(query = "") {
  return isRepoAnalysisRequest(query);
}

/**
 * Short-circuit :
 * - local projects/ → analyse déterministe
 * - distant → defer LLM avec contrat REPO_ANALYSIS (web)
 * @param {string} query
 * @returns {{
 *   path: string,
 *   kind: string,
 *   reply?: string|null,
 *   deferToLlm?: boolean,
 *   repoTarget?: object,
 *   step?: string,
 * }|null}
 */
export function resolveRepoAnalysisShortCircuit(query = "") {
  if (!isRepoAnalysisRequest(query)) return null;

  const target = extractRepoTarget(query) || {
    kind: "unresolved",
    label: "(cible non résolue)",
    localRelative: null,
    url: null,
  };

  if (target.kind === "unresolved" || (!target.localRelative && !target.url && !target.repo)) {
    return emitUnconfirmedRepoTarget(query, target, "unresolved");
  }

  // Local workspace — analyser seulement si le dossier existe.
  if (target.localRelative || target.kind === "workspace_projects" || target.kind === "named_repo") {
    const candidate =
      target.localRelative ||
      (target.repo ? `projects/${target.repo}` : null);
    if (candidate) {
      const resolved = resolveLocalRepoPath(candidate);
      if (resolved.ok) {
        const { report, quality } = analyzeLocalRepoDirectory(
          resolved.absolutePath,
          resolved.relativePath,
        );
        let reply = formatRepoAnalysisReply(report);
        if (!quality.ok) {
          reply += `\n\n_(Note qualité ${REPO_ANALYSIS_CONTRACT_ID} : ${quality.failures.join(", ")})_`;
        }
        return {
          path: "repo_analysis_deterministic",
          kind: "local_workspace_repo",
          reply,
          repoTarget: { ...target, resolved, quality },
          step: "📂 Repo local — revue REPO_ANALYSIS_V1...",
        };
      }
      return {
        ...emitUnconfirmedRepoTarget(query, { ...target, resolved }, resolved.reason || "not_found"),
        repoTarget: { ...target, resolved },
      };
    }
  }

  if (target.kind === "github_url" || target.kind === "github_owner_repo") {
    return {
      path: "repo_analysis_llm",
      kind: "remote_or_web_repo",
      reply: null,
      deferToLlm: true,
      repoTarget: target,
      webQuery: deriveRepoAnalysisWebQuery(query),
      step: "🔍 Repo distant — exploration structurée REPO_ANALYSIS_V1...",
    };
  }

  return emitUnconfirmedRepoTarget(query, target, "unverified");
}
