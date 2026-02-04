import { describe, expect, it } from 'vitest';

import {
  FORM_STATUS_OPTIONS,
  IS_ACTIVE,
  STATUS_BADGE_CLASSES,
  STATUS_FILTER_OPTIONS,
  STATUS_LABELS,
} from './is-active.js';

describe('IS_ACTIVE', () => {
  it('should have correct integer values for all statuses', () => {
    expect(IS_ACTIVE.INACTIVE).toBe(0);
    expect(IS_ACTIVE.ACTIVE).toBe(1);
    expect(IS_ACTIVE.ARCHIVED).toBe(3);
    expect(IS_ACTIVE.DELETED).toBe(4);
  });

  it('should have exactly 4 status values', () => {
    expect(Object.keys(IS_ACTIVE)).toHaveLength(4);
  });
});

describe('STATUS_LABELS', () => {
  it('should map all 4 statuses to German labels', () => {
    expect(STATUS_LABELS[0]).toBe('Inaktiv');
    expect(STATUS_LABELS[1]).toBe('Aktiv');
    expect(STATUS_LABELS[3]).toBe('Archiviert');
    expect(STATUS_LABELS[4]).toBe('Gelöscht');
  });
});

describe('STATUS_BADGE_CLASSES', () => {
  it('should map all 4 statuses to CSS badge classes', () => {
    expect(STATUS_BADGE_CLASSES[0]).toBe('badge--warning');
    expect(STATUS_BADGE_CLASSES[1]).toBe('badge--success');
    expect(STATUS_BADGE_CLASSES[3]).toBe('badge--secondary');
    expect(STATUS_BADGE_CLASSES[4]).toBe('badge--error');
  });
});

describe('STATUS_FILTER_OPTIONS', () => {
  it('should have 4 filter options', () => {
    expect(STATUS_FILTER_OPTIONS).toHaveLength(4);
  });

  it('should contain all, active, inactive, archived — no deleted', () => {
    const values = STATUS_FILTER_OPTIONS.map((o) => o.value);
    expect(values).toEqual(['all', 'active', 'inactive', 'archived']);
  });
});

describe('FORM_STATUS_OPTIONS', () => {
  it('should have exactly 3 options (no deleted)', () => {
    expect(FORM_STATUS_OPTIONS).toHaveLength(3);
  });

  it('should NOT contain deleted status (value 4)', () => {
    const values = FORM_STATUS_OPTIONS.map((o) => o.value);
    expect(values).not.toContain(4);
  });

  it('should contain active, inactive, archived with German labels', () => {
    expect(FORM_STATUS_OPTIONS).toEqual([
      { value: 1, label: 'Aktiv' },
      { value: 0, label: 'Inaktiv' },
      { value: 3, label: 'Archiviert' },
    ]);
  });
});
