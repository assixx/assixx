/**
 * Migration: Rename chat tables for naming consistency
 *
 * Adds the `chat_` prefix to the 4 core chat tables so they match
 * the naming convention of every other domain table in the schema.
 *
 *   messages                  → chat_messages
 *   conversations             → chat_conversations
 *   conversation_participants → chat_conversation_participants
 *   scheduled_messages        → chat_scheduled_messages
 *
 * Also renames all associated database objects: sequences, primary keys,
 * indexes, FK constraints, CHECK constraints, triggers. RLS policies are
 * dropped and recreated with updated table references.
 *
 * Fully reversible via down().
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  // =====================================================
  // 1a. Rename Tables (4x)
  // =====================================================
  pgm.sql(`
    ALTER TABLE messages RENAME TO chat_messages;
    ALTER TABLE conversations RENAME TO chat_conversations;
    ALTER TABLE conversation_participants RENAME TO chat_conversation_participants;
    ALTER TABLE scheduled_messages RENAME TO chat_scheduled_messages;
  `);

  // =====================================================
  // 1b. Rename Sequences (3x — scheduled_messages uses UUID PK)
  // =====================================================
  pgm.sql(`
    ALTER SEQUENCE messages_id_seq RENAME TO chat_messages_id_seq;
    ALTER SEQUENCE conversations_id_seq RENAME TO chat_conversations_id_seq;
    ALTER SEQUENCE conversation_participants_id_seq RENAME TO chat_conversation_participants_id_seq;
  `);

  // =====================================================
  // 1c. Rename Primary Keys (4x)
  // =====================================================
  pgm.sql(`
    ALTER TABLE chat_messages RENAME CONSTRAINT idx_19366_primary TO chat_messages_pkey;
    ALTER TABLE chat_conversations RENAME CONSTRAINT idx_19132_primary TO chat_conversations_pkey;
    ALTER TABLE chat_conversation_participants RENAME CONSTRAINT idx_19138_primary TO chat_conversation_participants_pkey;
    ALTER TABLE chat_scheduled_messages RENAME CONSTRAINT scheduled_messages_pkey TO chat_scheduled_messages_pkey;
  `);

  // =====================================================
  // 1d. Rename Indexes (18x)
  // =====================================================

  // chat_messages (8 indexes)
  pgm.sql(`
    ALTER INDEX idx_19366_idx_conversation RENAME TO idx_chat_messages_conversation;
    ALTER INDEX idx_19366_idx_created RENAME TO idx_chat_messages_created;
    ALTER INDEX idx_19366_idx_messages_attachment_size RENAME TO idx_chat_messages_attachment_size;
    ALTER INDEX idx_19366_idx_sender RENAME TO idx_chat_messages_sender;
    ALTER INDEX idx_19366_tenant_id RENAME TO idx_chat_messages_tenant;
    ALTER INDEX idx_messages_uuid RENAME TO idx_chat_messages_uuid;
    ALTER INDEX idx_messages_uuid_created_at RENAME TO idx_chat_messages_uuid_created_at;
    ALTER INDEX idx_messages_e2e RENAME TO idx_chat_messages_e2e;
  `);

  // chat_conversations (2 indexes)
  pgm.sql(`
    ALTER INDEX idx_19132_idx_tenant RENAME TO idx_chat_conversations_tenant;
    ALTER INDEX idx_conversations_uuid RENAME TO idx_chat_conversations_uuid;
  `);

  // chat_conversation_participants (4 indexes)
  pgm.sql(`
    ALTER INDEX idx_19138_idx_tenant RENAME TO idx_chat_cp_tenant;
    ALTER INDEX idx_19138_idx_user RENAME TO idx_chat_cp_user;
    ALTER INDEX idx_19138_unique_participant RENAME TO idx_chat_cp_unique_participant;
    ALTER INDEX idx_cp_deleted_at RENAME TO idx_chat_cp_deleted_at;
  `);

  // chat_scheduled_messages (4 indexes)
  pgm.sql(`
    ALTER INDEX idx_scheduled_conversation RENAME TO idx_chat_sched_conversation;
    ALTER INDEX idx_scheduled_pending RENAME TO idx_chat_sched_pending;
    ALTER INDEX idx_scheduled_sender RENAME TO idx_chat_sched_sender;
    ALTER INDEX idx_scheduled_tenant RENAME TO idx_chat_sched_tenant;
  `);

  // =====================================================
  // 1e. Rename FK Constraints (10x on chat tables + 2x on documents)
  // =====================================================

  // chat_messages (3)
  pgm.sql(`
    ALTER TABLE chat_messages RENAME CONSTRAINT messages_ibfk_1 TO fk_chat_messages_tenant;
    ALTER TABLE chat_messages RENAME CONSTRAINT messages_ibfk_2 TO fk_chat_messages_conversation;
    ALTER TABLE chat_messages RENAME CONSTRAINT messages_ibfk_3 TO fk_chat_messages_sender;
  `);

  // chat_conversations (1)
  pgm.sql(`
    ALTER TABLE chat_conversations RENAME CONSTRAINT conversations_ibfk_1 TO fk_chat_conversations_tenant;
  `);

  // chat_conversation_participants (3)
  pgm.sql(`
    ALTER TABLE chat_conversation_participants RENAME CONSTRAINT conversation_participants_ibfk_1 TO fk_chat_cp_conversation;
    ALTER TABLE chat_conversation_participants RENAME CONSTRAINT conversation_participants_ibfk_2 TO fk_chat_cp_user;
    ALTER TABLE chat_conversation_participants RENAME CONSTRAINT fk_cp_tenant TO fk_chat_cp_tenant;
  `);

  // chat_scheduled_messages (3)
  pgm.sql(`
    ALTER TABLE chat_scheduled_messages RENAME CONSTRAINT scheduled_messages_tenant_id_fkey TO fk_chat_sched_tenant;
    ALTER TABLE chat_scheduled_messages RENAME CONSTRAINT scheduled_messages_conversation_id_fkey TO fk_chat_sched_conversation;
    ALTER TABLE chat_scheduled_messages RENAME CONSTRAINT scheduled_messages_sender_id_fkey TO fk_chat_sched_sender;
  `);

  // documents table (2x — FKs that reference chat tables)
  pgm.sql(`
    ALTER TABLE documents RENAME CONSTRAINT fk_documents_conversation TO fk_documents_chat_conversation;
    ALTER TABLE documents RENAME CONSTRAINT fk_documents_message TO fk_documents_chat_message;
  `);

  // =====================================================
  // 1f. Rename CHECK Constraint (1x)
  // =====================================================
  pgm.sql(`
    ALTER TABLE chat_scheduled_messages RENAME CONSTRAINT chk_content_not_empty TO chk_chat_sched_content_not_empty;
  `);

  // =====================================================
  // 1g. Drop & Recreate RLS Policies (8 policies)
  //
  // The participant_isolation policy on messages references
  // conversation_participants by name in its USING sub-query.
  // Recreating ensures the display and internal references
  // are clean after the table renames.
  // =====================================================

  // chat_messages: 2 policies
  pgm.sql(`
    DROP POLICY tenant_isolation ON chat_messages;
    DROP POLICY participant_isolation ON chat_messages;

    CREATE POLICY tenant_isolation ON chat_messages AS PERMISSIVE FOR ALL
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    CREATE POLICY participant_isolation ON chat_messages AS RESTRICTIVE FOR ALL
      USING (
        NULLIF(current_setting('app.user_id', true), '') IS NULL
        OR EXISTS (
          SELECT 1 FROM chat_conversation_participants cp
          WHERE cp.conversation_id = chat_messages.conversation_id
            AND cp.user_id = NULLIF(current_setting('app.user_id', true), '')::integer
            AND cp.tenant_id = chat_messages.tenant_id
        )
      );
  `);

  // chat_conversations: 4 policies
  pgm.sql(`
    DROP POLICY conversations_select ON chat_conversations;
    DROP POLICY conversations_insert ON chat_conversations;
    DROP POLICY conversations_update ON chat_conversations;
    DROP POLICY conversations_delete ON chat_conversations;

    CREATE POLICY chat_conversations_select ON chat_conversations AS PERMISSIVE FOR SELECT
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    CREATE POLICY chat_conversations_insert ON chat_conversations AS PERMISSIVE FOR INSERT
      WITH CHECK (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    CREATE POLICY chat_conversations_update ON chat_conversations AS PERMISSIVE FOR UPDATE
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      )
      WITH CHECK (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    CREATE POLICY chat_conversations_delete ON chat_conversations AS PERMISSIVE FOR DELETE
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );
  `);

  // chat_conversation_participants: 1 policy
  pgm.sql(`
    DROP POLICY tenant_isolation ON chat_conversation_participants;

    CREATE POLICY tenant_isolation ON chat_conversation_participants AS PERMISSIVE FOR ALL
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );
  `);

  // chat_scheduled_messages: 1 policy
  pgm.sql(`
    DROP POLICY tenant_isolation ON chat_scheduled_messages;

    CREATE POLICY tenant_isolation ON chat_scheduled_messages AS PERMISSIVE FOR ALL
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );
  `);

  // =====================================================
  // 1h. Rename Triggers (2x on conversations)
  // =====================================================
  pgm.sql(`
    ALTER TRIGGER on_update_current_timestamp ON chat_conversations
      RENAME TO trg_chat_conversations_timestamp;
    ALTER TRIGGER update_conversations_updated_at ON chat_conversations
      RENAME TO trg_chat_conversations_updated_at;
  `);
}

export function down(pgm: MigrationBuilder): void {
  // Reverse all operations in opposite order.
  // At each step, tables are still named chat_* until the final renames.

  // =====================================================
  // Rename Triggers back
  // =====================================================
  pgm.sql(`
    ALTER TRIGGER trg_chat_conversations_timestamp ON chat_conversations
      RENAME TO on_update_current_timestamp;
    ALTER TRIGGER trg_chat_conversations_updated_at ON chat_conversations
      RENAME TO update_conversations_updated_at;
  `);

  // =====================================================
  // Drop & Recreate RLS Policies (restore original names)
  // =====================================================

  // chat_scheduled_messages
  pgm.sql(`
    DROP POLICY tenant_isolation ON chat_scheduled_messages;

    CREATE POLICY tenant_isolation ON chat_scheduled_messages AS PERMISSIVE FOR ALL
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );
  `);

  // chat_conversation_participants
  pgm.sql(`
    DROP POLICY tenant_isolation ON chat_conversation_participants;

    CREATE POLICY tenant_isolation ON chat_conversation_participants AS PERMISSIVE FOR ALL
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );
  `);

  // chat_conversations → restore original policy names
  pgm.sql(`
    DROP POLICY chat_conversations_select ON chat_conversations;
    DROP POLICY chat_conversations_insert ON chat_conversations;
    DROP POLICY chat_conversations_update ON chat_conversations;
    DROP POLICY chat_conversations_delete ON chat_conversations;

    CREATE POLICY conversations_select ON chat_conversations AS PERMISSIVE FOR SELECT
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    CREATE POLICY conversations_insert ON chat_conversations AS PERMISSIVE FOR INSERT
      WITH CHECK (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    CREATE POLICY conversations_update ON chat_conversations AS PERMISSIVE FOR UPDATE
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      )
      WITH CHECK (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    CREATE POLICY conversations_delete ON chat_conversations AS PERMISSIVE FOR DELETE
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );
  `);

  // chat_messages → restore original policy names + references
  pgm.sql(`
    DROP POLICY tenant_isolation ON chat_messages;
    DROP POLICY participant_isolation ON chat_messages;

    CREATE POLICY tenant_isolation ON chat_messages AS PERMISSIVE FOR ALL
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    CREATE POLICY participant_isolation ON chat_messages AS RESTRICTIVE FOR ALL
      USING (
        NULLIF(current_setting('app.user_id', true), '') IS NULL
        OR EXISTS (
          SELECT 1 FROM chat_conversation_participants cp
          WHERE cp.conversation_id = chat_messages.conversation_id
            AND cp.user_id = NULLIF(current_setting('app.user_id', true), '')::integer
            AND cp.tenant_id = chat_messages.tenant_id
        )
      );
  `);

  // =====================================================
  // Rename CHECK Constraint back
  // =====================================================
  pgm.sql(`
    ALTER TABLE chat_scheduled_messages
      RENAME CONSTRAINT chk_chat_sched_content_not_empty TO chk_content_not_empty;
  `);

  // =====================================================
  // Rename FK Constraints back
  // =====================================================

  // documents table
  pgm.sql(`
    ALTER TABLE documents RENAME CONSTRAINT fk_documents_chat_message TO fk_documents_message;
    ALTER TABLE documents RENAME CONSTRAINT fk_documents_chat_conversation TO fk_documents_conversation;
  `);

  // chat_scheduled_messages
  pgm.sql(`
    ALTER TABLE chat_scheduled_messages RENAME CONSTRAINT fk_chat_sched_sender TO scheduled_messages_sender_id_fkey;
    ALTER TABLE chat_scheduled_messages RENAME CONSTRAINT fk_chat_sched_conversation TO scheduled_messages_conversation_id_fkey;
    ALTER TABLE chat_scheduled_messages RENAME CONSTRAINT fk_chat_sched_tenant TO scheduled_messages_tenant_id_fkey;
  `);

  // chat_conversation_participants
  pgm.sql(`
    ALTER TABLE chat_conversation_participants RENAME CONSTRAINT fk_chat_cp_tenant TO fk_cp_tenant;
    ALTER TABLE chat_conversation_participants RENAME CONSTRAINT fk_chat_cp_user TO conversation_participants_ibfk_2;
    ALTER TABLE chat_conversation_participants RENAME CONSTRAINT fk_chat_cp_conversation TO conversation_participants_ibfk_1;
  `);

  // chat_conversations
  pgm.sql(`
    ALTER TABLE chat_conversations RENAME CONSTRAINT fk_chat_conversations_tenant TO conversations_ibfk_1;
  `);

  // chat_messages
  pgm.sql(`
    ALTER TABLE chat_messages RENAME CONSTRAINT fk_chat_messages_sender TO messages_ibfk_3;
    ALTER TABLE chat_messages RENAME CONSTRAINT fk_chat_messages_conversation TO messages_ibfk_2;
    ALTER TABLE chat_messages RENAME CONSTRAINT fk_chat_messages_tenant TO messages_ibfk_1;
  `);

  // =====================================================
  // Rename Indexes back (18x)
  // =====================================================

  // chat_scheduled_messages (4)
  pgm.sql(`
    ALTER INDEX idx_chat_sched_tenant RENAME TO idx_scheduled_tenant;
    ALTER INDEX idx_chat_sched_sender RENAME TO idx_scheduled_sender;
    ALTER INDEX idx_chat_sched_pending RENAME TO idx_scheduled_pending;
    ALTER INDEX idx_chat_sched_conversation RENAME TO idx_scheduled_conversation;
  `);

  // chat_conversation_participants (4)
  pgm.sql(`
    ALTER INDEX idx_chat_cp_deleted_at RENAME TO idx_cp_deleted_at;
    ALTER INDEX idx_chat_cp_unique_participant RENAME TO idx_19138_unique_participant;
    ALTER INDEX idx_chat_cp_user RENAME TO idx_19138_idx_user;
    ALTER INDEX idx_chat_cp_tenant RENAME TO idx_19138_idx_tenant;
  `);

  // chat_conversations (2)
  pgm.sql(`
    ALTER INDEX idx_chat_conversations_uuid RENAME TO idx_conversations_uuid;
    ALTER INDEX idx_chat_conversations_tenant RENAME TO idx_19132_idx_tenant;
  `);

  // chat_messages (8)
  pgm.sql(`
    ALTER INDEX idx_chat_messages_e2e RENAME TO idx_messages_e2e;
    ALTER INDEX idx_chat_messages_uuid_created_at RENAME TO idx_messages_uuid_created_at;
    ALTER INDEX idx_chat_messages_uuid RENAME TO idx_messages_uuid;
    ALTER INDEX idx_chat_messages_tenant RENAME TO idx_19366_tenant_id;
    ALTER INDEX idx_chat_messages_sender RENAME TO idx_19366_idx_sender;
    ALTER INDEX idx_chat_messages_attachment_size RENAME TO idx_19366_idx_messages_attachment_size;
    ALTER INDEX idx_chat_messages_created RENAME TO idx_19366_idx_created;
    ALTER INDEX idx_chat_messages_conversation RENAME TO idx_19366_idx_conversation;
  `);

  // =====================================================
  // Rename Primary Keys back (4x)
  // =====================================================
  pgm.sql(`
    ALTER TABLE chat_scheduled_messages RENAME CONSTRAINT chat_scheduled_messages_pkey TO scheduled_messages_pkey;
    ALTER TABLE chat_conversation_participants RENAME CONSTRAINT chat_conversation_participants_pkey TO idx_19138_primary;
    ALTER TABLE chat_conversations RENAME CONSTRAINT chat_conversations_pkey TO idx_19132_primary;
    ALTER TABLE chat_messages RENAME CONSTRAINT chat_messages_pkey TO idx_19366_primary;
  `);

  // =====================================================
  // Rename Sequences back (3x)
  // =====================================================
  pgm.sql(`
    ALTER SEQUENCE chat_conversation_participants_id_seq RENAME TO conversation_participants_id_seq;
    ALTER SEQUENCE chat_conversations_id_seq RENAME TO conversations_id_seq;
    ALTER SEQUENCE chat_messages_id_seq RENAME TO messages_id_seq;
  `);

  // =====================================================
  // Rename Tables back (4x)
  // =====================================================
  pgm.sql(`
    ALTER TABLE chat_scheduled_messages RENAME TO scheduled_messages;
    ALTER TABLE chat_conversation_participants RENAME TO conversation_participants;
    ALTER TABLE chat_conversations RENAME TO conversations;
    ALTER TABLE chat_messages RENAME TO messages;
  `);
}
