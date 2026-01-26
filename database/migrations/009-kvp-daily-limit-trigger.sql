-- =============================================================================
-- Migration 009: KVP Suggestions - Daily Limit Trigger (1 per Employee per Day)
-- =============================================================================
-- Security enforcement at database level: Employees can only create 1 KVP
-- suggestion per day. Admins and root are unlimited.
-- This is Defense in Depth (also enforced at API level).
-- =============================================================================

-- Create function to check daily limit for employees
CREATE OR REPLACE FUNCTION check_kvp_daily_limit()
RETURNS TRIGGER AS $$
DECLARE
    user_role VARCHAR(50);
    today_count INTEGER;
BEGIN
    -- Get the role of the user trying to insert
    SELECT role INTO user_role
    FROM users
    WHERE id = NEW.submitted_by;

    -- Admin and root have no limit
    IF user_role IN ('admin', 'root') THEN
        RETURN NEW;
    END IF;

    -- Count how many suggestions this user created today
    SELECT COUNT(*) INTO today_count
    FROM kvp_suggestions
    WHERE tenant_id = NEW.tenant_id
      AND submitted_by = NEW.submitted_by
      AND created_at >= CURRENT_DATE
      AND created_at < CURRENT_DATE + INTERVAL '1 day';

    -- Employees can only create 1 per day
    IF today_count >= 1 THEN
        RAISE EXCEPTION 'Tageslimit erreicht: Mitarbeiter können nur 1 KVP-Vorschlag pro Tag einreichen.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists (for idempotency)
DROP TRIGGER IF EXISTS trg_kvp_daily_limit ON kvp_suggestions;

-- Create trigger on INSERT
CREATE TRIGGER trg_kvp_daily_limit
    BEFORE INSERT ON kvp_suggestions
    FOR EACH ROW
    EXECUTE FUNCTION check_kvp_daily_limit();

-- Add comment for documentation
COMMENT ON TRIGGER trg_kvp_daily_limit ON kvp_suggestions IS
    'Rate Limit: Employees can only create 1 KVP suggestion per day';

COMMENT ON FUNCTION check_kvp_daily_limit() IS
    'Validates that employees do not exceed 1 KVP suggestion per day';
