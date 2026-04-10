/**
 * Inventory Items Service
 *
 * CRUD operations for inventory items within lists.
 * Critical: Code auto-generation uses FOR UPDATE lock to prevent race conditions.
 * Uses tenantQuery/tenantTransaction for all DB operations (strict RLS, ADR-019).
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import type { z } from 'zod';

import { DatabaseService } from '../database/database.service.js';
import type { CustomValueInputSchema } from './dto/common.dto.js';
import type { CreateItemDto } from './dto/create-item.dto.js';
import type { UpdateItemDto } from './dto/update-item.dto.js';
import type {
  InventoryCustomField,
  InventoryCustomFieldRow,
  InventoryCustomValueWithField,
  InventoryItemPhoto,
  InventoryItemRow,
  InventoryItemStatus,
  InventoryListRow,
} from './inventory.types.js';
import { mapFieldRow } from './inventory.types.js';

interface ItemDetailRow extends InventoryItemRow {
  list_title: string;
  list_code_prefix: string;
}

type CustomValueInput = z.infer<typeof CustomValueInputSchema>;
type ValueKey = 'text' | 'number' | 'date' | 'boolean';

@Injectable()
export class InventoryItemsService {
  constructor(private readonly db: DatabaseService) {}

  /** Items for a specific list, with optional filters + custom values */
  async findByList(
    listId: string,
    filters: {
      status: InventoryItemStatus | undefined;
      search: string | undefined;
      page: number;
      limit: number;
    },
  ): Promise<{
    items: InventoryItemRow[];
    total: number;
    customValuesByItem: Record<string, InventoryCustomValueWithField[]>;
  }> {
    const { where, params, paramIndex } = this.buildItemFilters(listId, filters);

    const countRows = await this.db.tenantQuery<{ count: string }>(
      `SELECT COUNT(*) AS count FROM inventory_items i WHERE ${where}`,
      params,
    );
    const total = Number(countRows[0]?.count ?? '0');

    const offset = (filters.page - 1) * filters.limit;
    const items = await this.db.tenantQuery<InventoryItemRow>(
      `SELECT i.*, thumb.file_path AS thumbnail_path
       FROM inventory_items i
       LEFT JOIN LATERAL (
         SELECT p.file_path FROM inventory_item_photos p
         WHERE p.item_id = i.id AND p.is_active != ${String(IS_ACTIVE.DELETED)}
         ORDER BY p.sort_order LIMIT 1
       ) thumb ON true
       WHERE ${where}
       ORDER BY i.code
       LIMIT $${String(paramIndex)} OFFSET $${String(paramIndex + 1)}`,
      [...params, filters.limit, offset],
    );

    const customValuesByItem = await this.loadCustomValuesByItems(
      items.map((i: InventoryItemRow) => i.id),
    );

    return { items, total, customValuesByItem };
  }

  /** Single item by UUID — used as QR code target */
  async findByUuid(uuid: string): Promise<{
    item: ItemDetailRow;
    photos: InventoryItemPhoto[];
    customValues: InventoryCustomValueWithField[];
    fields: InventoryCustomField[];
  }> {
    const item = await this.db.tenantQueryOne<ItemDetailRow>(
      `SELECT i.*, l.title AS list_title, l.code_prefix AS list_code_prefix
       FROM inventory_items i
       JOIN inventory_lists l ON l.id = i.list_id
       WHERE i.id = $1 AND i.is_active != $2`,
      [uuid, IS_ACTIVE.DELETED],
    );

    if (item === null) {
      throw new NotFoundException('Inventargegenstand nicht gefunden');
    }

    const photos = await this.db.tenantQuery<InventoryItemPhoto>(
      `SELECT id, file_path AS "filePath", caption, sort_order AS "sortOrder",
              created_by AS "createdBy", created_at AS "createdAt"
       FROM inventory_item_photos
       WHERE item_id = $1 AND is_active != $2
       ORDER BY sort_order`,
      [uuid, IS_ACTIVE.DELETED],
    );

    const customValues = await this.db.tenantQuery<InventoryCustomValueWithField>(
      `SELECT v.field_id AS "fieldId", f.field_name AS "fieldName",
              f.field_type AS "fieldType", f.field_unit AS "fieldUnit",
              f.is_required AS "isRequired", v.value_text AS "valueText",
              v.value_number AS "valueNumber", v.value_date AS "valueDate",
              v.value_boolean AS "valueBoolean"
       FROM inventory_custom_values v
       JOIN inventory_custom_fields f ON f.id = v.field_id
       WHERE v.item_id = $1 AND v.is_active != $2 AND f.is_active != $2
       ORDER BY f.sort_order`,
      [uuid, IS_ACTIVE.DELETED],
    );

    const fieldRows = await this.db.tenantQuery<InventoryCustomFieldRow>(
      `SELECT * FROM inventory_custom_fields
       WHERE list_id = $1 AND is_active != $2
       ORDER BY sort_order, field_name`,
      [item.list_id, IS_ACTIVE.DELETED],
    );

    return { item, photos, customValues, fields: fieldRows.map(mapFieldRow) };
  }

  /**
   * Create a new item with auto-generated code.
   * Uses FOR UPDATE lock on inventory_lists to prevent race conditions.
   */
  async create(dto: CreateItemDto, createdBy: number): Promise<InventoryItemRow> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<InventoryItemRow> => {
        const { code, listId } = await this.lockListAndGenerateCode(client, dto.listId);

        const itemResult = await client.query<InventoryItemRow>(
          `INSERT INTO inventory_items (
          tenant_id, list_id, code, name, description, status, location,
          manufacturer, model, serial_number, year_of_manufacture,
          notes, created_by
        ) VALUES (
          NULLIF(current_setting('app.tenant_id', true), '')::integer,
          $1, $2, $3, $4, COALESCE($5::inventory_item_status, 'operational'), $6, $7, $8, $9, $10, $11, $12
        )
        RETURNING *`,
          [
            listId,
            code,
            dto.name,
            dto.description ?? null,
            dto.status,
            dto.location ?? null,
            dto.manufacturer ?? null,
            dto.model ?? null,
            dto.serialNumber ?? null,
            dto.yearOfManufacture ?? null,
            dto.notes ?? null,
            createdBy,
          ],
        );

        const item = itemResult.rows[0];
        if (item === undefined) {
          throw new Error('INSERT RETURNING returned no rows');
        }

        await this.upsertCustomValues(client, item.id, dto.customValues);
        return item;
      },
    );
  }

  /** Update an existing item (partial update — conditional field inclusion) */
  async update(uuid: string, dto: UpdateItemDto): Promise<InventoryItemRow> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<InventoryItemRow> => {
        const { setClauses, params } = this.buildItemSetClauses(dto);

        let item: InventoryItemRow | undefined;

        if (setClauses.length > 0) {
          const idIdx = params.length + 1;
          const delIdx = params.length + 2;
          const result = await client.query<InventoryItemRow>(
            `UPDATE inventory_items SET ${setClauses.join(', ')}
             WHERE id = $${String(idIdx)} AND is_active != $${String(delIdx)}
             RETURNING *`,
            [...params, uuid, IS_ACTIVE.DELETED],
          );
          item = result.rows[0];
        } else {
          const result = await client.query<InventoryItemRow>(
            `SELECT * FROM inventory_items WHERE id = $1 AND is_active != $2`,
            [uuid, IS_ACTIVE.DELETED],
          );
          item = result.rows[0];
        }

        if (item === undefined) {
          throw new NotFoundException('Inventargegenstand nicht gefunden');
        }

        await this.upsertCustomValues(client, item.id, dto.customValues);
        return item;
      },
    );
  }

  /** Update only the status of an item (dedicated method for audit tracking) */
  async updateStatus(uuid: string, status: InventoryItemStatus): Promise<InventoryItemRow> {
    const rows = await this.db.tenantQuery<InventoryItemRow>(
      `UPDATE inventory_items SET status = $2
       WHERE id = $1 AND is_active != $3
       RETURNING *`,
      [uuid, status, IS_ACTIVE.DELETED],
    );

    const item = rows[0];
    if (item === undefined) {
      throw new NotFoundException('Inventargegenstand nicht gefunden');
    }

    return item;
  }

  /** Soft-delete an item (is_active = DELETED) */
  async softDelete(uuid: string): Promise<void> {
    const rows = await this.db.tenantQuery<{ id: string }>(
      `UPDATE inventory_items SET is_active = $2
       WHERE id = $1 AND is_active != $2
       RETURNING id`,
      [uuid, IS_ACTIVE.DELETED],
    );

    if (rows.length === 0) {
      throw new NotFoundException('Inventargegenstand nicht gefunden');
    }
  }

  // ── Private Helpers ─────────────────────────────────────────────

  /** Batch-load custom values for multiple items (1 query, grouped by item_id) */
  private async loadCustomValuesByItems(
    itemIds: string[],
  ): Promise<Record<string, InventoryCustomValueWithField[]>> {
    if (itemIds.length === 0) return {};

    const rows = await this.db.tenantQuery<InventoryCustomValueWithField & { itemId: string }>(
      `SELECT v.item_id AS "itemId", v.field_id AS "fieldId",
              f.field_name AS "fieldName", f.field_type AS "fieldType",
              f.field_unit AS "fieldUnit", f.is_required AS "isRequired",
              v.value_text AS "valueText", v.value_number AS "valueNumber",
              v.value_date AS "valueDate", v.value_boolean AS "valueBoolean"
       FROM inventory_custom_values v
       JOIN inventory_custom_fields f ON f.id = v.field_id
       WHERE v.item_id = ANY($1::uuid[]) AND v.is_active != $2 AND f.is_active != $2
       ORDER BY f.sort_order`,
      [itemIds, IS_ACTIVE.DELETED],
    );

    const result: Record<string, InventoryCustomValueWithField[]> = {};
    for (const row of rows) {
      const { itemId, ...value } = row;
      result[itemId] ??= [];
      result[itemId].push(value);
    }
    return result;
  }

  /** Lock list row, generate code, increment counter — all inside parent transaction */
  private async lockListAndGenerateCode(
    client: PoolClient,
    listId: string,
  ): Promise<{ code: string; listId: string }> {
    const listResult = await client.query<InventoryListRow>(
      `SELECT * FROM inventory_lists WHERE id = $1 AND is_active != $2 FOR UPDATE`,
      [listId, IS_ACTIVE.DELETED],
    );

    const list = listResult.rows[0];
    if (list === undefined) {
      throw new NotFoundException('Inventarliste nicht gefunden');
    }

    const paddedNumber = String(list.next_number).padStart(list.code_digits, '0');
    const code = `${list.code_prefix}${list.code_separator}${paddedNumber}`;

    await client.query(`UPDATE inventory_lists SET next_number = next_number + 1 WHERE id = $1`, [
      listId,
    ]);

    return { code, listId };
  }

  /**
   * Validate custom values against their field definitions.
   *
   * Defense-in-depth: Zod (CustomValueInputSchema) only validates form
   * (each value column is independently nullish). The actual constraints —
   * "required field must have a value", "number field needs valueNumber, not
   * valueText", "select value must be in field_options" — depend on the field
   * definition row, which Zod can't see.
   *
   * Throws BadRequestException on the first violation. Called inside
   * tenantTransaction so a throw rolls the whole item create/update back.
   */
  private async validateCustomValues(
    client: PoolClient,
    customValues: CustomValueInput[],
  ): Promise<void> {
    if (customValues.length === 0) return;

    const fieldIds = customValues.map((cv: CustomValueInput): string => cv.fieldId);
    const fieldRows = await client.query<InventoryCustomFieldRow>(
      `SELECT * FROM inventory_custom_fields
       WHERE id = ANY($1::uuid[]) AND is_active != $2`,
      [fieldIds, IS_ACTIVE.DELETED],
    );

    const fieldsById = new Map<string, InventoryCustomFieldRow>();
    for (const row of fieldRows.rows) fieldsById.set(row.id, row);

    for (const cv of customValues) {
      const field = fieldsById.get(cv.fieldId);
      if (field === undefined) {
        throw new BadRequestException(`Custom Field ${cv.fieldId} nicht gefunden`);
      }
      this.assertValueMatchesField(field, cv);
    }
  }

  /** Pure: assert one custom value satisfies its field definition. */
  private assertValueMatchesField(field: InventoryCustomFieldRow, cv: CustomValueInput): void {
    const providedKeys = this.providedValueKeys(cv);

    if (providedKeys.length === 0) {
      if (field.is_required) {
        throw new BadRequestException(`Pflichtfeld "${field.field_name}" darf nicht leer sein`);
      }
      return;
    }

    if (providedKeys.length > 1) {
      throw new BadRequestException(
        `Custom Value für "${field.field_name}" darf nur einen Wert-Typ enthalten`,
      );
    }

    const expectedKey: ValueKey = field.field_type === 'select' ? 'text' : field.field_type;
    if (providedKeys[0] !== expectedKey) {
      throw new BadRequestException(
        `Wert für Feld "${field.field_name}" muss vom Typ ${field.field_type} sein`,
      );
    }

    this.assertSelectOptionValid(field, cv);
  }

  /** Pure: which value-type columns are populated on this custom value? */
  private providedValueKeys(cv: CustomValueInput): ValueKey[] {
    const keys: ValueKey[] = [];
    if (cv.valueText !== null && cv.valueText !== undefined) keys.push('text');
    if (cv.valueNumber !== null && cv.valueNumber !== undefined) keys.push('number');
    if (cv.valueDate !== null && cv.valueDate !== undefined) keys.push('date');
    if (cv.valueBoolean !== null && cv.valueBoolean !== undefined) keys.push('boolean');
    return keys;
  }

  /** Pure: enforce select-type values are members of field_options. */
  private assertSelectOptionValid(field: InventoryCustomFieldRow, cv: CustomValueInput): void {
    if (field.field_type !== 'select') return;
    if (cv.valueText === null || cv.valueText === undefined) return;
    if (!Array.isArray(field.field_options)) return;
    if (field.field_options.includes(cv.valueText)) return;
    throw new BadRequestException(
      `Wert "${cv.valueText}" ist keine gültige Option für Feld "${field.field_name}"`,
    );
  }

  /** Upsert custom values for an item within an existing transaction */
  private async upsertCustomValues(
    client: PoolClient,
    itemId: string,
    customValues?: CustomValueInput[],
  ): Promise<void> {
    if (customValues === undefined || customValues.length === 0) return;

    await this.validateCustomValues(client, customValues);

    // Partial unique index `idx_inventory_custom_values_unique_field` was
    // introduced by migration 20260406123459751 to allow soft-deleted rows
    // to free their slot. Postgres ON CONFLICT (cols) cannot use a partial
    // index unless the WHERE clause is repeated EXACTLY in the conflict
    // target — and since the planner needs a literal, we substitute via
    // template (not via $param). IS_ACTIVE.DELETED keeps the magic-number
    // rule (ADR/IS_ACTIVE) satisfied.
    for (const cv of customValues) {
      await client.query(
        `INSERT INTO inventory_custom_values (
          tenant_id, item_id, field_id, value_text, value_number, value_date, value_boolean
        ) VALUES (
          NULLIF(current_setting('app.tenant_id', true), '')::integer,
          $1, $2, $3, $4, $5::date, $6
        )
        ON CONFLICT (tenant_id, item_id, field_id) WHERE is_active != ${String(IS_ACTIVE.DELETED)}
        DO UPDATE SET
          value_text = EXCLUDED.value_text,
          value_number = EXCLUDED.value_number,
          value_date = EXCLUDED.value_date,
          value_boolean = EXCLUDED.value_boolean`,
        [
          itemId,
          cv.fieldId,
          cv.valueText ?? null,
          cv.valueNumber ?? null,
          cv.valueDate ?? null,
          cv.valueBoolean ?? null,
        ],
      );
    }
  }

  /** Build WHERE clause + params for item filtering */
  private buildItemFilters(
    listId: string,
    filters: { status: InventoryItemStatus | undefined; search: string | undefined },
  ): { where: string; params: unknown[]; paramIndex: number } {
    const conditions = ['i.list_id = $1', 'i.is_active != $2'];
    const params: unknown[] = [listId, IS_ACTIVE.DELETED];
    let paramIndex = 3;

    if (filters.status !== undefined) {
      conditions.push(`i.status = $${String(paramIndex)}`);
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.search !== undefined && filters.search.trim() !== '') {
      const p = String(paramIndex);
      conditions.push(`(i.name ILIKE $${p} OR i.code ILIKE $${p} OR i.serial_number ILIKE $${p})`);
      params.push(`%${filters.search.trim()}%`);
      paramIndex++;
    }

    return { where: conditions.join(' AND '), params, paramIndex };
  }

  /** Build SET clauses for dynamic partial update (only includes provided fields) */
  private buildItemSetClauses(dto: UpdateItemDto): { setClauses: string[]; params: unknown[] } {
    const setClauses: string[] = [];
    const params: unknown[] = [];

    const push = (col: string, val: unknown): void => {
      setClauses.push(`${col} = $${String(setClauses.length + 1)}`);
      params.push(val);
    };

    if (dto.name !== undefined) push('name', dto.name);
    if (dto.description !== undefined) push('description', dto.description);
    if (dto.status !== undefined) push('status', dto.status);
    if (dto.location !== undefined) push('location', dto.location);
    if (dto.manufacturer !== undefined) push('manufacturer', dto.manufacturer);
    if (dto.model !== undefined) push('model', dto.model);
    if (dto.serialNumber !== undefined) push('serial_number', dto.serialNumber);
    if (dto.yearOfManufacture !== undefined) push('year_of_manufacture', dto.yearOfManufacture);
    if (dto.notes !== undefined) push('notes', dto.notes);

    return { setClauses, params };
  }
}
