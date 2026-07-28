/**
 * Worker Nexxus Design — compose depuis Extract v2 → create_result → Forge bridge.
 */
import {
  validateDesignCreateInput,
  buildDesignCreateEnvelope,
} from './nexxusDesignContract.js';
import { composeDesignFromExtract } from './nexxusDesignComposer.js';
import { buildForgeScaffold } from './forgeDesignBridge.js';
import { writeNexxusDesignArtifacts } from './nexxusDesignArtifacts.js';

export const NEXXUS_DESIGN_STEPS = [
  'design.create.validate',
  'design.create.compose',
  'design.create.pack',
  'design.create.forge',
];

const GOLDEN_OBJECTIVE_MAP = {
  landing: 'landing',
  components: 'design_system',
  dashboard: 'cockpit',
};

/**
 * Infère objectif depuis URL ou signaux Extract.
 * @param {object} extractEnvelope
 * @param {string} [explicitObjective]
 */
export function inferDesignObjective(extractEnvelope = {}, explicitObjective = null) {
  if (explicitObjective && explicitObjective !== 'redesign') {
    return explicitObjective;
  }

  const url = extractEnvelope.source?.url || '';
  for (const [slug, objective] of Object.entries(GOLDEN_OBJECTIVE_MAP)) {
    if (url.includes(`/${slug}`)) return objective;
  }

  const patterns = (extractEnvelope.layout_signatures || []).map((entry) => entry.pattern);
  if (patterns.includes('card-grid')) return 'design_system';
  if (patterns.some((pattern) => /sidebar|dashboard/i.test(pattern))) return 'cockpit';
  if (patterns.includes('hero-first')) return 'landing';

  return explicitObjective || 'landing';
}

/**
 * @param {object} options
 */
export async function runNexxusDesignWorker(options = {}) {
  const {
    query = '',
    objective = 'redesign',
    referenceDna = null,
    extractEnvelope = null,
    outputDir = null,
    traceId = null,
    emitForge = true,
    projectTitle = null,
    onStep,
  } = options;

  const reference = referenceDna || extractEnvelope;

  const emit = (step, status, extra = {}) => {
    onStep?.({
      step,
      status,
      trace_id: traceId,
      ...extra,
    });
  };

  emit('design.create.validate', 'running');

  const inputCheck = validateDesignCreateInput({
    query,
    objective,
    referenceDna: reference,
  });

  if (!inputCheck.ok) {
    emit('design.create.validate', 'error', { violations: inputCheck.violations });
    return {
      ok: false,
      trace_id: traceId,
      violations: inputCheck.violations,
    };
  }

  emit('design.create.validate', 'ok');

  const resolvedObjective = inferDesignObjective(reference, objective);

  emit('design.create.compose', 'running');
  const composed = composeDesignFromExtract(reference, {
    objective: resolvedObjective,
    query,
  });
  emit('design.create.compose', 'ok', {
    objective: resolvedObjective,
    component_count: composed.components.length,
  });

  emit('design.create.pack', 'running');
  const envelope = buildDesignCreateEnvelope(composed);
  emit('design.create.pack', 'ok');

  let forgeScaffold = null;
  let artifacts = null;

  if (emitForge) {
    emit('design.create.forge', 'running');
    forgeScaffold = buildForgeScaffold(envelope, {
      projectTitle: projectTitle || `Nexxus ${resolvedObjective}`,
    });
    emit('design.create.forge', 'ok', {
      scaffold_template: forgeScaffold.scaffold_template,
      file_count: Object.keys(forgeScaffold.files).length,
    });
  }

  if (outputDir) {
    artifacts = await writeNexxusDesignArtifacts(outputDir, envelope, forgeScaffold);
  }

  return {
    ok: true,
    trace_id: traceId,
    envelope,
    forgeScaffold,
    artifacts,
  };
}

export default runNexxusDesignWorker;
