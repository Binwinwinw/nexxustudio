/**
 * Persistance artefacts audit Impeccable.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(__dirname, '../../data/impeccable-jobs');

export const IMPECCABLE_ARTIFACT_ROOT =
  process.env.IMPECCABLE_ARTIFACT_DIR || DEFAULT_ROOT;

/**
 * @param {string} outputDir
 * @param {object} envelope
 * @param {object} [meta]
 */
export async function writeImpeccableArtifacts(outputDir, envelope = {}, meta = {}) {
  await fs.mkdir(outputDir, { recursive: true });

  const auditPath = path.join(outputDir, 'audit-result.json');
  await fs.writeFile(auditPath, JSON.stringify(envelope, null, 2), 'utf8');

  const summaryPath = path.join(outputDir, 'audit-summary.md');
  const md = renderAuditSummaryMarkdown(envelope, meta);
  await fs.writeFile(summaryPath, md, 'utf8');

  return {
    outputDir,
    files: {
      audit_result_json: auditPath,
      audit_summary_md: summaryPath,
    },
  };
}

export function renderAuditSummaryMarkdown(envelope = {}, meta = {}) {
  const lines = [
    '# Audit Impeccable',
    '',
    `- Score global : **${envelope.score_global ?? '—'}/100**`,
    `- merge_ok : **${envelope.merge_ok ? 'oui' : 'non'}**`,
    `- Source : ${meta.source || '—'}`,
    `- Job : ${meta.job_id || '—'}`,
    '',
    '## Checklist pre-merge',
    '',
  ];

  for (const item of envelope.checklist_pre_merge || []) {
    lines.push(`- [${item.ok ? 'x' : ' '}] ${item.label}${item.required ? ' (requis)' : ''}`);
  }

  if ((envelope.blockers || []).length > 0) {
    lines.push('', '## Blockers', '');
    for (const blocker of envelope.blockers) {
      lines.push(`- **${blocker.dimension}** : ${blocker.message}`);
    }
  }

  if ((envelope.quick_wins || []).length > 0) {
    lines.push('', '## Quick wins', '');
    for (const win of envelope.quick_wins) {
      lines.push(`- ${win.message}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

/**
 * @param {string} outputDir
 * @param {object} payload
 */
export async function writePartialImpeccableFailureArtifacts(outputDir, payload = {}) {
  await fs.mkdir(outputDir, { recursive: true });
  const files = {};

  if (payload.orchestrationEvents?.length > 0) {
    const tracePath = path.join(outputDir, 'audit-trace.jsonl');
    const lines = payload.orchestrationEvents.map((e) => JSON.stringify(e)).join('\n');
    await fs.writeFile(tracePath, `${lines}\n`, 'utf8');
    files.audit_trace_jsonl = tracePath;
  }

  const failurePath = path.join(outputDir, 'failure.json');
  await fs.writeFile(
    failurePath,
    JSON.stringify(
      {
        code: payload.code || 'IMPECCABLE_AUDIT_FAILED',
        message: payload.message || 'Audit refusé.',
        trace_id: payload.trace_id,
        job_id: payload.job_id,
        recorded_at: new Date().toISOString(),
      },
      null,
      2,
    ),
    'utf8',
  );
  files.failure_json = failurePath;

  return { outputDir, files };
}

export default {
  IMPECCABLE_ARTIFACT_ROOT,
  writeImpeccableArtifacts,
  writePartialImpeccableFailureArtifacts,
  renderAuditSummaryMarkdown,
};
