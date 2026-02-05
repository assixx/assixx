/**
 * Unit tests for NotificationPreferencesService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: Get preferences (default fallback, JSON parsing),
 *        upsert (existing update vs new insert).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { NotificationPreferencesService } from './notification-preferences.service.js';

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return { query: vi.fn() };
}

// =============================================================
// NotificationPreferencesService
// =============================================================

describe('NotificationPreferencesService', () => {
  let service: NotificationPreferencesService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new NotificationPreferencesService(
      mockDb as unknown as DatabaseService,
    );
  });

  // =============================================================
  // getPreferences
  // =============================================================

  describe('getPreferences', () => {
    it('should return defaults when no preferences exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getPreferences(5, 10);

      expect(result.emailNotifications).toBe(true);
      expect(result.pushNotifications).toBe(true);
      expect(result.smsNotifications).toBe(false);
    });

    it('should return stored preferences', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          email_notifications: 0,
          push_notifications: 1,
          sms_notifications: 1,
          preferences: JSON.stringify({
            system: { email: false, push: true, sms: true },
          }),
        },
      ]);

      const result = await service.getPreferences(5, 10);

      expect(result.emailNotifications).toBe(false);
      expect(result.pushNotifications).toBe(true);
      expect(result.smsNotifications).toBe(true);
    });

    it('should handle null preferences JSON', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          email_notifications: 1,
          push_notifications: 1,
          sms_notifications: 0,
          preferences: null,
        },
      ]);

      const result = await service.getPreferences(5, 10);

      expect(result.notificationTypes).toEqual({});
    });

    it('should handle already-parsed preferences object', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          email_notifications: 1,
          push_notifications: 1,
          sms_notifications: 0,
          preferences: { task: { email: true, push: true, sms: false } },
        },
      ]);

      const result = await service.getPreferences(5, 10);

      expect(result.notificationTypes).toHaveProperty('task');
    });
  });

  // =============================================================
  // upsertPreferences
  // =============================================================

  describe('upsertPreferences', () => {
    it('should update existing preferences', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);
      mockDb.query.mockResolvedValueOnce([]);

      await service.upsertPreferences(5, 10, true, false, false, '{}');

      expect(mockDb.query).toHaveBeenCalledTimes(2);
      const updateCall = mockDb.query.mock.calls[1];
      expect(updateCall?.[0]).toContain('UPDATE');
    });

    it('should insert new preferences', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);

      await service.upsertPreferences(5, 10, true, true, false, '{}');

      expect(mockDb.query).toHaveBeenCalledTimes(2);
      const insertCall = mockDb.query.mock.calls[1];
      expect(insertCall?.[0]).toContain('INSERT');
    });
  });
});
