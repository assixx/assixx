-- =============================================================================
-- Migration 008: KVP Comments - Admin/Root Only Trigger
-- =============================================================================
-- Security enforcement at database level: Only admin/root users can add comments
-- to KVP suggestions. This is Defense in Depth (also enforced at API level).
-- =============================================================================

-- Create function to check if user is admin or root
CREATE OR REPLACE FUNCTION check_kvp_comment_permission()
RETURNS TRIGGER AS $$
DECLARE
    user_role VARCHAR(50);
BEGIN
    -- Get the role of the user trying to insert
    SELECT role INTO user_role
    FROM users
    WHERE id = NEW.user_id;

    -- Only allow admin and root to add comments
    IF user_role IS NULL THEN
        RAISE EXCEPTION 'User not found: %', NEW.user_id;
    END IF;

    IF user_role NOT IN ('admin', 'root') THEN
        RAISE EXCEPTION 'Permission denied: Only admin and root users can add KVP comments. User role: %', user_role;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists (for idempotency)
DROP TRIGGER IF EXISTS trg_kvp_comments_admin_only ON kvp_comments;

-- Create trigger on INSERT
CREATE TRIGGER trg_kvp_comments_admin_only
    BEFORE INSERT ON kvp_comments
    FOR EACH ROW
    EXECUTE FUNCTION check_kvp_comment_permission();

-- Add comment for documentation
COMMENT ON TRIGGER trg_kvp_comments_admin_only ON kvp_comments IS
    'Security: Only admin/root users can add comments to KVP suggestions';

COMMENT ON FUNCTION check_kvp_comment_permission() IS
    'Validates that only admin/root users can insert KVP comments';
