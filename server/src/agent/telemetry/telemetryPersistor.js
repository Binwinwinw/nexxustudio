import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import knowledgeHub from '../../services/knowledgeHub.js';

/**
 * TelemetryPersistor - Version Robuste pour Audit.
 */
class TelemetryPersistor {
  constructor() {
    // On écrit à la racine absolue pour être sûr de voir le fichier
    this.signalPath = path.resolve(process.cwd(), 'FEEDBACK_SIGNAL.json');
  }

  async recordTurn(snapshot, sessionId) {
    const isSlow = snapshot.durationMs > 5000;
    const hasIncidents = snapshot.metrics.fallbackUsed > 0 || 
                         snapshot.metrics.repairTriggered > 0 || 
                         snapshot.metrics.securityObfuscations > 0;

    if (!hasIncidents && !isSlow) return;

    const feedbackData = {
      timestamp: new Date().toISOString(),
      query: snapshot.queryPreview,
      durationMs: snapshot.durationMs,
      incidents: hasIncidents,
      sessionId
    };

    const verdict = hasIncidents ? 'INCIDENT_DETECTED' : 'SLOW_RESPONSE';
    
    try {
      await fs.writeJson(this.signalPath, feedbackData, { spaces: 2 });
      await knowledgeHub.addDocuments([{
        id: `feedback_${Date.now()}`,
        content: `[FEEDBACK_LOOP][${verdict}] Query: ${snapshot.queryPreview} | Duration: ${snapshot.durationMs}ms`,
        metadata: { type: 'telemetry_feedback', isSlow, hasIncidents, verdict }
      }]);
    } catch (err) {
      console.error(`[TelemetryPersistor] recordTurn error:`, err.message);
    }
  }

  async recordAuditPerformance(metrics) {
    const { type, target, durationMs, autoIndexed, success, sessionId } = metrics;
    
    const auditLog = {
      timestamp: new Date().toISOString(),
      type,
      target,
      durationMs,
      autoIndexed,
      success,
      sessionId
    };

    try {
      const auditLogPath = path.resolve(process.cwd(), 'AUDIT_METRICS.json');
      let logs = [];
      try {
        logs = await fs.readJson(auditLogPath);
      } catch (e) { logs = []; }
      
      logs.push(auditLog);
      await fs.writeJson(auditLogPath, logs.slice(-100), { spaces: 2 });

      await knowledgeHub.addDocuments([{
        id: `audit_metric_${Date.now()}`,
        content: `[AUDIT_TELEMETRY][${type.toUpperCase()}] Target: ${target} | Duration: ${durationMs}ms | AutoIndexed: ${autoIndexed}`,
        metadata: { type: 'audit_metric', auditType: type, autoIndexed, success }
      }]);
    } catch (err) {
      console.error(`[TelemetryPersistor] recordAuditPerformance error:`, err.message);
    }
  }
}

export default new TelemetryPersistor();
