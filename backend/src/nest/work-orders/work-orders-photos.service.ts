/**
 * Work Orders Photos Service
 *
 * Handles photo evidence for work orders: upload (max 10 per order),
 * list, and hard-delete with file cleanup.
 * Path: uploads/work-orders/{tenantId}/{workOrderUuid}/{fileUuid}.ext
 */
import type { UserRole } from '@assixx/shared';
import { IS_ACTIVE } from '@assixx/shared/constants';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { v7 as uuidv7 } from 'uuid';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import {
  type SourcePhotoRow,
  mapPhotoRowToApi,
  mapSourcePhotoRowToApi,
} from './work-orders.helpers.js';
import type {
  SourcePhoto,
  WorkOrderPhoto,
  WorkOrderPhotoWithNameRow,
} from './work-orders.types.js';
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_PHOTOS_PER_WORK_ORDER,
  WORK_ORDER_UPLOAD_DIR,
} from './work-orders.types.js';

@Injectable()
export class WorkOrderPhotosService {
  constructor(
    private readonly db: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  /** Upload a photo to a work order (max 10 per order) */
  async addPhoto(
    tenantId: number,
    userId: number,
    workOrderUuid: string,
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
  ): Promise<WorkOrderPhoto> {
    const wo = await this.resolveWorkOrder(tenantId, workOrderUuid);

    if (wo.status === 'completed' || wo.status === 'verified') {
      throw new BadRequestException(
        'Fotos können bei abgeschlossenen Aufträgen nicht hochgeladen werden',
      );
    }

    if (!ALLOWED_UPLOAD_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Dateityp '${file.mimetype}' nicht erlaubt. Erlaubt: JPG, PNG, WebP, PDF`,
      );
    }

    await this.enforcePhotoLimit(wo.id);

    const filePath = await this.writeToDisk(tenantId, workOrderUuid, file);

    const row = await this.db.tenantQueryOne<WorkOrderPhotoWithNameRow>(
      `WITH inserted AS (
         INSERT INTO work_order_photos
           (uuid, tenant_id, work_order_id, uploaded_by, file_path, file_name, file_size, mime_type, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
           (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM work_order_photos WHERE work_order_id = $3))
         RETURNING *
       )
       SELECT i.*, u.first_name, u.last_name
       FROM inserted i
       JOIN users u ON i.uploaded_by = u.id`,
      [uuidv7(), tenantId, wo.id, userId, filePath, file.originalname, file.size, file.mimetype],
    );

    if (row === null) {
      throw new BadRequestException('Foto konnte nicht gespeichert werden');
    }

    const label = file.mimetype === 'application/pdf' ? 'Datei' : 'Foto';
    void this.activityLogger.logCreate(
      tenantId,
      userId,
      'work_order_photo',
      wo.id,
      `${label} zu "${wo.title}" hochgeladen`,
      { fileName: file.originalname },
    );

    return mapPhotoRowToApi(row);
  }

  /** List all photos for a work order */
  async getPhotos(tenantId: number, workOrderUuid: string): Promise<WorkOrderPhoto[]> {
    const rows = await this.db.tenantQuery<WorkOrderPhotoWithNameRow>(
      `SELECT p.*, u.first_name, u.last_name
       FROM work_order_photos p
       JOIN work_orders wo ON p.work_order_id = wo.id
       JOIN users u ON p.uploaded_by = u.id
       WHERE wo.uuid = $1 AND wo.tenant_id = $2 AND wo.is_active = ${IS_ACTIVE.ACTIVE}
       ORDER BY p.sort_order ASC`,
      [workOrderUuid, tenantId],
    );
    return rows.map(mapPhotoRowToApi);
  }

  /** Hard-delete a photo + remove file from disk (admin=any, employee=own) */
  async deletePhoto(
    tenantId: number,
    userId: number,
    userRole: UserRole,
    photoUuid: string,
  ): Promise<void> {
    const photo = await this.db.tenantQueryOne<{
      id: number;
      file_path: string;
      work_order_id: number;
      uploaded_by: number;
      wo_status: string;
    }>(
      `SELECT p.id, p.file_path, p.work_order_id, p.uploaded_by, wo.status AS wo_status
       FROM work_order_photos p
       JOIN work_orders wo ON p.work_order_id = wo.id
       WHERE p.uuid = $1 AND wo.tenant_id = $2 AND wo.is_active = ${IS_ACTIVE.ACTIVE}`,
      [photoUuid, tenantId],
    );

    if (photo === null) {
      throw new NotFoundException('Foto nicht gefunden');
    }

    if (photo.wo_status === 'completed' || photo.wo_status === 'verified') {
      throw new BadRequestException(
        'Fotos können bei abgeschlossenen Aufträgen nicht gelöscht werden',
      );
    }

    const isOwner = photo.uploaded_by === userId;
    const isPrivileged = userRole === 'root' || userRole === 'admin';
    if (!isOwner && !isPrivileged) {
      throw new ForbiddenException('Nur eigene Fotos können gelöscht werden');
    }

    await this.db.tenantQuery(`DELETE FROM work_order_photos WHERE id = $1 AND tenant_id = $2`, [
      photo.id,
      tenantId,
    ]);

    void this.deleteFileFromDisk(photo.file_path);

    void this.activityLogger.logDelete(
      tenantId,
      userId,
      'work_order_photo',
      photo.work_order_id,
      `Foto gelöscht`,
      { photoUuid },
    );
  }

  /** Resolve a photo file for streaming (auth-checked via controller guard) */
  async getPhotoFile(
    tenantId: number,
    workOrderUuid: string,
    photoUuid: string,
  ): Promise<{ filePath: string; fileName: string; mimeType: string }> {
    const row = await this.db.tenantQueryOne<{
      file_path: string;
      file_name: string;
      mime_type: string;
    }>(
      `SELECT p.file_path, p.file_name, p.mime_type
       FROM work_order_photos p
       JOIN work_orders wo ON p.work_order_id = wo.id
       WHERE p.uuid = $1 AND wo.uuid = $2
         AND wo.tenant_id = $3 AND wo.is_active = ${IS_ACTIVE.ACTIVE}`,
      [photoUuid, workOrderUuid, tenantId],
    );

    if (row === null) {
      throw new NotFoundException('Foto nicht gefunden');
    }

    return {
      filePath: row.file_path,
      fileName: row.file_name,
      mimeType: row.mime_type,
    };
  }

  /** Get photos/attachments from the source entity (TPM defect or KVP suggestion) — read-only */
  async getSourcePhotos(tenantId: number, workOrderUuid: string): Promise<SourcePhoto[]> {
    const wo = await this.db.tenantQueryOne<{
      source_type: string;
      source_uuid: string | null;
    }>(
      `SELECT source_type, source_uuid FROM work_orders
       WHERE uuid = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [workOrderUuid, tenantId],
    );

    if (wo?.source_uuid === null || wo?.source_uuid === undefined) return [];

    if (wo.source_type === 'tpm_defect') {
      const rows = await this.db.tenantQuery<SourcePhotoRow>(
        `SELECT dp.uuid, dp.file_path, dp.file_name,
                dp.file_size, dp.mime_type, dp.created_at
         FROM tpm_defect_photos dp
         JOIN tpm_execution_defects d ON dp.defect_id = d.id
         WHERE d.uuid = $1 AND d.tenant_id = $2
         ORDER BY dp.sort_order ASC`,
        [wo.source_uuid.trim(), tenantId],
      );
      return rows.map(mapSourcePhotoRowToApi);
    }

    if (wo.source_type === 'kvp_proposal') {
      const rows = await this.db.tenantQuery<SourcePhotoRow>(
        `SELECT ka.file_uuid AS uuid, ka.file_path, ka.file_name,
                ka.file_size, ka.file_type AS mime_type, ka.uploaded_at AS created_at
         FROM kvp_attachments ka
         JOIN kvp_suggestions ks ON ka.suggestion_id = ks.id
         WHERE ks.uuid = $1 AND ks.tenant_id = $2
         ORDER BY ka.uploaded_at ASC`,
        [wo.source_uuid.trim(), tenantId],
      );
      return rows.map(mapSourcePhotoRowToApi);
    }

    return [];
  }

  // ==========================================================================
  // Private helpers
  // ==========================================================================

  private async resolveWorkOrder(
    tenantId: number,
    uuid: string,
  ): Promise<{ id: number; title: string; status: string }> {
    const row = await this.db.tenantQueryOne<{
      id: number;
      title: string;
      status: string;
    }>(
      `SELECT id, title, status FROM work_orders
       WHERE uuid = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [uuid, tenantId],
    );
    if (row === null) {
      throw new NotFoundException('Arbeitsauftrag nicht gefunden');
    }
    return row;
  }

  private async enforcePhotoLimit(workOrderId: number): Promise<void> {
    const result = await this.db.tenantQueryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM work_order_photos
       WHERE work_order_id = $1`,
      [workOrderId],
    );
    const count = Number.parseInt(result?.count ?? '0', 10);
    if (count >= MAX_PHOTOS_PER_WORK_ORDER) {
      throw new BadRequestException(
        `Maximal ${MAX_PHOTOS_PER_WORK_ORDER} Fotos pro Arbeitsauftrag`,
      );
    }
  }

  private async writeToDisk(
    tenantId: number,
    workOrderUuid: string,
    file: { buffer: Buffer; originalname: string },
  ): Promise<string> {
    const ext = path.extname(file.originalname);
    const fileName = `${uuidv7()}${ext}`;
    const dir = path.join(WORK_ORDER_UPLOAD_DIR, String(tenantId), workOrderUuid);
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, fileName);
    await fs.writeFile(filePath, file.buffer);
    return filePath;
  }

  private async deleteFileFromDisk(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch {
      // File may already be gone — log but don't fail
    }
  }
}
