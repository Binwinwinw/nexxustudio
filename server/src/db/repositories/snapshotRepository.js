/* server/src/db/repositories/snapshotRepository.js */
import pool from '../connection.js';

export class SnapshotRepository {
  async saveSnapshot(sessionId, state, eventVersion) {
    const [result] = await pool.execute(
      'INSERT INTO project_state_snapshots (session_id, state_json, event_version) VALUES (?, ?, ?)',
      [sessionId, JSON.stringify(state), eventVersion]
    );
    return result.insertId;
  }

  async getLatestSnapshot(sessionId) {
    const [rows] = await pool.execute(
      'SELECT * FROM project_state_snapshots WHERE session_id = ? ORDER BY event_version DESC LIMIT 1',
      [sessionId]
    );
    if (!rows.length) return null;
    const snapshot = rows[0];
    return {
      ...snapshot,
      state: typeof snapshot.state_json === 'string' ? JSON.parse(snapshot.state_json) : snapshot.state_json
    };
  }
}

export default new SnapshotRepository();
