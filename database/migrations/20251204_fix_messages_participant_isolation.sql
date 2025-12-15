-- Migration: Fix messages participant isolation to be RESTRICTIVE
-- Date: 2025-12-04
-- Issue: participant_isolation was PERMISSIVE, allowing any tenant user to see all messages
-- Root cause: PostgreSQL PERMISSIVE policies use OR logic, so tenant_isolation passing
--             meant participant_isolation was ignored
-- Solution: Change participant_isolation to RESTRICTIVE (AND logic)
--
-- Security Impact: Users can now ONLY see messages from conversations they participate in
-- Fallback: System operations without user_id context still work (IS NULL check)

-- Drop existing PERMISSIVE policy
DROP POLICY IF EXISTS participant_isolation ON messages;

-- Create RESTRICTIVE policy (must pass IN ADDITION to tenant_isolation)
CREATE POLICY participant_isolation ON messages
AS RESTRICTIVE
FOR ALL USING (
  -- Allow if user_id context is not set (system/admin operations)
  NULLIF(current_setting('app.user_id', true), '') IS NULL
  -- OR user is a participant in the conversation
  OR EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = messages.conversation_id
    AND cp.user_id = (NULLIF(current_setting('app.user_id', true), ''))::integer
    AND cp.tenant_id = messages.tenant_id
  )
);

-- Verify policies
SELECT polname, polpermissive, polcmd,
       pg_get_expr(polqual, polrelid) as using_expr
FROM pg_policy
WHERE polrelid = 'messages'::regclass;
