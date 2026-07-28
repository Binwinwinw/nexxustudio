-- server/src/db/schema.sql
-- Script d'initialisation ROBUSTE de la base de données Nexxus Citadel
-- Synchronisé avec l'architecture 3 couches (Connection -> Repository -> Service)

CREATE DATABASE IF NOT EXISTS nexxus_studio;
USE nexxus_studio;

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Table des sessions de projet
CREATE TABLE IF NOT EXISTS project_sessions (
    id VARCHAR(64) PRIMARY KEY, -- Supporte UUIDs 'sess-...'
    user_id INT,
    title VARCHAR(255) DEFAULT 'Nouvelle Session',
    current_phase ENUM('DISCOVERY', 'VALIDATION', 'READY_FOR_FORGE', 'FORGE_RUNNING', 'FORGE_DONE') DEFAULT 'DISCOVERY',
    last_event_version INT DEFAULT 0,
    browser_id VARCHAR(64), -- Propriétaire actuel de la session
    browser_expires_at TIMESTAMP NULL, -- Expiration de l'ownership
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Table des événements de session (Journal Append-Only Haute Fidélité)
CREATE TABLE IF NOT EXISTS session_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL,
    event_family ENUM('CONVERSATION', 'FORGE', 'SYSTEM', 'VALIDATION') DEFAULT 'CONVERSATION',
    event_type VARCHAR(50) NOT NULL, -- e.g. 'user_message', 'ai_response'
    actor_type ENUM('user', 'assistant', 'system', 'expert_pm', 'expert_dev') NOT NULL,
    payload_json JSON NOT NULL,
    metadata_json JSON, -- Pour les logs techniques, tokens, stats VRAM
    event_version INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_session_version (session_id, event_version),
    FOREIGN KEY (session_id) REFERENCES project_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Table des instantanés d'état (Snapshots)
CREATE TABLE IF NOT EXISTS project_state_snapshots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL,
    state_json JSON NOT NULL,
    event_version INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES project_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Table des transmissions à la Forge (Handoffs)
CREATE TABLE IF NOT EXISTS forge_handoffs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL,
    status ENUM('pending', 'started', 'completed', 'failed') DEFAULT 'pending',
    handoff_data_json JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES project_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Table d'audit épistémique du pipeline Agentique
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

-- Insertion de l'utilisateur par défaut
INSERT IGNORE INTO users (id, username, email) VALUES (1, 'default_user', 'admin@nexxus.studio');
