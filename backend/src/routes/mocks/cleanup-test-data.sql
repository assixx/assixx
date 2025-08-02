-- Vollständiges Cleanup für Test-Daten
-- WICHTIG: Foreign Keys temporär deaktivieren für sauberes Cleanup

SET FOREIGN_KEY_CHECKS = 0;

-- Lösche ALLE Test-Daten (nicht nur tenant_id > 1)
-- Tests nutzen spezielle Test-Emails/Subdomains

-- 1. Lösche alle User-bezogenen Daten
DELETE FROM activity_logs WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '%test%' OR subdomain LIKE '%authtest%');
DELETE FROM admin_logs WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '%test%' OR subdomain LIKE '%authtest%');
DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%test%' OR username LIKE '%test%');
DELETE FROM login_attempts WHERE username LIKE '%test%';
DELETE FROM user_settings WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%test%' OR username LIKE '%test%');
DELETE FROM user_teams WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%test%' OR username LIKE '%test%');

-- 2. Lösche alle Feature-bezogenen Test-Daten
DELETE FROM blackboard_entries WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '%test%' OR subdomain LIKE '%authtest%');
DELETE FROM chat_messages WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '%test%' OR subdomain LIKE '%authtest%');
DELETE FROM calendar_events WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '%test%' OR subdomain LIKE '%authtest%');
DELETE FROM shifts WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '%test%' OR subdomain LIKE '%authtest%');
DELETE FROM documents WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '%test%' OR subdomain LIKE '%authtest%');
DELETE FROM surveys WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '%test%' OR subdomain LIKE '%authtest%');
DELETE FROM kvp_suggestions WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '%test%' OR subdomain LIKE '%authtest%');

-- 3. Lösche Organisationsstruktur
DELETE FROM teams WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '%test%' OR subdomain LIKE '%authtest%');
DELETE FROM departments WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '%test%' OR subdomain LIKE '%authtest%');

-- 4. Lösche User
DELETE FROM users WHERE email LIKE '%test%' OR username LIKE '%test%' OR tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '%test%' OR subdomain LIKE '%authtest%');

-- 5. Lösche Tenants
DELETE FROM tenants WHERE subdomain LIKE '%test%' OR subdomain LIKE '%authtest%' OR company_name LIKE '%Test%';

SET FOREIGN_KEY_CHECKS = 1;