import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import connectMcpServer, {
  callMcpTool,
  validateMcpManifest,
  registerMcpServers,
  DEFAULT_MCP_SERVERS_DIR,
} from '../src/mcp/mcp-bridge.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const echoServerPath = path.resolve(
  __dirname,
  '../config/mcp/servers/echo-server.js',
);

describe('mcp-bridge ESM', () => {
  it('exporte connectMcpServer comme fonction nommée', () => {
    assert.equal(typeof connectMcpServer, 'function');
  });

  it('exporte callMcpTool comme fonction nommée', () => {
    assert.equal(typeof callMcpTool, 'function');
  });

  it('valide un manifest MCP valide (objet)', () => {
    const result = validateMcpManifest({
      name: 'test-server',
      version: '1.0.0',
      tools: ['read', 'write'],
    });
    assert.equal(result.valid, true);
    assert.equal(result.manifest.name, 'test-server');
  });

  it('rejette un manifest MCP invalide', () => {
    assert.throws(
      () => validateMcpManifest({ name: 'test' }),
      /champs manquants/,
    );
  });

  it('registerMcpServers découvre citadelle-echo-mcp', () => {
    const registered = registerMcpServers(DEFAULT_MCP_SERVERS_DIR);
    assert.ok(registered.some((entry) => entry.name === 'citadelle-echo-mcp'));
  });

  it('callMcpTool communique avec echo-server.js', async () => {
    const result = await callMcpTool(echoServerPath, 'echo', { ping: true });
    assert.equal(result.ok, true);
    assert.equal(result.tool, 'echo');
    assert.deepEqual(result.echo, { ping: true });
  });

  it('valide un manifest depuis fichier temporaire', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-manifest-'));
    const manifestPath = path.join(tmpDir, 'server.json');
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({ name: 'tmp', version: '1.0.0', tools: ['ping'] }),
      'utf-8',
    );

    const result = validateMcpManifest(manifestPath);
    assert.equal(result.valid, true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
