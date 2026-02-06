/**
 * Unit tests for SurveysService (Facade)
 *
 * Phase 12: Deep service tests — mocked dependencies.
 * Focus: parseIdParam (pure), validateSurveyUpdate (pure),
 *        getSurveyById found paths, createSurvey, updateSurvey,
 *        deleteSurvey, listSurveys, getStatistics, delegation methods,
 *        private helpers (insertSurveyRecord, updateSurveyRecord,
 *        updateSurveyRelations, emitSurveyCreatedNotifications,
 *        emitSurveyUpdatedNotifications, resolveSurveyOrThrow,
 *        getSurveyByNumericId, getSurveyByUUID).
 * Pure transforms already tested in surveys.helpers.test.ts.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import type { SurveyAccessService } from './survey-access.service.js';
import type { SurveyQuestionsService } from './survey-questions.service.js';
import type { SurveyResponsesService } from './survey-responses.service.js';
import type { SurveyStatisticsService } from './survey-statistics.service.js';
import { SurveysService } from './surveys.service.js';
import type { DbSurvey } from './surveys.types.js';

// =============================================================
// Mock eventBus (imported statically in service)
// =============================================================

vi.mock('../../utils/eventBus.js', () => ({
  eventBus: {
    emitSurveyCreated: vi.fn(),
    emitSurveyUpdated: vi.fn(),
  },
}));

// =============================================================
// Mock uuid
// =============================================================

vi.mock('uuid', () => ({
  v7: vi.fn().mockReturnValue('00000000-0000-7000-0000-000000000001'),
}));

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

/** Standard mock DB survey row */
function createMockDbSurvey(overrides: Partial<DbSurvey> = {}): DbSurvey {
  return {
    id: 1,
    uuid: '0194a1b2-c3d4-7e5f-8a9b-c0d1e2f3a4b5',
    tenant_id: 1,
    title: 'Test Survey',
    description: 'A test survey',
    created_by: 5,
    status: 'draft',
    is_anonymous: false,
    is_mandatory: false,
    start_date: null,
    end_date: null,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    creator_first_name: 'Test',
    creator_last_name: 'User',
    response_count: 0,
    completed_count: 0,
    questions: [],
    assignments: [],
    ...overrides,
  };
}

interface ServiceMocks {
  service: SurveysService;
  mockDb: ReturnType<typeof createMockDb>;
  mockNotifications: ReturnType<typeof createMockNotifications>;
  mockActivityLogger: ReturnType<typeof createMockActivityLogger>;
  mockAccessService: ReturnType<typeof createMockAccessService>;
  mockQuestionsService: ReturnType<typeof createMockQuestionsService>;
  mockResponsesService: ReturnType<typeof createMockResponsesService>;
  mockStatisticsService: ReturnType<typeof createMockStatisticsService>;
}

function createService(): ServiceMocks {
  const mockDb = createMockDb();
  const mockNotifications = createMockNotifications();
  const mockActivityLogger = createMockActivityLogger();
  const mockAccessService = createMockAccessService();
  const mockQuestionsService = createMockQuestionsService();
  const mockResponsesService = createMockResponsesService();
  const mockStatisticsService = createMockStatisticsService();

  const service = new SurveysService(
    mockDb as unknown as DatabaseService,
    mockNotifications as unknown as NotificationsService,
    mockActivityLogger as unknown as ActivityLoggerService,
    mockAccessService as unknown as SurveyAccessService,
    mockQuestionsService as unknown as SurveyQuestionsService,
    mockResponsesService as unknown as SurveyResponsesService,
    mockStatisticsService as unknown as SurveyStatisticsService,
  );

  return {
    service,
    mockDb,
    mockNotifications,
    mockActivityLogger,
    mockAccessService,
    mockQuestionsService,
    mockResponsesService,
    mockStatisticsService,
  };
}

// =============================================================
// SurveysService
// =============================================================

describe('SurveysService', () => {
  let mocks: ServiceMocks;

  beforeEach(() => {
    mocks = createService();
  });

  // =============================================================
  // parseIdParam (pure function)
  // =============================================================

  describe('parseIdParam', () => {
    it('should return UUID string for valid UUID', () => {
      const uuid = '0194a1b2-c3d4-7e5f-8a9b-c0d1e2f3a4b5';

      const result = mocks.service.parseIdParam(uuid);

      expect(result).toBe(uuid);
      expect(typeof result).toBe('string');
    });

    it('should return number for valid numeric string', () => {
      const result = mocks.service.parseIdParam('42');

      expect(result).toBe(42);
      expect(typeof result).toBe('number');
    });

    it('should throw BadRequestException for invalid string', () => {
      expect(() => mocks.service.parseIdParam('not-a-number')).toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for zero', () => {
      expect(() => mocks.service.parseIdParam('0')).toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for negative number', () => {
      expect(() => mocks.service.parseIdParam('-5')).toThrow(
        BadRequestException,
      );
    });
  });

  // =============================================================
  // validateSurveyUpdate (pure private)
  // =============================================================

  describe('validateSurveyUpdate', () => {
    it('throws ForbiddenException for employee role', () => {
      expect(() =>
        mocks.service['validateSurveyUpdate']('employee', 'draft', 0),
      ).toThrow(ForbiddenException);
    });

    it('throws ConflictException for active survey with responses', () => {
      expect(() =>
        mocks.service['validateSurveyUpdate']('admin', 'active', 5),
      ).toThrow(ConflictException);
    });

    it('does not throw for admin with draft survey', () => {
      expect(() =>
        mocks.service['validateSurveyUpdate']('admin', 'draft', 0),
      ).not.toThrow();
    });

    it('does not throw for admin with active survey and zero responses', () => {
      expect(() =>
        mocks.service['validateSurveyUpdate']('admin', 'active', 0),
      ).not.toThrow();
    });

    it('does not throw for root role with draft survey', () => {
      expect(() =>
        mocks.service['validateSurveyUpdate']('root', 'draft', 10),
      ).not.toThrow();
    });
  });

  // =============================================================
  // resolveToNumericId
  // =============================================================

  describe('resolveToNumericId', () => {
    it('should return number directly for numeric input', async () => {
      const result = await mocks.service.resolveToNumericId(42, 1);

      expect(result).toBe(42);
      expect(mocks.mockDb.query).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for unknown UUID', async () => {
      mocks.mockDb.query.mockResolvedValueOnce([]);

      await expect(
        mocks.service.resolveToNumericId('unknown-uuid', 1),
      ).rejects.toThrow(NotFoundException);
    });

    it('should resolve UUID to numeric ID', async () => {
      const survey = createMockDbSurvey({ id: 42 });
      mocks.mockDb.query.mockResolvedValueOnce([survey]);

      const result = await mocks.service.resolveToNumericId(
        '0194a1b2-c3d4-7e5f-8a9b-c0d1e2f3a4b5',
        1,
      );

      expect(result).toBe(42);
    });
  });

  // =============================================================
  // getSurveyById
  // =============================================================

  describe('getSurveyById', () => {
    it('should throw NotFoundException when survey not found by ID', async () => {
      mocks.mockDb.query.mockResolvedValueOnce([]);

      await expect(
        mocks.service.getSurveyById(999, 42, 1, 'admin'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when survey not found by UUID', async () => {
      mocks.mockDb.query.mockResolvedValueOnce([]);

      await expect(
        mocks.service.getSurveyById('missing-uuid', 42, 1, 'admin'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return survey for numeric ID (found path)', async () => {
      const survey = createMockDbSurvey();
      mocks.mockDb.query.mockResolvedValueOnce([survey]);

      const result = await mocks.service.getSurveyById(1, 1, 5, 'admin');

      expect(result).toHaveProperty('title');
      expect(mocks.mockAccessService.checkSurveyAccess).toHaveBeenCalledWith(
        1,
        1,
        5,
        'admin',
      );
    });

    it('should return survey for UUID (found path)', async () => {
      const survey = createMockDbSurvey();
      mocks.mockDb.query.mockResolvedValueOnce([survey]);

      const result = await mocks.service.getSurveyById(
        '0194a1b2-c3d4-7e5f-8a9b-c0d1e2f3a4b5',
        1,
        5,
        'admin',
      );

      expect(result).toHaveProperty('title');
    });

    it('calls checkSurveyManagementAccess when manage=true', async () => {
      const survey = createMockDbSurvey();
      mocks.mockDb.query.mockResolvedValueOnce([survey]);

      await mocks.service.getSurveyById(1, 1, 5, 'admin', true);

      expect(
        mocks.mockAccessService.checkSurveyManagementAccess,
      ).toHaveBeenCalledWith(1, 1, 5, 'admin');
    });
  });

  // =============================================================
  // Private: getSurveyByNumericId / getSurveyByUUID
  // =============================================================

  describe('getSurveyByNumericId', () => {
    it('returns null when no rows found', async () => {
      mocks.mockDb.query.mockResolvedValueOnce([]);

      const result = await mocks.service['getSurveyByNumericId'](999, 1);

      expect(result).toBeNull();
    });

    it('returns survey with loaded questions and assignments', async () => {
      const survey = createMockDbSurvey();
      mocks.mockDb.query.mockResolvedValueOnce([survey]);
      mocks.mockQuestionsService.loadSurveyQuestionsAndAssignments.mockResolvedValueOnce(
        {
          questions: [{ id: 1, question_text: 'Q1' }],
          assignments: [{ id: 1, scope: 'all' }],
        },
      );

      const result = await mocks.service['getSurveyByNumericId'](1, 1);

      expect(result).not.toBeNull();
      expect(result?.questions).toHaveLength(1);
      expect(result?.assignments).toHaveLength(1);
    });
  });

  describe('getSurveyByUUID', () => {
    it('returns null when no rows found', async () => {
      mocks.mockDb.query.mockResolvedValueOnce([]);

      const result = await mocks.service['getSurveyByUUID']('missing', 1);

      expect(result).toBeNull();
    });

    it('returns survey with loaded questions', async () => {
      const survey = createMockDbSurvey();
      mocks.mockDb.query.mockResolvedValueOnce([survey]);

      const result = await mocks.service['getSurveyByUUID'](
        '0194a1b2-c3d4-7e5f-8a9b-c0d1e2f3a4b5',
        1,
      );

      expect(result).not.toBeNull();
      expect(
        mocks.mockQuestionsService.loadSurveyQuestionsAndAssignments,
      ).toHaveBeenCalledWith(1);
    });
  });

  // =============================================================
  // Private: resolveSurveyOrThrow
  // =============================================================

  describe('resolveSurveyOrThrow', () => {
    it('resolves numeric ID and returns survey + surveyId', async () => {
      const survey = createMockDbSurvey({ id: 42 });
      mocks.mockDb.query.mockResolvedValueOnce([survey]);

      const result = await mocks.service['resolveSurveyOrThrow'](42, 1);

      expect(result.surveyId).toBe(42);
      expect(result.survey).not.toBeNull();
    });

    it('resolves UUID and returns survey + surveyId', async () => {
      const survey = createMockDbSurvey({ id: 42 });
      mocks.mockDb.query.mockResolvedValueOnce([survey]);

      const result = await mocks.service['resolveSurveyOrThrow'](
        'some-uuid',
        1,
      );

      expect(result.surveyId).toBe(42);
    });

    it('throws NotFoundException when not found', async () => {
      mocks.mockDb.query.mockResolvedValueOnce([]);

      await expect(
        mocks.service['resolveSurveyOrThrow'](999, 1),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =============================================================
  // Private: insertSurveyRecord
  // =============================================================

  describe('insertSurveyRecord', () => {
    it('inserts survey and returns ID', async () => {
      mocks.mockDb.query.mockResolvedValueOnce([{ id: 42 }]);

      const dto = { title: 'New Survey', status: 'draft' };
      const result = await mocks.service['insertSurveyRecord'](
        dto as never,
        1,
        5,
      );

      expect(result).toBe(42);
      expect(mocks.mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO surveys'),
        expect.arrayContaining([1, 'New Survey']),
      );
    });

    it('returns 0 when no rows returned', async () => {
      mocks.mockDb.query.mockResolvedValueOnce([]);

      const dto = { title: 'Survey' };
      const result = await mocks.service['insertSurveyRecord'](
        dto as never,
        1,
        5,
      );

      expect(result).toBe(0);
    });

    it('passes all optional fields with defaults', async () => {
      mocks.mockDb.query.mockResolvedValueOnce([{ id: 1 }]);

      const dto = {
        title: 'Survey',
        description: 'Desc',
        status: 'active',
        isAnonymous: true,
        isMandatory: true,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      };

      await mocks.service['insertSurveyRecord'](dto as never, 1, 5);

      const callArgs = mocks.mockDb.query.mock.calls[0] as unknown[];
      const params = callArgs[1] as unknown[];
      expect(params).toContain('Desc');
      expect(params).toContain('active');
      expect(params).toContain(true); // isAnonymous
      expect(params).toContain('2024-01-01');
      expect(params).toContain('2024-12-31');
    });
  });

  // =============================================================
  // Private: updateSurveyRecord
  // =============================================================

  describe('updateSurveyRecord', () => {
    it('calls db.query with COALESCE update', async () => {
      mocks.mockDb.query.mockResolvedValueOnce([]);

      const dto = { title: 'Updated', status: 'active' };
      await mocks.service['updateSurveyRecord'](1, dto as never, 1);

      expect(mocks.mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE surveys SET'),
        expect.arrayContaining(['Updated', 'active', 1, 1]),
      );
    });

    it('passes null for undefined optional fields', async () => {
      mocks.mockDb.query.mockResolvedValueOnce([]);

      const dto = { title: 'Only Title' };
      await mocks.service['updateSurveyRecord'](1, dto as never, 1);

      const callArgs = mocks.mockDb.query.mock.calls[0] as unknown[];
      const params = callArgs[1] as unknown[];
      expect(params[0]).toBe('Only Title');
      expect(params[1]).toBeNull(); // description
    });
  });

  // =============================================================
  // Private: updateSurveyRelations
  // =============================================================

  describe('updateSurveyRelations', () => {
    it('replaces questions when provided', async () => {
      mocks.mockDb.query.mockResolvedValue([]);

      const dto = { questions: [{ questionText: 'Q1', questionType: 'text' }] };
      await mocks.service['updateSurveyRelations'](
        1,
        dto as never,
        1,
        5,
        'admin',
      );

      expect(mocks.mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM survey_questions'),
        [1],
      );
      expect(
        mocks.mockQuestionsService.insertSurveyQuestions,
      ).toHaveBeenCalledWith(1, 1, dto.questions);
    });

    it('replaces assignments when provided', async () => {
      mocks.mockDb.query.mockResolvedValue([]);

      const dto = { assignments: [{ scope: 'all' }] };
      await mocks.service['updateSurveyRelations'](
        1,
        dto as never,
        1,
        5,
        'admin',
      );

      expect(
        mocks.mockAccessService.validateAssignmentPermissions,
      ).toHaveBeenCalled();
      expect(mocks.mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM survey_assignments'),
        [1],
      );
      expect(
        mocks.mockQuestionsService.insertSurveyAssignments,
      ).toHaveBeenCalledWith(1, 1, dto.assignments);
    });

    it('skips question/assignment updates when not in DTO', async () => {
      const dto = { title: 'Just title' };
      await mocks.service['updateSurveyRelations'](
        1,
        dto as never,
        1,
        5,
        'admin',
      );

      expect(mocks.mockDb.query).not.toHaveBeenCalled();
      expect(
        mocks.mockQuestionsService.insertSurveyQuestions,
      ).not.toHaveBeenCalled();
    });

    it('skips validateAssignmentPermissions for empty assignments', async () => {
      mocks.mockDb.query.mockResolvedValue([]);

      const dto = { assignments: [] };
      await mocks.service['updateSurveyRelations'](
        1,
        dto as never,
        1,
        5,
        'admin',
      );

      expect(
        mocks.mockAccessService.validateAssignmentPermissions,
      ).not.toHaveBeenCalled();
    });
  });

  // =============================================================
  // createFromTemplate
  // =============================================================

  describe('createFromTemplate', () => {
    it('should throw NotFoundException when template not found', async () => {
      mocks.mockDb.query.mockResolvedValueOnce([]);

      await expect(
        mocks.service.createFromTemplate(999, 42, 1, 'admin'),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates survey from template data', async () => {
      const template = {
        id: 1,
        name: 'Template',
        description: 'Desc',
        template_data: JSON.stringify({
          title: 'From Template',
          description: 'Templated desc',
          questions: [{ questionText: 'Q1', questionType: 'text' }],
        }),
        is_public: true,
        tenant_id: null,
      };
      mocks.mockDb.query
        .mockResolvedValueOnce([template]) // getTemplate
        .mockResolvedValueOnce([{ id: 42 }]) // insertSurveyRecord
        .mockResolvedValueOnce([createMockDbSurvey({ id: 42 })]); // getSurveyById

      const result = await mocks.service.createFromTemplate(1, 1, 5, 'admin');

      expect(result).toHaveProperty('title');
      expect(
        mocks.mockQuestionsService.insertSurveyQuestions,
      ).toHaveBeenCalled();
    });
  });

  // =============================================================
  // getTemplates
  // =============================================================

  describe('getTemplates', () => {
    it('should return mapped templates', async () => {
      mocks.mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          name: 'Employee Satisfaction',
          description: 'Standard survey',
          template_data: '{}',
          is_public: true,
          tenant_id: null,
        },
      ]);

      const result = await mocks.service.getTemplates(42);

      expect(result).toHaveLength(1);
      // dbToApi converts snake_case → camelCase
      expect(result[0]).toHaveProperty('isPublic');
    });

    it('should return empty array when no templates', async () => {
      mocks.mockDb.query.mockResolvedValueOnce([]);

      const result = await mocks.service.getTemplates(42);

      expect(result).toEqual([]);
    });
  });

  // =============================================================
  // listSurveys
  // =============================================================

  describe('listSurveys', () => {
    it('returns surveys with canManage flags', async () => {
      const survey = createMockDbSurvey({ id: 1 });
      mocks.mockAccessService.fetchSurveysByAccessLevel.mockResolvedValueOnce([
        survey,
      ]);

      const result = await mocks.service.listSurveys(1, 5, 'admin', {});

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('canManage');
    });

    it('applies pagination defaults', async () => {
      mocks.mockAccessService.fetchSurveysByAccessLevel.mockResolvedValueOnce(
        [],
      );

      await mocks.service.listSurveys(1, 5, 'admin', {});

      expect(
        mocks.mockAccessService.fetchSurveysByAccessLevel,
      ).toHaveBeenCalledWith(
        1,
        5,
        undefined, // status
        20, // default limit
        0, // offset for page 1
        true, // hasUnrestrictedAccess
        false, // manage
      );
    });

    it('passes custom page and limit', async () => {
      mocks.mockAccessService.fetchSurveysByAccessLevel.mockResolvedValueOnce(
        [],
      );

      await mocks.service.listSurveys(1, 5, 'admin', {
        page: 3,
        limit: 10,
        status: 'active',
      });

      expect(
        mocks.mockAccessService.fetchSurveysByAccessLevel,
      ).toHaveBeenCalledWith(
        1,
        5,
        'active',
        10,
        20, // offset = (3-1) * 10
        true,
        false,
      );
    });

    it('uses getManageableSurveyIds when not unrestricted', async () => {
      const survey = createMockDbSurvey({ id: 1 });
      mocks.mockAccessService.checkUnrestrictedAccess.mockResolvedValueOnce(
        false,
      );
      mocks.mockAccessService.fetchSurveysByAccessLevel.mockResolvedValueOnce([
        survey,
      ]);
      mocks.mockAccessService.getManageableSurveyIds.mockResolvedValueOnce(
        new Set([1]),
      );

      const result = await mocks.service.listSurveys(1, 5, 'employee', {});

      expect(
        mocks.mockAccessService.getManageableSurveyIds,
      ).toHaveBeenCalledWith([1], 1, 5);
      expect(result[0]).toHaveProperty('canManage', true);
    });

    it('sets canManage=true for all when manage=true', async () => {
      const survey = createMockDbSurvey({ id: 1 });
      mocks.mockAccessService.fetchSurveysByAccessLevel.mockResolvedValueOnce([
        survey,
      ]);

      const result = await mocks.service.listSurveys(1, 5, 'admin', {
        manage: true,
      });

      expect(result[0]).toHaveProperty('canManage', true);
    });
  });

  // =============================================================
  // createSurvey
  // =============================================================

  describe('createSurvey', () => {
    it('creates survey without questions or assignments', async () => {
      const createdSurvey = createMockDbSurvey({ id: 42 });
      mocks.mockDb.query
        .mockResolvedValueOnce([{ id: 42 }]) // insertSurveyRecord
        .mockResolvedValueOnce([createdSurvey]); // getSurveyById

      const dto = { title: 'New Survey', status: 'draft' };
      const result = await mocks.service.createSurvey(
        dto as never,
        1,
        5,
        'admin',
      );

      expect(result).toHaveProperty('title');
      expect(mocks.mockActivityLogger.logCreate).toHaveBeenCalledWith(
        1,
        5,
        'survey',
        42,
        expect.stringContaining('New Survey'),
        expect.any(Object),
      );
    });

    it('inserts questions when provided', async () => {
      const createdSurvey = createMockDbSurvey({ id: 42 });
      mocks.mockDb.query
        .mockResolvedValueOnce([{ id: 42 }])
        .mockResolvedValueOnce([createdSurvey]);

      const dto = {
        title: 'Survey with Q',
        questions: [{ questionText: 'Q1', questionType: 'text' }],
      };
      await mocks.service.createSurvey(dto as never, 1, 5, 'admin');

      expect(
        mocks.mockQuestionsService.insertSurveyQuestions,
      ).toHaveBeenCalledWith(1, 42, dto.questions);
    });

    it('inserts assignments and validates permissions', async () => {
      const createdSurvey = createMockDbSurvey({ id: 42 });
      mocks.mockDb.query
        .mockResolvedValueOnce([{ id: 42 }])
        .mockResolvedValueOnce([createdSurvey]);

      const dto = {
        title: 'Survey with Assign',
        assignments: [{ scope: 'department', targetId: 1 }],
      };
      await mocks.service.createSurvey(dto as never, 1, 5, 'admin');

      expect(
        mocks.mockAccessService.validateAssignmentPermissions,
      ).toHaveBeenCalled();
      expect(
        mocks.mockQuestionsService.insertSurveyAssignments,
      ).toHaveBeenCalledWith(1, 42, dto.assignments);
    });
  });

  // =============================================================
  // updateSurvey
  // =============================================================

  describe('updateSurvey', () => {
    it('updates survey and returns result', async () => {
      const existing = createMockDbSurvey();
      const updated = createMockDbSurvey({ title: 'Updated' });
      // getSurveyById (existing) → db.query, then checkSurveyManagementAccess + checkSurveyAccess
      mocks.mockDb.query
        .mockResolvedValueOnce([existing]) // getSurveyById (existing)
        .mockResolvedValueOnce([]) // updateSurveyRecord
        .mockResolvedValueOnce([updated]); // getSurveyById (updated)

      const result = await mocks.service.updateSurvey(
        1,
        { title: 'Updated' } as never,
        1,
        5,
        'admin',
      );

      expect(result).toHaveProperty('title');
      expect(mocks.mockActivityLogger.logUpdate).toHaveBeenCalled();
    });

    it('throws ForbiddenException for employee update', async () => {
      const existing = createMockDbSurvey();
      mocks.mockDb.query.mockResolvedValueOnce([existing]);

      await expect(
        mocks.service.updateSurvey(
          1,
          { title: 'X' } as never,
          1,
          5,
          'employee',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException for active survey with responses', async () => {
      const existing = createMockDbSurvey({
        status: 'active',
        response_count: 5,
      });
      mocks.mockDb.query.mockResolvedValueOnce([existing]);

      await expect(
        mocks.service.updateSurvey(1, { title: 'X' } as never, 1, 5, 'admin'),
      ).rejects.toThrow(ConflictException);
    });
  });

  // =============================================================
  // deleteSurvey
  // =============================================================

  describe('deleteSurvey', () => {
    it('deletes survey with zero responses', async () => {
      const survey = createMockDbSurvey({ response_count: 0 });
      mocks.mockDb.query
        .mockResolvedValueOnce([survey]) // getSurveyById
        .mockResolvedValueOnce([]); // DELETE query

      const result = await mocks.service.deleteSurvey(1, 1, 5, 'admin');

      expect(result.message).toBe('Survey deleted successfully');
      expect(mocks.mockActivityLogger.logDelete).toHaveBeenCalledWith(
        1,
        5,
        'survey',
        1,
        expect.stringContaining('gelöscht'),
        expect.any(Object),
      );
    });

    it('throws ConflictException when responses exist', async () => {
      const survey = createMockDbSurvey({ response_count: 3 });
      mocks.mockDb.query.mockResolvedValueOnce([survey]);

      await expect(
        mocks.service.deleteSurvey(1, 1, 5, 'admin'),
      ).rejects.toThrow(ConflictException);
    });

    it('calls checkSurveyManagementAccess', async () => {
      const survey = createMockDbSurvey();
      mocks.mockDb.query
        .mockResolvedValueOnce([survey])
        .mockResolvedValueOnce([]);

      await mocks.service.deleteSurvey(1, 1, 5, 'admin');

      expect(
        mocks.mockAccessService.checkSurveyManagementAccess,
      ).toHaveBeenCalledWith(1, 1, 5, 'admin');
    });
  });

  // =============================================================
  // getStatistics
  // =============================================================

  describe('getStatistics', () => {
    it('resolves survey and delegates to statisticsService', async () => {
      const survey = createMockDbSurvey({ id: 42 });
      mocks.mockDb.query.mockResolvedValueOnce([survey]);
      mocks.mockStatisticsService.computeStatistics.mockResolvedValueOnce({
        totalResponses: 10,
      });

      const result = await mocks.service.getStatistics(42, 1, 5, 'admin');

      expect(result).toEqual({ totalResponses: 10 });
      expect(
        mocks.mockStatisticsService.computeStatistics,
      ).toHaveBeenCalledWith(42, 1, []);
      expect(
        mocks.mockAccessService.checkSurveyManagementAccess,
      ).toHaveBeenCalledWith(42, 1, 5, 'admin');
    });

    it('resolves UUID before computing statistics', async () => {
      const survey = createMockDbSurvey({ id: 42 });
      mocks.mockDb.query.mockResolvedValueOnce([survey]);
      mocks.mockStatisticsService.computeStatistics.mockResolvedValueOnce({});

      await mocks.service.getStatistics('some-uuid', 1, 5, 'admin');

      expect(mocks.mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE s.uuid ='),
        expect.any(Array),
      );
    });
  });

  // =============================================================
  // Delegation methods
  // =============================================================

  describe('submitResponse', () => {
    it('delegates to responsesService', async () => {
      mocks.mockResponsesService.submitResponse.mockResolvedValueOnce(42);

      const result = await mocks.service.submitResponse(1, 5, 1, []);

      expect(result).toBe(42);
      expect(mocks.mockResponsesService.submitResponse).toHaveBeenCalledWith(
        1,
        5,
        1,
        [],
      );
    });
  });

  describe('getAllResponses', () => {
    it('checks management access and delegates', async () => {
      const paginatedResult = { responses: [], total: 0 };
      mocks.mockResponsesService.getAllResponses.mockResolvedValueOnce(
        paginatedResult,
      );

      const result = await mocks.service.getAllResponses(1, 1, 'admin', 5, {
        page: 1,
        limit: 10,
      });

      expect(result).toEqual(paginatedResult);
      expect(
        mocks.mockAccessService.checkSurveyManagementAccess,
      ).toHaveBeenCalledWith(1, 1, 5, 'admin');
    });
  });

  describe('getMyResponse', () => {
    it('delegates to responsesService', async () => {
      mocks.mockResponsesService.getMyResponse.mockResolvedValueOnce(null);

      const result = await mocks.service.getMyResponse(1, 5, 1);

      expect(result).toBeNull();
    });
  });

  describe('getResponseById', () => {
    it('delegates to responsesService', async () => {
      const response = { id: 1, answers: [] };
      mocks.mockResponsesService.getResponseById.mockResolvedValueOnce(
        response,
      );

      const result = await mocks.service.getResponseById(1, 1, 1, 'admin', 5);

      expect(result).toEqual(response);
    });
  });

  describe('updateResponse', () => {
    it('delegates to responsesService', async () => {
      mocks.mockResponsesService.updateResponse.mockResolvedValueOnce({
        message: 'Updated',
      });

      const result = await mocks.service.updateResponse(1, 1, 5, 1, []);

      expect(result.message).toBe('Updated');
    });
  });

  describe('exportResponses', () => {
    it('checks management access and delegates', async () => {
      const buffer = Buffer.from('csv-data');
      mocks.mockResponsesService.exportResponses.mockResolvedValueOnce(buffer);

      const result = await mocks.service.exportResponses(
        1,
        1,
        'admin',
        5,
        'csv',
      );

      expect(result).toEqual(buffer);
      expect(
        mocks.mockAccessService.checkSurveyManagementAccess,
      ).toHaveBeenCalledWith(1, 1, 5, 'admin');
    });
  });

  describe('getPendingSurveyCount', () => {
    it('delegates to accessService', async () => {
      mocks.mockAccessService.getPendingSurveyCount.mockResolvedValueOnce({
        count: 3,
      });

      const result = await mocks.service.getPendingSurveyCount(5, 1);

      expect(result).toEqual({ count: 3 });
    });
  });

  // =============================================================
  // Private: emitSurveyCreatedNotifications
  // =============================================================

  describe('emitSurveyCreatedNotifications', () => {
    it('emits event, creates notification, and logs activity', async () => {
      const dto = {
        title: 'Survey',
        status: 'active',
        endDate: '2024-12-31',
      };

      await mocks.service['emitSurveyCreatedNotifications'](
        dto as never,
        42,
        1,
        5,
      );

      expect(
        mocks.mockNotifications.createFeatureNotification,
      ).toHaveBeenCalled();
      expect(mocks.mockActivityLogger.logCreate).toHaveBeenCalledWith(
        1,
        5,
        'survey',
        42,
        expect.stringContaining('Survey'),
        expect.objectContaining({ title: 'Survey' }),
      );
    });

    it('handles missing endDate', async () => {
      const dto = { title: 'No Deadline' };

      await mocks.service['emitSurveyCreatedNotifications'](
        dto as never,
        42,
        1,
        5,
      );

      expect(
        mocks.mockNotifications.createFeatureNotification,
      ).toHaveBeenCalled();
    });
  });

  // =============================================================
  // Private: emitSurveyUpdatedNotifications
  // =============================================================

  describe('emitSurveyUpdatedNotifications', () => {
    it('logs update activity with old and new values', async () => {
      const dto = { title: 'Updated Title', status: 'active' };
      const existing = {
        title: 'Old Title',
        status: 'draft',
        isAnonymous: false,
        endDate: undefined,
      };

      await mocks.service['emitSurveyUpdatedNotifications'](
        42,
        dto as never,
        existing,
        1,
        5,
      );

      expect(mocks.mockActivityLogger.logUpdate).toHaveBeenCalledWith(
        1,
        5,
        'survey',
        42,
        expect.stringContaining('Old Title'),
        expect.objectContaining({ title: 'Old Title' }),
        expect.objectContaining({ title: 'Updated Title' }),
      );
    });
  });
});
