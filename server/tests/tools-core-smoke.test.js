/**
 * Smoke tests Core — Tools Layer v1 (ADR-20260705)
 * Modules : projectBuilder, projectScanner, projectMemoryPromoter, vaultManager
 * + traversée minimale toolExecutor (projectScan, registerInDashboard)
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

import projectBuilder from "../src/tools/projectBuilder.js";
import projectScanner from "../src/tools/projectScanner.js";
import projectMemoryPromoter from "../src/tools/projectMemoryPromoter.js";
import vaultManager from "../src/tools/vaultManager.js";
import toolExecutor from "../src/agent/utils/toolExecutor.js";
import securityHooks from "../src/hooks/securityHooks.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECTS_ROOT = path.resolve(__dirname, "../../projects");
const SMOKE_PROJECT = "__tools_core_smoke__";
const SMOKE_SANDBOX_DIR = path.join(PROJECTS_ROOT, `${SMOKE_PROJECT}_sandbox`);
const SMOKE_VAULT_REL = "01-Episodic/smoke/tools-core-smoke.md";

test("vaultManager — documentExists + anti-traversal", async () => {
  assert.equal(await vaultManager.documentExists("Bienvenue.md"), true);

  assert.throws(
    () => vaultManager.safeResolveVaultPath("../../../Windows/System32"),
    /sortie du Vault|Security/i,
  );
});

test("vaultManager — registerDocument idempotent + registerInDashboard alias", async () => {
  const payload = {
    relPath: SMOKE_VAULT_REL,
    title: "Tools Core Smoke",
    type: "episodic",
    section: "Smoke",
    summary: "Smoke test Tools Layer v1 — idempotent.",
  };

  const first = await vaultManager.registerDocument(payload);
  assert.equal(first.success, true);

  const duplicate = await vaultManager.registerDocument(payload);
  assert.equal(duplicate.success, true);
  assert.equal(duplicate.duplicate, true);

  const viaAlias = await vaultManager.registerInDashboard(
    "episodic",
    "tools_core_alias_smoke",
    { summary: "Alias smoke test" },
  );
  assert.equal(viaAlias.success, true);
});

test("projectScanner — scanProjects retourne une structure Core valide", async () => {
  const audit = await projectScanner.scanProjects();

  assert.ok(Array.isArray(audit));
  assert.ok(audit.length > 0, "au moins un projet scorable dans /projects");

  for (const item of audit) {
    assert.ok(typeof item.name === "string" && item.name.length > 0);
    assert.ok(typeof item.score === "number" && item.score >= 0 && item.score <= 20);
    assert.ok(typeof item.stack === "string");
    assert.ok(typeof item.status === "string");
    assert.ok(typeof item.path === "string");
    assert.ok(fs.existsSync(item.path));
  }
});

test("projectBuilder — build sandbox sans effet Forge réel", async () => {
  await fs.remove(SMOKE_SANDBOX_DIR);

  const message = await projectBuilder.build(
    SMOKE_PROJECT,
    [{ path: "README.md", content: "# tools core smoke\n" }],
    true,
  );

  assert.match(message, /Sandbox/i);
  assert.ok(await fs.pathExists(path.join(SMOKE_SANDBOX_DIR, "README.md")));

  await fs.remove(SMOKE_SANDBOX_DIR);
});

test("projectMemoryPromoter — gate refuse projet introuvable ou immature", async () => {
  await assert.rejects(
    () => projectMemoryPromoter.promote("__tools_core_missing__"),
    /introuvable/i,
  );

  const gateProjectId = "__tools_core_gate_smoke__";
  const gatePath = path.join(PROJECTS_ROOT, gateProjectId);
  await fs.ensureDir(gatePath);
  await fs.writeFile(path.join(gatePath, "README.md"), "# gate smoke\n");

  try {
    const gated = await projectMemoryPromoter.promote(gateProjectId);
    assert.equal(gated.success, false);
    assert.ok(typeof gated.score === "number");
    assert.ok(gated.score < 18);
    assert.match(String(gated.reason), /Maturité insuffisante/i);
  } finally {
    await fs.remove(gatePath);
  }
});

test("toolExecutor — projectScan et registerInDashboard traversent le registre", async () => {
  securityHooks.deactivate("/confirm");

  const scanRaw = await toolExecutor.executeDirect("projectScan", [], {
    sessionId: "tools-core-smoke",
  });
  const scan = JSON.parse(scanRaw);
  assert.ok(Array.isArray(scan));
  assert.ok(scan.length > 0);

  const registerRaw = await toolExecutor.executeDirect(
    "registerInDashboard",
    ["episodic", "tools_core_executor_smoke", "via toolExecutor smoke"],
    { sessionId: "tools-core-smoke" },
  );
  const register = JSON.parse(registerRaw);
  assert.equal(register.success, true);
});
