/**
 * Dummy Users Helpers — Unit Tests
 *
 * Tests: mapDummyUserRowToApi, buildDummyEmail, buildDummyEmployeeNumber
 * Pattern: ADR-018 — Pure function tests, no DI, no DB.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { describe, expect, it } from 'vitest';

import {
  buildDummyEmail,
  buildDummyEmployeeNumber,
  mapDummyUserRowToApi,
} from './dummy-users.helpers.js';
import type { DummyUserWithTeamsRow } from './dummy-users.types.js';

/** Minimal valid row with all required fields */
function createMinimalRow(overrides: Partial<DummyUserWithTeamsRow> = {}): DummyUserWithTeamsRow {
  return {
    id: 1,
    uuid: '019c9547-9fc0-771a-b022-3767e233d6f3',
    tenant_id: 10,
    email: 'dummy_1@testfirma.display',
    display_name: 'Halle 1 Display',
    employee_number: 'DUMMY-001',
    role: 'dummy',
    is_active: IS_ACTIVE.ACTIVE,
    has_full_access: false,
    created_at: '2026-03-03T10:00:00.000Z',
    updated_at: '2026-03-03T10:00:00.000Z',
    team_ids: null,
    team_names: null,
    department_ids: null,
    department_names: null,
    area_ids: null,
    area_names: null,
    ...overrides,
  };
}

// =============================================================
// mapDummyUserRowToApi
// =============================================================

describe('mapDummyUserRowToApi', () => {
  it('should map basic fields correctly', () => {
    const row = createMinimalRow();
    const result = mapDummyUserRowToApi(row);

    expect(result.uuid).toBe('019c9547-9fc0-771a-b022-3767e233d6f3');
    expect(result.email).toBe('dummy_1@testfirma.display');
    expect(result.displayName).toBe('Halle 1 Display');
    expect(result.employeeNumber).toBe('DUMMY-001');
    expect(result.isActive).toBe(1);
    expect(result.createdAt).toBe('2026-03-03T10:00:00.000Z');
    expect(result.updatedAt).toBe('2026-03-03T10:00:00.000Z');
  });

  it('should trim uuid whitespace', () => {
    const row = createMinimalRow({
      uuid: '  019c9547-9fc0-771a-b022-3767e233d6f3  ',
    });
    const result = mapDummyUserRowToApi(row);
    expect(result.uuid).toBe('019c9547-9fc0-771a-b022-3767e233d6f3');
  });

  it('should return empty arrays when JOINs yield null', () => {
    const row = createMinimalRow();
    const result = mapDummyUserRowToApi(row);

    expect(result.teamIds).toEqual([]);
    expect(result.teamNames).toEqual([]);
    expect(result.departmentIds).toEqual([]);
    expect(result.departmentNames).toEqual([]);
    expect(result.areaIds).toEqual([]);
    expect(result.areaNames).toEqual([]);
  });

  it('should parse single team from STRING_AGG', () => {
    const row = createMinimalRow({
      team_ids: '5',
      team_names: 'Frühschicht',
    });
    const result = mapDummyUserRowToApi(row);

    expect(result.teamIds).toEqual([5]);
    expect(result.teamNames).toEqual(['Frühschicht']);
  });

  it('should parse multiple teams from STRING_AGG', () => {
    const row = createMinimalRow({
      team_ids: '5,12,3',
      team_names: 'Frühschicht,Spätschicht,Nachtschicht',
    });
    const result = mapDummyUserRowToApi(row);

    expect(result.teamIds).toEqual([5, 12, 3]);
    expect(result.teamNames).toEqual(['Frühschicht', 'Spätschicht', 'Nachtschicht']);
  });

  it('should parse departments and areas from STRING_AGG', () => {
    const row = createMinimalRow({
      department_ids: '1,2',
      department_names: 'Produktion,Logistik',
      area_ids: '10',
      area_names: 'Werk Nord',
    });
    const result = mapDummyUserRowToApi(row);

    expect(result.departmentIds).toEqual([1, 2]);
    expect(result.departmentNames).toEqual(['Produktion', 'Logistik']);
    expect(result.areaIds).toEqual([10]);
    expect(result.areaNames).toEqual(['Werk Nord']);
  });

  it('should handle empty string aggregates', () => {
    const row = createMinimalRow({ team_ids: '', team_names: '' });
    const result = mapDummyUserRowToApi(row);

    expect(result.teamIds).toEqual([]);
    expect(result.teamNames).toEqual([]);
  });

  it('should handle Date objects for timestamps', () => {
    const row = createMinimalRow({
      created_at: new Date('2026-01-15T08:30:00.000Z') as unknown as string,
      updated_at: new Date('2026-02-20T14:45:00.000Z') as unknown as string,
    });
    const result = mapDummyUserRowToApi(row);

    expect(result.createdAt).toBe('2026-01-15T08:30:00.000Z');
    expect(result.updatedAt).toBe('2026-02-20T14:45:00.000Z');
  });

  it('should trim whitespace in STRING_AGG values', () => {
    const row = createMinimalRow({
      team_ids: ' 5 , 12 ',
      team_names: ' Frühschicht , Spätschicht ',
    });
    const result = mapDummyUserRowToApi(row);

    expect(result.teamIds).toEqual([5, 12]);
    expect(result.teamNames).toEqual(['Frühschicht', 'Spätschicht']);
  });
});

// =============================================================
// buildDummyEmail
// =============================================================

describe('buildDummyEmail', () => {
  it('should generate email with number and subdomain', () => {
    expect(buildDummyEmail(1, 'testfirma')).toBe('dummy_1@testfirma.display');
  });

  it('should use sequential numbering', () => {
    expect(buildDummyEmail(5, 'acme')).toBe('dummy_5@acme.display');
    expect(buildDummyEmail(42, 'acme')).toBe('dummy_42@acme.display');
  });

  it('should handle large numbers', () => {
    expect(buildDummyEmail(999, 'factory')).toBe('dummy_999@factory.display');
  });
});

// =============================================================
// buildDummyEmployeeNumber
// =============================================================

describe('buildDummyEmployeeNumber', () => {
  it('should generate zero-padded 3-digit number', () => {
    expect(buildDummyEmployeeNumber(1)).toBe('DUMMY-001');
  });

  it('should pad single digit', () => {
    expect(buildDummyEmployeeNumber(9)).toBe('DUMMY-009');
  });

  it('should pad double digit', () => {
    expect(buildDummyEmployeeNumber(10)).toBe('DUMMY-010');
    expect(buildDummyEmployeeNumber(99)).toBe('DUMMY-099');
  });

  it('should not pad triple digit', () => {
    expect(buildDummyEmployeeNumber(100)).toBe('DUMMY-100');
    expect(buildDummyEmployeeNumber(999)).toBe('DUMMY-999');
  });

  it('should handle numbers beyond 999', () => {
    expect(buildDummyEmployeeNumber(1000)).toBe('DUMMY-1000');
  });
});
