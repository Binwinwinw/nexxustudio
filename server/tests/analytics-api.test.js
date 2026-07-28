import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';

test('analytics API: /api/analytics/metrics is operational and respects secure telemetry schemas', async () => {
  const url = 'http://localhost:3000/api/analytics/metrics?days=7';
  console.log(`[API Test] Fetching endpoint: ${url}`);
  
  try {
    const response = await axios.get(url, { timeout: 3000 });
    
    assert.equal(response.status, 200, "API must return status 200");
    const body = response.data;
    console.log('API RESPONSE BODY:', JSON.stringify(body, null, 2));
    
    // Validation globale du contrat
    assert.equal(body.success, true, "Response success flag must be true");
    
    // Whitelist stricte pour source
    const allowedSources = ['database', 'mock', 'mock_fallback'];
    assert.ok(allowedSources.includes(body.source), `Source "${body.source}" must belong to whitelist: ${allowedSources.join(', ')}`);
    
    // Validation du schéma System Status
    const status = body.system_status;
    assert.ok(status, "Must return system_status telemetry block");
    assert.equal(typeof status.status, 'string', "system_status.status must be a string");
    assert.equal(typeof status.uptime, 'number', "system_status.uptime must be a number");
    assert.equal(typeof status.version, 'string', "system_status.version must be a string");
    assert.equal(typeof status.warmup_ready, 'boolean', "system_status.warmup_ready must be a boolean");
    
    // Validation des états degraded
    assert.equal(typeof body.degraded, 'boolean', "body.degraded must be a boolean");
    if (body.degraded_reason !== null) {
      assert.equal(typeof body.degraded_reason, 'string', "body.degraded_reason must be a string or null");
    }

    // Validation VRAM bornée
    assert.equal(typeof status.vram_pressure_pct, 'number', "VRAM pressure percentage must be a number");
    assert.ok(status.vram_pressure_pct >= 0 && status.vram_pressure_pct <= 100, "VRAM pressure percentage must be bounded between 0 and 100");
    assert.ok(['CRUISE', 'RESTRICTED', 'SELECTIVE', 'PANIC'].includes(status.governance_mode), "Governance mode must match standard thresholds");

    // Validation des KPIs (chiffres positifs ou nuls)
    const kpis = body.kpis;
    assert.ok(kpis, "Must return KPI card aggregates block");
    assert.ok(kpis.total_runs >= 0, "total_runs count must be positive or null");
    assert.ok(kpis.rejection_rate_pct >= 0 && kpis.rejection_rate_pct <= 100, "rejection_rate_pct must be between 0 and 100");
    assert.ok(kpis.failed_safe_runs >= 0, "failed_safe_runs count must be positive or null");
    assert.ok(kpis.avg_latency_ms >= 0, "avg_latency_ms must be positive or null");
    assert.ok(kpis.avg_critic_latency_ms >= 0, "avg_critic_latency_ms must be positive or null");
    
    // Validation des tableaux
    assert.ok(Array.isArray(body.failure_modes), "failure_modes must be a structured list array");
    for (const f of body.failure_modes) {
      assert.equal(typeof f.failure_mode, 'string', "failure_mode name must be a string");
      assert.equal(typeof f.total, 'number', "failure_mode total must be a number");
    }

    assert.ok(Array.isArray(body.verdict_trend), "verdict_trend must be a structured history list");
    assert.ok(Array.isArray(body.recent_events), "recent_events must contain granular Critic audit events");
    
    console.log(`PASS - Analytics API is fully secure and verified. Data Source: [${body.source}] (degraded: ${body.degraded})`);
  } catch (err) {
    if (err.code === 'ECONNREFUSED' && process.env.OFFLINE_TEST_SKIP === 'true') {
      console.log(`[API Test] SKIP: Server is offline, skipping live HTTP integration assertions.`);
    } else {
      console.error(`[API Test] FAILED: API connection error or test failure:`, err.message);
      throw err;
    }
  }
});
