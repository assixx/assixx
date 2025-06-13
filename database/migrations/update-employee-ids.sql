-- =====================================================
-- Migration: Update existing users with new employee_id format
-- Date: 2025-06-12
-- Format: DOMAIN|ROLE|USERID|TIMESTAMP
-- =====================================================

-- Create stored procedure to update employee_ids
DELIMITER $$

CREATE PROCEDURE UpdateEmployeeIds()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE user_id INT;
    DECLARE user_role VARCHAR(50);
    DECLARE tenant_id INT;
    DECLARE subdomain VARCHAR(50);
    DECLARE new_employee_id VARCHAR(100);
    
    -- Cursor for users without proper employee_id
    DECLARE user_cursor CURSOR FOR 
        SELECT u.id, u.role, u.tenant_id, t.subdomain
        FROM users u
        JOIN tenants t ON u.tenant_id = t.id
        WHERE u.employee_id IS NULL 
           OR u.employee_id = ''
           OR u.employee_id NOT LIKE '%|%|%|%';
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    OPEN user_cursor;
    
    read_loop: LOOP
        FETCH user_cursor INTO user_id, user_role, tenant_id, subdomain;
        
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        -- Generate new employee_id
        SET new_employee_id = CONCAT(
            UPPER(SUBSTRING(subdomain, 1, 10)), '|',
            UPPER(user_role), '|',
            user_id, '|',
            SUBSTRING(UNIX_TIMESTAMP() * 1000, -6)
        );
        
        -- Update user
        UPDATE users 
        SET employee_id = new_employee_id
        WHERE id = user_id;
        
    END LOOP;
    
    CLOSE user_cursor;
END$$

DELIMITER ;

-- Execute the procedure
CALL UpdateEmployeeIds();

-- Drop the procedure
DROP PROCEDURE UpdateEmployeeIds;

-- Show results
SELECT id, username, role, employee_id FROM users LIMIT 10;