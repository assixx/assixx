/**
 * Unit tests for SurveyQuestionsService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: Load questions with options, insert questions + options,
 *        insert assignments, options map building.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { SurveyQuestionsService } from './survey-questions.service.js';

// =============================================================
// Module mocks
// =============================================================

vi.mock('./surveys.helpers.js', () => ({
  buildQuestionData: vi
    .fn()
    .mockImplementation(
      (q: { questionText: string; questionType: string; options?: string[] }, idx: number) => ({
        question_text: q.questionText,
        question_type: q.questionType,
        is_required: true,
        order_position: idx,
        options: q.options,
      }),
    ),
  buildAssignmentData: vi.fn().mockImplementation((a: { type: string }) => ({
    type: a.type,
    area_id: null,
    department_id: null,
    team_id: null,
    user_id: null,
  })),
}));

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return { query: vi.fn() };
}

// =============================================================
// SurveyQuestionsService
// =============================================================

describe('SurveyQuestionsService', () => {
  let service: SurveyQuestionsService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new SurveyQuestionsService(mockDb as unknown as DatabaseService);
  });

  // =============================================================
  // loadSurveyQuestionsAndAssignments
  // =============================================================

  describe('loadSurveyQuestionsAndAssignments', () => {
    it('should return empty questions and assignments', async () => {
      mockDb.query.mockResolvedValueOnce([]); // questions
      mockDb.query.mockResolvedValueOnce([]); // assignments

      const result = await service.loadSurveyQuestionsAndAssignments(1);

      expect(result.questions).toEqual([]);
      expect(result.assignments).toEqual([]);
    });

    it('should load questions with options attached', async () => {
      // questions
      mockDb.query.mockResolvedValueOnce([
        { id: 1, question_type: 'single_choice', survey_id: 1 },
        { id: 2, question_type: 'text', survey_id: 1 },
      ]);
      // options for questions
      mockDb.query.mockResolvedValueOnce([
        { id: 10, question_id: 1, option_text: 'Yes', order_position: 0 },
        { id: 11, question_id: 1, option_text: 'No', order_position: 1 },
      ]);
      // assignments
      mockDb.query.mockResolvedValueOnce([{ id: 1, assignment_type: 'all' }]);

      const result = await service.loadSurveyQuestionsAndAssignments(1);

      expect(result.questions).toHaveLength(2);
      expect(result.questions[0]?.options).toHaveLength(2);
      expect(result.assignments).toHaveLength(1);
    });
  });

  // =============================================================
  // insertSurveyQuestions
  // =============================================================

  describe('insertSurveyQuestions', () => {
    it('should insert questions without options', async () => {
      // INSERT question RETURNING id
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);

      await service.insertSurveyQuestions(10, 1, [{ questionText: 'How?', questionType: 'text' }]);

      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('should insert questions with options', async () => {
      // INSERT question RETURNING id
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);
      // INSERT option 1
      mockDb.query.mockResolvedValueOnce([]);
      // INSERT option 2
      mockDb.query.mockResolvedValueOnce([]);

      await service.insertSurveyQuestions(10, 1, [
        {
          questionText: 'Pick one',
          questionType: 'single_choice',
          options: ['A', 'B'],
        },
      ]);

      expect(mockDb.query).toHaveBeenCalledTimes(3);
    });
  });

  // =============================================================
  // insertQuestionOptions
  // =============================================================

  describe('insertQuestionOptions', () => {
    it('should skip when no options', async () => {
      await service.insertQuestionOptions(10, 1, {
        question_type: 'text',
      });

      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should skip for non-choice types', async () => {
      await service.insertQuestionOptions(10, 1, {
        question_type: 'rating',
        options: ['1', '2', '3'],
      });

      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should insert options for single_choice', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);

      await service.insertQuestionOptions(10, 1, {
        question_type: 'single_choice',
        options: ['Yes', 'No'],
      });

      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });
  });

  // =============================================================
  // insertSurveyAssignments
  // =============================================================

  describe('insertSurveyAssignments', () => {
    it('should insert assignments', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.insertSurveyAssignments(10, 1, [{ type: 'all' }]);

      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });
  });
});
