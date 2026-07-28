-- =====================================================================
-- LA CITADELLE - SYSTEM D'AUDIT & OBSERVABILITÉ DU CRITICAGENT
-- Auteur : Nexxus Studio / Forge
-- Description : Schéma d'audit en 2 tables (Events & Claims) sous InnoDB
-- =====================================================================

-- Table 1 : critic_audit_events (Vue d'ensemble au niveau de l'exécution)
CREATE TABLE IF NOT EXISTS critic_audit_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id VARCHAR(191) NOT NULL,
  job_id VARCHAR(191) NULL,
  event_version INT UNSIGNED NULL,
  request_id VARCHAR(191) NULL,

  user_query TEXT NOT NULL,
  query_hash CHAR(64) NULL,

  overall_verdict ENUM(
    'approved',
    'approved_with_caveats',
    'rejected_unsupported',
    'rejected_overclaim',
    'rejected_contradicted',
    'rejected_precheck',
    'failed_safe'
  ) NOT NULL,

  failure_mode VARCHAR(100) NULL,
  severity ENUM('low', 'medium', 'high', 'critical') NULL,

  claims_total INT UNSIGNED NOT NULL DEFAULT 0,
  claims_supported INT UNSIGNED NOT NULL DEFAULT 0,
  claims_unsupported INT UNSIGNED NOT NULL DEFAULT 0,
  claims_contradicted INT UNSIGNED NOT NULL DEFAULT 0,
  claims_uncertain INT UNSIGNED NOT NULL DEFAULT 0,
  claims_overclaim INT UNSIGNED NOT NULL DEFAULT 0,

  retrieval_count INT UNSIGNED NOT NULL DEFAULT 0,
  local_sources_count INT UNSIGNED NOT NULL DEFAULT 0,
  web_sources_count INT UNSIGNED NOT NULL DEFAULT 0,

  critic_model VARCHAR(100) NULL,
  composer_model VARCHAR(100) NULL,
  routing_profile VARCHAR(100) NULL,

  latency_ms INT UNSIGNED NULL,
  critic_latency_ms INT UNSIGNED NULL,

  approved_answer MEDIUMTEXT NULL,
  critic_report_json JSON NOT NULL,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_critic_audit_session_created (session_id, created_at),
  KEY idx_critic_audit_verdict_created (overall_verdict, created_at),
  KEY idx_critic_audit_failure_mode_created (failure_mode, created_at),
  KEY idx_critic_audit_job_id (job_id),
  KEY idx_critic_audit_request_id (request_id),
  KEY idx_critic_audit_event_version (event_version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 2 : critic_claim_verdicts (Vue détaillée au niveau de chaque claim)
CREATE TABLE IF NOT EXISTS critic_claim_verdicts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  critic_audit_event_id BIGINT UNSIGNED NOT NULL,

  claim_index INT UNSIGNED NOT NULL,
  claim_text TEXT NOT NULL,

  verdict ENUM(
    'supported',
    'unsupported',
    'contradicted',
    'uncertain',
    'overclaim'
  ) NOT NULL,

  severity ENUM('low', 'medium', 'high', 'critical') NULL,
  failure_mode VARCHAR(100) NULL,

  fact_ids_json JSON NULL,
  hypothesis_ids_json JSON NULL,
  matched_source_ids_json JSON NULL,

  rationale TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  CONSTRAINT fk_claim_verdicts_audit_event
    FOREIGN KEY (critic_audit_event_id)
    REFERENCES critic_audit_events(id)
    ON DELETE CASCADE,

  KEY idx_claim_verdicts_event (critic_audit_event_id),
  KEY idx_claim_verdicts_verdict (verdict),
  KEY idx_claim_verdicts_failure_mode (failure_mode),
  KEY idx_claim_verdicts_severity (severity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
