/**
 * MCP Bridge — connexion locale fail-closed aux serveurs MCP (Phase E).
 */
import fs from 'fs';
import path from 'path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'url';
import {
  executePrivilegedAction,
  mapMcpToolToAction,
  formatGateBlockedMessage,
} from '../hooks/privilegedActionGate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_MCP_SERVERS_DIR = path.join(
  path.resolve(__dirname, '../..'),
  'config/mcp/servers',
);

const REQUIRED_MANIFEST_FIELDS = ['name', 'version', 'tools'];

function normalizeTools(tools = []) {
  return tools.map((tool) => {
    if (typeof tool === 'string') return tool;
    if (tool && typeof tool.name === 'string') return tool.name;
    return null;
  }).filter(Boolean);
}

/**
 * @param {string|object} manifestOrPath
 */
export function validateMcpManifest(manifestOrPath) {
  let manifest;

  if (typeof manifestOrPath === 'string') {
    if (!fs.existsSync(manifestOrPath)) {
      throw new Error(`Manifest MCP introuvable : ${manifestOrPath}`);
    }
    manifest = JSON.parse(fs.readFileSync(manifestOrPath, 'utf-8'));
  } else {
    manifest = manifestOrPath;
  }

  const missing = REQUIRED_MANIFEST_FIELDS.filter((field) => !(field in manifest));
  if (missing.length > 0) {
    throw new Error(`Manifest MCP invalide: champs manquants ${missing.join(', ')}`);
  }

  const tools = normalizeTools(manifest.tools);
  if (tools.length === 0) {
    throw new Error('Manifest MCP invalide: tools vide');
  }

  return {
    valid: true,
    manifest: {
      ...manifest,
      tools,
    },
  };
}

/**
 * @param {string} serversDir
 */
export function registerMcpServers(serversDir = DEFAULT_MCP_SERVERS_DIR) {
  if (!fs.existsSync(serversDir)) {
    return [];
  }

  const registered = [];
  const serverFiles = fs
    .readdirSync(serversDir)
    .filter((file) => file.endsWith('.json'));

  for (const file of serverFiles) {
    const serverPath = path.join(serversDir, file);
    try {
      const { manifest } = validateMcpManifest(serverPath);
      registered.push({
        name: manifest.name,
        version: manifest.version,
        path: serverPath,
        tools: manifest.tools,
      });
    } catch (err) {
      console.warn(`[McpBridge] MCP server ${file} invalid: ${err.message}`);
    }
  }

  return registered;
}

/**
 * Connexion JSON-lines minimale à un script Node MCP local.
 * @param {string} serverPath
 * @param {object} [config]
 */
export function connectMcpServer(serverPath, config = {}) {
  if (!fs.existsSync(serverPath)) {
    throw new Error(`Serveur MCP introuvable : ${serverPath}`);
  }

  const mcpProcess = spawn(process.execPath, [serverPath], {
    cwd: path.dirname(serverPath),
    env: { ...process.env, ...config.env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let buffer = '';
  const pending = [];

  mcpProcess.stdout.on('data', (chunk) => {
    buffer += String(chunk);
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      const resolver = pending.shift();
      if (!resolver) continue;
      try {
        resolver.resolve(JSON.parse(line));
      } catch (err) {
        resolver.reject(err);
      }
    }
  });

  mcpProcess.stderr.on('data', (chunk) => {
    console.warn(`[McpBridge] stderr: ${String(chunk).trim()}`);
  });

  return {
    process: mcpProcess,
    send(message) {
      return new Promise((resolve, reject) => {
        pending.push({ resolve, reject });
        mcpProcess.stdin.write(`${JSON.stringify(message)}\n`, (err) => {
          if (err) reject(err);
        });
      });
    },
    close() {
      if (!mcpProcess.killed) {
        mcpProcess.kill();
      }
    },
  };
}

/**
 * @param {string} serverPath
 * @param {string} toolName
 * @param {object} args
 * @param {object} [config]
 */
export async function callMcpTool(serverPath, toolName, args = {}, config = {}) {
  const action = mapMcpToolToAction(toolName, args, {
    serverPath,
    sessionId: config.sessionId,
    source: 'mcp-bridge',
  });

  const gateOutcome = await executePrivilegedAction(action, async () => {
    const connection = connectMcpServer(serverPath, config);
    try {
      return await connection.send({
        type: 'tool_call',
        tool: toolName,
        arguments: args,
      });
    } finally {
      connection.close();
    }
  });

  if (!gateOutcome.success) {
    throw new Error(formatGateBlockedMessage(gateOutcome));
  }

  return gateOutcome.result;
}

export default connectMcpServer;
