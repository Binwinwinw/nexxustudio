import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const VAULT_PATH = path.resolve('../citadelle-vault/Citadelle');
const OUTPUT_DIR = path.join(VAULT_PATH, 'Wiki');
const ADR_SOURCES = [
  path.join(VAULT_PATH, '02-Architecture/adr')
];

async function syncWikiOps() {
  console.log("🚀 [Wiki-Ops] Lancement de la synchronisation ADR...");
  
  if (!await fs.stat(OUTPUT_DIR).catch(() => false)) {
    await fs.mkdir(OUTPUT_DIR);
  }

  const adrFiles = [];

  for (const source of ADR_SOURCES) {
    if (!await fs.stat(source).catch(() => false)) continue;
    const files = (await fs.readdir(source)).filter(f => f.endsWith('.md'));
    for (const f of files) {
      adrFiles.push({ name: f, fullPath: path.join(source, f) });
    }
  }

  let indexContent = "# Wiki : Index Centralisé des Décisions (ADR)\n\n";
  indexContent += "| ID | Décision | Statut | Expert | Impact MonCoach |\n|---|---|---|---|---|\n";

  const ragChunks = [];

  for (const adr of adrFiles) {
    const content = await fs.readFile(adr.fullPath, 'utf8');
    const titleMatch = content.match(/^#\s+(.*)/m);
    const statusMatch = content.match(/\*\*Statut\*\*\s*:\s*(.*)/);
    const expertMatch = content.match(/\*\*Expert\*\*\s*:\s*(.*)/);
    const monCoachMatch = content.toLowerCase().includes('moncoach') || content.toLowerCase().includes('mcs');

    const title = titleMatch ? titleMatch[1] : adr.name;
    const status = statusMatch ? statusMatch[1].trim() : "Inconnu";
    const expert = expertMatch ? expertMatch[1].trim() : "Nexxus";
    const impactMcs = monCoachMatch ? "✅ Oui" : "❌ Non";

    indexContent += `| ${adr.name.split('-')[0]} | [[${adr.name}\|${title}]] | ${status} | ${expert} | ${impactMcs} |\n`;

    // Génération de chunks RAG-Ready avec Contextual Headers
    const contentHash = crypto.createHash('sha256').update(content).digest('hex').substring(0, 8);
    ragChunks.push({
      id: `rag_adr_${adr.name.replace('.md', '')}_${contentHash}`,
      content: `[Source: ADR | File: ${adr.name} | Expert: ${expert}]\n${content}`,
      metadata: {
        source: adr.name,
        type: "doc",
        category: "governance",
        status: status,
        expert: expert,
        has_mcs_impact: monCoachMatch
      }
    });
  }

  // 1. Sauvegarde Wiki-ADRs-Index.md
  await fs.writeFile(path.join(OUTPUT_DIR, 'Wiki-ADRs-Index.md'), indexContent);
  console.log("✅ Wiki-ADRs-Index.md généré.");

  // 2. Sauvegarde rag-adrs.json
  await fs.writeFile(path.join(OUTPUT_DIR, 'rag-adrs.json'), JSON.stringify(ragChunks, null, 2));
  console.log("✅ rag-adrs.json généré.");

  // 3. Génération du Rapport-sync.md
  const report = `# Rapport de Synchronisation Wiki-Ops\n\n` +
    `- **Date** : ${new Date().toLocaleString()}\n` +
    `- **Sources** : Décisions, 00-ADRs\n` +
    `- **Fichiers traités** : ${adrFiles.length}\n` +
    `- **Chunks RAG créés** : ${ragChunks.length}\n` +
    `- **Statut** : Success 🚀\n\n` +
    `## Synthèse des impacts MonCoachScolaire\n` +
    `Les ADRs ont été taguées pour filtrage RAG prioritaire sur le module MCS.\n`;
  
  await fs.writeFile(path.join(OUTPUT_DIR, 'rapport-sync.md'), report);
  console.log("✅ rapport-sync.md généré.");

  console.log("🛡️ [Wiki-Ops] Synchronisation terminée avec succès.");
}

syncWikiOps().catch(console.error);
