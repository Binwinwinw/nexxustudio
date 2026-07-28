/* server/scripts/smac_stress_test.js */
import axios from 'axios';

const ENDPOINT = 'http://localhost:3000/api/smac/arbitrate';
const DURATION_MS = 15 * 60 * 1000; // 15 minutes
const TARGET_REQUESTS = 5;
const CONCURRENCY = 1; // Nombre de requêtes simultanées (Ajusté pour GPU local)

const TEST_QUERIES = [
  "Comment structurer la table 'progress' sur Supabase ?",
  "Quelle est la meilleure approche pour le routing Node.js ?",
  "Explique le pattern SMAC en 3 points.",
  "Comment gérer l'authentification OAuth2 ?",
  "Quels sont les risques de sécurité d'un RAG ?"
];

async function runTest() {
  console.log("🚀 LANCEMENT DU TEST DE CHARGE SMAC...");
  console.log(`Cible: ${TARGET_REQUESTS} requêtes en ${DURATION_MS / 60000} minutes.`);
  console.log(`Parallélisme: ${CONCURRENCY} agents de test.`);
  console.log("-----------------------------------------");

  const startTime = Date.now();
  let completed = 0;
  let failed = 0;
  let latencies = [];
  let consensusScores = [];

  async function worker() {
    while (Date.now() - startTime < DURATION_MS && completed + failed < TARGET_REQUESTS) {
      const query = TEST_QUERIES[Math.floor(Math.random() * TEST_QUERIES.length)];
      
      try {
        const startReq = Date.now();
        const response = await axios.post(ENDPOINT, { query }, { 
          timeout: 300000,
          headers: { 'X-API-Token': process.env.INTERNAL_API_TOKEN || 'local_test' }
        });
        const duration = Date.now() - startReq;
        
        latencies.push(duration);
        consensusScores.push(parseFloat(response.data.consensus.score));
        completed++;

        if (completed % 10 === 0) {
          console.log(`[PROGRESS] ${completed}/${TARGET_REQUESTS} | Score moyen: ${(consensusScores.reduce((a,b)=>a+b,0)/consensusScores.length).toFixed(3)} | Latence p50: ${getPercentile(latencies, 50)}ms`);
        }
      } catch (err) {
        failed++;
        console.error(`[ERROR] Requête échouée: ${err.message}`);
      }
    }
  }

  // Lancer les workers
  const workers = Array(CONCURRENCY).fill(0).map(() => worker());
  await Promise.all(workers);

  const totalTime = (Date.now() - startTime) / 1000;
  printSummary(completed, failed, latencies, consensusScores, totalTime);
}

function getPercentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[index];
}

function printSummary(completed, failed, latencies, scores, time) {
  console.log("\n=========================================");
  console.log("🏁 RAPPORT DE TEST DE CHARGE SMAC");
  console.log("=========================================");
  console.log(`Durée totale: ${time.toFixed(2)}s`);
  console.log(`Requêtes réussies: ${completed}`);
  console.log(`Requêtes échouées: ${failed}`);
  console.log(`Débit: ${(completed / time).toFixed(2)} req/s`);
  console.log("-----------------------------------------");
  console.log(`Latence p50: ${getPercentile(latencies, 50)}ms`);
  console.log(`Latence p95: ${getPercentile(latencies, 95)}ms`);
  console.log(`Latence p99: ${getPercentile(latencies, 99)}ms`);
  console.log("-----------------------------------------");
  console.log(`Consensus Moyen: ${(scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(3)}`);
  console.log("=========================================\n");
}

runTest().catch(console.error);
