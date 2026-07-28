/* server/src/services/runtimeService.js */
import pool from '../db/connection.js';
import sessionRepository from '../db/repositories/sessionRepository.js';
import eventRepository from '../db/repositories/eventRepository.js';
import validationService from './validationService.js';
import sessionAccessService from './sessionAccessService.js';

export class RuntimeService {
  /**
   * Enregistre le message de l'utilisateur AVANT traitement LLM.
   */
  async recordUserMessage(sessionId, content, family = 'CONVERSATION', browserId = null) {
    return this.recordEvent(sessionId, {
      type: 'user_message',
      actor: 'user',
      family,
      payload: { content }
    }, browserId);
  }

  /**
   * Enregistre la réponse de l'assistant APRÈS traitement LLM.
   */
  async recordAssistantResponse(sessionId, content, family = 'CONVERSATION', metadata = {}, browserId = null) {
    const result = await this.recordEvent(sessionId, {
      type: 'ai_response',
      actor: 'assistant',
      family,
      payload: { content },
      metadata
    }, browserId);

    // Déclencher la validation après la réponse.
    // validateProject calcule maintenant sa propre version via SELECT MAX FOR UPDATE
    // — aucun risque de collision même en cas d'appels concurrents.
    try {
      const validationResult = await validationService.validateProject(sessionId);
      return { ...result, validation: validationResult };
    } catch (valErr) {
      console.error(`[RuntimeService] Validation post-réponse échouée (non critique) :`, valErr.message);
      return { ...result, validation: null };
    }
  }

  /**
   * Enregistre un événement quelconque de manière transactionnelle.
   */
  async recordEvent(sessionId, { type, actor, family, payload, metadata = {} }, browserId = null) {
    if (browserId) {
      const hasAccess = await sessionAccessService.ensureAccess(sessionId, browserId);
      if (!hasAccess) {
        throw new Error('Acces refuse a cette session.');
      }
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Récupérer la session avec verrouillage pessimiste (FOR UPDATE)
      let session = await sessionRepository.findById(sessionId, conn, true);
      
      if (!session) {
        // Si la session n'existe pas, on la crée
        await sessionRepository.save(sessionId, 'Nouveau Projet', 1, conn);
        // On la récupère à nouveau avec verrouillage pour être sûr
        session = await sessionRepository.findById(sessionId, conn, true);
      }

      // 2. Calculer la nouvelle version de manière stricte
      const newVersion = (session.last_event_version || 0) + 1;

      // 3. Ajouter l'événement (l'index UNIQUE garantit l'intégrité ultime)
      await eventRepository.addEvent({
        sessionId,
        family,
        type,
        actor,
        payload,
        metadata,
        version: newVersion
      }, conn);

      // 4. Mettre à jour la version de la session
      await sessionRepository.updateVersion(sessionId, newVersion, conn);

      await conn.commit();
      return { sessionId, version: newVersion };
    } catch (error) {
      await conn.rollback();
      
      if (error.code === 'ER_DUP_ENTRY') {
        console.warn(`[RuntimeService] Duplicate version detected for session ${sessionId}. Retrying might be needed.`);
      }
      
      console.error(`[RuntimeService] Transaction failed for session ${sessionId}:`, error);
      throw error;
    } finally {
      conn.release();
    }
  }
}

export default new RuntimeService();
