/**
 * Unit tests for survey utility functions.
 *
 * Focus: `classifyAnswerDisplay` — the regression guard for the bug where
 * yes_no / choice answers rendered as empty <p> because the API returns
 * JSON null for unpopulated answer_* columns and the old template check
 * `!== undefined` let null through.
 */
import { describe, expect, it } from 'vitest';

import { classifyAnswerDisplay } from './utils.js';

import type { ResponseAnswer } from './types.js';

const base: ResponseAnswer = { questionId: 1, questionText: 'Q?' };

describe('classifyAnswerDisplay', () => {
  it('classifies non-empty text answers', () => {
    expect(classifyAnswerDisplay({ ...base, answerText: 'Hello' })).toEqual({
      kind: 'text',
      text: 'Hello',
    });
  });

  it('classifies numeric answers as rating when questionType is rating', () => {
    expect(classifyAnswerDisplay({ ...base, questionType: 'rating', answerNumber: 5 })).toEqual({
      kind: 'rating',
      value: 5,
    });
  });

  it('keeps zero as a valid rating (regression: truthy check would drop it)', () => {
    expect(classifyAnswerDisplay({ ...base, questionType: 'rating', answerNumber: 0 })).toEqual({
      kind: 'rating',
      value: 0,
    });
  });

  it('classifies numeric answers as number when questionType is not rating', () => {
    expect(classifyAnswerDisplay({ ...base, questionType: 'number', answerNumber: 42 })).toEqual({
      kind: 'number',
      value: 42,
    });
  });

  it('classifies date answers', () => {
    expect(classifyAnswerDisplay({ ...base, answerDate: '2026-04-16' })).toEqual({
      kind: 'date',
      date: '2026-04-16',
    });
  });

  it('classifies yes_no with null scalar fields as options (THE BUG)', () => {
    // API payload shape confirmed 2026-04-16: answerText/Number/Date are JSON
    // null, answerOptions carries the selected label. Old `!== undefined`
    // check matched null → empty <p>. typeof narrowing + discriminated return
    // now routes correctly to the options branch.
    expect(
      classifyAnswerDisplay({
        ...base,
        questionType: 'yes_no',
        answerText: null,
        answerNumber: null,
        answerDate: null,
        answerOptions: ['Ja'],
      }),
    ).toEqual({ kind: 'options', options: ['Ja'] });
  });

  it('returns empty when every answer field is null or missing', () => {
    expect(
      classifyAnswerDisplay({
        ...base,
        answerText: null,
        answerNumber: null,
        answerDate: null,
        answerOptions: null,
      }),
    ).toEqual({ kind: 'empty' });
  });
});
