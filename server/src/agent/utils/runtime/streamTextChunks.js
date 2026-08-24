/**
 * Émission de texte par petits chunks pour alimenter le SSE / onContent.
 * Les réponses buffered_final passent ici pour un rendu progressif agréable.
 */
export const DEFAULT_STREAM_CHUNK_SIZE = 28;
export const LARGE_PAYLOAD_THRESHOLD = 48;

export function emitTextChunks(text = "", onChunk, chunkSize = DEFAULT_STREAM_CHUNK_SIZE) {
  if (!onChunk || !text) return;
  const normalized = String(text);
  for (let i = 0; i < normalized.length; i += chunkSize) {
    onChunk(normalized.slice(i, i + chunkSize));
  }
}

/** Découpe aux espaces quand possible — plus lisible que des tranches brutes. */
export function emitTextChunksSmooth(text = "", onChunk, targetSize = DEFAULT_STREAM_CHUNK_SIZE) {
  if (!onChunk || !text) return;
  const normalized = String(text);
  let i = 0;
  while (i < normalized.length) {
    let end = Math.min(i + targetSize, normalized.length);
    if (end < normalized.length) {
      const slice = normalized.slice(i, end);
      const lastSpace = slice.lastIndexOf(" ");
      const lastNewline = slice.lastIndexOf("\n");
      const breakAt = Math.max(lastSpace, lastNewline);
      if (breakAt > targetSize * 0.35) {
        end = i + breakAt + 1;
      }
    }
    onChunk(normalized.slice(i, end));
    i = end;
  }
}

/** Panels numérotés — un seul chunk évite une UI tronquée mid-liste. */
export function isStructuredListReply(text = "") {
  const t = String(text || "");
  return (
    /\n\s*\d+[).]\s+\S/.test(t) ||
    /\n\s*[-*·]\s+\S/.test(t) ||
    /\bChoisis un num[eé]ro\b/i.test(t)
  );
}

/** Route onContent : petit fragment tel quel, gros bloc découpé. */
export function emitOnContent(text, onContent, options = {}) {
  if (!onContent || text == null || text === "") return;
  const normalized = String(text);
  const threshold = options.threshold ?? LARGE_PAYLOAD_THRESHOLD;
  const chunkSize = options.chunkSize ?? DEFAULT_STREAM_CHUNK_SIZE;
  if (normalized.length <= threshold || isStructuredListReply(normalized)) {
    onContent(normalized);
    return;
  }
  emitTextChunksSmooth(normalized, onContent, chunkSize);
}
