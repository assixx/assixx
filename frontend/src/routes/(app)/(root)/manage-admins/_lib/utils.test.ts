/**
 * Unit tests for manage-admins validation utilities
 *
 * Tests validateEmailsMatch and validatePasswordsMatch — simple equality
 * checks. The "both-or-none" password logic lives inline in the page component
 * (hasPasswordError) and is covered by the manage-employees test suite
 * for the equivalent exported function.
 */
import { describe, expect, it } from 'vitest';

import { getPositionDisplay, validateEmailsMatch, validatePasswordsMatch } from './utils.js';

import type { HierarchyLabels } from '$lib/types/hierarchy-labels';

// =============================================================================
// getPositionDisplay — Lead key resolution with hierarchy labels (ADR-034)
// =============================================================================

describe('getPositionDisplay', () => {
  const customLabels: HierarchyLabels = {
    hall: 'Gebäude',
    area: 'Hallen',
    areaLeadPrefix: 'Hallen',
    department: 'Segmente',
    departmentLeadPrefix: 'Segment',
    team: 'Teams',
    teamLeadPrefix: 'Team',
    asset: 'Maschinen',
  };

  it('should resolve area_lead with default labels', () => {
    expect(getPositionDisplay('area_lead')).toBe('Bereichsleiter');
  });

  it('should resolve department_lead with default labels', () => {
    expect(getPositionDisplay('department_lead')).toBe('Abteilungsleiter');
  });

  it('should resolve team_lead with default labels', () => {
    expect(getPositionDisplay('team_lead')).toBe('Teamleiter');
  });

  it('should resolve lead keys with custom labels', () => {
    expect(getPositionDisplay('area_lead', customLabels)).toBe('Hallenleiter');
    expect(getPositionDisplay('department_lead', customLabels)).toBe('Segmentleiter');
  });

  it('should fall through to POSITION_DISPLAY_MAP for known non-lead positions', () => {
    // "geschäftsführer" is mapped in POSITION_DISPLAY_MAP
    expect(getPositionDisplay('geschäftsführer')).toBe('Geschäftsführer');
  });

  it('should pass through unknown positions unchanged', () => {
    expect(getPositionDisplay('CustomRole')).toBe('CustomRole');
  });

  it('should return empty string for empty input', () => {
    expect(getPositionDisplay('')).toBe('');
  });
});

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
