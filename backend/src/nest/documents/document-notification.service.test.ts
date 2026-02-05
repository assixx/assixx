/**
 * Unit tests for DocumentNotificationService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: createUploadNotification delegation (fire-and-forget),
 *        mapAccessScopeToRecipient pure switch (all branches).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NotificationsService } from '../notifications/notifications.service.js';
import { DocumentNotificationService } from './document-notification.service.js';

// =============================================================
// Mock factories
// =============================================================

function createMockNotifications() {
  return { createFeatureNotification: vi.fn().mockResolvedValue(undefined) };
}

function makeDocInput(overrides: Record<string, unknown> = {}) {
  return {
    originalName: 'report.pdf',
    category: 'Allgemein',
    accessScope: 'company' as const,
    ownerUserId: undefined,
    targetTeamId: undefined,
    targetDepartmentId: undefined,
    ...overrides,
  };
}

// =============================================================
// DocumentNotificationService
// =============================================================

describe('DocumentNotificationService', () => {
  let service: DocumentNotificationService;
  let mockNotifications: ReturnType<typeof createMockNotifications>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNotifications = createMockNotifications();
    service = new DocumentNotificationService(
      mockNotifications as unknown as NotificationsService,
    );
  });

  // =============================================================
  // mapAccessScopeToRecipient (pure function)
  // =============================================================

  describe('mapAccessScopeToRecipient', () => {
    it('should return user for personal scope', () => {
      const data = makeDocInput({ accessScope: 'personal', ownerUserId: 42 });

      const result = service.mapAccessScopeToRecipient(data as never);

      expect(result).toEqual({ type: 'user', id: 42 });
    });

    it('should return null for personal scope without ownerUserId', () => {
      const data = makeDocInput({ accessScope: 'personal' });

      const result = service.mapAccessScopeToRecipient(data as never);

      expect(result).toBeNull();
    });

    it('should return team for team scope', () => {
      const data = makeDocInput({ accessScope: 'team', targetTeamId: 7 });

      const result = service.mapAccessScopeToRecipient(data as never);

      expect(result).toEqual({ type: 'team', id: 7 });
    });

    it('should return null for team scope without targetTeamId', () => {
      const data = makeDocInput({ accessScope: 'team' });

      const result = service.mapAccessScopeToRecipient(data as never);

      expect(result).toBeNull();
    });

    it('should return department for department scope', () => {
      const data = makeDocInput({
        accessScope: 'department',
        targetDepartmentId: 3,
      });

      const result = service.mapAccessScopeToRecipient(data as never);

      expect(result).toEqual({ type: 'department', id: 3 });
    });

    it('should return null for department scope without targetDepartmentId', () => {
      const data = makeDocInput({ accessScope: 'department' });

      const result = service.mapAccessScopeToRecipient(data as never);

      expect(result).toBeNull();
    });

    it('should return all for company scope', () => {
      const data = makeDocInput({ accessScope: 'company' });

      const result = service.mapAccessScopeToRecipient(data as never);

      expect(result).toEqual({ type: 'all', id: null });
    });

    it('should return null for payroll scope', () => {
      const data = makeDocInput({ accessScope: 'payroll' });

      const result = service.mapAccessScopeToRecipient(data as never);

      expect(result).toBeNull();
    });

    it('should return null for blackboard scope', () => {
      const data = makeDocInput({ accessScope: 'blackboard' });

      const result = service.mapAccessScopeToRecipient(data as never);

      expect(result).toBeNull();
    });
  });

  // =============================================================
  // createUploadNotification
  // =============================================================

  describe('createUploadNotification', () => {
    it('should call createFeatureNotification for company scope', () => {
      const data = makeDocInput({ accessScope: 'company' });

      service.createUploadNotification(data as never, 99, 10, 5);

      expect(mockNotifications.createFeatureNotification).toHaveBeenCalledWith(
        'document',
        99,
        'Neues Dokument: report.pdf',
        'Kategorie: Allgemein',
        'all',
        null,
        10,
        5,
      );
    });

    it('should not call createFeatureNotification for payroll scope', () => {
      const data = makeDocInput({ accessScope: 'payroll' });

      service.createUploadNotification(data as never, 99, 10, 5);

      expect(
        mockNotifications.createFeatureNotification,
      ).not.toHaveBeenCalled();
    });
  });
});
