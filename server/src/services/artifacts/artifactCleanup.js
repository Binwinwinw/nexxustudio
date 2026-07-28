import fs from "node:fs/promises";
import path from "node:path";
import { RUNS_ROOT, ARTIFACT_PURGE_INTERVAL_MS } from "./artifactConstants.js";
import { unregisterRunArtifacts } from "./artifactRegistry.js";
import { isArtifactExpired } from "./artifactConstants.js";

let purgeTimer = null;
let purgeInFlight = null;

async function removeRunDirectory(sessionId, runId) {
  const dir = path.join(RUNS_ROOT, sessionId, runId);
  await fs.rm(dir, { recursive: true, force: true });
}

async function purgeRunIfExpired(sessionId, runId) {
  const manifestPath = path.join(RUNS_ROOT, sessionId, runId, "manifest.json");
  let manifest;
  try {
    const raw = await fs.readFile(manifestPath, "utf8");
    manifest = JSON.parse(raw);
  } catch {
    await removeRunDirectory(sessionId, runId);
    return { removed: true, reason: "orphan" };
  }

  if (!isArtifactExpired(manifest)) {
    return { removed: false };
  }

  const artifactIds = (manifest.artifacts || []).map((a) => a.id);
  await unregisterRunArtifacts(artifactIds);
  await removeRunDirectory(sessionId, runId);
  return { removed: true, reason: "expired" };
}

/**
 * Purge les runs dont expiresAt est dépassé.
 */
export async function purgeExpiredRuns({ opportunistic = false } = {}) {
  if (purgeInFlight) return purgeInFlight;

  purgeInFlight = (async () => {
    let removed = 0;
    let sessions = [];
    try {
      sessions = await fs.readdir(RUNS_ROOT, { withFileTypes: true });
    } catch {
      return { removed: 0, opportunistic };
    }

    for (const sessionEntry of sessions) {
      if (!sessionEntry.isDirectory() || sessionEntry.name.startsWith("_")) continue;
      const sessionId = sessionEntry.name;
      let runs = [];
      try {
        runs = await fs.readdir(path.join(RUNS_ROOT, sessionId), { withFileTypes: true });
      } catch {
        continue;
      }

      for (const runEntry of runs) {
        if (!runEntry.isDirectory()) continue;
        const result = await purgeRunIfExpired(sessionId, runEntry.name);
        if (result.removed) removed += 1;
      }
    }

    if (removed > 0) {
      console.log(`[ArtifactCleanup] ${removed} run(s) purgé(s)${opportunistic ? " (opportuniste)" : ""}.`);
    }
    return { removed, opportunistic };
  })();

  try {
    return await purgeInFlight;
  } finally {
    purgeInFlight = null;
  }
}

export function scheduleArtifactCleanup() {
  purgeExpiredRuns().catch((err) => {
    console.warn("[ArtifactCleanup] Purge initiale échouée:", err.message);
  });

  if (purgeTimer) clearInterval(purgeTimer);
  purgeTimer = setInterval(() => {
    purgeExpiredRuns().catch((err) => {
      console.warn("[ArtifactCleanup] Purge périodique échouée:", err.message);
    });
  }, ARTIFACT_PURGE_INTERVAL_MS);

  if (typeof purgeTimer.unref === "function") {
    purgeTimer.unref();
  }
}
