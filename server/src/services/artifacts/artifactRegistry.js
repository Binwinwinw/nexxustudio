import fs from "node:fs/promises";
import path from "node:path";
import { REGISTRY_DIR } from "./artifactConstants.js";

async function ensureRegistryDir() {
  await fs.mkdir(REGISTRY_DIR, { recursive: true });
}

function registryPath(artifactId) {
  return path.join(REGISTRY_DIR, `${artifactId}.json`);
}

export async function registerArtifact(record) {
  await ensureRegistryDir();
  await fs.writeFile(registryPath(record.id), JSON.stringify(record, null, 2), "utf8");
}

export async function getArtifactRecord(artifactId) {
  try {
    const raw = await fs.readFile(registryPath(artifactId), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function unregisterArtifact(artifactId) {
  try {
    await fs.unlink(registryPath(artifactId));
  } catch {
    /* ignore */
  }
}

export async function unregisterRunArtifacts(artifactIds = []) {
  await Promise.all(artifactIds.map((id) => unregisterArtifact(id)));
}
