import pool from '../connection.js';

class AuditRepository {
  async saveEvent(eventData) {
    const query = `
      INSERT INTO agent_audit_events 
      (query_id, session_id, stage, payload_type, status, payload_json, parent_id, hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      eventData.query_id,
      eventData.session_id || null,
      eventData.stage,
      eventData.payload_type,
      eventData.status,
      JSON.stringify(eventData.payload_json),
      eventData.parent_id || null,
      eventData.hash || null
    ];

    try {
      const [result] = await pool.execute(query, values);
      return result.insertId;
    } catch (error) {
      console.error('[AuditRepository] Error saving event:', error);
      throw error;
    }
  }

  async getEventsByQuery(queryId) {
    const query = `
      SELECT * FROM agent_audit_events
      WHERE query_id = ?
      ORDER BY created_at ASC
    `;
    try {
      const [rows] = await pool.execute(query, [queryId]);
      return rows;
    } catch (error) {
      console.error('[AuditRepository] Error retrieving events:', error);
      throw error;
    }
  }
}

export default new AuditRepository();
