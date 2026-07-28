import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_GROUND_TRUTH_DB = path.resolve(__dirname, '../../../../server/data/reliability/ground_truth.json');
const DEFAULT_RELIABILITY_LOG_ROOT = path.resolve(__dirname, '../../../../server/data/logs/reliability');
const DEFAULT_LOG_INDEX = path.resolve(__dirname, '../../../../server/data/reliability/log_index.json');

/**
 * Ground Truth Service (Fiabilité v3.5 - Vague 2)
 * Gère l'étiquetage humain des traces pour la calibration.
 */
class GroundTruthService {
  constructor(options = {}) {
    this.labels = ['correct', 'partially_correct', 'incorrect', 'overblocked'];
    this.dbPath = options.dbPath || DEFAULT_GROUND_TRUTH_DB;
    this.logRootPath = options.logRootPath || DEFAULT_RELIABILITY_LOG_ROOT;
    this.indexPath = options.indexPath || DEFAULT_LOG_INDEX;
    this.indexCache = null;
  }

  /**
   * Enregistre un label pour une trace donnée
   * @param {string} turnId 
   * @param {string} label 
   * @param {string} comment 
   * @param {Object} metadata - (Optionnel) Schéma minimal conseillé : { errorType?: string, humanConfidence?: number, annotator?: string, notes?: string }
   */
  async labelTurn(turnId, label, comment = '', metadata = {}) {
    if (!this.labels.includes(label)) {
      throw new Error(`Label invalide: ${label}`);
    }

    await fs.ensureDir(path.dirname(this.dbPath));
    let db = {};
    try {
      if (await fs.pathExists(this.dbPath)) {
        db = await fs.readJson(this.dbPath);
      }
    } catch (e) {
      console.warn(`[GroundTruthService] Erreur lecture DB (${this.dbPath}), création d'une nouvelle base.`, e.message);
    }

    db[turnId] = {
      label,
      comment,
      metadata,
      timestamp: new Date().toISOString()
    };

    await fs.writeJson(this.dbPath, db, { spaces: 2 });
    return true;
  }

  /**
   * Trouve une trace de fiabilité par son turnId (avec indexation et auto-réparation)
   * @param {string} turnId 
   */
  async findLogById(turnId) {
    if (!(await fs.pathExists(this.logRootPath))) return null;

    // Chargement ou initialisation de l'index
    if (!this.indexCache) {
      try {
        if (await fs.pathExists(this.indexPath)) {
          this.indexCache = await fs.readJson(this.indexPath);
        } else {
          this.indexCache = {};
        }
      } catch (e) {
        this.indexCache = {}; // Fallback si illisible
      }
    }

    // Lookup O(1) avec auto-réparation
    if (this.indexCache[turnId]) {
      const cachedPath = this.indexCache[turnId];
      try {
        if (await fs.pathExists(cachedPath)) {
          const log = await fs.readJson(cachedPath);
          return log;
        }
      } catch (e) {
        // Fichier corrompu ou illisible, on laisse l'invalidation agir
      }
      // Si on arrive ici, le fichier n'existe plus ou est corrompu, on invalide l'entrée
      delete this.indexCache[turnId];
    }

    // Scan complet (fallback)
    const days = await fs.readdir(this.logRootPath);
    // On trie par date descendante pour trouver plus vite les récents
    days.sort().reverse();

    for (const day of days) {
      const dayPath = path.join(this.logRootPath, day);
      if (!(await fs.lstat(dayPath)).isDirectory()) continue;
      
      const targetFile = path.join(dayPath, `${turnId}.json`);
      try {
        if (await fs.pathExists(targetFile)) {
          const log = await fs.readJson(targetFile);
          
          // Mise à jour de l'index et sauvegarde
          this.indexCache[turnId] = targetFile;
          await fs.ensureDir(path.dirname(this.indexPath));
          await fs.writeJson(this.indexPath, this.indexCache, { spaces: 2 });
          
          return log;
        }
      } catch (e) {
        // On ignore les fichiers corrompus pendant le scan
      }
    }
    return null;
  }

  /**
   * Récupère le rapport de calibration complet (SMAC vs Vérité) avec détection de dérive statistique
   */
  async getCalibrationStats() {
    let db = {};
    try {
      if (await fs.pathExists(this.dbPath) && (await fs.stat(this.dbPath)).size > 0) {
        db = await fs.readJson(this.dbPath);
      }
    } catch (e) {
      console.warn("[GroundTruthService] Erreur lecture DB stats:", e.message);
    }

    const entries = Object.entries(db);
    if (entries.length === 0) {
      return { accuracy: 0, drift: 0, driftStdDev: 0, sampleSize: 0, recentSampleSize: 0, trend: 'stable' };
    }

    // On trie par timestamp pour avoir la chronologie
    entries.sort((a, b) => new Date(a[1].timestamp) - new Date(b[1].timestamp));

    const calculateForSlice = async (slice) => {
      let totalScoreGap = 0;
      let validPairs = 0;
      let correctCount = 0;
      const gaps = [];

      for (const [turnId, entry] of slice) {
        const log = await this.findLogById(turnId);
        if (!log) continue;
        const smacScore = log.criticReport?.score || 1.0;
        const groundTruthScore = entry.label === 'correct' ? 1.0 : entry.label === 'partially_correct' ? 0.5 : 0.0;
        if (entry.label === 'correct') correctCount++;
        const gap = smacScore - groundTruthScore;
        totalScoreGap += gap;
        gaps.push(gap);
        validPairs++;
      }
      
      const acc = validPairs > 0 ? (correctCount / validPairs) * 100 : 0;
      const drift = validPairs > 0 ? (totalScoreGap / validPairs) : 0;
      
      let variance = 0;
      let stdDev = 0;
      if (validPairs > 1) {
        const mean = drift;
        const sumSquares = gaps.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0);
        variance = sumSquares / (validPairs - 1); // variance d'échantillon
        stdDev = Math.sqrt(variance);
      }

      return { acc, drift, stdDev, variance, size: validPairs };
    };

    const global = await calculateForSlice(entries);
    const recent = await calculateForSlice(entries.slice(-10)); // Fenêtre glissante de 10

    // Détection de dérive (Tâche 7)
    const driftDelta = recent.drift - global.drift;
    let trend = 'stable';
    if (Math.abs(driftDelta) > 0.2) trend = driftDelta > 0 ? 'drifting_up' : 'drifting_down';

    return {
      accuracy: Math.round(global.acc),
      drift: parseFloat(global.drift.toFixed(2)),
      driftStdDev: parseFloat(global.stdDev.toFixed(2)),
      recentDrift: parseFloat(recent.drift.toFixed(2)),
      recentStdDev: parseFloat(recent.stdDev.toFixed(2)),
      sampleSize: global.size,
      recentSampleSize: recent.size, // Ajout du sample size récent
      trend,
      driftDelta: parseFloat(driftDelta.toFixed(2)),
      status: Math.abs(recent.drift) > 0.35 ? 'CRITICAL_DRIFT' : Math.abs(recent.drift) > 0.2 ? 'WARNING_DRIFT' : 'CALIBRATED',
      interpretation: recent.drift > 0.25 ? 'Sursécurisé (Over-blocked)' : recent.drift < -0.25 ? 'Trop confiant (Over-confident)' : 'Équilibré'
    };
  }

  /**
   * Récupère le taux de justesse réelle (Calibration)
   */
  async getAccuracyStats() {
    const baseStats = await this.getCalibrationStats();
    let db = {};
    try {
      if (await fs.pathExists(this.dbPath) && (await fs.stat(this.dbPath)).size > 0) {
        db = await fs.readJson(this.dbPath);
      }
    } catch (e) {
      console.warn("[GroundTruthService] Erreur lecture DB accuracy:", e.message);
    }
    
    const entries = Object.values(db);
    const total = entries.length;

    if (total === 0) {
      return { accuracy: 0, drift: 0, driftStdDev: 0, interpretation: 'Aucune donnée', distribution: {} };
    }
    
    const stats = {
      total,
      correct: entries.filter(e => e.label === 'correct').length,
      partially: entries.filter(e => e.label === 'partially_correct').length,
      incorrect: entries.filter(e => e.label === 'incorrect').length,
      overblocked: entries.filter(e => e.label === 'overblocked').length
    };

    return {
      accuracy: baseStats.accuracy,
      drift: baseStats.drift,
      driftStdDev: baseStats.driftStdDev,
      recentDrift: baseStats.recentDrift,
      recentStdDev: baseStats.recentStdDev,
      recentSampleSize: baseStats.recentSampleSize,
      trend: baseStats.trend,
      driftDelta: baseStats.driftDelta,
      status: baseStats.status,
      interpretation: baseStats.interpretation,
      distribution: stats
    };
  }

  /**
   * Récupère les annotations les plus récentes.
   * @param {number} limit 
   * @returns {Array} Liste des dernières traces annotées
   */
  async getRecentAnnotations(limit = 10) {
    let db = {};
    try {
      if (await fs.pathExists(this.dbPath)) {
        db = await fs.readJson(this.dbPath);
      }
    } catch (e) {
      console.warn("[GroundTruthService] Erreur lecture annotations récentes:", e.message);
      return [];
    }

    const entries = Object.entries(db).map(([turnId, data]) => ({ turnId, ...data }));
    // Tri décroissant sur le timestamp
    entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return entries.slice(0, limit);
  }
}

export default new GroundTruthService();
