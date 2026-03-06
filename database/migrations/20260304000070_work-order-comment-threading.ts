/**
 * Migration: Work Order Comment Threading (parent_id)
 * Date: 2026-03-04
 *
 * Adds self-referencing parent_id column to work_order_comments
 * to enable YouTube-style threaded replies. Existing comments become top-level
 * (parent_id = NULL). Replies cascade-delete when parent is deleted.
 *
 * No new RLS policy needed — existing tenant_isolation policy covers the table.
 * No new GRANTs needed — existing GRANTs on work_order_comments cover all DML.
 *
 * Pattern identical to migration 039 (blackboard + kvp comment threading).
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE work_order_comments
      ADD COLUMN parent_id INTEGER NULL;

    ALTER TABLE work_order_comments
      ADD CONSTRAINT fk_wo_comment_parent
      FOREIGN KEY (parent_id) REFERENCES work_order_comments(id) ON DELETE CASCADE;

    CREATE INDEX idx_wo_comments_parent_id
      ON work_order_comments(parent_id);

    COMMENT ON COLUMN work_order_comments.parent_id
      IS 'Self-ref FK for threading. NULL = top-level comment, non-NULL = reply.';
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_wo_comments_parent_id;
    ALTER TABLE work_order_comments DROP CONSTRAINT IF EXISTS fk_wo_comment_parent;
    ALTER TABLE work_order_comments DROP COLUMN IF EXISTS parent_id;
  `);
}
