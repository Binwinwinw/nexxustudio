/* server/scripts/ltm_epistemic_audit.js */
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VAULT_ROOT = 'd:/Hostinger/public_html/nexxustudio/citadelle-vault/Citadelle';
const EPISODIC_PATH = path.join(VAULT_ROOT, '01-Episodic/interactions');

async function runAudit() {
  console.log("🕵️ Starting Nightly LTM Epistemic Audit...");
  
  if (!fs.existsSync(EPISODIC_PATH)) {
    console.log("No episodic interactions found. Skipping.");
    return;
  }

  const dateFolders = await fs.readdir(EPISODIC_PATH);
  let totalFiles = 0;
  let failures = 0;

  for (const folder of dateFolders) {
    const folderPath = path.join(EPISODIC_PATH, folder);
    if (!(await fs.stat(folderPath)).isDirectory()) continue;

    const files = await fs.readdir(folderPath);
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      totalFiles++;
      
      const filePath = path.join(folderPath, file);
      const content = await fs.readFile(filePath, 'utf8');
      
      // Check for frontmatter epistemic metadata
      const hasSourceUrl = content.includes('sourceUrl:') && !content.includes('sourceUrl: none');
      const hasToolsUsed = content.includes('toolsUsed:') && (content.includes('webSummarize') || content.includes('webSearch') || content.includes('workspaceSearch'));
      const hasProofId = content.includes('Proof_ID:');

      // Logic: if it's a technical response (contains [OBSERVÉ]), it should have proof
      const isTechnical = content.includes('[OBSERVÉ]');
      
      if (isTechnical && !hasToolsUsed && content.includes('http')) {
        console.error(`❌ [FAILURE] ${file}: Technical analysis of URL without extraction tool.`);
        failures++;
      } else if (isTechnical && hasSourceUrl && !hasProofId && content.includes('webSummarize')) {
        console.warn(`⚠️ [WARNING] ${file}: webSummarize used but no Proof_ID found in content.`);
      }
    }
  }

  console.log("\n--- AUDIT SUMMARY ---");
  console.log(`Total Files Scanned: ${totalFiles}`);
  console.log(`Epistemic Failures: ${failures}`);
  console.log(`Status: ${failures === 0 ? '✅ HEALTHY' : '🚨 ACTION REQUIRED'}`);
  
  if (failures > 0) process.exit(1);
}

runAudit().catch(err => {
  console.error("Audit failed:", err);
  process.exit(1);
});
