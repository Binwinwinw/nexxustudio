
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';

/**
 * Performance Benchmark - Mesure de Latence et Débit (Nexxus 3.0)
 */

const TEST_QUERIES = [
  "Qui est Nexxus ?",
  "Quelles sont les capacités de La Citadelle ?",
  "Comment optimiser l'usage des agents IA et du RAG ?"
];

const SERVER_URL = "http://localhost:3000/api/stream";

async function runPerfTest() {
  console.log("🚀 Lancement du Benchmark de Performance (Nexxus 3.0)...");
  console.log("-------------------------------------------------------");

  for (const query of TEST_QUERIES) {
    console.log(`\n[Test] Query: "${query}"`);
    
    const start = Date.now();
    let ttft = 0;
    let tokens = 0;
    let firstTokenTime = 0;

    try {
      const response = await axios.post(SERVER_URL, {
        q: query,
        history: [],
        sessionId: "perf-test-" + Date.now()
      }, {
        responseType: 'stream'
      });

      await new Promise((resolve, reject) => {
        response.data.on('data', (chunk) => {
          const lines = chunk.toString().split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const json = JSON.parse(line.slice(6));
                if (json.token || json.content) {
                  if (!firstTokenTime) {
                    firstTokenTime = Date.now();
                    ttft = firstTokenTime - start;
                  }
                  tokens++;
                }
              } catch (e) {
                // Ignore incomplete JSON
              }
            }
          }
        });

        response.data.on('end', resolve);
        response.data.on('error', reject);
      });

      const totalDuration = Date.now() - start;
      const generationDuration = totalDuration - ttft;
      const tps = generationDuration > 0 ? (tokens / (generationDuration / 1000)) : 0;

      console.log(`  ⏱️  TTFT (Temps 1er Token) : ${ttft}ms`);
      console.log(`  ⏱️  Temps Total           : ${totalDuration}ms`);
      console.log(`  📊 Débit (TPS estimé)     : ${tps.toFixed(2)} tokens/s`);
      console.log(`  📝 Volume                 : ${tokens} tokens`);
      
    } catch (err) {
      console.error(`  ❌ Erreur sur "${query}":`, err.message);
    }
  }

  console.log("\n-------------------------------------------------------");
  console.log("🏁 Benchmark terminé.");
}

runPerfTest();
