import test from 'node:test';
import assert from 'node:assert/strict';
import pool from '../src/db/connection.js';
import criticObservabilityService from '../src/services/criticObservabilityService.js';

test('critic observability service: logs event and claims correctly', async () => {
  const originalExecute = pool.execute;
  
  const loggedEvents = [];
  const loggedClaims = [];

  pool.execute = async (sql, values) => {
    if (sql.includes('INSERT INTO critic_audit_events')) {
      loggedEvents.push({ sql, values });
      return [{ insertId: 12345 }];
    }
    if (sql.includes('INSERT INTO critic_claim_verdicts')) {
      loggedClaims.push({ sql, values });
      return [{}];
    }
    return [{}];
  };

  const queryEnvelope = {
    query_id: 'q_obs_test_123',
    user_query: 'Est-ce que l\'expert web est performant ?',
    context: { session_id: 'session_obs_abc' }
  };

  const evidence = [
    { source_type: 'web', content: 'Web fact 1' },
    { source_type: 'local', content: 'Local fact 2' }
  ];

  const report = {
    overall_verdict: 'rejected_unsupported',
    failure_mode: 'unsupported',
    severity: 'high',
    claim_reviews: [
      {
        claim_text: 'L\'expert web répond en moins de 10ms.',
        verdict: 'unsupported',
        severity: 'high',
        fact_ids: [],
        reason: 'Aucune statistique de performance n\'indique 10ms.'
      },
      {
        claim_text: 'La Citadelle est résiliente.',
        verdict: 'supported',
        severity: 'low',
        fact_ids: ['fact_local_2'],
        reason: 'Soutenu par le fait de résilience.'
      }
    ],
    approved_answer: {
      question_reformulated: 'Est-ce que l\'expert web est performant ?',
      confirmed_section: [],
      unknown_section: ['L\'affirmation 10ms n\'est pas supportée.']
    }
  };

  try {
    const eventId = await criticObservabilityService.logCriticReport({
      queryEnvelope,
      evidence,
      report,
      criticLatencyMs: 250,
      pipelineLatencyMs: 1200
    });

    assert.equal(eventId, 12345);
    
    // Validate parent event insert parameters
    assert.equal(loggedEvents.length, 1);
    const parentValues = loggedEvents[0].values;
    
    // session_id, job_id, event_version, request_id, user_query, query_hash, overall_verdict, failure_mode, severity
    assert.equal(parentValues[0], 'session_obs_abc');
    assert.equal(parentValues[1], 'q_obs_test_123');
    assert.equal(parentValues[4], 'Est-ce que l\'expert web est performant ?');
    assert.equal(parentValues[6], 'rejected_unsupported');
    assert.equal(parentValues[7], 'unsupported');
    assert.equal(parentValues[8], 'high');

    // claims_total, claims_supported, claims_unsupported, claims_contradicted, claims_uncertain, claims_overclaim
    assert.equal(parentValues[9], 2); // claims_total
    assert.equal(parentValues[10], 1); // claims_supported
    assert.equal(parentValues[11], 1); // claims_unsupported

    // retrieval_count, local_sources_count, web_sources_count
    assert.equal(parentValues[15], 2); // retrieval_count
    assert.equal(parentValues[16], 1); // local_sources_count
    assert.equal(parentValues[17], 1); // web_sources_count

    // Latency
    assert.equal(parentValues[21], 1200); // latency_ms
    assert.equal(parentValues[22], 250); // critic_latency_ms

    // Validate claims verdicts bulk insert parameters
    assert.equal(loggedClaims.length, 1);
    const claimsValues = loggedClaims[0].values;
    assert.equal(claimsValues.length, 20); // 2 claims * 10 values each
    
    // Claim 1
    assert.equal(claimsValues[0], 12345); // critic_audit_event_id
    assert.equal(claimsValues[1], 0); // index
    assert.equal(claimsValues[2], 'L\'expert web répond en moins de 10ms.'); // text
    assert.equal(claimsValues[3], 'unsupported'); // verdict
    assert.equal(claimsValues[4], 'high'); // severity

    // Claim 2
    assert.equal(claimsValues[10], 12345); // critic_audit_event_id
    assert.equal(claimsValues[11], 1); // index
    assert.equal(claimsValues[12], 'La Citadelle est résiliente.'); // text
    assert.equal(claimsValues[13], 'supported'); // verdict
    assert.equal(claimsValues[14], 'low'); // severity

    console.log('PASS - critic observability logs events and claims correctly');
  } finally {
    pool.execute = originalExecute;
  }
});
