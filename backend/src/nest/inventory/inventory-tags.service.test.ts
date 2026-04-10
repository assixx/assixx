import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { InventoryTagsService } from './inventory-tags.service.js';
import type { InventoryTagRow } from './inventory.types.js';

const qf = vi.fn();
const qof = vi.fn();
const tx = vi.fn();

function createMockDb() {
  return {
    query: qf,
    tenantQuery: qf,
    queryOne: qof,
    tenantQueryOne: qof,
    tenantTransaction: tx,
  };
}

function makeTagRow(overrides: Partial<InventoryTagRow> = {}): InventoryTagRow {
  return {
    id: 'tag-uuid-1',
    tenant_id: 1,
    name: 'Lastaufnahmemittel',
    icon: 'fa-anchor',
    created_by: 10,
    created_at: new Date('2026-04-08T10:00:00Z'),
    updated_at: new Date('2026-04-08T10:00:00Z'),
    ...overrides,
  };
}

describe('InventoryTagsService', () => {
  let service: InventoryTagsService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new InventoryTagsService(mockDb as unknown as DatabaseService);
  });

  // ── findAll ─────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return tags with usage counts', async () => {
      qf.mockResolvedValueOnce([
        { ...makeTagRow(), usage_count: '3' },
        { ...makeTagRow({ id: 'tag-2', name: 'Hebezeuge' }), usage_count: '0' },
      ]);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(result[0]?.name).toBe('Lastaufnahmemittel');
      expect(result[0]?.usageCount).toBe(3);
      expect(result[1]?.usageCount).toBe(0);
    });

    it('should return empty array when no tags exist', async () => {
      qf.mockResolvedValueOnce([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  // ── findById ────────────────────────────────────────────────

  describe('findById', () => {
    it('should return tag', async () => {
      qof.mockResolvedValueOnce(makeTagRow());

      const result = await service.findById('tag-uuid-1');

      expect(result.name).toBe('Lastaufnahmemittel');
      expect(result.icon).toBe('fa-anchor');
    });

    it('should throw NotFoundException for unknown id', async () => {
      qof.mockResolvedValueOnce(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ── create ──────────────────────────────────────────────────

  describe('create', () => {
    it('should create tag with name and icon', async () => {
      qf.mockResolvedValueOnce([makeTagRow()]);

      const result = await service.create({ name: 'Lastaufnahmemittel', icon: 'fa-anchor' }, 10);

      expect(result.name).toBe('Lastaufnahmemittel');
      expect(result.icon).toBe('fa-anchor');
      const params = qf.mock.calls[0]?.[1] as unknown[];
      expect(params[0]).toBe('Lastaufnahmemittel');
      expect(params[1]).toBe('fa-anchor');
      expect(params[2]).toBe(10);
    });

    it('should create tag without icon (null default)', async () => {
      qf.mockResolvedValueOnce([makeTagRow({ icon: null })]);

      const result = await service.create({ name: 'Werkzeug' }, 10);

      expect(result.icon).toBeNull();
      const params = qf.mock.calls[0]?.[1] as unknown[];
      expect(params[1]).toBeNull();
    });

    it('should map duplicate name violation to ConflictException', async () => {
      qf.mockRejectedValueOnce(
        new Error(
          'duplicate key value violates unique constraint "idx_inventory_tags_tenant_name_lower"',
        ),
      );

      let caught: unknown;
      try {
        await service.create({ name: 'Krane' }, 10);
      } catch (error: unknown) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(ConflictException);
      expect((caught as Error).message).toBe('Tag "Krane" existiert bereits');
    });

    it('should rethrow non-constraint errors', async () => {
      qf.mockRejectedValueOnce(new Error('connection terminated'));

      await expect(service.create({ name: 'X' }, 10)).rejects.toThrow('connection terminated');
    });
  });

  // ── getOrCreateByNames ──────────────────────────────────────

  describe('getOrCreateByNames', () => {
    it('should return empty array for empty input', async () => {
      const result = await service.getOrCreateByNames([], 10);

      expect(result).toEqual([]);
      expect(qf).not.toHaveBeenCalled();
    });

    it('should normalize whitespace and dedupe input', async () => {
      qf.mockResolvedValueOnce([]); // INSERT
      qf.mockResolvedValueOnce([makeTagRow()]); // SELECT

      await service.getOrCreateByNames(['  Krane  ', 'krane', 'Krane'], 10);

      const insertParams = qf.mock.calls[0]?.[1] as unknown[];
      // After normalization: ['Krane', 'krane'] (3 inputs reduce to 2 unique-by-trimmed)
      expect((insertParams[0] as string[]).length).toBe(2);
    });

    it('should filter out empty strings', async () => {
      qf.mockResolvedValueOnce([]);
      qf.mockResolvedValueOnce([]);

      const result = await service.getOrCreateByNames(['', '   ', 'Krane'], 10);

      const insertParams = qf.mock.calls[0]?.[1] as unknown[];
      expect(insertParams[0] as string[]).toEqual(['Krane']);
      expect(result).toEqual([]); // Mock returns empty
    });

    it('should INSERT then SELECT all matching tags', async () => {
      qf.mockResolvedValueOnce([]); // INSERT (ON CONFLICT DO NOTHING)
      qf.mockResolvedValueOnce([makeTagRow(), makeTagRow({ id: 'tag-2', name: 'Hebezeuge' })]);

      const result = await service.getOrCreateByNames(['Lastaufnahmemittel', 'Hebezeuge'], 10);

      expect(result).toHaveLength(2);
      expect(qf).toHaveBeenCalledTimes(2);
    });
  });

  // ── update ──────────────────────────────────────────────────

  describe('update', () => {
    it('should rename tag', async () => {
      qof.mockResolvedValueOnce(makeTagRow());
      qf.mockResolvedValueOnce([makeTagRow({ name: 'Hebezeug' })]);

      const result = await service.update('tag-uuid-1', { name: 'Hebezeug' });

      expect(result.name).toBe('Hebezeug');
    });

    it('should update icon only', async () => {
      qof.mockResolvedValueOnce(makeTagRow());
      qf.mockResolvedValueOnce([makeTagRow({ icon: 'fa-truck' })]);

      const result = await service.update('tag-uuid-1', { icon: 'fa-truck' });

      expect(result.icon).toBe('fa-truck');
    });

    it('should return existing when no fields to update', async () => {
      const existing = makeTagRow();
      qof.mockResolvedValueOnce(existing);

      const result = await service.update('tag-uuid-1', {});

      expect(result.name).toBe('Lastaufnahmemittel');
      expect(qf).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for unknown tag', async () => {
      qof.mockResolvedValueOnce(null);

      await expect(service.update('nonexistent', { name: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when UPDATE RETURNING is empty', async () => {
      qof.mockResolvedValueOnce(makeTagRow()); // existing found
      qf.mockResolvedValueOnce([]); // UPDATE returns empty (concurrent delete)

      await expect(service.update('tag-uuid-1', { name: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('should rethrow non-constraint errors on update', async () => {
      qof.mockResolvedValueOnce(makeTagRow());
      qf.mockRejectedValueOnce(new Error('connection terminated'));

      await expect(service.update('tag-uuid-1', { name: 'X' })).rejects.toThrow(
        'connection terminated',
      );
    });

    it('should update both name and icon together', async () => {
      qof.mockResolvedValueOnce(makeTagRow());
      qf.mockResolvedValueOnce([makeTagRow({ name: 'Neu', icon: 'fa-star' })]);

      const result = await service.update('tag-uuid-1', { name: 'Neu', icon: 'fa-star' });

      expect(result.name).toBe('Neu');
      expect(result.icon).toBe('fa-star');
      const sql = qf.mock.calls[0]?.[0] as string;
      expect(sql).toContain('name');
      expect(sql).toContain('icon');
    });

    it('should map duplicate-name on rename to ConflictException', async () => {
      qof.mockResolvedValueOnce(makeTagRow());
      qf.mockRejectedValueOnce(
        new Error(
          'duplicate key value violates unique constraint "idx_inventory_tags_tenant_name_lower"',
        ),
      );

      let caught: unknown;
      try {
        await service.update('tag-uuid-1', { name: 'Krane' });
      } catch (error: unknown) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(ConflictException);
    });
  });

  // ── delete ──────────────────────────────────────────────────

  describe('delete', () => {
    it('should hard-delete tag', async () => {
      qf.mockResolvedValueOnce([{ id: 'tag-uuid-1' }]);

      await expect(service.delete('tag-uuid-1')).resolves.toBeUndefined();
      const sql = qf.mock.calls[0]?.[0] as string;
      expect(sql).toContain('DELETE FROM inventory_tags');
    });

    it('should throw NotFoundException for unknown tag', async () => {
      qf.mockResolvedValueOnce([]);

      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ── replaceTagsForList ──────────────────────────────────────

  describe('replaceTagsForList', () => {
    it('should reject when tag count exceeds MAX_TAGS_PER_LIST', async () => {
      const tooMany = Array.from({ length: 11 }, (_, i): string => `tag-${String(i)}`);

      await expect(service.replaceTagsForList('list-1', tooMany)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject when supplied tag IDs do not all exist', async () => {
      qf.mockResolvedValueOnce([{ id: 'tag-1' }]); // Only 1 of 2 found

      await expect(service.replaceTagsForList('list-1', ['tag-1', 'tag-2'])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should run delete + insert in transaction', async () => {
      qf.mockResolvedValueOnce([{ id: 'tag-1' }, { id: 'tag-2' }]); // validation
      const clientQuery = vi.fn();
      tx.mockImplementationOnce(
        async (cb: (client: { query: typeof clientQuery }) => Promise<unknown>) => {
          await cb({ query: clientQuery });
        },
      );

      await service.replaceTagsForList('list-1', ['tag-1', 'tag-2']);

      expect(clientQuery).toHaveBeenCalledTimes(2);
      expect(clientQuery.mock.calls[0]?.[0] as string).toContain('DELETE FROM inventory_list_tags');
      expect(clientQuery.mock.calls[1]?.[0] as string).toContain('INSERT INTO inventory_list_tags');
    });

    it('should only run delete (no insert) when tagIds is empty', async () => {
      const clientQuery = vi.fn();
      tx.mockImplementationOnce(
        async (cb: (client: { query: typeof clientQuery }) => Promise<unknown>) => {
          await cb({ query: clientQuery });
        },
      );

      await service.replaceTagsForList('list-1', []);

      expect(clientQuery).toHaveBeenCalledTimes(1);
      expect(clientQuery.mock.calls[0]?.[0] as string).toContain('DELETE');
    });

    it('should dedupe tagIds before validation', async () => {
      qf.mockResolvedValueOnce([{ id: 'tag-1' }]); // Only 1 unique tag, validation passes
      const clientQuery = vi.fn();
      tx.mockImplementationOnce(
        async (cb: (client: { query: typeof clientQuery }) => Promise<unknown>) => {
          await cb({ query: clientQuery });
        },
      );

      await service.replaceTagsForList('list-1', ['tag-1', 'tag-1', 'tag-1']);

      const validationParams = qf.mock.calls[0]?.[1] as unknown[];
      expect((validationParams[0] as string[]).length).toBe(1);
    });
  });
});
