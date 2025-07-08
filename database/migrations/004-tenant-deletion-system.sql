-- =====================================================
-- Migration: Tenant Deletion System
-- Date: 2025-07-07
-- Author: Simon/Claude
-- Description: Implementiert ein professionelles Tenant-Löschsystem
--              mit Queue, Grace Period, Audit Trail und Rollback
-- =====================================================

-- 1. Deletion Queue für asynchrone Verarbeitung
CREATE TABLE IF NOT EXISTS tenant_deletion_queue (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  status ENUM('queued', 'processing', 'completed', 'failed') DEFAULT 'queued',
  progress INT DEFAULT 0, -- 0-100%
  current_step VARCHAR(100),
  total_steps INT DEFAULT 0,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  grace_period_days INT DEFAULT 30,
  scheduled_deletion_date TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  created_by INT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_status (status),
  INDEX idx_created (created_at),
  INDEX idx_scheduled_deletion (scheduled_deletion_date)
);

-- 2. Deletion Log für Audit Trail
CREATE TABLE IF NOT EXISTS tenant_deletion_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  queue_id INT NOT NULL,
  step_name VARCHAR(100),
  table_name VARCHAR(100),
  records_deleted INT DEFAULT 0,
  duration_ms INT,
  status ENUM('success', 'failed', 'skipped'),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (queue_id) REFERENCES tenant_deletion_queue(id),
  INDEX idx_queue_id (queue_id),
  INDEX idx_status (status)
);

-- 3. Failed File Deletions für manuelle Bereinigung
CREATE TABLE IF NOT EXISTS failed_file_deletions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  queue_id INT NOT NULL,
  file_data JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP NULL,
  resolved_by INT NULL,
  FOREIGN KEY (queue_id) REFERENCES tenant_deletion_queue(id),
  FOREIGN KEY (resolved_by) REFERENCES users(id),
  INDEX idx_queue_id (queue_id),
  INDEX idx_resolved (resolved)
);

-- 4. Deletion Audit Trail für Compliance
CREATE TABLE IF NOT EXISTS deletion_audit_trail (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  tenant_name VARCHAR(255) NOT NULL,
  user_count INT DEFAULT 0,
  deleted_by INT NOT NULL,
  deleted_by_ip VARCHAR(45),
  deletion_reason TEXT,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_deleted_by (deleted_by),
  INDEX idx_created_at (created_at)
);

-- 5. Tenant Data Exports für DSGVO
CREATE TABLE IF NOT EXISTS tenant_data_exports (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size BIGINT,
  checksum VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  downloaded BOOLEAN DEFAULT FALSE,
  downloaded_at TIMESTAMP NULL,
  downloaded_by INT NULL,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_expires_at (expires_at),
  INDEX idx_downloaded (downloaded)
);

-- 6. Archived Tenant Invoices für Steuerrecht (10 Jahre)
CREATE TABLE IF NOT EXISTS archived_tenant_invoices (
  id INT PRIMARY KEY AUTO_INCREMENT,
  original_tenant_id INT NOT NULL,
  tenant_name VARCHAR(255) NOT NULL,
  tenant_tax_id VARCHAR(50),
  invoice_data JSON NOT NULL,
  invoice_number VARCHAR(50),
  invoice_date DATE,
  invoice_amount DECIMAL(10,2),
  archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  delete_after DATE NOT NULL, -- 10 Jahre später
  INDEX idx_original_tenant (original_tenant_id),
  INDEX idx_invoice_number (invoice_number),
  INDEX idx_delete_after (delete_after)
);

-- 7. Backup Retention Policy
CREATE TABLE IF NOT EXISTS backup_retention_policy (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT,
  backup_type ENUM('daily', 'weekly', 'monthly', 'deletion', 'final') DEFAULT 'deletion',
  backup_file VARCHAR(500),
  backup_size BIGINT,
  retention_days INT DEFAULT 90,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP GENERATED ALWAYS AS (DATE_ADD(created_at, INTERVAL retention_days DAY)) STORED,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_backup_type (backup_type),
  INDEX idx_expires_at (expires_at)
);

-- 8. Tenant Deletion Rollback
CREATE TABLE IF NOT EXISTS tenant_deletion_rollback (
  id INT PRIMARY KEY AUTO_INCREMENT,
  queue_id INT NOT NULL,
  rollback_data LONGTEXT, -- JSON mit allen gelöschten Daten
  can_rollback BOOLEAN DEFAULT TRUE,
  rollback_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  rolled_back BOOLEAN DEFAULT FALSE,
  rolled_back_at TIMESTAMP NULL,
  rolled_back_by INT NULL,
  FOREIGN KEY (queue_id) REFERENCES tenant_deletion_queue(id),
  FOREIGN KEY (rolled_back_by) REFERENCES users(id),
  INDEX idx_queue_id (queue_id),
  INDEX idx_can_rollback (can_rollback),
  INDEX idx_rollback_expires_at (rollback_expires_at)
);

-- 9. Released Subdomains
CREATE TABLE IF NOT EXISTS released_subdomains (
  id INT PRIMARY KEY AUTO_INCREMENT,
  subdomain VARCHAR(50) NOT NULL,
  original_tenant_id INT,
  original_company_name VARCHAR(255),
  released_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reused BOOLEAN DEFAULT FALSE,
  reused_at TIMESTAMP NULL,
  new_tenant_id INT NULL,
  INDEX idx_subdomain (subdomain),
  INDEX idx_reused (reused),
  INDEX idx_released_at (released_at)
);

-- 10. Legal Holds (verhindert Löschung)
CREATE TABLE IF NOT EXISTS legal_holds (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  reason VARCHAR(500) NOT NULL,
  case_number VARCHAR(100),
  created_by INT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  released_at TIMESTAMP NULL,
  released_by INT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (released_by) REFERENCES users(id),
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_active (active)
);

-- 11. Tenant Deletion Backups
CREATE TABLE IF NOT EXISTS tenant_deletion_backups (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  backup_file VARCHAR(500) NOT NULL,
  backup_size BIGINT,
  backup_type ENUM('pre_deletion', 'final', 'partial') DEFAULT 'final',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_created_at (created_at)
);

-- 12. ALTER TABLE tenants für Deletion Status
-- Prüfe ob Spalten bereits existieren und füge sie nur hinzu wenn nicht vorhanden
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'tenants' 
  AND COLUMN_NAME = 'deletion_status';

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE tenants ADD COLUMN deletion_status ENUM(''active'', ''marked_for_deletion'', ''suspended'', ''deleting'') DEFAULT ''active''',
  'SELECT ''Column deletion_status already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- deletion_requested_at
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'tenants' 
  AND COLUMN_NAME = 'deletion_requested_at';

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE tenants ADD COLUMN deletion_requested_at TIMESTAMP NULL',
  'SELECT ''Column deletion_requested_at already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- deletion_requested_by
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'tenants' 
  AND COLUMN_NAME = 'deletion_requested_by';

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE tenants ADD COLUMN deletion_requested_by INT NULL',
  'SELECT ''Column deletion_requested_by already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index für deletion_status
SET @idx_exists = 0;
SELECT COUNT(*) INTO @idx_exists
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'tenants' 
  AND INDEX_NAME = 'idx_deletion_status';

SET @sql = IF(@idx_exists = 0,
  'ALTER TABLE tenants ADD INDEX idx_deletion_status (deletion_status)',
  'SELECT ''Index idx_deletion_status already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Foreign Key Constraint
SET @fk_exists = 0;
SELECT COUNT(*) INTO @fk_exists
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'tenants' 
  AND CONSTRAINT_NAME = 'fk_deletion_requested_by';

SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE tenants ADD CONSTRAINT fk_deletion_requested_by FOREIGN KEY (deletion_requested_by) REFERENCES users(id)',
  'SELECT ''Foreign key fk_deletion_requested_by already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 13. Scheduled Tasks Table (falls noch nicht vorhanden)
CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  task_type VARCHAR(50) NOT NULL,
  task_data JSON,
  scheduled_at TIMESTAMP NOT NULL,
  executed BOOLEAN DEFAULT FALSE,
  executed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_scheduled_at (scheduled_at),
  INDEX idx_executed (executed)
);

-- 14. Recurring Jobs Table (falls noch nicht vorhanden)
CREATE TABLE IF NOT EXISTS recurring_jobs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  job_name VARCHAR(100) NOT NULL,
  cron_expression VARCHAR(100) NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  last_run TIMESTAMP NULL,
  next_run TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_active (active),
  INDEX idx_next_run (next_run)
);

-- 15. Email Queue Table (falls noch nicht vorhanden)
CREATE TABLE IF NOT EXISTS email_queue (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT,
  to_email VARCHAR(255) NOT NULL,
  subject VARCHAR(500),
  status ENUM('pending', 'sending', 'sent', 'failed') DEFAULT 'pending',
  attempts INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP NULL,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);

-- 16. OAuth Tokens Table (falls noch nicht vorhanden)
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  user_id INT NOT NULL,
  token VARCHAR(500) NOT NULL,
  token_type VARCHAR(50),
  expires_at TIMESTAMP,
  revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_user_id (user_id),
  INDEX idx_token (token(100)),
  INDEX idx_revoked (revoked)
);

-- 17. API Keys Table (falls noch nicht vorhanden)
CREATE TABLE IF NOT EXISTS api_keys (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  key_hash VARCHAR(64) NOT NULL,
  name VARCHAR(100),
  permissions JSON,
  active BOOLEAN DEFAULT TRUE,
  last_used TIMESTAMP NULL,
  deactivated_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  UNIQUE KEY unique_key_hash (key_hash),
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_active (active)
);

-- 18. 2FA Secrets Table (falls noch nicht vorhanden)
CREATE TABLE IF NOT EXISTS user_2fa_secrets (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  secret VARCHAR(100) NOT NULL,
  enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY unique_user_id (user_id)
);

-- 19. 2FA Backup Codes Table (falls noch nicht vorhanden)
CREATE TABLE IF NOT EXISTS user_2fa_backup_codes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  code_hash VARCHAR(64) NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user_id (user_id),
  INDEX idx_used (used)
);

-- 20. Tenant Webhooks Table (falls noch nicht vorhanden)
CREATE TABLE IF NOT EXISTS tenant_webhooks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  url VARCHAR(500) NOT NULL,
  events JSON,
  active BOOLEAN DEFAULT TRUE,
  secret VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_active (active)
);

-- 21. Document Shares Table für Cross-Tenant Sharing Check
CREATE TABLE IF NOT EXISTS document_shares (
  id INT PRIMARY KEY AUTO_INCREMENT,
  document_id INT NOT NULL,
  owner_tenant_id INT NOT NULL,
  shared_with_tenant_id INT NOT NULL,
  permissions JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  FOREIGN KEY (document_id) REFERENCES documents(id),
  FOREIGN KEY (owner_tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (shared_with_tenant_id) REFERENCES tenants(id),
  INDEX idx_owner_tenant (owner_tenant_id),
  INDEX idx_shared_tenant (shared_with_tenant_id)
);

-- 22. Create Event für automatische Backup-Bereinigung
DELIMITER $$

CREATE EVENT IF NOT EXISTS cleanup_old_deletion_backups
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
BEGIN
  -- Lösche alte Deletion Backups nach Retention Period
  DELETE FROM tenant_deletion_backups 
  WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);
  
  -- Lösche abgelaufene Data Exports
  DELETE FROM tenant_data_exports 
  WHERE expires_at < NOW() AND downloaded = FALSE;
  
  -- Lösche alte Rollback-Daten
  DELETE FROM tenant_deletion_rollback 
  WHERE rollback_expires_at < NOW() AND rolled_back = FALSE;
END$$

DELIMITER ;

-- 23. Event Scheduler sollte bereits aktiv sein
-- Falls nicht, muss ein Admin mit SUPER Privilegien folgendes ausführen:
-- SET GLOBAL event_scheduler = ON;

-- =====================================================
-- Migration erfolgreich!
-- Nächste Schritte:
-- 1. TenantDeletionService.ts implementieren
-- 2. API Routes erstellen
-- 3. Worker Process starten
-- =====================================================