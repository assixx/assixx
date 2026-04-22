/**
 * Shift Handover — Attachments Service (Plan §2.4).
 *
 * Persists image attachments for `shift_handover_entries`. §0.7 spike
 * decision (2026-04-22): ADAPT — dedicated table + service pattern copied
 * from Inventory's photo module. Disk layout mirrors Inventory's
 * `uploads/inventory/{tenantId}/{itemUuid}/…` convention:
 *
 *   uploads/shift-handover/{tenantId}/{entryId}/{uuidv7()}{ext}
 *
 * Multipart pipeline (ADR-042):
 *  - `@fastify/multipart` registered once at `main.ts:175` — no module-local
 *    registration required.
 *  - Controller uses `FileInterceptor` + `memoryStorage()` (see §2.6).
 *    This service receives the already-parsed `MulterFile` and handles
 *    buffer→disk persistence inline. This is Pattern B (service owns
 *    validation + disk-write + DB insert) rather than Pattern A
 *    (Inventory's split where the controller does the disk-write): §2.4
 *    lists the service signature as `uploadForEntry(entryId, file)` with
 *    MIME/size enforcement, so the service owns the whole lifecycle. The
 *    controller stays a thin guard + DI shim.
 *
 * Defense-in-depth layering:
 *  - Controller's FileInterceptor enforces `fileSize` limit → 400 before
 *    the service even runs.
 *  - Service re-validates size + MIME + 5-cap inside a single
 *    `tenantTransaction` so no partial writes escape on constraint
 *    violations (DB rolls back; any orphan file on disk is a known
 *    trade-off — plan §Known Limitations #14 notes V2 refactor to a
 *    shared `AttachmentsModule` + cleanup cron).
 *
 * Tenant isolation: all queries inside `tenantTransaction` / `tenantQuery`
 * (app_user pool, ADR-019 strict-mode). `tenant_id` inserted from the
 * RLS-loaded entry row, never from client input.
 *
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §2.4 + §0.7 + §R11
 * @see docs/infrastructure/adr/ADR-042-multipart-file-upload-pipeline.md
 * @see docs/infrastructure/adr/ADR-019-multi-tenant-rls-isolation.md
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { PoolClient } from 'pg';
import { v7 as uuidv7 } from 'uuid';

import type { MulterFile } from '../common/interfaces/multer.interface.js';
import { DatabaseService } from '../database/database.service.js';
import {
  SHIFT_HANDOVER_ALLOWED_MIME_TYPES,
  SHIFT_HANDOVER_MAX_ATTACHMENTS_PER_ENTRY,
  SHIFT_HANDOVER_MAX_ATTACHMENT_SIZE,
  type ShiftHandoverAllowedMimeType,
  type ShiftHandoverAttachmentRow,
} from './shift-handover.types.js';

/** Upload root (relative to container cwd `/app`, mirrors Inventory). */
const UPLOAD_ROOT_SEGMENTS = ['uploads', 'shift-handover'] as const;

/** Canonical file extension per allowed MIME type. `originalname` is
 *  untrusted user input; deriving the extension from MIME prevents path
 *  ambiguity and keeps filenames deterministic. */
const EXT_BY_MIME: Record<ShiftHandoverAllowedMimeType, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
};

/** Entry statuses that still permit attachment mutations. `submitted`
 *  entries are locked (plan §2.5 contract: `submitEntry` snapshots + seals). */
const MUTABLE_ENTRY_STATUSES: readonly string[] = ['draft', 'reopened'];

interface EntryContextRow {
  tenant_id: number;
  team_id: number;
  status: string;
}

interface AttachmentContextRow {
  created_by: number;
  entry_status: string;
  file_path: string;
}

@Injectable()
export class ShiftHandoverAttachmentsService {
  private readonly logger = new Logger(ShiftHandoverAttachmentsService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Uploads a single image attachment to a draft/reopened entry.
   * Order of operations (critical for correctness):
   *  1. Validate `file` (MIME + size) — fast, pre-DB.
   *  2. Open tenant transaction.
   *  3. Load entry → verifies existence, RLS tenant-filter, mutable status.
   *  4. Count existing attachments → enforces the 5-cap.
   *  5. Write buffer to disk (after all pre-checks pass).
   *  6. INSERT row inside the same transaction.
   *
   * Step 5 outside the DB transaction is intentional: if INSERT fails we
   * orphan one file on disk (acceptable, trackable via cleanup cron); if
   * we wrote AFTER commit, a crash between commit + fs.writeFile would
   * leave the DB pointing at a non-existent file (worse UX). Inventory
   * uses the same order.
   */
  async uploadForEntry(
    entryId: string,
    file: MulterFile,
    userId: number,
  ): Promise<ShiftHandoverAttachmentRow> {
    this.logger.debug(
      `uploadForEntry entry=${entryId} mime=${file.mimetype} size=${file.size} user=${userId}`,
    );
    this.validateFile(file);
    return await this.db.tenantTransaction(async (client: PoolClient) => {
      const entry = await this.loadMutableEntry(client, entryId);
      await this.assertUnderCap(client, entryId);
      const filePath = await this.writeToDisk(entry.tenant_id, entryId, file);
      const inserted = await client.query<ShiftHandoverAttachmentRow>(
        `INSERT INTO shift_handover_attachments
           (tenant_id, entry_id, file_path, file_name, mime_type, file_size_bytes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [entry.tenant_id, entryId, filePath, file.originalname, file.mimetype, file.size, userId],
      );
      const row = inserted.rows[0];
      if (row === undefined) {
        throw new Error('Attachment insert returned no row');
      }
      return row;
    });
  }

  /**
   * Soft-deletes an attachment. Allowed when:
   *  - entry is in a mutable status (`draft` / `reopened`), AND
   *  - caller either is the attachment creator OR `canManage` (team-lead
   *    bypass — controller populates the flag from `orgScope.isAnyLead`).
   *
   * File on disk is left in place (same rationale as upload — cleanup
   * cron is V2 scope, plan §Known Limitations #14).
   */
  async deleteAttachment(
    entryId: string,
    attachmentId: string,
    ctx: { userId: number; canManage: boolean },
  ): Promise<void> {
    this.logger.debug(
      `deleteAttachment entry=${entryId} attachment=${attachmentId} user=${ctx.userId} canManage=${ctx.canManage}`,
    );
    await this.db.tenantTransaction(async (client: PoolClient) => {
      const row = await this.loadAttachmentContext(client, entryId, attachmentId);
      if (!MUTABLE_ENTRY_STATUSES.includes(row.entry_status)) {
        throw new BadRequestException('Entry is locked — cannot delete attachments');
      }
      if (!ctx.canManage && row.created_by !== ctx.userId) {
        throw new ForbiddenException('Only the creator or a team-lead may delete this attachment');
      }
      await client.query(`UPDATE shift_handover_attachments SET is_active = $1 WHERE id = $2`, [
        IS_ACTIVE.INACTIVE,
        attachmentId,
      ]);
    });
  }

  /**
   * Returns the disk path + metadata for streaming. Tenant isolation is
   * enforced by RLS (queryAsTenant via CLS inside `tenantQuery`); the
   * same-team scope filter lives at the controller (ADR-045 Layer 1 +
   * `team_id` cross-check against requesting user) since it depends on
   * `orgScope` that isn't in service scope.
   */
  async streamAttachment(
    attachmentId: string,
  ): Promise<{ filePath: string; mimeType: string; fileName: string }> {
    this.logger.debug(`streamAttachment attachment=${attachmentId}`);
    const rows = await this.db.tenantQuery<{
      file_path: string;
      mime_type: string;
      file_name: string;
    }>(
      `SELECT file_path, mime_type, file_name
         FROM shift_handover_attachments
        WHERE id = $1 AND is_active = $2`,
      [attachmentId, IS_ACTIVE.ACTIVE],
    );
    const row = rows[0];
    if (row === undefined) {
      throw new NotFoundException(`Attachment ${attachmentId} not found`);
    }
    return { filePath: row.file_path, mimeType: row.mime_type, fileName: row.file_name };
  }

  // ────────────────────────────────────────────────────────────────────
  // Private helpers
  // ────────────────────────────────────────────────────────────────────

  /**
   * Fast pre-DB validation. Rejects empty buffers, oversize files, and
   * MIME types outside the whitelist. Re-runs after controller's
   * `FileInterceptor` — intentional duplication (Power-of-Ten Rule 5).
   */
  private validateFile(file: MulterFile): void {
    if (file.size <= 0) {
      throw new BadRequestException('Empty file is not allowed');
    }
    if (file.size > SHIFT_HANDOVER_MAX_ATTACHMENT_SIZE) {
      throw new BadRequestException(
        `File exceeds ${SHIFT_HANDOVER_MAX_ATTACHMENT_SIZE} byte limit`,
      );
    }
    if (!this.isAllowedMime(file.mimetype)) {
      throw new BadRequestException(
        `MIME type "${file.mimetype}" not allowed; use jpeg/png/webp/heic`,
      );
    }
  }

  /** Type guard over the frozen whitelist. */
  private isAllowedMime(mime: string): mime is ShiftHandoverAllowedMimeType {
    return (SHIFT_HANDOVER_ALLOWED_MIME_TYPES as readonly string[]).includes(mime);
  }

  private async loadMutableEntry(client: PoolClient, entryId: string): Promise<EntryContextRow> {
    const rows = await client.query<EntryContextRow>(
      `SELECT tenant_id, team_id, status::text AS status
         FROM shift_handover_entries
        WHERE id = $1 AND is_active = $2`,
      [entryId, IS_ACTIVE.ACTIVE],
    );
    const entry = rows.rows[0];
    if (entry === undefined) {
      throw new NotFoundException(`Entry ${entryId} not found`);
    }
    if (!MUTABLE_ENTRY_STATUSES.includes(entry.status)) {
      throw new BadRequestException(`Entry is locked (status=${entry.status})`);
    }
    return entry;
  }

  private async assertUnderCap(client: PoolClient, entryId: string): Promise<void> {
    const res = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM shift_handover_attachments
        WHERE entry_id = $1 AND is_active = $2`,
      [entryId, IS_ACTIVE.ACTIVE],
    );
    const count = Number(res.rows[0]?.count ?? 0);
    if (count >= SHIFT_HANDOVER_MAX_ATTACHMENTS_PER_ENTRY) {
      throw new BadRequestException(
        `Maximum ${SHIFT_HANDOVER_MAX_ATTACHMENTS_PER_ENTRY} attachments per entry`,
      );
    }
  }

  private async loadAttachmentContext(
    client: PoolClient,
    entryId: string,
    attachmentId: string,
  ): Promise<AttachmentContextRow> {
    const rows = await client.query<AttachmentContextRow>(
      `SELECT a.created_by,
              a.file_path,
              e.status::text AS entry_status
         FROM shift_handover_attachments a
         JOIN shift_handover_entries e ON e.id = a.entry_id
        WHERE a.id = $1
          AND a.entry_id = $2
          AND a.is_active = $3
          AND e.is_active = $3`,
      [attachmentId, entryId, IS_ACTIVE.ACTIVE],
    );
    const row = rows.rows[0];
    if (row === undefined) {
      throw new NotFoundException(`Attachment ${attachmentId} not found on entry ${entryId}`);
    }
    return row;
  }

  /**
   * Writes the buffer to
   * `uploads/shift-handover/{tenantId}/{entryId}/{uuidv7()}{ext}` and
   * returns the absolute path for DB persistence. `fs.mkdir(recursive)`
   * creates intermediate directories idempotently.
   */
  private async writeToDisk(tenantId: number, entryId: string, file: MulterFile): Promise<string> {
    const mime = file.mimetype as ShiftHandoverAllowedMimeType;
    const ext = EXT_BY_MIME[mime];
    const dir = path.resolve(...UPLOAD_ROOT_SEGMENTS, String(tenantId), entryId);
    const filePath = path.join(dir, `${uuidv7()}${ext}`);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, file.buffer);
    return filePath;
  }
}
