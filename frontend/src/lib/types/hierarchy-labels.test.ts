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

describe('resolvePositionDisplay — default labels', () => {
  it('should resolve area_lead using prefix', () => {
    expect(resolvePositionDisplay('area_lead', DEFAULT_HIERARCHY_LABELS)).toBe('Bereichsleiter');
  });

  it('should resolve area_deputy_lead using prefix', () => {
    expect(resolvePositionDisplay('area_deputy_lead', DEFAULT_HIERARCHY_LABELS)).toBe(
      'Stellv. Bereichsleiter',
    );
  });

  it('should resolve department_lead using prefix', () => {
    expect(resolvePositionDisplay('department_lead', DEFAULT_HIERARCHY_LABELS)).toBe(
      'Abteilungsleiter',
    );
  });

  it('should resolve department_deputy_lead using prefix', () => {
    expect(resolvePositionDisplay('department_deputy_lead', DEFAULT_HIERARCHY_LABELS)).toBe(
      'Stellv. Abteilungsleiter',
    );
  });

  it('should resolve team_lead using prefix', () => {
    expect(resolvePositionDisplay('team_lead', DEFAULT_HIERARCHY_LABELS)).toBe('Teamleiter');
  });

  it('should resolve team_deputy_lead using prefix', () => {
    expect(resolvePositionDisplay('team_deputy_lead', DEFAULT_HIERARCHY_LABELS)).toBe(
      'Stellv. Teamleiter',
    );
  });
});

describe('resolvePositionDisplay — custom labels (ADR-034)', () => {
  const customLabels: HierarchyLabels = {
    hall: 'Gebäude',
    area: 'Hallen',
    areaLeadPrefix: 'Hallen',
    department: 'Segmente',
    departmentLeadPrefix: 'Segment',
    team: 'Crews',
    teamLeadPrefix: 'Crew',
    asset: 'Maschinen',
  };

  it('should resolve area_lead using custom prefix', () => {
    expect(resolvePositionDisplay('area_lead', customLabels)).toBe('Hallenleiter');
  });

  it('should resolve area_deputy_lead using custom prefix', () => {
    expect(resolvePositionDisplay('area_deputy_lead', customLabels)).toBe('Stellv. Hallenleiter');
  });

  it('should resolve department_lead using custom prefix', () => {
    expect(resolvePositionDisplay('department_lead', customLabels)).toBe('Segmentleiter');
  });

  it('should resolve department_deputy_lead using custom prefix', () => {
    expect(resolvePositionDisplay('department_deputy_lead', customLabels)).toBe(
      'Stellv. Segmentleiter',
    );
  });

  it('should resolve team_lead using custom prefix', () => {
    expect(resolvePositionDisplay('team_lead', customLabels)).toBe('Crewleiter');
  });

  it('should resolve team_deputy_lead using custom prefix', () => {
    expect(resolvePositionDisplay('team_deputy_lead', customLabels)).toBe('Stellv. Crewleiter');
  });
});

describe('resolvePositionDisplay — pass-through', () => {
  it('should return regular positions unchanged', () => {
    expect(resolvePositionDisplay('Personalleiter', DEFAULT_HIERARCHY_LABELS)).toBe(
      'Personalleiter',
    );
  });

  it('should return empty string unchanged', () => {
    expect(resolvePositionDisplay('', DEFAULT_HIERARCHY_LABELS)).toBe('');
  });

  it('should return unknown positions unchanged', () => {
    expect(resolvePositionDisplay('CustomPosition', DEFAULT_HIERARCHY_LABELS)).toBe(
      'CustomPosition',
    );
  });
});
