/**
 * DTO Validation Tests for DefectStatsQuerySchema
 *
 * Tests year coercion, defaults, and boundary validation.
 */
import { describe, expect, it } from 'vitest';

import { DefectStatsQuerySchema } from './defect-stats-query.dto.js';

describe('DefectStatsQuerySchema', () => {
  it('should default year to current year when omitted', () => {
    const result = DefectStatsQuerySchema.parse({});

    expect(result.year).toBe(new Date().getFullYear());
  });

  it('should coerce string year to number', () => {
    const result = DefectStatsQuerySchema.parse({ year: '2025' });

    expect(result.year).toBe(2025);
  });

  it('should accept valid year 2020', () => {
    const result = DefectStatsQuerySchema.safeParse({ year: 2020 });

    expect(result.success).toBe(true);
  });

  it('should accept valid year 2099', () => {
    const result = DefectStatsQuerySchema.safeParse({ year: 2099 });

    expect(result.success).toBe(true);
  });

  it('should reject year below 2020', () => {
    const result = DefectStatsQuerySchema.safeParse({ year: 2019 });

    expect(result.success).toBe(false);
  });

  it('should reject year above 2099', () => {
    const result = DefectStatsQuerySchema.safeParse({ year: 2100 });

    expect(result.success).toBe(false);
  });

  it('should reject non-integer year', () => {
    const result = DefectStatsQuerySchema.safeParse({ year: 2025.5 });

    expect(result.success).toBe(false);
  });

  it('should reject non-numeric string', () => {
    const result = DefectStatsQuerySchema.safeParse({ year: 'abc' });

    expect(result.success).toBe(false);
  });
});
