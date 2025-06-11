-- =====================================================
-- Migration: Add Employee Availability System
-- Date: 2025-01-06
-- Author: System
-- Description: Adds employee availability tracking for vacation, sick leave, etc.
-- =====================================================

-- 1. Create employee_availability table
CREATE TABLE IF NOT EXISTS employee_availability (
    id INT PRIMARY KEY AUTO_INCREMENT,
    employee_id INT NOT NULL,
    tenant_id INT NOT NULL,
    status ENUM('available', 'unavailable', 'vacation', 'sick', 'training', 'other') NOT NULL DEFAULT 'available',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason VARCHAR(255),
    notes TEXT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign keys
    CONSTRAINT fk_availability_employee FOREIGN KEY (employee_id) 
        REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_availability_tenant FOREIGN KEY (tenant_id) 
        REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_availability_created_by FOREIGN KEY (created_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    
    -- Ensure end_date is after or equal to start_date
    CONSTRAINT chk_availability_dates CHECK (end_date >= start_date),
    
    -- Indexes
    INDEX idx_availability_employee (employee_id),
    INDEX idx_availability_tenant (tenant_id),
    INDEX idx_availability_dates (start_date, end_date),
    INDEX idx_availability_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Add availability_status column to users table if not exists
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'users' 
    AND COLUMN_NAME = 'availability_status'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE users ADD COLUMN availability_status ENUM(''available'', ''unavailable'', ''vacation'', ''sick'') DEFAULT ''available''',
    'SELECT "Column availability_status already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Create view for current availability status
-- Drop view if exists first
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

-- 4. Create stored procedure to update user availability status
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

-- 5. Create event to automatically update availability status daily
SET GLOBAL event_scheduler = ON;

DROP EVENT IF EXISTS update_availability_status_daily;
CREATE EVENT IF NOT EXISTS update_availability_status_daily
ON SCHEDULE EVERY 1 DAY
STARTS (TIMESTAMP(CURRENT_DATE) + INTERVAL 1 DAY)
DO CALL UpdateUserAvailabilityStatus();

-- 6. Initial update of availability status
CALL UpdateUserAvailabilityStatus();

-- 7. Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON employee_availability TO 'assixx_user'@'%';
GRANT SELECT ON current_employee_availability TO 'assixx_user'@'%';
GRANT EXECUTE ON PROCEDURE UpdateUserAvailabilityStatus TO 'assixx_user'@'%';