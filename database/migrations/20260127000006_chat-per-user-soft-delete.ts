/**
 * Migration: Per-user soft delete for chat conversations
 * Date: 2026-01-20 (original) / 2026-01-27 (wrapped)
 *
 * Adds deleted_at to conversation_participants for WhatsApp-style
 * "delete for me" behavior. Other participants still see the conversation.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE conversation_participants
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE NULL;

    CREATE INDEX IF NOT EXISTS idx_cp_deleted_at
    ON conversation_participants(conversation_id, user_id)
    WHERE deleted_at IS NULL;

    COMMENT ON COLUMN conversation_participants.deleted_at IS
    'Per-user soft delete timestamp. When set, conversation is hidden only for this user (WhatsApp "delete for me" pattern).';
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_cp_deleted_at;
    ALTER TABLE conversation_participants DROP COLUMN IF EXISTS deleted_at;
  `);
}
