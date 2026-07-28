import path from "node:path";

export const OCR_DEFAULT_MAX_PAGES = Number.parseInt(
  process.env.OCR_MAX_PAGES_DEFAULT || "40",
  10,
);

export const OCR_SERVICE_TIMEOUT_MS = Number.parseInt(
  process.env.OCR_SERVICE_TIMEOUT_MS || "120000",
  10,
);

const DEFAULT_TIMEOUT =
  Number.isFinite(OCR_SERVICE_TIMEOUT_MS) && OCR_SERVICE_TIMEOUT_MS > 0
    ? OCR_SERVICE_TIMEOUT_MS
    : 120000;

/**
 * @returns {string|null}
 */
export function resolveOcrServiceBaseUrl() {
  const raw = String(process.env.OCR_SERVICE_URL || "").trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

export function isOcrServiceAssumeReady() {
  const raw = String(process.env.OCR_SERVICE_ASSUME_READY || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/**
 * @returns {{ ok: boolean, reason?: string, baseUrl?: string }}
 */
export async function assessOcrServiceAvailability() {
  const baseUrl = resolveOcrServiceBaseUrl();
  if (!baseUrl) {
    return { ok: false, reason: "ocr_service_url_unset" };
  }
  if (isOcrServiceAssumeReady()) {
    return { ok: true, baseUrl, reason: "assume_ready" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${baseUrl}/health`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      return { ok: false, reason: `health_http_${res.status}`, baseUrl };
    }
    const body = await res.json();
    if (body?.ok !== true) {
      return { ok: false, reason: "health_not_ok", baseUrl };
    }
    return { ok: true, baseUrl, backend: body.backend };
  } catch (err) {
    return {
      ok: false,
      reason: err?.name === "AbortError" ? "health_timeout" : "health_unreachable",
      baseUrl,
    };
  } finally {
    clearTimeout(timer);
  }
}

export { DEFAULT_TIMEOUT as OCR_HTTP_TIMEOUT_MS };

/**
 * @param {unknown[]} attachments
 * @returns {{ pdfPaths: string[], imagePaths: string[], names: string[] }}
 */
export function resolveAttachmentPathsForOcr(attachments = []) {
  const pdfPaths = [];
  const imagePaths = [];
  const names = [];
  for (const file of Array.isArray(attachments) ? attachments : []) {
    const name = String(file?.originalname || file?.name || "");
    const filePath = file?.path ? path.resolve(String(file.path)) : null;
    if (name) names.push(name);
    if (!filePath) continue;
    if (/\.pdf$/i.test(name) || file?.mimetype === "application/pdf") {
      pdfPaths.push(filePath);
    } else if (
      /^image\//.test(String(file?.mimetype || "")) ||
      /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(name)
    ) {
      imagePaths.push(filePath);
    }
  }
  return { pdfPaths, imagePaths, names };
}
