/**
 * Unit tests for SurveyResponsesService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: Submit (duplicate check, active survey check), retrieval
 *        (paginated, individual, access control), update (edit permission),
 *        export (CSV buffer).
 */
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import { SurveyResponsesService } from './survey-responses.service.js';

// =============================================================
// Module mocks
// =============================================================

vi.mock('uuid', () => ({
  v7: vi.fn().mockReturnValue('mock-uuid-v7'),
}));

vi.mock('../../utils/field-mapper.js', () => ({
  dbToApi: vi.fn((row: Record<string, unknown>) => ({ ...row })),
}));

vi.mock('./surveys.helpers.js', () => ({
  normalizeAnswers: vi.fn((answers: unknown[]) =>
    answers.map((a: Record<string, unknown>) => ({
      question_id: a['questionId'] ?? a['question_id'],
      answer_text: a['answerText'] ?? a['answer_text'],
      answer_number: a['answerNumber'] ?? a['answer_number'],
      answer_date: a['answerDate'] ?? a['answer_date'],
      answer_options: a['answerOptions'] ?? a['answer_options'],
    })),
  ),
}));

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  const queryFn = vi.fn();
  return {
    query: queryFn,
    tenantQuery: queryFn,
    tenantQueryOne: vi.fn().mockResolvedValue(null),
  };
}

function createMockActivityLogger() {
  return {
    logUpdate: vi.fn().mockResolvedValue(undefined),
  };
}

// =============================================================
// SurveyResponsesService
// =============================================================

describe('SurveyResponsesService', () => {
  let service: SurveyResponsesService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockActivityLogger: ReturnType<typeof createMockActivityLogger>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockActivityLogger = createMockActivityLogger();
    service = new SurveyResponsesService(
      mockDb as unknown as DatabaseService,
      mockActivityLogger as unknown as ActivityLoggerService,
    );
  });

  // =============================================================
  // submitResponse
  // =============================================================

  describe('submitResponse', () => {
    it('should throw NotFoundException when survey not found or inactive', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      await expect(service.submitResponse(999, 1, 10, [])).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException on duplicate response', async () => {
      // survey found
      mockDb.tenantQuery.mockResolvedValueOnce([
        { id: 1, status: 'active', allow_multiple_responses: 0 },
      ]);
      // duplicate check → existing response
      mockDb.tenantQuery.mockResolvedValueOnce([{ id: 1 }]);

      await expect(service.submitResponse(1, 1, 10, [])).rejects.toThrow(BadRequestException);
    });

    it('should create response and insert answers', async () => {
      // survey found
      mockDb.tenantQuery.mockResolvedValueOnce([
        { id: 1, status: 'active', allow_multiple_responses: 0 },
      ]);
      // no duplicate
      mockDb.tenantQuery.mockResolvedValueOnce([]);
      // INSERT response RETURNING id
      mockDb.tenantQuery.mockResolvedValueOnce([{ id: 42 }]);
      // INSERT answer (text type)
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      const result = await service.submitResponse(1, 1, 10, [
        { questionId: 5, answerText: 'Great' } as never,
      ]);

      expect(result).toBe(42);
    });

    it('should skip duplicate check when multiple responses allowed', async () => {
      // survey with allow_multiple_responses = 1
      mockDb.tenantQuery.mockResolvedValueOnce([
        { id: 1, status: 'active', allow_multiple_responses: 1 },
      ]);
      // INSERT response (no duplicate check query)
      mockDb.tenantQuery.mockResolvedValueOnce([{ id: 10 }]);

      const result = await service.submitResponse(1, 1, 10, []);

      expect(result).toBe(10);
      // Only 2 queries: survey check + insert (no duplicate check)
      expect(mockDb.tenantQuery).toHaveBeenCalledTimes(2);
    });
  });

  // =============================================================
  // getAllResponses
  // =============================================================

  describe('getAllResponses', () => {
    it('should throw NotFoundException when survey not found', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      await expect(service.getAllResponses(999, 10, { page: 1, limit: 10 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return paginated responses', async () => {
      // survey check (is_anonymous)
      mockDb.tenantQuery.mockResolvedValueOnce([{ is_anonymous: false }]);
      // COUNT
      mockDb.tenantQuery.mockResolvedValueOnce([{ total: '2' }]);
      // SELECT responses
      mockDb.tenantQuery.mockResolvedValueOnce([
        {
          id: 1,
          survey_id: 1,
          user_id: 5,
          tenant_id: 10,
          status: 'completed',
          started_at: new Date('2025-06-01'),
          completed_at: new Date('2025-06-01'),
        },
      ]);
      // answers for response 1
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      const result = await service.getAllResponses(1, 10, {
        page: 1,
        limit: 10,
      });

      expect(result.total).toBe(2);
      expect(result.responses).toHaveLength(1);
    });
  });

  // =============================================================
  // getMyResponse
  // =============================================================

  describe('getMyResponse', () => {
    it('should return null when no response exists', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      const result = await service.getMyResponse(1, 5, 10);

      expect(result).toBeNull();
    });

    it('should return transformed response', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([
        {
          id: 1,
          survey_id: 1,
          user_id: 5,
          tenant_id: 10,
          status: 'completed',
          started_at: new Date('2025-06-01'),
          completed_at: new Date('2025-06-01'),
        },
      ]);
      // answers
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      const result = await service.getMyResponse(1, 5, 10);

      expect(result).not.toBeNull();
    });
  });

  // =============================================================
  // getResponseById
  // =============================================================

  describe('getResponseById', () => {
    it('should throw NotFoundException when response not found', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      await expect(service.getResponseById(1, 999, 10, 'admin', 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException for employee accessing other response', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([
        {
          id: 1,
          survey_id: 1,
          user_id: 99,
          tenant_id: 10,
          started_at: new Date('2025-06-01'),
          completed_at: new Date('2025-06-01'),
        },
      ]);

      await expect(service.getResponseById(1, 1, 10, 'employee', 5)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow admin to access any response', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([
        {
          id: 1,
          survey_id: 1,
          user_id: 99,
          tenant_id: 10,
          started_at: new Date('2025-06-01'),
          completed_at: new Date('2025-06-01'),
        },
      ]);
      // answers
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      const result = await service.getResponseById(1, 1, 10, 'admin', 5);

      expect(result).not.toBeNull();
    });
  });

  // =============================================================
  // updateResponse
  // =============================================================

  describe('updateResponse', () => {
    it('should throw NotFoundException when response not found', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      await expect(service.updateResponse(1, 999, 5, 10, [])).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when editing not allowed', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([{ id: 1, allow_edit_responses: 0 }]);

      await expect(service.updateResponse(1, 1, 5, 10, [])).rejects.toThrow(ForbiddenException);
    });

    it('should update response when editing allowed', async () => {
      // response + survey join check
      mockDb.tenantQuery.mockResolvedValueOnce([{ id: 1, allow_edit_responses: 1 }]);
      // DELETE old answers
      mockDb.tenantQuery.mockResolvedValueOnce([]);
      // INSERT new answer
      mockDb.tenantQuery.mockResolvedValueOnce([]);
      // UPDATE completed_at
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      const result = await service.updateResponse(1, 1, 5, 10, [
        { questionId: 1, answerText: 'Updated' } as never,
      ]);

      expect(result.message).toBe('Response updated successfully');
      expect(mockActivityLogger.logUpdate).toHaveBeenCalled();
    });
  });

  // =============================================================
  // exportResponses
  // =============================================================

  describe('exportResponses', () => {
    it('should throw NotFoundException when survey not found', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      await expect(service.exportResponses(999, 10, 'csv')).rejects.toThrow(NotFoundException);
    });

    it('should return CSV buffer', async () => {
      // verifySurveyExists
      mockDb.tenantQuery.mockResolvedValueOnce([{ id: 1 }]);
      // fetchExportData
      mockDb.tenantQuery.mockResolvedValueOnce([
        {
          response_id: 1,
          user_id: 5,
          completed_at: new Date('2025-06-01'),
          username: 'maxm',
          first_name: 'Max',
          last_name: 'Mustermann',
          question_text: 'How are you?',
          question_type: 'text',
          answer_text: 'Fine',
          answer_number: null,
          answer_date: null,
          answer_options: null,
        },
      ]);

      const result = await service.exportResponses(1, 10, 'csv');

      expect(result).toBeInstanceOf(Buffer);
      const csv = result.toString('utf-8');
      expect(csv).toContain('Response ID');
      expect(csv).toContain('Max Mustermann');
    });
  });
});
