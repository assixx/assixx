-- Test-Daten für Zwei-Personen-Löschung
-- =====================================

-- 1. Test-Tenant erstellen
INSERT INTO tenants (company_name, subdomain, created_at, status) 
VALUES ('Test Company GmbH', 'testcompany', NOW(), 'active');

SET @tenant_id = LAST_INSERT_ID();

-- 2. Zwei Root-User erstellen
INSERT INTO users (tenant_id, username, email, password, role, first_name, last_name, created_at, status)
VALUES 
    (@tenant_id, 'root1', 'root1@test.com', '$2a$10$YourHashedPasswordHere', 'root', 'Root', 'One', NOW(), 'active'),
    (@tenant_id, 'root2', 'root2@test.com', '$2a$10$YourHashedPasswordHere', 'root', 'Root', 'Two', NOW(), 'active');

-- 3. Ein normaler User zum Testen
INSERT INTO users (tenant_id, username, email, password, role, first_name, last_name, created_at, status)
VALUES 
    (@tenant_id, 'employee1', 'employee@test.com', '$2a$10$YourHashedPasswordHere', 'employee', 'Test', 'Employee', NOW(), 'active');

-- Zeige die erstellten Daten
SELECT 'Tenant erstellt:' as info;
SELECT * FROM tenants WHERE id = @tenant_id;

SELECT 'Root-User erstellt:' as info;
SELECT id, username, email, role FROM users WHERE tenant_id = @tenant_id AND role = 'root';