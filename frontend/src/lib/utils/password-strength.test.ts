/**
 * Unit tests for Password Strength Helpers
 *
 * Phase 7: Frontend utils — 1 test per function.
 * Only pure switch functions tested. Async zxcvbn functions skipped (dynamic import).
 */
import { describe, expect, it, vi } from 'vitest';

import {
  formatCrackTime,
  getStrengthClass,
  getStrengthColor,
  getStrengthLabel,
} from './password-strength.js';

// Mock logger to avoid $app/environment → pino chain
vi.mock('./logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  }),
}));

describe('password-strength', () => {
  it('getStrengthLabel should return German labels for scores 0-4', () => {
    expect(getStrengthLabel(0)).toBe('Sehr schwach');
    expect(getStrengthLabel(1)).toBe('Schwach');
    expect(getStrengthLabel(2)).toBe('Mittelmäßig');
    expect(getStrengthLabel(3)).toBe('Stark');
    expect(getStrengthLabel(4)).toBe('Sehr stark');
    expect(getStrengthLabel(99)).toBe('Unbekannt');
  });

  it('getStrengthColor should return hex colors for scores 0-4', () => {
    expect(getStrengthColor(0)).toBe('#d32f2f'); // Red
    expect(getStrengthColor(4)).toBe('#388e3c'); // Green
    expect(getStrengthColor(-1)).toBe('#e0e0e0'); // Grey fallback
  });

  it('getStrengthClass should return CSS class names', () => {
    expect(getStrengthClass(0)).toBe('strength-very-weak');
    expect(getStrengthClass(4)).toBe('strength-very-strong');
    expect(getStrengthClass(99)).toBe('strength-unknown');
  });

  it('formatCrackTime should prefix with Knackzeit', () => {
    expect(formatCrackTime('3 Jahre')).toBe('Knackzeit: 3 Jahre');
    expect(formatCrackTime('')).toBe('');
  });
});
