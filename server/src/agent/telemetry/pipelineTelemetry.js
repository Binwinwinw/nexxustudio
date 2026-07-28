import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const metricsFile = path.join(__dirname, '../../../../data/pipeline_metrics.json');

// Initialiser le fichier si inexistant
if (!fs.existsSync(metricsFile)) {
  fs.mkdirSync(path.dirname(metricsFile), { recursive: true });
  fs.writeFileSync(metricsFile, '[]');
}

const MAX_ENTRIES = 200;
let lastRecordedMode = 'COMPOSER';

/**
 * Dernier mode pipeline enregistré (pour provenance mémoire curée).
 */
export function getLastPipelineMode() {
  return lastRecordedMode;
}

/**
 * Enregistrer une métrique de pipeline
 */
export function recordTurn(mode, ttft, tokens, success, error = null) {
  if (mode) lastRecordedMode = mode;
  let data = [];
  try {
    data = JSON.parse(fs.readFileSync(metricsFile, 'utf8') || '[]');
  } catch (e) {
    data = [];
  }
  
  data.push({
    id: Date.now(),
    timestamp: new Date().toISOString(),
    mode,
    ttft, // en ms
    tokens,
    success,
    error
  });
  
  // Garder les MAX_ENTRIES dernières entrées
  if (data.length > MAX_ENTRIES) {
    data.shift();
  }
  
  fs.writeFileSync(metricsFile, JSON.stringify(data, null, 2));
}

/**
 * Récupérer les statistiques agrégées
 */
export function getStats() {
  let data = [];
  try {
    data = JSON.parse(fs.readFileSync(metricsFile, 'utf8') || '[]');
  } catch (e) {
    data = [];
  }
  
  if (data.length === 0) {
    return {
      totalRequests: 0,
      modes: {
        INSTANT: { count: 0, pct: 0, avgTTFT: 0, avgTokens: 0, failRate: 0 },
        SIMPLE_FAST: { count: 0, pct: 0, avgTTFT: 0, avgTokens: 0, failRate: 0 },
        DOCUMENT: { count: 0, pct: 0, avgTTFT: 0, avgTokens: 0, failRate: 0 },
        CRITICAL: { count: 0, pct: 0, avgTTFT: 0, avgTokens: 0, failRate: 0 }
      },
      last24h: 0
    };
  }
  
  // Filtrer les 24h dernières
  const last24h = data.filter(m => {
    const date = new Date(m.timestamp);
    const now = new Date();
    return (now - date) < 24 * 60 * 60 * 1000;
  }).length;
  
  // Calculer les stats par mode
  const modes = {
    INSTANT: { entries: [], count: 0 },
    SIMPLE_FAST: { entries: [], count: 0 },
    DOCUMENT: { entries: [], count: 0 },
    CRITICAL: { entries: [], count: 0 }
  };
  
  data.forEach(m => {
    if (!modes[m.mode]) {
      modes[m.mode] = { entries: [], count: 0 };
    }
    modes[m.mode].entries.push(m);
    modes[m.mode].count++;
  });
  
  const stats = {};
  Object.keys(modes).forEach(mode => {
    const entries = modes[mode].entries;
    const count = entries.length;
    
    stats[mode] = {
      count,
      pct: count > 0 ? ((count / data.length) * 100).toFixed(1) : 0,
      avgTTFT: count > 0 ? (entries.reduce((sum, m) => sum + m.ttft, 0) / count).toFixed(0) : 0,
      avgTokens: count > 0 ? (entries.reduce((sum, m) => sum + m.tokens, 0) / count).toFixed(0) : 0,
      failRate: count > 0 ? ((entries.filter(m => !m.success).length / count) * 100).toFixed(1) : 0
    };
  });
  
  return {
    totalRequests: data.length,
    modes: stats,
    last24h
  };
}

/**
 * Récupérer les requêtes pour le tableau
 */
export function getRecent(limit = 50) {
  let data = [];
  try {
    data = JSON.parse(fs.readFileSync(metricsFile, 'utf8') || '[]');
  } catch (e) {
    data = [];
  }
  return data.slice(-limit).reverse();
}
