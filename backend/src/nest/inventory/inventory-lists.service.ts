/**
 * Inventory Lists Service
 *
 * CRUD operations for inventory list containers (e.g., "Kräne", "Hubtische").
 * Each list defines a code prefix for auto-generated item codes and may
 * carry zero or more inventory tags (V1.1 — replaces single freetext
 * category, see ADR-040 amendment).
 *
 * Uses tenantQuery for all DB operations (strict RLS, ADR-019).
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { getErrorMessage } from '../common/utils/error.utils.js';
import { DatabaseService } from '../database/database.service.js';
import type { CreateListDto } from './dto/create-list.dto.js';
import type { UpdateListDto } from './dto/update-list.dto.js';
import { InventoryTagsService } from './inventory-tags.service.js';
import {
  type InventoryCustomField,
  type InventoryCustomFieldRow,
  type InventoryItemStatus,
  type InventoryList,
  type InventoryListRow,
  type InventoryListWithCounts,
  type InventoryTag,
  type InventoryTagRow,
  mapFieldRow,
  mapTagRow,
} from './inventory.types.js';

interface StatusCountRow {
  status: InventoryItemStatus;
  count: string;
}

interface ListWithCountsRow extends InventoryListRow {
  total_items: string;
}

interface TagWithListIdRow extends InventoryTagRow {
  list_id: string;
}

@Injectable()
export class InventoryListsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly tagsService: InventoryTagsService,
  ) {}

  /**
   * All lists for the current tenant with item status counts and attached tags.
   * Optional `tagIds` filter narrows results to lists having ANY of the supplied
   * tags (OR semantics — matches multi-select chip UX).
   */
  async findAll(filters?: { tagIds?: string[] }): Promise<InventoryListWithCounts[]> {
    const baseSql = `SELECT l.*,
              COALESCE(cnt.total, 0) AS total_items
       FROM inventory_lists l
       LEFT JOIN (
         SELECT list_id, COUNT(*) AS total
         FROM inventory_items
         WHERE is_active != $1
         GROUP BY list_id
       ) cnt ON cnt.list_id = l.id
       WHERE l.is_active != $1`;

    const params: unknown[] = [IS_ACTIVE.DELETED];
    let whereExtra = '';

    if (filters?.tagIds !== undefined && filters.tagIds.length > 0) {
      whereExtra = ` AND EXISTS (
        SELECT 1 FROM inventory_list_tags lt
        WHERE lt.list_id = l.id AND lt.tag_id = ANY($2::uuid[])
      )`;
      params.push(filters.tagIds);
    }

    const lists = await this.db.tenantQuery<ListWithCountsRow>(
      `${baseSql}${whereExtra} ORDER BY l.title`,
      params,
    );

    if (lists.length === 0) return [];

    const listIds = lists.map((l: ListWithCountsRow) => l.id);
    const [statusCounts, tagsByList] = await Promise.all([
      this.fetchStatusCountsForLists(listIds),
      this.fetchTagsForLists(listIds),
    ]);

    return lists.map((row: ListWithCountsRow) => ({
      ...this.toListResponse(row, tagsByList.get(row.id) ?? []),
      statusCounts: statusCounts.get(row.id) ?? this.emptyStatusCounts(),
      totalItems: Number(row.total_items),
    }));
  }

  /** Single list by ID with tags, status counts, and custom field definitions */
  async findById(listId: string): Promise<{
    list: InventoryListWithCounts;
    fields: InventoryCustomField[];
  }> {
    const row = await this.db.tenantQueryOne<ListWithCountsRow>(
      `SELECT l.*,
              (SELECT COUNT(*) FROM inventory_items
               WHERE list_id = l.id AND is_active != $2) AS total_items
       FROM inventory_lists l
       WHERE l.id = $1 AND l.is_active != $2`,
      [listId, IS_ACTIVE.DELETED],
    );

    if (row === null) {
      throw new NotFoundException('Inventarliste nicht gefunden');
    }

    const [statusCountRows, tagsByList, fieldRows] = await Promise.all([
      this.db.tenantQuery<StatusCountRow>(
        `SELECT status, COUNT(*) AS count
         FROM inventory_items
         WHERE list_id = $1 AND is_active != $2
         GROUP BY status`,
        [listId, IS_ACTIVE.DELETED],
      ),
      this.fetchTagsForLists([listId]),
      this.db.tenantQuery<InventoryCustomFieldRow>(
        `SELECT * FROM inventory_custom_fields
         WHERE list_id = $1 AND is_active != $2
         ORDER BY sort_order, field_name`,
        [listId, IS_ACTIVE.DELETED],
      ),
    ]);

    const counts = this.emptyStatusCounts();
    for (const sc of statusCountRows) {
      counts[sc.status] = Number(sc.count);
    }

    return {
      list: {
        ...this.toListResponse(row, tagsByList.get(listId) ?? []),
        statusCounts: counts,
        totalItems: Number(row.total_items),
      },
      fields: fieldRows.map(mapFieldRow),
    };
  }

  /**
   * Create a new inventory list.
   *
   * The `idx_inventory_lists_unique_prefix` partial unique index
   * (`tenant_id, code_prefix WHERE is_active <> 4`) enforces prefix uniqueness
   * per tenant. A duplicate prefix is a user-correctable error, so we map the
   * PostgreSQL 23505 violation to `ConflictException` (409). Without this
   * mapping the raw pg error bubbles up as a 500 via `AllExceptionsFilter`.
   *
   * Tag attachment happens AFTER the list INSERT in a follow-up step. The
   * tag IDs are validated by `replaceTagsForList` (BadRequest if any unknown).
   */
  async create(dto: CreateListDto, createdBy: number): Promise<InventoryList> {
    let createdRow: InventoryListRow;
    try {
      const rows = await this.db.tenantQuery<InventoryListRow>(
        `INSERT INTO inventory_lists (
          tenant_id, title, description, code_prefix, code_separator,
          code_digits, icon, created_by
        ) VALUES (
          NULLIF(current_setting('app.tenant_id', true), '')::integer,
          $1, $2, $3, $4, $5, $6, $7
        )
        RETURNING *`,
        [
          dto.title,
          dto.description ?? null,
          dto.codePrefix,
          dto.codeSeparator,
          dto.codeDigits,
          dto.icon ?? null,
          createdBy,
        ],
      );

      const created = rows[0];
      /* v8 ignore next -- @preserve INSERT RETURNING always returns rows */
      if (created === undefined) throw new Error('INSERT RETURNING returned no rows');
      createdRow = created;
    } catch (error: unknown) {
      if (getErrorMessage(error).includes('idx_inventory_lists_unique_prefix')) {
        throw new ConflictException(`Kürzel "${dto.codePrefix}" wird bereits verwendet`);
      }
      throw error;
    }

    if (dto.tagIds !== undefined && dto.tagIds.length > 0) {
      await this.tagsService.replaceTagsForList(createdRow.id, dto.tagIds);
    }

    const tags = await this.fetchTagsForList(createdRow.id);
    return this.toListResponse(createdRow, tags);
  }

  /** Update an existing inventory list (conditional field inclusion) */
  async update(listId: string, dto: UpdateListDto): Promise<InventoryList> {
    const existing = await this.db.tenantQueryOne<InventoryListRow>(
      `SELECT * FROM inventory_lists WHERE id = $1 AND is_active != $2`,
      [listId, IS_ACTIVE.DELETED],
    );

    if (existing === null) {
      throw new NotFoundException('Inventarliste nicht gefunden');
    }

    if (dto.codePrefix !== undefined && dto.codePrefix !== existing.code_prefix) {
      const conflict = await this.db.tenantQueryOne<{ id: string }>(
        `SELECT id FROM inventory_lists
         WHERE code_prefix = $1 AND id != $2 AND is_active != $3`,
        [dto.codePrefix, listId, IS_ACTIVE.DELETED],
      );
      if (conflict !== null) {
        throw new ConflictException(`Kürzel "${dto.codePrefix}" wird bereits verwendet`);
      }
    }

    const { setClauses, params } = this.buildListSetClauses(dto);

    let updatedRow: InventoryListRow = existing;

    if (setClauses.length > 0) {
      const idIdx = params.length + 1;
      const delIdx = params.length + 2;
      const rows = await this.db.tenantQuery<InventoryListRow>(
        `UPDATE inventory_lists SET ${setClauses.join(', ')}
         WHERE id = $${String(idIdx)} AND is_active != $${String(delIdx)}
         RETURNING *`,
        [...params, listId, IS_ACTIVE.DELETED],
      );

      const updated = rows[0];
      if (updated === undefined) {
        throw new NotFoundException('Inventarliste nicht gefunden');
      }
      updatedRow = updated;
    }

    if (dto.tagIds !== undefined) {
      await this.tagsService.replaceTagsForList(listId, dto.tagIds);
    }

    const tags = await this.fetchTagsForList(listId);
    return this.toListResponse(updatedRow, tags);
  }

  /** Soft-delete a list (is_active = DELETED) */
  async softDelete(listId: string): Promise<void> {
    const rows = await this.db.tenantQuery<{ id: string }>(
      `UPDATE inventory_lists SET is_active = $2
       WHERE id = $1 AND is_active != $2
       RETURNING id`,
      [listId, IS_ACTIVE.DELETED],
    );

    if (rows.length === 0) {
      throw new NotFoundException('Inventarliste nicht gefunden');
    }
  }

  // ── Private Helpers ─────────────────────────────────────────────

  /** Build SET clauses for dynamic partial update (only includes provided fields) */
  private buildListSetClauses(dto: UpdateListDto): { setClauses: string[]; params: unknown[] } {
    const setClauses: string[] = [];
    const params: unknown[] = [];

    const push = (col: string, val: unknown): void => {
      setClauses.push(`${col} = $${String(setClauses.length + 1)}`);
      params.push(val);
    };

    if (dto.title !== undefined) push('title', dto.title);
    if (dto.description !== undefined) push('description', dto.description);
    if (dto.codePrefix !== undefined) push('code_prefix', dto.codePrefix);
    if (dto.codeSeparator !== undefined) push('code_separator', dto.codeSeparator);
    if (dto.codeDigits !== undefined) push('code_digits', dto.codeDigits);
    if (dto.icon !== undefined) push('icon', dto.icon);

    return { setClauses, params };
  }

  /** Fetch tags grouped by list_id for a batch of lists */
  private async fetchTagsForLists(listIds: string[]): Promise<Map<string, InventoryTag[]>> {
    const map = new Map<string, InventoryTag[]>();
    if (listIds.length === 0) return map;

    const rows = await this.db.tenantQuery<TagWithListIdRow>(
      `SELECT lt.list_id, t.*
       FROM inventory_list_tags lt
       JOIN inventory_tags t ON t.id = lt.tag_id
       WHERE lt.list_id = ANY($1::uuid[])
       ORDER BY t.name`,
      [listIds],
    );

    for (const row of rows) {
      const existing = map.get(row.list_id);
      const tag = mapTagRow(row);
      if (existing === undefined) {
        map.set(row.list_id, [tag]);
      } else {
        existing.push(tag);
      }
    }

    return map;
  }

  /** Convenience wrapper for single-list tag fetch */
  private async fetchTagsForList(listId: string): Promise<InventoryTag[]> {
    const map = await this.fetchTagsForLists([listId]);
    return map.get(listId) ?? [];
  }

  /** Aggregate item status counts per list */
  private async fetchStatusCountsForLists(
    listIds: string[],
  ): Promise<Map<string, Record<InventoryItemStatus, number>>> {
    const map = new Map<string, Record<InventoryItemStatus, number>>();
    if (listIds.length === 0) return map;

    const rows = await this.db.tenantQuery<StatusCountRow & { list_id: string }>(
      `SELECT list_id, status, COUNT(*) AS count
       FROM inventory_items
       WHERE list_id = ANY($1::uuid[]) AND is_active != $2
       GROUP BY list_id, status`,
      [listIds, IS_ACTIVE.DELETED],
    );

    for (const row of rows) {
      let counts = map.get(row.list_id);
      if (counts === undefined) {
        counts = this.emptyStatusCounts();
        map.set(row.list_id, counts);
      }
      counts[row.status] = Number(row.count);
    }

    return map;
  }

  private toListResponse(row: InventoryListRow, tags: InventoryTag[]): InventoryList {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      codePrefix: row.code_prefix,
      codeSeparator: row.code_separator,
      codeDigits: row.code_digits,
      nextNumber: row.next_number,
      icon: row.icon,
      isActive: row.is_active,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      tags,
    };
  }

  private emptyStatusCounts(): Record<InventoryItemStatus, number> {
    return {
      operational: 0,
      defective: 0,
      repair: 0,
      maintenance: 0,
      decommissioned: 0,
      removed: 0,
      stored: 0,
    };
  }
}
