import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const AGENT_ROOT = fileURLToPath(new URL("../src/agent/", import.meta.url));

const ROUTING_BARREL_TAIL = /(?:^|\/)policies\/routing\/index(?:\.js)?$/;
const IMPORT_SPEC_RE = /(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g;

function posix(p) {
  return String(p).replaceAll("\\", "/");
}

function walkJsFiles(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkJsFiles(full, acc);
    else if (entry.name.endsWith(".js")) acc.push(full);
  }
  return acc;
}

function isRoutingBarrelFile(filePath) {
  return posix(filePath).endsWith("/policies/routing/index.js");
}

function collectImportSpecifiers(source) {
  const specs = [];
  const re = new RegExp(IMPORT_SPEC_RE.source, "g");
  let match;
  while ((match = re.exec(source))) {
    specs.push(match[1]);
  }
  return specs;
}

function isInternalRoutingBarrelImport(specifier, fromFile) {
  const spec = posix(specifier);
  if (ROUTING_BARREL_TAIL.test(spec)) return true;
  if (isRoutingBarrelFile(fromFile)) return false;
  const from = posix(fromFile);
  if (!from.includes("/policies/routing/")) return false;
  return spec === "./index.js" || spec === "./index";
}

function findInternalRoutingBarrelImports(root = AGENT_ROOT) {
  const hits = [];
  for (const file of walkJsFiles(root)) {
    if (isRoutingBarrelFile(file)) continue;
    const src = readFileSync(file, "utf8");
    for (const spec of collectImportSpecifiers(src)) {
      if (isInternalRoutingBarrelImport(spec, file)) {
        hits.push({ file, spec });
      }
    }
  }
  return hits;
}

describe("ROUTING_INTERNAL_IMPORT_GUARD_V1", () => {
  it("laisse passer un import source", () => {
    assert.equal(
      isInternalRoutingBarrelImport(
        "../../policies/routing/practicalAdviceRoutingGuard.js",
        join(AGENT_ROOT, "micro/classifiers/intentShortCircuit.js"),
      ),
      false,
    );
  });

  it("détecte un import interne du barrel", () => {
    assert.equal(
      isInternalRoutingBarrelImport(
        "../../policies/routing/index.js",
        join(AGENT_ROOT, "micro/classifiers/intentShortCircuit.js"),
      ),
      true,
    );
  });

  it("détecte un self-barrel depuis policies/routing", () => {
    assert.equal(
      isInternalRoutingBarrelImport(
        "./index.js",
        join(AGENT_ROOT, "policies/routing/practicalAdviceRoutingGuard.js"),
      ),
      true,
    );
  });

  it("aucun fichier sous src/agent n'importe le barrel routing", () => {
    const hits = findInternalRoutingBarrelImports();
    assert.equal(
      hits.length,
      0,
      hits
        .map((h) => `${posix(relative(AGENT_ROOT, h.file))}: ${h.spec}`)
        .join("\n"),
    );
  });
});
