-- =====================================================
-- Migration: Add Employee Availability View and Procedures
-- Date: 2025-01-06
-- Author: System
-- Description: Creates views and procedures for availability (separate from table creation)
-- =====================================================

-- 1. Create view for current availability status
DROP VIEW IF EXISTS current_employee_availability;

CREATE VIEW current_employee_availability AS
SELECT 
    u.id AS employee_id,
    u.tenant_id,
    u.username,
    u.first_name,
    u.last_name,
    COALESCE(
        (SELECT ea.status 
         FROM employee_availability ea 
         WHERE ea.employee_id = u.id 
         AND ea.tenant_id = u.tenant_id
         AND CURDATE() BETWEEN ea.start_date AND ea.end_date 
         ORDER BY ea.created_at DESC 
         LIMIT 1),
        'available'
    ) AS current_status,
    (SELECT ea.reason 
     FROM employee_availability ea 
     WHERE ea.employee_id = u.id 
     AND ea.tenant_id = u.tenant_id
     AND CURDATE() BETWEEN ea.start_date AND ea.end_date 
     ORDER BY ea.created_at DESC 
     LIMIT 1) AS current_reason,
    (SELECT ea.end_date 
     FROM employee_availability ea 
     WHERE ea.employee_id = u.id 
     AND ea.tenant_id = u.tenant_id
     AND CURDATE() BETWEEN ea.start_date AND ea.end_date 
     ORDER BY ea.created_at DESC 
     LIMIT 1) AS available_from
FROM users u
WHERE u.role = 'employee';

-- 2. Create stored procedure to update user availability status
DROP PROCEDURE IF EXISTS UpdateUserAvailabilityStatus;

DELIMITER //

CREATE PROCEDURE UpdateUserAvailabilityStatus()
BEGIN
    -- Update all users based on current availability
    UPDATE users u
    SET u.availability_status = (
        SELECT COALESCE(
            (SELECT ea.status 
             FROM employee_availability ea 
             WHERE ea.employee_id = u.id 
             AND ea.tenant_id = u.tenant_id
             AND CURDATE() BETWEEN ea.start_date AND ea.end_date 
             ORDER BY ea.created_at DESC 
             LIMIT 1),
            'available'
        )
    )
    WHERE u.role = 'employee';
END//

DELIMITER ;

-- 3. Create event to automatically update availability status daily
-- Note: event_scheduler must be enabled by DBA
-- SET GLOBAL event_scheduler = ON;

DROP EVENT IF EXISTS update_availability_status_daily;
CREATE EVENT IF NOT EXISTS update_availability_status_daily
ON SCHEDULE EVERY 1 DAY
STARTS (TIMESTAMP(CURRENT_DATE) + INTERVAL 1 DAY)
DO CALL UpdateUserAvailabilityStatus();

-- 4. Initial update of availability status
CALL UpdateUserAvailabilityStatus();

-- 5. Grant permissions
-- Note: Permissions must be granted by DBA
-- GRANT SELECT, INSERT, UPDATE, DELETE ON employee_availability TO 'assixx_user'@'%';
-- GRANT SELECT ON current_employee_availability TO 'assixx_user'@'%';
-- GRANT EXECUTE ON PROCEDURE UpdateUserAvailabilityStatus TO 'assixx_user'@'%';