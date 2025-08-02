-- Cleanup ALL Test Data with __AUTOTEST__ prefix
-- Run this manually when test data accumulates

-- Show current test data
SELECT 'Test tenants before cleanup:' as Info, COUNT(*) as Count 
FROM tenants 
WHERE subdomain LIKE '__AUTOTEST__%' OR company_name LIKE '__AUTOTEST__%';

-- Delete in correct order (foreign keys!)

-- 1. Delete from user_teams
DELETE FROM user_teams 
WHERE tenant_id IN (
    SELECT id FROM tenants 
    WHERE subdomain LIKE '__AUTOTEST__%' OR company_name LIKE '__AUTOTEST__%'
);

-- 2. Delete from teams  
DELETE FROM teams
WHERE tenant_id IN (
    SELECT id FROM tenants 
    WHERE subdomain LIKE '__AUTOTEST__%' OR company_name LIKE '__AUTOTEST__%'
);

-- 3. Delete from departments
DELETE FROM departments
WHERE tenant_id IN (
    SELECT id FROM tenants 
    WHERE subdomain LIKE '__AUTOTEST__%' OR company_name LIKE '__AUTOTEST__%'
);

-- 4. Delete from calendar_events
DELETE FROM calendar_events
WHERE tenant_id IN (
    SELECT id FROM tenants 
    WHERE subdomain LIKE '__AUTOTEST__%' OR company_name LIKE '__AUTOTEST__%'
);

-- 5. Delete from users (with __AUTOTEST__ prefix)
DELETE FROM users 
WHERE username LIKE '__AUTOTEST__%' OR email LIKE '__AUTOTEST__%';

-- 6. Delete from tenants
DELETE FROM tenants 
WHERE subdomain LIKE '__AUTOTEST__%' OR company_name LIKE '__AUTOTEST__%';

-- Show results
SELECT 'Test tenants after cleanup:' as Info, COUNT(*) as Count 
FROM tenants 
WHERE subdomain LIKE '__AUTOTEST__%' OR company_name LIKE '__AUTOTEST__%';

SELECT 'Test users after cleanup:' as Info, COUNT(*) as Count 
FROM users 
WHERE username LIKE '__AUTOTEST__%' OR email LIKE '__AUTOTEST__%';