/* server/src/db/repositories/sessionRepository.js */
import pool from '../connection.js';

const PREVIEW_SUBQUERY = `
        (
          SELECT JSON_UNQUOTE(JSON_EXTRACT(se.payload_json, '$.content'))
          FROM session_events se
          WHERE se.session_id = ps.id AND se.event_type = 'user_message'
          ORDER BY se.event_version ASC
          LIMIT 1
        ) AS preview`;

const ACCESS_WHERE_CLAUSE = `
        (ps.browser_id IS NULL
         OR ps.browser_expires_at < CURRENT_TIMESTAMP
         OR ps.browser_id = ?)`;

function mapPreviewRows(rows) {
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    timestamp: row.timestamp,
    preview: row.preview
      ? String(row.preview).replace(/\s+/g, " ").trim().slice(0, 200)
      : null,
  }));
}

export class SessionRepository {
  async listAll() {
    const [rows] = await pool.execute(
      'SELECT id, title, created_at as timestamp FROM project_sessions ORDER BY created_at DESC'
    );
    return rows;
  }

  /**
   * Liste les sessions avec un aperçu du premier message utilisateur (sidebar).
   */
  async listAllWithPreview(limit = 500) {
    const [rows] = await pool.execute(
      `SELECT
        ps.id,
        ps.title,
        ps.created_at AS timestamp,
        ${PREVIEW_SUBQUERY}
      FROM project_sessions ps
      ORDER BY ps.created_at DESC
      LIMIT ?`,
      [limit],
    );

    return mapPreviewRows(rows);
  }

  /**
   * Liste sidebar : preview + filtre ownership en une requête (évite N× findById).
   */
  async listAccessibleWithPreview(browserId, limit = 500) {
    const [rows] = await pool.execute(
      `SELECT
        ps.id,
        ps.title,
        ps.created_at AS timestamp,
        ${PREVIEW_SUBQUERY}
      FROM project_sessions ps
      WHERE ${ACCESS_WHERE_CLAUSE}
      ORDER BY ps.created_at DESC
      LIMIT ?`,
      [browserId, limit],
    );

    return mapPreviewRows(rows);
  }

  /**
   * Filtre un sous-ensemble d'IDs accessibles pour ce navigateur (batch, pas de boucle).
   */
  async filterAccessibleIds(sessionIds, browserId) {
    if (!Array.isArray(sessionIds) || sessionIds.length === 0) return [];

    const placeholders = sessionIds.map(() => "?").join(", ");
    const [rows] = await pool.execute(
      `SELECT ps.id
       FROM project_sessions ps
       WHERE ps.id IN (${placeholders})
         AND ${ACCESS_WHERE_CLAUSE}`,
      [...sessionIds, browserId],
    );

    return rows.map((row) => row.id);
  }

  async findById(id, connection = null, forUpdate = false) {
    const executor = connection || pool;
    let sql = 'SELECT * FROM project_sessions WHERE id = ?';
    if (forUpdate) {
      sql += ' FOR UPDATE';
    }
    const [rows] = await executor.execute(sql, [id]);
    return rows.length ? rows[0] : null;
  }

  /**
   * Sauvegarde ou met à jour une session.
   * Accepte une connexion pour les transactions.
   */
  async save(id, title, userId = 1, connection = null) {
    const executor = connection || pool;
    const sql = `
      INSERT INTO project_sessions (id, title, user_id) 
      VALUES (?, ?, ?) 
      ON DUPLICATE KEY UPDATE title = ?, updated_at = CURRENT_TIMESTAMP
    `;
    const [rows] = await executor.execute(sql, [id, title, userId, title]);
    return rows;
  }

  async updateVersion(id, version, connection = null) {
    const executor = connection || pool;
    await executor.execute(
      'UPDATE project_sessions SET last_event_version = ? WHERE id = ?',
      [version, id]
    );
  }

  async updatePhase(id, phase, connection = null) {
    const executor = connection || pool;
    await executor.execute(
      'UPDATE project_sessions SET current_phase = ? WHERE id = ?',
      [phase, id]
    );
  }
  
  async claimSession(id, browserId, expiresInHours = 2, connection = null) {
    const executor = connection || pool;
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
    
    // On essaie de prendre l'ownership si vide ou expiré ou déjà à nous
    const sql = `
      UPDATE project_sessions 
      SET browser_id = ?, browser_expires_at = ?
      WHERE id = ? AND (browser_id IS NULL OR browser_id = ? OR browser_expires_at < CURRENT_TIMESTAMP)
    `;
    const [result] = await executor.execute(sql, [browserId, expiresAt, id, browserId]);
    return result.affectedRows > 0;
  }

  async releaseSession(id, browserId = null, connection = null) {
    const executor = connection || pool;
    let sql = 'UPDATE project_sessions SET browser_id = NULL, browser_expires_at = NULL WHERE id = ?';
    const params = [id];
    
    if (browserId) {
      sql += ' AND browser_id = ?';
      params.push(browserId);
    }
    
    const [result] = await executor.execute(sql, params);
    return result.affectedRows > 0;
  }

  async delete(id) {
    const [result] = await pool.execute(
      'DELETE FROM project_sessions WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }
}

export default new SessionRepository();
