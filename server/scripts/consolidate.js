import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { memoryOrchestrator } from '../src/agent/memory/MemoryOrchestrator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRAFTS_DIR = path.join(__dirname, '../data/memory/drafts');

async function run() {
  console.log(`\n🚀 [NEXXUS MEMORY CONSOLE] - Orchestrateur de Consolidation v1.0`);
  console.log(`----------------------------------------------------------`);

  try {
    const files = await fs.readdir(DRAFTS_DIR);
    const drafts = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = JSON.parse(await fs.readFile(path.join(DRAFTS_DIR, file), 'utf8'));
        drafts.push(content);
      }
    }

    if (drafts.length === 0) {
      console.log(`✅ Dossier drafts/ vide. Aucun incident en attente de revue.`);
      return;
    }

    console.log(`📦 [${drafts.length}] incident(s) détecté(s) dans la zone tampon.\n`);

    // Groupement par pattern de détection
    const groups = drafts.reduce((acc, d) => {
      const key = d.validationResult || 'unknown';
      if (!acc[key]) acc[key] = [];
      acc[key].push(d);
      return acc;
    }, {});

    for (const [key, items] of Object.entries(groups)) {
      console.log(`🔍 Groupe: ${key.toUpperCase()} (${items.length} occurrences)`);
      
      // Si c'est une attaque de sécurité, on propose une promotion en Épisode groupé
      if (key.includes('injection_detected')) {
        console.log(`   💡 Suggestion: Promouvoir ces tentatives en Épisode de vigilance.`);
        // Note: Ici, dans une version avancée, on appellerait le LLM pour résumer.
      }
      
      items.forEach(d => {
        console.log(`   - [${d.id}] Trigger: "${d.trigger.substring(0, 50)}..." | Outcome: ${d.finalOutcome}`);
      });
      console.log('');
    }

    console.log(`💡 Commande disponible: node server/scripts/promoteSecurityIncident.js (pour EP-4743)`);
    console.log(`💡 Pour tout promouvoir: Ajoutez l'argument --all-episodes`);

  } catch (error) {
    console.error(`❌ Erreur lors de la consolidation:`, error);
  }
}

run();
