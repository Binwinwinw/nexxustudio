/**
 * Politique de pacing visuel — réponses courtes ultra-rapides.
 * Mise en scène UI uniquement ; le backend reste à pleine vitesse.
 */
export const SHORT_REPLY_VISUAL_PACING = Object.freeze({
  CHAR_THRESHOLD: 120,
  MIN_MS: 350,
  MAX_MS: 600,
  FAST_BACKEND_MS: 200,
  STEPS: 5,
  TYPING_PLACEHOLDER: "● ● ●",
  PIPELINE_PATHS: new Set([
    "instant",
    "social_deterministic",
    "simple_fast",
    "micro_short_circuit",
  ]),
  EMIT_PATHS: new Set(["buffered", "http_fallback", "pipeline"]),
});

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function splitTextForVisualPacing(text, steps = SHORT_REPLY_VISUAL_PACING.STEPS) {
  const normalized = String(text || "");
  if (!normalized) return [];
  if (normalized.length <= steps) {
    return normalized.split("").reduce((acc, ch, i) => {
      acc.push(normalized.slice(0, i + 1));
      return acc;
    }, []);
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length <= steps) {
    const chunks = [];
    let built = "";
    for (const word of words) {
      built = built ? `${built} ${word}` : word;
      chunks.push(built);
    }
    return chunks;
  }

  const targetLen = Math.ceil(normalized.length / steps);
  const chunks = [];
  let i = 0;
  while (i < normalized.length) {
    let end = Math.min(i + targetLen, normalized.length);
    if (end < normalized.length) {
      const space = normalized.lastIndexOf(" ", end);
      if (space > i) end = space + 1;
    }
    chunks.push(normalized.slice(0, end));
    i = end;
  }
  return chunks.filter((chunk, idx) => idx === 0 || chunk !== chunks[idx - 1]);
}

export function shouldApplyShortReplyVisualPacing({
  text = "",
  pipelinePath = "",
  stats = null,
  deliveryMode = "",
  streamStartedAt = null,
} = {}) {
  const normalized = String(text || "").trim();
  if (!normalized || normalized.length > SHORT_REPLY_VISUAL_PACING.CHAR_THRESHOLD) {
    return false;
  }

  const totalMs =
    stats?.streamTotalMs ??
    (streamStartedAt != null ? Date.now() - streamStartedAt : null);

  if (totalMs != null && totalMs >= SHORT_REPLY_VISUAL_PACING.FAST_BACKEND_MS) {
    return false;
  }

  const path = String(pipelinePath || "").toLowerCase();
  const emitPath = String(stats?.emitPath || deliveryMode || "").toLowerCase();

  if (SHORT_REPLY_VISUAL_PACING.PIPELINE_PATHS.has(path)) return true;
  if (path.endsWith("_deterministic") || path.includes("short_circuit")) return true;
  if (SHORT_REPLY_VISUAL_PACING.EMIT_PATHS.has(emitPath)) return true;

  if (
    stats?.sseChunks >= 2 &&
    totalMs != null &&
    totalMs < SHORT_REPLY_VISUAL_PACING.FAST_BACKEND_MS
  ) {
    return true;
  }

  return false;
}

export function shouldHoldShortReplyDuringStream({
  chatDisplay = "",
  streamStartedAt = null,
  currentlyHolding = false,
} = {}) {
  const text = String(chatDisplay || "").trim();
  if (!text) return false;
  if (text.length > SHORT_REPLY_VISUAL_PACING.CHAR_THRESHOLD) return false;
  if (streamStartedAt == null) return currentlyHolding;
  const elapsed = Date.now() - streamStartedAt;
  if (elapsed >= SHORT_REPLY_VISUAL_PACING.FAST_BACKEND_MS) return false;
  return true;
}

export async function revealShortReplyWithPacing(
  fullText,
  onPartial,
  {
    minMs = SHORT_REPLY_VISUAL_PACING.MIN_MS,
    maxMs = SHORT_REPLY_VISUAL_PACING.MAX_MS,
    steps = SHORT_REPLY_VISUAL_PACING.STEPS,
    streamStartedAt = null,
  } = {},
) {
  const text = String(fullText || "");
  if (!text) {
    onPartial("");
    return;
  }

  const segments = splitTextForVisualPacing(text, steps);
  const elapsed = streamStartedAt != null ? Date.now() - streamStartedAt : 0;
  const targetMs = Math.min(
    maxMs,
    Math.max(
      minMs,
      minMs +
        (text.length / SHORT_REPLY_VISUAL_PACING.CHAR_THRESHOLD) *
          (maxMs - minMs) *
          0.25,
    ),
  );
  const budgetMs = Math.max(0, targetMs - elapsed);
  const stepDelay =
    segments.length > 1 ? Math.max(40, budgetMs / (segments.length - 1)) : 0;

  for (let i = 0; i < segments.length; i++) {
    onPartial(segments[i]);
    if (i < segments.length - 1) {
      await sleep(stepDelay);
    }
  }
}
