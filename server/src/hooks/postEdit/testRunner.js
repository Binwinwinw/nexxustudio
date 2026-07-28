/**
 * Tests ciblés post-écriture (Phase E2 — /test-required ou chemins sensibles).
 */
import fs from "fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function ok(extra = {}) {
  return { valid: true, ...extra };
}

function fail(reason, details = "", runner = "tests") {
  return { valid: false, reason, details: String(details).slice(0, 3000), runner };
}

function fileExists(p) {
  return fsSync.existsSync(p);
}

export function getPostEditTestMode(state = {}) {
  if (state.isActive?.("/test-required")) return "full";
  const env = String(process.env.POST_EDIT_TESTS || "targeted").toLowerCase();
  if (env === "off") return "off";
  if (env === "full") return "full";
  return "targeted";
}

export function isSensitiveTestPath(relativePath = "") {
  const p = String(relativePath).replace(/\\/g, "/");
  return (
    /\.(test|spec)\.(js|ts|jsx|tsx|mjs|cjs)$/i.test(p) ||
    /(^|\/)src\//i.test(p) ||
    /(^|\/)lib\//i.test(p) ||
    /(^|\/)projects\/.*\.py$/i.test(p)
  );
}

export function shouldRunPostEditTests(relativePath, state = {}) {
  const mode = getPostEditTestMode(state);
  if (mode === "off") return false;
  if (mode === "full") return true;
  return isSensitiveTestPath(relativePath);
}

async function runJsTargetedTests(absolutePath, projectRoot) {
  const pkgPath = path.join(projectRoot, "package.json");
  try {
    await fs.access(pkgPath);
  } catch {
    return ok({ skipped: true, reason: "no_package_json", runner: "npm_test" });
  }

  const rel = path.relative(projectRoot, absolutePath).replace(/\\/g, "/");
  const pattern = rel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const result = spawnSync(
    "npm",
    ["run", "test", "--", "--testPathPattern", pattern, "--passWithNoTests"],
    { encoding: "utf8", cwd: projectRoot, shell: true, timeout: 120_000 },
  );

  if (result.status === 0) return ok({ runner: "npm_test", pattern: rel });
  return fail(
    "npm_test_failed",
    result.stdout || result.stderr || "npm test failed",
    "npm_test",
  );
}

async function runPythonTargetedTests(absolutePath) {
  const python = process.env.PYTHON || "python";
  const pytest = spawnSync(python, ["-m", "pytest", "--version"], {
    encoding: "utf8",
    shell: true,
  });
  if (pytest.status !== 0) {
    return ok({ skipped: true, reason: "pytest_unavailable", runner: "pytest" });
  }

  const result = spawnSync(python, ["-m", "pytest", absolutePath, "-q"], {
    encoding: "utf8",
    shell: true,
    timeout: 120_000,
  });
  if (result.status === 0) return ok({ runner: "pytest" });
  return fail(
    "pytest_failed",
    result.stdout || result.stderr || "pytest failed",
    "pytest",
  );
}

async function runPhpTargetedTests(absolutePath, projectRoot) {
  if (!fileExists(path.join(projectRoot, "phpunit.xml")) &&
      !fileExists(path.join(projectRoot, "phpunit.xml.dist"))) {
    return ok({ skipped: true, reason: "no_phpunit", runner: "phpunit" });
  }
  const result = spawnSync("phpunit", [absolutePath], {
    encoding: "utf8",
    cwd: projectRoot,
    shell: true,
    timeout: 120_000,
  });
  if (result.status === 0) return ok({ runner: "phpunit" });
  return fail(
    "phpunit_failed",
    result.stdout || result.stderr || "phpunit failed",
    "phpunit",
  );
}

/**
 * @param {string} absolutePath
 * @param {string} relativePath
 * @param {string} workspaceRoot
 */
export async function runTargetedTests(absolutePath, relativePath, workspaceRoot) {
  const ext = path.extname(absolutePath).toLowerCase();
  const projectRoot = findProjectRoot(absolutePath, workspaceRoot);

  if ([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"].includes(ext)) {
    return runJsTargetedTests(absolutePath, projectRoot);
  }
  if (ext === ".py") {
    return runPythonTargetedTests(absolutePath);
  }
  if (ext === ".php") {
    return runPhpTargetedTests(absolutePath, projectRoot);
  }

  return ok({ skipped: true, reason: "unsupported_test_extension" });
}

function findProjectRoot(absolutePath, workspaceRoot) {
  let dir = path.dirname(absolutePath);
  const root = path.resolve(workspaceRoot);
  while (dir.startsWith(root)) {
    if (fileExists(path.join(dir, "package.json")) || fileExists(path.join(dir, "pyproject.toml"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return root;
}
