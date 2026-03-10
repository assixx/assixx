/**
 * Unit tests for manage-admins validation utilities
 *
 * Tests validateEmailsMatch and validatePasswordsMatch — simple equality
 * checks. The "both-or-none" password logic lives inline in the page component
 * (hasPasswordError) and is covered by the manage-employees test suite
 * for the equivalent exported function.
 */
import { describe, expect, it } from 'vitest';

import { validateEmailsMatch, validatePasswordsMatch } from './utils.js';

// =============================================================================
// validateEmailsMatch
// =============================================================================

describe('validateEmailsMatch', () => {
  it('should return true when emails are identical', () => {
    expect(validateEmailsMatch('admin@test.de', 'admin@test.de')).toBe(true);
  });

  it('should return false when emails differ', () => {
    expect(validateEmailsMatch('admin@test.de', 'other@test.de')).toBe(false);
  });

  it('should be case-sensitive (exact match)', () => {
    // Unlike manage-employees, this does NOT normalize case
    expect(validateEmailsMatch('Admin@test.de', 'admin@test.de')).toBe(false);
  });

  it('should return true when both are empty', () => {
    expect(validateEmailsMatch('', '')).toBe(true);
  });
});

// =============================================================================
// validatePasswordsMatch
// =============================================================================

describe('validatePasswordsMatch', () => {
  it('should return true when passwords match', () => {
    expect(validatePasswordsMatch('Secret123!', 'Secret123!')).toBe(true);
  });

  it('should return true when both are empty', () => {
    expect(validatePasswordsMatch('', '')).toBe(true);
  });

  it('should return false when passwords differ', () => {
    expect(validatePasswordsMatch('Secret123!', 'Different456!')).toBe(false);
  });

  it('should be case-sensitive', () => {
    expect(validatePasswordsMatch('Secret', 'secret')).toBe(false);
  });
});
