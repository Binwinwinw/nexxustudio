import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';
import { resolvePdfExtractionContract } from '../agent/policies/documentCapabilityContract.js';

const require = createRequire(import.meta.url);

/** Aligné multer (10 Mo) — skill-pdf-extraction v1.0 */
export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_PAGES = 100;
export const MIN_PDF_TEXT_CHARS = 32;
export const MAX_EXTRACTED_TEXT_CHARS = 100_000;

export class PdfExtractorError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PdfExtractorError';
    this.code = code;
  }
}

let pdfParseLoader = null;

async function loadPdfParse() {
  if (pdfParseLoader !== null) return pdfParseLoader;
  try {
    const mod = await import('pdf-parse');
    pdfParseLoader = mod.default || mod;
  } catch {
    pdfParseLoader = false;
  }
  return pdfParseLoader;
}

function decodePdfLiteral(str) {
  return str.replace(/\\([\\()nrtbf])/g, (_, ch) => {
    const map = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' };
    return map[ch] || ch;
  });
}

/**
 * Extraction de secours (PDF texte simple) si pdf-parse indisponible.
 */
export function extractPdfTextFallback(buffer) {
  const raw = buffer.toString('latin1');
  const chunks = [];

  for (const match of raw.matchAll(/\(([^\\)]*)\)\s*Tj/g)) {
    chunks.push(decodePdfLiteral(match[1]));
  }

  return chunks.join('\n').trim();
}

function countPagesFallback(buffer) {
  const raw = buffer.toString('latin1');
  const countMatch = raw.match(/\/Type\s*\/Pages[\s\S]*?\/Count\s+(\d+)/);
  if (countMatch) return Number(countMatch[1]) || 1;
  const pageMatches = raw.match(/\/Type\s*\/Page\b/g);
  return pageMatches?.length || 1;
}

async function parsePdfBuffer(buffer) {
  const parser = await loadPdfParse();
  if (parser) {
    try {
      const data = await parser(buffer);
      return {
        text: String(data.text || '').trim(),
        numpages: data.numpages || 1,
        info: data.info || {},
      };
    } catch (error) {
      console.warn(
        `[pdf-extractor] pdf-parse échoué (${error.message}) — fallback latin1`,
      );
    }
  }

  return {
    text: extractPdfTextFallback(buffer),
    numpages: countPagesFallback(buffer),
    info: {},
  };
}

export function isPdfFile(mimetype = '', fileName = '') {
  const mime = String(mimetype).toLowerCase();
  const name = String(fileName).toLowerCase();
  return mime === 'application/pdf' || name.endsWith('.pdf');
}

export function isPdfExtractionEnabled() {
  const disabled = String(process.env.SKILLS_DISABLED || '')
    .split(',')
    .map((s) => s.trim());
  if (disabled.includes('skill-pdf-extraction')) return false;
  if (process.env.PDF_EXTRACTION_ENABLED === 'false') return false;
  return true;
}

function assertBufferSize(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new PdfExtractorError('PDF_INVALID_BUFFER', 'Buffer PDF invalide.');
  }
  if (buffer.length > MAX_PDF_BYTES) {
    throw new PdfExtractorError(
      'PDF_TOO_LARGE',
      `PDF trop volumineux (max ${MAX_PDF_BYTES / (1024 * 1024)} Mo).`,
    );
  }
  if (buffer.length < 5 || !buffer.slice(0, 5).toString('utf8').startsWith('%PDF')) {
    throw new PdfExtractorError('PDF_INVALID_FORMAT', 'Fichier PDF invalide ou corrompu.');
  }
}

/**
 * @param {Buffer} buffer
 * @param {{ maxChars?: number }} [options]
 */
export async function extractTextFromPdf(buffer, options = {}) {
  assertBufferSize(buffer);
  const { text } = await parsePdfBuffer(buffer);
  const maxChars = options.maxChars ?? MAX_EXTRACTED_TEXT_CHARS;
  return text.slice(0, maxChars);
}

export async function getPdfPageCount(buffer) {
  assertBufferSize(buffer);
  const { numpages } = await parsePdfBuffer(buffer);
  return numpages;
}

export async function extractMetadataFromPdf(buffer) {
  assertBufferSize(buffer);
  const { numpages, info } = await parsePdfBuffer(buffer);
  return {
    title: info?.Title || null,
    author: info?.Author || null,
    pages: numpages,
  };
}

export async function hasPdfText(buffer) {
  const text = await extractTextFromPdf(buffer, { maxChars: 5000 });
  return text.trim().length >= MIN_PDF_TEXT_CHARS;
}

/**
 * Point d'entrée upload — skill-pdf-extraction v1.0
 * @returns {Promise<object>}
 */
export async function processPdfAttachment(buffer, fileName, fileSize = buffer?.length) {
  if (!isPdfExtractionEnabled()) {
    const base = {
      ok: false,
      code: 'SKILL_DISABLED',
      fallback: true,
      fileName,
      message: 'Extraction PDF désactivée — fallback document-analysis.',
    };
    const { capability, message } = resolvePdfExtractionContract(base);
    return { ...base, message, capability };
  }

  try {
    assertBufferSize(buffer);

    const metadata = await extractMetadataFromPdf(buffer);
    const pageCount = metadata.pages;

    if (pageCount > MAX_PDF_PAGES) {
      const preview = await extractTextFromPdf(buffer, { maxChars: 5000 });
      const base = {
        ok: false,
        code: 'PDF_TOO_MANY_PAGES',
        fallback: true,
        fileName,
        pageCount,
        metadata,
        partialText: preview,
      };
      const { capability, message } = resolvePdfExtractionContract(base);
      return {
        ...base,
        message,
        capability,
      };
    }

    const text = await extractTextFromPdf(buffer);
    if (text.trim().length < MIN_PDF_TEXT_CHARS) {
      const base = {
        ok: false,
        code: 'PDF_SCANNED_NO_TEXT',
        fallback: true,
        fileName,
        pageCount,
        metadata,
      };
      const { capability, message } = resolvePdfExtractionContract(base);
      return {
        ...base,
        message,
        capability,
      };
    }

    return {
      ok: true,
      fileName,
      text,
      pageCount,
      metadata,
      extractor: (await loadPdfParse()) ? 'pdf-parse' : 'fallback',
      capability: resolvePdfExtractionContract({
        ok: true,
        text,
        pageCount,
        fileName,
      }).capability,
    };
  } catch (error) {
    if (error instanceof PdfExtractorError) {
      const base = {
        ok: false,
        code: error.code,
        fallback: true,
        fileName,
        message: error.message,
      };
      const { capability, message } = resolvePdfExtractionContract(base);
      return { ...base, message, capability };
    }
    const base = {
      ok: false,
      code: 'PDF_PARSE_FAILED',
      fallback: true,
      fileName,
      message: error.message,
    };
    const { capability, message } = resolvePdfExtractionContract(base);
    return { ...base, message, capability };
  }
}

export async function readPdfMetaFromSkillConfig() {
  const metaPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../data/skills/skill-pdf-extraction/meta.json',
  );
  try {
    const raw = await fs.readFile(metaPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { enabled: true };
  }
}
