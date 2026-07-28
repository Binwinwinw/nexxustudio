import axios from 'axios';
import { performance } from 'perf_hooks';

const ENDPOINT = 'http://localhost:3000/api/chat';
const QUERY = "Nexxus, génère le fichier HTML complet de la formation Teams 365 (plan révisé avec Copilot, 12 slides, skill slides), en utilisant ADR-004 pour la segmentation longue et ADR-005 pour respecter la zone forge/noyau. Commence par le slide 1 et pause après 3 chapitres.";

async function runSotaTest() {
  console.log("🚀 LANCEMENT DU TEST SOTA (GOUVERNANCE FLUX LONGS)...");
  console.log(`Requête: "${QUERY}"`);
  console.log("--------------------------------------------------");

  let sessionContext = {
    history: [],
    sessionId: `sota-test-${Date.now()}`,
    cookies: []
  };

  async function sendRequest(msg) {
    const startTime = performance.now();
    let firstTokenTime = null;
    let totalTokens = 0;
    let fullText = "";
    let isPaused = false;

    console.log(`\n📡 Envoi du segment... (Message: "${msg}")`);

    try {
      const response = await axios({
        method: 'post',
        url: ENDPOINT,
        data: { 
          query: msg,
          history: sessionContext.history,
          sessionId: sessionContext.sessionId,
          stream: true 
        },
        headers: {
          'Cookie': sessionContext.cookies.join('; ')
        },
        responseType: 'stream'
      });

      // Capturer les nouveaux cookies
      const setCookie = response.headers['set-cookie'];
      if (setCookie) {
        sessionContext.cookies = setCookie.map(c => c.split(';')[0]);
      }

      return new Promise((resolve) => {
        response.data.on('data', (chunk) => {
          const lines = chunk.toString().split('\n');
          for (const line of lines) {
            if (line.trim().startsWith('data: ')) {
              if (!firstTokenTime) firstTokenTime = performance.now();
              try {
                const data = JSON.parse(line.trim().substring(6));
                if (data.token) {
                  fullText += data.token;
                  totalTokens++;
                  if (totalTokens % 100 === 0) process.stdout.write('.');
                }
              } catch (e) {}
            }
          }
        });

        response.data.on('end', () => {
          const endTime = performance.now();
          const ttft = firstTokenTime ? ((firstTokenTime - startTime) / 1000).toFixed(2) : "N/A";
          const tps = (totalTokens / ((endTime - (firstTokenTime || startTime)) / 1000)).toFixed(2);
          
          console.log(`\n✅ Segment terminé | Tokens: ${totalTokens} | TTFT: ${ttft}s | TPS: ${tps}`);
          
          // Détection du marqueur de pause
          if (fullText.includes('[LIMITE DE LONGUEUR ATTEINTE]')) {
            isPaused = true;
            console.log("⚠️ PAUSE DÉTECTÉE : Le protocole a fonctionné.");
          }

          // Mise à jour de l'historique pour la suite
          sessionContext.history.push({ role: 'user', content: msg });
          sessionContext.history.push({ role: 'assistant', content: fullText });

          resolve({ fullText, isPaused });
        });
      });
    } catch (error) {
      console.error("❌ ERREUR SEGMENT :", error.message);
      return { fullText: "", isPaused: false };
    }
  }

  // Premier segment
  const segment1 = await sendRequest(QUERY);

  // Si pause détectée, on lance le relais automatique
  if (segment1.isPaused) {
    console.log("\n🔄 RELAIS DE CONTINUITÉ AUTOMATIQUE : Envoi de 'Oui'...");
    const segment2 = await sendRequest("Oui, donne-moi la suite.");
    
    console.log("\n--------------------------------------------------");
    console.log("📊 VALIDATION DU RELAIS :");
    const hasDuplication = segment2.fullText.includes('<!DOCTYPE html>') || segment2.fullText.includes('<head>');
    console.log(`- Absence de duplication (head/style): ${!hasDuplication ? "OUI ✅" : "NON ❌"}`);
    console.log(`- Continuité structurelle: ${segment2.fullText.startsWith(' ') || segment2.fullText.startsWith('\n') || segment2.fullText.includes('<div') ? "OUI ✅" : "VÉRIFIER ⚠️"}`);
    console.log(`- Longueur totale finale: ${segment1.fullText.length + segment2.fullText.length} caractères`);
  } else {
    console.log("\nℹ️ INFO : Pas de pause nécessaire sur ce segment.");
  }
}

runSotaTest();
