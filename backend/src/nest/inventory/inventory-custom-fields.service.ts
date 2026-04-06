/**
 * Inventory Custom Fields Service
 *
 * CRUD for per-list custom field definitions (EAV schema layer).
 * Max 30 fields per list to prevent query performance degradation.
 * Uses tenantQuery for all DB operations (strict RLS, ADR-019).
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import type { CreateCustomFieldDto } from './dto/create-custom-field.dto.js';
import type { UpdateCustomFieldDto } from './dto/update-custom-field.dto.js';
import type { InventoryCustomField, InventoryCustomFieldRow } from './inventory.types.js';
import { MAX_CUSTOM_FIELDS_PER_LIST, mapFieldRow } from './inventory.types.js';

@Injectable()
export class InventoryCustomFieldsService {
  constructor(private readonly db: DatabaseService) {}

  /** All active field definitions for a list, ordered by sort_order */
  async findByList(listId: string): Promise<InventoryCustomField[]> {
    const rows = await this.db.tenantQuery<InventoryCustomFieldRow>(
      `SELECT * FROM inventory_custom_fields
       WHERE list_id = $1 AND is_active != $2
       ORDER BY sort_order, field_name`,
      [listId, IS_ACTIVE.DELETED],
    );
    return rows.map(mapFieldRow);
  }

  /** Add a custom field definition to a list */
  async create(listId: string, dto: CreateCustomFieldDto): Promise<InventoryCustomField> {
    const countRows = await this.db.tenantQuery<{ count: string }>(
      `SELECT COUNT(*) AS count FROM inventory_custom_fields
       WHERE list_id = $1 AND is_active != $2`,
      [listId, IS_ACTIVE.DELETED],
    );
    const fieldCount = Number(countRows[0]?.count ?? '0');

    if (fieldCount >= MAX_CUSTOM_FIELDS_PER_LIST) {
      throw new BadRequestException(
        `Maximal ${String(MAX_CUSTOM_FIELDS_PER_LIST)} Custom Fields pro Liste erlaubt`,
      );
    }

    const rows = await this.db.tenantQuery<InventoryCustomFieldRow>(
      `INSERT INTO inventory_custom_fields (
        tenant_id, list_id, field_name, field_type, field_options, field_unit,
        is_required, sort_order
      ) VALUES (
        NULLIF(current_setting('app.tenant_id', true), '')::integer,
        $1, $2, $3, $4::jsonb, $5, $6, $7
      )
      RETURNING *`,
      [
        listId,
        dto.fieldName,
        dto.fieldType,
        dto.fieldOptions !== undefined && dto.fieldOptions !== null ?
          JSON.stringify(dto.fieldOptions)
        : null,
        dto.fieldUnit ?? null,
        dto.isRequired,
        dto.sortOrder,
      ],
    );

    const created = rows[0];
    if (created === undefined) {
      throw new Error('INSERT RETURNING returned no rows');
    }
    return mapFieldRow(created);
  }

  /** Update a custom field definition (conditional field inclusion) */
  async update(fieldId: string, dto: UpdateCustomFieldDto): Promise<InventoryCustomField> {
    const { setClauses, params } = this.buildFieldSetClauses(dto);

    if (setClauses.length === 0) {
      const existing = await this.db.tenantQuery<InventoryCustomFieldRow>(
        `SELECT * FROM inventory_custom_fields WHERE id = $1 AND is_active != $2`,
        [fieldId, IS_ACTIVE.DELETED],
      );
      if (existing.length === 0) {
        throw new NotFoundException('Custom Field nicht gefunden');
      }
      return mapFieldRow(existing[0] as InventoryCustomFieldRow);
    }

    const idIdx = params.length + 1;
    const delIdx = params.length + 2;
    const rows = await this.db.tenantQuery<InventoryCustomFieldRow>(
      `UPDATE inventory_custom_fields SET ${setClauses.join(', ')}
       WHERE id = $${String(idIdx)} AND is_active != $${String(delIdx)}
       RETURNING *`,
      [...params, fieldId, IS_ACTIVE.DELETED],
    );

    const updated = rows[0];
    if (updated === undefined) {
      throw new NotFoundException('Custom Field nicht gefunden');
    }
    return mapFieldRow(updated);
  }

  /** Build SET clauses for dynamic partial update */
  private buildFieldSetClauses(dto: UpdateCustomFieldDto): {
    setClauses: string[];
    params: unknown[];
  } {
    const setClauses: string[] = [];
    const params: unknown[] = [];

    const push = (col: string, val: unknown): void => {
      setClauses.push(`${col} = $${String(setClauses.length + 1)}`);
      params.push(val);
    };

    if (dto.fieldName !== undefined) push('field_name', dto.fieldName);
    if (dto.fieldType !== undefined) push('field_type', dto.fieldType);
    if (dto.fieldOptions !== undefined) {
      push('field_options', dto.fieldOptions !== null ? JSON.stringify(dto.fieldOptions) : null);
    }
    if (dto.fieldUnit !== undefined) push('field_unit', dto.fieldUnit);
    if (dto.isRequired !== undefined) push('is_required', dto.isRequired);
    if (dto.sortOrder !== undefined) push('sort_order', dto.sortOrder);

    return { setClauses, params };
  }

  /** Soft-delete a custom field (is_active = DELETED) */
  async softDelete(fieldId: string): Promise<void> {
    const rows = await this.db.tenantQuery<{ id: string }>(
      `UPDATE inventory_custom_fields SET is_active = $2
       WHERE id = $1 AND is_active != $2
       RETURNING id`,
      [fieldId, IS_ACTIVE.DELETED],
    );

    if (rows.length === 0) {
      throw new NotFoundException('Custom Field nicht gefunden');
    }
  }
}
