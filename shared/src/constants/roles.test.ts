import { describe, expect, it } from 'vitest';

import { EXTENDED_USER_ROLES, USER_ROLES } from '../types/user-role.js';
import { EXTENDED_ROLE_LABELS, ROLE_LABELS } from './roles.js';

describe('ROLE_LABELS', () => {
  it('should have a German label for every UserRole', () => {
    for (const role of USER_ROLES) {
      expect(typeof ROLE_LABELS[role]).toBe('string');
      expect(ROLE_LABELS[role].length).toBeGreaterThan(0);
    }
  });

  it('should have exactly 4 entries', () => {
    expect(Object.keys(ROLE_LABELS)).toHaveLength(4);
  });

  it('should contain correct German labels', () => {
    expect(ROLE_LABELS.root).toBe('Root');
    expect(ROLE_LABELS.admin).toBe('Administrator');
    expect(ROLE_LABELS.employee).toBe('Mitarbeiter');
    expect(ROLE_LABELS.dummy).toBe('Dummy');
  });

  it('should cover exactly the USER_ROLES array values', () => {
    const keys = Object.keys(ROLE_LABELS);
    expect(keys).toEqual([...USER_ROLES]);
  });
});

describe('EXTENDED_ROLE_LABELS', () => {
  it('should have a German label for every ExtendedUserRole', () => {
    for (const role of EXTENDED_USER_ROLES) {
      expect(typeof EXTENDED_ROLE_LABELS[role]).toBe('string');
      expect(EXTENDED_ROLE_LABELS[role].length).toBeGreaterThan(0);
    }
  });

  it('should have exactly 6 entries', () => {
    expect(Object.keys(EXTENDED_ROLE_LABELS)).toHaveLength(6);
  });

  it('should contain correct German labels', () => {
    expect(EXTENDED_ROLE_LABELS.root).toBe('Root');
    expect(EXTENDED_ROLE_LABELS.admin).toBe('Administrator');
    expect(EXTENDED_ROLE_LABELS.employee).toBe('Mitarbeiter');
    expect(EXTENDED_ROLE_LABELS.dummy).toBe('Dummy');
    expect(EXTENDED_ROLE_LABELS.team_lead).toBe('Teamleiter');
    expect(EXTENDED_ROLE_LABELS.manager).toBe('Manager');
  });

  it('should be a superset of ROLE_LABELS', () => {
    for (const [role, label] of Object.entries(ROLE_LABELS)) {
      expect(
        EXTENDED_ROLE_LABELS[role as keyof typeof EXTENDED_ROLE_LABELS],
      ).toBe(label);
    }
  });
});
