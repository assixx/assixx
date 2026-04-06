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
      expect(result[0]?.field_name).toBe('Tragkraft');
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

      expect(result.field_name).toBe('Tragkraft');
      expect(result.field_type).toBe('number');
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

      expect(result.field_name).toBe('Gewicht');
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

      expect(result.field_options).toBeNull();
    });

    it('should handle update with partial fields', async () => {
      qf.mockResolvedValueOnce([makeFieldRow({ sort_order: 5 })]);

      const result = await service.update('field-uuid-1', { sortOrder: 5 } as never);

      expect(result.sort_order).toBe(5);
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
  });
});
