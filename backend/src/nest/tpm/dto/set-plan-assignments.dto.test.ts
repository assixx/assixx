/**
 * DTO validation tests for SetPlanAssignmentsSchema
 *
 * Tests: userIds array validation, scheduledDate format, edge cases.
 * Pattern: ADR-018 Phase 8 — Zod .safeParse() assertions.
 */
import { describe, expect, it } from 'vitest';

import { SetPlanAssignmentsSchema } from './set-plan-assignments.dto.js';

// =============================================================
// SetPlanAssignmentsSchema
// =============================================================

describe('SetPlanAssignmentsSchema', () => {
  const valid = {
    userIds: [1, 2, 3],
    scheduledDate: '2026-03-15',
  };

  // -----------------------------------------------------------
  // Happy path
  // -----------------------------------------------------------

  it('should accept valid assignment data', () => {
    expect(SetPlanAssignmentsSchema.safeParse(valid).success).toBe(true);
  });

  it('should accept empty userIds array (remove all)', () => {
    expect(
      SetPlanAssignmentsSchema.safeParse({ ...valid, userIds: [] }).success,
    ).toBe(true);
  });

  it('should accept single userId', () => {
    expect(
      SetPlanAssignmentsSchema.safeParse({ ...valid, userIds: [42] }).success,
    ).toBe(true);
  });

  // -----------------------------------------------------------
  // userIds validation
  // -----------------------------------------------------------

  it('should reject missing userIds', () => {
    expect(
      SetPlanAssignmentsSchema.safeParse({ scheduledDate: '2026-03-15' })
        .success,
    ).toBe(false);
  });

  it('should reject non-array userIds', () => {
    expect(
      SetPlanAssignmentsSchema.safeParse({ ...valid, userIds: 42 }).success,
    ).toBe(false);
  });

  it('should reject non-integer userIds', () => {
    expect(
      SetPlanAssignmentsSchema.safeParse({ ...valid, userIds: [1.5] }).success,
    ).toBe(false);
  });

  it('should reject negative userIds', () => {
    expect(
      SetPlanAssignmentsSchema.safeParse({ ...valid, userIds: [-1] }).success,
    ).toBe(false);
  });

  it('should reject zero userId', () => {
    expect(
      SetPlanAssignmentsSchema.safeParse({ ...valid, userIds: [0] }).success,
    ).toBe(false);
  });

  it('should reject more than 50 userIds', () => {
    const tooMany = Array.from(
      { length: 51 },
      (_: unknown, i: number) => i + 1,
    );
    expect(
      SetPlanAssignmentsSchema.safeParse({ ...valid, userIds: tooMany })
        .success,
    ).toBe(false);
  });

  it('should accept exactly 50 userIds', () => {
    const max = Array.from({ length: 50 }, (_: unknown, i: number) => i + 1);
    expect(
      SetPlanAssignmentsSchema.safeParse({ ...valid, userIds: max }).success,
    ).toBe(true);
  });

  // -----------------------------------------------------------
  // scheduledDate validation
  // -----------------------------------------------------------

  it('should reject missing scheduledDate', () => {
    expect(SetPlanAssignmentsSchema.safeParse({ userIds: [1] }).success).toBe(
      false,
    );
  });

  it('should reject invalid date format (DD-MM-YYYY)', () => {
    expect(
      SetPlanAssignmentsSchema.safeParse({
        ...valid,
        scheduledDate: '15-03-2026',
      }).success,
    ).toBe(false);
  });

  it('should reject date with time component', () => {
    expect(
      SetPlanAssignmentsSchema.safeParse({
        ...valid,
        scheduledDate: '2026-03-15T00:00:00',
      }).success,
    ).toBe(false);
  });

  it('should reject non-string scheduledDate', () => {
    expect(
      SetPlanAssignmentsSchema.safeParse({
        ...valid,
        scheduledDate: 20260315,
      }).success,
    ).toBe(false);
  });

  it('should reject date with invalid separators', () => {
    expect(
      SetPlanAssignmentsSchema.safeParse({
        ...valid,
        scheduledDate: '2026/03/15',
      }).success,
    ).toBe(false);
  });
});
