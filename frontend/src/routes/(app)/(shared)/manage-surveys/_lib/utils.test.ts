/**
 * Unit tests for manage-surveys utility functions.
 *
 * Pure functions only — no mocks needed.
 *
 * @see docs/infrastructure/adr/ADR-018-testing-strategy.md §Tier 1b (frontend-unit)
 */
import { describe, expect, it } from 'vitest';

import { canAssignSurveyCompanyWide, type CurrentUserContext } from './utils.js';

function makeUser(overrides: Partial<CurrentUserContext> = {}): CurrentUserContext {
  return {
    userId: 1,
    role: 'employee',
    hasFullAccess: false,
    ...overrides,
  };
}

describe('canAssignSurveyCompanyWide', () => {
  describe('when user is root', () => {
    it('should return true regardless of hasFullAccess', () => {
      expect(canAssignSurveyCompanyWide(makeUser({ role: 'root', hasFullAccess: false }))).toBe(
        true,
      );
      expect(canAssignSurveyCompanyWide(makeUser({ role: 'root', hasFullAccess: true }))).toBe(
        true,
      );
    });
  });

  describe('when user is admin', () => {
    it('should return true when hasFullAccess is true', () => {
      expect(canAssignSurveyCompanyWide(makeUser({ role: 'admin', hasFullAccess: true }))).toBe(
        true,
      );
    });

    it('should return false when hasFullAccess is false (scoped admin)', () => {
      expect(canAssignSurveyCompanyWide(makeUser({ role: 'admin', hasFullAccess: false }))).toBe(
        false,
      );
    });
  });

  describe('when user is employee', () => {
    it('should return false even if somehow hasFullAccess is true', () => {
      // hasFullAccess only elevates admins; an employee never becomes tenant-wide.
      expect(canAssignSurveyCompanyWide(makeUser({ role: 'employee', hasFullAccess: true }))).toBe(
        false,
      );
    });

    it('should return false for regular employee', () => {
      expect(canAssignSurveyCompanyWide(makeUser({ role: 'employee', hasFullAccess: false }))).toBe(
        false,
      );
    });
  });

  describe('when user is dummy', () => {
    it('should return false', () => {
      expect(canAssignSurveyCompanyWide(makeUser({ role: 'dummy', hasFullAccess: false }))).toBe(
        false,
      );
    });
  });

  describe('when role is unexpected', () => {
    it('should return false for unknown role string', () => {
      expect(canAssignSurveyCompanyWide(makeUser({ role: 'guest', hasFullAccess: true }))).toBe(
        false,
      );
    });

    it('should return false for empty role string', () => {
      expect(canAssignSurveyCompanyWide(makeUser({ role: '', hasFullAccess: true }))).toBe(false);
    });
  });
});
