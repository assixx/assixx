/**
 * Migration: Create shift_handover_attachments
 *
 * Purpose: File-attachment records for shift-handover entries — photo / image
 * documentation (e.g. damage reports, machine-state snapshots). Each row maps
 * one uploaded file to one entry via entry_id FK. Max 5 attachments per entry
 * is enforced **app-layer** in Phase 2.4 ShiftHandoverAttachmentsService — NOT
 * a DB CHECK, because the limit is soft configuration (future-tenant-adjustable).
 *
 * Shape mirrors inventory_item_photos but deliberately richer: it adds
 * mime_type + file_size_bytes + file_name for audit, validation, and future
 * quota/reporting use. §Session 1 Plan Correction #4 documents this intentional
 * V1 improvement over the Inventory reference schema.
 *
 * Related:
 *   - Plan: docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §Step 1.3 (Session 2, 2026-04-22)
 *   - §0.7 decision ADAPT: inventory pattern copied, not reused — see
 *     plan Known Limitation #14 for the V2 `AttachmentsModule` extraction cost.
 *   - ADR-019: strict-mode RLS (NULLIF-based, no bypass clause)
 *   - ADR-042: canonical 3-layer multipart pipeline (@fastify/multipart +
 *     fastify-multer + @webundsoehne/nest-fastify-file-upload); this table is
 *     consumed by ShiftHandoverAttachmentsService in Phase 2.4.
 *   - ADR-045: permission — attachments-delete is gated by
 *     `shift-handover-entries.canDelete` per plan §Step 2.7 (no separate
 *     `shift-handover-attachments` permission module in V1).
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    CREATE TABLE shift_handover_attachments (
      id UUID PRIMARY KEY DEFAULT uuidv7(),
      -- FK to tenants: CASCADE so tenant deletion wipes attachments.
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      -- FK to the parent entry. CASCADE is essential — an attachment without
      -- its entry has no meaning. Entry soft-delete (is_active != 1) does NOT
      -- cascade here; hard DB-delete (rare, cleanup-only) does.
      entry_id UUID NOT NULL REFERENCES shift_handover_entries(id) ON DELETE CASCADE,
      -- Disk path produced by writeShiftHandoverAttachmentToDisk() in Phase 2.4:
      -- uploads/shift-handover/{tenantId}/{entryId}/{uuidv7()}{ext}
      file_path TEXT NOT NULL,
      -- Original client filename (e.g. "IMG_2026_04_22.jpg"). Stored for UX
      -- (download-as-original-name) and audit.
      file_name TEXT NOT NULL,
      -- Backend-enforced MIME (image/jpeg, image/png, image/webp, image/heic per
      -- plan §Step 2.4). Stored so we can validate download responses without
      -- re-sniffing, and support future quota / reporting by type.
      mime_type TEXT NOT NULL,
      -- Bytes. INTEGER is enough (PostgreSQL INTEGER = 32-bit signed,
      -- max ~2 GB — our per-file cap is 5 MB, per §Step 2.4).
      file_size_bytes INTEGER NOT NULL,
      -- Display order within an entry's gallery. Manual reordering is a V2
      -- feature (no REORDER endpoint in V1); default 0 keeps inserts simple.
      sort_order SMALLINT NOT NULL DEFAULT 0,
      -- Optional user-provided caption. NULLable (most uploads are un-captioned).
      -- 255-char cap mirrors inventory_item_photos.caption convention.
      caption VARCHAR(255),
      -- Soft-delete lifecycle (Assixx convention: 0=inactive,1=active,3=archived,4=deleted).
      -- Deletion of an attachment row = soft-delete in Phase 2.4 service;
      -- the on-disk file is left in place (cron-swept by deletion-worker later
      -- when entry is hard-deleted).
      is_active SMALLINT NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      -- Every upload has an authenticated user. NOT NULL mirrors entries.created_by.
      created_by INTEGER NOT NULL REFERENCES users(id)
      -- Note: no updated_at / updated_by. Attachments are immutable by design —
      -- service methods are createAttachment / deleteAttachment / streamAttachment.
      -- No mutation endpoint in V1 (caption edits were considered V2; see plan).
    );

    -- RLS: strict-mode per ADR-019 — NO "IS NULL OR" bypass clause.
    ALTER TABLE shift_handover_attachments ENABLE ROW LEVEL SECURITY;
    ALTER TABLE shift_handover_attachments FORCE ROW LEVEL SECURITY;
    CREATE POLICY tenant_isolation ON shift_handover_attachments
      FOR ALL
      USING (
        tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    -- Triple-User-Model GRANTs (ADR-019). UUID PK — no sequence GRANTs needed.
    GRANT SELECT, INSERT, UPDATE, DELETE ON shift_handover_attachments TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON shift_handover_attachments TO sys_user;

    -- Hot-path index: "show me all attachments for this entry, in sort order".
    -- Partial on active rows — soft-deleted attachments rarely queried.
    CREATE INDEX idx_sha_entry
      ON shift_handover_attachments(entry_id)
      WHERE is_active = 1;
  `);
}

export function down(pgm: MigrationBuilder): void {
  // Rollback: plain DROP TABLE. CASCADE is defensive; no FK currently points
  // INTO shift_handover_attachments in V1. run-migrations.sh enforces reverse
  // LIFO order, so Step 1.3's down() runs before 1.2's (entries) — good,
  // because attachments must vanish first for the attachments→entries FK to
  // be droppable cleanly. IF EXISTS is allowed in down() per
  // DATABASE-MIGRATION-GUIDE §Required Patterns.
  pgm.sql(`DROP TABLE IF EXISTS shift_handover_attachments CASCADE;`);
}
