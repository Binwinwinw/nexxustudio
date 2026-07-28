#!/usr/bin/env node
/**
 * Bootstrap Citadelle — one machine / one command / one health check (M1-S2).
 *
 * Usage:
 *   node scripts/bootstrap-citadelle.mjs
 *   node scripts/bootstrap-citadelle.mjs --fast --start-server
 *   node scripts/bootstrap-citadelle.mjs --no-start --timeout-warmup 180
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(SERVER_ROOT, '..');

const args = process.argv.slice(2);
const flags = {
  fast: args.includes('--fast'),
  startServer: args.includes('--start-server'),
  noStart: args.includes('--no-start'),
  strict: args.includes('--strict'),
  skipReady: args.includes('--skip-ready'),
};

const port = Number(
  args.find((a) => a.startsWith('--port='))?.split('=')[1] ||
    process.env.PORT ||
    3000,
);
const warmupTimeoutMs = Number(
  args.find((a) => a.startsWith('--timeout-warmup='))?.split('=')[1] ||
    180000,
);
const baseUrl = `http://127.0.0.1:${port}`;

function log(step, message) {
  console.log(`[bootstrap] ${step} — ${message}`);
}

function fail(message, traceId = null) {
  console.error(`\n✗ BOOTSTRAP ÉCHEC — ${message}`);
  if (traceId) console.error(`  trace_id: ${traceId}`);
  process.exit(1);
}

function ok(message, traceId = null) {
  console.log(`\n✓ BOOTSTRAP OK — ${message}`);
  if (traceId) console.log(`  trace_id: ${traceId}`);
  process.exit(0);
}

function fetchJson(url, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: body ? JSON.parse(body) : {},
          });
        } catch (error) {
          reject(new Error(`JSON invalide (${url}): ${error.message}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`Timeout ${url}`));
    });
  });
}

async function waitForProbe(pathname, label, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastBody = null;

  while (Date.now() < deadline) {
    try {
      const result = await fetchJson(`${baseUrl}${pathname}`, 4000);
      lastBody = result.body;
      if (result.status === 200 && result.body?.status !== 'not_ready') {
        return result.body;
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  fail(
    `${label} non atteint avant ${Math.round(timeoutMs / 1000)}s`,
    lastBody?.trace_id || lastBody?.boot_trace_id || null,
  );
}

function checkNodeVersion() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 18) {
    fail(`Node.js >= 18 requis (actuel: ${process.versions.node})`);
  }
  log('node', `v${process.versions.node}`);
}

function checkEnvFile() {
  const envPath = path.join(SERVER_ROOT, '.env');
  const examplePath = path.join(SERVER_ROOT, '.env.example');
  if (fs.existsSync(envPath)) {
    log('env', '.env présent');
    return;
  }
  if (fs.existsSync(examplePath)) {
    log('env', '⚠ .env absent — copiez server/.env.example vers server/.env');
    if (flags.strict) fail('.env manquant (mode --strict)');
  } else {
    log('env', '⚠ aucun .env.example trouvé');
  }
}

function normalizeOllamaHost(host) {
  if (!host) return 'http://127.0.0.1:11434';
  if (host.startsWith('http://') || host.startsWith('https://')) return host;
  return `http://${host}`;
}

async function checkOllama() {
  const host = normalizeOllamaHost(process.env.OLLAMA_HOST);
  try {
    const result = await fetchJson(`${host}/api/tags`, 4000);
    if (result.status >= 200 && result.status < 300) {
      log('ollama', `joignable (${host})`);
      return;
    }
  } catch (error) {
    if (flags.strict) fail(`Ollama injoignable: ${error.message}`);
    log('ollama', `⚠ injoignable (${error.message}) — warmup peut échouer`);
  }
}

async function isServerUp() {
  try {
    const result = await fetchJson(`${baseUrl}/api/health/live`, 2500);
    return result.status === 200;
  } catch {
    return false;
  }
}

function startServerDetached() {
  const env = {
    ...process.env,
    PORT: String(port),
    OLLAMA_BOOT_PROFILE: flags.fast ? 'fast' : process.env.OLLAMA_BOOT_PROFILE || 'reactive',
  };

  const child = spawn(process.execPath, ['index.js'], {
    cwd: SERVER_ROOT,
    env,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  log('server', `processus lancé (pid ${child.pid}, profile=${env.OLLAMA_BOOT_PROFILE})`);
}

async function ensureDependencies() {
  const nodeModules = path.join(SERVER_ROOT, 'node_modules');
  if (fs.existsSync(nodeModules)) {
    log('deps', 'server/node_modules OK');
    return;
  }
  log('deps', 'installation npm dans server/…');
  await new Promise((resolve, reject) => {
    const npm = spawn('npm', ['install'], {
      cwd: SERVER_ROOT,
      stdio: 'inherit',
      shell: true,
    });
    npm.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`npm install exit ${code}`))));
  });
}

async function main() {
  console.log('\n=== Bootstrap Citadelle (M1-S2) ===\n');
  console.log(`Repo: ${REPO_ROOT}`);
  console.log(`API:  ${baseUrl}\n`);

  checkNodeVersion();
  checkEnvFile();
  await ensureDependencies();
  await checkOllama();

  const alreadyUp = await isServerUp();
  if (alreadyUp) {
    log('server', 'déjà en ligne');
  } else if (flags.noStart) {
    fail('serveur absent (--no-start actif)');
  } else if (flags.startServer) {
    startServerDetached();
    await waitForProbe('/api/health/live', 'live', 30000);
  } else {
    fail(
      'serveur absent — lancez `cd server && npm run dev` ou ajoutez --start-server',
    );
  }

  const live = await fetchJson(`${baseUrl}/api/health/live`);
  log('live', `HTTP ${live.status} — uptime ${live.body?.uptime_s ?? '?'}s`);

  const startup = await waitForProbe(
    '/api/health/startup',
    'startup',
    warmupTimeoutMs,
  );
  log(
    'startup',
    `HTTP 200 — phase warmup=${startup.warmup_phase} trace=${startup.trace_id}`,
  );

  if (!flags.skipReady) {
    const ready = await waitForProbe('/api/health/ready', 'ready', 30000);
    log(
      'ready',
      `HTTP 200 — knowledge_hub=${ready.knowledge_hub} trace=${ready.trace_id}`,
    );
  }

  let diagnostics = null;
  try {
    const diag = await fetchJson(`${baseUrl}/api/bootstrap/diagnostics`);
    diagnostics = diag.body;
  } catch {
    /* optional */
  }

  const traceId =
    startup.trace_id ||
    live.body?.trace_id ||
    diagnostics?.boot_trace_id ||
    null;

  ok('La Citadelle est prête pour l’exploitation locale.', traceId);
}

main().catch((error) => {
  fail(error.message || String(error));
});
