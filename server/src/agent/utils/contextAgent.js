/* server/src/agent/utils/contextAgent.js */
import {
  isPdfFile,
  processPdfAttachment,
} from '../../services/pdf-extractor.js';
import {
  isArchiveFile,
  extractArchiveToText,
} from '../../services/document-analysis/archiveExtractor.js';
import {
  isDocxFile,
  isLegacyDocFile,
  extractDocxToText,
} from '../../services/document-analysis/docxExtractor.js';
import { formatCapabilityBriefingBlock } from '../policies/documentCapabilityContract.js';

/**
 * ContextAgent - Gère l'ingestion de documents et fichiers textes dans le pipeline.
 */
class ContextAgent {
  constructor() {
    this.name = 'Nexxus-Context';
  }

  async _readFileContent(file) {
    const fileName = file.originalname || file.name || 'document';

    if (isArchiveFile(file.mimetype, fileName)) {
      try {
        const extracted = extractArchiveToText(file.buffer, fileName);
        return {
          text: extracted.text,
          archiveMeta: {
            fileCount: extracted.fileCount,
            warnings: extracted.warnings,
          },
        };
      } catch (error) {
        return {
          text: `[ARCHIVE — extraction impossible: ${error.message}]`,
          archiveMeta: { error: error.message },
        };
      }
    }

    if (isPdfFile(file.mimetype, fileName)) {
      const result = await processPdfAttachment(
        file.buffer,
        file.originalname || file.name,
        file.size,
      );

      if (result.ok) {
        const header = `[PDF — ${result.pageCount} page(s)${result.metadata?.title ? ` — ${result.metadata.title}` : ''} — extracteur: ${result.extractor}]\n`;
        return {
          text: header + result.text,
          pdfMeta: {
            pageCount: result.pageCount,
            metadata: result.metadata,
            extractor: result.extractor,
          },
        };
      }

      const warning = `[PDF — ${result.message}]\n`;
      const capabilityLine = result.capability
        ? `${formatCapabilityBriefingBlock(result.capability)}\n`
        : '';
      const partial = result.partialText ? `${result.partialText}\n` : '';
      const rawFallback = file.buffer.toString('utf8').slice(0, 2000);
      return {
        text: `${warning}${capabilityLine}${partial}[Contenu brut partiel UTF-8 — non fiable pour PDF]\n${rawFallback}`,
        pdfMeta: {
          code: result.code,
          fallback: true,
          pageCount: result.pageCount || null,
          capability: result.capability || null,
        },
      };
    }

    if (isDocxFile(file.mimetype, fileName)) {
      const result = extractDocxToText(file.buffer, fileName);
      if (result.ok) {
        return {
          text: `[DOCX — extracteur: ${result.extractor}]\n${result.text}`,
          docxMeta: { extractor: result.extractor },
        };
      }
      return {
        text:
          `[DOCX — extraction indisponible: ${result.message}]\n` +
          "Impossible de lire ce Word binaire en UTF-8. Exporte en .md/.txt ou recolle l'extrait pertinent.",
        docxMeta: { error: result.message, fallback: true },
      };
    }

    if (isLegacyDocFile(file.mimetype, fileName)) {
      return {
        text:
          `[DOC — format .doc (binaire legacy) non supporté pour l'extraction locale]\n` +
          "Convertis en .docx, .md ou .txt, ou colle l'extrait à résumer.",
        docxMeta: { error: "legacy_doc_unsupported", fallback: true },
      };
    }

    try {
      return { text: file.buffer.toString('utf8') };
    } catch (err) {
      return { text: `[ERREUR DE LECTURE: ${err.message}]` };
    }
  }

  /**
   * Analyse une liste de fichiers (multer objects) et extrait leur contenu textuel.
   * @param {Array<Object>} files - Liste des fichiers uploadés (multer)
   */
  async ingest(files) {
    if (!files || files.length === 0) return null;

    const textFiles = files.filter((f) => !f.mimetype?.startsWith('image/'));
    if (textFiles.length === 0) return null;

    console.log(`[ContextAgent] 📚 Ingestion de ${textFiles.length} document(s)...`);

    const contents = [];
    for (const file of textFiles) {
      const { text, pdfMeta } = await this._readFileContent(file);
      contents.push({
        filename: file.originalname,
        mimetype: file.mimetype,
        content: text,
        size: file.size,
        pdfMeta: pdfMeta || null,
      });
    }

    let briefing = "\n--- DOCUMENTS DE CONTEXTE FOURNIS PAR L'UTILISATEUR ---\n";
    contents.forEach((doc, i) => {
      briefing += `\n[DOCUMENT #${i + 1}: ${doc.filename}]\n`;
      briefing += `TYPE: ${doc.mimetype}\n`;
      if (doc.pdfMeta?.code) {
        briefing += `PDF_STATUS: ${doc.pdfMeta.code}\n`;
      }
      if (doc.pdfMeta?.capability) {
        briefing += `${formatCapabilityBriefingBlock(doc.pdfMeta.capability)}\n`;
      }
      briefing += `CONTENU:\n${doc.content}\n`;
    });
    briefing += '\n------------------------------------------------------\n';

    return {
      briefing,
      documents: contents,
    };
  }
}

export default new ContextAgent();
