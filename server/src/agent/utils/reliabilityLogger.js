/* server/src/agent/utils/reliabilityLogger.js */
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { encrypt, decrypt } from '../../security/logEncryptor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RELIABILITY_LOG_ROOT = path.resolve(__dirname, '../../../../server/data/logs/reliability');

/**
 * Reliability Logger Hardened (Fiabilité v3.6 - SOTA v1.2)
 * Enregistre et lit des traces d'exécution chiffrées en AES-256-GCM au repos.
 */
class ReliabilityLogger {
  /**
   * Loggue une trace complète d'un tour (Chiffrée au repos)
   * @param {Object} trace 
   */
  async logTurn(trace) {
    const today = new Date().toISOString().split('T')[0];
    const logDir = path.join(RELIABILITY_LOG_ROOT, today);
    const logFile = path.join(logDir, `${trace.turnId || `turn-${Date.now()}`}.json`);

    const fullTrace = {
      timestamp: new Date().toISOString(),
      ...trace
    };

    try {
      await fs.ensureDir(logDir);
      // Chiffrement AES-256-GCM du payload JSON complet
      const encryptedPayload = encrypt(fullTrace);
      
      // Sauvegarde du conteneur chiffré sous forme brute
      await fs.writeFile(logFile, encryptedPayload, 'utf8');

      // 🔄 Application asynchrone de la politique de rétention (évite de ralentir le tour de chat)
      this.applyRetentionPolicy().catch(err => {
        console.error('[ReliabilityLogger] Rotation des logs ratée :', err.message);
      });

      return logFile;
    } catch (error) {
      console.error('[ReliabilityLogger] Échec de l\'écriture chiffrée de la trace :', error);
      return null;
    }
  }

  /**
   * Récupère les stats du jour (Avec déchiffrement à la volée)
   */
  async getDailyStats(dateString) {
    const day = dateString || new Date().toISOString().split('T')[0];
    const logDir = path.join(RELIABILITY_LOG_ROOT, day);
    
    if (!(await fs.pathExists(logDir))) return null;
    
    const files = await fs.readdir(logDir);
    const stats = {
      totalTurns: files.length,
      publishedDirect: 0, 
      rejections: 0,      
      lowConfidence: 0,   
      syntaxErrors: 0,    
      totalLatency: 0,    
      totalScore: 0,      
      reasons: {}
    };

    if (files.length === 0) return null;

    let validFilesCount = 0;

    for (const file of files) {
      try {
        const rawContent = await fs.readFile(path.join(logDir, file), 'utf8');
        // Déchiffrement à la volée
        const decryptedJson = decrypt(rawContent);
        const data = JSON.parse(decryptedJson);

        const report = data.criticReport || {};
        const tele = data.telemetry || {};

        stats.totalScore += report.score || 0;
        stats.totalLatency += tele.reliabilityLatency || 0;

        if (report.valid) {
          if ((tele.retryCount || 0) === 0) stats.publishedDirect++;
        } else {
          stats.rejections++;
        }

        if (report.score < 0.75) stats.lowConfidence++;
        
        const reasons = report.reasons || [];
        if (reasons.includes('syntax_invalid')) stats.syntaxErrors++;
        
        reasons.forEach(r => {
          stats.reasons[r] = (stats.reasons[r] || 0) + 1;
        });

        validFilesCount++;
      } catch (err) {
        console.error(`[ReliabilityLogger] Erreur lors du déchiffrement de ${file} :`, err.message);
      }
    }

    if (validFilesCount === 0) return null;

    return {
      date: day,
      totalTurns: validFilesCount,
      Taux_Publication_Primal: (stats.publishedDirect / validFilesCount) * 100,
      Taux_Rejet_Critic: (stats.rejections / validFilesCount) * 100,
      Taux_Hypothese_Prudente: (stats.lowConfidence / validFilesCount) * 100,
      Taux_Echec_Syntax: (stats.syntaxErrors / validFilesCount) * 100,
      Latence_Fiabilité_Avg: stats.totalLatency / validFilesCount,
      Score_SMAC_Moyen: stats.totalScore / validFilesCount,
      Taxonomie_Erreurs: stats.reasons
    };
  }

  /**
   * Politique de Rétention (Rotation automatique des logs)
   * Supprime les dossiers journaliers datant de plus de LOG_RETENTION_DAYS (14 par défaut)
   */
  async applyRetentionPolicy() {
    if (!(await fs.pathExists(RELIABILITY_LOG_ROOT))) return;

    const retentionDays = parseInt(process.env.LOG_RETENTION_DAYS) || 14;
    const now = Date.now();
    const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;

    const dirs = await fs.readdir(RELIABILITY_LOG_ROOT);
    for (const dir of dirs) {
      const fullPath = path.join(RELIABILITY_LOG_ROOT, dir);
      const stat = await fs.stat(fullPath);

      if (stat.isDirectory()) {
        // Le format de nos dossiers est AAAA-MM-JJ (ex: 2026-05-19)
        const dateParts = dir.split('-');
        if (dateParts.length === 3) {
          const folderDate = new Date(dir);
          const ageMs = now - folderDate.getTime();

          if (ageMs > maxAgeMs) {
            console.log(`[ReliabilityLogger] Rétention atteinte : suppression du dossier de logs expiré ${dir}`);
            await fs.remove(fullPath);
          }
        }
      }
    }
  }
}

export default new ReliabilityLogger();
