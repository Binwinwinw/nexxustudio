/* server/src/agent/telemetry/thermalTelemetry.js */
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const METRICS_PATH = path.resolve(__dirname, '../../../../server/data/telemetry/thermal_metrics.json');

class ThermalTelemetry {
  constructor() {
    this.metrics = {};
    this.governance = {
      panicCount: 0,
      restrictedCount: 0,
      totalPanicTime: 0,
      lastPanicStart: null
    };
    this.initialized = false;
    this.writePromise = Promise.resolve(); // Queue sérialisée pour empêcher les écritures concurrentes
  }

  async init() {
    try {
      const dir = path.dirname(METRICS_PATH);
      await fs.ensureDir(dir);

      // Nettoyage des .tmp orphelins au boot
      if (await fs.pathExists(dir)) {
        const files = await fs.readdir(dir);
        for (const file of files) {
          if (file.endsWith('.tmp')) {
            try {
              await fs.remove(path.join(dir, file));
            } catch (_) {}
          }
        }
      }

      if (await fs.pathExists(METRICS_PATH)) {
        const data = await fs.readJson(METRICS_PATH);
        this.metrics = data.models || {};
        this.governance = data.governance || this.governance;
      }
      this.initialized = true;
      console.log('[ThermalTelemetry] 📊 Metrics persistent layer initialized.');
    } catch (err) {
      console.error('[ThermalTelemetry] ⚠️ Persistent file corrupted, self-healing in progress:', err.message);
      this.metrics = {};
      this.initialized = true;
      await this.persist();
    }
  }

  async recordEvent(model, type, data = {}) {
    if (!this.initialized) await this.init();

    if (!this.metrics[model]) {
      this.metrics[model] = {
        reloads: 0,
        evictions: 0,
        hits: 0,
        avgLoadTime: 0,
        totalResidentTime: 0,
        lastLoaded: null
      };
    }

    const m = this.metrics[model];

    switch (type) {
      case 'reload':
        m.reloads++;
        if (data.loadTime) {
          // EMA smoothing (alpha = 0.3) : Favor recent performance
          const alpha = 0.3;
          m.avgLoadTime = m.avgLoadTime === 0 
            ? data.loadTime 
            : (alpha * data.loadTime) + (1 - alpha) * m.avgLoadTime;
        }
        m.lastLoaded = Date.now();
        break;
      case 'eviction':
        m.evictions++;
        if (m.lastLoaded) {
          m.totalResidentTime += (Date.now() - m.lastLoaded);
          m.lastLoaded = null;
        }
        break;
      case 'hit':
        m.hits++;
        break;
    }

    await this.persist();
  }

  async persist() {
    this.writePromise = this.writePromise.then(async () => {
      const tempPath = METRICS_PATH + '.tmp';
      try {
        const payload = {
          models: this.metrics,
          governance: this.governance
        };
        // 1. Écriture atomique dans un fichier temporaire
        await fs.writeJson(tempPath, payload, { spaces: 2 });
        // 2. Renommer/Déplacer de manière atomique au niveau de l'OS (écrase le fichier cible proprement)
        await fs.move(tempPath, METRICS_PATH, { overwrite: true });
      } catch (err) {
        // Nettoyage sécurisé du fichier temporaire en cas d'erreur
        try {
          if (await fs.pathExists(tempPath)) {
            await fs.remove(tempPath);
          }
        } catch (_) {}
      }
    });

    return this.writePromise;
  }

  recordPanic(start = true) {
    if (start) {
      this.governance.panicCount++;
      this.governance.lastPanicStart = Date.now();
    } else if (this.governance.lastPanicStart) {
      this.governance.totalPanicTime += (Date.now() - this.governance.lastPanicStart);
      this.governance.lastPanicStart = null;
    }
    this.persist();
  }

  recordRestricted() {
    this.governance.restrictedCount++;
    this.persist();
  }

  getStats(model) {
    return this.metrics[model] || null;
  }

  getAllStats() {
    return this.metrics;
  }
}

export default new ThermalTelemetry();
