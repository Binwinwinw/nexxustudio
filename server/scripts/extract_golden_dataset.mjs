import fs from 'fs';
import path from 'path';

// Chemins
const SESSIONS_DIR = path.join(process.cwd(), 'server', 'state', 'sessions');
const OUTPUT_JSON = path.join(process.cwd(), 'citadelle-vault', 'Citadelle', '04-Operations', 'audits', 'golden_dataset.json');
const OUTPUT_CSV = path.join(process.cwd(), 'citadelle-vault', 'Citadelle', '04-Operations', 'audits', 'golden_dataset_preview.csv');

const MAX_SAMPLES = 100;

/**
 * Fonction de pseudo-anonymisation simple
 */
function pseudoAnonymize(text) {
  if (!text) return "";
  let anonymized = text;
  
  // Remplacer adresses IP
  anonymized = anonymized.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, "[IP_MASKED]");
  // Remplacer emails
  anonymized = anonymized.replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi, "[EMAIL_MASKED]");
  // Remplacer numéros de téléphone (format basique français)
  anonymized = anonymized.replace(/(?:(?:\+|00)33[\s.-]{0,3}(?:\(0\)[\s.-]{0,3})?|0)[1-9](?:(?:[\s.-]?\d{2}){4}|\d{2}(?:[\s.-]?\d{3}){2})\b/g, "[PHONE_MASKED]");
  // Chemins locaux absolus (C:\ ou /home/)
  anonymized = anonymized.replace(/([A-Za-z]:\\[\w\\]+)|(\/home\/[\w\/]+)|\/Users\/[\w\/]+/gi, "[PATH_MASKED]");

  return anonymized;
}

/**
 * Heuristique simple pour la détection d'anaphore
 */
function detectAnaphora(query) {
  const lowerQuery = query.toLowerCase();
  const anaphoraTokens = ["ça", "ce", "cet", "cette", "ces", "il", "elle", "ils", "elles", "le", "la", "les", "et"];
  const words = lowerQuery.split(/[\s,.'?!]+/);
  return words.some(w => anaphoraTokens.includes(w));
}

async function extract() {
  console.log("🔍 Extraction des logs de sessions locales...");
  
  if (!fs.existsSync(SESSIONS_DIR)) {
    console.error(`❌ Dossier des sessions introuvable: ${SESSIONS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));
  let dataset = [];

  for (const file of files) {
    const filePath = path.join(SESSIONS_DIR, file);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const session = JSON.parse(content);
      
      const sessionId = session.id || file.replace('.json', '');
      const messages = session.mentor?.messages || session.messages || [];

      for (let i = 0; i < messages.length; i++) {
        if (messages[i].role === 'user') {
          const rawQuery = messages[i].content;
          
          // Récupérer la réponse de l'assistant correspondante
          let assistantResponse = "";
          if (i + 1 < messages.length && messages[i+1].role === 'assistant') {
            assistantResponse = messages[i+1].content;
          }

          // Construire l'historique (2 derniers échanges = 4 messages max)
          let previousContext = [];
          const startIdx = Math.max(0, i - 4);
          for (let j = startIdx; j < i; j++) {
            previousContext.push({
              role: messages[j].role,
              content: pseudoAnonymize(messages[j].content)
            });
          }

          // Récupérer métadonnées si présentes
          const meta = messages[i].meta || {};
          const activeIntent = meta.intent || null;
          const latency = meta.ttft || meta.latency || null;
          const metadataAvailable = (activeIntent !== null || latency !== null);

          // Nettoyer la query et la réponse
          const cleanQuery = pseudoAnonymize(rawQuery);
          const cleanResponse = pseudoAnonymize(assistantResponse);

          dataset.push({
            session_id: sessionId,
            turn_index: i,
            timestamp: session.timestamp || Date.now(),
            source_file: file,
            raw_query: cleanQuery,
            previous_turn_context: previousContext,
            assistant_response: cleanResponse,
            active_intent: activeIntent,
            has_anaphora: detectAnaphora(cleanQuery),
            latency: latency,
            anonymized: true,
            metadata_available: metadataAvailable,
            needs_manual_label: true
          });
        }
      }
    } catch (err) {
      console.warn(`⚠️ Erreur lors du parsing de ${file} : ${err.message}`);
    }
  }

  // Trier par date décroissante (plus récent en premier) et limiter à MAX_SAMPLES
  dataset.sort((a, b) => b.timestamp - a.timestamp);
  dataset = dataset.slice(0, MAX_SAMPLES);

  // Génération du JSON
  const outputDir = path.dirname(OUTPUT_JSON);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(dataset, null, 2));
  console.log(`✅ Généré : ${OUTPUT_JSON} (${dataset.length} requêtes)`);

  // Génération du CSV Preview
  let csv = "session_id,turn_index,raw_query,has_anaphora,active_intent,latency,needs_manual_label\n";
  for (const row of dataset) {
    const escapedQuery = row.raw_query.replace(/"/g, '""').replace(/\n/g, ' ');
    csv += `"${row.session_id}",${row.turn_index},"${escapedQuery}",${row.has_anaphora},"${row.active_intent || ''}","${row.latency || ''}",${row.needs_manual_label}\n`;
  }
  
  fs.writeFileSync(OUTPUT_CSV, csv);
  console.log(`✅ Généré : ${OUTPUT_CSV}`);
}

extract().catch(console.error);
