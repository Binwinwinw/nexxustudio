import { spawnSync } from "node:child_process";
import { assessGraphifyGraphAvailability, resolveGraphifyGraphPath } from "./graphifyPaths.js";

export const GRAPHIFY_CLI_TIMEOUT_MS = Number.parseInt(
  process.env.GRAPHIFY_CLI_TIMEOUT_MS || "15000",
  10,
);

const DEFAULT_TIMEOUT =
  Number.isFinite(GRAPHIFY_CLI_TIMEOUT_MS) && GRAPHIFY_CLI_TIMEOUT_MS > 0
    ? GRAPHIFY_CLI_TIMEOUT_MS
    : 15000;

/**
 * @returns {string}
 */
export function resolveGraphifyBinary() {
  return process.env.GRAPHIFY_BIN || "graphify";
}

/**
 * @param {string} stdout
 * @param {string} stderr
 * @returns {string}
 */
export function normalizeGraphifyCliOutput(stdout = "", stderr = "") {
  const out = String(stdout || "").trim();
  const err = String(stderr || "").trim();
  if (!out && err) return err.slice(0, 8000);
  if (out && err) {
    return `${out}\n\n[stderr]\n${err}`.slice(0, 12000);
  }
  return out.slice(0, 12000);
}

/**
 * @param {string[]} args
 * @param {{ timeoutMs?: number, graphPath?: string }} [options]
 */
export function runGraphifyCli(args = [], options = {}) {
  const graphPath = options.graphPath || resolveGraphifyGraphPath();
  const bin = resolveGraphifyBinary();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
  const fullArgs = [...args, "--graph", graphPath];

  const started = Date.now();
  let result;
  try {
    result = spawnSync(bin, fullArgs, {
      encoding: "utf8",
      timeout: timeoutMs,
      maxBuffer: 2 * 1024 * 1024,
      windowsHide: true,
    });
  } catch (err) {
    return {
      ok: false,
      exitCode: null,
      durationMs: Date.now() - started,
      output: "",
      error: err?.message || "spawn_failed",
      binary: bin,
      graphPath,
    };
  }

  const output = normalizeGraphifyCliOutput(result.stdout, result.stderr);
  const spawnError = result.error?.message || null;
  const timedOut = result.error?.code === "ETIMEDOUT";
  const ok = result.status === 0 && !spawnError && !timedOut;

  return {
    ok,
    exitCode: result.status,
    durationMs: Date.now() - started,
    output,
    error: timedOut ? "timeout" : spawnError,
    binary: bin,
    graphPath,
  };
}

/**
 * @param {string} question
 * @param {{ graphPath?: string }} [options]
 */
export function graphifyQuery(question, options = {}) {
  const q = String(question || "").trim();
  if (!q) {
    return { ok: false, output: "", error: "empty_question" };
  }
  const avail = assessGraphifyGraphAvailability();
  if (!avail.ok) {
    return { ok: false, output: "", error: avail.reason, graphPath: avail.graphPath };
  }
  const run = runGraphifyCli(["query", q], {
    graphPath: options.graphPath || avail.graphPath,
  });
  console.log(
    `[capability_tool.graphify] graph_query ok=${run.ok} ms=${run.durationMs} exit=${run.exitCode}`,
  );
  return run;
}

/**
 * @param {string} source
 * @param {string} target
 */
export function graphifyPath(source, target, options = {}) {
  const a = String(source || "").trim();
  const b = String(target || "").trim();
  if (!a || !b) {
    return { ok: false, output: "", error: "empty_path_endpoints" };
  }
  const avail = assessGraphifyGraphAvailability();
  if (!avail.ok) {
    return { ok: false, output: "", error: avail.reason, graphPath: avail.graphPath };
  }
  const run = runGraphifyCli(["path", a, b], {
    graphPath: options.graphPath || avail.graphPath,
  });
  console.log(
    `[capability_tool.graphify] graph_path ok=${run.ok} ms=${run.durationMs} exit=${run.exitCode}`,
  );
  return run;
}

/**
 * @param {string} node
 */
export function graphifyExplain(node, options = {}) {
  const n = String(node || "").trim();
  if (!n) {
    return { ok: false, output: "", error: "empty_node" };
  }
  const avail = assessGraphifyGraphAvailability();
  if (!avail.ok) {
    return { ok: false, output: "", error: avail.reason, graphPath: avail.graphPath };
  }
  const run = runGraphifyCli(["explain", n], {
    graphPath: options.graphPath || avail.graphPath,
  });
  console.log(
    `[capability_tool.graphify] graph_explain ok=${run.ok} ms=${run.durationMs} exit=${run.exitCode}`,
  );
  return run;
}

/**
 * Réponse outillée courte pour le LLM — fallback silencieux si échec CLI.
 * @param {{ ok: boolean, output?: string, error?: string }} run
 * @param {string} label
 */
export function formatGraphifyToolResult(run, label = "graphify") {
  if (run?.ok && run.output) {
    return `[${label}]\n${run.output}`;
  }
  const err = run?.error || "graphify_unavailable";
  return `[${label}] indisponible (${err}) — continue sans inventer de structure de code.`;
}
