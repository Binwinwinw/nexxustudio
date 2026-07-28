/**
 * repo_analysis — revue de dépôt (local projects/ ou distant GitHub).
 * Contrat REPO_ANALYSIS_V1 — pas DOCUMENT social/explain.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isRepoAnalysisRequest,
  extractRepoTarget,
  deriveRepoAnalysisWebQuery,
} from "../utils/repoAnalysisIntentGuards.js";
import {
  REPO_ANALYSIS_CONTRACT_ID,
  formatRepoAnalysisReply,
  getRepoAnalysisSystemPrompt,
} from "../analysis/repoAnalysisContract.js";
import { analyzeLocalRepoDirectory } from "../analysis/localRepoAnalyzer.js";

export const REPO_ANALYSIS_RULE = "repo_analysis_v1";
export { REPO_ANALYSIS_CONTRACT_ID, getRepoAnalysisSystemPrompt };

export const REPO_ANALYSIS_CANONICAL_LOCAL_QUERY =
  "analyse le dépôt projects/demo-citadelle";

export const REPO_ANALYSIS_CANONICAL_GITHUB_QUERY =
  "analyse le dépôt https://github.com/JuliusBrussee/caveman";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const WORKSPACE_ROOT = path.resolve(__dirname, "../../../../");
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
  return {
    ok: true,
    absolutePath,
    relativePath: rel,
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

  // Local workspace
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
      // named_repo absent localement → si pas d'URL, tenter quand même un not_found structuré
      if (target.kind === "named_repo" && !target.url) {
        const abs = path.resolve(WORKSPACE_ROOT, candidate);
        const { report, quality } = analyzeLocalRepoDirectory(abs, candidate);
        return {
          path: "repo_analysis_not_found",
          kind: "local_workspace_missing",
          reply: formatRepoAnalysisReply(report),
          repoTarget: { ...target, quality },
          step: "📂 Repo local introuvable — rapport borné...",
        };
      }
    }
  }

  // Distant GitHub / unresolved with repo signal → pipeline LLM + web
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
