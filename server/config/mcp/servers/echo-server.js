#!/usr/bin/env node
/**
 * Serveur MCP minimal pour tests locaux (echo JSON-lines).
 */
process.stdin.setEncoding('utf8');

let buffer = '';

process.stdin.on('data', (chunk) => {
  buffer += chunk;
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const message = JSON.parse(line);
      const response = {
        ok: true,
        tool: message.tool,
        echo: message.arguments || {},
      };
      process.stdout.write(`${JSON.stringify(response)}\n`);
    } catch (err) {
      process.stdout.write(`${JSON.stringify({ ok: false, error: err.message })}\n`);
    }
  }
});
