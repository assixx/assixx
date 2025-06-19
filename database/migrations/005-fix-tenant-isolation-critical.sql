-- KRITISCHE SICHERHEITS-MIGRATION: Multi-Tenant-Isolation
-- Date: 2025-06-18
-- Priority: HÖCHSTE PRIORITÄT - Sicherheitslücke!
-- Purpose: Stelle sicher, dass alle Daten einem Tenant zugeordnet sind

-- WARNUNG: Diese Migration kann fehlschlagen, wenn NULL-Werte existieren!
-- Führe zuerst einen Check aus:
-- SELECT COUNT(*) FROM users WHERE tenant_id IS NULL;
-- SELECT COUNT(*) FROM departments WHERE tenant_id IS NULL;

-- 1. Fix users table - KRITISCH!
-- Erst alle NULL tenant_ids auf 1 setzen (falls vorhanden)
UPDATE users SET tenant_id = 1 WHERE tenant_id IS NULL;
-- Drop existing foreign key first
ALTER TABLE users DROP FOREIGN KEY users_ibfk_1;
-- Dann NOT NULL constraint hinzufügen und Default entfernen
ALTER TABLE users MODIFY COLUMN tenant_id INT NOT NULL;

-- 2. Fix departments table
UPDATE departments SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE departments DROP FOREIGN KEY departments_ibfk_1;
ALTER TABLE departments MODIFY COLUMN tenant_id INT NOT NULL;

-- 3. Fix api_logs table
UPDATE api_logs SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE api_logs DROP FOREIGN KEY api_logs_ibfk_1;
ALTER TABLE api_logs MODIFY COLUMN tenant_id INT NOT NULL;

-- 4. Fix security_logs table  
UPDATE security_logs SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE security_logs DROP FOREIGN KEY security_logs_ibfk_1;
ALTER TABLE security_logs MODIFY COLUMN tenant_id INT NOT NULL;

-- 5. Fix email_templates table
UPDATE email_templates SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE email_templates DROP FOREIGN KEY email_templates_ibfk_1;
ALTER TABLE email_templates MODIFY COLUMN tenant_id INT NOT NULL;

-- 6. Views mit Default 1 müssen auch gefixt werden
-- Diese sind Views, also müssen wir die zugrundeliegenden Tabellen prüfen

-- Zusätzliche Sicherheit: Foreign Key Constraints neu erstellen
-- Stelle sicher, dass tenant_id immer auf einen existierenden Tenant verweist
ALTER TABLE users 
  ADD CONSTRAINT fk_users_tenant 
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) 
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE departments 
  ADD CONSTRAINT fk_departments_tenant 
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) 
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE api_logs 
  ADD CONSTRAINT fk_api_logs_tenant 
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) 
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE security_logs 
  ADD CONSTRAINT fk_security_logs_tenant 
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) 
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE email_templates 
  ADD CONSTRAINT fk_email_templates_tenant 
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) 
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Log diese kritische Migration
INSERT INTO system_logs (level, message, created_at) 
VALUES ('CRITICAL', 'Multi-Tenant-Isolation Migration ausgeführt - tenant_id NOT NULL constraints hinzugefügt', NOW());