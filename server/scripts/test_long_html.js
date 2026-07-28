import axios from 'axios';
import { performance } from 'perf_hooks';

const ENDPOINT = 'http://localhost:3000/api/chat';
const QUERY = "Recommence proprement le fichier HTML de formation Teams 365, en utilisant le protocole de pause tous les 3 chapitres.";

async function runDiagnostic() {
  console.log("🚀 LANCEMENT DU TEST DE FLUX LONG (ADR-004)...");
  console.log(`Cible: ${ENDPOINT}`);
  console.log(`Demande: "${QUERY}"`);
  console.log("-----------------------------------------");

  const startTime = performance.now();
  let firstTokenTime = null;
  let totalTokens = 0;
  let resultText = "";

  try {
    const response = await axios({
      method: 'post',
      url: ENDPOINT,
      data: { 
        query: QUERY, // Corrigé : 'query' au lieu de 'message'
        sessionId: 'test-diagnostic-session',
        stream: true 
      },
      responseType: 'stream'
    });

    response.data.on('data', (chunk) => {
      const chunkStr = chunk.toString();
      const lines = chunkStr.split('\n');
      for (const line of lines) {
        if (line.trim().startsWith('data: ')) {
          if (!firstTokenTime) {
            firstTokenTime = performance.now();
            console.log(`📡 Premier token reçu en ${((firstTokenTime - startTime) / 1000).toFixed(2)}s (TTFT)`);
          }
          
          try {
            const jsonStr = line.trim().substring(6);
            if (!jsonStr) continue;
            const data = JSON.parse(jsonStr);
            if (data.token) {
              resultText += data.token;
              totalTokens++;
              if (totalTokens % 100 === 0) process.stdout.write('.');
            } else if (data.step) {
              console.log(`\n📍 Étape : ${data.step}`);
            }
          } catch (e) {
            // Ignorer les fragments JSON mal formés ou les messages vides
          }
        }
      }
    });

    response.data.on('end', () => {
      const endTime = performance.now();
      const durationSec = (endTime - startTime) / 1000;
      const tps = (totalTokens / ((endTime - (firstTokenTime || startTime)) / 1000)).toFixed(2);
      
      console.log("\n-----------------------------------------");
      console.log("📊 RÉSULTATS DU DIAGNOSTIC :");
      console.log(`- Modèle Cible: deepseek-r1:14b (via routage balistique)`);
      console.log(`- TTFT: ${firstTokenTime ? ((firstTokenTime - startTime) / 1000).toFixed(2) : "N/A"}s`);
      console.log(`- TPS: ${tps}`);
      console.log(`- Tokens générés: ${totalTokens}`);
      console.log(`- Longueur finale: ${resultText.length} caractères`);
      console.log(`- Durée totale: ${durationSec.toFixed(2)}s`);
      
      const hasPauseMarker = resultText.includes('[LIMITE DE LONGUEUR ATTEINTE]');
      console.log(`- Marqueur de pause présent: ${hasPauseMarker ? "OUI ✅" : "NON ❌"}`);
      
      if (hasPauseMarker) {
        console.log("\n✅ SUCCÈS : Le protocole de pause interactive a fonctionné.");
      } else if (resultText.length > 20000) {
        console.log("\n⚠️ ATTENTION : La réponse est longue mais le marqueur est absent.");
      } else {
        console.log("\nℹ️ INFO : La réponse était courte, le marqueur n'était pas nécessaire.");
      }
    });

  } catch (error) {
    console.error("❌ ERREUR LORS DU TEST :", error.message);
  }
}

runDiagnostic();
