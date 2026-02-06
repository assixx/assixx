import { describe, expect, it } from 'vitest';

import { AVAILABILITY_STATUSES } from '../types/availability.js';
import {
  AVAILABILITY_BADGE_CLASSES,
  AVAILABILITY_ICONS,
  AVAILABILITY_LABELS,
  AVAILABILITY_OPTIONS,
} from './availability.js';

const ALL_STATUSES = [
  'available',
  'vacation',
  'sick',
  'unavailable',
  'training',
  'other',
] as const;

describe('AVAILABILITY_LABELS', () => {
  it('should have a German label for every AvailabilityStatus', () => {
    for (const status of ALL_STATUSES) {
      expect(typeof AVAILABILITY_LABELS[status]).toBe('string');
      expect(AVAILABILITY_LABELS[status].length).toBeGreaterThan(0);
    }
  });

  it('should have exactly 6 entries', () => {
    expect(Object.keys(AVAILABILITY_LABELS)).toHaveLength(6);
  });

  it('should contain correct German labels', () => {
    expect(AVAILABILITY_LABELS.available).toBe('Verfügbar');
    expect(AVAILABILITY_LABELS.vacation).toBe('Urlaub');
    expect(AVAILABILITY_LABELS.sick).toBe('Krank');
    expect(AVAILABILITY_LABELS.unavailable).toBe('Nicht verfügbar');
    expect(AVAILABILITY_LABELS.training).toBe('Schulung');
    expect(AVAILABILITY_LABELS.other).toBe('Sonstiges');
  });
});

describe('AVAILABILITY_BADGE_CLASSES', () => {
  it('should have a CSS class for every AvailabilityStatus', () => {
    for (const status of ALL_STATUSES) {
      expect(typeof AVAILABILITY_BADGE_CLASSES[status]).toBe('string');
      expect(AVAILABILITY_BADGE_CLASSES[status]).toMatch(/^badge--/);
    }
  });

  it('should have exactly 6 entries', () => {
    expect(Object.keys(AVAILABILITY_BADGE_CLASSES)).toHaveLength(6);
  });

  it('should map to distinct badge classes', () => {
    expect(AVAILABILITY_BADGE_CLASSES.available).toBe('badge--success');
    expect(AVAILABILITY_BADGE_CLASSES.vacation).toBe('badge--warning');
    expect(AVAILABILITY_BADGE_CLASSES.sick).toBe('badge--danger');
    expect(AVAILABILITY_BADGE_CLASSES.unavailable).toBe('badge--error');
    expect(AVAILABILITY_BADGE_CLASSES.training).toBe('badge--info');
    expect(AVAILABILITY_BADGE_CLASSES.other).toBe('badge--dark');
  });
});

describe('AVAILABILITY_ICONS', () => {
  it('should have a FontAwesome icon for every AvailabilityStatus', () => {
    for (const status of ALL_STATUSES) {
      expect(typeof AVAILABILITY_ICONS[status]).toBe('string');
      expect(AVAILABILITY_ICONS[status]).toMatch(/^fa-/);
    }
  });

  it('should have exactly 6 entries', () => {
    expect(Object.keys(AVAILABILITY_ICONS)).toHaveLength(6);
  });
});

describe('AVAILABILITY_OPTIONS', () => {
  it('should have exactly 6 options', () => {
    expect(AVAILABILITY_OPTIONS).toHaveLength(6);
  });

  it('should have value and label for each option', () => {
    for (const option of AVAILABILITY_OPTIONS) {
      expect(typeof option.value).toBe('string');
      expect(typeof option.label).toBe('string');
      expect(option.label.length).toBeGreaterThan(0);
    }
  });

  it('should cover all AvailabilityStatus values', () => {
    const values = AVAILABILITY_OPTIONS.map((o) => o.value);
    expect(values).toEqual([...ALL_STATUSES]);
  });

  it('should have labels matching AVAILABILITY_LABELS', () => {
    for (const option of AVAILABILITY_OPTIONS) {
      expect(option.label).toBe(AVAILABILITY_LABELS[option.value]);
    }
  });

  it('should cover every value from AVAILABILITY_STATUSES', () => {
    const optionValues = AVAILABILITY_OPTIONS.map((o) => o.value);
    for (const status of AVAILABILITY_STATUSES) {
      expect(optionValues).toContain(status);
    }
  });
});
