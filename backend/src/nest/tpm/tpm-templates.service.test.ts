/**
 * Unit tests for TpmTemplatesService
 *
 * Mocked dependencies: DatabaseService (query, queryOne, tenantTransaction).
 * Tests: listTemplates (ordering), getTemplate (NotFoundException),
 * createTemplate (JSONB stringify), updateTemplate (dynamic SET, FOR UPDATE lock),
 * deleteTemplate (soft-delete).
 */
import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { TpmTemplatesService } from './tpm-templates.service.js';
import type { TpmCardTemplateRow } from './tpm.types.js';

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return {
    query: vi.fn(),
    queryOne: vi.fn(),
    tenantTransaction: vi.fn(),
  };
}
type MockDb = ReturnType<typeof createMockDb>;

function createTemplateRow(
  overrides?: Partial<TpmCardTemplateRow>,
): TpmCardTemplateRow {
  return {
    id: 1,
    uuid: 'tpl-uuid-001                           ',
    tenant_id: 10,
    name: 'Standard-Prüfung',
    description: 'Allgemeine Wartungsprüfung',
    default_fields: { checkOil: true, checkPressure: true },
    is_default: false,
    is_active: 1,
    created_at: '2026-02-18T00:00:00.000Z',
    updated_at: '2026-02-18T00:00:00.000Z',
    ...overrides,
  };
}

// =============================================================
// TpmTemplatesService
// =============================================================

describe('TpmTemplatesService', () => {
  let service: TpmTemplatesService;
  let mockDb: MockDb;
  let mockClient: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockClient = { query: vi.fn() };

    mockDb.tenantTransaction.mockImplementation(
      async (callback: (client: typeof mockClient) => Promise<unknown>) => {
        return await callback(mockClient);
      },
    );

    service = new TpmTemplatesService(mockDb as unknown as DatabaseService);
  });

  // =============================================================
  // listTemplates
  // =============================================================

  describe('listTemplates()', () => {
    it('should return mapped templates', async () => {
      mockDb.query.mockResolvedValueOnce([
        createTemplateRow({ is_default: true, name: 'Default' }),
        createTemplateRow({ id: 2, name: 'Custom A' }),
      ]);

      const result = await service.listTemplates(10);

      expect(result).toHaveLength(2);
      expect(result[0]?.name).toBe('Default');
      expect(result[0]?.isDefault).toBe(true);
    });

    it('should return empty array when no templates exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.listTemplates(10);

      expect(result).toHaveLength(0);
    });
  });

  // =============================================================
  // getTemplate
  // =============================================================

  describe('getTemplate()', () => {
    it('should return a single mapped template', async () => {
      mockDb.queryOne.mockResolvedValueOnce(createTemplateRow());

      const result = await service.getTemplate(10, 'tpl-uuid-001');

      expect(result.name).toBe('Standard-Prüfung');
      expect(result.defaultFields).toEqual({
        checkOil: true,
        checkPressure: true,
      });
    });

    it('should throw NotFoundException when template not found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      await expect(service.getTemplate(10, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =============================================================
  // createTemplate
  // =============================================================

  describe('createTemplate()', () => {
    it('should create a template with JSON.stringify for defaultFields', async () => {
      const fields = { checkOil: true, checkTemp: false };
      mockClient.query.mockResolvedValueOnce({
        rows: [createTemplateRow({ default_fields: fields })],
      });

      const result = await service.createTemplate(10, {
        name: 'New Template',
        defaultFields: fields,
        isDefault: false,
      });

      expect(result.name).toBe('Standard-Prüfung');
      expect(result.defaultFields).toEqual(fields);

      // Verify JSON.stringify was applied to the JSONB param
      const params = mockClient.query.mock.calls[0]?.[1] as unknown[];
      const jsonParam = params?.find(
        (p: unknown) => typeof p === 'string' && p.includes('checkOil'),
      );
      expect(jsonParam).toBe(JSON.stringify(fields));
    });

    it('should handle null description', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createTemplateRow({ description: null })],
      });

      const result = await service.createTemplate(10, {
        name: 'Minimal Template',
        defaultFields: {},
        isDefault: false,
      });

      expect(result.description).toBeNull();
    });

    it('should throw when INSERT returns no rows', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.createTemplate(10, {
          name: 'Test',
          defaultFields: {},
          isDefault: false,
        }),
      ).rejects.toThrow('INSERT into tpm_card_templates returned no rows');
    });
  });

  // =============================================================
  // updateTemplate
  // =============================================================

  describe('updateTemplate()', () => {
    it('should update with provided fields', async () => {
      // FOR UPDATE lock
      mockClient.query.mockResolvedValueOnce({
        rows: [createTemplateRow()],
      });
      // UPDATE RETURNING
      mockClient.query.mockResolvedValueOnce({
        rows: [createTemplateRow({ name: 'Updated Name' })],
      });

      const result = await service.updateTemplate(10, 'tpl-uuid-001', {
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
    });

    it('should return existing template when no fields provided', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createTemplateRow()],
      });

      const result = await service.updateTemplate(10, 'tpl-uuid-001', {});

      expect(result.name).toBe('Standard-Prüfung');
      // Only the lock query should have been called
      expect(mockClient.query).toHaveBeenCalledTimes(1);
    });

    it('should use FOR UPDATE lock to prevent race conditions', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createTemplateRow()],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [createTemplateRow({ name: 'Updated' })],
      });

      await service.updateTemplate(10, 'tpl-uuid-001', { name: 'Updated' });

      const lockSql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(lockSql).toContain('FOR UPDATE');
    });

    it('should throw NotFoundException when template not found for update', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.updateTemplate(10, 'nonexistent', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should stringify defaultFields in update', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createTemplateRow()],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [createTemplateRow()],
      });

      const fields = { newField: 'value' };
      await service.updateTemplate(10, 'tpl-uuid-001', {
        defaultFields: fields,
      });

      const updateParams = mockClient.query.mock.calls[1]?.[1] as unknown[];
      expect(updateParams).toContain(JSON.stringify(fields));
    });
  });

  // =============================================================
  // deleteTemplate
  // =============================================================

  describe('deleteTemplate()', () => {
    it('should soft-delete a template (is_active = 4)', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 1 }],
      });

      await expect(
        service.deleteTemplate(10, 'tpl-uuid-001'),
      ).resolves.toBeUndefined();

      const sql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('is_active = 4');
    });

    it('should throw NotFoundException when template not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.deleteTemplate(10, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
