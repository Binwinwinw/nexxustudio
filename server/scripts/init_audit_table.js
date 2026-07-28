import pool from '../src/db/connection.js';

async function run() {
  try {
    console.log('Creating agent_audit_events table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_audit_events (
          id INT AUTO_INCREMENT PRIMARY KEY,
          query_id VARCHAR(255) NOT NULL,
          session_id VARCHAR(64),
          stage VARCHAR(50) NOT NULL,
          payload_type VARCHAR(50) NOT NULL,
          status VARCHAR(20) NOT NULL,
          payload_json JSON,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          parent_id VARCHAR(255),
          hash VARCHAR(255),
          INDEX idx_query (query_id),
          FOREIGN KEY (session_id) REFERENCES project_sessions(id) ON DELETE SET NULL
      ) ENGINE=InnoDB;
    `);
    console.log('Table created successfully.');
  } catch (err) {
    console.error('Error creating table:', err);
  } finally {
    process.exit(0);
  }
}

run();
