/* server/scripts/migrate_sessions.js */
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../src/db/connection.js';
import sessionRepository from '../src/db/repositories/sessionRepository.js';
import eventRepository from '../src/db/repositories/eventRepository.js';
import validationService from '../src/services/validationService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSIONS_DIR = path.resolve(__dirname, '../state/sessions');

async function migrate() {
  console.log("🚀 STARTING RETRO-MIGRATION: JSON -> MySQL...");
  
  try {
    const files = await fs.readdir(SESSIONS_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    console.log(`📂 Found ${jsonFiles.length} sessions to migrate.`);

    for (const file of jsonFiles) {
      const filePath = path.join(SESSIONS_DIR, file);
      const data = await fs.readJson(filePath);
      const sessionId = data.id;

      console.log(`\n📄 Migrating [${sessionId}] : "${data.title}"...`);

      // 1. Créer la session en base si absente
      await sessionRepository.save(sessionId, data.title || 'Session Migrée');

      // 2. Migrer les messages Mentor (Journal d'événements)
      if (data.mentor && data.mentor.messages) {
        let version = 1;
        for (const msg of data.mentor.messages) {
          const actor = msg.role === 'user' ? 'user' : 'assistant';
          const type = msg.role === 'user' ? 'user_message' : 'ai_response';
          
          await eventRepository.addEvent({
            sessionId,
            family: 'CONVERSATION',
            type,
            actor,
            payload: { content: msg.content },
            metadata: { migrated: true },
            version
          });
          
          await sessionRepository.updateVersion(sessionId, version);
          version++;
        }
        
        console.log(`   ✅ ${data.mentor.messages.length} conversation events migrated.`);
      }

      // 3. Lancer la validation pour créer le snapshot et le calcul de maturité
      const lastVersion = (data.mentor?.messages?.length || 0);
      if (lastVersion > 0) {
        await validationService.validateProject(sessionId, lastVersion);
        console.log(`   ✅ Snapshot created and maturity calculated.`);
      }
    }

    console.log("\n🎯 RETRO-MIGRATION COMPLETE.");
  } catch (error) {
    console.error("🔥 Migration failed:", error);
  } finally {
    await pool.end();
  }
}

migrate();
