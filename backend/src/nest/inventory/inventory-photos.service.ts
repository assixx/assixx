/**
 * Inventory Photos Service
 *
 * Photo management for inventory items (upload, reorder, delete).
 * Uses tenantQuery for all DB operations (strict RLS, ADR-019).
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';

import { DatabaseService } from '../database/database.service.js';
import type { InventoryItemPhotoRow } from './inventory.types.js';
import { MAX_PHOTOS_PER_ITEM } from './inventory.types.js';

@Injectable()
export class InventoryPhotosService {
  constructor(private readonly db: DatabaseService) {}

  /** All active photos for an item, ordered by sort_order */
  async findByItem(itemId: string): Promise<InventoryItemPhotoRow[]> {
    return await this.db.tenantQuery<InventoryItemPhotoRow>(
      `SELECT * FROM inventory_item_photos
       WHERE item_id = $1 AND is_active != $2
       ORDER BY sort_order`,
      [itemId, IS_ACTIVE.DELETED],
    );
  }

  /** Add a photo to an item */
  async create(
    itemId: string,
    filePath: string,
    caption: string | null,
    createdBy: number,
  ): Promise<InventoryItemPhotoRow> {
    const countRows = await this.db.tenantQuery<{ count: string }>(
      `SELECT COUNT(*) AS count FROM inventory_item_photos
       WHERE item_id = $1 AND is_active != $2`,
      [itemId, IS_ACTIVE.DELETED],
    );
    const photoCount = Number(countRows[0]?.count ?? '0');

    if (photoCount >= MAX_PHOTOS_PER_ITEM) {
      throw new BadRequestException(
        `Maximal ${String(MAX_PHOTOS_PER_ITEM)} Fotos pro Gegenstand erlaubt`,
      );
    }

    const rows = await this.db.tenantQuery<InventoryItemPhotoRow>(
      `INSERT INTO inventory_item_photos (
        tenant_id, item_id, file_path, caption, sort_order, created_by
      ) VALUES (
        NULLIF(current_setting('app.tenant_id', true), '')::integer,
        $1, $2, $3, $4, $5
      )
      RETURNING *`,
      [itemId, filePath, caption, photoCount, createdBy],
    );

    const created = rows[0];
    /* v8 ignore next -- @preserve INSERT RETURNING always returns rows */
    if (created === undefined) throw new Error('INSERT RETURNING returned no rows');
    return created;
  }

  /** Update photo caption */
  async updateCaption(photoId: string, caption: string | null): Promise<InventoryItemPhotoRow> {
    const rows = await this.db.tenantQuery<InventoryItemPhotoRow>(
      `UPDATE inventory_item_photos SET caption = $2
       WHERE id = $1 AND is_active != $3
       RETURNING *`,
      [photoId, caption, IS_ACTIVE.DELETED],
    );

    const updated = rows[0];
    if (updated === undefined) {
      throw new NotFoundException('Foto nicht gefunden');
    }
    return updated;
  }

  /** Reorder photos by setting sort_order based on array position (atomic) */
  async reorder(itemId: string, photoIds: string[]): Promise<void> {
    if (photoIds.length === 0) return;

    await this.db.tenantTransaction(async (client: PoolClient): Promise<void> => {
      for (let i = 0; i < photoIds.length; i++) {
        await client.query(
          `UPDATE inventory_item_photos SET sort_order = $2
           WHERE id = $1 AND item_id = $3 AND is_active != $4`,
          [photoIds[i], i, itemId, IS_ACTIVE.DELETED],
        );
      }
    });
  }

  /** Soft-delete a photo (is_active = DELETED) */
  async softDelete(photoId: string): Promise<void> {
    const rows = await this.db.tenantQuery<{ id: string }>(
      `UPDATE inventory_item_photos SET is_active = $2
       WHERE id = $1 AND is_active != $2
       RETURNING id`,
      [photoId, IS_ACTIVE.DELETED],
    );

    if (rows.length === 0) {
      throw new NotFoundException('Foto nicht gefunden');
    }
  }
}
