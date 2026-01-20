-- =====================================================
-- Migration: 006-chat-per-user-soft-delete.sql
-- Purpose: Add per-user soft delete for chat conversations
-- Date: 2026-01-20
-- Author: Claude Code
-- =====================================================
--
-- Problem: Current deleteConversation sets conversations.is_active = 4,
--          which hides the conversation for ALL participants.
--
-- Solution: Add deleted_at to conversation_participants table.
--           When a user deletes, only their participant record is marked.
--           Other participants still see the conversation.
--
-- Pattern: WhatsApp "delete for me" behavior
-- =====================================================

-- 1. Add deleted_at column to conversation_participants
ALTER TABLE conversation_participants
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE NULL;

-- 2. Add index for efficient filtering (partial index for non-deleted)
CREATE INDEX IF NOT EXISTS idx_cp_deleted_at
ON conversation_participants(conversation_id, user_id)
WHERE deleted_at IS NULL;

-- 3. Add comment for documentation
COMMENT ON COLUMN conversation_participants.deleted_at IS
'Per-user soft delete timestamp. When set, conversation is hidden only for this user (WhatsApp "delete for me" pattern).';

-- 4. Grant permissions to app_user (RLS enforced user)
-- Note: Column-level permissions are inherited from table grants

-- =====================================================
-- Verification query (run after migration):
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'conversation_participants'
-- AND column_name = 'deleted_at';
-- =====================================================
