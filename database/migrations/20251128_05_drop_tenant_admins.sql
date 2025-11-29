-- Migration: Drop tenant_admins table (redundant)
-- Date: 2025-11-28
-- Reason: Table is 100% redundant - users.tenant_id + users.role is the source of truth
--
-- ANALYSIS:
-- 1. tenant_admins had only 1 entry which was a ROOT user (not admin!)
-- 2. Table was NEVER read (no SELECTs in code)
-- 3. users.tenant_id already shows tenant membership
-- 4. users.role already identifies admins/roots
-- 5. Code already used try/catch to ignore INSERT failures (showing it was optional)

-- Drop the redundant table
DROP TABLE IF EXISTS tenant_admins;
