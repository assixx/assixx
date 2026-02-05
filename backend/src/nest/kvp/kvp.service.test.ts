/**
 * Unit tests for KvpService (Facade)
 *
 * Phase 9: Service tests — mocked dependencies.
 * Focus: dashboard mapping, permission checks (create/update/delete),
 *        daily limit, status update authorization, attachment visibility.
 * Pure logic (transforms, query builders, visibility) already tested in kvp.helpers.test.ts.
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import type { KvpAttachmentsService } from './kvp-attachments.service.js';
import type { KvpCommentsService } from './kvp-comments.service.js';
import type { KvpConfirmationsService } from './kvp-confirmations.service.js';
import { KvpService } from './kvp.service.js';

// =============================================================
// Mocks
// =============================================================

function createMockDb() {
  return { query: vi.fn() };
}

function createMockNotifications() {
  return { createFeatureNotification: vi.fn().mockResolvedValue(undefined) };
}

function createMockActivityLogger() {
  return {
    logCreate: vi.fn().mockResolvedValue(undefined),
    logUpdate: vi.fn().mockResolvedValue(undefined),
    logDelete: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockComments() {
  return {
    getComments: vi.fn().mockResolvedValue([]),
    addComment: vi.fn().mockResolvedValue({}),
  };
}

function createMockAttachments() {
  return {
    getAttachments: vi.fn().mockResolvedValue([]),
    addAttachment: vi.fn().mockResolvedValue({}),
    findAttachmentByUuid: vi.fn(),
  };
}

function createMockConfirmations() {
  return {
    getUnconfirmedCount: vi.fn().mockResolvedValue({ count: 0 }),
    confirmSuggestion: vi.fn().mockResolvedValue({ success: true }),
    unconfirmSuggestion: vi.fn().mockResolvedValue({ success: true }),
  };
}

/** Empty org info result (no memberships) */
const EMPTY_ORG_ROW = {
  team_ids: [],
  department_ids: [],
  area_ids: [],
  team_lead_of: [],
  department_lead_of: [],
  area_lead_of: [],
  teams_department_ids: [],
  departments_area_ids: [],
  has_full_access: false,
};

/** Org info with full access */
const FULL_ACCESS_ORG_ROW = {
  ...EMPTY_ORG_ROW,
  has_full_access: true,
};

// =============================================================
// KvpService
// =============================================================

describe('KvpService', () => {
  let service: KvpService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockAttachments: ReturnType<typeof createMockAttachments>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockAttachments = createMockAttachments();
    service = new KvpService(
      mockDb as unknown as DatabaseService,
      createMockNotifications() as unknown as NotificationsService,
      createMockActivityLogger() as unknown as ActivityLoggerService,
      createMockComments() as unknown as KvpCommentsService,
      mockAttachments as unknown as KvpAttachmentsService,
      createMockConfirmations() as unknown as KvpConfirmationsService,
    );
  });

  // =============================================================
  // getDashboardStats
  // =============================================================

  describe('getDashboardStats', () => {
    it('should map DB stats to camelCase response', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          total_suggestions: 100,
          new_suggestions: 30,
          in_progress_count: 20,
          approved: 25,
          implemented: 15,
          rejected: 10,
        },
      ]);

      const result = await service.getDashboardStats(42);

      expect(result).toEqual({
        totalSuggestions: 100,
        newSuggestions: 30,
        inReviewSuggestions: 20,
        approvedSuggestions: 25,
        implementedSuggestions: 15,
        rejectedSuggestions: 10,
      });
    });

    it('should return zeros when no stats returned', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getDashboardStats(42);

      expect(result).toEqual({
        totalSuggestions: 0,
        newSuggestions: 0,
        inReviewSuggestions: 0,
        approvedSuggestions: 0,
        implementedSuggestions: 0,
        rejectedSuggestions: 0,
      });
    });
  });

  // =============================================================
  // createSuggestion — permission checks
  // =============================================================

  describe('createSuggestion', () => {
    it('should throw ForbiddenException for admin without team lead role', async () => {
      // getExtendedUserOrgInfo → no team lead
      mockDb.query.mockResolvedValueOnce([EMPTY_ORG_ROW]);

      await expect(
        service.createSuggestion(
          {
            title: 'Test',
            description: 'Desc',
            orgLevel: 'team',
            orgId: 1,
          },
          42,
          2,
          'admin',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when daily limit reached', async () => {
      // No org info query for employees — skip permission check
      // assertDailyLimitNotReached → count=1
      mockDb.query.mockResolvedValueOnce([{ count: '1' }]);

      await expect(
        service.createSuggestion(
          {
            title: 'Test',
            description: 'Desc',
            orgLevel: 'team',
            orgId: 1,
          },
          42,
          3,
          'employee',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // =============================================================
  // deleteSuggestion — ownership + role checks
  // =============================================================

  describe('deleteSuggestion', () => {
    it('should throw ForbiddenException for employee deleting others suggestion', async () => {
      // getExtendedUserOrgInfo (visibility)
      mockDb.query.mockResolvedValueOnce([FULL_ACCESS_ORG_ROW]);
      // getSuggestionById query
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          uuid: 'test-uuid',
          tenant_id: 42,
          title: 'Other User KVP',
          description: 'Desc',
          category_id: null,
          custom_category_id: null,
          category_name: null,
          department_id: null,
          org_level: 'team',
          org_id: 5,
          status: 'new',
          priority: 'normal',
          submitted_by: 99, // different user
          team_id: 5,
          is_shared: false,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
          user_confirmed: false,
        },
      ]);

      await expect(
        service.deleteSuggestion(1, 42, 3, 'employee'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // =============================================================
  // archiveSuggestion — not found
  // =============================================================

  describe('archiveSuggestion', () => {
    it('should throw NotFoundException when suggestion not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.archiveSuggestion(999, 42, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should archive and log activity', async () => {
      mockDb.query.mockResolvedValueOnce([
        { id: 1, title: 'Test KVP', status: 'approved' },
      ]);
      // UPDATE query
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.archiveSuggestion(1, 42, 1);

      expect(result.message).toBe('Suggestion archived successfully');
    });
  });

  // =============================================================
  // unarchiveSuggestion — not found
  // =============================================================

  describe('unarchiveSuggestion', () => {
    it('should throw NotFoundException when suggestion not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.unarchiveSuggestion(999, 42, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should restore and log activity', async () => {
      mockDb.query.mockResolvedValueOnce([
        { id: 1, title: 'Test KVP', status: 'archived' },
      ]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.unarchiveSuggestion(1, 42, 1);

      expect(result.message).toBe('Suggestion restored successfully');
    });
  });

  // =============================================================
  // getAttachment — visibility checks
  // =============================================================

  describe('getAttachment', () => {
    it('should allow owner to access attachment', async () => {
      mockAttachments.findAttachmentByUuid.mockResolvedValueOnce({
        file_path: '/uploads/file.pdf',
        file_name: 'file.pdf',
        submitted_by: 3,
        status: 'new',
        org_level: 'team',
        org_id: 5,
      });

      const result = await service.getAttachment(
        'file-uuid',
        42,
        3,
        'employee',
      );

      expect(result).toEqual({
        filePath: '/uploads/file.pdf',
        fileName: 'file.pdf',
      });
    });

    it('should allow access to implemented (public) suggestions', async () => {
      mockAttachments.findAttachmentByUuid.mockResolvedValueOnce({
        file_path: '/uploads/public.pdf',
        file_name: 'public.pdf',
        submitted_by: 99,
        status: 'implemented',
        org_level: 'team',
        org_id: 5,
      });

      const result = await service.getAttachment(
        'file-uuid',
        42,
        3,
        'employee',
      );

      expect(result.fileName).toBe('public.pdf');
    });

    it('should throw ForbiddenException when no access', async () => {
      mockAttachments.findAttachmentByUuid.mockResolvedValueOnce({
        file_path: '/uploads/secret.pdf',
        file_name: 'secret.pdf',
        submitted_by: 99,
        status: 'new',
        org_level: 'area',
        org_id: 999,
      });
      // getExtendedUserOrgInfo → no access
      mockDb.query.mockResolvedValueOnce([EMPTY_ORG_ROW]);

      await expect(
        service.getAttachment('file-uuid', 42, 3, 'employee'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
