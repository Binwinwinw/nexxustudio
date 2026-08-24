/**
 * Enrichit un briefing documentaire via OCR quand la couche texte est absente.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ocrDocumentRequest } from "../../capabilities/ocr/ocrClient.js";
import { isPdfFile } from "../../../services/pdf-extractor.js";

/**
 * @param {object} file — multer-like { buffer, originalname, mimetype }
 * @param {{ maxPages?: number }} [opts]
 * @returns {Promise<{ ok: boolean, text: string, error?: string, pageCount?: number }>}
 */
export async function runOcrOnPdfAttachment(file = {}, opts = {}) {
  const buffer = file?.buffer;
  const fileName = file?.originalname || file?.name || "document.pdf";
  if (!buffer || !Buffer.isBuffer(buffer)) {
    return { ok: false, text: "", error: "missing_pdf_buffer" };
  }
  if (!isPdfFile(file?.mimetype, fileName)) {
    return { ok: false, text: "", error: "not_pdf" };
  }

  const tmpPath = path.join(
    os.tmpdir(),
    `nexxus-ocr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`,
  );
  try {
    await fs.writeFile(tmpPath, buffer);
    const run = await ocrDocumentRequest({
      pdfPath: tmpPath,
      maxPages: opts.maxPages || 20,
    });
    if (!run?.ok) {
      return {
        ok: false,
        text: "",
        error: run?.error || "ocr_failed",
      };
    }
    const text = String(run.data?.markdown || run.data?.text || "").trim();
    return {
      ok: text.length > 0,
      text,
      error: text ? undefined : "ocr_empty",
      pageCount: run.data?.pages ?? null,
    };
  } catch (err) {
    return {
      ok: false,
      text: "",
      error: err?.message || "ocr_exception",
    };
  } finally {
    await fs.unlink(tmpPath).catch(() => {});
  }
}

/**
 * @param {string} briefing
 * @param {{ fileName: string, ocrText: string, pageCount?: number|null }} payload
 */
export function injectOcrTextIntoBriefing(briefing = "", payload = {}) {
  const name = payload.fileName || "document.pdf";
  const pages =
    payload.pageCount != null ? ` — ${payload.pageCount} page(s)` : "";
  const block = [
    `\n--- TRANSCRIPTION OCR (${name}${pages}) ---`,
    String(payload.ocrText || "").slice(0, 120000),
    "--- FIN TRANSCRIPTION OCR ---\n",
  ].join("\n");
  return `${String(briefing || "")}\n${block}`;
}
