/* server/src/services/turnConsolidationService.js */
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import groundTruthService from '../agent/utils/groundTruthService.js';
import knowledgeHub from './knowledgeHub.js';
import vaultManager from '../tools/vaultManager.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Config Externalisée
const VAULT_ROOT = process.env.CITADELLE_VAULT_PATH || 'd:/Hostinger/public_html/nexxustudio/citadelle-vault/Citadelle';

/**
 * Service de Consolidation des Tours (Industrial v4.2)
 * Distille les interactions de haute qualité pour la mémoire long-terme.
 */
class TurnConsolidationService {
  constructor() {
    this.MIN_CRITIC_SCORE = 0.98;
    this.PROMOTABLE_LABELS = ['correct'];
  }

  /**
   * Analyse et consolide un tour de parole si les critères de qualité sont remplis.
   */
  async consolidate(turnId, humanLabel = null, humanComment = '') {
    const report = {
      turnId,
      success: false,
      steps: { vault: false, chroma: false, dashboard: false },
      alreadyConsolidated: false
    };

    console.log(`🧠 [LTM] Analyse du tour [${turnId}] pour consolidation...`);

    const log = await groundTruthService.findLogById(turnId);
    if (!log) {
      console.warn(`⚠️ [LTM] Trace introuvable pour [${turnId}]. Abort.`);
      return { ...report, reason: 'Trace introuvable' };
    }

    // Normalisation de l'ID (Sûreté métier)
    const effectiveTurnId = log.turnId || turnId;

    // --- IDEMPOTENCE CHECK (Via KnowledgeHub) ---
    try {
      if (await knowledgeHub.exists(`ltm_${effectiveTurnId}`)) {
        console.log(`ℹ️ [LTM] Tour [${effectiveTurnId}] déjà présent en mémoire. Skip.`);
        return { ...report, success: true, alreadyConsolidated: true };
      }
    } catch (e) {
      console.warn(`⚠️ [LTM] Erreur check idempotence ChromaDB: ${e.message}`);
    }

    // --- STAGE-GATE : CRITÈRES DE PROMOTION ---
    const criticScore = log.criticReport?.score || 0;
    const isHumanValidated = this.PROMOTABLE_LABELS.includes(humanLabel);
    const isHighQuality = criticScore >= this.MIN_CRITIC_SCORE;

    if (!isHumanValidated && !isHighQuality) {
      console.log(`ℹ️ [LTM] Tour [${effectiveTurnId}] non éligible (Score: ${criticScore}, Label: ${humanLabel}).`);
      return { ...report, reason: 'Critères de qualité non remplis' };
    }

    console.log(`✨ [LTM] Promotion validée pour [${effectiveTurnId}].`);

    // --- GÉNÉRATION DE L'ACTIF ÉPISODIQUE ---
    const timestamp = new Date().toISOString();
    const dateSlug = timestamp.split('T')[0];
    const relPath = `01-Episodic/interactions/${dateSlug}/${effectiveTurnId}.md`;
    
    // Utilisation du resolver sécurisé du manager pour le chemin d'écriture
    const fullPath = vaultManager.safeResolveVaultPath(relPath);

    const content = this._buildInteractionMarkdown(log, humanLabel, humanComment, effectiveTurnId);

    try {
      // 1. Sauvegarde dans le Vault (Idempotence par écrasement contrôlé)
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, content, 'utf8');
      report.steps.vault = true;

      // 2. Indexation dans ChromaDB (Upsert garantit l'idempotence au niveau DB)
      const metadata = log.telemetry || {};
      await knowledgeHub.addDocuments([{
        id: `ltm_${effectiveTurnId}`,
        content: `QUERY: ${log.query}\nRESPONSE: ${log.response}\nREASONING: ${log.criticReport?.analysis || ''}`,
        metadata: {
          type: 'episodic',
          turnId: effectiveTurnId,
          timestamp,
          label: humanLabel || 'auto',
          score: criticScore,
          source: relPath,
          toolsUsed: metadata.toolsUsed || [],
          tags: ['ltm', 'interaction', log.activeModels?.primary || 'unknown']
        }
      }]);
      report.steps.chroma = true;

      // 3. Enregistrement dans le Dashboard du Vault
      const dashboardResult = await vaultManager.registerDocument({
        relPath,
        title: `Interaction : ${log.query.slice(0, 40)}`,
        type: 'episodic',
        section: '🧠 Mémoire Épisodique (LTM)',
        summary: `Interaction distillée du ${dateSlug}. Qualité: ${isHumanValidated ? 'CERTIFIÉE' : 'AUTO-VÉRIFIÉE'}.`
      });
      
      if (dashboardResult.success) {
        report.steps.dashboard = true;
      } else {
        console.warn(`⚠️ [LTM] Échec partiel de l'enregistrement dashboard : ${dashboardResult.error}`);
      }

      report.success = report.steps.vault && report.steps.chroma;
      console.log(`✅ [LTM] Tour [${effectiveTurnId}] consolidé.`);
      return report;

    } catch (error) {
      console.error(`❌ [LTM] Erreur lors de la consolidation pour [${effectiveTurnId}]:`, error.message);
      return { ...report, error: error.message };
    }
  }

  /**
   * Échappement YAML Industriel (Anti-Backslash & Double Quotes)
   */
  _escapeYaml(value) {
    if (value === null || value === undefined) return '""';
    const str = String(value)
      .replace(/\\/g, '\\\\') // Double le backslash (Critical for Windows)
      .replace(/"/g, '\\"')   // Échappe le guillemet double
      .replace(/\r/g, ' ')    // Nettoie les retours chariot
      .replace(/\n/g, ' ');   // Remplace les newlines par des espaces
    return `"${str}"`;
  }

  /**
   * Formate l'interaction en Markdown structuré pour Obsidian/Vault.
   */
  _buildInteractionMarkdown(log, label, comment, effectiveId) {
    const critic = log.criticReport || {};
    const metadata = log.telemetry || {};
    const vision = log.visionData || [];
    
    const frontMatter = [
      '---',
      `turnId: ${this._escapeYaml(effectiveId)}`,
      `date: ${this._escapeYaml(new Date().toISOString())}`,
      `status: ${this._escapeYaml(label || 'auto-verified')}`,
      `criticScore: ${critic.score || 0}`,
      `domain: ${this._escapeYaml(metadata.assignedDivision || 'General')}`,
      `hasVisuals: ${vision.length > 0}`,
      `toolsUsed: ${this._escapeYaml(metadata.toolsUsed?.join(', ') || 'none')}`,
      '---'
    ].join('\n');

    let content = `${frontMatter}

# Interaction Épisodique : ${effectiveId}

## 🌐 1. CONTEXTE (Situation)
- **Requête**: ${log.query}
- **Division**: ${metadata.assignedDivision || 'General'}
- **Modèles**: ${log.activeModels?.primary || 'N/A'}

## 🧠 2. DÉCISION (Action de l'Agent)
- **Réponse**:
${log.response}

`;

    if (vision.length > 0) {
      content += `## 👁️ 2.5 ANALYSE VISUELLE (Multimodal)\n`;
      vision.forEach((v, i) => {
        content += `### Actif #${i+1}: ${v.filename}\n`;
        content += `- **Description**: ${v.analysis}\n`;
        if (v.ocr) content += `- **OCR**: ${v.ocr}\n`;
        content += `\n`;
      });
    }

    content += `## 🛡️ 3. PREUVE (Analyse du Critic)
- **Score SMAC**: ${critic.score || 0}
- **Analyse**: ${critic.analysis || 'Aucune analyse détaillée.'}
- **Fiabilité**: ${metadata.reliabilityLatency || 0}ms

## 🎯 4. ISSUE (Résultat & Verdict)
- **Verdict Final**: ${label === 'correct' || critic.score > 0.98 ? 'SUCCESS_STABLE' : 'UNVERIFIED'}
- **Commentaire**: ${comment || 'Aucun retour utilisateur.'}

${comment && label !== 'correct' ? `## 🛠️ 5. CORRECTION (Apprentissage)\n> L'utilisateur a signalé : ${comment}\n` : ''}

## 📊 Métadonnées Techniques
- **Latence Totale**: ${log.durationMs}ms
- **Turn Context**: ${effectiveId}
`;
    return content;
  }
}

export default new TurnConsolidationService();
