import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(__dirname, "../../../..");

export const DEFAULT_GRAPH_JSON = path.join(SERVER_ROOT, "graphify-out", "graph.json");

/** 14 jours par défaut — override via GRAPHIFY_MAX_AGE_MS. */
export const DEFAULT_GRAPH_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * @returns {string}
 */
export function resolveGraphifyGraphPath() {
  const fromEnv = process.env.GRAPHIFY_GRAPH_PATH;
  if (fromEnv && String(fromEnv).trim()) {
    return path.resolve(String(fromEnv).trim());
  }
  return DEFAULT_GRAPH_JSON;
}

/**
 * @returns {number}
 */
export function resolveGraphMaxAgeMs() {
  const raw = process.env.GRAPHIFY_MAX_AGE_MS;
  if (raw == null || raw === "") return DEFAULT_GRAPH_MAX_AGE_MS;
  const parsed = Number.parseInt(String(raw), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_GRAPH_MAX_AGE_MS;
}

/**
 * @returns {{
 *   ok: boolean,
 *   graphPath: string,
 *   reason?: string,
 *   ageMs?: number,
 *   mtimeMs?: number,
 * }}
 */
export function assessGraphifyGraphAvailability() {
  const graphPath = resolveGraphifyGraphPath();
  if (!fs.existsSync(graphPath)) {
    return { ok: false, graphPath, reason: "graph_missing" };
  }
  let stat;
  try {
    stat = fs.statSync(graphPath);
  } catch {
    return { ok: false, graphPath, reason: "graph_stat_error" };
  }
  const ageMs = Date.now() - stat.mtimeMs;
  const maxAge = resolveGraphMaxAgeMs();
  if (ageMs > maxAge) {
    return { ok: false, graphPath, reason: "graph_stale", ageMs, mtimeMs: stat.mtimeMs };
  }
  return { ok: true, graphPath, ageMs, mtimeMs: stat.mtimeMs };
}
