-- =====================================================
-- Migration: Drop company and iban columns from users
-- Date: 2025-11-27
-- Author: Claude
-- Description: Remove unused columns company and iban from users table
-- =====================================================

-- Drop company column
ALTER TABLE users DROP COLUMN company;

-- Drop iban column
ALTER TABLE users DROP COLUMN iban;
