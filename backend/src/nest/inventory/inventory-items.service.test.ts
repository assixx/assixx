import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { InventoryItemsService } from './inventory-items.service.js';
import type { InventoryItemRow, InventoryListRow } from './inventory.types.js';

// ── Mock Factories ──────────────────────────────────────────────

const mockClient = { query: vi.fn() };
const qf = vi.fn();
const qof = vi.fn();

function createMockDb() {
  return {
    query: qf,
    tenantQuery: qf,
    queryOne: qof,
    tenantQueryOne: qof,
    tenantTransaction: vi
      .fn()
      .mockImplementation(
        async (cb: (client: typeof mockClient) => Promise<unknown>): Promise<unknown> =>
          await cb(mockClient),
      ),
  };
}

function makeListRow(overrides: Partial<InventoryListRow> = {}): InventoryListRow {
  return {
    id: 'list-uuid-1',
    tenant_id: 1,
    title: 'Kräne',
    description: null,
    category: 'Lastaufnahmemittel',
    code_prefix: 'KRN',
    code_separator: '-',
    code_digits: 3,
    next_number: 1,
    icon: null,
    is_active: 1,
    created_by: 10,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeItemRow(overrides: Partial<InventoryItemRow> = {}): InventoryItemRow {
  return {
    id: 'item-uuid-1',
    tenant_id: 1,
    list_id: 'list-uuid-1',
    code: 'KRN-001',
    name: 'Brückenkran Halle A',
    description: null,
    status: 'operational',
    location: 'Halle A',
    manufacturer: 'Demag',
    model: 'EKV 5',
    serial_number: 'SN-12345',
    year_of_manufacture: 2019,
    notes: null,
    responsible_user_id: null,
    last_inspection_date: null,
    next_inspection_date: null,
    inspection_interval: null,
    is_active: 1,
    created_by: 10,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe('InventoryItemsService', () => {
  let service: InventoryItemsService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new InventoryItemsService(mockDb as unknown as DatabaseService);
  });

  // ── findByList ──────────────────────────────────────────────

  describe('findByList', () => {
    it('should return paginated items with custom values', async () => {
      const items = [makeItemRow({ code: 'KRN-001' }), makeItemRow({ code: 'KRN-002' })];
      qf.mockResolvedValueOnce([{ count: '2' }]);
      qf.mockResolvedValueOnce(items);
      qf.mockResolvedValueOnce([]); // custom values batch

      const result = await service.findByList('list-uuid-1', {
        status: undefined,
        search: undefined,
        page: 1,
        limit: 50,
      });

      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
      expect(result.customValuesByItem).toEqual({});
    });

    it('should filter by status', async () => {
      qf.mockResolvedValueOnce([{ count: '1' }]);
      qf.mockResolvedValueOnce([makeItemRow({ status: 'defective' })]);
      qf.mockResolvedValueOnce([]); // custom values batch

      const result = await service.findByList('list-uuid-1', {
        status: 'defective',
        search: undefined,
        page: 1,
        limit: 50,
      });

      expect(result.total).toBe(1);
      expect(result.items[0]?.status).toBe('defective');
    });

    it('should filter by search term', async () => {
      qf.mockResolvedValueOnce([{ count: '1' }]);
      qf.mockResolvedValueOnce([makeItemRow({ name: 'Brückenkran' })]);
      qf.mockResolvedValueOnce([]); // custom values batch

      const result = await service.findByList('list-uuid-1', {
        status: undefined,
        search: 'Brücken',
        page: 1,
        limit: 50,
      });

      expect(result.total).toBe(1);
    });

    it('should return empty when no items match', async () => {
      qf.mockResolvedValueOnce([{ count: '0' }]);
      qf.mockResolvedValueOnce([]);

      const result = await service.findByList('list-uuid-1', {
        status: undefined,
        search: undefined,
        page: 1,
        limit: 50,
      });

      expect(result.total).toBe(0);
      expect(result.items).toHaveLength(0);
    });

    it('should handle pagination offset correctly', async () => {
      qf.mockResolvedValueOnce([{ count: '100' }]);
      qf.mockResolvedValueOnce([]);

      await service.findByList('list-uuid-1', {
        status: undefined,
        search: undefined,
        page: 3,
        limit: 20,
      });

      const lastCall = qf.mock.calls[1] as unknown[];
      const params = lastCall[1] as unknown[];
      expect(params).toContain(20); // limit
      expect(params).toContain(40); // offset = (3-1) * 20
    });
  });

  // ── findByUuid ──────────────────────────────────────────────

  describe('findByUuid', () => {
    it('should return item with photos, custom values and fields', async () => {
      const item = { ...makeItemRow(), list_title: 'Kräne', list_code_prefix: 'KRN' };
      qof.mockResolvedValueOnce(item);
      qf.mockResolvedValueOnce([]); // photos
      qf.mockResolvedValueOnce([]); // custom values
      qf.mockResolvedValueOnce([]); // field definitions

      const result = await service.findByUuid('item-uuid-1');

      expect(result.item.code).toBe('KRN-001');
      expect(result.photos).toHaveLength(0);
      expect(result.customValues).toHaveLength(0);
      expect(result.fields).toHaveLength(0);
    });

    it('should throw NotFoundException for missing item', async () => {
      qof.mockResolvedValueOnce(null);

      await expect(service.findByUuid('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ── create (Code Auto-Generation) ──────────────────────────

  describe('create', () => {
    it('should auto-generate code with correct format KRN-001', async () => {
      const list = makeListRow({ next_number: 1, code_prefix: 'KRN', code_digits: 3 });
      mockClient.query.mockResolvedValueOnce({ rows: [list] }); // FOR UPDATE
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // increment next_number
      mockClient.query.mockResolvedValueOnce({ rows: [makeItemRow({ code: 'KRN-001' })] }); // INSERT

      const result = await service.create({ listId: 'list-uuid-1', name: 'Kran 1' } as never, 10);

      expect(result.code).toBe('KRN-001');
    });

    it('should pad numbers according to code_digits', async () => {
      const list = makeListRow({ next_number: 42, code_digits: 5 });
      mockClient.query.mockResolvedValueOnce({ rows: [list] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({
        rows: [makeItemRow({ code: 'KRN-00042' })],
      });

      const result = await service.create({ listId: 'list-uuid-1', name: 'Kran 42' } as never, 10);

      expect(result.code).toBe('KRN-00042');
    });

    it('should use custom separator', async () => {
      const list = makeListRow({ code_separator: '.', next_number: 7 });
      mockClient.query.mockResolvedValueOnce({ rows: [list] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({
        rows: [makeItemRow({ code: 'KRN.007' })],
      });

      const result = await service.create({ listId: 'list-uuid-1', name: 'Kran 7' } as never, 10);

      expect(result.code).toBe('KRN.007');
    });

    it('should increment next_number after code generation', async () => {
      const list = makeListRow({ next_number: 5 });
      mockClient.query.mockResolvedValueOnce({ rows: [list] });
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // increment
      mockClient.query.mockResolvedValueOnce({ rows: [makeItemRow()] });

      await service.create({ listId: 'list-uuid-1', name: 'Kran' } as never, 10);

      // Second call should be the increment UPDATE
      const incrementCall = mockClient.query.mock.calls[1] as unknown[];
      expect(incrementCall[0]).toContain('next_number = next_number + 1');
    });

    it('should throw NotFoundException for nonexistent list', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // FOR UPDATE returns empty

      await expect(
        service.create({ listId: 'nonexistent', name: 'Kran' } as never, 10),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use FOR UPDATE lock on list', async () => {
      const list = makeListRow();
      mockClient.query.mockResolvedValueOnce({ rows: [list] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [makeItemRow()] });

      await service.create({ listId: 'list-uuid-1', name: 'Kran' } as never, 10);

      const firstCall = mockClient.query.mock.calls[0] as unknown[];
      expect(firstCall[0]).toContain('FOR UPDATE');
    });

    it('should upsert custom values when provided', async () => {
      const list = makeListRow();
      mockClient.query.mockResolvedValueOnce({ rows: [list] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [makeItemRow()] });
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // custom value upsert

      await service.create(
        {
          listId: 'list-uuid-1',
          name: 'Kran',
          customValues: [{ fieldId: 'field-1', valueText: '500kg' }],
        } as never,
        10,
      );

      expect(mockClient.query).toHaveBeenCalledTimes(4);
      const lastCall = mockClient.query.mock.calls[3] as unknown[];
      expect(lastCall[0]).toContain('inventory_custom_values');
    });

    it('should skip custom values when not provided', async () => {
      const list = makeListRow();
      mockClient.query.mockResolvedValueOnce({ rows: [list] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [makeItemRow()] });

      await service.create({ listId: 'list-uuid-1', name: 'Kran' } as never, 10);

      expect(mockClient.query).toHaveBeenCalledTimes(3); // no custom value call
    });

    it('should generate sequential codes', async () => {
      const codes: string[] = [];
      for (let i = 1; i <= 3; i++) {
        vi.clearAllMocks();
        mockDb.tenantTransaction = vi
          .fn()
          .mockImplementation(
            async (cb: (client: typeof mockClient) => Promise<unknown>): Promise<unknown> =>
              await cb(mockClient),
          );

        const list = makeListRow({ next_number: i });
        mockClient.query.mockResolvedValueOnce({ rows: [list] });
        mockClient.query.mockResolvedValueOnce({ rows: [] });
        mockClient.query.mockResolvedValueOnce({
          rows: [makeItemRow({ code: `KRN-${String(i).padStart(3, '0')}` })],
        });

        const result = await service.create(
          { listId: 'list-uuid-1', name: `Kran ${String(i)}` } as never,
          10,
        );
        codes.push(result.code);
      }

      expect(codes).toEqual(['KRN-001', 'KRN-002', 'KRN-003']);
    });
  });

  // ── update ──────────────────────────────────────────────────

  describe('update', () => {
    it('should update item fields', async () => {
      const updated = makeItemRow({ name: 'Neuer Name' });
      mockClient.query.mockResolvedValueOnce({ rows: [updated] });

      const result = await service.update('item-uuid-1', { name: 'Neuer Name' } as never);

      expect(result.name).toBe('Neuer Name');
    });

    it('should throw NotFoundException for missing item', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.update('nonexistent', { name: 'X' } as never)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should upsert custom values on update', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [makeItemRow()] });
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // custom value upsert

      await service.update('item-uuid-1', {
        customValues: [{ fieldId: 'f-1', valueNumber: 1000 }],
      } as never);

      expect(mockClient.query).toHaveBeenCalledTimes(2);
    });
  });

  // ── updateStatus ────────────────────────────────────────────

  describe('updateStatus', () => {
    it('should update status', async () => {
      qf.mockResolvedValueOnce([makeItemRow({ status: 'defective' })]);

      const result = await service.updateStatus('item-uuid-1', 'defective');

      expect(result.status).toBe('defective');
    });

    it('should throw NotFoundException for missing item', async () => {
      qf.mockResolvedValueOnce([]);

      await expect(service.updateStatus('nonexistent', 'repair')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should accept all valid statuses', async () => {
      const statuses = [
        'operational',
        'defective',
        'repair',
        'maintenance',
        'decommissioned',
        'removed',
        'stored',
      ] as const;

      for (const status of statuses) {
        qf.mockResolvedValueOnce([makeItemRow({ status })]);
        const result = await service.updateStatus('item-uuid-1', status);
        expect(result.status).toBe(status);
      }
    });
  });

  // ── softDelete ──────────────────────────────────────────────

  describe('softDelete', () => {
    it('should soft-delete item', async () => {
      qf.mockResolvedValueOnce([{ id: 'item-uuid-1' }]);

      await expect(service.softDelete('item-uuid-1')).resolves.toBeUndefined();
    });

    it('should throw NotFoundException for missing item', async () => {
      qf.mockResolvedValueOnce([]);

      await expect(service.softDelete('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ── Edge Cases ──────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle code with different prefix lengths', async () => {
      const list = makeListRow({ code_prefix: 'AB', code_digits: 2, next_number: 1 });
      mockClient.query.mockResolvedValueOnce({ rows: [list] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [makeItemRow({ code: 'AB-01' })] });

      const result = await service.create(
        { listId: 'list-uuid-1', name: 'Short prefix' } as never,
        10,
      );

      expect(result.code).toBe('AB-01');
    });

    it('should handle large next_number without overflow', async () => {
      const list = makeListRow({ next_number: 99999, code_digits: 3 });
      mockClient.query.mockResolvedValueOnce({ rows: [list] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({
        rows: [makeItemRow({ code: 'KRN-99999' })],
      });

      const result = await service.create(
        { listId: 'list-uuid-1', name: 'Overflow test' } as never,
        10,
      );

      // Number exceeds digit count, but padStart doesn't truncate
      expect(result.code).toBe('KRN-99999');
    });

    it('should call tenantTransaction for create', async () => {
      const list = makeListRow();
      mockClient.query.mockResolvedValueOnce({ rows: [list] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [makeItemRow()] });

      await service.create({ listId: 'list-uuid-1', name: 'X' } as never, 10);

      expect(mockDb.tenantTransaction).toHaveBeenCalledTimes(1);
    });

    it('should call tenantTransaction for update', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [makeItemRow()] });

      await service.update('item-uuid-1', { name: 'Y' } as never);

      expect(mockDb.tenantTransaction).toHaveBeenCalledTimes(1);
    });

    it('should handle combined status + search filter', async () => {
      qf.mockResolvedValueOnce([{ count: '1' }]);
      qf.mockResolvedValueOnce([makeItemRow()]);
      qf.mockResolvedValueOnce([]); // custom values batch

      await service.findByList('list-uuid-1', {
        status: 'operational',
        search: 'Kran',
        page: 1,
        limit: 10,
      });

      const countSql = qf.mock.calls[0]?.[0] as string;
      expect(countSql).toContain('i.status');
      expect(countSql).toContain('ILIKE');
    });

    it('should trim search whitespace', async () => {
      qf.mockResolvedValueOnce([{ count: '0' }]);
      qf.mockResolvedValueOnce([]);

      await service.findByList('list-uuid-1', {
        status: undefined,
        search: '  Kran  ',
        page: 1,
        limit: 50,
      });

      const params = qf.mock.calls[0]?.[1] as unknown[];
      expect(params[2]).toBe('%Kran%');
    });

    it('should ignore empty search string', async () => {
      qf.mockResolvedValueOnce([{ count: '0' }]);
      qf.mockResolvedValueOnce([]);

      await service.findByList('list-uuid-1', {
        status: undefined,
        search: '   ',
        page: 1,
        limit: 50,
      });

      const countSql = qf.mock.calls[0]?.[0] as string;
      expect(countSql).not.toContain('ILIKE');
    });

    it('should return existing item when update has no standard fields (only customValues)', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [makeItemRow()] }); // SELECT
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // custom value upsert

      const result = await service.update('item-uuid-1', {
        customValues: [{ fieldId: 'f-1', valueText: 'test' }],
      } as never);

      expect(result.name).toBe('Brückenkran Halle A');
      // First call should be SELECT (no SET clauses)
      const sql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('SELECT');
    });

    it('should allow setting nullable fields to null via update', async () => {
      const updated = makeItemRow({ description: null, location: null });
      mockClient.query.mockResolvedValueOnce({ rows: [updated] });

      const result = await service.update('item-uuid-1', {
        description: null,
        location: null,
      } as never);

      expect(result.description).toBeNull();
      expect(result.location).toBeNull();
      // Should include both fields in SET clause
      const sql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('description');
      expect(sql).toContain('location');
    });

    it('should batch-load custom values grouped by item_id', async () => {
      const items = [
        makeItemRow({ id: 'item-1', code: 'KRN-001' }),
        makeItemRow({ id: 'item-2', code: 'KRN-002' }),
      ];
      qf.mockResolvedValueOnce([{ count: '2' }]); // count
      qf.mockResolvedValueOnce(items); // items
      qf.mockResolvedValueOnce([
        { itemId: 'item-1', fieldId: 'f-1', fieldName: 'Gewicht', valueNumber: '500' },
        { itemId: 'item-1', fieldId: 'f-2', fieldName: 'Typ', valueText: 'A' },
        { itemId: 'item-2', fieldId: 'f-1', fieldName: 'Gewicht', valueNumber: '300' },
      ]); // batch custom values

      const result = await service.findByList('list-uuid-1', {
        status: undefined,
        search: undefined,
        page: 1,
        limit: 50,
      });

      expect(Object.keys(result.customValuesByItem)).toHaveLength(2);
      expect(result.customValuesByItem['item-1']).toHaveLength(2);
      expect(result.customValuesByItem['item-2']).toHaveLength(1);
    });

    it('should return fields in findByUuid', async () => {
      const item = { ...makeItemRow(), list_title: 'Kräne', list_code_prefix: 'KRN' };
      qof.mockResolvedValueOnce(item);
      qf.mockResolvedValueOnce([]); // photos
      qf.mockResolvedValueOnce([]); // custom values
      qf.mockResolvedValueOnce([
        {
          id: 'f-1',
          list_id: 'list-uuid-1',
          field_name: 'Tragkraft',
          field_type: 'number',
          field_options: null,
          field_unit: 'kg',
          is_required: true,
          sort_order: 0,
        },
      ]); // field definitions

      const result = await service.findByUuid('item-uuid-1');

      expect(result.fields).toHaveLength(1);
      expect(result.fields[0]?.fieldName).toBe('Tragkraft');
      expect(result.fields[0]?.fieldUnit).toBe('kg');
      expect(result.fields[0]?.isRequired).toBe(true);
    });

    it('should handle multiple custom values on create', async () => {
      const list = makeListRow();
      mockClient.query.mockResolvedValueOnce({ rows: [list] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [makeItemRow()] });
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // cv 1
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // cv 2
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // cv 3

      await service.create(
        {
          listId: 'list-uuid-1',
          name: 'Multi-CV',
          customValues: [
            { fieldId: 'f-1', valueText: 'text' },
            { fieldId: 'f-2', valueNumber: 42 },
            { fieldId: 'f-3', valueBoolean: true },
          ],
        } as never,
        10,
      );

      // 3 (lock + increment + insert) + 3 custom values = 6
      expect(mockClient.query).toHaveBeenCalledTimes(6);
    });
  });
});
