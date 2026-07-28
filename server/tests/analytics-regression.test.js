import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAnalyticsPlan, buildSqlFromPlan } from '../src/services/analyticsQueryBuilder.js';
import { executeAnalyticsQuery, formatAnalyticsAnswer } from '../src/services/analyticsSqlService.js';

test('analytics query builder: rejection rate intent is detected', () => {
  const plan = buildAnalyticsPlan('Quel est le taux de rejet du Critic sur 7 jours ?');
  assert.equal(plan.intent, 'critic_rejection_rate');
  assert.equal(plan.sql_template_id, 'rejection_rate');
  assert.equal(plan.time_range_days, 7);
});

test('analytics query builder: source mix intent is detected', () => {
  const plan = buildAnalyticsPlan('Montre moi les sources web vs local sur 30 jours');
  assert.equal(plan.intent, 'critic_source_mix');
  assert.equal(plan.sql_template_id, 'source_mix');
  assert.equal(plan.time_range_days, 30);
});

test('analytics query builder: out of scope request is rejected', () => {
  const plan = buildAnalyticsPlan('Écris-moi un poème sur La Citadelle');
  assert.equal(plan.intent, 'out_of_scope');
  assert.equal(plan.needs_sql, false);
  assert.equal(plan.sql_template_id, null);
});

test('analytics sql builder: produces whitelisted select for rejection rate', () => {
  const plan = buildAnalyticsPlan('Quel est le taux de rejet du Critic sur 14 jours ?');
  const query = buildSqlFromPlan(plan);
  assert.match(query.sql, /from critic_audit_events/i);
  assert.deepEqual(query.params, [14]);
});

test('analytics sql service: blocks mutation attempts', async () => {
  const db = {
    async execute() {
      return [[]];
    }
  };

  await assert.rejects(
    () => executeAnalyticsQuery(db, {
      sql: 'DELETE FROM critic_audit_events WHERE 1=1',
      params: []
    }),
    /Only SELECT statements are allowed|Mutation keyword detected/
  );
});

test('analytics sql service: blocks access to non whitelisted tables', async () => {
  const db = {
    async execute() {
      return [[]];
    }
  };

  await assert.rejects(
    () => executeAnalyticsQuery(db, {
      sql: 'SELECT * FROM users',
      params: []
    }),
    /not allowed/
  );
});

test('analytics sql service: executes valid query in read only mode', async () => {
  const db = {
    async execute(sql, params) {
      assert.match(sql, /select/i);
      assert.deepEqual(params, [7]);
      return [[{
        total_runs: 10,
        rejected_runs: 3,
        failed_safe_runs: 1,
        rejection_rate_pct: 30.0
      }]];
    }
  };

  const plan = buildAnalyticsPlan('Quel est le taux de rejet du Critic sur 7 jours ?');
  const query = buildSqlFromPlan(plan);
  const rows = await executeAnalyticsQuery(db, query);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].rejection_rate_pct, 30.0);
});

test('analytics formatter: formats rejection rate response', () => {
  const plan = buildAnalyticsPlan('Quel est le taux de rejet du Critic sur 7 jours ?');
  const answer = formatAnalyticsAnswer(plan, [{
    total_runs: 10,
    rejected_runs: 3,
    failed_safe_runs: 1,
    rejection_rate_pct: 30.0
  }]);

  assert.match(answer.summary, /30/);
  assert.equal(answer.table.length, 1);
});

test('analytics formatter: returns no data message on empty rows', () => {
  const plan = buildAnalyticsPlan('Quels sont les failure modes sur 7 jours ?');
  const answer = formatAnalyticsAnswer(plan, []);

  assert.match(answer.summary, /Aucune donnée disponible/i);
  assert.equal(answer.table.length, 0);
});
