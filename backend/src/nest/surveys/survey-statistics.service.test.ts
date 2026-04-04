/**
 * Unit tests for SurveyStatisticsService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: Statistics computation per question type
 *        (choice, text, rating, date, yes_no), completion rate.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { SurveyStatisticsService } from './survey-statistics.service.js';
import type { DbSurveyQuestion } from './surveys.types.js';

// =============================================================
// Module mocks
// =============================================================

vi.mock('./surveys.helpers.js', () => ({
  parseDbCount: vi.fn((value: number | string | undefined) => {
    if (typeof value === 'string') return Number.parseInt(value, 10);
    return value ?? 0;
  }),
}));

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  const qf = vi.fn();
  return { query: qf, tenantQuery: qf };
}

// =============================================================
// SurveyStatisticsService
// =============================================================

describe('SurveyStatisticsService', () => {
  let service: SurveyStatisticsService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new SurveyStatisticsService(mockDb as unknown as DatabaseService);
  });

  // =============================================================
  // computeStatistics — no questions
  // =============================================================

  describe('computeStatistics', () => {
    it('should return base stats with no questions', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          total_responses: '10',
          completed_responses: '8',
          first_response: new Date('2025-06-01'),
          last_response: new Date('2025-06-15'),
        },
      ]);

      const result = await service.computeStatistics(1, 10, []);

      expect(result.surveyId).toBe(1);
      expect(result.totalResponses).toBe(10);
      expect(result.completedResponses).toBe(8);
      expect(result.completionRate).toBe(80);
      expect(result.questions).toEqual([]);
    });

    it('should return 0 completion rate when no responses', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          total_responses: 0,
          completed_responses: 0,
          first_response: null,
          last_response: null,
        },
      ]);

      const result = await service.computeStatistics(1, 10, []);

      expect(result.completionRate).toBe(0);
    });
  });

  // =============================================================
  // computeStatistics — choice question
  // =============================================================

  describe('computeStatistics — single_choice', () => {
    it('should compute option counts for choice questions', async () => {
      // base stats
      mockDb.query.mockResolvedValueOnce([
        {
          total_responses: 5,
          completed_responses: 5,
          first_response: null,
          last_response: null,
        },
      ]);
      // answer_options for question
      mockDb.query.mockResolvedValueOnce([
        { answer_options: '[1, 2]' },
        { answer_options: '[1]' },
        { answer_options: '[2]' },
      ]);

      const questions: DbSurveyQuestion[] = [
        {
          id: 1,
          question_text: 'Choose one',
          question_type: 'single_choice',
          options: [
            { id: 1, option_text: 'Option A' },
            { id: 2, option_text: 'Option B' },
          ],
        } as unknown as DbSurveyQuestion,
      ];

      const result = await service.computeStatistics(1, 10, questions);

      expect(result.questions).toHaveLength(1);
      expect(result.questions[0]?.options).toHaveLength(2);
      expect(result.questions[0]?.options?.[0]?.count).toBe(2); // Option A selected twice
      expect(result.questions[0]?.options?.[1]?.count).toBe(2); // Option B selected twice
    });
  });

  // =============================================================
  // computeStatistics — text question
  // =============================================================

  describe('computeStatistics — text', () => {
    it('should return text responses', async () => {
      // base stats
      mockDb.query.mockResolvedValueOnce([
        {
          total_responses: 2,
          completed_responses: 2,
          first_response: null,
          last_response: null,
        },
      ]);
      // text responses
      mockDb.query.mockResolvedValueOnce([
        { answer_text: 'Great', user_id: 1, first_name: 'Max', last_name: 'M' },
      ]);

      const questions: DbSurveyQuestion[] = [
        {
          id: 1,
          question_text: 'Comments',
          question_type: 'text',
        } as unknown as DbSurveyQuestion,
      ];

      const result = await service.computeStatistics(1, 10, questions);

      expect(result.questions[0]?.responses).toHaveLength(1);
      expect(result.questions[0]?.responses?.[0]?.answerText).toBe('Great');
    });
  });

  // =============================================================
  // computeStatistics — rating question
  // =============================================================

  describe('computeStatistics — rating', () => {
    it('should return average/min/max stats', async () => {
      // base stats
      mockDb.query.mockResolvedValueOnce([
        {
          total_responses: 3,
          completed_responses: 3,
          first_response: null,
          last_response: null,
        },
      ]);
      // rating stats
      mockDb.query.mockResolvedValueOnce([{ average: 4.5, min: 3, max: 5, total_responses: '3' }]);

      const questions: DbSurveyQuestion[] = [
        {
          id: 1,
          question_text: 'Rate us',
          question_type: 'rating',
        } as unknown as DbSurveyQuestion,
      ];

      const result = await service.computeStatistics(1, 10, questions);

      expect(result.questions[0]?.statistics?.average).toBe(4.5);
      expect(result.questions[0]?.statistics?.min).toBe(3);
      expect(result.questions[0]?.statistics?.max).toBe(5);
    });
  });

  // =============================================================
  // computeStatistics — yes_no question
  // =============================================================

  describe('computeStatistics — yes_no', () => {
    it('should use Ja/Nein as option labels', async () => {
      // base stats
      mockDb.query.mockResolvedValueOnce([
        {
          total_responses: 2,
          completed_responses: 2,
          first_response: null,
          last_response: null,
        },
      ]);
      // answer_options
      mockDb.query.mockResolvedValueOnce([{ answer_options: '[1]' }, { answer_options: '[2]' }]);

      const questions: DbSurveyQuestion[] = [
        {
          id: 1,
          question_text: 'Yes or No?',
          question_type: 'yes_no',
        } as unknown as DbSurveyQuestion,
      ];

      const result = await service.computeStatistics(1, 10, questions);

      expect(result.questions[0]?.options).toHaveLength(2);
      expect(result.questions[0]?.options?.[0]?.optionText).toBe('Ja');
      expect(result.questions[0]?.options?.[1]?.optionText).toBe('Nein');
    });
  });
});
