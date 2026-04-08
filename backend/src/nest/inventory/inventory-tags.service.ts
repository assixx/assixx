/**
 * Inventory Tags Service
 *
 * Tenant-scoped CRUD for the inventory_tags catalog plus the junction
 * helpers used by InventoryListsService for attach/detach.
 *
 * Tags are HARD-deleted (no soft-delete column). The junction CASCADE
 * removes references automatically. Case-insensitive uniqueness per
 * tenant is enforced by the functional unique index on LOWER(name).
 *
 * Used by:
 *   - InventoryController       (CRUD endpoints)
 *   - InventoryListsService     (replaceTagsForList during create/update)
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';

import { getErrorMessage } from '../common/utils/error.utils.js';
import { DatabaseService } from '../database/database.service.js';
import type { CreateTagDto } from './dto/create-tag.dto.js';
import type { UpdateTagDto } from './dto/update-tag.dto.js';
import {
  type InventoryTag,
  type InventoryTagRow,
  type InventoryTagWithUsage,
  type InventoryTagWithUsageRow,
  MAX_TAGS_PER_LIST,
  mapTagRow,
  mapTagWithUsageRow,
} from './inventory.types.js';

@Injectable()
export class InventoryTagsService {
  constructor(private readonly db: DatabaseService) {}

  /** All tags for the current tenant with usage counts (for filter UI + management modal) */
  async findAll(): Promise<InventoryTagWithUsage[]> {
    const rows = await this.db.tenantQuery<InventoryTagWithUsageRow>(
      `SELECT t.*,
              COALESCE(cnt.usage_count, 0) AS usage_count
       FROM inventory_tags t
       LEFT JOIN (
         SELECT tag_id, COUNT(*) AS usage_count
         FROM inventory_list_tags
         GROUP BY tag_id
       ) cnt ON cnt.tag_id = t.id
       ORDER BY t.name`,
    );

    return rows.map((r: InventoryTagWithUsageRow) => mapTagWithUsageRow(r));
  }

  /** Single tag by ID */
  async findById(tagId: string): Promise<InventoryTag> {
    const row = await this.db.tenantQueryOne<InventoryTagRow>(
      `SELECT * FROM inventory_tags WHERE id = $1`,
      [tagId],
    );

    if (row === null) {
      throw new NotFoundException('Tag nicht gefunden');
    }

    return mapTagRow(row);
  }

  /**
   * Create a tag explicitly. Maps the case-insensitive unique constraint
   * violation (`idx_inventory_tags_tenant_name_lower`) to a 409 so the
   * frontend can show a friendly "tag exists" message instead of a 500.
   */
  async create(dto: CreateTagDto, createdBy: number): Promise<InventoryTag> {
    try {
      const rows = await this.db.tenantQuery<InventoryTagRow>(
        `INSERT INTO inventory_tags (tenant_id, name, icon, created_by)
         VALUES (
           NULLIF(current_setting('app.tenant_id', true), '')::integer,
           $1, $2, $3
         )
         RETURNING *`,
        [dto.name, dto.icon ?? null, createdBy],
      );

      const created = rows[0];
      if (created === undefined) {
        throw new Error('INSERT RETURNING returned no rows');
      }
      return mapTagRow(created);
    } catch (error: unknown) {
      if (getErrorMessage(error).includes('idx_inventory_tags_tenant_name_lower')) {
        throw new ConflictException(`Tag "${dto.name}" existiert bereits`);
      }
      throw error;
    }
  }

  /**
   * Get-or-create batch: takes a list of (case-insensitive) tag names and
   * returns the corresponding tag rows. Existing tags are returned as-is,
   * missing tags are inserted. Used by the lists service to support
   * inline tag creation from the list modal.
   *
   * Race-safe: relies on the unique index — concurrent inserts of the
   * same name from different requests result in one winner; the loser
   * catches the 23505 and re-fetches.
   */
  async getOrCreateByNames(names: string[], createdBy: number): Promise<InventoryTag[]> {
    if (names.length === 0) return [];

    const normalized = Array.from(
      new Set(names.map((n: string): string => n.trim()).filter((n: string): boolean => n !== '')),
    );
    if (normalized.length === 0) return [];

    // Single round-trip: ON CONFLICT DO NOTHING for inserts, then fetch all
    // matching rows (both pre-existing and newly inserted).
    await this.db.tenantQuery(
      `INSERT INTO inventory_tags (tenant_id, name, created_by)
       SELECT
         NULLIF(current_setting('app.tenant_id', true), '')::integer,
         name,
         $2
       FROM UNNEST($1::text[]) AS name
       ON CONFLICT (tenant_id, LOWER(name)) DO NOTHING`,
      [normalized, createdBy],
    );

    const rows = await this.db.tenantQuery<InventoryTagRow>(
      `SELECT * FROM inventory_tags
       WHERE LOWER(name) = ANY(SELECT LOWER(unnest($1::text[])))
       ORDER BY name`,
      [normalized],
    );

    return rows.map((r: InventoryTagRow): InventoryTag => mapTagRow(r));
  }

  /** Update tag (rename + change icon, partial) */
  async update(tagId: string, dto: UpdateTagDto): Promise<InventoryTag> {
    const existing = await this.db.tenantQueryOne<InventoryTagRow>(
      `SELECT * FROM inventory_tags WHERE id = $1`,
      [tagId],
    );

    if (existing === null) {
      throw new NotFoundException('Tag nicht gefunden');
    }

    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (dto.name !== undefined) {
      setClauses.push(`name = $${String(setClauses.length + 1)}`);
      params.push(dto.name);
    }
    if (dto.icon !== undefined) {
      setClauses.push(`icon = $${String(setClauses.length + 1)}`);
      params.push(dto.icon);
    }

    if (setClauses.length === 0) {
      return mapTagRow(existing);
    }

    try {
      const idIdx = params.length + 1;
      const rows = await this.db.tenantQuery<InventoryTagRow>(
        `UPDATE inventory_tags SET ${setClauses.join(', ')}
         WHERE id = $${String(idIdx)}
         RETURNING *`,
        [...params, tagId],
      );

      const updated = rows[0];
      if (updated === undefined) {
        throw new NotFoundException('Tag nicht gefunden');
      }
      return mapTagRow(updated);
    } catch (error: unknown) {
      if (getErrorMessage(error).includes('idx_inventory_tags_tenant_name_lower')) {
        throw new ConflictException(`Tag "${dto.name ?? ''}" existiert bereits`);
      }
      throw error;
    }
  }

  /** Hard delete tag — junction CASCADE cleans up references */
  async delete(tagId: string): Promise<void> {
    const rows = await this.db.tenantQuery<{ id: string }>(
      `DELETE FROM inventory_tags WHERE id = $1 RETURNING id`,
      [tagId],
    );

    if (rows.length === 0) {
      throw new NotFoundException('Tag nicht gefunden');
    }
  }

  /**
   * Replace the full set of tags attached to a list. Validates that all
   * supplied tag IDs exist and belong to the current tenant (RLS).
   * Atomic via a single transaction: delete all current rows, insert new.
   *
   * Called from InventoryListsService.create / update.
   */
  async replaceTagsForList(listId: string, tagIds: string[]): Promise<void> {
    if (tagIds.length > MAX_TAGS_PER_LIST) {
      throw new BadRequestException(`Maximal ${String(MAX_TAGS_PER_LIST)} Tags pro Liste erlaubt`);
    }

    const uniqueIds = Array.from(new Set(tagIds));

    // Validate all tag IDs exist within the tenant before any mutation.
    if (uniqueIds.length > 0) {
      const existing = await this.db.tenantQuery<{ id: string }>(
        `SELECT id FROM inventory_tags WHERE id = ANY($1::uuid[])`,
        [uniqueIds],
      );
      if (existing.length !== uniqueIds.length) {
        throw new BadRequestException('Ein oder mehrere Tag-IDs existieren nicht');
      }
    }

    await this.db.tenantTransaction(async (client: PoolClient) => {
      await client.query(`DELETE FROM inventory_list_tags WHERE list_id = $1`, [listId]);

      if (uniqueIds.length === 0) return;

      await client.query(
        `INSERT INTO inventory_list_tags (list_id, tag_id, tenant_id)
         SELECT
           $1::uuid,
           tag_id,
           NULLIF(current_setting('app.tenant_id', true), '')::integer
         FROM UNNEST($2::uuid[]) AS tag_id`,
        [listId, uniqueIds],
      );
    });
  }
}
