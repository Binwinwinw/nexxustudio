
/**
 * Chunker - Service de fragmentation sémantique adaptatif pour La Citadelle.
 * Implémente le découpage hiérarchique et la propagation de contexte.
 */

class Chunker {
  /**
   * Point d'entrée principal pour le découpage adaptatif.
   */
  chunk(content, type = 'text', options = {}) {
    const maxChars = options.maxChars || 1500;
    const overlap = options.overlap || 200;
    const metadata = options.metadata || {};

    switch (type.toLowerCase()) {
      case 'markdown':
      case 'md':
        return this.adaptiveMarkdownSplit(content, maxChars, overlap, metadata);
      case 'yaml':
      case 'yml':
      case 'yaml-docker':
        return this.adaptiveYamlSplit(content, maxChars, metadata);
      case 'javascript':
      case 'js':
      case 'code':
        return this.adaptiveCodeSplit(content, maxChars, metadata);
      default:
        return this.recursiveCharacterSplit(content, { maxChars, overlap }).map((text, idx) => ({
          text,
          metadata: { ...metadata, chunk_id: idx + 1, total_chunks: 0 } // total_chunks sera mis à jour plus tard
        }));
    }
  }

  /**
   * Découpage Markdown avec propagation des en-têtes (H1 > H2 > H3)
   * On évite de découper à chaque titre si la section est petite.
   */
  adaptiveMarkdownSplit(content, maxChars, overlap, baseMetadata) {
    const lines = content.split('\n');
    const sections = [];
    let currentH1 = "", currentH2 = "", currentH3 = "";
    let accumulatedText = "";

    for (const line of lines) {
      const h1Match = line.match(/^# (.*)/);
      const h2Match = line.match(/^## (.*)/);
      const h3Match = line.match(/^### (.*)/);

      // Si on rencontre un titre et que le texte accumulé est déjà "conséquent", on split
      if ((h1Match || h2Match || h3Match) && accumulatedText.length > (maxChars * 0.7)) {
        sections.push({ text: accumulatedText.trim(), h1: currentH1, h2: currentH2, h3: currentH3 });
        accumulatedText = "";
      }

      if (h1Match) { currentH1 = h1Match[1]; currentH2 = ""; currentH3 = ""; }
      else if (h2Match) { currentH2 = h2Match[1]; currentH3 = ""; }
      else if (h3Match) { currentH3 = h3Match[1]; }
      
      accumulatedText += line + "\n";
    }
    
    if (accumulatedText.trim()) {
      sections.push({ text: accumulatedText.trim(), h1: currentH1, h2: currentH2, h3: currentH3 });
    }

    const finalChunks = [];
    for (const section of sections) {
      const subChunks = this.recursiveCharacterSplit(section.text, { maxChars, overlap });
      for (const text of subChunks) {
        // PROPAGATION SÉMANTIQUE
        const contextHeader = [section.h1, section.h2, section.h3].filter(Boolean).join(' > ');
        const textWithContext = contextHeader ? `[SECTION: ${contextHeader}]\n${text}` : text;
        
        finalChunks.push({
          text: textWithContext,
          metadata: {
            ...baseMetadata,
            h1: section.h1,
            h2: section.h2,
            h3: section.h3,
            section_type: 'markdown'
          }
        });
      }
    }
    return this.finalizeChunks(finalChunks);
  }

  /**
   * Découpage YAML intelligent (par clés de premier niveau)
   */
  adaptiveYamlSplit(content, maxChars, baseMetadata) {
    // Regex pour détecter les clés de premier niveau (services, volumes, etc.)
    const blocks = content.split(/\n(?=[a-zA-Z0-9_-]+:)/);
    const finalChunks = [];

    for (const block of blocks) {
      const firstLine = block.trim().split('\n')[0];
      const unitKey = firstLine.split(':')[0].trim();
      
      // Si le bloc est trop gros (ex: services:), on peut le découper par sous-clés (services individuels)
      if (block.length > maxChars && (unitKey === 'services' || unitKey === 'projects')) {
        const subBlocks = block.split(/\n  (?=[a-zA-Z0-9_-]+:)/); // Découpe par indentation de 2 espaces
        for (const sub of subBlocks) {
          // On garde le contexte parent (ex: "services:")
          const textWithContext = `${unitKey}:\n  ${sub.trim()}`;
          finalChunks.push({
            text: textWithContext,
            metadata: { ...baseMetadata, unit_type: unitKey, section_type: 'yaml' }
          });
        }
      } else {
        finalChunks.push({
          text: block.trim(),
          metadata: { ...baseMetadata, unit_type: unitKey, section_type: 'yaml' }
        });
      }
    }
    return this.finalizeChunks(finalChunks);
  }

  /**
   * Découpage de code par blocs logiques
   */
  adaptiveCodeSplit(content, maxChars, baseMetadata) {
    const blocks = content.split(/\n\s*\n/);
    const finalChunks = [];
    let currentText = "";

    for (const block of blocks) {
      if ((currentText.length + block.length) > maxChars && currentText.length > 0) {
        finalChunks.push({ text: currentText.trim(), metadata: { ...baseMetadata, section_type: 'code' } });
        currentText = block;
      } else {
        currentText += (currentText ? "\n\n" : "") + block;
      }
    }
    if (currentText.trim()) {
      finalChunks.push({ text: currentText.trim(), metadata: { ...baseMetadata, section_type: 'code' } });
    }
    return this.finalizeChunks(finalChunks);
  }

  /**
   * Algorithme de découpage récursif par caractères
   */
  recursiveCharacterSplit(text, options) {
    const { maxChars, overlap, separators = ["\n\n", "\n", ". ", " ", ""] } = options;
    
    if (text.length <= maxChars) return [text];

    let separator = separators[0];
    let selectedSeparator = "";
    for (const s of separators) {
      if (text.includes(s)) {
        selectedSeparator = s;
        break;
      }
    }

    const parts = text.split(selectedSeparator);
    const chunks = [];
    let currentChunk = "";

    for (const part of parts) {
      if ((currentChunk.length + part.length + selectedSeparator.length) > maxChars && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = part;
      } else {
        currentChunk += (currentChunk ? selectedSeparator : "") + part;
      }
    }
    if (currentChunk) chunks.push(currentChunk.trim());

    // Si un chunk est encore trop gros, on recommence récursivement avec le séparateur suivant
    const finalResult = [];
    for (const chunk of chunks) {
      if (chunk.length > maxChars && separators.length > 1) {
        finalResult.push(...this.recursiveCharacterSplit(chunk, { maxChars, overlap, separators: separators.slice(1) }));
      } else {
        finalResult.push(chunk);
      }
    }

    return finalResult;
  }

  /**
   * Ajoute chunk_id et total_chunks aux métadonnées finales
   */
  finalizeChunks(chunks) {
    const total = chunks.length;
    return chunks.map((c, i) => {
      c.metadata.chunk_id = i + 1;
      c.metadata.total_chunks = total;
      return c;
    });
  }
}

export default new Chunker();
