/* server/src/services/sessionStore.js */
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSIONS_DIR = path.resolve(__dirname, '../../state/sessions');

/**
 * SessionStore (Industrial v4.0)
 * Gère la persistance des sessions avec validation d'identifiants et sécurité de chemin.
 */
class SessionStore {
  constructor() {
    this.ensureDir();
  }

  async ensureDir() {
    await fs.ensureDir(SESSIONS_DIR);
  }

  /**
   * Résolution sécurisée du chemin de session (Anti-Path Traversal)
   */
  _safeSessionPath(id) {
    if (!id || typeof id !== 'string') throw new Error(`[SessionStore] ID invalide.`);
    
    // Validation stricte : Uniquement alphanumérique, tirets, underscores et points (standard UUID/Slug)
    if (!/^[a-zA-Z0-9._-]+$/.test(id)) {
      throw new Error(`[SessionStore] Format d'ID non autorisé : ${id}`);
    }

    const resolved = path.resolve(SESSIONS_DIR, `${id}.json`);
    if (!resolved.startsWith(SESSIONS_DIR + path.sep) && resolved !== SESSIONS_DIR) {
      throw new Error(`[Security] Tentative de sortie du dossier sessions détectée : ${id}`);
    }
    return resolved;
  }

  /**
   * Liste toutes les sessions (metadata uniquement)
   */
  async listSessions() {
    await this.ensureDir();
    const files = await fs.readdir(SESSIONS_DIR);
    const sessions = [];

    // Note : Pour un volume massif, il faudrait passer à un index ou une DB.
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(SESSIONS_DIR, file);
          const content = await fs.readJson(filePath);
          sessions.push({
            id: content.id,
            title: content.title || 'Nouvelle Session',
            timestamp: content.timestamp || Date.now(),
            updatedAt: content.updatedAt || content.timestamp || Date.now(),
            version: content.version || 1
          });
        } catch (e) {
          console.error(`[SessionStore] Erreur lecture session ${file}:`, e.message);
        }
      }
    }

    return sessions.sort((a, b) => (b.updatedAt || b.timestamp) - (a.updatedAt || a.timestamp));
  }

  /**
   * Récupère une session complète
   */
  async getSession(id) {
    try {
      const filePath = this._safeSessionPath(id);
      if (await fs.pathExists(filePath)) {
        return await fs.readJson(filePath);
      }
    } catch (e) {
      console.warn(`[SessionStore] getSession failed for ${id}:`, e.message);
    }
    return null;
  }

  /**
   * Sauvegarde ou met à jour une session (Atomique métier)
   */
  async saveSession(id, data) {
    await this.ensureDir();
    const filePath = this._safeSessionPath(id);
    
    const now = Date.now();
    const existing = await this.getSession(id);
    
    const sessionData = {
      ...data,
      id,
      timestamp: existing?.timestamp || data.timestamp || now,
      updatedAt: now,
      version: (existing?.version || 0) + 1
    };

    // Écriture sécurisée via fs-extra
    await fs.writeJson(filePath, sessionData, { spaces: 2 });
    return sessionData;
  }

  /**
   * Supprime une session
   */
  async deleteSession(id) {
    try {
      const filePath = this._safeSessionPath(id);
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
        return true;
      }
    } catch (e) {
      console.error(`[SessionStore] deleteSession failed for ${id}:`, e.message);
    }
    return false;
  }
}

export default new SessionStore();
