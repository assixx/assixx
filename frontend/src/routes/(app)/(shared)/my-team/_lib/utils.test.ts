/**
 * Unit tests for my-team utility functions
 *
 * Pure functions — no mocks needed.
 */
import { describe, expect, it } from 'vitest';

import {
  buildUserSlug,
  filterBySearch,
  formatDate,
  getAvatarColorIndex,
  getAvailabilityInfo,
  getInitials,
  getRoleBadgeClass,
  getRoleLabel,
} from './utils.js';

import type { TeamMember } from './types.js';

function makeMember(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    id: 1,
    uuid: '019d31ba-0248-7095-8170-e58a6c57b17b',
    username: 'maxm',
    email: 'max@example.com',
    firstName: 'Max',
    lastName: 'Mustermann',
    position: undefined,
    employeeId: undefined,
    role: undefined,
    userRole: undefined,
    availabilityStatus: undefined,
    availabilityStart: undefined,
    availabilityEnd: undefined,
    ...overrides,
  };
}

describe('buildUserSlug', () => {
  it('should create slug from firstName-lastName-uuid', () => {
    const slug = buildUserSlug(makeMember());
    expect(slug).toBe('max-mustermann-019d31ba-0248-7095-8170-e58a6c57b17b');
  });

  it('should handle umlauts in names', () => {
    const slug = buildUserSlug(makeMember({ firstName: 'Jörg', lastName: 'Müller' }));
    expect(slug).toContain('jörg-müller-');
  });

  it('should lowercase the name part', () => {
    const slug = buildUserSlug(makeMember({ firstName: 'ANNA', lastName: 'SCHMIDT' }));
    expect(slug).toMatch(/^anna-schmidt-/);
  });
});

describe('getRoleLabel', () => {
  it('should return lead label for lead role', () => {
    expect(getRoleLabel('lead', 'Teamleiter')).toBe('Teamleiter');
  });

  it('should return "Mitglied" for member role', () => {
    expect(getRoleLabel('member', 'Teamleiter')).toBe('Mitglied');
  });

  it('should return "Mitglied" for undefined', () => {
    expect(getRoleLabel(undefined, 'Teamleiter')).toBe('Mitglied');
  });
});

describe('getRoleBadgeClass', () => {
  it('should return badge--primary for lead', () => {
    expect(getRoleBadgeClass('lead')).toBe('badge--primary');
  });

  it('should return badge--secondary for member', () => {
    expect(getRoleBadgeClass('member')).toBe('badge--secondary');
  });
});

describe('getAvailabilityInfo', () => {
  it('should return Verfügbar for undefined status', () => {
    const info = getAvailabilityInfo(undefined);
    expect(info.label).toBe('Verfügbar');
    expect(info.badgeClass).toBe('badge--success');
  });

  it('should return correct label for vacation', () => {
    expect(getAvailabilityInfo('vacation').label).toBe('Urlaub');
  });

  it('should return correct label for sick', () => {
    expect(getAvailabilityInfo('sick').label).toBe('Krank');
  });

  it('should fallback to raw status for unknown values', () => {
    expect(getAvailabilityInfo('custom_status').label).toBe('custom_status');
  });
});

describe('formatDate', () => {
  it('should return empty string for undefined', () => {
    expect(formatDate(undefined)).toBe('');
  });

  it('should return empty string for empty string', () => {
    expect(formatDate('')).toBe('');
  });

  it('should format ISO date to German locale', () => {
    const result = formatDate('2026-03-15T00:00:00.000Z');
    expect(result).toMatch(/15\.03\.2026/);
  });
});

describe('getInitials', () => {
  it('should return first letter of each name', () => {
    expect(getInitials('Max', 'Mustermann')).toBe('MM');
  });

  it('should uppercase initials', () => {
    expect(getInitials('anna', 'schmidt')).toBe('AS');
  });
});

describe('getAvatarColorIndex', () => {
  it('should return a number 0–9', () => {
    const index = getAvatarColorIndex('Max', 'Mustermann');
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThanOrEqual(9);
  });

  it('should return consistent index for same name', () => {
    const a = getAvatarColorIndex('Max', 'Mustermann');
    const b = getAvatarColorIndex('Max', 'Mustermann');
    expect(a).toBe(b);
  });
});

describe('filterBySearch', () => {
  const members = [
    makeMember({ firstName: 'Max', lastName: 'Mustermann', email: 'max@test.de' }),
    makeMember({
      id: 2,
      firstName: 'Anna',
      lastName: 'Schmidt',
      email: 'anna@test.de',
      position: 'Developer',
    }),
    makeMember({ id: 3, firstName: 'John', lastName: 'Doe', email: 'john@test.de' }),
  ];

  it('should return all members for empty query', () => {
    expect(filterBySearch(members, '')).toHaveLength(3);
  });

  it('should filter by first name', () => {
    expect(filterBySearch(members, 'max')).toHaveLength(1);
  });

  it('should filter by last name', () => {
    expect(filterBySearch(members, 'Schmidt')).toHaveLength(1);
  });

  it('should filter by email', () => {
    expect(filterBySearch(members, 'john@test')).toHaveLength(1);
  });

  it('should filter by position', () => {
    expect(filterBySearch(members, 'Developer')).toHaveLength(1);
  });

  it('should be case-insensitive', () => {
    expect(filterBySearch(members, 'ANNA')).toHaveLength(1);
  });

  it('should return empty for no match', () => {
    expect(filterBySearch(members, 'xyz')).toHaveLength(0);
  });
});
