/* server/src/scripts/smoke-test.js */
import http from 'http';

const SERVICES = [
  { name: 'Nexxus Core (Node)', url: 'http://localhost:3000/api/health/live', type: 'json' },
  { name: 'Ollama (IA)', url: 'http://localhost:11434/api/tags', type: 'json' },
  { name: 'AirLLM Optimizer', url: 'http://localhost:11436/api/health', type: 'json' },
  { name: 'Creative Server', url: 'http://localhost:11437/health', type: 'json' }
];

async function checkService(service) {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = http.get(service.url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const duration = Date.now() - start;
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ name: service.name, status: '🟢 ONLINE', duration: `${duration}ms`, info: 'OK' });
        } else {
          resolve({ name: service.name, status: '🟠 ERROR', duration: `${duration}ms`, info: `HTTP ${res.statusCode}` });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ name: service.name, status: '🔴 OFFLINE', duration: '-', info: err.message });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ name: service.name, status: '🔴 TIMEOUT', duration: '5000ms', info: 'No response' });
    });
  });
}

async function run() {
  console.log('\n--- 🛡️ NEXXUS CITADEL SYSTEM INTEGRITY CHECK ---');
  console.log(`Date: ${new Date().toLocaleString()}\n`);

  const results = await Promise.all(SERVICES.map(checkService));

  console.table(results.map(r => ({
    'Service': r.name,
    'Status': r.status,
    'Latency': r.duration,
    'Details': r.info
  })));

  const allOnline = results.every(r => r.status === '🟢 ONLINE');
  if (allOnline) {
    console.log('\n✅ TOUS LES SYSTÈMES SONT OPÉRATIONNELS.\n');
    process.exit(0);
  } else {
    console.log('\n⚠️ ALERTE : CERTAINS SERVICES SONT INDISPONIBLES OU EN ERREUR.\n');
    process.exit(1);
  }
}

run();
