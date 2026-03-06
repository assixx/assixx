/**
 * DTO validation tests for ShiftAssignmentsQuerySchema
 *
 * Tests: date format validation, date range refinement, edge cases.
 * Pattern: ADR-018 Phase 8 — Zod .safeParse() assertions.
 */
import { describe, expect, it } from 'vitest';

import { ShiftAssignmentsQuerySchema } from './shift-assignments-query.dto.js';

// =============================================================
// ShiftAssignmentsQuerySchema
// =============================================================

describe('ShiftAssignmentsQuerySchema', () => {
  const valid = {
    startDate: '2026-03-01',
    endDate: '2026-03-31',
  };

  // -----------------------------------------------------------
  // Happy path
  // -----------------------------------------------------------

  it('should accept valid date range', () => {
    const result = ShiftAssignmentsQuerySchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should accept same start and end date', () => {
    const result = ShiftAssignmentsQuerySchema.safeParse({
      startDate: '2026-03-15',
      endDate: '2026-03-15',
    });
    expect(result.success).toBe(true);
  });

  it('should accept large date range up to 3650 days', () => {
    const result = ShiftAssignmentsQuerySchema.safeParse({
      startDate: '2026-01-01',
      endDate: '2035-12-28',
    });
    expect(result.success).toBe(true);
  });

  // -----------------------------------------------------------
  // startDate validation
  // -----------------------------------------------------------

  it('should reject missing startDate', () => {
    const result = ShiftAssignmentsQuerySchema.safeParse({
      endDate: '2026-03-31',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid startDate format', () => {
    const result = ShiftAssignmentsQuerySchema.safeParse({
      startDate: '03-01-2026',
      endDate: '2026-03-31',
    });
    expect(result.success).toBe(false);
  });

  it('should reject startDate with time component', () => {
    const result = ShiftAssignmentsQuerySchema.safeParse({
      startDate: '2026-03-01T00:00:00',
      endDate: '2026-03-31',
    });
    expect(result.success).toBe(false);
  });

  // -----------------------------------------------------------
  // endDate validation
  // -----------------------------------------------------------

  it('should reject missing endDate', () => {
    const result = ShiftAssignmentsQuerySchema.safeParse({
      startDate: '2026-03-01',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid endDate format', () => {
    const result = ShiftAssignmentsQuerySchema.safeParse({
      startDate: '2026-03-01',
      endDate: 'not-a-date',
    });
    expect(result.success).toBe(false);
  });

  // -----------------------------------------------------------
  // Date range refinement
  // -----------------------------------------------------------

  it('should reject endDate before startDate', () => {
    const result = ShiftAssignmentsQuerySchema.safeParse({
      startDate: '2026-03-31',
      endDate: '2026-03-01',
    });
    expect(result.success).toBe(false);
    expect(
      (result as { success: false; error: { issues: { path: string[] }[] } })
        .error.issues[0]?.path,
    ).toContain('endDate');
  });

  it('should reject range exceeding 3650 days', () => {
    const result = ShiftAssignmentsQuerySchema.safeParse({
      startDate: '2026-01-01',
      endDate: '2037-01-01',
    });
    expect(result.success).toBe(false);
  });
});
