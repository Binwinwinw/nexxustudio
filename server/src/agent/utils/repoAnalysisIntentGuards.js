/**
 * Intent — analyse de dépôt / repo (CODE_REPO_ANALYSIS), distinct de
 * document_synthesis, RESEARCH_THEN_SUMMARIZE et existing_source (fichier seul).
 */
import { normalizeFamiliarityQuery } from "./familiarityIntentGuards.js";
import { isExistingSourceAnalysisRequest } from "./localFileUriIntentGuards.js";
import { isResearchThenSummarizeRequest } from "../policies/researchThenSummarizePolicy.js";

const ANALYSIS_VERB_RE =
  /\b(?:analys(?:e|er|e)|audite(?:r)?|review|revue|inspecte(?:r)?|examine(?:r)?|évalue|evalue|evaluer|critique(?:r)?)\b/i;

const REPO_NOUN_RE =
  /\b(?:d[eé]p[oô]t|repo(?:sitory)?|codebase|projet\s+git)\b/i;

const GITHUB_URL_RE =
  /\bhttps?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\.git)?(?:\/[^\s]*)?/i;

const GITHUB_OWNER_REPO_RE =
  /\bgithub\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\b/i;

const OWNER_REPO_BARE_RE =
  /\b([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]{2,})\b/;

/** Dossier workspace projects/<slug> (sans fichier.ext). */
const PROJECTS_DIR_RE =
  /\b((?:\.\/|\.\.\/)?projects\/[\w.-]+)(?:\/)?(?!\S*\.\w+)\b/i;

const CREATE_VERB_RE =
  /\b(?:cr[eé]e(?:r)?|g[eé]n[eè]re(?:r)?|construis|construire|fabrique)\b/i;

/**
 * @typedef {{
 *   kind: 'github_url'|'github_owner_repo'|'workspace_projects'|'named_repo'|'unresolved',
 *   label: string,
 *   owner?: string|null,
 *   repo?: string|null,
 *   localRelative?: string|null,
 *   url?: string|null,
 * }} RepoTargetRef
 */

/**
 * @param {string} query
 * @returns {RepoTargetRef|null}
 */
export function extractRepoTarget(query = "") {
  const raw = String(query || "").trim();
  if (!raw) return null;

  const url = raw.match(GITHUB_URL_RE);
  if (url) {
    const owner = url[1];
    const repo = url[2].replace(/\.git$/i, "");
    return {
      kind: "github_url",
      label: `${owner}/${repo}`,
      owner,
      repo,
      url: `https://github.com/${owner}/${repo}`,
      localRelative: null,
    };
  }

  const ghPath = raw.match(GITHUB_OWNER_REPO_RE);
  if (ghPath) {
    const owner = ghPath[1];
    const repo = ghPath[2].replace(/\.git$/i, "");
    return {
      kind: "github_owner_repo",
      label: `${owner}/${repo}`,
      owner,
      repo,
      url: `https://github.com/${owner}/${repo}`,
      localRelative: null,
    };
  }

  const projects = raw.match(PROJECTS_DIR_RE);
  if (projects?.[1]) {
    const rel = projects[1].replace(/^\.\//, "").replace(/\/+$/, "");
    const slug = rel.split("/").pop();
    return {
      kind: "workspace_projects",
      label: rel,
      owner: null,
      repo: slug,
      localRelative: rel,
      url: null,
    };
  }

  // « analyse le dépôt demo-citadelle » / « le repo caveman »
  const named = raw.match(
    /\b(?:d[eé]p[oô]t|repo(?:sitory)?)\s+(?:github\s+)?["«']?([A-Za-z0-9_.-]{2,80})["»']?/i,
  );
  if (named?.[1] && !/\.(html?|js|ts|css|php|json|md)$/i.test(named[1])) {
    const name = named[1];
    if (/^projects$/i.test(name)) return null;
    return {
      kind: "named_repo",
      label: name,
      owner: null,
      repo: name,
      localRelative: `projects/${name}`,
      url: null,
    };
  }

  // owner/repo sans URL si verbe analyse + dépôt
  if (REPO_NOUN_RE.test(raw) && ANALYSIS_VERB_RE.test(raw)) {
    const bare = raw.match(OWNER_REPO_BARE_RE);
    if (
      bare &&
      !/^projects\//i.test(bare[0]) &&
      bare[1].length > 1 &&
      bare[2].length > 1 &&
      !/\.(html?|js|css)$/i.test(bare[2])
    ) {
      return {
        kind: "github_owner_repo",
        label: `${bare[1]}/${bare[2]}`,
        owner: bare[1],
        repo: bare[2],
        url: `https://github.com/${bare[1]}/${bare[2]}`,
        localRelative: null,
      };
    }
  }

  return null;
}

/**
 * Intention « revue de dépôt » (pas fichier seul, pas research-then-summarize).
 * @param {string} query
 * @param {{ attachments?: unknown[] }} [options]
 * @returns {boolean}
 */
export function isRepoAnalysisRequest(query = "", options = {}) {
  if (isExistingSourceAnalysisRequest(query)) return false;
  // research-then-summarize a priorité sur « résumé » + « vas te renseigner »
  if (isResearchThenSummarizeRequest(query, options)) return false;

  const q = normalizeFamiliarityQuery(query);
  if (!q) return false;
  if (CREATE_VERB_RE.test(q) && !ANALYSIS_VERB_RE.test(q)) return false;
  if (!ANALYSIS_VERB_RE.test(q)) return false;

  const hasRepoSignal =
    REPO_NOUN_RE.test(q) ||
    GITHUB_URL_RE.test(query) ||
    /github\.com\//i.test(query) ||
    PROJECTS_DIR_RE.test(query);

  if (!hasRepoSignal) return false;

  // « analyse le dépôt » / « analyse ce repo » / URL github + analyse
  return true;
}

/**
 * Query web bornée pour exploration GitHub distante.
 * @param {string} query
 * @returns {string}
 */
export function deriveRepoAnalysisWebQuery(query = "") {
  const target = extractRepoTarget(query);
  if (target?.url) {
    return `${target.url} repository structure languages README package.json tests CI`;
  }
  if (target?.label) {
    return `github ${target.label} repository structure README package.json tests architecture`;
  }
  return String(query || "").slice(0, 160);
}

export {
  ANALYSIS_VERB_RE as REPO_ANALYSIS_VERB_RE,
  REPO_NOUN_RE,
  GITHUB_URL_RE,
};
