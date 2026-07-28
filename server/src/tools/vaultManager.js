/* server/src/tools/vaultManager.js */
import fs from 'fs-extra';
import path from 'path';

const VAULT_ROOT = 'd:/Hostinger/public_html/nexxustudio/citadelle-vault/Citadelle';
const LOGS_ROOT = 'd:/Hostinger/public_html/nexxustudio/server/logs/runs';
const DASHBOARD_PATH = path.join(VAULT_ROOT, 'Bienvenue.md');

/**
 * 🛡️ Résolution sécurisée de chemin (Anti-Path Traversal)
 */
function safeResolveVaultPath(relPath) {
  const root = path.resolve(VAULT_ROOT);
  const resolved = path.resolve(root, relPath);

  // 1. Contrôle de frontière strict (Anti-Path Traversal)
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`[Security] Tentative de sortie du Vault détectée : ${relPath}`);
  }

  // 2. Protection Windows : Noms réservés (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
  const filename = path.basename(resolved).toUpperCase().split('.')[0];
  const reserved = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/;
  if (reserved.test(filename)) {
    throw new Error(`[Security] Nom de fichier réservé Windows interdit : ${filename}`);
  }

  return resolved;
}

/**
 * 🧼 Nettoyage Markdown pour titres et résumés
 */
function sanitizeMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/[\[\]|]/g, ' ') // Évite de casser les liens Obsidian [[...]]
    .replace(/\n/g, ' ')      // Pas de retours à la ligne dans le dashboard
    .trim();
}

/**
 * Fonctions de gestion du Vault (Industrial v4.0)
 */
export async function documentExists(relPath) {
  try {
    const fullPath = safeResolveVaultPath(relPath);
    return await fs.pathExists(fullPath);
  } catch (e) {
    return false;
  }
}

/**
 * Détection de doublons via le relPath (Idempotence machine)
 */
export async function findDuplicateLink(relPath) {
  if (!(await fs.pathExists(DASHBOARD_PATH))) return false;
  const content = await fs.readFile(DASHBOARD_PATH, 'utf8');
  const linkBase = relPath.replace('.md', '');
  // Recherche stricte du lien relatif normalisé
  return content.includes(`[[${linkBase}|`) || content.includes(`[[${linkBase}]]`);
}

export async function registerDocument({ relPath, title, type, section, summary }) {
  try {
    // Validation de sécurité préventive (Garantit que relPath est sûr)
    safeResolveVaultPath(relPath);

    const safeRelPath = relPath.replace(/\\/g, '/'); // Normalisation slash
    const isDuplicate = await findDuplicateLink(safeRelPath);
    
    if (isDuplicate) {
      return { success: true, message: "Document déjà indexé dans le Dashboard.", duplicate: true };
    }

    if (!(await fs.pathExists(DASHBOARD_PATH))) {
      await fs.outputFile(DASHBOARD_PATH, `# 🏰 Dashboard de La Citadelle\n\nBienvenue dans votre mémoire souveraine.\n`, 'utf8');
    }

    const content = await fs.readFile(DASHBOARD_PATH, 'utf8');
    const safeTitle = sanitizeMarkdown(title);
    const safeSummary = sanitizeMarkdown(summary);
    const linkBase = safeRelPath.replace('.md', '');
    
    const entry = `- [[${linkBase}|${safeTitle}]] : ${safeSummary || 'Pas de résumé fourni.'}`;

    const lines = content.split('\n');
    let sectionIndex = lines.findIndex(l => l.trim().toLowerCase().includes(section.toLowerCase()));

    if (sectionIndex === -1) {
      lines.push(`\n## ${section}\n${entry}\n`);
    } else {
      let insertAt = sectionIndex + 1;
      while (insertAt < lines.length && (lines[insertAt].trim().startsWith('-') || lines[insertAt].trim() === '')) {
        insertAt++;
      }
      lines.splice(insertAt - 1, 0, entry);
    }

    await fs.writeFile(DASHBOARD_PATH, lines.join('\n'), 'utf8');
    return { success: true, message: `Document [${safeTitle}] promu dans la section [${section}].` };

  } catch (error) {
    console.error(`[VaultManager] Error registering document:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Alias agent-tool — mappe (type, name, metadata) vers registerDocument.
 * @param {string} type
 * @param {string} name
 * @param {object|string} [metadata]
 */
export async function registerInDashboard(type, name, metadata = {}) {
  const meta =
    typeof metadata === "string"
      ? { summary: metadata }
      : metadata && typeof metadata === "object"
        ? metadata
        : {};
  const safeName = String(name || "artefact")
    .trim()
    .replace(/[^\w.-]+/g, "_")
    .slice(0, 80);
  return registerDocument({
    relPath:
      meta.relPath ||
      `01-Episodic/agent/${safeName || "artefact"}.md`,
    title: meta.title || name || safeName || "Artefact agent",
    type: type || meta.type || "episodic",
    section: meta.section || type || "Governance",
    summary:
      meta.summary ||
      `Artefact enregistré via outil agent (${type || "unknown"}).`,
  });
}

export async function appendEventLog({ runId, action, target, result }) {
  try {
    await fs.ensureDir(LOGS_ROOT);
    const logFile = path.join(LOGS_ROOT, `${runId}.jsonl`);
    const logEntry = JSON.stringify({
      timestamp: new Date().toISOString(),
      action,
      target,
      result: typeof result === 'object' ? 'OBJECT_DATA' : result
    }) + '\n';
    
    // Append asynchrone sécurisé
    await fs.appendFile(logFile, logEntry, 'utf8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export default { 
  documentExists, 
  findDuplicateLink, 
  registerDocument,
  registerInDashboard,
  appendEventLog,
  safeResolveVaultPath
};
