/**
 * Migration: Comment Threading (parent_id)
 * Date: 2026-02-17
 *
 * Adds self-referencing parent_id column to blackboard_comments and kvp_comments
 * to enable YouTube-style threaded replies. Existing comments become top-level
 * (parent_id = NULL). Replies cascade-delete when parent is deleted.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- ─── Blackboard Comments ────────────────────────────────────
    ALTER TABLE blackboard_comments
      ADD COLUMN IF NOT EXISTS parent_id INTEGER NULL;

    ALTER TABLE blackboard_comments
      ADD CONSTRAINT fk_bb_comment_parent
      FOREIGN KEY (parent_id) REFERENCES blackboard_comments(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_bb_comments_parent_id
      ON blackboard_comments(parent_id);

    COMMENT ON COLUMN blackboard_comments.parent_id
      IS 'Self-ref FK for threading. NULL = top-level comment, non-NULL = reply.';

    -- ─── KVP Comments ───────────────────────────────────────────
    ALTER TABLE kvp_comments
      ADD COLUMN IF NOT EXISTS parent_id INTEGER NULL;

    ALTER TABLE kvp_comments
      ADD CONSTRAINT fk_kvp_comment_parent
      FOREIGN KEY (parent_id) REFERENCES kvp_comments(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_kvp_comments_parent_id
      ON kvp_comments(parent_id);

    COMMENT ON COLUMN kvp_comments.parent_id
      IS 'Self-ref FK for threading. NULL = top-level comment, non-NULL = reply.';
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- ─── KVP Comments ───────────────────────────────────────────
    DROP INDEX IF EXISTS idx_kvp_comments_parent_id;
    ALTER TABLE kvp_comments DROP CONSTRAINT IF EXISTS fk_kvp_comment_parent;
    ALTER TABLE kvp_comments DROP COLUMN IF EXISTS parent_id;

    -- ─── Blackboard Comments ────────────────────────────────────
    DROP INDEX IF EXISTS idx_bb_comments_parent_id;
    ALTER TABLE blackboard_comments DROP CONSTRAINT IF EXISTS fk_bb_comment_parent;
    ALTER TABLE blackboard_comments DROP COLUMN IF EXISTS parent_id;
  `);
}
