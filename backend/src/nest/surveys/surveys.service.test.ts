/**
 * Unit tests for SurveysService (Facade)
 *
 * Phase 9: Service tests — mocked dependencies.
 * Focus: parseIdParam (pure), UUID resolution, not-found paths,
 *        delete conflict, template not-found.
 * Pure transforms already tested in surveys.helpers.test.ts.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import type { SurveyAccessService } from './survey-access.service.js';
import type { SurveyQuestionsService } from './survey-questions.service.js';
import type { SurveyResponsesService } from './survey-responses.service.js';
import type { SurveyStatisticsService } from './survey-statistics.service.js';
import { SurveysService } from './surveys.service.js';

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

function createMockAccessService() {
  return {
    checkUnrestrictedAccess: vi.fn().mockResolvedValue(true),
    fetchSurveysByAccessLevel: vi.fn().mockResolvedValue([]),
    attachAssignmentsToSurveys: vi.fn().mockResolvedValue(undefined),
    getManageableSurveyIds: vi.fn().mockResolvedValue(new Set()),
    checkSurveyAccess: vi.fn().mockResolvedValue(undefined),
    checkSurveyManagementAccess: vi.fn().mockResolvedValue(undefined),
    validateAssignmentPermissions: vi.fn().mockResolvedValue(undefined),
    getPendingSurveyCount: vi.fn().mockResolvedValue({ count: 0 }),
  };
}

function createMockQuestionsService() {
  return {
    insertSurveyQuestions: vi.fn().mockResolvedValue(undefined),
    insertSurveyAssignments: vi.fn().mockResolvedValue(undefined),
    loadSurveyQuestionsAndAssignments: vi
      .fn()
      .mockResolvedValue({ questions: [], assignments: [] }),
  };
}

function createMockResponsesService() {
  return {
    submitResponse: vi.fn(),
    getAllResponses: vi.fn(),
    getMyResponse: vi.fn(),
    getResponseById: vi.fn(),
    updateResponse: vi.fn(),
    exportResponses: vi.fn(),
  };
}

function createMockStatisticsService() {
  return { computeStatistics: vi.fn() };
}

// =============================================================
// SurveysService
// =============================================================

describe('SurveysService', () => {
  let service: SurveysService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new SurveysService(
      mockDb as unknown as DatabaseService,
      createMockNotifications() as unknown as NotificationsService,
      createMockActivityLogger() as unknown as ActivityLoggerService,
      createMockAccessService() as unknown as SurveyAccessService,
      createMockQuestionsService() as unknown as SurveyQuestionsService,
      createMockResponsesService() as unknown as SurveyResponsesService,
      createMockStatisticsService() as unknown as SurveyStatisticsService,
    );
  });

  // =============================================================
  // parseIdParam (pure function)
  // =============================================================

  describe('parseIdParam', () => {
    it('should return UUID string for valid UUID', () => {
      const uuid = '0194a1b2-c3d4-7e5f-8a9b-c0d1e2f3a4b5';

      const result = service.parseIdParam(uuid);

      expect(result).toBe(uuid);
      expect(typeof result).toBe('string');
    });

    it('should return number for valid numeric string', () => {
      const result = service.parseIdParam('42');

      expect(result).toBe(42);
      expect(typeof result).toBe('number');
    });

    it('should throw BadRequestException for invalid string', () => {
      expect(() => service.parseIdParam('not-a-number')).toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for zero', () => {
      expect(() => service.parseIdParam('0')).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for negative number', () => {
      expect(() => service.parseIdParam('-5')).toThrow(BadRequestException);
    });
  });

  // =============================================================
  // resolveToNumericId
  // =============================================================

  describe('resolveToNumericId', () => {
    it('should return number directly for numeric input', async () => {
      const result = await service.resolveToNumericId(42, 1);

      expect(result).toBe(42);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for unknown UUID', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        service.resolveToNumericId('unknown-uuid', 1),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =============================================================
  // getSurveyById — not found
  // =============================================================

  describe('getSurveyById', () => {
    it('should throw NotFoundException when survey not found by ID', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.getSurveyById(999, 42, 1, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when survey not found by UUID', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        service.getSurveyById('missing-uuid', 42, 1, 'admin'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =============================================================
  // createFromTemplate — not found
  // =============================================================

  describe('createFromTemplate', () => {
    it('should throw NotFoundException when template not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        service.createFromTemplate(999, 42, 1, 'admin'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =============================================================
  // getTemplates — DB mapping
  // =============================================================

  describe('getTemplates', () => {
    it('should return mapped templates', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          name: 'Employee Satisfaction',
          description: 'Standard survey',
          template_data: '{}',
          is_public: true,
          tenant_id: null,
        },
      ]);

      const result = await service.getTemplates(42);

      expect(result).toHaveLength(1);
      // dbToApi converts snake_case → camelCase
      expect(result[0]).toHaveProperty('isPublic');
    });

    it('should return empty array when no templates', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getTemplates(42);

      expect(result).toEqual([]);
    });
  });
});
