
import fs from 'fs/promises';

/**
 * CodeParser - L'analyste de l'Assistant Nexxus.
 * Extrait les fonctions, classes, routes et symboles clés du code source.
 */
class CodeParser {
  /**
   * Analyse un fichier et extrait des blocs structurés
   */
  async parse(filePath, absolutePath, language) {
    const content = await fs.readFile(absolutePath, 'utf8');
    const chunks = [];

    if (language === '.js' || language === '.jsx' || language === '.ts' || language === '.tsx') {
      this.extractJS(content, chunks, filePath);
    } else if (language === '.md') {
      this.extractMarkdown(content, chunks, filePath);
    } else {
      // Fallback: simple chunking par paragraphe
      this.extractGeneric(content, chunks, filePath);
    }

    return chunks;
  }

  extractJS(content, chunks, filePath) {
    const lines = content.split('\n');
    const blocks = [];
    
    // Détection élargie : supporte React components, exports, et fonctions fléchées avec types
    const signatureRegex = /^(?:export\s+)?(?:async\s+)?(?:function\s+|class\s+|const\s+[a-zA-Z0-9_]+\s*(?::\s*[^=]+)?\s*=\s*(?:async\s+)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>|\w+\.(?:get|post|put|delete)\()/;

    let currentBlock = null;

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (signatureRegex.test(trimmed) && trimmed.length > 5) {
        if (currentBlock && currentBlock.lines.length > 5) {
          currentBlock.endLine = index;
          blocks.push(currentBlock);
        }
        currentBlock = {
          symbol: trimmed.substring(0, 80),
          startLine: index + 1,
          lines: [line]
        };
      } else if (currentBlock) {
        currentBlock.lines.push(line);
      }
    });

    if (currentBlock) {
      currentBlock.endLine = lines.length;
      blocks.push(currentBlock);
    }

    // Sécurité : Si un bloc est trop gros (> 100 lignes), on le recoupe
    const MAX_CHUNK_LINES = 100;
    
    blocks.forEach(block => {
      if (block.lines.length > MAX_CHUNK_LINES) {
        for (let i = 0; i < block.lines.length; i += MAX_CHUNK_LINES) {
          const slice = block.lines.slice(i, i + MAX_CHUNK_LINES);
          chunks.push({
            kind: 'logic_block_part',
            symbol: `${block.symbol} (part ${Math.floor(i/MAX_CHUNK_LINES) + 1})`,
            startLine: block.startLine + i,
            endLine: block.startLine + i + slice.length,
            text: slice.join('\n'),
            path: filePath
          });
        }
      } else {
        chunks.push({
          kind: 'logic_block',
          symbol: block.symbol,
          startLine: block.startLine,
          endLine: block.endLine,
          text: block.lines.join('\n'),
          path: filePath
        });
      }
    });

    // Si aucun bloc, ou fichier court, fallback simple
    if (chunks.length === 0) {
      this.extractGeneric(content, chunks, filePath);
    }
  }

  extractMarkdown(content, chunks, filePath) {
    const sections = content.split(/^#+\s+/m);
    sections.forEach((section, index) => {
      if (!section.trim()) return;
      const title = section.split('\n')[0].trim();
      chunks.push({
        kind: 'doc_section',
        symbol: title,
        text: section,
        path: filePath
      });
    });
  }

  extractGeneric(content, chunks, filePath) {
    chunks.push({
      kind: 'text',
      symbol: 'content',
      text: content.substring(0, 5000),
      path: filePath
    });
  }
}

export default new CodeParser();
