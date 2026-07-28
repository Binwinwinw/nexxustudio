import fs from 'fs-extra';
import path from 'path';
import matter from 'gray-matter';

// Define the root of the Vault
const VAULT_ROOT = 'd:/Hostinger/public_html/nexxustudio/citadelle-vault/Citadelle';
const REPORT_PATH = path.join(VAULT_ROOT, '04-Observations-et-Rapports', 'Rapports', 'Vault-Health.md');

// Mandatory metadata for all files
const MINIMAL_METADATA = ['status', 'owner', 'last_reviewed', 'canonical'];
const RECOMMENDED_METADATA = ['type', 'pillar'];

/**
 * Helper to parse dates
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Recursive walk through directory to find all markdown files
 */
async function getMarkdownFiles(dir) {
  let results = [];
  const list = await fs.readdir(dir);
  for (let file of list) {
    file = path.resolve(dir, file);
    const stat = await fs.stat(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(await getMarkdownFiles(file));
    } else {
      if (file.endsWith('.md')) {
        results.push(file);
      }
    }
  }
  return results;
}

/**
 * Extract all [[links]] from markdown content
 */
function extractWikiLinks(content) {
  const links = [];
  // Matches [[LinkName]] or [[LinkName|Alias]]
  const regex = /\[\[(.*?)(?:\|.*?)?\]\]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    links.push(match[1].trim());
  }
  return links;
}

/**
 * Main governance audit function
 */
export async function auditVault() {
  const alerts = {
    critical: [],
    important: [],
    warning: []
  };

  const files = await getMarkdownFiles(VAULT_ROOT);
  
  // Index of all files and their extracted properties
  const fileData = new Map(); // relPathWithoutExtension -> data
  const allLinkTargets = new Set(); // To track orphans

  const now = new Date();

  // 1. First pass: Parse frontmatter and extract links
  for (const file of files) {
    const relPath = path.relative(VAULT_ROOT, file).replace(/\\/g, '/');
    const relPathWithoutExt = relPath.replace(/\.md$/, '');
    
    // Read file and parse with gray-matter
    const fileContent = await fs.readFile(file, 'utf8');
    let parsed;
    try {
      parsed = matter(fileContent);
    } catch (e) {
      alerts.warning.push(`**${relPath}**: Erreur de parsing du YAML frontmatter. (${e.message})`);
      continue;
    }

    const { data: frontmatter, content } = parsed;
    const links = extractWikiLinks(content);
    
    // Add to all link targets (normalized)
    for (const link of links) {
      allLinkTargets.add(link);
    }

    fileData.set(relPathWithoutExt, {
      relPath,
      frontmatter,
      links,
      isZoneExclue: relPath.startsWith('99-Zone-Exclue/'),
      isGouvernanceOrArchi: relPath.startsWith('00-Gouvernance/') || relPath.startsWith('01-Architecture/'),
      isADR: relPath.includes('ADR') || (frontmatter.type && frontmatter.type.toString().toLowerCase() === 'adr'),
      isReport: relPath.startsWith('04-Observations-et-Rapports/')
    });
  }

  // 2. Second pass: Apply governance rules
  for (const [key, data] of fileData.entries()) {
    const { relPath, frontmatter, links, isZoneExclue, isGouvernanceOrArchi, isADR, isReport } = data;

    // Rule: Orphan Detection (not linked to)
    // Ignore entry points like Bienvenue and Reports
    if (!allLinkTargets.has(key) && key !== 'Bienvenue' && !isReport) {
       alerts.warning.push(`**${relPath}**: Document orphelin (aucun lien ne pointe vers lui).`);
    }

    // Rule: Active links to 99-Zone-Exclue
    if (!isZoneExclue) {
      for (const link of links) {
        // If the target is in 99-Zone-Exclue
        if (link.startsWith('99-Zone-Exclue/')) {
          alerts.critical.push(`**${relPath}**: Contient un lien actif vers la zone d'archive (\`${link}\`).`);
        }
      }
    }

    // Evaluate Missing Metadata
    const missingMetadata = MINIMAL_METADATA.filter(field => frontmatter[field] === undefined || frontmatter[field] === '');
    if (missingMetadata.length > 0) {
      if (isGouvernanceOrArchi) {
        alerts.important.push(`**${relPath}**: Document critique sans métadonnées obligatoires (${missingMetadata.join(', ')}).`);
      } else {
        alerts.warning.push(`**${relPath}**: Métadonnées obligatoires manquantes (${missingMetadata.join(', ')}).`);
      }
    }

    // Recommended metadata
    const missingRecommended = RECOMMENDED_METADATA.filter(field => frontmatter[field] === undefined || frontmatter[field] === '');
    if (missingRecommended.length > 0) {
      alerts.warning.push(`**${relPath}**: Métadonnées recommandées manquantes (${missingRecommended.join(', ')}).`);
    }

    // Rule: ADR Obsolescence & Degradation
    if (isADR) {
      const status = (frontmatter.status || '').toString().toLowerCase();
      const lastReviewedStr = frontmatter.last_reviewed;
      const lastReviewedDate = parseDate(lastReviewedStr);

      if (lastReviewedDate) {
        const diffTime = Math.abs(now - lastReviewedDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // ADR draft/proposed > 30 days
        if ((status === 'draft' || status === 'proposed') && diffDays > 30) {
          alerts.important.push(`**${relPath}**: ADR en statut \`${status}\` depuis plus de 30 jours (${diffDays} j).`);
        }
        
        // ADR canonique non revu > 6 mois (approx 180 days)
        if (status === 'canonical' && diffDays > 180) {
          alerts.important.push(`**${relPath}**: ADR canonique non révisé depuis plus de 6 mois (${diffDays} j).`);
        }
      } else if (status) {
        // Missing date but has status
        alerts.important.push(`**${relPath}**: ADR avec statut \`${status}\` mais sans date \`last_reviewed\` valide.`);
      }
    }
  }

  // 3. Generate Report
  await generateReport(alerts);
  return alerts;
}

/**
 * Format and write the Vault-Health.md report
 */
async function generateReport(alerts) {
  let content = `# 🩺 Rapport de Santé du Vault\n\n`;
  content += `*Généré le : ${new Date().toISOString()}*\n\n`;
  
  content += `## 🚨 Alertes Critiques (${alerts.critical.length})\n`;
  if (alerts.critical.length === 0) content += `Aucune alerte critique.\n`;
  else alerts.critical.forEach(a => content += `- ${a}\n`);
  content += `\n`;

  content += `## ⚠️ Alertes Importantes (${alerts.important.length})\n`;
  if (alerts.important.length === 0) content += `Aucune alerte importante.\n`;
  else alerts.important.forEach(a => content += `- ${a}\n`);
  content += `\n`;

  content += `## 📝 Avertissements (${alerts.warning.length})\n`;
  if (alerts.warning.length === 0) content += `Aucun avertissement.\n`;
  else alerts.warning.forEach(a => content += `- ${a}\n`);
  content += `\n`;

  await fs.ensureDir(path.dirname(REPORT_PATH));
  await fs.writeFile(REPORT_PATH, content, 'utf8');
  console.log(`[Librarian] Rapport de santé généré avec succès dans : ${REPORT_PATH}`);
}

export default {
  auditVault
};
