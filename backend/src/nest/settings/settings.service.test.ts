/**
 * Settings Service – Unit Tests
 *
 * Tests for pure helper methods + public getCategories.
 * Private methods tested via bracket notation.
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import { SettingsService } from './settings.service.js';

// ============================================================
// Setup
// ============================================================

function createMockActivityLogger() {
  return {
    log: vi.fn(),
    logCreate: vi.fn(),
    logUpdate: vi.fn(),
    logDelete: vi.fn(),
  };
}

function createServiceWithMock(): {
  service: SettingsService;
  mockDb: { query: ReturnType<typeof vi.fn>; tenantQuery: ReturnType<typeof vi.fn> };
} {
  const queryFn = vi.fn();
  const mockDb = { query: queryFn, tenantQuery: queryFn };
  const mockActivityLogger = createMockActivityLogger();
  const service = new SettingsService(
    mockDb as unknown as DatabaseService,
    mockActivityLogger as unknown as ActivityLoggerService,
  );
  return { service, mockDb };
}

// ============================================================
// Pure Helper Methods
// ============================================================

describe('SettingsService – pure helpers', () => {
  let service: SettingsService;

  beforeEach(() => {
    const result = createServiceWithMock();
    service = result.service;
  });

  describe('getCategories', () => {
    it('returns all 7 setting categories', () => {
      const categories = service.getCategories();

      expect(categories).toHaveLength(7);
      const keys = categories.map((c) => c.key);
      expect(keys).toEqual([
        'general',
        'appearance',
        'notifications',
        'security',
        'workflow',
        'integration',
        'other',
      ]);
    });

    it('each category has key, label, and description', () => {
      const categories = service.getCategories();

      for (const cat of categories) {
        expect(cat.key).toBeTruthy();
        expect(cat.label).toBeTruthy();
        expect(cat.description).toBeTruthy();
      }
    });
  });

  describe('parseValue', () => {
    it('returns null for null input', () => {
      expect(service['parseValue'](null, 'string')).toBeNull();
    });

    it('parses boolean values', () => {
      expect(service['parseValue']('true', 'boolean')).toBe(true);
      expect(service['parseValue']('1', 'boolean')).toBe(true);
      expect(service['parseValue']('false', 'boolean')).toBe(false);
      expect(service['parseValue']('0', 'boolean')).toBe(false);
    });

    it('parses number values', () => {
      expect(service['parseValue']('42', 'number')).toBe(42);
      expect(service['parseValue']('3.14', 'number')).toBeCloseTo(3.14);
    });

    it('parses JSON values', () => {
      const json = '{"key":"value"}';
      const result = service['parseValue'](json, 'json');
      expect(result).toEqual({ key: 'value' });
    });

    it('returns empty object for invalid JSON', () => {
      const result = service['parseValue']('not-json', 'json');
      expect(result).toEqual({});
    });

    it('returns string as-is for string type', () => {
      expect(service['parseValue']('hello', 'string')).toBe('hello');
    });
  });

  describe('serializeValue', () => {
    it('returns empty string for null', () => {
      expect(service['serializeValue'](null, 'string')).toBe('');
    });

    it('serializes boolean values', () => {
      expect(service['serializeValue'](true, 'boolean')).toBe('true');
      expect(service['serializeValue'](false, 'boolean')).toBe('false');
    });

    it('serializes number values', () => {
      expect(service['serializeValue'](42, 'number')).toBe('42');
      expect(service['serializeValue']('99', 'number')).toBe('99');
    });

    it('serializes JSON values', () => {
      const result = service['serializeValue']({ key: 'value' }, 'json');
      expect(result).toBe('{"key":"value"}');
    });

    it('serializes string values', () => {
      expect(service['serializeValue']('hello', 'string')).toBe('hello');
    });
  });

  describe('serializeBooleanValue', () => {
    it('handles boolean type', () => {
      expect(service['serializeBooleanValue'](true)).toBe('true');
      expect(service['serializeBooleanValue'](false)).toBe('false');
    });

    it('handles string type', () => {
      expect(service['serializeBooleanValue']('false')).toBe('false');
      expect(service['serializeBooleanValue']('0')).toBe('false');
      expect(service['serializeBooleanValue']('')).toBe('false');
      expect(service['serializeBooleanValue']('truthy')).toBe('true');
    });

    it('handles number type', () => {
      expect(service['serializeBooleanValue'](1)).toBe('true');
      expect(service['serializeBooleanValue'](0)).toBe('false');
    });

    it('handles object type as truthy', () => {
      expect(service['serializeBooleanValue']({ key: 'val' })).toBe('true');
    });
  });

  describe('serializeNumberValue', () => {
    it('converts number to string', () => {
      expect(service['serializeNumberValue'](42)).toBe('42');
    });

    it('passes string through', () => {
      expect(service['serializeNumberValue']('99')).toBe('99');
    });

    it('returns 0 for other types', () => {
      expect(service['serializeNumberValue'](true)).toBe('0');
    });
  });

  describe('serializeStringValue', () => {
    it('returns string as-is', () => {
      expect(service['serializeStringValue']('hello')).toBe('hello');
    });

    it('JSON-stringifies non-string values', () => {
      expect(service['serializeStringValue'](42)).toBe('42');
      expect(service['serializeStringValue']({ a: 1 })).toBe('{"a":1}');
    });
  });

  describe('mapSystemSetting', () => {
    it('maps DB row to API response format', () => {
      const row = {
        id: 1,
        setting_key: 'app.theme',
        setting_value: 'dark',
        value_type: 'string',
        category: 'appearance',
        description: 'App theme',
        is_public: true,
        created_at: new Date('2025-01-01T00:00:00Z'),
        updated_at: new Date('2025-06-01T00:00:00Z'),
      };

      const result = service['mapSystemSetting'](row);

      expect(result.settingKey).toBe('app.theme');
      expect(result.settingValue).toBe('dark');
      expect(result.valueType).toBe('string');
      expect(result.category).toBe('appearance');
      expect(result.description).toBe('App theme');
      expect(result.isPublic).toBe(true);
      expect(result.createdAt).toBe('2025-01-01T00:00:00.000Z');
      expect(result.updatedAt).toBe('2025-06-01T00:00:00.000Z');
    });

    it('handles null category and description', () => {
      const row = {
        id: 1,
        setting_key: 'test',
        setting_value: null,
        value_type: 'string',
        category: null,
        description: null,
        is_public: false,
        created_at: null,
        updated_at: null,
      };

      const result = service['mapSystemSetting'](row);

      expect(result.settingValue).toBeNull();
      expect(result.category).toBeUndefined();
      expect(result.description).toBeUndefined();
      expect(result.createdAt).toBeUndefined();
      expect(result.updatedAt).toBeUndefined();
    });
  });
});

// ============================================================
// DB-Mocked Methods
// ============================================================

describe('SettingsService – DB-mocked methods', () => {
  let service: SettingsService;
  let mockDb: { query: ReturnType<typeof vi.fn>; tenantQuery: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    const result = createServiceWithMock();
    service = result.service;
    mockDb = result.mockDb;
  });

  describe('getSystemSettings', () => {
    it('throws ForbiddenException for non-root users', async () => {
      await expect(service.getSystemSettings({}, 'admin')).rejects.toThrow(ForbiddenException);
    });

    it('returns parsed settings for root user', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          setting_key: 'app.name',
          setting_value: 'Assixx',
          value_type: 'string',
          category: 'general',
          description: null,
          is_public: true,
          created_at: new Date('2025-01-01'),
          updated_at: null,
        },
      ]);

      const result = await service.getSystemSettings({}, 'root');

      expect(result).toHaveLength(1);
      expect(result[0]?.settingKey).toBe('app.name');
      expect(result[0]?.settingValue).toBe('Assixx');
    });
  });

  describe('getSystemSetting', () => {
    it('throws NotFoundException when setting does not exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.getSystemSetting('missing.key', 'root')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException for non-admin on private setting', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          setting_key: 'secret.key',
          setting_value: 'hidden',
          value_type: 'string',
          category: null,
          description: null,
          is_public: false,
          created_at: null,
          updated_at: null,
        },
      ]);

      await expect(service.getSystemSetting('secret.key', 'employee')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getTenantSetting', () => {
    it('throws NotFoundException when setting does not exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.getTenantSetting('missing.key', 1)).rejects.toThrow(NotFoundException);
    });

    it('returns parsed tenant setting', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          tenant_id: 1,
          setting_key: 'tenant.theme',
          setting_value: 'light',
          value_type: 'string',
          category: 'appearance',
          created_at: new Date('2025-01-01'),
          updated_at: null,
        },
      ]);

      const result = await service.getTenantSetting('tenant.theme', 1);

      expect(result.settingKey).toBe('tenant.theme');
      expect(result.settingValue).toBe('light');
    });
  });

  describe('deleteUserSetting', () => {
    it('throws NotFoundException when setting does not exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.deleteUserSetting('missing.key', 1)).rejects.toThrow(NotFoundException);
    });

    it('deletes existing setting', async () => {
      mockDb.query
        .mockResolvedValueOnce([{ id: 1 }]) // SELECT check
        .mockResolvedValueOnce([]); // DELETE

      const result = await service.deleteUserSetting('test.key', 1);

      expect(result.success).toBe(true);
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('upsertSystemSetting', () => {
    it('throws ForbiddenException for non-root', async () => {
      await expect(
        service.upsertSystemSetting({ setting_key: 'test', setting_value: 'val' }, 1, 1, 'admin'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteSystemSetting', () => {
    it('throws ForbiddenException for non-root', async () => {
      await expect(service.deleteSystemSetting('test', 1, 1, 'admin')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('upsertTenantSetting', () => {
    it('throws ForbiddenException for employee role', async () => {
      await expect(
        service.upsertTenantSetting(
          { setting_key: 'test', setting_value: 'val' },
          1,
          1,
          'employee',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteTenantSetting', () => {
    it('throws ForbiddenException for employee role', async () => {
      await expect(service.deleteTenantSetting('test', 1, 1, 'employee')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getAdminUserSettings', () => {
    it('throws ForbiddenException for employee role', async () => {
      await expect(service.getAdminUserSettings(1, 1, 'employee')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException for inactive user', async () => {
      mockDb.query.mockResolvedValueOnce([]); // no active user

      await expect(service.getAdminUserSettings(999, 1, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
