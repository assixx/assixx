-- KRITISCHE SICHERHEITS-MIGRATION: Multi-Tenant-Isolation SIMPLE
-- Date: 2025-06-18
-- Priority: HÖCHSTE PRIORITÄT - Sicherheitslücke!

-- 1. Fix users table - KRITISCH!
UPDATE users SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE users MODIFY COLUMN tenant_id INT NOT NULL;

-- 2. Fix departments table
UPDATE departments SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE departments MODIFY COLUMN tenant_id INT NOT NULL;

-- 3. Fix api_logs table
UPDATE api_logs SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE api_logs MODIFY COLUMN tenant_id INT NOT NULL;

-- 4. Fix security_logs table
UPDATE security_logs SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE security_logs MODIFY COLUMN tenant_id INT NOT NULL;

-- 5. Fix email_templates table
UPDATE email_templates SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE email_templates MODIFY COLUMN tenant_id INT NOT NULL;

-- Foreign Key Constraints hinzufügen
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

-- Verifizierung
SELECT 'Migration erfolgreich!' as Status;