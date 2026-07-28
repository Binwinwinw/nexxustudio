import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, "..");
const EXPERTS_CACHE = path.join(SERVER_ROOT, "cache", "experts_cache.json");
const WORKSPACE_INDEX = path.join(SERVER_ROOT, "cache", "workspace_index.json");
const EXPERTS_DIR = path.join(SERVER_ROOT, "data", "experts");

describe("server/cache taxonomy", () => {
  it("experts sources restent sous data/, cache sous cache/", async () => {
    assert.equal(await fs.pathExists(EXPERTS_DIR), true);
    assert.equal(await fs.pathExists(path.join(SERVER_ROOT, "data", "experts_cache.json")), false);
  });

  it("workspace_index n'est plus sous memory/projects", async () => {
    assert.equal(
      await fs.pathExists(path.join(SERVER_ROOT, "data", "memory", "projects", "workspace_index.json")),
      false,
    );
  });

  it("chemins cache résolus et lisibles si présents", async () => {
    if (await fs.pathExists(EXPERTS_CACHE)) {
      const cache = await fs.readJson(EXPERTS_CACHE);
      assert.equal(typeof cache, "object");
    }
    if (await fs.pathExists(WORKSPACE_INDEX)) {
      const index = await fs.readJson(WORKSPACE_INDEX);
      assert.ok(index && typeof index === "object");
    }
  });

  it("absence du cache experts ne bloque pas la résolution du path", () => {
    assert.match(EXPERTS_CACHE.replace(/\\/g, "/"), /\/cache\/experts_cache\.json$/);
    assert.match(WORKSPACE_INDEX.replace(/\\/g, "/"), /\/cache\/workspace_index\.json$/);
  });

  it("fixtures eval sont sous tests/fixtures, pas data/", async () => {
    const scenarios = path.join(SERVER_ROOT, "tests", "fixtures", "scenarios.json");
    const probes = path.join(SERVER_ROOT, "tests", "fixtures", "persona_probes.json");
    assert.equal(await fs.pathExists(scenarios), true);
    assert.equal(await fs.pathExists(probes), true);
    assert.equal(await fs.pathExists(path.join(SERVER_ROOT, "data", "fixtures")), false);
  });
});
