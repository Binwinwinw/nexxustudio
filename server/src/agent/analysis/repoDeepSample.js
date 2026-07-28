/**
 * Chainage repo → fichiers clés → SOURCE_FILE_ANALYSIS_V1.
 * Mode « deep » pour petits dépôts locaux (hygiène + findings code).
 */
import fs from "node:fs";
import path from "node:path";
import { analyzeSourceFileContent } from "./analyzers/index.js";

/** Seuil : au-delà, pas d’échantillon auto (garde le coût borné). */
export const DEEP_REPO_FILE_THRESHOLD = 20;
/** Nombre max de fichiers lus via SFA. */
export const DEEP_SAMPLE_MAX_FILES = 2;
/** Findings code minimum quand des sources sont échantillonnées. */
export const DEEP_CODE_FINDINGS_MIN = 2;
const MAX_READ_BYTES = 200_000;

const SOURCE_EXT_RE = /\.(html?|jsx?|tsx?|mjs|cjs|py|php)$/i;

/** Priorité d’échantillonnage (basename). */
const BASENAME_PRIORITY = [
  /^index\.html?$/i,
  /^app\.jsx?$/i,
  /^main\.jsx?$/i,
  /^server\.jsx?$/i,
  /^index\.jsx?$/i,
  /^main\.py$/i,
  /^app\.py$/i,
  /^index\.php$/i,
  /^App\.tsx?$/,
  /^main\.tsx?$/,
];

/**
 * @param {string[]} files chemins relatifs au root repo
 * @returns {string[]}
 */
export function selectDeepSampleFiles(files = []) {
  const sources = files.filter((f) => SOURCE_EXT_RE.test(f));
  if (!sources.length) return [];

  const scored = sources.map((f) => {
    const base = path.posix.basename(f.replace(/\\/g, "/"));
    let score = 0;
    for (let i = 0; i < BASENAME_PRIORITY.length; i++) {
      if (BASENAME_PRIORITY[i].test(base)) {
        score = 100 - i;
        break;
      }
    }
    if (!score && /\.(html?)$/i.test(base)) score = 40;
    if (!score && /\.(jsx?|tsx?|mjs|cjs)$/i.test(base)) score = 30;
    if (!score && /\.py$/i.test(base)) score = 25;
    if (!score && /\.php$/i.test(base)) score = 20;
    if (!f.includes("/")) score += 5;
    return { f, score };
  });

  scored.sort((a, b) => b.score - a.score || a.f.localeCompare(b.f));

  const picked = [];
  for (const { f } of scored) {
    if (picked.length >= DEEP_SAMPLE_MAX_FILES) break;
    if (picked.length === 1) {
      const firstExt = path.extname(picked[0]).toLowerCase();
      const thisExt = path.extname(f).toLowerCase();
      // Diversifier extensions si possible
      if (
        firstExt === thisExt &&
        scored.some(
          (s) =>
            !picked.includes(s.f) &&
            path.extname(s.f).toLowerCase() !== firstExt,
        )
      ) {
        continue;
      }
    }
    picked.push(f);
  }

  if (picked.length < Math.min(DEEP_SAMPLE_MAX_FILES, sources.length)) {
    for (const { f } of scored) {
      if (picked.length >= DEEP_SAMPLE_MAX_FILES) break;
      if (!picked.includes(f)) picked.push(f);
    }
  }

  return picked;
}

/**
 * @param {string} absoluteRoot
 * @param {string[]} relativeFiles
 * @param {string} repoLabel
 * @returns {{
 *   deepMode: boolean,
 *   sampledPaths: string[],
 *   codeFindings: Array<{ id: string, claim: string, severity?: string, evidence?: string, sourcePath?: string }>,
 *   codeStrengths: string[],
 *   fileSummaries: string[],
 * }}
 */
export function runRepoDeepSample(absoluteRoot, relativeFiles = [], repoLabel = "") {
  const empty = {
    deepMode: false,
    sampledPaths: [],
    codeFindings: [],
    codeStrengths: [],
    fileSummaries: [],
  };

  if (relativeFiles.length === 0 || relativeFiles.length > DEEP_REPO_FILE_THRESHOLD) {
    return empty;
  }

  const sample = selectDeepSampleFiles(relativeFiles);
  if (!sample.length) return empty;

  const codeFindings = [];
  const codeStrengths = [];
  const fileSummaries = [];
  let cIdx = 1;

  for (const rel of sample) {
    const abs = path.join(absoluteRoot, rel);
    let content;
    try {
      const stat = fs.statSync(abs);
      if (!stat.isFile()) continue;
      if (stat.size > MAX_READ_BYTES) {
        const buf = Buffer.alloc(MAX_READ_BYTES);
        const fd = fs.openSync(abs, "r");
        fs.readSync(fd, buf, 0, MAX_READ_BYTES, 0);
        fs.closeSync(fd);
        content = buf.toString("utf8");
      } else {
        content = fs.readFileSync(abs, "utf8");
      }
    } catch {
      continue;
    }

    const displayPath = repoLabel
      ? `${repoLabel.replace(/\/$/, "")}/${rel}`
      : rel;
    const ext = path.extname(rel).replace(/^\./, "").toLowerCase();
    const { report } = analyzeSourceFileContent(content, {
      path: displayPath,
      ext,
    });

    if (report.summary) {
      fileSummaries.push(`\`${rel}\` : ${report.summary.slice(0, 180)}`);
    }

    for (const s of (report.strengths || []).slice(0, 2)) {
      codeStrengths.push(`\`${rel}\` — ${s}`);
    }

    // Prioriser findings medium/high
    const ordered = [...(report.findings || [])].sort((a, b) => {
      const rank = { high: 3, medium: 2, low: 1, info: 0 };
      return (rank[b.severity] || 0) - (rank[a.severity] || 0);
    });

    for (const f of ordered.slice(0, 3)) {
      codeFindings.push({
        id: `C${cIdx++}`,
        claim: `\`${rel}\` — ${f.claim}`,
        severity: f.severity || "medium",
        evidence: f.evidence,
        sourcePath: rel,
      });
    }
  }

  // Cap lisible pour la section dépôt
  return {
    deepMode: true,
    sampledPaths: sample,
    codeFindings: codeFindings.slice(0, 6),
    codeStrengths: codeStrengths.slice(0, 4),
    fileSummaries: fileSummaries.slice(0, 4),
  };
}
