-- ============================================
-- PROTECTED TABLES: Prevent accidental deletion
-- Run AFTER pgloader migration
-- ============================================

-- ============================================
-- 1. Generic function for delete protection
-- ============================================
CREATE OR REPLACE FUNCTION prevent_delete_protected_table()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'PROTECTED TABLE: DELETE not allowed on % - system critical data', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. Apply to protected tables
-- ============================================

-- Drop existing triggers if any
DROP TRIGGER IF EXISTS prevent_plans_delete ON plans;
DROP TRIGGER IF EXISTS prevent_features_delete ON features;
DROP TRIGGER IF EXISTS prevent_plan_features_delete ON plan_features;

-- Plans table
CREATE TRIGGER prevent_plans_delete
    BEFORE DELETE ON plans
    FOR EACH ROW
    EXECUTE FUNCTION prevent_delete_protected_table();

-- Features table
CREATE TRIGGER prevent_features_delete
    BEFORE DELETE ON features
    FOR EACH ROW
    EXECUTE FUNCTION prevent_delete_protected_table();

-- Plan_features table
CREATE TRIGGER prevent_plan_features_delete
    BEFORE DELETE ON plan_features
    FOR EACH ROW
    EXECUTE FUNCTION prevent_delete_protected_table();

SELECT 'Protected table triggers created successfully' AS status;
