import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { InventoryListsService } from './inventory-lists.service.js';
import type { InventoryTagsService } from './inventory-tags.service.js';
import type { InventoryListRow } from './inventory.types.js';

// ── Mock Factories ──────────────────────────────────────────────

const qf = vi.fn();
const qof = vi.fn();
const replaceTagsForListMock = vi.fn();

function createMockDb() {
  return {
    query: qf,
    tenantQuery: qf,
    queryOne: qof,
    tenantQueryOne: qof,
    tenantTransaction: vi.fn(),
  };
}

function createMockTagsService() {
  return {
    replaceTagsForList: replaceTagsForListMock,
  };
}

function makeListRow(overrides: Partial<InventoryListRow> = {}): InventoryListRow {
  return {
    id: 'list-uuid-1',
    tenant_id: 1,
    title: 'Kräne',
    description: 'Brückenkräne und Portalkräne',
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
  let mockTags: ReturnType<typeof createMockTagsService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockTags = createMockTagsService();
    service = new InventoryListsService(
      mockDb as unknown as DatabaseService,
      mockTags as unknown as InventoryTagsService,
    );
  });

  // ── findAll ─────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return lists with status counts and empty tags', async () => {
      qf.mockResolvedValueOnce([{ ...makeListRow(), total_items: '5' }]); // lists
      qf.mockResolvedValueOnce([
        { list_id: 'list-uuid-1', status: 'operational', count: '3' },
        { list_id: 'list-uuid-1', status: 'defective', count: '2' },
      ]); // status counts
      qf.mockResolvedValueOnce([]); // tags

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0]?.totalItems).toBe(5);
      expect(result[0]?.statusCounts.operational).toBe(3);
      expect(result[0]?.statusCounts.defective).toBe(2);
      expect(result[0]?.statusCounts.repair).toBe(0);
      expect(result[0]?.tags).toEqual([]);
    });

    it('should return empty array when no lists exist', async () => {
      qf.mockResolvedValueOnce([]);

      const result = await service.findAll();

      expect(result).toHaveLength(0);
    });

    it('should attach tags to the matching list', async () => {
      qf.mockResolvedValueOnce([{ ...makeListRow(), total_items: '0' }]);
      qf.mockResolvedValueOnce([]); // status counts
      qf.mockResolvedValueOnce([
        {
          list_id: 'list-uuid-1',
          id: 'tag-1',
          tenant_id: 1,
          name: 'Lastaufnahmemittel',
          icon: 'fa-anchor',
          created_by: 10,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]); // tags

      const result = await service.findAll();

      expect(result[0]?.tags).toHaveLength(1);
      expect(result[0]?.tags[0]?.name).toBe('Lastaufnahmemittel');
      expect(result[0]?.tags[0]?.icon).toBe('fa-anchor');
    });

    it('should pass tagIds filter to the SQL when provided', async () => {
      qf.mockResolvedValueOnce([]);

      await service.findAll({ tagIds: ['tag-uuid-a', 'tag-uuid-b'] });

      const sql = qf.mock.calls[0]?.[0] as string;
      const params = qf.mock.calls[0]?.[1] as unknown[];
      expect(sql).toContain('EXISTS');
      expect(sql).toContain('inventory_list_tags');
      expect(params[1]).toEqual(['tag-uuid-a', 'tag-uuid-b']);
    });

    it('should NOT add EXISTS clause when tagIds is empty', async () => {
      qf.mockResolvedValueOnce([]);

      await service.findAll({ tagIds: [] });

      const sql = qf.mock.calls[0]?.[0] as string;
      expect(sql).not.toContain('EXISTS');
    });

    it('should map snake_case to camelCase', async () => {
      qf.mockResolvedValueOnce([{ ...makeListRow(), total_items: '0' }]);
      qf.mockResolvedValueOnce([]);
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
      qf.mockResolvedValueOnce([{ status: 'operational', count: '3' }]); // status counts
      qf.mockResolvedValueOnce([]); // tags
      qf.mockResolvedValueOnce([{ id: 'field-1', field_name: 'Tragkraft' }]); // fields

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
    it('should create a list and return it with tags', async () => {
      const created = makeListRow();
      qf.mockResolvedValueOnce([created]); // INSERT
      qf.mockResolvedValueOnce([]); // tag fetch after insert

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
      expect(result.codePrefix).toBe('KRN');
      expect(result.tags).toEqual([]);
      expect(replaceTagsForListMock).not.toHaveBeenCalled();
    });

    it('should pass all fields to INSERT', async () => {
      qf.mockResolvedValueOnce([makeListRow()]);
      qf.mockResolvedValueOnce([]); // tag fetch

      await service.create(
        {
          title: 'Hubtische',
          description: 'Alle Hubtische',
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
      expect(callParams[2]).toBe('HBT'); // codePrefix moved to position 3 after category removal
      expect(callParams[3]).toBe('-');
      expect(callParams[4]).toBe(4);
    });

    it('should call replaceTagsForList when tagIds provided', async () => {
      qf.mockResolvedValueOnce([makeListRow()]);
      qf.mockResolvedValueOnce([]); // tag fetch
      replaceTagsForListMock.mockResolvedValueOnce(undefined);

      await service.create(
        {
          title: 'Kräne',
          codePrefix: 'KRN',
          codeSeparator: '-',
          codeDigits: 3,
          tagIds: ['tag-1', 'tag-2'],
        } as never,
        10,
      );

      expect(replaceTagsForListMock).toHaveBeenCalledWith('list-uuid-1', ['tag-1', 'tag-2']);
    });

    it('should NOT call replaceTagsForList when tagIds is empty array', async () => {
      qf.mockResolvedValueOnce([makeListRow()]);
      qf.mockResolvedValueOnce([]); // tag fetch

      await service.create(
        {
          title: 'Kräne',
          codePrefix: 'KRN',
          codeSeparator: '-',
          codeDigits: 3,
          tagIds: [],
        } as never,
        10,
      );

      expect(replaceTagsForListMock).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when prefix is already used (unique_violation)', async () => {
      // Simulate the raw PostgreSQL unique_violation that fires when the
      // idx_inventory_lists_unique_prefix partial index rejects a duplicate.
      // Without the catch block this would bubble up as a 500 via the
      // AllExceptionsFilter instead of a clean 409.
      qf.mockRejectedValueOnce(
        new Error(
          'duplicate key value violates unique constraint "idx_inventory_lists_unique_prefix"',
        ),
      );

      let caught: unknown;
      try {
        await service.create(
          {
            title: 'Kräne 2',
            codePrefix: 'KRN',
            codeSeparator: '-',
            codeDigits: 3,
          } as never,
          10,
        );
      } catch (error: unknown) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(ConflictException);
      expect((caught as Error).message).toBe('Kürzel "KRN" wird bereits verwendet');
    });

    it('should rethrow non-constraint errors unchanged', async () => {
      // Generic DB error (connection lost, syntax error, etc.) must NOT be
      // silently converted to ConflictException — only the specific unique
      // violation on idx_inventory_lists_unique_prefix gets mapped.
      const genericError = new Error('connection terminated unexpectedly');
      qf.mockRejectedValueOnce(genericError);

      await expect(
        service.create(
          {
            title: 'Kräne',
            codePrefix: 'KRN',
            codeSeparator: '-',
            codeDigits: 3,
          } as never,
          10,
        ),
      ).rejects.toThrow('connection terminated unexpectedly');
    });
  });

  // ── update ──────────────────────────────────────────────────

  describe('update', () => {
    it('should update list fields and return with tags', async () => {
      qof.mockResolvedValueOnce(makeListRow()); // existing check
      qf.mockResolvedValueOnce([makeListRow({ title: 'Neuer Titel' })]); // UPDATE
      qf.mockResolvedValueOnce([]); // tag fetch

      const result = await service.update('list-uuid-1', { title: 'Neuer Titel' } as never);

      expect(result.title).toBe('Neuer Titel');
      expect(result.tags).toEqual([]);
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
      qf.mockResolvedValueOnce([makeListRow({ code_prefix: 'HBT' })]); // UPDATE
      qf.mockResolvedValueOnce([]); // tag fetch

      const result = await service.update('list-uuid-1', { codePrefix: 'HBT' } as never);

      expect(result.codePrefix).toBe('HBT');
    });

    it('should call replaceTagsForList when tagIds provided in update', async () => {
      qof.mockResolvedValueOnce(makeListRow());
      qf.mockResolvedValueOnce([makeListRow({ title: 'Neuer Titel' })]); // UPDATE
      qf.mockResolvedValueOnce([]); // tag fetch
      replaceTagsForListMock.mockResolvedValueOnce(undefined);

      await service.update('list-uuid-1', {
        title: 'Neuer Titel',
        tagIds: ['tag-a'],
      } as never);

      expect(replaceTagsForListMock).toHaveBeenCalledWith('list-uuid-1', ['tag-a']);
    });

    it('should call replaceTagsForList with empty array to clear tags', async () => {
      qof.mockResolvedValueOnce(makeListRow());
      qf.mockResolvedValueOnce([]); // tag fetch (no SET clauses, no UPDATE)
      replaceTagsForListMock.mockResolvedValueOnce(undefined);

      await service.update('list-uuid-1', { tagIds: [] } as never);

      expect(replaceTagsForListMock).toHaveBeenCalledWith('list-uuid-1', []);
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
      qf.mockResolvedValueOnce([]); // tags

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(result[0]?.statusCounts.operational).toBe(3);
      expect(result[1]?.statusCounts.operational).toBe(5);
      expect(result[1]?.statusCounts.defective).toBe(2);
    });

    it('should return all 7 status counts initialized to 0', async () => {
      qf.mockResolvedValueOnce([{ ...makeListRow(), total_items: '0' }]);
      qf.mockResolvedValueOnce([]);
      qf.mockResolvedValueOnce([]); // tags

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
      qf.mockResolvedValueOnce([]); // tag fetch

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

    it('should return existing list when update has no changed fields and no tagIds', async () => {
      const existing = makeListRow();
      qof.mockResolvedValueOnce(existing); // existing check
      qf.mockResolvedValueOnce([]); // tag fetch (still happens for response building)

      const result = await service.update('list-uuid-1', {} as never);

      expect(result.title).toBe('Kräne');
      // Only the tag-fetch query — no UPDATE
      expect(qf).toHaveBeenCalledTimes(1);
    });

    it('should map fields to camelCase in findById', async () => {
      qof.mockResolvedValueOnce({ ...makeListRow(), total_items: '0' });
      qf.mockResolvedValueOnce([]); // status counts
      qf.mockResolvedValueOnce([]); // tags
      qf.mockResolvedValueOnce([
        {
          id: 'f-1',
          tenant_id: 1,
          list_id: 'list-uuid-1',
          field_name: 'Tragkraft',
          field_type: 'number',
          field_options: null,
          field_unit: 'kg',
          is_required: true,
          sort_order: 0,
          is_active: 1,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]); // fields

      const result = await service.findById('list-uuid-1');

      expect(result.fields).toHaveLength(1);
      expect(result.fields[0]?.fieldName).toBe('Tragkraft');
      expect(result.fields[0]?.fieldType).toBe('number');
      expect(result.fields[0]?.fieldUnit).toBe('kg');
      expect(result.fields[0]?.isRequired).toBe(true);
      expect(result.fields[0]?.sortOrder).toBe(0);
    });
  });
});
