/* server/src/services/sessionAccessService.js */
import crypto from 'crypto';
import sessionRepository from '../db/repositories/sessionRepository.js';
import { resolveEffectiveOwner } from './sessionAccessRules.js';

export { resolveEffectiveOwner, isSessionAccessibleForBrowser } from './sessionAccessRules.js';

class SessionAccessService {
  generateBrowserId() {
    return crypto.randomUUID();
  }

  async getOwner(sessionId) {
    const session = await sessionRepository.findById(sessionId);
    if (!session) return null;
    return resolveEffectiveOwner(session.browser_id, session.browser_expires_at);
  }

  /**
   * Retourne les IDs accessibles pour ce browserId (requête batch, pas N+1).
   */
  async listSessionsForBrowser(sessionIds, browserId) {
    return sessionRepository.filterAccessibleIds(sessionIds, browserId);
  }

  /**
   * Tente de s'approprier la session.
   */
  async claim(sessionId, browserId) {
    return sessionRepository.claimSession(sessionId, browserId);
  }

  /**
   * Garantit que le browserId a accès à la session (ou la crée/claim).
   */
  async ensureAccess(sessionId, browserId) {
    const session = await sessionRepository.findById(sessionId);
    
    if (!session) {
      // La session n'existe pas encore, on la pré-crée pour poser le verrou
      await sessionRepository.save(sessionId, 'Nouveau Projet');
      return this.claim(sessionId, browserId);
    }

    const owner = await this.getOwner(sessionId);
    if (!owner) {
      return this.claim(sessionId, browserId);
    }

    return owner === browserId;
  }

  /**
   * Libère l'ownership de la session.
   */
  async release(sessionId, browserId = null) {
    return sessionRepository.releaseSession(sessionId, browserId);
  }
}

export default new SessionAccessService();
