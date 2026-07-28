const ALLOWED_INTENTS = new Set([
  'critic_rejection_rate',
  'critic_failed_safe_count',
  'critic_failure_modes',
  'critic_latency_summary',
  'critic_verdict_trend',
  'critic_source_mix',
  'critic_claim_distribution',
  'out_of_scope'
]);

const ALLOWED_TEMPLATES = new Set([
  'rejection_rate',
  'failed_safe_count',
  'failure_modes_top',
  'latency_summary',
  'verdict_trend',
  'source_mix',
  'claim_distribution'
]);

function normalizeText(input) {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function extractTimeRangeDays(text) {
  if (/30\s*jours|mois/.test(text)) return 30;
  if (/14\s*jours|2\s*semaines/.test(text)) return 14;
  if (/24\s*heures|1\s*jour/.test(text)) return 1;
  return 7;
}

function extractFilters(text) {
  const verdictMatch = text.match(/\b(approved_with_caveats|approved|rejected_unsupported|rejected_overclaim|rejected_contradicted|rejected_precheck|failed_safe)\b/);
  const failureModeMatch = text.match(/failure mode\s+([a-z0-9_\-]+)/i);
  const sessionMatch = text.match(/session\s+([a-zA-Z0-9_\-:.]+)/i);

  return {
    session_id: sessionMatch ? sessionMatch[1] : null,
    verdict: verdictMatch ? verdictMatch[1] : null,
    failure_mode: failureModeMatch ? failureModeMatch[1] : null
  };
}

function detectIntent(rawQuestion) {
  const text = normalizeText(rawQuestion);

  if (/(taux de rejet|rejection rate|rejets du critic)/.test(text)) {
    return { intent: 'critic_rejection_rate', sql_template_id: 'rejection_rate' };
  }

  if (/(failed_safe|echec securise|echec securise|echecs failsafe)/.test(text)) {
    return { intent: 'critic_failed_safe_count', sql_template_id: 'failed_safe_count' };
  }

  if (/(failure mode|failure modes|modes d'echec|modes d echec|top failures)/.test(text)) {
    return { intent: 'critic_failure_modes', sql_template_id: 'failure_modes_top' };
  }

  if (/(latence du critic|critic latency|latence moyenne|temps moyen)/.test(text)) {
    return { intent: 'critic_latency_summary', sql_template_id: 'latency_summary' };
  }

  if (/(evolution des verdicts|tendance des verdicts|verdict trend|evolution dans le temps)/.test(text)) {
    return { intent: 'critic_verdict_trend', sql_template_id: 'verdict_trend' };
  }

  if (/(sources web|sources locales|web vs local|source mix)/.test(text)) {
    return { intent: 'critic_source_mix', sql_template_id: 'source_mix' };
  }

  if (/(claims rejetees|distribution des claims|claims unsupported|claims contradicted)/.test(text)) {
    return { intent: 'critic_claim_distribution', sql_template_id: 'claim_distribution' };
  }

  return { intent: 'out_of_scope', sql_template_id: null };
}

export function buildAnalyticsPlan(question) {
  const text = normalizeText(question);
  const { intent, sql_template_id } = detectIntent(text);
  const time_range_days = intent === 'out_of_scope' ? null : extractTimeRangeDays(text);
  const filters = extractFilters(text);

  const plan = {
    intent,
    time_range_days,
    filters,
    question_rewritten: question,
    needs_sql: intent !== 'out_of_scope',
    sql_template_id,
    explanation_style: 'concise'
  };

  if (!ALLOWED_INTENTS.has(plan.intent)) {
    throw new Error(`Unsupported analytics intent: ${plan.intent}`);
  }

  if (plan.sql_template_id && !ALLOWED_TEMPLATES.has(plan.sql_template_id)) {
    throw new Error(`Unsupported SQL template: ${plan.sql_template_id}`);
  }

  return plan;
}

export function buildSqlFromPlan(plan) {
  if (!plan || plan.intent === 'out_of_scope' || !plan.needs_sql) {
    return null;
  }

  const days = Number.isInteger(plan.time_range_days) ? plan.time_range_days : 7;

  switch (plan.sql_template_id) {
    case 'rejection_rate':
      return {
        sql: `
SELECT
  COUNT(*) AS total_runs,
  SUM(overall_verdict LIKE 'rejected%') AS rejected_runs,
  SUM(overall_verdict = 'failed_safe') AS failed_safe_runs,
  ROUND(100 * SUM(overall_verdict LIKE 'rejected%') / NULLIF(COUNT(*), 0), 2) AS rejection_rate_pct
FROM critic_audit_events
WHERE created_at >= NOW() - INTERVAL ? DAY
`,
        params: [days]
      };

    case 'failed_safe_count':
      return {
        sql: `
SELECT
  COUNT(*) AS failed_safe_runs
FROM critic_audit_events
WHERE overall_verdict = 'failed_safe'
  AND created_at >= NOW() - INTERVAL ? DAY
`,
        params: [days]
      };

    case 'failure_modes_top':
      return {
        sql: `
SELECT
  COALESCE(failure_mode, 'none') AS failure_mode,
  COUNT(*) AS total
FROM critic_audit_events
WHERE created_at >= NOW() - INTERVAL ? DAY
GROUP BY COALESCE(failure_mode, 'none')
ORDER BY total DESC
LIMIT 10
`,
        params: [days]
      };

    case 'latency_summary':
      return {
        sql: `
SELECT
  COUNT(*) AS total_runs,
  ROUND(AVG(latency_ms), 2) AS avg_latency_ms,
  ROUND(AVG(critic_latency_ms), 2) AS avg_critic_latency_ms,
  MAX(latency_ms) AS max_latency_ms,
  MAX(critic_latency_ms) AS max_critic_latency_ms
FROM critic_audit_events
WHERE created_at >= NOW() - INTERVAL ? DAY
`,
        params: [days]
      };

    case 'verdict_trend':
      return {
        sql: `
SELECT
  DATE(created_at) AS day,
  COUNT(*) AS total_runs,
  SUM(overall_verdict LIKE 'rejected%') AS rejected_runs,
  SUM(overall_verdict = 'failed_safe') AS failed_safe_runs,
  ROUND(100 * SUM(overall_verdict LIKE 'rejected%') / NULLIF(COUNT(*), 0), 2) AS rejection_rate_pct
FROM critic_audit_events
WHERE created_at >= NOW() - INTERVAL ? DAY
GROUP BY DATE(created_at)
ORDER BY day ASC
`,
        params: [days]
      };

    case 'source_mix':
      return {
        sql: `
SELECT
  DATE(created_at) AS day,
  SUM(web_sources_count) AS web_sources,
  SUM(local_sources_count) AS local_sources,
  COUNT(*) AS runs
FROM critic_audit_events
WHERE created_at >= NOW() - INTERVAL ? DAY
GROUP BY DATE(created_at)
ORDER BY day ASC
`,
        params: [days]
      };

    case 'claim_distribution':
      return {
        sql: `
SELECT
  verdict,
  COALESCE(failure_mode, 'none') AS failure_mode,
  COUNT(*) AS total
FROM critic_claim_verdicts
WHERE created_at >= NOW() - INTERVAL ? DAY
GROUP BY verdict, COALESCE(failure_mode, 'none')
ORDER BY total DESC
LIMIT 20
`,
        params: [days]
      };

    default:
      throw new Error(`Unhandled SQL template: ${plan.sql_template_id}`);
  }
}
