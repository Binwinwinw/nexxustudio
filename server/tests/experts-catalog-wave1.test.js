import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { extractManifestsFromFile } from "../src/agent/router/expertManifestStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXPERTS_DIR = path.resolve(__dirname, "../data/experts");

const WAVE1_FILES = [
  "Elite_Memory_Consolidator.json",
  "expert_auditeur.json",
  "RepoAuditAgent.json",
  "expert_curator.json",
  "expert_librarian.json",
  "creative_experts.json",
  "design.json",
  "engineering.json",
  "testing.json",
];

const KEPT_FILES = [
  "elite.json",
  "expert_mentor.json",
  "expert_web_search.json",
  "master_orchestrator.json",
];

const PRUNED_KEYS = [
  "memory_consolidator",
  "expert_auditeur",
  "repo_audit_agent",
  "expert_curator",
  "expert_librarian",
  "expert_visual",
  "expert_audio",
  "ui_designer",
  "ux_specialist",
  "ai_engineer",
  "backend_architect",
  "frontend_engineer",
  "lead_engineer",
  "security_engineer",
  "qa_automation",
  "performance_analyst",
];

const KEPT_KEYS = [
  "expert_web_search",
  "master_orchestrator",
  "expert_pm",
  "expert_architect",
  "expert_qa",
  "expert_analyst",
  "developer_agent",
  "expert_reality_checker",
  "expert_mentor",
];

function listExpertJsonFiles() {
  return fs
    .readdirSync(EXPERTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();
}

function loadCatalogKeys() {
  const keys = [];
  for (const file of listExpertJsonFiles()) {
    const fullPath = path.join(EXPERTS_DIR, file);
    const content = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    const manifests = extractManifestsFromFile(content, file, fullPath);
    for (const m of manifests) keys.push(m.key);
  }
  return keys;
}

describe("Lot D Vague 1 — catalogue après prune", () => {
  it("répertoire experts lisible, init-like sans crash", () => {
    assert.equal(fs.existsSync(EXPERTS_DIR), true);
    const files = listExpertJsonFiles();
    assert.ok(files.length > 0);
    for (const file of files) {
      const fullPath = path.join(EXPERTS_DIR, file);
      const content = JSON.parse(fs.readFileSync(fullPath, "utf8"));
      const manifests = extractManifestsFromFile(content, file, fullPath);
      assert.ok(manifests.length > 0, `${file} doit extraire au moins un manifest`);
    }
  });

  it("fichiers Vague 1 absents, fichiers conservés présents", () => {
    const files = listExpertJsonFiles();
    for (const gone of WAVE1_FILES) {
      assert.equal(files.includes(gone), false, `${gone} devrait être supprimé`);
    }
    for (const kept of KEPT_FILES) {
      assert.equal(files.includes(kept), true, `${kept} doit rester`);
    }
    assert.deepEqual(files, [...KEPT_FILES].sort());
  });

  it("clés prunées absentes ; web / master / elite / mentor présents", () => {
    const keys = loadCatalogKeys();
    for (const pruned of PRUNED_KEYS) {
      assert.equal(keys.includes(pruned), false, `${pruned} ne doit plus être au catalogue`);
    }
    for (const kept of KEPT_KEYS) {
      assert.equal(keys.includes(kept), true, `${kept} doit rester au catalogue`);
    }
  });

  it("elite.json inchangé : developer_agent + reality_checker encore là", () => {
    const elite = JSON.parse(
      fs.readFileSync(path.join(EXPERTS_DIR, "elite.json"), "utf8"),
    );
    const keys = (elite.experts || []).map((e) => e.key);
    assert.deepEqual(keys, [
      "expert_pm",
      "expert_architect",
      "developer_agent",
      "expert_qa",
      "expert_analyst",
      "expert_reality_checker",
    ]);
  });
});
