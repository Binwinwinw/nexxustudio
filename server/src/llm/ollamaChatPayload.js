/**
 * Payload /api/chat natif Ollama.
 * `think` est un champ top-level, jamais dans options.
 */

export function stripThinkOption(options = {}) {
  const { think, ...rest } = options;
  return { think, rest };
}

export function buildNativeOllamaChatPayload({
  model,
  messages,
  stream = false,
  keepAlive,
  chatOptions,
  think,
} = {}) {
  const payload = {
    model,
    messages,
    stream: Boolean(stream),
    options: chatOptions,
  };
  if (keepAlive !== undefined) payload.keep_alive = keepAlive;
  if (think === true || think === false) payload.think = think;
  return payload;
}

/** Loggable : pas de messages, pas de contenu. */
export function summarizeOllamaChatPayload(payload = {}) {
  return {
    endpoint: "/api/chat",
    model: payload.model || null,
    stream: Boolean(payload.stream),
    think: Object.prototype.hasOwnProperty.call(payload, "think")
      ? payload.think
      : null,
    keep_alive: payload.keep_alive ?? null,
    options_keys: Object.keys(payload.options || {}),
    message_count: Array.isArray(payload.messages) ? payload.messages.length : 0,
  };
}
