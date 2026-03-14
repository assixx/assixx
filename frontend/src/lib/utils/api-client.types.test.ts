/**
 * Unit tests for API Client Types — getApiErrorMessage()
 *
 * Tests the error message extraction utility that parses
 * ApiError.details for field-level validation messages.
 */
import { describe, expect, it } from 'vitest';

import { ApiError, getApiErrorMessage } from './api-client.types.js';

describe('getApiErrorMessage', () => {
  it('should return fallback for non-Error values', () => {
    expect(getApiErrorMessage('random string', 'Fallback')).toBe('Fallback');
    expect(getApiErrorMessage(null, 'Fallback')).toBe('Fallback');
    expect(getApiErrorMessage(undefined, 'Fallback')).toBe('Fallback');
  });

  it('should return err.message for regular Error', () => {
    const err = new Error('Something broke');
    expect(getApiErrorMessage(err, 'Fallback')).toBe('Something broke');
  });

  it('should return err.message for ApiError without details', () => {
    const err = new ApiError('Validation failed', 'VALIDATION_ERROR', 400);
    expect(getApiErrorMessage(err, 'Fallback')).toBe('Validation failed');
  });

  // TODO(human): Write 4-5 more test cases here.
  // Each test should use: expect(getApiErrorMessage(input, 'fallback')).toBe(expected)
  //
  // Hint: new ApiError(message, code, status, details?)
  //
  // Cases to cover:
  // 1. ApiError WITH details array containing validation messages
  //    e.g. new ApiError('Validation failed', 'VALIDATION_ERROR', 400,
  //      [{ field: 'employeeNumber', message: 'Max 10 Zeichen', code: 'invalid_format' }])
  // 2. ApiError WITHOUT details (should return err.message)
  // 3. Regular Error (not ApiError) — should return err.message
  // 4. ApiError with empty details array
  // 5. ApiError with multiple validation details (joined with comma)
  // 6. Edge: ApiError with details containing objects without 'message' property
});
