import { describe, expect, it } from 'vitest';

import { getErrorMessage } from './error.utils.js';

describe('getErrorMessage', () => {
  it('should extract message from Error instance', () => {
    expect(getErrorMessage(new Error('test error'))).toBe('test error');
  });

  it('should return string directly when string is thrown', () => {
    expect(getErrorMessage('raw string error')).toBe('raw string error');
  });

  it('should return "Unknown error" for non-Error, non-string values', () => {
    expect(getErrorMessage(42)).toBe('Unknown error');
    expect(getErrorMessage(null)).toBe('Unknown error');
    expect(getErrorMessage(undefined)).toBe('Unknown error');
    expect(getErrorMessage({ code: 'FAIL' })).toBe('Unknown error');
  });

  it('should handle TypeError and other Error subclasses', () => {
    expect(getErrorMessage(new TypeError('type fail'))).toBe('type fail');
    expect(getErrorMessage(new RangeError('range fail'))).toBe('range fail');
  });
});
