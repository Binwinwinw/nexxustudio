/* server/src/db/repositories/eventRepository.js */
import pool from '../connection.js';

export class EventRepository {
  /**
   * Ajoute un événement. Accepte une connexion optionnelle pour les transactions.
   */
  async addEvent({ sessionId, family = 'CONVERSATION', type, actor, payload, metadata = {}, version = null }, connection = null) {
    // Validation de la version (Indispensable pour l'intégrité de l'Event Store)
    if (version === null || typeof version !== 'number' || version < 1) {
      throw new Error(`[EventRepository] Version invalide ou manquante : ${version}. Une version positive est requise.`);
    }

    const executor = connection || pool;
    const sql = `
      INSERT INTO session_events 
      (session_id, event_family, event_type, actor_type, payload_json, metadata_json, event_version) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      sessionId, 
      family, 
      type, 
      actor, 
      JSON.stringify(payload || {}), 
      JSON.stringify(metadata || {}), 
      version
    ];
    
    const [result] = await executor.execute(sql, params);
    return result.insertId;
  }

  async getEventsBySession(sessionId) {
    const [rows] = await pool.execute(
      'SELECT * FROM session_events WHERE session_id = ? ORDER BY event_version ASC',
      [sessionId]
    );
    return rows.map(row => ({
      ...row,
      payload_json: typeof row.payload_json === 'string' ? JSON.parse(row.payload_json) : row.payload_json,
      metadata_json: typeof row.metadata_json === 'string' ? JSON.parse(row.metadata_json) : row.metadata_json
    }));
  }
}

export default new EventRepository();
