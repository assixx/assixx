-- =====================================================
-- Migration: Update employee_ids to new compact format
-- Date: 2025-06-12
-- Format: DOMAINROLEIDDDMMYYYYHHMM
-- Example: SCSRT1012062025175​2
-- =====================================================

-- Create stored procedure to update employee_ids
DELIMITER $$

CREATE PROCEDURE UpdateEmployeeIdsNewFormat()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE user_id INT;
    DECLARE user_role VARCHAR(50);
    DECLARE tenant_id INT;
    DECLARE subdomain VARCHAR(50);
    DECLARE role_code VARCHAR(3);
    DECLARE new_employee_id VARCHAR(100);
    DECLARE current_datetime VARCHAR(12);
    
    -- Cursor for all users
    DECLARE user_cursor CURSOR FOR 
        SELECT u.id, u.role, u.tenant_id, t.subdomain
        FROM users u
        JOIN tenants t ON u.tenant_id = t.id;
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    -- Get current datetime in DDMMYYYYHHMM format
    SET current_datetime = DATE_FORMAT(NOW(), '%d%m%Y%H%i');
    
    OPEN user_cursor;
    
    read_loop: LOOP
        FETCH user_cursor INTO user_id, user_role, tenant_id, subdomain;
        
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        -- Get role abbreviation
        CASE LOWER(user_role)
            WHEN 'root' THEN SET role_code = 'RT';
            WHEN 'admin' THEN SET role_code = 'AD';
            WHEN 'employee' THEN SET role_code = 'EMP';
            ELSE SET role_code = 'EMP';
        END CASE;
        
        -- Generate new employee_id
        SET new_employee_id = CONCAT(
            UPPER(SUBSTRING(subdomain, 1, 10)),
            role_code,
            user_id,
            current_datetime
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
CALL UpdateEmployeeIdsNewFormat();

-- Drop the procedure
DROP PROCEDURE UpdateEmployeeIdsNewFormat;

-- Show results
SELECT id, username, role, employee_id FROM users;

-- Show formatted view
SELECT 
    id,
    CONCAT(first_name, ' ', last_name) as full_name,
    role,
    employee_id,
    CONCAT(
        'Domain: ', SUBSTRING(employee_id, 1, 3), ', ',
        'Role: ', 
        CASE 
            WHEN employee_id LIKE '%RT%' THEN 'Root'
            WHEN employee_id LIKE '%AD%' THEN 'Admin'
            WHEN employee_id LIKE '%EMP%' THEN 'Employee'
        END, ', ',
        'Created: ', 
        SUBSTRING(employee_id, -12, 2), '.',
        SUBSTRING(employee_id, -10, 2), '.',
        SUBSTRING(employee_id, -8, 4), ' ',
        SUBSTRING(employee_id, -4, 2), ':',
        SUBSTRING(employee_id, -2, 2)
    ) as employee_id_decoded
FROM users;