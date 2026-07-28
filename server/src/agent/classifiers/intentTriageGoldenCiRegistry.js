/**
 * Registre local des passages CI golden (compteur par cas exporté).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REGISTRY_PATH = path.resolve(
  __dirname,
  "../../../data/intent-triage/golden-ci-pass-registry.json",
);

function defaultRegistry() {
  return { version: 1, updated_at: null, cases: {} };
}

export function getGoldenCiRegistryPath() {
  return process.env.INTENT_TRIAGE_CI_REGISTRY_PATH || DEFAULT_REGISTRY_PATH;
}

export function loadGoldenCiRegistry() {
  const registryPath = getGoldenCiRegistryPath();
  if (!fs.existsSync(registryPath)) return defaultRegistry();
  try {
    const parsed = JSON.parse(fs.readFileSync(registryPath, "utf8"));
    return { ...defaultRegistry(), ...parsed, cases: parsed.cases || {} };
  } catch {
    return defaultRegistry();
  }
}

function saveRegistry(registry) {
  const registryPath = getGoldenCiRegistryPath();
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
  registry.updated_at = new Date().toISOString();
  fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
}

/**
 * @param {string} caseId
 * @param {{ passed?: boolean }} [meta]
 */
export function recordGoldenCiPass(caseId, meta = {}) {
  if (!caseId) return null;
  const registry = loadGoldenCiRegistry();
  const prev = registry.cases[caseId] || {
    case_id: caseId,
    ci_pass_count: 0,
    last_pass_at: null,
  };

  if (meta.passed === false) {
    registry.cases[caseId] = {
      ...prev,
      last_fail_at: new Date().toISOString(),
    };
    saveRegistry(registry);
    return registry.cases[caseId];
  }

  registry.cases[caseId] = {
    ...prev,
    ci_pass_count: (prev.ci_pass_count || 0) + 1,
    last_pass_at: new Date().toISOString(),
  };
  saveRegistry(registry);
  return registry.cases[caseId];
}

export function getGoldenCiPassCount(caseId) {
  const registry = loadGoldenCiRegistry();
  return registry.cases[caseId]?.ci_pass_count || 0;
}

/**
 * @param {string[]} caseIds
 */
export function recordGoldenCiPasses(caseIds = []) {
  return caseIds.map((id) => recordGoldenCiPass(id));
}
