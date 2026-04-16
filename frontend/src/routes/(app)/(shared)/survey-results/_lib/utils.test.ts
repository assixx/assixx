/**
 * Unit tests for survey-results utility functions.
 *
 * Focus: `getAnswerDisplayText` — regression guard for the "ID Ja" bug.
 * The API returns already-resolved option labels in `answerOptions` (e.g.
 * ["Ja"]); the old implementation assumed numeric option IDs and rendered
 * the fallback `` `ID ${id}` ``.
 */
import { describe, expect, it } from 'vitest';

import { getAnswerDisplayText } from './utils.js';

import type { ResponseAnswer } from './types.js';

const base: ResponseAnswer = { questionId: 1 };

describe('getAnswerDisplayText', () => {
  it('returns "Keine Antwort" when the answer is undefined', () => {
    expect(getAnswerDisplayText(undefined)).toBe('Keine Antwort');
  });

  it('returns plain text answers verbatim', () => {
    expect(getAnswerDisplayText({ ...base, answerText: 'Freitext' })).toBe('Freitext');
  });

  it('stringifies numeric answers', () => {
    expect(getAnswerDisplayText({ ...base, answerNumber: 42 })).toBe('42');
  });

  it('returns the option label for yes_no answers (THE BUG)', () => {
    // API shape confirmed 2026-04-16: answerOptions carries resolved labels,
    // not IDs. Old implementation rendered "ID Ja" via getOptionTexts fallback.
    expect(
      getAnswerDisplayText({
        ...base,
        answerText: null,
        answerNumber: null,
        answerDate: null,
        answerOptions: ['Ja'],
      }),
    ).toBe('Ja');
  });

  it('joins multi-select option labels with commas', () => {
    expect(getAnswerDisplayText({ ...base, answerOptions: ['A', 'B', 'C'] })).toBe('A, B, C');
  });

  it('formats date answers in German format', () => {
    const result = getAnswerDisplayText({ ...base, answerDate: '2026-04-16T10:30:00Z' });
    // Regex-match — exact string depends on system timezone.
    expect(result).toMatch(/^\d{2}\.\d{2}\.\d{4},? \d{2}:\d{2}$/);
  });

  it('returns "Keine Antwort" when every answer field is null', () => {
    expect(
      getAnswerDisplayText({
        ...base,
        answerText: null,
        answerNumber: null,
        answerDate: null,
        answerOptions: null,
      }),
    ).toBe('Keine Antwort');
  });
});
