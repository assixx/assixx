-- Migration: Fix employee_number für Multi-Tenant Isolation
-- Datum: 23.08.2025
-- Problem: employee_number ist global unique, sollte aber nur innerhalb eines Tenants unique sein
-- Lösung: Composite Unique Index auf (tenant_id, employee_number)

-- 1. Entferne den globalen UNIQUE INDEX
ALTER TABLE `users` 
DROP INDEX `idx_employee_number`;

-- 2. Erstelle einen Composite Unique Index für Multi-Tenant
-- Dies erlaubt jedem Tenant seine eigenen employee_numbers
ALTER TABLE `users` 
ADD UNIQUE KEY `idx_tenant_employee_number` (`tenant_id`, `employee_number`);

-- 3. Füge einen normalen Index für employee_number hinzu (für Performance bei Suchen)
ALTER TABLE `users` 
ADD INDEX `idx_employee_number_search` (`employee_number`);

-- Verifizierung:
-- Nach dieser Migration:
-- - Tenant 1 kann Mitarbeiter mit employee_number "001" haben
-- - Tenant 2 kann AUCH Mitarbeiter mit employee_number "001" haben
-- - Innerhalb eines Tenants bleibt employee_number unique