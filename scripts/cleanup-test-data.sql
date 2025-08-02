-- Cleanup Script für Test-Daten
-- Entfernt alle Test-Einträge die mit __AUTOTEST__ beginnen

-- Zeige vorher die Anzahl der betroffenen Einträge
SELECT 'Tenants to delete:' as Info, COUNT(*) as Count FROM tenants WHERE subdomain LIKE '__AUTOTEST__%' OR company_name LIKE '__AUTOTEST__%';
SELECT 'Users to delete:' as Info, COUNT(*) as Count FROM users WHERE username LIKE '__AUTOTEST__%' OR email LIKE '__AUTOTEST__%';

-- Lösche in der richtigen Reihenfolge (wegen Foreign Keys)

-- 1. Survey-bezogene Daten
DELETE FROM survey_answers WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '__AUTOTEST__%' OR company_name LIKE '__AUTOTEST__%');
DELETE FROM survey_responses WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '__AUTOTEST__%' OR company_name LIKE '__AUTOTEST__%');
DELETE FROM survey_questions WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '__AUTOTEST__%' OR company_name LIKE '__AUTOTEST__%');
DELETE FROM surveys WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '__AUTOTEST__%' OR company_name LIKE '__AUTOTEST__%');
DELETE FROM survey_templates WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '__AUTOTEST__%' OR company_name LIKE '__AUTOTEST__%');

-- 2. Document-bezogene Daten
DELETE FROM document_permissions WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '__AUTOTEST__%' OR company_name LIKE '__AUTOTEST__%');
DELETE FROM documents WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '__AUTOTEST__%' OR company_name LIKE '__AUTOTEST__%');

-- 3. Team-bezogene Daten
DELETE FROM user_teams WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '__AUTOTEST__%' OR company_name LIKE '__AUTOTEST__%');
DELETE FROM teams WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '__AUTOTEST__%' OR company_name LIKE '__AUTOTEST__%');

-- 4. Department-bezogene Daten
DELETE FROM user_departments WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '__AUTOTEST__%' OR company_name LIKE '__AUTOTEST__%');
DELETE FROM departments WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '__AUTOTEST__%' OR company_name LIKE '__AUTOTEST__%');

-- 5. Calendar/Event-bezogene Daten
DELETE FROM event_participants WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '__AUTOTEST__%' OR company_name LIKE '__AUTOTEST__%');
DELETE FROM calendar_events WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '__AUTOTEST__%' OR company_name LIKE '__AUTOTEST__%');

-- 6. Chat-bezogene Daten
DELETE FROM chat_messages WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '__AUTOTEST__%' OR company_name LIKE '__AUTOTEST__%');
DELETE FROM chat_members WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '__AUTOTEST__%' OR company_name LIKE '__AUTOTEST__%');
DELETE FROM chat_rooms WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '__AUTOTEST__%' OR company_name LIKE '__AUTOTEST__%');

-- 7. Blackboard-bezogene Daten
DELETE FROM blackboard_entries WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '__AUTOTEST__%' OR company_name LIKE '__AUTOTEST__%');

-- 8. Shift-bezogene Daten
DELETE FROM shifts WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '__AUTOTEST__%' OR company_name LIKE '__AUTOTEST__%');
DELETE FROM shift_templates WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '__AUTOTEST__%' OR company_name LIKE '__AUTOTEST__%');

-- 9. User-bezogene Daten
DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM users WHERE username LIKE '__AUTOTEST__%' OR email LIKE '__AUTOTEST__%');
DELETE FROM oauth_tokens WHERE user_id IN (SELECT id FROM users WHERE username LIKE '__AUTOTEST__%' OR email LIKE '__AUTOTEST__%');
DELETE FROM login_attempts WHERE username LIKE '__AUTOTEST__%';
DELETE FROM admin_logs WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '__AUTOTEST__%' OR company_name LIKE '__AUTOTEST__%');
DELETE FROM activity_logs WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE '__AUTOTEST__%' OR company_name LIKE '__AUTOTEST__%');

-- 10. Users löschen
DELETE FROM users WHERE username LIKE '__AUTOTEST__%' OR email LIKE '__AUTOTEST__%';

-- 11. Tenants löschen
DELETE FROM tenants WHERE subdomain LIKE '__AUTOTEST__%' OR company_name LIKE '__AUTOTEST__%';

-- Zeige nachher die Anzahl der verbleibenden Test-Einträge (sollte 0 sein)
SELECT 'Remaining test tenants:' as Info, COUNT(*) as Count FROM tenants WHERE subdomain LIKE '__AUTOTEST__%' OR company_name LIKE '__AUTOTEST__%';
SELECT 'Remaining test users:' as Info, COUNT(*) as Count FROM users WHERE username LIKE '__AUTOTEST__%' OR email LIKE '__AUTOTEST__%';

-- Zusätzlich: Finde verdächtige Einträge ohne Präfix
SELECT 'Suspicious tenants (containing "test"):' as Info, COUNT(*) as Count FROM tenants WHERE (subdomain LIKE '%test%' OR company_name LIKE '%test%') AND subdomain NOT LIKE '__AUTOTEST__%';
SELECT 'Recent tenants (last 24h):' as Info, COUNT(*) as Count FROM tenants WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR);