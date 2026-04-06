import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { InventoryListsService } from './inventory-lists.service.js';
import type { InventoryListRow } from './inventory.types.js';

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

function makeListRow(overrides: Partial<InventoryListRow> = {}): InventoryListRow {
  return {
    id: 'list-uuid-1',
    tenant_id: 1,
    title: 'Kräne',
    description: 'Brückenkräne und Portalkräne',
    category: 'Lastaufnahmemittel',
    code_prefix: 'KRN',
    code_separator: '-',
    code_digits: 3,
    next_number: 1,
    icon: 'fa-crane',
    is_active: 1,
    created_by: 10,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe('InventoryListsService', () => {
  let service: InventoryListsService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new InventoryListsService(mockDb as unknown as DatabaseService);
  });

  // ── findAll ─────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return lists with status counts', async () => {
      qf.mockResolvedValueOnce([{ ...makeListRow(), total_items: '5' }]);
      qf.mockResolvedValueOnce([
        { list_id: 'list-uuid-1', status: 'operational', count: '3' },
        { list_id: 'list-uuid-1', status: 'defective', count: '2' },
      ]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0]?.totalItems).toBe(5);
      expect(result[0]?.statusCounts.operational).toBe(3);
      expect(result[0]?.statusCounts.defective).toBe(2);
      expect(result[0]?.statusCounts.repair).toBe(0);
    });

    it('should return empty array when no lists exist', async () => {
      qf.mockResolvedValueOnce([]);

      const result = await service.findAll();

      expect(result).toHaveLength(0);
    });

    it('should handle lists with zero items', async () => {
      qf.mockResolvedValueOnce([{ ...makeListRow(), total_items: '0' }]);
      qf.mockResolvedValueOnce([]);

      const result = await service.findAll();

      expect(result[0]?.totalItems).toBe(0);
      expect(result[0]?.statusCounts.operational).toBe(0);
    });

    it('should map snake_case to camelCase', async () => {
      qf.mockResolvedValueOnce([{ ...makeListRow(), total_items: '0' }]);
      qf.mockResolvedValueOnce([]);

      const result = await service.findAll();

      expect(result[0]?.codePrefix).toBe('KRN');
      expect(result[0]?.codeSeparator).toBe('-');
      expect(result[0]?.codeDigits).toBe(3);
      expect(result[0]?.nextNumber).toBe(1);
    });
  });

  // ── findById ────────────────────────────────────────────────

  describe('findById', () => {
    it('should return list with fields', async () => {
      qof.mockResolvedValueOnce({ ...makeListRow(), total_items: '3' });
      qf.mockResolvedValueOnce([{ status: 'operational', count: '3' }]);
      qf.mockResolvedValueOnce([{ id: 'field-1', field_name: 'Tragkraft' }]);

      const result = await service.findById('list-uuid-1');

      expect(result.list.title).toBe('Kräne');
      expect(result.list.totalItems).toBe(3);
      expect(result.fields).toHaveLength(1);
    });

    it('should throw NotFoundException for missing list', async () => {
      qof.mockResolvedValueOnce(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ── create ──────────────────────────────────────────────────

  describe('create', () => {
    it('should create a list and return it', async () => {
      const created = makeListRow();
      qf.mockResolvedValueOnce([created]);

      const result = await service.create(
        {
          title: 'Kräne',
          codePrefix: 'KRN',
          codeSeparator: '-',
          codeDigits: 3,
        } as never,
        10,
      );

      expect(result.title).toBe('Kräne');
      expect(result.code_prefix).toBe('KRN');
    });

    it('should pass all fields to INSERT', async () => {
      qf.mockResolvedValueOnce([makeListRow()]);

      await service.create(
        {
          title: 'Hubtische',
          description: 'Alle Hubtische',
          category: 'Hebezeuge',
          codePrefix: 'HBT',
          codeSeparator: '-',
          codeDigits: 4,
          icon: 'fa-arrow-up',
        } as never,
        10,
      );

      const callParams = qf.mock.calls[0]?.[1] as unknown[];
      expect(callParams[0]).toBe('Hubtische');
      expect(callParams[1]).toBe('Alle Hubtische');
      expect(callParams[2]).toBe('Hebezeuge');
      expect(callParams[3]).toBe('HBT');
    });
  });

  // ── update ──────────────────────────────────────────────────

  describe('update', () => {
    it('should update list fields', async () => {
      qof.mockResolvedValueOnce(makeListRow()); // existing check
      qf.mockResolvedValueOnce([makeListRow({ title: 'Neuer Titel' })]);

      const result = await service.update('list-uuid-1', { title: 'Neuer Titel' } as never);

      expect(result.title).toBe('Neuer Titel');
    });

    it('should throw NotFoundException for missing list', async () => {
      qof.mockResolvedValueOnce(null);

      await expect(service.update('nonexistent', { title: 'X' } as never)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should check prefix uniqueness on change', async () => {
      qof.mockResolvedValueOnce(makeListRow({ code_prefix: 'KRN' }));
      qof.mockResolvedValueOnce({ id: 'other-list' }); // conflict found

      await expect(service.update('list-uuid-1', { codePrefix: 'HBT' } as never)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should allow prefix change when no conflict', async () => {
      qof.mockResolvedValueOnce(makeListRow({ code_prefix: 'KRN' }));
      qof.mockResolvedValueOnce(null); // no conflict
      qf.mockResolvedValueOnce([makeListRow({ code_prefix: 'HBT' })]);

      const result = await service.update('list-uuid-1', { codePrefix: 'HBT' } as never);

      expect(result.code_prefix).toBe('HBT');
    });

    it('should skip prefix check when prefix unchanged', async () => {
      qof.mockResolvedValueOnce(makeListRow({ code_prefix: 'KRN' }));
      qf.mockResolvedValueOnce([makeListRow()]);

      await service.update('list-uuid-1', { codePrefix: 'KRN' } as never);

      // Only 2 DB calls: existing check + update (no conflict check)
      expect(qof).toHaveBeenCalledTimes(1);
      expect(qf).toHaveBeenCalledTimes(1);
    });
  });

  // ── softDelete ──────────────────────────────────────────────

  describe('softDelete', () => {
    it('should soft-delete list', async () => {
      qf.mockResolvedValueOnce([{ id: 'list-uuid-1' }]);

      await expect(service.softDelete('list-uuid-1')).resolves.toBeUndefined();
    });

    it('should throw NotFoundException for missing list', async () => {
      qf.mockResolvedValueOnce([]);

      await expect(service.softDelete('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ── getCategoryAutocomplete ─────────────────────────────────

  describe('getCategoryAutocomplete', () => {
    it('should return distinct categories', async () => {
      qf.mockResolvedValueOnce([{ category: 'Hebezeuge' }, { category: 'Druckbehälter' }]);

      const result = await service.getCategoryAutocomplete();

      expect(result).toEqual(['Hebezeuge', 'Druckbehälter']);
    });

    it('should filter by query string', async () => {
      qf.mockResolvedValueOnce([{ category: 'Hebezeuge' }]);

      const result = await service.getCategoryAutocomplete('Hebe');

      expect(result).toEqual(['Hebezeuge']);
      const callParams = qf.mock.calls[0]?.[1] as unknown[];
      expect(callParams[1]).toBe('%Hebe%');
    });

    it('should return empty array when no categories', async () => {
      qf.mockResolvedValueOnce([]);

      const result = await service.getCategoryAutocomplete();

      expect(result).toEqual([]);
    });
  });

  // ── Edge Cases ──────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle multiple lists in findAll', async () => {
      qf.mockResolvedValueOnce([
        { ...makeListRow({ id: 'l1', title: 'Kräne' }), total_items: '3' },
        { ...makeListRow({ id: 'l2', title: 'Leitern' }), total_items: '7' },
      ]);
      qf.mockResolvedValueOnce([
        { list_id: 'l1', status: 'operational', count: '3' },
        { list_id: 'l2', status: 'operational', count: '5' },
        { list_id: 'l2', status: 'defective', count: '2' },
      ]);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(result[0]?.statusCounts.operational).toBe(3);
      expect(result[1]?.statusCounts.operational).toBe(5);
      expect(result[1]?.statusCounts.defective).toBe(2);
    });

    it('should return all 7 status counts initialized to 0', async () => {
      qf.mockResolvedValueOnce([{ ...makeListRow(), total_items: '0' }]);
      qf.mockResolvedValueOnce([]);

      const result = await service.findAll();
      const counts = result[0]?.statusCounts;

      expect(counts?.operational).toBe(0);
      expect(counts?.defective).toBe(0);
      expect(counts?.repair).toBe(0);
      expect(counts?.maintenance).toBe(0);
      expect(counts?.decommissioned).toBe(0);
      expect(counts?.removed).toBe(0);
      expect(counts?.stored).toBe(0);
    });

    it('should handle null description in create', async () => {
      qf.mockResolvedValueOnce([makeListRow({ description: null })]);

      const result = await service.create(
        { title: 'Test', codePrefix: 'TST', codeSeparator: '-', codeDigits: 3 } as never,
        10,
      );

      expect(result.description).toBeNull();
    });

    it('should pass IS_ACTIVE.DELETED filter in all queries', async () => {
      qf.mockResolvedValueOnce([]);

      await service.findAll();

      const params = qf.mock.calls[0]?.[1] as unknown[];
      expect(params[0]).toBe(4); // IS_ACTIVE.DELETED = 4
    });
  });
});
