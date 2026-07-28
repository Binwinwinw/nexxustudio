/* server/src/routes/analyticsApi.js */
import { Router } from 'express';
import pool from '../db/connection.js';
import { buildAnalyticsPlan, buildSqlFromPlan } from '../services/analyticsQueryBuilder.js';
import { executeAnalyticsQuery } from '../services/analyticsSqlService.js';
import { warmupStatus } from '../services/warmupService.js';
import ollama from '../llm/ollama.js';

const router = Router();

// Whitelist et Enumérations Strictes
const ALLOWED_DAYS = new Set([1, 7, 14, 30]);

const SourceEnum = {
  DATABASE: 'database',
  MOCK: 'mock',
  MOCK_FALLBACK: 'mock_fallback'
};

// ── Fonction de Génération de Données Mockées (Haute Qualité) ──────────────────
function generatePremiumMockData(days) {
  const kpis = {
    total_runs: 164,
    rejection_runs: 14,
    failed_safe_runs: 5,
    rejection_rate_pct: 8.54,
    avg_latency_ms: 1385.4,
    avg_critic_latency_ms: 242.8,
    max_latency_ms: 4280,
    max_critic_latency_ms: 590
  };

  const failure_modes = [
    { failure_mode: 'rejected_overclaim', total: 7 },
    { failure_mode: 'rejected_unsupported', total: 4 },
    { failure_mode: 'rejected_contradicted', total: 3 }
  ];

  const source_mix = [];
  const verdict_trend = [];
  const recent_events = [];

  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    const dayStr = date.toISOString().split('T')[0];

    const runs = Math.floor(Math.random() * 15) + 10;
    const rejections = Math.floor(Math.random() * 3);
    const failedSafe = Math.random() > 0.7 ? 1 : 0;
    const webSources = runs * 3 + Math.floor(Math.random() * 10);
    const localSources = runs * 5 + Math.floor(Math.random() * 15);

    source_mix.push({
      day: dayStr,
      web_sources: webSources,
      local_sources: localSources,
      runs
    });

    verdict_trend.push({
      day: dayStr,
      total_runs: runs,
      rejected_runs: rejections,
      failed_safe_runs: failedSafe,
      rejection_rate_pct: parseFloat((100 * rejections / runs).toFixed(1))
    });
  }

  const verdicts = ['approved', 'approved_with_caveats', 'rejected_overclaim', 'rejected_unsupported', 'failed_safe'];
  for (let i = 0; i < 5; i++) {
    const eventDate = new Date();
    eventDate.setMinutes(now.getMinutes() - (i * 24 + Math.floor(Math.random() * 15)));
    const verdict = verdicts[i % verdicts.length];

    recent_events.push({
      id: 1000 - i,
      session_id: `session-2026-05-${19 - i}`,
      overall_verdict: verdict,
      latency_ms: Math.floor(Math.random() * 1200) + 800,
      critic_latency_ms: Math.floor(Math.random() * 150) + 150,
      web_sources_count: verdict.includes('rejected') ? 0 : Math.floor(Math.random() * 4) + 1,
      local_sources_count: Math.floor(Math.random() * 6) + 2,
      created_at: eventDate.toISOString()
    });
  }

  return { kpis, failure_modes, source_mix, verdict_trend, recent_events };
}

// ── GET /api/analytics/metrics ────────────────────────────────────────────────
router.get('/api/analytics/metrics', async (req, res) => {
  const rawDays = req.query.days;
  const days = rawDays ? parseInt(rawDays, 10) : 7;
  
  // Validation stricte du paramètre temporal
  if (isNaN(days) || !ALLOWED_DAYS.has(days)) {
    return res.status(400).json({ 
      success: false, 
      error: "Paramètre temporal invalide. Seules les valeurs [1, 7, 14, 30] sont autorisées." 
    });
  }

  // 1. Télémétrie Système & VRAM (calcul asynchrone await requis)
  let pressureGb = 4.5;
  try {
    if (ollama && typeof ollama.calculateVRAMPressure === 'function') {
      pressureGb = await ollama.calculateVRAMPressure();
    }
  } catch (err) {
    console.warn(`[AnalyticsAPI] Échec lecture pression VRAM: ${err.message}`);
  }

  const vramLimit = 20;
  const pressurePct = Math.max(0, Math.min(100, Math.round((pressureGb / vramLimit) * 100)));
  
  let governanceMode = 'CRUISE';
  if (pressurePct > 85) governanceMode = 'PANIC';
  else if (pressurePct > 75) governanceMode = 'RESTRICTED';
  else if (pressurePct > 60) governanceMode = 'SELECTIVE';

  const system_status = {
    status: 'ready',
    uptime: process.uptime(),
    version: '5.0-souverain',
    warmup_ready: Boolean(warmupStatus?.isReady),
    governance_mode: governanceMode,
    vram_pressure_pct: pressurePct
  };

  try {
    // Construction et planification des requêtes SQL (avec des chaînes de requête whitelisted précises)
    const kpiPlan = buildAnalyticsPlan(`rejets du critic sur les ${days} jours`);
    const kpiSql = buildSqlFromPlan(kpiPlan);

    const failSafePlan = buildAnalyticsPlan(`failed_safe sur les ${days} jours`);
    const failSafeSql = buildSqlFromPlan(failSafePlan);

    const latencyPlan = buildAnalyticsPlan(`latence moyenne sur les ${days} jours`);
    const latencySql = buildSqlFromPlan(latencyPlan);

    const failureModesPlan = buildAnalyticsPlan(`modes d'echec sur les ${days} jours`);
    const failureModesSql = buildSqlFromPlan(failureModesPlan);

    const sourcePlan = buildAnalyticsPlan(`source mix sur les ${days} jours`);
    const sourceSql = buildSqlFromPlan(sourcePlan);

    const trendPlan = buildAnalyticsPlan(`evolution des verdicts sur les ${days} jours`);
    const trendSql = buildSqlFromPlan(trendPlan);

    // Parallélisation massive de toutes les requêtes d'observabilité
    const [
      kpiRows,
      failSafeRows,
      latencyRows,
      failureModesRows,
      sourceRows,
      trendRows,
      recentEventsResult
    ] = await Promise.all([
      executeAnalyticsQuery(pool, kpiSql),
      executeAnalyticsQuery(pool, failSafeSql),
      executeAnalyticsQuery(pool, latencySql),
      executeAnalyticsQuery(pool, failureModesSql),
      executeAnalyticsQuery(pool, sourceSql),
      executeAnalyticsQuery(pool, trendSql),
      pool.execute(`
        SELECT id, session_id, overall_verdict, latency_ms, critic_latency_ms, web_sources_count, local_sources_count, created_at
        FROM critic_audit_events
        ORDER BY id DESC
        LIMIT 15
      `)
    ]);

    const recentRows = recentEventsResult[0] || [];
    const totalRuns = kpiRows[0]?.total_runs || 0;

    // Mode dégradé si aucune ligne présente dans le RAG dur d'observabilité
    if (totalRuns === 0) {
      const mock = generatePremiumMockData(days);
      return res.json({
        success: true,
        source: SourceEnum.MOCK,
        degraded: true,
        degraded_reason: "Aucun run disponible dans la base de données de télémétrie. Mode dégradé actif.",
        system_status,
        ...mock
      });
    }

    res.json({
      success: true,
      source: SourceEnum.DATABASE,
      degraded: false,
      degraded_reason: null,
      system_status,
      kpis: {
        total_runs: totalRuns,
        rejection_runs: kpiRows[0]?.rejected_runs || 0,
        failed_safe_runs: failSafeRows[0]?.failed_safe_runs || 0,
        rejection_rate_pct: kpiRows[0]?.rejection_rate_pct || 0,
        avg_latency_ms: latencyRows[0]?.avg_latency_ms || 0,
        avg_critic_latency_ms: latencyRows[0]?.avg_critic_latency_ms || 0,
        max_latency_ms: latencyRows[0]?.max_latency_ms || 0,
        max_critic_latency_ms: latencyRows[0]?.max_critic_latency_ms || 0
      },
      failure_modes: failureModesRows,
      source_mix: sourceRows,
      verdict_trend: trendRows,
      recent_events: recentRows
    });

  } catch (err) {
    console.error(`[AnalyticsAPI] Erreur d'accès base. Secours dégradé actif: ${err.message}`);
    const mock = generatePremiumMockData(days);
    res.json({
      success: true,
      source: SourceEnum.MOCK_FALLBACK,
      degraded: true,
      degraded_reason: err.message,
      system_status,
      ...mock
    });
  }
});

export default router;
