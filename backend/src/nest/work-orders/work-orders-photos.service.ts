/**
 * Work Orders Photos Service
 *
 * Handles photo evidence for work orders: upload (max 10 per order),
 * list, and hard-delete with file cleanup.
 * Path: uploads/work-orders/{tenantId}/{workOrderUuid}/{fileUuid}.ext
 */
import type { UserRole } from '@assixx/shared';
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

    await this.enforcePhotoLimit(wo.id);

    const filePath = await this.writeToDisk(tenantId, workOrderUuid, file);

    const row = await this.db.queryOne<WorkOrderPhotoWithNameRow>(
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
      [
        uuidv7(),
        tenantId,
        wo.id,
        userId,
        filePath,
        file.originalname,
        file.size,
        file.mimetype,
      ],
    );

    if (row === null) {
      throw new BadRequestException('Foto konnte nicht gespeichert werden');
    }

    void this.activityLogger.logCreate(
      tenantId,
      userId,
      'work_order_photo',
      wo.id,
      `Foto zu "${wo.title}" hochgeladen`,
      { fileName: file.originalname },
    );

    return mapPhotoRowToApi(row);
  }

  /** List all photos for a work order */
  async getPhotos(
    tenantId: number,
    workOrderUuid: string,
  ): Promise<WorkOrderPhoto[]> {
    const rows = await this.db.query<WorkOrderPhotoWithNameRow>(
      `SELECT p.*, u.first_name, u.last_name
       FROM work_order_photos p
       JOIN work_orders wo ON p.work_order_id = wo.id
       JOIN users u ON p.uploaded_by = u.id
       WHERE wo.uuid = $1 AND wo.tenant_id = $2 AND wo.is_active = 1
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
    const photo = await this.db.queryOne<{
      id: number;
      file_path: string;
      work_order_id: number;
      uploaded_by: number;
      wo_status: string;
    }>(
      `SELECT p.id, p.file_path, p.work_order_id, p.uploaded_by, wo.status AS wo_status
       FROM work_order_photos p
       JOIN work_orders wo ON p.work_order_id = wo.id
       WHERE p.uuid = $1 AND wo.tenant_id = $2 AND wo.is_active = 1`,
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

    await this.db.query(`DELETE FROM work_order_photos WHERE id = $1`, [
      photo.id,
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
    const row = await this.db.queryOne<{
      file_path: string;
      file_name: string;
      mime_type: string;
    }>(
      `SELECT p.file_path, p.file_name, p.mime_type
       FROM work_order_photos p
       JOIN work_orders wo ON p.work_order_id = wo.id
       WHERE p.uuid = $1 AND wo.uuid = $2
         AND wo.tenant_id = $3 AND wo.is_active = 1`,
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

  /** Get photos from the source entity (e.g. TPM defect) — read-only */
  async getSourcePhotos(
    tenantId: number,
    workOrderUuid: string,
  ): Promise<SourcePhoto[]> {
    const rows = await this.db.query<SourcePhotoRow>(
      `SELECT dp.uuid, dp.file_path, dp.file_name,
              dp.file_size, dp.mime_type, dp.created_at
       FROM tpm_defect_photos dp
       JOIN tpm_execution_defects d ON dp.defect_id = d.id
       JOIN work_orders wo ON wo.source_uuid = d.uuid
       WHERE wo.uuid = $1 AND wo.tenant_id = $2
         AND wo.is_active = 1 AND wo.source_type = 'tpm_defect'
       ORDER BY dp.sort_order ASC`,
      [workOrderUuid, tenantId],
    );
    return rows.map(mapSourcePhotoRowToApi);
  }

  // ==========================================================================
  // Private helpers
  // ==========================================================================

  private async resolveWorkOrder(
    tenantId: number,
    uuid: string,
  ): Promise<{ id: number; title: string; status: string }> {
    const row = await this.db.queryOne<{
      id: number;
      title: string;
      status: string;
    }>(
      `SELECT id, title, status FROM work_orders
       WHERE uuid = $1 AND tenant_id = $2 AND is_active = 1`,
      [uuid, tenantId],
    );
    if (row === null) {
      throw new NotFoundException('Arbeitsauftrag nicht gefunden');
    }
    return row;
  }

  private async enforcePhotoLimit(workOrderId: number): Promise<void> {
    const result = await this.db.queryOne<{ count: string }>(
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
    const dir = path.join(
      WORK_ORDER_UPLOAD_DIR,
      String(tenantId),
      workOrderUuid,
    );
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
