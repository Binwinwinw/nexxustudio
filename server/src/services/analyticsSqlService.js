const MUTATION_PATTERN = /\b(insert|update|delete|drop|alter|truncate|create|replace|grant|revoke)\b/i;
const ALLOWED_TABLES = new Set([
  'critic_audit_events',
  'critic_claim_verdicts'
]);

function assertReadOnlySql(sql) {
  const normalized = String(sql || '').trim().toLowerCase();

  if (!normalized.startsWith('select')) {
    throw new Error('Only SELECT statements are allowed');
  }

  if (normalized.includes(';')) {
    throw new Error('Multiple statements are not allowed');
  }

  if (MUTATION_PATTERN.test(normalized)) {
    throw new Error('Mutation keyword detected in SQL');
  }

  const referencedTables = [...normalized.matchAll(/\bfrom\s+([a-zA-Z0-9_]+)|\bjoin\s+([a-zA-Z0-9_]+)/g)]
    .flatMap(match => [match[1], match[2]])
    .filter(Boolean);

  for (const table of referencedTables) {
    if (!ALLOWED_TABLES.has(table)) {
      throw new Error(`Access to table "${table}" is not allowed`);
    }
  }
}

export async function executeAnalyticsQuery(db, query) {
  if (!db || typeof db.execute !== 'function') {
    throw new Error('A db client with execute(sql, params) is required');
  }

  if (!query || !query.sql) {
    throw new Error('Query object with sql and params is required');
  }

  assertReadOnlySql(query.sql);

  const params = Array.isArray(query.params) ? query.params : [];
  const [rows] = await db.execute(query.sql, params);

  return rows;
}

export function formatAnalyticsAnswer(plan, rows) {
  if (!plan || plan.intent === 'out_of_scope') {
    return {
      title: 'Demande hors périmètre',
      summary: "Cette demande ne relève pas de l'observabilité SQL du Critic.",
      table: [],
      interpretation: "Aucune requête SQL n'a été exécutée."
    };
  }

  if (!rows || rows.length === 0) {
    return {
      title: 'Aucune donnée',
      summary: `Aucune donnée disponible sur les ${plan.time_range_days} derniers jours.`,
      table: [],
      interpretation: "L'analyse ne peut pas être établie faute de données suffisantes."
    };
  }

  switch (plan.intent) {
    case 'critic_rejection_rate': {
      const row = rows[0];
      return {
        title: 'Taux de rejet du Critic',
        summary: `Sur les ${plan.time_range_days} derniers jours, le taux de rejet observé est de ${row.rejection_rate_pct ?? 0}%.`,
        table: [row],
        interpretation: `Le volume total analysé est de ${row.total_runs ?? 0} run(s).`
      };
    }

    case 'critic_failed_safe_count': {
      const row = rows[0];
      return {
        title: 'Runs failed_safe',
        summary: `Sur les ${plan.time_range_days} derniers jours, ${row.failed_safe_runs ?? 0} run(s) ont abouti à un statut failed_safe.`,
        table: [row],
        interpretation: "Ce chiffre mesure les arrêts sécurisés du pipeline."
      };
    }

    case 'critic_failure_modes':
      return {
        title: 'Modes d’échec dominants',
        summary: `Voici les modes d'échec les plus fréquents sur les ${plan.time_range_days} derniers jours.`,
        table: rows,
        interpretation: "Cette distribution permet d'identifier les dérives les plus fréquentes du pipeline."
      };

    case 'critic_latency_summary': {
      const row = rows[0];
      return {
        title: 'Résumé des latences',
        summary: `La latence moyenne globale est de ${row.avg_latency_ms ?? 0} ms, et la latence moyenne du Critic est de ${row.avg_critic_latency_ms ?? 0} ms.`,
        table: [row],
        interpretation: "Les pics maximums aident à repérer les branches d'exécution les plus coûteuses."
      };
    }

    case 'critic_verdict_trend':
      return {
        title: 'Évolution des verdicts',
        summary: `Voici la tendance observée sur les ${plan.time_range_days} derniers jours.`,
        table: rows,
        interpretation: "Une hausse ou baisse observée doit être interprétée prudemment sans causalité implicite."
      };

    case 'critic_source_mix':
      return {
        title: 'Répartition web / local',
        summary: `Voici la répartition agrégée des sources web et locales sur les ${plan.time_range_days} derniers jours.`,
        table: rows,
        interpretation: "Cette vue permet de surveiller la part relative des preuves locales et web."
      };

    case 'critic_claim_distribution':
      return {
        title: 'Distribution des verdicts de claims',
        summary: `Voici la distribution des verdicts au niveau claim sur les ${plan.time_range_days} derniers jours.`,
        table: rows,
        interpretation: "Cette répartition permet d'évaluer la sévérité réelle du Critic au niveau granulaire."
      };

    default:
      return {
        title: 'Analyse analytics',
        summary: 'Résultats disponibles.',
        table: rows,
        interpretation: 'Analyse terminée.'
      };
  }
}
