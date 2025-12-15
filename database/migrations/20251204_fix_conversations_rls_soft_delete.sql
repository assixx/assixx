-- Migration: Fix conversations RLS policy for soft delete support
-- Date: 2025-12-04
-- Issue: UPDATE to is_active = 4 (soft delete) was blocked by RLS
-- Root cause: SELECT policy had is_active = 1 filter, which PostgreSQL with
--             FORCE ROW LEVEL SECURITY validates against for UPDATE operations
-- Solution: Remove is_active filter from RLS, filter in application layer instead

-- Drop and recreate SELECT policy without is_active filter
DROP POLICY IF EXISTS conversations_select ON conversations;

CREATE POLICY conversations_select ON conversations
FOR SELECT USING (
  NULLIF(current_setting('app.tenant_id', true), '') IS NULL
  OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
);

-- Recreate UPDATE policy with proper tenant-only WITH CHECK
DROP POLICY IF EXISTS conversations_update ON conversations;

CREATE POLICY conversations_update ON conversations
FOR UPDATE
USING (
  NULLIF(current_setting('app.tenant_id', true), '') IS NULL
  OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
)
WITH CHECK (
  NULLIF(current_setting('app.tenant_id', true), '') IS NULL
  OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
);

-- Verify policies
SELECT polname, polcmd, pg_get_expr(polqual, polrelid) as using_expr
FROM pg_policy WHERE polrelid = 'conversations'::regclass;
