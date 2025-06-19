-- KRITISCHE SICHERHEITS-MIGRATION: Multi-Tenant-Isolation V2
-- Date: 2025-06-18
-- Priority: HÖCHSTE PRIORITÄT - Sicherheitslücke!
-- Purpose: Stelle sicher, dass alle Daten einem Tenant zugeordnet sind

-- Diese Version prüft erst, ob Foreign Keys existieren

-- 1. Fix users table - KRITISCH!
UPDATE users SET tenant_id = 1 WHERE tenant_id IS NULL;

-- Drop Foreign Key nur wenn er existiert
SET @fk_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'tenant_id'
    AND REFERENCED_TABLE_NAME = 'tenants'
);

SET @sql = IF(@fk_exists > 0,
    'ALTER TABLE users DROP FOREIGN KEY users_ibfk_1',
    'SELECT "Foreign key does not exist"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- NOT NULL constraint hinzufügen
ALTER TABLE users MODIFY COLUMN tenant_id INT NOT NULL;

-- 2. Fix departments table
UPDATE departments SET tenant_id = 1 WHERE tenant_id IS NULL;

SET @fk_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'departments'
    AND COLUMN_NAME = 'tenant_id'
    AND REFERENCED_TABLE_NAME = 'tenants'
);

SET @sql = IF(@fk_exists > 0,
    'ALTER TABLE departments DROP FOREIGN KEY departments_ibfk_1',
    'SELECT "Foreign key does not exist"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE departments MODIFY COLUMN tenant_id INT NOT NULL;

-- 3. Fix api_logs table
UPDATE api_logs SET tenant_id = 1 WHERE tenant_id IS NULL;

SET @fk_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'api_logs'
    AND COLUMN_NAME = 'tenant_id'
    AND REFERENCED_TABLE_NAME = 'tenants'
);

SET @sql = IF(@fk_exists > 0,
    'ALTER TABLE api_logs DROP FOREIGN KEY api_logs_ibfk_1',
    'SELECT "Foreign key does not exist"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE api_logs MODIFY COLUMN tenant_id INT NOT NULL;

-- 4. Fix security_logs table
UPDATE security_logs SET tenant_id = 1 WHERE tenant_id IS NULL;

SET @fk_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'security_logs'
    AND COLUMN_NAME = 'tenant_id'
    AND REFERENCED_TABLE_NAME = 'tenants'
);

SET @sql = IF(@fk_exists > 0,
    'ALTER TABLE security_logs DROP FOREIGN KEY security_logs_ibfk_1',
    'SELECT "Foreign key does not exist"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE security_logs MODIFY COLUMN tenant_id INT NOT NULL;

-- 5. Fix email_templates table
UPDATE email_templates SET tenant_id = 1 WHERE tenant_id IS NULL;

SET @fk_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'email_templates'
    AND COLUMN_NAME = 'tenant_id'
    AND REFERENCED_TABLE_NAME = 'tenants'
);

SET @sql = IF(@fk_exists > 0,
    'ALTER TABLE email_templates DROP FOREIGN KEY email_templates_ibfk_1',
    'SELECT "Foreign key does not exist"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE email_templates MODIFY COLUMN tenant_id INT NOT NULL;

-- Foreign Key Constraints neu erstellen mit eindeutigen Namen
ALTER TABLE users 
  ADD CONSTRAINT fk_users_tenant_v2 
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) 
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE departments 
  ADD CONSTRAINT fk_departments_tenant_v2 
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) 
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE api_logs 
  ADD CONSTRAINT fk_api_logs_tenant_v2 
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) 
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE security_logs 
  ADD CONSTRAINT fk_security_logs_tenant_v2 
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) 
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE email_templates 
  ADD CONSTRAINT fk_email_templates_tenant_v2 
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) 
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Verifizierung
SELECT 'Migration erfolgreich! Überprüfung der Ergebnisse:' as Status;
SELECT table_name, column_name, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_schema = DATABASE() 
AND column_name = 'tenant_id' 
AND table_name IN ('users', 'departments', 'api_logs', 'security_logs', 'email_templates');