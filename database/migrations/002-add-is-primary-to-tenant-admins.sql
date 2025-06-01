-- =====================================================
-- Migration: 002-add-is-primary-to-tenant-admins.sql
-- Date: 2025-06-01
-- Purpose: Add missing is_primary column to tenant_admins
-- =====================================================

-- Add is_primary column to tenant_admins table
ALTER TABLE tenant_admins 
ADD COLUMN is_primary BOOLEAN DEFAULT FALSE AFTER user_id;

-- Set first admin as primary for each tenant
UPDATE tenant_admins ta1
SET is_primary = TRUE
WHERE ta1.id = (
    SELECT MIN(ta2.id)
    FROM (SELECT * FROM tenant_admins) ta2
    WHERE ta2.tenant_id = ta1.tenant_id
);