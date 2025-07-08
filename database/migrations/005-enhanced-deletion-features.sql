-- Migration 005: Enhanced Deletion Features
-- Zwei-Personen-Prinzip, Emergency Stop, und weitere Enterprise Features

-- ============================================
-- 1. ZWEI-PERSONEN-PRINZIP (Two-Person Rule)
-- ============================================

-- Erweitere tenant_deletion_queue für Approval-Workflow
-- Prüfe und füge Spalten einzeln hinzu
DROP PROCEDURE IF EXISTS AddColumnIfNotExists;
DELIMITER $$
CREATE PROCEDURE AddColumnIfNotExists(
    IN tableName VARCHAR(128),
    IN columnName VARCHAR(128),
    IN columnDefinition VARCHAR(500)
)
BEGIN
    DECLARE columnExists INT DEFAULT 0;
    
    SELECT COUNT(*) INTO columnExists
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = tableName
    AND COLUMN_NAME = columnName;
    
    IF columnExists = 0 THEN
        SET @sql = CONCAT('ALTER TABLE ', tableName, ' ADD COLUMN ', columnName, ' ', columnDefinition);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$
DELIMITER ;

-- Füge neue Spalten hinzu
CALL AddColumnIfNotExists('tenant_deletion_queue', 'approval_required', 'BOOLEAN DEFAULT TRUE');
CALL AddColumnIfNotExists('tenant_deletion_queue', 'second_approver_id', 'INT NULL');
CALL AddColumnIfNotExists('tenant_deletion_queue', 'approval_requested_at', 'TIMESTAMP NULL');
CALL AddColumnIfNotExists('tenant_deletion_queue', 'approved_at', 'TIMESTAMP NULL');
CALL AddColumnIfNotExists('tenant_deletion_queue', 'approval_status', 'ENUM(''pending'', ''approved'', ''rejected'') DEFAULT ''pending''');
CALL AddColumnIfNotExists('tenant_deletion_queue', 'emergency_stop', 'BOOLEAN DEFAULT FALSE');
CALL AddColumnIfNotExists('tenant_deletion_queue', 'emergency_stopped_at', 'TIMESTAMP NULL');
CALL AddColumnIfNotExists('tenant_deletion_queue', 'emergency_stopped_by', 'INT NULL');

-- Füge Foreign Keys hinzu mit dynamischer Prüfung
DROP PROCEDURE IF EXISTS AddForeignKeyIfNotExists;
DELIMITER $$
CREATE PROCEDURE AddForeignKeyIfNotExists(
    IN tableName VARCHAR(128),
    IN constraintName VARCHAR(128),
    IN constraintDefinition VARCHAR(500)
)
BEGIN
    DECLARE constraintExists INT DEFAULT 0;
    
    SELECT COUNT(*) INTO constraintExists
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = tableName
    AND CONSTRAINT_NAME = constraintName;
    
    IF constraintExists = 0 THEN
        SET @sql = CONCAT('ALTER TABLE ', tableName, ' ADD CONSTRAINT ', constraintName, ' ', constraintDefinition);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$
DELIMITER ;

-- Füge Foreign Keys hinzu
CALL AddForeignKeyIfNotExists('tenant_deletion_queue', 'fk_second_approver', 'FOREIGN KEY (second_approver_id) REFERENCES users(id)');
CALL AddForeignKeyIfNotExists('tenant_deletion_queue', 'fk_emergency_stopped_by', 'FOREIGN KEY (emergency_stopped_by) REFERENCES users(id)');

-- Neue Tabelle für Approval-Historie
CREATE TABLE IF NOT EXISTS tenant_deletion_approvals (
  id INT PRIMARY KEY AUTO_INCREMENT,
  queue_id INT NOT NULL,
  approver_id INT NOT NULL,
  action ENUM('requested', 'approved', 'rejected', 'cancelled') NOT NULL,
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (queue_id) REFERENCES tenant_deletion_queue(id),
  FOREIGN KEY (approver_id) REFERENCES users(id),
  INDEX idx_queue_action (queue_id, action),
  INDEX idx_approver (approver_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 2. MONITORING & ALERTING
-- ============================================

CREATE TABLE IF NOT EXISTS deletion_alerts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  queue_id INT NOT NULL,
  alert_type ENUM('slack', 'teams', 'pagerduty', 'email') NOT NULL,
  severity ENUM('info', 'warning', 'critical') NOT NULL,
  channel VARCHAR(255),
  title VARCHAR(500),
  message TEXT,
  sent_at TIMESTAMP NULL,
  response_code INT,
  response_body TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (queue_id) REFERENCES tenant_deletion_queue(id),
  INDEX idx_severity (severity),
  INDEX idx_sent_status (sent_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 3. DRY-RUN REPORTS
-- ============================================

CREATE TABLE IF NOT EXISTS deletion_dry_run_reports (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  requested_by INT NOT NULL,
  estimated_duration_seconds INT,
  total_affected_records INT,
  report_data JSON,
  warnings JSON,
  blockers JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (requested_by) REFERENCES users(id),
  INDEX idx_tenant_date (tenant_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 4. CRONJOBS & SCHEDULED TASKS
-- ============================================

-- Diese Tabellen existieren möglicherweise noch nicht
CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  task_name VARCHAR(255) NOT NULL,
  task_type VARCHAR(100),
  schedule VARCHAR(100),
  next_run_at TIMESTAMP NULL,
  last_run_at TIMESTAMP NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  INDEX idx_tenant_active (tenant_id, active),
  INDEX idx_next_run (next_run_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS recurring_jobs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  job_name VARCHAR(255) NOT NULL,
  job_type VARCHAR(100),
  cron_expression VARCHAR(100),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  INDEX idx_tenant_active (tenant_id, active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 5. WEBHOOK TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS tenant_webhooks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  webhook_name VARCHAR(255),
  url VARCHAR(1000) NOT NULL,
  events JSON,
  headers JSON,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  INDEX idx_tenant_active (tenant_id, active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 6. PARTIAL DELETION OPTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS deletion_partial_options (
  id INT PRIMARY KEY AUTO_INCREMENT,
  queue_id INT NOT NULL,
  option_name VARCHAR(100) NOT NULL,
  included BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (queue_id) REFERENCES tenant_deletion_queue(id),
  UNIQUE KEY uk_queue_option (queue_id, option_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 7. MYSQL EVENTS FÜR CLEANUP
-- ============================================

-- Event für Backup Cleanup (Admin muss event_scheduler aktivieren)
DELIMITER $$

-- Lösche alten Event falls vorhanden
DROP EVENT IF EXISTS cleanup_old_tenant_backups$$

CREATE EVENT IF NOT EXISTS cleanup_old_tenant_backups
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
COMMENT 'Cleanup old tenant deletion backups and exports'
DO
BEGIN
  -- Lösche alte Backups (älter als 90 Tage)
  DELETE FROM tenant_deletion_backups 
  WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)
  LIMIT 1000;
  
  -- Lösche abgelaufene Datenexporte
  DELETE FROM tenant_data_exports 
  WHERE expires_at < NOW()
  LIMIT 1000;
  
  -- Lösche alte Dry-Run Reports (älter als 30 Tage)
  DELETE FROM deletion_dry_run_reports
  WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
  LIMIT 1000;
  
  -- Lösche alte Alerts (älter als 180 Tage)
  DELETE FROM deletion_alerts
  WHERE created_at < DATE_SUB(NOW(), INTERVAL 180 DAY)
  LIMIT 1000;
END$$

DELIMITER ;

-- ============================================
-- 8. VIEWS FÜR MONITORING
-- ============================================

-- View für Pending Approvals
CREATE OR REPLACE VIEW v_pending_deletion_approvals AS
SELECT 
  q.id as queue_id,
  q.tenant_id,
  t.company_name,
  t.subdomain,
  q.created_at as requested_at,
  q.created_by as requester_id,
  u1.username as requester_name,
  q.approval_status,
  q.grace_period_days,
  q.scheduled_deletion_date
FROM tenant_deletion_queue q
JOIN tenants t ON t.id = q.tenant_id
JOIN users u1 ON u1.id = q.created_by
WHERE q.approval_status = 'pending'
  AND q.status = 'pending_approval'
ORDER BY q.created_at DESC;

-- View für Active Deletions
CREATE OR REPLACE VIEW v_active_deletions AS
SELECT 
  q.id as queue_id,
  q.tenant_id,
  t.company_name,
  q.status,
  q.progress,
  q.current_step,
  q.total_steps,
  q.started_at,
  TIMESTAMPDIFF(MINUTE, q.started_at, NOW()) as minutes_running,
  q.created_by,
  u.username as created_by_name
FROM tenant_deletion_queue q
JOIN tenants t ON t.id = q.tenant_id
JOIN users u ON u.id = q.created_by
WHERE q.status IN ('processing', 'queued')
ORDER BY q.started_at DESC;

-- ============================================
-- 9. SAMPLE DATA FÜR ALERTS
-- ============================================

-- Beispiel-Webhook für Slack (muss angepasst werden)
-- INSERT INTO tenant_webhooks (tenant_id, webhook_name, url, events, active) 
-- VALUES (0, 'Slack Deletion Alerts', 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL', 
--         '["deletion.started", "deletion.completed", "deletion.failed"]', TRUE);

-- ============================================
-- HINWEISE FÜR ADMINS
-- ============================================

-- WICHTIG: Event Scheduler muss aktiviert werden:
-- SET GLOBAL event_scheduler = ON;

-- Status prüfen:
-- SHOW VARIABLES LIKE 'event_scheduler';

-- Events anzeigen:
-- SHOW EVENTS;

-- Cleanup Procedures
DROP PROCEDURE IF EXISTS AddColumnIfNotExists;
DROP PROCEDURE IF EXISTS AddForeignKeyIfNotExists;

-- Migration erfolgreich
SELECT 'Migration 005: Enhanced Deletion Features completed successfully' as status;