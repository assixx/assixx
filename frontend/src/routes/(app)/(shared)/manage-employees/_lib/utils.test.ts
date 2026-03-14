/**
 * Unit tests for manage-employees validation utilities
 *
 * Security-critical: Tests the "both-or-none" password validation pattern
 * that prevents unconfirmed password changes in edit mode.
 */
import { describe, expect, it } from 'vitest';

import {
  validateEmailMatch,
  validatePasswordMatch,
  validateSaveEmployeeForm,
} from './utils.js';

// Shared test constants
const E = 'test@example.de';
const P = 'SuperSecret123!';

// =============================================================================
// validateEmailMatch
// =============================================================================

describe('validateEmailMatch', () => {
  it('should return true when confirm is empty', () => {
    expect(validateEmailMatch('admin@test.de', '')).toBe(true);
  });

  it('should return true when emails match (case-insensitive)', () => {
    expect(validateEmailMatch('Admin@Test.de', 'admin@test.de')).toBe(true);
  });

  it('should return false when emails differ', () => {
    expect(validateEmailMatch('admin@test.de', 'other@test.de')).toBe(false);
  });
});

// =============================================================================
// validatePasswordMatch
// =============================================================================

describe('validatePasswordMatch', () => {
  it('should return true when both passwords are identical', () => {
    expect(validatePasswordMatch('Secret123!', 'Secret123!')).toBe(true);
  });

  it('should return true when both are empty', () => {
    expect(validatePasswordMatch('', '')).toBe(true);
  });

  it('should return false when passwords differ', () => {
    expect(validatePasswordMatch('Secret123!', 'Different456!')).toBe(false);
  });

  it('should be case-sensitive', () => {
    expect(validatePasswordMatch('Secret123!', 'secret123!')).toBe(false);
  });
});

// =============================================================================
// validateSaveEmployeeForm — Create Mode
// =============================================================================

describe('validateSaveEmployeeForm — create mode', () => {
  it('should return null when all fields valid', () => {
    expect(validateSaveEmployeeForm(E, E, P, P, false)).toBeNull();
  });

  it('should return "password" when both password fields empty', () => {
    expect(validateSaveEmployeeForm(E, E, '', '', false)).toBe('password');
  });

  it('should return "password" when password filled but confirm empty', () => {
    expect(validateSaveEmployeeForm(E, E, P, '', false)).toBe('password');
  });

  it('should return "password" when confirm filled but password empty', () => {
    expect(validateSaveEmployeeForm(E, E, '', P, false)).toBe('password');
  });

  it('should return "password" when passwords do not match', () => {
    expect(validateSaveEmployeeForm(E, E, 'A!', 'B!', false)).toBe('password');
  });

  it('should return "email" when emails differ (checked first)', () => {
    expect(validateSaveEmployeeForm('a@t.de', 'b@t.de', P, P, false)).toBe(
      'email',
    );
  });

  it('should return "email" even when passwords also invalid', () => {
    expect(validateSaveEmployeeForm('a@t.de', 'b@t.de', '', '', false)).toBe(
      'email',
    );
  });
});

// =============================================================================
// validateSaveEmployeeForm — Edit Mode (both-or-none password logic)
// =============================================================================

describe('validateSaveEmployeeForm — edit mode', () => {
  it('should return null when both password fields empty (no change)', () => {
    expect(validateSaveEmployeeForm(E, E, '', '', true)).toBeNull();
  });

  it('should return null when both filled and matching', () => {
    expect(validateSaveEmployeeForm(E, E, P, P, true)).toBeNull();
  });

  it('should return "password" when only password filled', () => {
    expect(validateSaveEmployeeForm(E, E, P, '', true)).toBe('password');
  });

  it('should return "password" when only confirm filled', () => {
    expect(validateSaveEmployeeForm(E, E, '', P, true)).toBe('password');
  });

  it('should return "password" when both filled but different', () => {
    expect(validateSaveEmployeeForm(E, E, 'A!', 'B!', true)).toBe('password');
  });

  it('should return "email" when emails differ (checked first)', () => {
    expect(validateSaveEmployeeForm('a@t.de', 'b@t.de', '', '', true)).toBe(
      'email',
    );
  });
});

// =============================================================================
// validateSaveEmployeeForm — Browser Autofill Defense
// =============================================================================

describe('validateSaveEmployeeForm — autofill defense', () => {
  it('should reject autofill: password filled, confirm empty (edit)', () => {
    expect(validateSaveEmployeeForm(E, E, 'autofilled', '', true)).toBe(
      'password',
    );
  });

  it('should reject autofill: password filled, confirm empty (create)', () => {
    expect(validateSaveEmployeeForm(E, E, 'autofilled', '', false)).toBe(
      'password',
    );
  });
});
