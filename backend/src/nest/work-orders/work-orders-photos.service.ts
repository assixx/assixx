/**
 * Work Orders Photos Service
 *
 * Handles photo evidence for work orders: upload (max 10 per order),
 * list, and hard-delete with file cleanup.
 * Path: uploads/work-orders/{tenantId}/{workOrderUuid}/{fileUuid}.ext
 */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { v7 as uuidv7 } from 'uuid';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import { mapPhotoRowToApi } from './work-orders.helpers.js';
import type { WorkOrderPhoto, WorkOrderPhotoRow } from './work-orders.types.js';
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
    await this.enforcePhotoLimit(wo.id);

    const filePath = await this.writeToDisk(tenantId, workOrderUuid, file);

    const row = await this.db.queryOne<WorkOrderPhotoRow>(
      `INSERT INTO work_order_photos
         (uuid, tenant_id, work_order_id, uploaded_by, file_path, file_name, file_size, mime_type, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
         (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM work_order_photos WHERE work_order_id = $3))
       RETURNING *`,
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
    const rows = await this.db.query<WorkOrderPhotoRow>(
      `SELECT p.* FROM work_order_photos p
       JOIN work_orders wo ON p.work_order_id = wo.id
       WHERE wo.uuid = $1 AND wo.tenant_id = $2 AND wo.is_active = 1
       ORDER BY p.sort_order ASC`,
      [workOrderUuid, tenantId],
    );
    return rows.map(mapPhotoRowToApi);
  }

  /** Hard-delete a photo + remove file from disk */
  async deletePhoto(
    tenantId: number,
    userId: number,
    photoUuid: string,
  ): Promise<void> {
    const photo = await this.db.queryOne<{
      id: number;
      file_path: string;
      work_order_id: number;
    }>(
      `SELECT p.id, p.file_path, p.work_order_id
       FROM work_order_photos p
       JOIN work_orders wo ON p.work_order_id = wo.id
       WHERE p.uuid = $1 AND wo.tenant_id = $2 AND wo.is_active = 1`,
      [photoUuid, tenantId],
    );

    if (photo === null) {
      throw new NotFoundException('Foto nicht gefunden');
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

  // ==========================================================================
  // Private helpers
  // ==========================================================================

  private async resolveWorkOrder(
    tenantId: number,
    uuid: string,
  ): Promise<{ id: number; title: string }> {
    const row = await this.db.queryOne<{ id: number; title: string }>(
      `SELECT id, title FROM work_orders
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
