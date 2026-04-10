import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { InventoryCustomFieldsService } from './inventory-custom-fields.service.js';
import type { InventoryCustomFieldRow } from './inventory.types.js';

// ── Mock Factories ──────────────────────────────────────────────

const qf = vi.fn();
const qof = vi.fn();

function createMockDb() {
  return {
    query: qf,
    tenantQuery: qf,
    queryOne: qof,
    tenantQueryOne: qof,
    tenantTransaction: vi.fn(),
  };
}

function makeFieldRow(overrides: Partial<InventoryCustomFieldRow> = {}): InventoryCustomFieldRow {
  return {
    id: 'field-uuid-1',
    tenant_id: 1,
    list_id: 'list-uuid-1',
    field_name: 'Tragkraft',
    field_type: 'number',
    field_options: null,
    field_unit: 'kg',
    is_required: false,
    sort_order: 0,
    is_active: 1,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe('InventoryCustomFieldsService', () => {
  let service: InventoryCustomFieldsService;

  beforeEach(() => {
    vi.clearAllMocks();
    const mockDb = createMockDb();
    service = new InventoryCustomFieldsService(mockDb as unknown as DatabaseService);
  });

  // ── findByList ──────────────────────────────────────────────

  describe('findByList', () => {
    it('should return field definitions ordered by sort_order', async () => {
      const fields = [
        makeFieldRow({ sort_order: 0, field_name: 'Tragkraft' }),
        makeFieldRow({ sort_order: 1, field_name: 'Baujahr' }),
      ];
      qf.mockResolvedValueOnce(fields);

      const result = await service.findByList('list-uuid-1');

      expect(result).toHaveLength(2);
      expect(result[0]?.fieldName).toBe('Tragkraft');
    });

    it('should return empty for list without fields', async () => {
      qf.mockResolvedValueOnce([]);

      const result = await service.findByList('list-uuid-1');

      expect(result).toHaveLength(0);
    });
  });

  // ── create ──────────────────────────────────────────────────

  describe('create', () => {
    it('should create a field definition', async () => {
      qf.mockResolvedValueOnce([{ count: '0' }]); // field count
      qf.mockResolvedValueOnce([makeFieldRow()]);

      const result = await service.create('list-uuid-1', {
        fieldName: 'Tragkraft',
        fieldType: 'number',
        fieldUnit: 'kg',
        isRequired: false,
        sortOrder: 0,
      } as never);

      expect(result.fieldName).toBe('Tragkraft');
      expect(result.fieldType).toBe('number');
    });

    it('should reject when max fields reached (30)', async () => {
      qf.mockResolvedValueOnce([{ count: '30' }]);

      await expect(
        service.create('list-uuid-1', { fieldName: 'Too many' } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow field at limit-1 (29)', async () => {
      qf.mockResolvedValueOnce([{ count: '29' }]);
      qf.mockResolvedValueOnce([makeFieldRow()]);

      await expect(
        service.create('list-uuid-1', {
          fieldName: 'Last field',
          fieldType: 'text',
          isRequired: false,
          sortOrder: 29,
        } as never),
      ).resolves.toBeDefined();
    });

    it('should store select field options as JSON', async () => {
      qf.mockResolvedValueOnce([{ count: '0' }]);
      qf.mockResolvedValueOnce([makeFieldRow({ field_type: 'select', field_options: ['a', 'b'] })]);

      await service.create('list-uuid-1', {
        fieldName: 'Zustand',
        fieldType: 'select',
        fieldOptions: ['gut', 'schlecht'],
        isRequired: false,
        sortOrder: 0,
      } as never);

      const insertParams = qf.mock.calls[1]?.[1] as unknown[];
      expect(insertParams[3]).toBe(JSON.stringify(['gut', 'schlecht']));
    });
  });

  // ── update ──────────────────────────────────────────────────

  describe('update', () => {
    it('should update field properties', async () => {
      qf.mockResolvedValueOnce([makeFieldRow({ field_name: 'Gewicht' })]);

      const result = await service.update('field-uuid-1', { fieldName: 'Gewicht' } as never);

      expect(result.fieldName).toBe('Gewicht');
    });

    it('should throw NotFoundException for missing field', async () => {
      qf.mockResolvedValueOnce([]);

      await expect(service.update('nonexistent', { fieldName: 'X' } as never)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── softDelete ──────────────────────────────────────────────

  describe('softDelete', () => {
    it('should soft-delete field', async () => {
      qf.mockResolvedValueOnce([{ id: 'field-uuid-1' }]);

      await expect(service.softDelete('field-uuid-1')).resolves.toBeUndefined();
    });

    it('should throw NotFoundException for missing field', async () => {
      qf.mockResolvedValueOnce([]);

      await expect(service.softDelete('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ── Edge Cases ──────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle null fieldOptions for non-select types', async () => {
      qf.mockResolvedValueOnce([{ count: '0' }]);
      qf.mockResolvedValueOnce([makeFieldRow({ field_options: null })]);

      const result = await service.create('list-uuid-1', {
        fieldName: 'Gewicht',
        fieldType: 'number',
        isRequired: true,
        sortOrder: 0,
      } as never);

      expect(result.fieldOptions).toBeNull();
    });

    it('should handle update with partial fields', async () => {
      qf.mockResolvedValueOnce([makeFieldRow({ sort_order: 5 })]);

      const result = await service.update('field-uuid-1', { sortOrder: 5 } as never);

      expect(result.sortOrder).toBe(5);
    });

    it('should pass IS_ACTIVE.DELETED in count query', async () => {
      qf.mockResolvedValueOnce([{ count: '0' }]);
      qf.mockResolvedValueOnce([makeFieldRow()]);

      await service.create('list-uuid-1', {
        fieldName: 'X',
        fieldType: 'text',
        isRequired: false,
        sortOrder: 0,
      } as never);

      const countParams = qf.mock.calls[0]?.[1] as unknown[];
      expect(countParams[1]).toBe(4); // IS_ACTIVE.DELETED
    });

    it('should return existing field when update has empty dto', async () => {
      qf.mockResolvedValueOnce([makeFieldRow()]); // SELECT existing

      const result = await service.update('field-uuid-1', {} as never);

      expect(result.fieldName).toBe('Tragkraft');
      expect(result.fieldType).toBe('number');
    });

    it('should map row to camelCase in findByList', async () => {
      qf.mockResolvedValueOnce([makeFieldRow()]);

      const result = await service.findByList('list-uuid-1');

      expect(result[0]?.fieldName).toBe('Tragkraft');
      expect(result[0]?.fieldType).toBe('number');
      expect(result[0]?.fieldUnit).toBe('kg');
      expect(result[0]?.isRequired).toBe(false);
      expect(result[0]?.sortOrder).toBe(0);
      expect(result[0]?.listId).toBe('list-uuid-1');
      // snake_case properties should NOT exist
      expect((result[0] as Record<string, unknown>).field_name).toBeUndefined();
    });

    it('should map row to camelCase in create', async () => {
      qf.mockResolvedValueOnce([{ count: '0' }]);
      qf.mockResolvedValueOnce([makeFieldRow({ field_type: 'boolean', is_required: true })]);

      const result = await service.create('list-uuid-1', {
        fieldName: 'Geprüft',
        fieldType: 'boolean',
        isRequired: true,
        sortOrder: 1,
      } as never);

      expect(result.fieldType).toBe('boolean');
      expect(result.isRequired).toBe(true);
    });

    it('should throw NotFoundException for empty-dto update when field does not exist', async () => {
      qf.mockResolvedValueOnce([]); // SELECT returns empty

      await expect(service.update('nonexistent', {} as never)).rejects.toThrow(NotFoundException);
    });

    it('should include all 6 fields in SET clauses when all provided', async () => {
      qf.mockResolvedValueOnce([
        makeFieldRow({
          field_name: 'Gewicht',
          field_type: 'number',
          field_options: null,
          field_unit: 'kg',
          is_required: true,
          sort_order: 5,
        }),
      ]);

      await service.update('field-uuid-1', {
        fieldName: 'Gewicht',
        fieldType: 'number',
        fieldOptions: null,
        fieldUnit: 'kg',
        isRequired: true,
        sortOrder: 5,
      } as never);

      const sql = qf.mock.calls[0]?.[0] as string;
      expect(sql).toContain('field_name');
      expect(sql).toContain('field_type');
      expect(sql).toContain('field_options');
      expect(sql).toContain('field_unit');
      expect(sql).toContain('is_required');
      expect(sql).toContain('sort_order');
    });

    it('should JSON.stringify fieldOptions array in update', async () => {
      qf.mockResolvedValueOnce([makeFieldRow({ field_options: ['a', 'b', 'c'] })]);

      await service.update('field-uuid-1', {
        fieldOptions: ['a', 'b', 'c'],
      } as never);

      const params = qf.mock.calls[0]?.[1] as unknown[];
      expect(params[0]).toBe(JSON.stringify(['a', 'b', 'c']));
    });

    it('should pass null when fieldOptions is null in update', async () => {
      qf.mockResolvedValueOnce([makeFieldRow({ field_options: null })]);

      await service.update('field-uuid-1', {
        fieldOptions: null,
      } as never);

      const params = qf.mock.calls[0]?.[1] as unknown[];
      expect(params[0]).toBeNull();
    });

    it('should pass null for fieldOptions when null in create', async () => {
      qf.mockResolvedValueOnce([{ count: '0' }]);
      qf.mockResolvedValueOnce([makeFieldRow()]);

      await service.create('list-uuid-1', {
        fieldName: 'Test',
        fieldType: 'text',
        fieldOptions: null,
        isRequired: false,
        sortOrder: 0,
      } as never);

      const insertParams = qf.mock.calls[1]?.[1] as unknown[];
      expect(insertParams[3]).toBeNull();
    });

    it('should allow setting fieldUnit to null via update', async () => {
      qf.mockResolvedValueOnce([makeFieldRow({ field_unit: null })]);

      const result = await service.update('field-uuid-1', { fieldUnit: null } as never);

      expect(result.fieldUnit).toBeNull();
    });
  });
});
