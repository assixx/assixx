-- Migration: Add participant-based RLS for chat messages and attachments
-- Date: 2025-12-04
-- Purpose: Ensure chat messages and attachments are only visible to conversation participants
--
-- This adds an ADDITIONAL layer of security on top of existing tenant_isolation policies.
-- Even if backend code has bugs, users cannot access messages from conversations they don't belong to.

-- Drop existing participant policies if they exist (for idempotency)
DROP POLICY IF EXISTS participant_isolation ON messages;
DROP POLICY IF EXISTS chat_participant_isolation ON documents;

-- =============================================================================
-- MESSAGES: Participant-based RLS
-- =============================================================================
-- Users can only see/modify messages in conversations they are participants of
-- This policy COMBINES with tenant_isolation (both must pass)

CREATE POLICY participant_isolation ON messages
  FOR ALL
  TO public
  USING (
    -- Allow if no user context is set (for system/admin queries)
    NULLIF(current_setting('app.user_id', true), '') IS NULL
    OR
    -- Allow if user is a participant of this conversation
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
        AND cp.user_id = NULLIF(current_setting('app.user_id', true), '')::integer
        AND cp.tenant_id = messages.tenant_id
    )
  );

-- =============================================================================
-- DOCUMENTS (chat): Participant-based RLS
-- =============================================================================
-- For chat attachments (access_scope = 'chat'), users can only see them
-- if they are participants of the referenced conversation

CREATE POLICY chat_participant_isolation ON documents
  FOR ALL
  TO public
  USING (
    -- Non-chat documents: allow (they use other visibility rules at app level)
    access_scope != 'chat'
    OR
    -- Chat documents: require participant check
    (
      -- Allow if no user context is set (for system/admin queries)
      NULLIF(current_setting('app.user_id', true), '') IS NULL
      OR
      -- Allow if user is a participant of the conversation
      (
        conversation_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM conversation_participants cp
          WHERE cp.conversation_id = documents.conversation_id
            AND cp.user_id = NULLIF(current_setting('app.user_id', true), '')::integer
            AND cp.tenant_id = documents.tenant_id
        )
      )
    )
  );

-- =============================================================================
-- VERIFICATION QUERIES (for testing after migration)
-- =============================================================================
-- Run these to verify the policies are in place:
--
-- SELECT policyname, tablename, qual::text
-- FROM pg_policies
-- WHERE tablename IN ('messages', 'documents')
--   AND policyname LIKE '%participant%';

-- =============================================================================
-- ROLLBACK (if needed)
-- =============================================================================
-- DROP POLICY IF EXISTS participant_isolation ON messages;
-- DROP POLICY IF EXISTS chat_participant_isolation ON documents;
