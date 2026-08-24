/**
 * Inventaire usage shims root utils/*.js (passe 2 prep).
 * Compte les fichiers hors node_modules qui importent encore le chemin root.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const SERVER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UTILS = path.join(SERVER, "src/agent/utils");

const shims = fs
  .readdirSync(UTILS)
  .filter((f) => f.endsWith(".js") && fs.statSync(path.join(UTILS, f)).isFile());

function famOf(file) {
  const c = fs.readFileSync(path.join(UTILS, file), "utf8");
  const m = c.match(/from ["']\.\/([^/"']+)\//);
  return m ? m[1] : "?";
}

function rgFiles(pattern) {
  try {
    const out = execFileSync(
      "rg",
      [
        "-l",
        "--glob",
        "!**/node_modules/**",
        pattern,
        "src",
        "tests",
        "index.js",
        "scripts",
        "../citadelle-vault",
      ],
      { cwd: SERVER, encoding: "utf8" },
    );
    return out.split(/\r?\n/).filter(Boolean);
  } catch (e) {
    if (e.status === 1) return []; // no matches
    // fallback: walk
    return [];
  }
}

function mentionsRootShim(filePath, base, shim) {
  if (!fs.existsSync(filePath)) return false;
  // ignore the shim file itself and family implementations
  const norm = filePath.replace(/\\/g, "/");
  if (norm.endsWith(`/utils/${shim}`)) return false;
  if (/\/utils\/[^/]+\//.test(norm) && norm.includes(`/utils/`) && !norm.endsWith(`/utils/${shim}`)) {
    // family file — only count if it imports via root (unlikely)
  }
  const t = fs.readFileSync(filePath, "utf8");
  // root-style only: .../utils/foo.js or .../utils/foo'  — not .../utils/family/foo
  const re = new RegExp(
    String.raw`(?:from\s+|import\s*\(\s*)['"][^'"]*/utils/${base}(?:\.js)?['"]`,
  );
  const reRel = new RegExp(
    String.raw`(?:from\s+|import\s*\(\s*)['"](?:\.\./)+utils/${base}(?:\.js)?['"]`,
  );
  return re.test(t) || reRel.test(t);
}

const counts = [];
for (const shim of shims) {
  const base = shim.replace(/\.js$/, "");
  const candidates = new Set([
    ...rgFiles(`utils/${base}`),
    ...rgFiles(`utils/${shim}`),
  ]);
  const files = [...candidates].filter((f) =>
    mentionsRootShim(path.join(SERVER, f), base, shim),
  );
  counts.push({
    shim,
    fam: famOf(shim),
    n: files.length,
    sample: files.slice(0, 6),
  });
}

counts.sort((a, b) => b.n - a.n);

const byFam = {};
for (const c of counts) {
  byFam[c.fam] ??= { shims: 0, refs: 0 };
  byFam[c.fam].shims += 1;
  byFam[c.fam].refs += c.n;
}

console.log(
  JSON.stringify(
    {
      totalShims: shims.length,
      totalRefs: counts.reduce((s, c) => s + c.n, 0),
      top20: counts.slice(0, 20),
      zeroUsage: counts.filter((c) => c.n === 0).map((c) => c.shim),
      byFam,
    },
    null,
    2,
  ),
);
