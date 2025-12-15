-- =====================================================
-- Migration: Drop shift_templates table (unused/dead code)
-- Date: 2025-12-11
-- Author: Claude
-- Reason: Table is never used by frontend, always empty, dead code
-- =====================================================

-- 1. Drop FK constraint from shifts.template_id
ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_ibfk_3;

-- 2. Drop the template_id column from shifts table
ALTER TABLE shifts DROP COLUMN IF EXISTS template_id;

-- 3. Drop triggers on shift_templates
DROP TRIGGER IF EXISTS on_update_current_timestamp ON shift_templates;
DROP TRIGGER IF EXISTS update_shift_templates_updated_at ON shift_templates;

-- 4. Drop RLS policy
DROP POLICY IF EXISTS tenant_isolation ON shift_templates;

-- 5. Drop the shift_templates table
DROP TABLE IF EXISTS shift_templates CASCADE;

-- 6. Drop related function
DROP FUNCTION IF EXISTS on_update_current_timestamp_shift_templates();

-- 7. Drop sequence (should be dropped with CASCADE but just to be safe)
DROP SEQUENCE IF EXISTS shift_templates_id_seq;

-- Verification query (run manually after migration)
-- SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'shift_templates');
-- Should return: f (false)
