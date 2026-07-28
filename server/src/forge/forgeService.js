import handoffRepository from '../db/repositories/handoffRepository.js';
import sessionRepository from '../db/repositories/sessionRepository.js';
import runtimeService from '../services/runtimeService.js';
import { validateHandoff, canonicalizeHandoff } from './contracts/handoffSchema.js';
import { runForgeStages, buildForgeCompletionPayload } from './forgeStageRegistry.js';

export class ForgeService {
  /**
   * Orchestre le cycle de vie des handoffs
   */
  async processPendingHandoffs() {
    const pending = await handoffRepository.getPendingHandoffs();
    
    for (const rawHandoff of pending) {
      const sessionId = rawHandoff.session_id;
      try {
        console.log(`[Forge] Processing handoff for session ${sessionId}...`);

        // 1. Validation & Canonisation du Contrat
        const handoffData = canonicalizeHandoff(rawHandoff.handoff_data);
        validateHandoff(handoffData);

        // 2. Transition : STARTED
        await handoffRepository.updateStatus(rawHandoff.id, 'started');
        await sessionRepository.updatePhase(sessionId, 'FORGE_RUNNING');
        
        await runtimeService.recordEvent(sessionId, {
          family: 'SYSTEM',
          type: 'forge_started',
          actor: 'system',
          payload: { handoffId: rawHandoff.id, project: handoffData.projectTitle }
        });

        // 3. Exécution du pipeline Forge (déclaratif)
        const stageResults = await runForgeStages({
          handoffData,
          sessionId,
          onStage: (stage) => {
            console.log(`[Forge] Stage: ${stage.key} (${stage.role})`);
          }
        });
        const ciRes = stageResults.qaBuild;

        // 4. Transition : COMPLETED / FAILED (selon l'audit final)
        const finalStatus = ciRes.status === 'FAIL' ? 'failed' : 'completed';
        
        await handoffRepository.updateStatus(rawHandoff.id, finalStatus);
        
        if (ciRes.status !== 'FAIL') {
          await sessionRepository.updatePhase(sessionId, 'FORGE_DONE');
        }

        await runtimeService.recordEvent(sessionId, {
          family: 'FORGE',
          type: ciRes.status === 'FAIL' ? 'forge_build_failed' : 'forge_completed',
          actor: 'system',
          payload: buildForgeCompletionPayload(stageResults)
        });

        console.log(`[Forge] Pipeline finished with ${ciRes.status} for ${handoffData.projectTitle}`);

      } catch (error) {
        console.error(`[Forge] Critical failure for handoff ${rawHandoff.id}:`, error);
        await handoffRepository.updateStatus(rawHandoff.id, 'failed');
        
        await runtimeService.recordEvent(sessionId, {
          family: 'SYSTEM',
          type: 'forge_failed',
          actor: 'system',
          payload: { error: error.message }
        });
      }
    }
  }
}

export default new ForgeService();
