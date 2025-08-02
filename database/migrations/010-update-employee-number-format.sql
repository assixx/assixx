-- =====================================================
-- Migration: Update employee_number format
-- Date: 2025-07-23
-- Author: Assixx Development Team
-- Description: Allow letters and hyphens in employee_number (max 10 chars)
-- =====================================================

-- 1. Alter the employee_number column to allow up to 10 characters
ALTER TABLE users 
MODIFY COLUMN employee_number VARCHAR(10) NOT NULL;

-- 2. Update the unique constraint (it should remain)
-- The unique constraint already exists, so we don't need to recreate it

-- 3. Add a check comment for documentation
ALTER TABLE users 
MODIFY COLUMN employee_number VARCHAR(10) NOT NULL 
COMMENT 'Personalnummer: Max 10 Zeichen, Buchstaben, Zahlen und Bindestrich erlaubt';

-- Note: New format allows:
-- - Letters (A-Z, a-z)
-- - Numbers (0-9)
-- - Hyphens (-)
-- - Maximum length: 10 characters
-- Examples: 'ABC-123', '2025-001', 'EMP001', etc.