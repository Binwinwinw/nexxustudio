/**
 * Telemetry Observability — métriques agent, skills et alertes ops (production).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../agent/utils/skillRuntimeRegistry.js';

const DEFAULT_PERSIST_DIR = path.join(REPO_ROOT, 'server', 'data', 'telemetry');
const RANGE_MS = {
  '1h': 3_600_000,
  '24h': 86_400_000,
  '7d': 604_800_000,
};

export function resolveTelemetryPersistDir(config = {}) {
  if (config.persistDir) {
    return path.isAbsolute(config.persistDir)
      ? config.persistDir
      : path.join(REPO_ROOT, config.persistDir);
  }
  return DEFAULT_PERSIST_DIR;
}

export function hashQuery(query = '') {
  return crypto.createHash('sha256').update(String(query)).digest('hex').slice(0, 16);
}

export function parseTimeRangeMs(range = '24h') {
  return RANGE_MS[range] ?? RANGE_MS['24h'];
}

export function filterByTimeRange(metrics = [], range = '24h', now = new Date()) {
  const threshold = new Date(now.getTime() - parseTimeRangeMs(range));
  return metrics.filter((metric) => new Date(metric.timestamp) >= threshold);
}

export function groupByType(metrics = []) {
  return metrics.reduce((acc, metric) => {
    const type = metric.type || metric.skillId || 'unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
}

export function groupBySkill(metrics = []) {
  return metrics.reduce((acc, metric) => {
    if (metric.skillId) {
      acc[metric.skillId] = (acc[metric.skillId] || 0) + 1;
    }
    return acc;
  }, {});
}

export function calculateAvgAccuracy(metrics = []) {
  const accuracies = metrics
    .filter((metric) => typeof metric.accuracy === 'number')
    .map((metric) => metric.accuracy);
  if (accuracies.length === 0) return null;
  return accuracies.reduce((sum, value) => sum + value, 0) / accuracies.length;
}

export function generateAlerts(summary = {}, options = {}) {
  const alerts = [];
  const errorThreshold = options.errorRateThreshold ?? 0.05;
  const accuracyThreshold = options.accuracyThreshold ?? 0.85;
  const total = summary.totalMetrics ?? 0;

  if (total > 0) {
    const errorRate = (summary.errors?.length ?? 0) / total;
    if (errorRate > errorThreshold) {
      alerts.push({
        level: 'warning',
        message: `Taux d'erreur élevé: ${(errorRate * 100).toFixed(1)}%`,
        threshold: `${errorThreshold * 100}%`,
      });
    }
  }

  if (
    summary.avgAccuracy !== null &&
    summary.avgAccuracy !== undefined &&
    summary.avgAccuracy < accuracyThreshold
  ) {
    alerts.push({
      level: 'warning',
      message: `Accuracy moyenne basse: ${summary.avgAccuracy.toFixed(2)}`,
      threshold: String(accuracyThreshold),
    });
  }

  return alerts;
}

export class TelemetryObservability {
  constructor(config = {}) {
    this.persistDir = resolveTelemetryPersistDir(config);
    this.retentionDays = config.retentionDays ?? 30;
    this.sessionMetrics = [];
    this.agentMetrics = [];
  }

  async initialize() {
    fs.mkdirSync(this.persistDir, { recursive: true });
    return this;
  }

  recordAgentDecision(agentId, decision = {}, context = {}) {
    const metric = {
      timestamp: new Date().toISOString(),
      agentId,
      decision,
      context: {
        intent: context.intent ?? null,
        skillUsed: context.skillId ?? null,
        tokensUsed: context.tokens?.usage?.totalTokens ?? null,
        latencyMs: context.latencyMs ?? null,
      },
      outcome: decision.outcome || 'pending',
    };

    this.agentMetrics.push(metric);
    return metric;
  }

  recordSkillTrigger(skillId, query, triggered, accuracy) {
    const metric = {
      timestamp: new Date().toISOString(),
      type: 'skillTrigger',
      skillId,
      queryHash: hashQuery(query),
      triggered: Boolean(triggered),
      accuracy,
      source: 'skillTriggerMatrix',
    };

    this.sessionMetrics.push(metric);
    return metric;
  }

  recordConversationHealth(score, factors = []) {
    const metric = {
      timestamp: new Date().toISOString(),
      type: 'conversationHealth',
      score,
      factors,
    };

    this.sessionMetrics.push(metric);
    return metric;
  }

  recordError(errorType, errorMessage, context = {}) {
    const metric = {
      timestamp: new Date().toISOString(),
      type: 'error',
      errorType,
      errorMessage,
      context,
    };

    this.agentMetrics.push(metric);
    return metric;
  }

  readPersistedMetrics() {
    if (!fs.existsSync(this.persistDir)) {
      return [];
    }

    const files = fs
      .readdirSync(this.persistDir)
      .filter((fileName) => fileName.endsWith('.json'));

    const allMetrics = [];
    for (const fileName of files) {
      const filePath = path.join(this.persistDir, fileName);
      try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (Array.isArray(parsed)) {
          allMetrics.push(...parsed);
        }
      } catch {
        // Ignore fichiers corrompus — fail-closed sans bloquer le résumé.
      }
    }

    return allMetrics;
  }

  buildMetricsSummary(metrics = [], timeRange = '24h') {
    const filtered = filterByTimeRange(metrics, timeRange);
    return {
      totalMetrics: filtered.length,
      byType: groupByType(filtered),
      bySkill: groupBySkill(filtered),
      errors: filtered.filter((metric) => metric.type === 'error'),
      avgAccuracy: calculateAvgAccuracy(filtered),
    };
  }

  async getMetricsSummary(timeRange = '24h') {
    const inMemory = [...this.sessionMetrics, ...this.agentMetrics];
    const persisted = this.readPersistedMetrics();
    return this.buildMetricsSummary([...persisted, ...inMemory], timeRange);
  }

  async persist() {
    fs.mkdirSync(this.persistDir, { recursive: true });

    const sessionFile = path.join(this.persistDir, `session-${Date.now()}.json`);
    const agentFile = path.join(this.persistDir, `agent-${Date.now()}.json`);

    fs.writeFileSync(sessionFile, JSON.stringify(this.sessionMetrics, null, 2));
    fs.writeFileSync(agentFile, JSON.stringify(this.agentMetrics, null, 2));

    this.sessionMetrics = [];
    this.agentMetrics = [];

    await this.cleanupOldFiles();

    return { sessionFile, agentFile };
  }

  async cleanupOldFiles() {
    if (!fs.existsSync(this.persistDir)) return;

    const files = fs
      .readdirSync(this.persistDir)
      .filter((fileName) => fileName.endsWith('.json'));
    const now = Date.now();

    for (const fileName of files) {
      const filePath = path.join(this.persistDir, fileName);
      const stats = fs.statSync(filePath);
      const ageDays = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);
      if (ageDays > this.retentionDays) {
        fs.unlinkSync(filePath);
      }
    }
  }
}

export default TelemetryObservability;
