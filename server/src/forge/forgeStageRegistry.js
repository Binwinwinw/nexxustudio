import runtimeService from '../services/runtimeService.js';
import bootstrapHandler from './handlers/projectBootstrapHandler.js';
import devScaffoldHandler from './handlers/devScaffoldHandler.js';
import qaAuditHandler from './handlers/qaScaffoldAuditHandler.js';
import architectHandler from './handlers/architectHandler.js';
import devAdvancedHandler from './handlers/devAdvancedHandler.js';
import qaBuildValidationHandler from './handlers/qaBuildValidationHandler.js';

export const FORGE_STAGE_DEFINITIONS = Object.freeze([
  {
    key: 'bootstrap',
    label: 'Bootstrap',
    role: 'system',
    execute: async ({ handoffData, sessionId }) =>
      bootstrapHandler.execute(handoffData, { sessionId, stage: 'bootstrap' })
  },
  {
    key: 'scaffold',
    label: 'Scaffold',
    role: 'developer',
    execute: async ({ handoffData, sessionId, stageResults }) =>
      devScaffoldHandler.execute(handoffData, stageResults.bootstrap, {
        sessionId,
        stage: 'scaffold',
      })
  },
  {
    key: 'qaScaffold',
    label: 'QA Scaffold Audit',
    role: 'qa',
    execute: async ({ handoffData, sessionId, stageResults }) =>
      qaAuditHandler.execute(handoffData, stageResults.bootstrap, stageResults.scaffold, {
        sessionId,
        stage: 'qaScaffold',
      })
  },
  {
    key: 'architecture',
    label: 'Architecture',
    role: 'architect',
    execute: async ({ handoffData, sessionId, stageResults }) =>
      architectHandler.execute(handoffData, stageResults.bootstrap, {
        sessionId,
        stage: 'architecture',
      })
  },
  {
    key: 'development',
    label: 'Advanced Development',
    role: 'developer',
    execute: async ({ handoffData, stageResults }) => devAdvancedHandler.execute(handoffData, {
      ...stageResults.bootstrap,
      artifacts: [
        ...(stageResults.scaffold?.artifacts || []),
        ...(stageResults.architecture?.artifacts || [])
      ]
    })
  },
  {
    key: 'qaBuild',
    label: 'QA Build Validation',
    role: 'qa',
    beforeExecute: async ({ sessionId }) => {
      await runtimeService.recordEvent(sessionId, {
        family: 'FORGE',
        type: 'forge_build_started',
        actor: 'system',
        payload: {}
      });
    },
    execute: async ({ handoffData, sessionId, stageResults }) =>
      qaBuildValidationHandler.execute(handoffData, stageResults.bootstrap, {
        sessionId,
        stage: 'qaBuild',
      })
  }
]);

export async function runForgeStages({ handoffData, sessionId, onStage }) {
  const stageResults = {};

  for (const stage of FORGE_STAGE_DEFINITIONS) {
    if (stage.beforeExecute) {
      await stage.beforeExecute({ handoffData, sessionId, stageResults });
    }

    if (onStage) {
      onStage(stage);
    }

    stageResults[stage.key] = await stage.execute({ handoffData, sessionId, stageResults });
  }

  return stageResults;
}

export function buildForgeCompletionPayload(stageResults = {}) {
  return {
    bootstrap: stageResults.bootstrap?.artifacts || [],
    scaffold: stageResults.scaffold?.artifacts || [],
    architecture: stageResults.architecture?.artifacts || [],
    dev: stageResults.development?.artifacts || [],
    ci: {
      status: stageResults.qaBuild?.status,
      report: 'qa_build_report.md'
    },
    projectPath: stageResults.bootstrap?.projectPath
  };
}
