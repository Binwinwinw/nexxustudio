#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_BASE_URL = process.env.PIPELINE_BASE_URL || 'http://127.0.0.1:3000';
const DEFAULT_ENDPOINT = process.env.PIPELINE_ENDPOINT || '/api/pipeline/submit';
const DEFAULT_JOB_ENDPOINT = process.env.PIPELINE_JOB_ENDPOINT || '/api/pipeline';
const POLLING_INTERVAL_MS = 1000;
const DEFAULT_TIMEOUT_MS = 45000;

function parseArgs(argv) {
  const args = {
    dataset: 'datasets/critic_calibration_prompts.json',
    baseUrl: DEFAULT_BASE_URL,
    endpoint: DEFAULT_ENDPOINT,
    jobEndpoint: DEFAULT_JOB_ENDPOINT,
    raw: false,
    wave: null,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    output: null
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dataset') args.dataset = argv[++i];
    else if (a === '--base-url') args.baseUrl = argv[++i];
    else if (a === '--endpoint') args.endpoint = argv[++i];
    else if (a === '--job-endpoint') args.jobEndpoint = argv[++i];
    else if (a === '--wave') args.wave = argv[++i];
    else if (a === '--timeout-ms') args.timeoutMs = Number(argv[++i]);
    else if (a === '--output') args.output = argv[++i];
    else if (a === '--raw') args.raw = true;
  }

  return args;
}

async function readJson(filePath) {
  const abs = path.resolve(process.cwd(), filePath);
  const content = await fs.readFile(abs, 'utf8');
  return JSON.parse(content);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function submitQuery(baseUrl, endpoint, query) {
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query })
  });

  if (!res.ok) {
    throw new Error(`submitQuery failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

async function pollJob(baseUrl, jobEndpoint, submitResult, timeoutMs) {
  if (!submitResult || !submitResult.job_id) {
    return submitResult;
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const res = await fetch(`${baseUrl}${jobEndpoint}/${submitResult.job_id}`);
    if (!res.ok) {
      throw new Error(`pollJob failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    if (data.status && ['completed', 'failed', 'failed_safe', 'rejected'].includes(data.status)) {
      return data;
    }

    await sleep(POLLING_INTERVAL_MS);
  }

  throw new Error(`pollJob timeout after ${timeoutMs}ms`);
}

function safeLower(v) {
  return String(v || '').trim().toLowerCase();
}

function extractStageSummary(result) {
  const status = result?.status || result?.overall_status || null;
  const overallVerdict =
    result?.overall_verdict ||
    result?.critic_report?.overall_verdict ||
    result?.verdict ||
    null;

  const failureMode =
    result?.failure_mode ||
    result?.critic_report?.failure_mode ||
    result?.error_code ||
    null;

  const claimReviews =
    result?.critic_report?.claim_reviews ||
    result?.claim_reviews ||
    [];

  const finalAnswer =
    result?.final_answer ||
    result?.answer ||
    result?.response ||
    result?.content ||
    '';

  return {
    status,
    overallVerdict,
    failureMode,
    claimReviews,
    finalAnswer,
    raw: result
  };
}

function classifyOutcome(summary, expectedVerdict) {
  const actual = safeLower(summary.overallVerdict || summary.status);
  const expected = safeLower(expectedVerdict);

  if (actual === expected) return 'match';

  if (expected.startsWith('rejected') && !actual.startsWith('rejected')) {
    return 'false_negative';
  }

  if (!expected.startsWith('rejected') && actual.startsWith('rejected')) {
    return 'false_positive';
  }

  return 'mismatch';
}

function evaluateScenario(summary, scenario) {
  const expectedVerdict = scenario.expected_verdict || scenario.expected_best_verdict;
  const expectedFailureMode = scenario.expected_failure_mode || null;

  const outcome = classifyOutcome(summary, expectedVerdict);

  const verdictMatch = safeLower(summary.overallVerdict || summary.status) === safeLower(expectedVerdict);
  const failureModeMatch = expectedFailureMode
    ? safeLower(summary.failureMode) === safeLower(expectedFailureMode)
    : true;

  return {
    id: scenario.id,
    query: scenario.query,
    expectedVerdict,
    actualVerdict: summary.overallVerdict || summary.status || 'unknown',
    expectedFailureMode,
    actualFailureMode: summary.failureMode || null,
    severityExpected: scenario.severity_expected || scenario.severity || null,
    outcome,
    verdictMatch,
    failureModeMatch,
    passed: verdictMatch && failureModeMatch
  };
}

function pad(str, len) {
  const s = String(str ?? '');
  return s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length);
}

function printWaveReport(wave, results) {
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const falsePositives = results.filter(r => r.outcome === 'false_positive').length;
  const falseNegatives = results.filter(r => r.outcome === 'false_negative').length;
  const mismatches = results.filter(r => r.outcome === 'mismatch').length;
  const successRate = total ? ((passed / total) * 100).toFixed(1) : '0.0';

  console.log(`\n=== ${wave.name} (${wave.id}) ===`);
  console.log(`Description : ${wave.description}`);
  console.log(`Total       : ${total}`);
  console.log(`Réussite    : ${passed}/${total} (${successRate}%)`);
  console.log(`Faux +      : ${falsePositives}`);
  console.log(`Faux -      : ${falseNegatives}`);
  console.log(`Mismatchs   : ${mismatches}`);
  console.log('');
  console.log(
    [
      pad('ID', 16),
      pad('Expected', 24),
      pad('Actual', 24),
      pad('FailureMode', 18),
      pad('Outcome', 16)
    ].join(' | ')
  );
  console.log('-'.repeat(110));

  for (const r of results) {
    console.log(
      [
        pad(r.id, 16),
        pad(r.expectedVerdict, 24),
        pad(r.actualVerdict, 24),
        pad(r.actualFailureMode || '-', 18),
        pad(r.outcome, 16)
      ].join(' | ')
    );
  }
}

function buildGlobalSummary(allResults) {
  const total = allResults.length;
  const passed = allResults.filter(r => r.passed).length;
  const falsePositives = allResults.filter(r => r.outcome === 'false_positive').length;
  const falseNegatives = allResults.filter(r => r.outcome === 'false_negative').length;
  const mismatches = allResults.filter(r => r.outcome === 'mismatch').length;
  const successRate = total ? ((passed / total) * 100).toFixed(1) : '0.0';

  const litigieux = allResults
    .filter(r => !r.passed)
    .slice(0, 5)
    .map(r => ({
      id: r.id,
      expected: r.expectedVerdict,
      actual: r.actualVerdict,
      failure_mode: r.actualFailureMode,
      outcome: r.outcome,
      query: r.query
    }));

  return {
    total,
    passed,
    successRate,
    falsePositives,
    falseNegatives,
    mismatches,
    litigieux
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const dataset = await readJson(args.dataset);

  const waves = args.wave
    ? dataset.waves.filter(w => w.id === args.wave)
    : dataset.waves;

  if (!waves.length) {
    throw new Error(`No wave found for filter: ${args.wave}`);
  }

  const allResults = [];

  for (const wave of waves) {
    const waveResults = [];

    for (const scenario of wave.prompts) {
      try {
        const submitResult = await submitQuery(args.baseUrl, args.endpoint, scenario.query);
        const finalResult = await pollJob(args.baseUrl, args.jobEndpoint, submitResult, args.timeoutMs);
        const summary = extractStageSummary(finalResult);
        const evaluation = evaluateScenario(summary, scenario);

        waveResults.push(evaluation);
        allResults.push(evaluation);

        if (args.raw) {
          console.log(`\n[RAW] ${scenario.id}`);
          console.dir(summary.raw, { depth: 6, colors: true });
        }
      } catch (error) {
        const failed = {
          id: scenario.id,
          query: scenario.query,
          expectedVerdict: scenario.expected_verdict || scenario.expected_best_verdict,
          actualVerdict: 'runner_error',
          expectedFailureMode: scenario.expected_failure_mode || null,
          actualFailureMode: 'runner_error',
          severityExpected: scenario.severity_expected || null,
          outcome: 'mismatch',
          verdictMatch: false,
          failureModeMatch: false,
          passed: false,
          error: String(error.message || error)
        };
        waveResults.push(failed);
        allResults.push(failed);
      }
    }

    printWaveReport(wave, waveResults);
  }

  const summary = buildGlobalSummary(allResults);

  console.log('\n=== Synthèse Globale ===');
  console.log(`Total scénarios : ${summary.total}`);
  console.log(`Succès oracle   : ${summary.passed}/${summary.total} (${summary.successRate}%)`);
  console.log(`Faux positifs   : ${summary.falsePositives}`);
  console.log(`Faux négatifs   : ${summary.falseNegatives}`);
  console.log(`Mismatchs       : ${summary.mismatches}`);

  if (summary.litigieux.length) {
    console.log('\nTop 5 cas litigieux :');
    for (const c of summary.litigieux) {
      console.log(`- ${c.id} | expected=${c.expected} | actual=${c.actual} | mode=${c.failure_mode || '-'} | ${c.query}`);
    }
  }

  if (args.output) {
    const outputPath = path.resolve(process.cwd(), args.output);
    await fs.writeFile(outputPath, JSON.stringify({ summary, results: allResults }, null, 2), 'utf8');
    console.log(`\nRapport JSON écrit : ${outputPath}`);
  }

  if (summary.falseNegatives > 0 || summary.mismatches > 0) {
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error('\n[RUNNER ERROR]', err);
  process.exit(1);
});
