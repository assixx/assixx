/**
 * Unit tests for manage-root validation utilities
 *
 * Tests validateEmailMatch and validatePasswordMatch — same pattern as
 * manage-employees but different module (no shared code between them).
 */
import { describe, expect, it } from 'vitest';

import { validateEmailMatch, validatePasswordMatch } from './utils.js';

// =============================================================================
// validateEmailMatch
// =============================================================================

describe('validateEmailMatch', () => {
  it('should return true when confirm is empty', () => {
    expect(validateEmailMatch('root@test.de', '')).toBe(true);
  });

  it('should return true when emails match (case-insensitive)', () => {
    expect(validateEmailMatch('Root@Test.de', 'root@test.de')).toBe(true);
  });

  it('should return false when emails differ', () => {
    expect(validateEmailMatch('root@test.de', 'other@test.de')).toBe(false);
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
