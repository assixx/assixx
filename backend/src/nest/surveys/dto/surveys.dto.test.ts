import { describe, expect, it } from 'vitest';

import { CreateSurveySchema } from './create-survey.dto.js';
import { ExportResponsesQuerySchema } from './export-responses.dto.js';
import { AnswerSchema, SubmitResponseSchema } from './submit-response.dto.js';

// =============================================================
// CreateSurveySchema
// =============================================================

describe('CreateSurveySchema', () => {
  const valid = { title: 'Employee Satisfaction' };

  it('should accept minimal survey', () => {
    expect(CreateSurveySchema.safeParse(valid).success).toBe(true);
  });

  it('should reject title shorter than 3 characters', () => {
    expect(CreateSurveySchema.safeParse({ title: 'AB' }).success).toBe(false);
  });

  it('should reject title longer than 200 characters', () => {
    expect(
      CreateSurveySchema.safeParse({ title: 'T'.repeat(201) }).success,
    ).toBe(false);
  });

  it('should reject description longer than 1000 characters', () => {
    expect(
      CreateSurveySchema.safeParse({
        ...valid,
        description: 'D'.repeat(1001),
      }).success,
    ).toBe(false);
  });

  it('should accept survey with questions', () => {
    const result = CreateSurveySchema.safeParse({
      ...valid,
      questions: [
        { questionText: 'How are you?', questionType: 'text' },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('should accept choice question with 2+ options', () => {
    const result = CreateSurveySchema.safeParse({
      ...valid,
      questions: [
        {
          questionText: 'Pick one',
          questionType: 'single_choice',
          options: ['Option A', 'Option B'],
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('should accept question options as objects', () => {
    const result = CreateSurveySchema.safeParse({
      ...valid,
      questions: [
        {
          questionText: 'Pick one',
          questionType: 'single_choice',
          options: [
            { optionText: 'Option A' },
            { optionText: 'Option B' },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('should reject endDate before startDate (refinement)', () => {
    const result = CreateSurveySchema.safeParse({
      ...valid,
      startDate: '2025-06-15T00:00:00Z',
      endDate: '2025-06-10T00:00:00Z',
    });

    expect(result.success).toBe(false);
  });

  it('should pass when only startDate is provided', () => {
    expect(
      CreateSurveySchema.safeParse({
        ...valid,
        startDate: '2025-06-15T00:00:00Z',
      }).success,
    ).toBe(true);
  });

  it('should accept assignment for all_users (no ID needed)', () => {
    const result = CreateSurveySchema.safeParse({
      ...valid,
      assignments: [{ type: 'all_users' }],
    });

    expect(result.success).toBe(true);
  });

  it('should reject department assignment without departmentId', () => {
    const result = CreateSurveySchema.safeParse({
      ...valid,
      assignments: [{ type: 'department' }],
    });

    expect(result.success).toBe(false);
  });

  it('should accept department assignment with departmentId', () => {
    const result = CreateSurveySchema.safeParse({
      ...valid,
      assignments: [{ type: 'department', departmentId: '5' }],
    });

    expect(result.success).toBe(true);
  });

  it.each([
    'text',
    'single_choice',
    'multiple_choice',
    'rating',
    'yes_no',
    'number',
    'date',
  ] as const)('should accept questionType=%s', (questionType) => {
    expect(
      CreateSurveySchema.safeParse({
        ...valid,
        questions: [{ questionText: 'Q?', questionType }],
      }).success,
    ).toBe(true);
  });
});

// =============================================================
// AnswerSchema / SubmitResponseSchema
// =============================================================

describe('AnswerSchema', () => {
  it('should accept answer with questionId', () => {
    expect(
      AnswerSchema.safeParse({ questionId: '1', answerText: 'Yes' }).success,
    ).toBe(true);
  });

  it('should accept answer with question_id (snake_case)', () => {
    expect(
      AnswerSchema.safeParse({ question_id: '2', answerText: 'No' }).success,
    ).toBe(true);
  });

  it('should reject answer without any question ID (refinement)', () => {
    expect(
      AnswerSchema.safeParse({ answerText: 'Orphan answer' }).success,
    ).toBe(false);
  });

  it('should coerce answerNumber from string', () => {
    const data = AnswerSchema.parse({
      questionId: '1',
      answerNumber: '4.5',
    });

    expect(data.answerNumber).toBe(4.5);
  });
});

describe('SubmitResponseSchema', () => {
  it('should accept valid response with one answer', () => {
    expect(
      SubmitResponseSchema.safeParse({
        answers: [{ questionId: '1', answerText: 'Good' }],
      }).success,
    ).toBe(true);
  });

  it('should reject empty answers array', () => {
    expect(
      SubmitResponseSchema.safeParse({ answers: [] }).success,
    ).toBe(false);
  });
});

// =============================================================
// ExportResponsesQuerySchema
// =============================================================

describe('ExportResponsesQuerySchema', () => {
  it('should accept empty query (format optional)', () => {
    expect(ExportResponsesQuerySchema.safeParse({}).success).toBe(true);
  });

  it.each(['csv', 'excel'] as const)(
    'should accept format=%s',
    (format) => {
      expect(
        ExportResponsesQuerySchema.safeParse({ format }).success,
      ).toBe(true);
    },
  );

  it('should reject invalid format', () => {
    expect(
      ExportResponsesQuerySchema.safeParse({ format: 'pdf' }).success,
    ).toBe(false);
  });
});
