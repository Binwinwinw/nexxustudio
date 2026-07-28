import {
  assessOcrServiceAvailability,
  OCR_DEFAULT_MAX_PAGES,
  OCR_HTTP_TIMEOUT_MS,
  resolveOcrServiceBaseUrl,
} from "./ocrConfig.js";

/**
 * @param {Record<string, unknown>} payload
 * @param {'page'|'document'} kind
 */
export function parseOcrToolPayload(payload, kind = "page") {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload;
  }
  const raw = String(payload ?? "").trim();
  if (raw.startsWith("{")) {
    try {
      return JSON.parse(raw);
    } catch {
      return kind === "page" ? { imagePath: raw } : { pdfPath: raw };
    }
  }
  return kind === "page" ? { imagePath: raw || undefined } : { pdfPath: raw || undefined };
}

/**
 * @param {object} run
 * @param {string} toolName
 * @returns {string}
 */
export function formatOcrToolResult(run, toolName = "ocr_page") {
  if (!run?.ok) {
    const err = run?.error || run?.message || "ocr_failed";
    console.warn(
      `[capability_tool.ocr] ${toolName} ok=false ms=${run?.durationMs ?? "?"} err=${err}`,
    );
    return `OCR indisponible (${toolName}) : ${err}`;
  }
  console.log(
    `[capability_tool.ocr] ${toolName} ok=true ms=${run.durationMs} pages=${run.data?.pages ?? "?"}`,
  );
  const preview = String(run.data?.markdown || run.data?.text || "").slice(0, 11000);
  return preview || "(OCR vide)";
}

/**
 * @param {object} body
 * @param {{ timeoutMs?: number }} [options]
 */
async function postOcrJson(path, body, options = {}) {
  const baseUrl = resolveOcrServiceBaseUrl();
  if (!baseUrl) {
    return {
      ok: false,
      durationMs: 0,
      error: "ocr_service_url_unset",
      data: null,
    };
  }
  const timeoutMs = options.timeoutMs ?? OCR_HTTP_TIMEOUT_MS;
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    const durationMs = Date.now() - started;
    if (!res.ok || data?.ok === false) {
      return {
        ok: false,
        durationMs,
        error: data?.error || data?.message || `http_${res.status}`,
        data,
      };
    }
    return { ok: true, durationMs, data };
  } catch (err) {
    return {
      ok: false,
      durationMs: Date.now() - started,
      error: err?.name === "AbortError" ? "timeout" : err?.message || "fetch_failed",
      data: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {{ imagePath?: string, imageUrl?: string, mode?: string, prompt?: string }} params
 */
export async function ocrPageRequest(params = {}) {
  const avail = await assessOcrServiceAvailability();
  if (!avail.ok) {
    return {
      ok: false,
      durationMs: 0,
      error: avail.reason || "ocr_unavailable",
      data: null,
    };
  }
  return postOcrJson("/ocr/page", {
    imagePath: params.imagePath || null,
    imageUrl: params.imageUrl || null,
    mode: params.mode || "gundam",
    prompt: params.prompt || "<image>document parsing.",
  });
}

/**
 * @param {{ pdfPath?: string, imageFiles?: string[], maxPages?: number, mode?: string, prompt?: string }} params
 */
export async function ocrDocumentRequest(params = {}) {
  const avail = await assessOcrServiceAvailability();
  if (!avail.ok) {
    return {
      ok: false,
      durationMs: 0,
      error: avail.reason || "ocr_unavailable",
      data: null,
    };
  }
  const maxPages = Number(params.maxPages) > 0 ? Number(params.maxPages) : OCR_DEFAULT_MAX_PAGES;
  return postOcrJson("/ocr/document", {
    pdfPath: params.pdfPath || null,
    imageFiles: params.imageFiles || null,
    mode: params.mode || "base",
    prompt: params.prompt || "<image>Multi page parsing.",
    maxPages,
  });
}
