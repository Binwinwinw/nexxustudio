/* server/src/db/repositories/handoffRepository.js */
import pool from '../connection.js';

export class HandoffRepository {
  async createHandoff(sessionId, handoffData) {
    const [result] = await pool.execute(
      'INSERT INTO forge_handoffs (session_id, handoff_data_json, status) VALUES (?, ?, ?)',
      [sessionId, JSON.stringify(handoffData), 'pending']
    );
    return result.insertId;
  }

  async updateStatus(id, status) {
    await pool.execute(
      'UPDATE forge_handoffs SET status = ? WHERE id = ?',
      [status, id]
    );
  }

  async getPendingHandoffs() {
    const [rows] = await pool.execute(
      "SELECT * FROM forge_handoffs WHERE status = 'pending'"
    );
    return rows.map(row => ({
      ...row,
      handoff_data: typeof row.handoff_data_json === 'string' ? JSON.parse(row.handoff_data_json) : row.handoff_data_json
    }));
  }

  async findBySessionId(sessionId) {
    const [rows] = await pool.execute(
      'SELECT * FROM forge_handoffs WHERE session_id = ?',
      [sessionId]
    );
    return rows.map(row => ({
      ...row,
      handoff_data: typeof row.handoff_data_json === 'string' ? JSON.parse(row.handoff_data_json) : row.handoff_data_json
    }));
  }
}

export default new HandoffRepository();
