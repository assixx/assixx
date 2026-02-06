/**
 * Unit tests for Survey Helpers
 *
 * Phase 6: Pure function tests — 1 test per function, no mocking needed.
 */
import { describe, expect, it } from 'vitest';

import {
  buildAssignmentData,
  buildQuestionData,
  normalizeAnswers,
  parseDbCount,
  transformSurveyToApi,
  transformSurveyWithMetadata,
} from './surveys.helpers.js';
import type { DbSurvey } from './surveys.types.js';

describe('surveys.helpers', () => {
  it('buildQuestionData should convert camelCase input to snake_case payload', () => {
    const result = buildQuestionData(
      {
        questionText: 'How are you?',
        questionType: 'text',
        isRequired: 1,
        options: ['Good', { optionText: 'Bad' }],
      },
      0,
    );

    expect(result.question_text).toBe('How are you?');
    expect(result.is_required).toBe(true);
    expect(result.order_position).toBe(1);
    expect(result.options).toEqual(['Good', 'Bad']);
  });

  it('buildAssignmentData should map camelCase to snake_case with null defaults', () => {
    const result = buildAssignmentData({
      type: 'department',
      departmentId: 5,
    });

    expect(result.type).toBe('department');
    expect(result.department_id).toBe(5);
    expect(result.area_id).toBeNull();
    expect(result.team_id).toBeNull();
    expect(result.user_id).toBeNull();
  });

  it('normalizeAnswers should handle mixed camelCase and snake_case input', () => {
    const result = normalizeAnswers([
      { questionId: 1, answerText: 'Yes' },
      { question_id: 2, answer_text: 'No' },
    ]);

    expect(result[0]!.question_id).toBe(1);
    expect(result[0]!.answer_text).toBe('Yes');
    expect(result[1]!.question_id).toBe(2);
    expect(result[1]!.answer_text).toBe('No');
  });

  it('transformSurveyToApi should convert DB survey with nested questions', () => {
    const survey = {
      id: 1,
      title: 'Test Survey',
      created_at: new Date('2025-01-01T00:00:00Z'),
      questions: [
        {
          id: 10,
          question_text: 'Q1',
          order_position: 1,
          options: ['A', 'B'],
        },
      ],
    };

    const result = transformSurveyToApi(survey);

    expect(result['title']).toBe('Test Survey');
    expect(result['createdAt']).toBe('2025-01-01T00:00:00.000Z');
    const questions = result['questions'] as Record<string, unknown>[];
    expect(questions[0]!['questionText']).toBe('Q1');
    expect(questions[0]!['orderPosition']).toBe(1);
  });

  it('transformSurveyWithMetadata should parse string counts to numbers', () => {
    const survey: DbSurvey = {
      id: 1,
      uuid: 'uuid-1',
      tenant_id: 10,
      title: 'Survey',
      created_by: 5,
      status: 'active',
      is_anonymous: 0,
      created_at: new Date('2025-01-01'),
      updated_at: new Date('2025-01-02'),
      response_count: '15',
      completed_count: '10',
      creator_first_name: 'John',
      creator_last_name: 'Doe',
    };

    const result = transformSurveyWithMetadata(survey);

    expect(result['responseCount']).toBe(15);
    expect(result['completedCount']).toBe(10);
    expect(result['creatorFirstName']).toBe('John');
  });

  it('parseDbCount should handle string, number, and undefined', () => {
    expect(parseDbCount('42')).toBe(42);
    expect(parseDbCount(7)).toBe(7);
    expect(parseDbCount(undefined)).toBe(0);
  });
});
