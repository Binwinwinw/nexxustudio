import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  extractTextFromPdf,
  extractPdfTextFallback,
  hasPdfText,
  getPdfPageCount,
  processPdfAttachment,
  PdfExtractorError,
  MAX_PDF_BYTES,
  isPdfExtractionEnabled,
} from '../src/services/pdf-extractor.js';
import contextAgent from '../src/agent/utils/contextAgent.js';

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
);

describe('pdf-extractor', () => {
  it('extrait le texte d\'un PDF simple', async () => {
    const buffer = fs.readFileSync(path.join(fixturesDir, 'simple.pdf'));
    const text = await extractTextFromPdf(buffer);
    assert.ok(text.length > 20);
    assert.match(text.toLowerCase(), /exemple citadelle/);
  });

  it('fallback latin1 extrait les literals Tj', () => {
    const buffer = fs.readFileSync(path.join(fixturesDir, 'simple.pdf'));
    const text = extractPdfTextFallback(buffer);
    assert.match(text.toLowerCase(), /exemple citadelle/);
  });

  it('détecte un PDF sans couche texte (scan simulé)', async () => {
    const buffer = fs.readFileSync(path.join(fixturesDir, 'scanned-empty.pdf'));
    const hasText = await hasPdfText(buffer);
    assert.equal(hasText, false);
  });

  it('processPdfAttachment signale PDF_SCANNED_NO_TEXT', async () => {
    const buffer = fs.readFileSync(path.join(fixturesDir, 'scanned-empty.pdf'));
    const result = await processPdfAttachment(buffer, 'scan.pdf', buffer.length);
    assert.equal(result.ok, false);
    assert.equal(result.code, 'PDF_SCANNED_NO_TEXT');
    assert.equal(result.fallback, true);
    assert.ok(result.capability);
    assert.doesNotMatch(result.message, /OCR non disponible en v1\.0/i);
  });

  it('rejette un buffer trop volumineux', async () => {
    const huge = Buffer.alloc(MAX_PDF_BYTES + 1, 0);
    huge.write('%PDF', 0, 'ascii');
    await assert.rejects(
      () => extractTextFromPdf(huge),
      (err) => err instanceof PdfExtractorError && err.code === 'PDF_TOO_LARGE',
    );
  });

  it('compte les pages', async () => {
    const buffer = fs.readFileSync(path.join(fixturesDir, 'simple.pdf'));
    const pages = await getPdfPageCount(buffer);
    assert.ok(pages >= 1);
  });

  it('respecte SKILLS_DISABLED pour processPdfAttachment', async () => {
    const prev = process.env.SKILLS_DISABLED;
    process.env.SKILLS_DISABLED = 'skill-pdf-extraction';
    assert.equal(isPdfExtractionEnabled(), false);
    const buffer = fs.readFileSync(path.join(fixturesDir, 'simple.pdf'));
    const result = await processPdfAttachment(buffer, 'a.pdf', buffer.length);
    process.env.SKILLS_DISABLED = prev ?? '';
    assert.equal(result.code, 'SKILL_DISABLED');
  });
});

describe('contextAgent PDF ingest', () => {
  it('ingère un PDF avec texte extractible', async () => {
    const buffer = fs.readFileSync(path.join(fixturesDir, 'simple.pdf'));
    const out = await contextAgent.ingest([
      {
        originalname: 'rapport.pdf',
        mimetype: 'application/pdf',
        buffer,
        size: buffer.length,
      },
    ]);
    assert.ok(out?.briefing?.includes('DOCUMENTS DE CONTEXTE'));
    assert.match(out.briefing.toLowerCase(), /exemple citadelle/);
  });
});
