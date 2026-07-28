import fs from 'fs/promises';
import path from 'path';

const VAULT_PATH = path.resolve('../citadelle-vault/Citadelle');
const DECISIONS_DIR = path.join(VAULT_PATH, 'Décisions');
const ADR_DIR = path.join(VAULT_PATH, '00-ADRs');
const ARCHIVE_DIR = path.join(VAULT_PATH, 'archive/Décisions');

async function cleanAndFuse() {
  console.log("🧹 [ADR-CLEAN] Démarrage du nettoyage atomique...");

  if (!await fs.stat(ARCHIVE_DIR).catch(() => false)) {
    await fs.mkdir(ARCHIVE_DIR, { recursive: true });
  }

  // 1. Fusion spécifique de ADR-003 (Detailed + Thresholds)
  const legacy003Path = path.join(DECISIONS_DIR, 'ADR-003-Stochastic-Multi-Agent-Consensus.md');
  const sota003Path = path.join(ADR_DIR, 'ADR-003-Stochastic-Multi-Agent-Consensus.md');
  
  if (await fs.stat(legacy003Path).catch(() => false)) {
    let legacyContent = await fs.readFile(legacy003Path, 'utf8');
    // On remplace le seuil générique (>80%) par les seuils précis (0.75/0.85/0.95)
    const thresholds = `
*   **Seuils de Consensus (SOTA)** :
    - **0.75** : Seuil de confiance automatique.
    - **0.85** : Seuil exigeant une validation humaine.
    - **0.95+** : État "SOTA" validé.
`;
    legacyContent = legacyContent.replace(/\*   \*\*Seuil de Consensus\*\* : >80% de similarité sémantique entre les agents./, thresholds);
    
    // On marque comme Actif
    legacyContent = legacyContent.replace(/\*\*Statut\*\*\s*:\s*Proposé\s*\(Validé par expérimentation contextuelle\)/, "**Statut** : Actif (Fusionné v3.1)");

    await fs.writeFile(sota003Path, legacyContent);
    console.log("✨ ADR-003 fusionnée avec succès (Détails + Seuils SOTA).");
  }

  // 2. Migration des autres fichiers de Décisions vers 00-ADRs s'ils n'existent pas
  const decisionsFiles = (await fs.readdir(DECISIONS_DIR)).filter(f => f.endsWith('.md'));
  for (const file of decisionsFiles) {
    const sourcePath = path.join(DECISIONS_DIR, file);
    const targetPath = path.join(ADR_DIR, file);
    const archivePath = path.join(ARCHIVE_DIR, file);

    if (!await fs.stat(targetPath).catch(() => false)) {
      await fs.copyFile(sourcePath, targetPath);
      console.log(`🚚 Migration : ${file} -> 00-ADRs`);
    }

    // 3. Archivage systématique
    await fs.rename(sourcePath, archivePath);
    console.log(`📦 Archivé : ${file}`);
  }

  // 4. Rapport d'audit
  const report = `# Rapport d'Audit Nettoyage ADR\n\n` +
    `- **Date** : ${new Date().toLocaleString()}\n` +
    `- **Action** : Fusion Décisions -> 00-ADRs\n` +
    `- **Fusion Critique** : ADR-003 (Intégration des seuils 0.75/0.85/0.95)\n` +
    `- **Archivage** : Dossier Décisions déplacé vers archive/\n` +
    `- **Statut** : Base de connaissances assainie. 🚀\n`;
  
  await fs.writeFile(path.join(VAULT_PATH, 'Wiki/adr-clean-report.md'), report);
  console.log("✅ adr-clean-report.md généré.");
}

cleanAndFuse().catch(console.error);
