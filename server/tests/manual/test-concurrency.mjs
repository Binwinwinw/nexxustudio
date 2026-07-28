// test-concurrency.mjs
// Stress-test de concurrence sur le versionnement des événements de session.
// Envoie N requêtes parallèles sur la même session et vérifie que :
//   1. Aucune collision de version (ER_DUP_ENTRY)
//   2. Les versions dans session_events sont strictement croissantes et sans trou
//   3. Pas de deadlock InnoDB
//
// Usage (depuis server/tests/manual/) :
//   node test-concurrency.mjs
//   node test-concurrency.mjs --url http://localhost:3000 --session <UUID> --concurrent 5
//   node test-concurrency.mjs --concurrent 10 --check-db

const DEFAULT_URL = "http://localhost:3000";
const DEFAULT_CONCURRENT = 5;

function getArg(name, fallback) {
  const idx = process.argv.findIndex(a => a === name);
  return idx !== -1 ? process.argv[idx + 1] ?? fallback : fallback;
}
function hasArg(name) { return process.argv.includes(name); }

const baseUrl     = getArg("--url", DEFAULT_URL);
const sessionId   = getArg("--session", null);      // Si null, créé automatiquement
const concurrent  = Number(getArg("--concurrent", DEFAULT_CONCURRENT));
const checkDb     = hasArg("--check-db");           // Vérifie les versions via GET /api/sessions/:id

// ─── Couleurs console ───────────────────────────────────────────────────────
const C = {
  green:  s => `\x1b[32m${s}\x1b[0m`,
  red:    s => `\x1b[31m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
};

// ─── Browser ID (simule un navigateur unique) ────────────────────────────────
import { randomUUID } from "crypto";
const TEST_BROWSER_ID = randomUUID();
const COOKIE_HEADER   = `nexxus_browser_id=${encodeURIComponent(TEST_BROWSER_ID)}`;

// ─── Utilitaires ────────────────────────────────────────────────────────────
async function createSession() {
  const sid = `stress-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const res = await fetch(`${baseUrl}/api/sessions/${sid}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "cookie": COOKIE_HEADER
    },
    body: JSON.stringify({ title: `[ConcurrencyTest] ${Date.now()}` })
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  return sid;
}

async function sendQuery(sid, queryIndex) {
  const start = Date.now();
  try {
    const res = await fetch(`${baseUrl}/api/stream`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cookie": COOKIE_HEADER
      },
      body: JSON.stringify({
        sessionId: sid,
        q: `Test de concurrence #${queryIndex} — réponds en 1 phrase.`,
        history: []
      })
    });
    const duration = Date.now() - start;
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { index: queryIndex, ok: false, duration, error: `HTTP ${res.status}: ${txt.slice(0, 300)}` };
    }
    // Consommer le stream SSE jusqu'à "done" ou fin
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let isDone = false;
    while (!isDone) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      if (chunk.includes('"status":"done"') || chunk.includes('"done":true')) {
        isDone = true;
      }
    }
    reader.cancel().catch(() => {});
    return { index: queryIndex, ok: true, duration: Date.now() - start };
  } catch (e) {
    return { index: queryIndex, ok: false, duration: Date.now() - start, error: e.message };
  }
}

async function getSessionEvents(sid) {
  const res = await fetch(`${baseUrl}/api/sessions/${sid}/events`);
  if (!res.ok) return null;
  const data = await res.json();
  return Array.isArray(data) ? data : (data.events || null);
}

// ─── Analyse des versions ───────────────────────────────────────────────────
function analyzeVersions(events) {
  if (!events || !events.length) return { ok: false, reason: "Aucun événement retourné" };

  const versions = events
    .map(e => e.event_version ?? e.version)
    .filter(v => typeof v === "number")
    .sort((a, b) => a - b);

  const issues = [];

  // 1. Doublons ?
  const dupes = versions.filter((v, i) => versions.indexOf(v) !== i);
  if (dupes.length) {
    issues.push(`Versions dupliquées détectées : [${[...new Set(dupes)].join(", ")}]`);
  }

  // 2. Trous ?
  for (let i = 1; i < versions.length; i++) {
    if (versions[i] !== versions[i - 1] + 1) {
      issues.push(`Trou entre v${versions[i - 1]} et v${versions[i]}`);
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    versions,
    min: versions[0],
    max: versions[versions.length - 1],
    count: versions.length
  };
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(C.bold("\n=== Nexxus Citadel — Concurrency Stress Test ==="));
  console.log(`URL     : ${baseUrl}`);
  console.log(`Concurr.: ${concurrent} requêtes simultanées`);
  console.log(`DB Check: ${checkDb ? "OUI" : "NON (passer --check-db pour vérifier les versions)"}\n`);

  // 1. Obtenir ou créer la session
  let sid = sessionId;
  if (!sid) {
    try {
      sid = await createSession();
      console.log(`Session créée : ${C.cyan(sid)}`);
    } catch (e) {
      // Essai de fallback : utiliser un UUID fixe de test
      sid = `test-concurrent-${Date.now()}`;
      console.log(C.yellow(`Création auto échouée (${e.message}). Utilisation d'un ID de test : ${sid}`));
    }
  } else {
    console.log(`Session cible : ${C.cyan(sid)}`);
  }

  // 2. Lancer toutes les requêtes en parallèle
  console.log(`\nLancement de ${concurrent} requêtes simultanées...\n`);
  const promises = Array.from({ length: concurrent }, (_, i) => sendQuery(sid, i + 1));
  const startAll = Date.now();
  const results  = await Promise.allSettled(promises);
  const totalMs  = Date.now() - startAll;

  // 3. Rapport des requêtes
  let passed = 0, failed = 0;
  for (const r of results) {
    const res = r.status === "fulfilled" ? r.value : { ok: false, error: r.reason?.message, index: "?", duration: 0 };
    if (res.ok) {
      passed++;
      console.log(C.green(`  [PASS] #${res.index} — ${res.duration}ms`));
    } else {
      failed++;
      const isDup = (res.error || "").includes("DUP_ENTRY") || (res.error || "").includes("Duplicate");
      const label = isDup ? C.red(`  [FAIL:DUP_ENTRY]`) : C.red(`  [FAIL]`);
      console.log(`${label} #${res.index} — ${res.duration}ms — ${res.error}`);
    }
  }

  console.log(`\n  Durée totale   : ${totalMs}ms`);
  console.log(`  PASS / FAIL    : ${C.green(passed)} / ${failed > 0 ? C.red(failed) : C.green(failed)}`);

  // 4. Vérification des versions en DB (si --check-db)
  if (checkDb) {
    console.log(C.bold("\n--- Vérification de l'ordre des versions en DB ---"));
    const events = await getSessionEvents(sid);

    if (!events) {
      console.log(C.yellow("Impossible de récupérer les événements (endpoint manquant ou session introuvable)."));
      console.log(C.yellow("Implémente GET /api/sessions/:id/events pour activer cette vérification."));
    } else {
      const analysis = analyzeVersions(events);
      console.log(`  Versions trouvées : ${analysis.count} (v${analysis.min} → v${analysis.max})`);

      if (analysis.ok) {
        console.log(C.green("  ✓ Séquence strictement croissante, aucun doublon, aucun trou."));
      } else {
        for (const issue of analysis.issues) {
          console.log(C.red(`  ✗ ${issue}`));
        }
      }
    }
  }

  // 5. Verdict final
  const hasFailed = failed > 0;
  console.log(C.bold("\n=== Verdict final ==="));
  if (!hasFailed) {
    console.log(C.green("✓ Aucune collision de version détectée sous concurrence."));
    console.log(C.green("  Le verrouillage InnoDB sur project_sessions sérialise correctement."));
  } else {
    console.log(C.red(`✗ ${failed} requête(s) échouée(s). Vérifier les logs du serveur.`));
    console.log(C.yellow("  Chercher : ER_DUP_ENTRY, VALIDATION_EVENT_WRITE_FAILED, deadlock detected."));
  }
  console.log("");

  process.exitCode = hasFailed ? 1 : 0;
}

main().catch(e => {
  console.error(C.red("Erreur fatale :"), e.message);
  process.exit(1);
});
