/**
 * Unit tests for hierarchy-labels pure functions (ADR-034)
 *
 * Tests isLeadPosition() and resolvePositionDisplay() — the core
 * resolution logic for semantic lead position keys.
 */
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_HIERARCHY_LABELS,
  LEAD_POSITION_KEYS,
  isLeadPosition,
  resolvePositionDisplay,
} from './hierarchy-labels.js';

import type { HierarchyLabels } from './hierarchy-labels.js';

// =============================================================================
// LEAD_POSITION_KEYS
// =============================================================================

describe('LEAD_POSITION_KEYS', () => {
  it('should define area_lead', () => {
    expect(LEAD_POSITION_KEYS.AREA).toBe('area_lead');
  });

  it('should define department_lead', () => {
    expect(LEAD_POSITION_KEYS.DEPARTMENT).toBe('department_lead');
  });

  it('should define team_lead', () => {
    expect(LEAD_POSITION_KEYS.TEAM).toBe('team_lead');
  });
});

// =============================================================================
// isLeadPosition
// =============================================================================

describe('isLeadPosition', () => {
  it('should return true for area_lead', () => {
    expect(isLeadPosition('area_lead')).toBe(true);
  });

  it('should return true for department_lead', () => {
    expect(isLeadPosition('department_lead')).toBe(true);
  });

  it('should return true for team_lead', () => {
    expect(isLeadPosition('team_lead')).toBe(true);
  });

  it('should return false for regular positions', () => {
    expect(isLeadPosition('Personalleiter')).toBe(false);
    expect(isLeadPosition('Schichtleiter')).toBe(false);
    expect(isLeadPosition('Sonstiges')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isLeadPosition('')).toBe(false);
  });

  it('should return false for old compound words', () => {
    expect(isLeadPosition('Bereichsleiter')).toBe(false);
    expect(isLeadPosition('Abteilungsleiter')).toBe(false);
    expect(isLeadPosition('Teamleiter')).toBe(false);
  });

  it('should be case-sensitive', () => {
    expect(isLeadPosition('Area_Lead')).toBe(false);
    expect(isLeadPosition('AREA_LEAD')).toBe(false);
  });
});

// =============================================================================
// resolvePositionDisplay
// =============================================================================

describe('resolvePositionDisplay', () => {
  describe('with default labels', () => {
    it('should resolve area_lead to Bereiche-Leiter', () => {
      expect(
        resolvePositionDisplay('area_lead', DEFAULT_HIERARCHY_LABELS),
      ).toBe('Bereiche-Leiter');
    });

    it('should resolve department_lead to Abteilungen-Leiter', () => {
      expect(
        resolvePositionDisplay('department_lead', DEFAULT_HIERARCHY_LABELS),
      ).toBe('Abteilungen-Leiter');
    });

    it('should resolve team_lead to Teams-Leiter', () => {
      expect(
        resolvePositionDisplay('team_lead', DEFAULT_HIERARCHY_LABELS),
      ).toBe('Teams-Leiter');
    });
  });

  describe('with custom labels (ADR-034 propagation)', () => {
    const customLabels: HierarchyLabels = {
      hall: 'Gebäude',
      area: 'Hallen',
      department: 'Segmente',
      team: 'Crews',
      asset: 'Maschinen',
    };

    it('should resolve area_lead using custom area label', () => {
      expect(resolvePositionDisplay('area_lead', customLabels)).toBe(
        'Hallen-Leiter',
      );
    });

    it('should resolve department_lead using custom department label', () => {
      expect(resolvePositionDisplay('department_lead', customLabels)).toBe(
        'Segmente-Leiter',
      );
    });

    it('should resolve team_lead using custom team label', () => {
      expect(resolvePositionDisplay('team_lead', customLabels)).toBe(
        'Crews-Leiter',
      );
    });
  });

  describe('pass-through for non-lead positions', () => {
    it('should return regular positions unchanged', () => {
      expect(
        resolvePositionDisplay('Personalleiter', DEFAULT_HIERARCHY_LABELS),
      ).toBe('Personalleiter');
    });

    it('should return empty string unchanged', () => {
      expect(resolvePositionDisplay('', DEFAULT_HIERARCHY_LABELS)).toBe('');
    });

    it('should return unknown positions unchanged', () => {
      expect(
        resolvePositionDisplay('CustomPosition', DEFAULT_HIERARCHY_LABELS),
      ).toBe('CustomPosition');
    });
  });
});
