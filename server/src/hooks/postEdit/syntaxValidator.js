/**
 * Validation syntaxe post-écriture (Phase E1 — always-on).
 */
import fs from "fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";

function ok(extra = {}) {
  return { valid: true, ...extra };
}

function fail(reason, details = "", validator = "syntax") {
  return { valid: false, reason, details: String(details).slice(0, 2000), validator };
}

function commandExists(cmd) {
  const probe = spawnSync(cmd, ["--version"], { encoding: "utf8", shell: true });
  return probe.status === 0 || probe.status === 1;
}

function validateJson(content) {
  try {
    JSON.parse(content);
    return ok({ validator: "json" });
  } catch (err) {
    return fail("json_syntax_error", err.message, "json");
  }
}

function validatePython(absolutePath) {
  const python = process.env.PYTHON || "python";
  const result = spawnSync(python, ["-m", "py_compile", absolutePath], {
    encoding: "utf8",
  });
  if (result.status === 0) return ok({ validator: "py_compile" });
  return fail(
    "python_syntax_error",
    result.stderr || result.stdout || "py_compile failed",
    "py_compile",
  );
}

function validatePhp(absolutePath) {
  if (!commandExists("php")) {
    return ok({ skipped: true, reason: "php_unavailable", validator: "php" });
  }
  const result = spawnSync("php", ["-l", absolutePath], { encoding: "utf8", shell: true });
  if (result.status === 0) return ok({ validator: "php" });
  return fail("php_syntax_error", result.stderr || result.stdout, "php");
}

async function validateYamlAsync(content) {
  if (commandExists("yamllint")) {
    const tmp = path.join(os.tmpdir(), `nexxus_yaml_${Date.now()}.yml`);
    try {
      await fs.writeFile(tmp, content, "utf8");
      const result = spawnSync("yamllint", [tmp], { encoding: "utf8", shell: true });
      if (result.status === 0) return ok({ validator: "yamllint" });
      return fail("yaml_syntax_error", result.stdout || result.stderr, "yamllint");
    } finally {
      await fs.unlink(tmp).catch(() => {});
    }
  }
  return ok({ validator: "yaml_basic", skipped: true, reason: "yamllint_unavailable" });
}

function validateJsTs(absolutePath) {
  const result = spawnSync(
    "npx",
    [
      "eslint",
      absolutePath,
      "--no-eslintrc",
      "--parser-options",
      "ecmaVersion:latest,sourceType:module",
      "--max-warnings",
      "0",
    ],
    { encoding: "utf8", shell: true },
  );
  if (result.status === 0) return ok({ validator: "eslint" });
  return fail(
    "eslint_syntax_error",
    result.stdout || result.stderr || "eslint failed",
    "eslint",
  );
}

const EXT_HANDLERS = {
  ".json": async (_abs, content) => validateJson(content),
  ".py": async (abs) => validatePython(abs),
  ".php": async (abs) => validatePhp(abs),
  ".yml": async (_abs, content) => validateYamlAsync(content),
  ".yaml": async (_abs, content) => validateYamlAsync(content),
  ".js": async (abs) => validateJsTs(abs),
  ".jsx": async (abs) => validateJsTs(abs),
  ".ts": async (abs) => validateJsTs(abs),
  ".tsx": async (abs) => validateJsTs(abs),
  ".mjs": async (abs) => validateJsTs(abs),
  ".cjs": async (abs) => validateJsTs(abs),
};

export function isSyntaxValidationEnabled() {
  return String(process.env.POST_EDIT_SYNTAX || "on").toLowerCase() !== "off";
}

/**
 * @param {string} absolutePath
 * @param {string|null} content
 */
export async function validateSyntaxFile(absolutePath, content = null) {
  const ext = path.extname(absolutePath).toLowerCase();
  const handler = EXT_HANDLERS[ext];
  if (!handler) {
    return ok({ skipped: true, reason: "unsupported_extension", validator: "none" });
  }

  const body =
    content ?? (await fs.readFile(absolutePath, "utf8").catch(() => ""));
  return handler(absolutePath, body);
}
