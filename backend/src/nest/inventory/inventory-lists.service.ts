/**
 * Inventory Lists Service
 *
 * CRUD operations for inventory list containers (e.g., "Kräne", "Hubtische").
 * Each list defines a code prefix for auto-generated item codes.
 * Uses tenantQuery for all DB operations (strict RLS, ADR-019).
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import type { CreateListDto } from './dto/create-list.dto.js';
import type { UpdateListDto } from './dto/update-list.dto.js';
import type {
  InventoryCustomFieldRow,
  InventoryItemStatus,
  InventoryListRow,
  InventoryListWithCounts,
} from './inventory.types.js';

interface StatusCountRow {
  status: InventoryItemStatus;
  count: string;
}

interface ListWithCountsRow extends InventoryListRow {
  total_items: string;
}

@Injectable()
export class InventoryListsService {
  constructor(private readonly db: DatabaseService) {}

  /** All lists for the current tenant, with item status counts */
  async findAll(): Promise<InventoryListWithCounts[]> {
    const lists = await this.db.tenantQuery<ListWithCountsRow>(
      `SELECT l.*,
              COALESCE(cnt.total, 0) AS total_items
       FROM inventory_lists l
       LEFT JOIN (
         SELECT list_id, COUNT(*) AS total
         FROM inventory_items
         WHERE is_active != $1
         GROUP BY list_id
       ) cnt ON cnt.list_id = l.id
       WHERE l.is_active != $1
       ORDER BY l.title`,
      [IS_ACTIVE.DELETED],
    );

    if (lists.length === 0) return [];

    const listIds = lists.map((l: ListWithCountsRow) => l.id);
    const statusCounts = await this.db.tenantQuery<StatusCountRow & { list_id: string }>(
      `SELECT list_id, status, COUNT(*) AS count
       FROM inventory_items
       WHERE list_id = ANY($1) AND is_active != $2
       GROUP BY list_id, status`,
      [listIds, IS_ACTIVE.DELETED],
    );

    const countsByList = new Map<string, Record<InventoryItemStatus, number>>();
    for (const row of statusCounts) {
      if (!countsByList.has(row.list_id)) {
        countsByList.set(row.list_id, this.emptyStatusCounts());
      }
      const counts = countsByList.get(row.list_id);
      if (counts !== undefined) {
        counts[row.status] = Number(row.count);
      }
    }

    return lists.map((row: ListWithCountsRow) => ({
      ...this.toListResponse(row),
      statusCounts: countsByList.get(row.id) ?? this.emptyStatusCounts(),
      totalItems: Number(row.total_items),
    }));
  }

  /** Single list by ID with custom field definitions */
  async findById(listId: string): Promise<{
    list: InventoryListWithCounts;
    fields: InventoryCustomFieldRow[];
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

    const statusCounts = await this.db.tenantQuery<StatusCountRow>(
      `SELECT status, COUNT(*) AS count
       FROM inventory_items
       WHERE list_id = $1 AND is_active != $2
       GROUP BY status`,
      [listId, IS_ACTIVE.DELETED],
    );

    const counts = this.emptyStatusCounts();
    for (const sc of statusCounts) {
      counts[sc.status] = Number(sc.count);
    }

    const fields = await this.db.tenantQuery<InventoryCustomFieldRow>(
      `SELECT * FROM inventory_custom_fields
       WHERE list_id = $1 AND is_active != $2
       ORDER BY sort_order, field_name`,
      [listId, IS_ACTIVE.DELETED],
    );

    return {
      list: {
        ...this.toListResponse(row),
        statusCounts: counts,
        totalItems: Number(row.total_items),
      },
      fields,
    };
  }

  /** Create a new inventory list */
  async create(dto: CreateListDto, createdBy: number): Promise<InventoryListRow> {
    const rows = await this.db.tenantQuery<InventoryListRow>(
      `INSERT INTO inventory_lists (
        tenant_id, title, description, category, code_prefix, code_separator,
        code_digits, icon, created_by
      ) VALUES (
        NULLIF(current_setting('app.tenant_id', true), '')::integer,
        $1, $2, $3, $4, $5, $6, $7, $8
      )
      RETURNING *`,
      [
        dto.title,
        dto.description ?? null,
        dto.category ?? null,
        dto.codePrefix,
        dto.codeSeparator,
        dto.codeDigits,
        dto.icon ?? null,
        createdBy,
      ],
    );

    const created = rows[0];
    if (created === undefined) {
      throw new Error('INSERT RETURNING returned no rows');
    }
    return created;
  }

  /** Update an existing inventory list (conditional field inclusion) */
  async update(listId: string, dto: UpdateListDto): Promise<InventoryListRow> {
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

    if (setClauses.length === 0) {
      return existing;
    }

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

    return updated;
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

  /** Distinct categories for autocomplete */
  async getCategoryAutocomplete(query?: string): Promise<string[]> {
    const rows = await this.db.tenantQuery<{ category: string }>(
      `SELECT DISTINCT category FROM inventory_lists
       WHERE category IS NOT NULL
         AND category != ''
         AND is_active != $1
         ${query !== undefined ? 'AND category ILIKE $2' : ''}
       ORDER BY category
       LIMIT 20`,
      query !== undefined ? [IS_ACTIVE.DELETED, `%${query}%`] : [IS_ACTIVE.DELETED],
    );

    return rows.map((r: { category: string }) => r.category);
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
    if (dto.category !== undefined) push('category', dto.category);
    if (dto.codePrefix !== undefined) push('code_prefix', dto.codePrefix);
    if (dto.codeSeparator !== undefined) push('code_separator', dto.codeSeparator);
    if (dto.codeDigits !== undefined) push('code_digits', dto.codeDigits);
    if (dto.icon !== undefined) push('icon', dto.icon);

    return { setClauses, params };
  }

  private toListResponse(
    row: InventoryListRow,
  ): Omit<InventoryListWithCounts, 'statusCounts' | 'totalItems'> {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      codePrefix: row.code_prefix,
      codeSeparator: row.code_separator,
      codeDigits: row.code_digits,
      nextNumber: row.next_number,
      icon: row.icon,
      isActive: row.is_active,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
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
