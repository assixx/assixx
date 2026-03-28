/**
 * DTO validation tests for TPM Execution schemas
 *
 * Tests: CreateExecutionSchema + CompleteCardSchema field validation,
 * participantUuids constraints, defaults, edge cases.
 * Pattern: ADR-018 Phase 8 — Zod .safeParse() + .parse() assertions.
 */
import { describe, expect, it } from 'vitest';

import { CompleteCardSchema } from './complete-card.dto.js';
import { CreateExecutionSchema } from './create-execution.dto.js';

// =============================================================
// CreateExecutionSchema
// =============================================================

describe('CreateExecutionSchema', () => {
  const valid = {
    cardUuid: '019c9088-c3da-751f-ad4f-06ef7c086342',
  };

  // -----------------------------------------------------------
  // Happy path
  // -----------------------------------------------------------

  it('should accept minimal valid payload (just cardUuid)', () => {
    expect(CreateExecutionSchema.safeParse(valid).success).toBe(true);
  });

  it('should accept full payload with all optional fields', () => {
    const result = CreateExecutionSchema.safeParse({
      ...valid,
      executionDate: '2026-03-01',
      noIssuesFound: true,
      actualDurationMinutes: 45,
      actualStaffCount: 3,
      documentation: 'Alles geprüft',
      customData: { key: 'value' },
      participantUuids: [
        '019c9088-c3da-751f-ad4f-06ef7c086343',
        '019c9088-c3da-751f-ad4f-06ef7c086344',
      ],
    });
    expect(result.success).toBe(true);
  });

  // -----------------------------------------------------------
  // cardUuid
  // -----------------------------------------------------------

  it('should reject missing cardUuid', () => {
    expect(CreateExecutionSchema.safeParse({}).success).toBe(false);
  });

  it('should reject invalid cardUuid format', () => {
    expect(CreateExecutionSchema.safeParse({ cardUuid: 'not-a-uuid' }).success).toBe(false);
  });

  // -----------------------------------------------------------
  // executionDate
  // -----------------------------------------------------------

  it('should accept valid executionDate', () => {
    expect(CreateExecutionSchema.safeParse({ ...valid, executionDate: '2026-02-25' }).success).toBe(
      true,
    );
  });

  it('should reject invalid executionDate', () => {
    expect(CreateExecutionSchema.safeParse({ ...valid, executionDate: '25-02-2026' }).success).toBe(
      false,
    );
  });

  // -----------------------------------------------------------
  // Defaults
  // -----------------------------------------------------------

  it('should default noIssuesFound to false', () => {
    const data = CreateExecutionSchema.parse(valid);
    expect(data.noIssuesFound).toBe(false);
  });

  it('should default customData to empty object', () => {
    const data = CreateExecutionSchema.parse(valid);
    expect(data.customData).toEqual({});
  });

  it('should default participantUuids to empty array', () => {
    const data = CreateExecutionSchema.parse(valid);
    expect(data.participantUuids).toEqual([]);
  });

  // -----------------------------------------------------------
  // participantUuids
  // -----------------------------------------------------------

  it('should accept empty participantUuids array', () => {
    expect(CreateExecutionSchema.safeParse({ ...valid, participantUuids: [] }).success).toBe(true);
  });

  it('should accept 10 valid UUIDs (max)', () => {
    const uuids = Array.from({ length: 10 }, (_, i) => `019c9088-c3da-751f-ad4f-06ef7c08634${i}`);
    expect(CreateExecutionSchema.safeParse({ ...valid, participantUuids: uuids }).success).toBe(
      true,
    );
  });

  it('should reject 11 UUIDs (over max)', () => {
    const uuids = Array.from(
      { length: 11 },
      (_, i) => `019c9088-c3da-751f-ad4f-06ef7c0863${String(i).padStart(2, '0')}`,
    );
    expect(CreateExecutionSchema.safeParse({ ...valid, participantUuids: uuids }).success).toBe(
      false,
    );
  });

  it('should reject invalid UUID in participantUuids array', () => {
    expect(
      CreateExecutionSchema.safeParse({
        ...valid,
        participantUuids: ['not-a-uuid'],
      }).success,
    ).toBe(false);
  });

  // -----------------------------------------------------------
  // actualDurationMinutes
  // -----------------------------------------------------------

  it('should accept actualDurationMinutes=1 (minimum)', () => {
    expect(CreateExecutionSchema.safeParse({ ...valid, actualDurationMinutes: 1 }).success).toBe(
      true,
    );
  });

  it('should accept actualDurationMinutes=1440 (maximum)', () => {
    expect(CreateExecutionSchema.safeParse({ ...valid, actualDurationMinutes: 1440 }).success).toBe(
      true,
    );
  });

  it('should reject actualDurationMinutes=0', () => {
    expect(CreateExecutionSchema.safeParse({ ...valid, actualDurationMinutes: 0 }).success).toBe(
      false,
    );
  });

  it('should reject actualDurationMinutes=1441 (over max)', () => {
    expect(CreateExecutionSchema.safeParse({ ...valid, actualDurationMinutes: 1441 }).success).toBe(
      false,
    );
  });

  it('should reject non-integer actualDurationMinutes', () => {
    expect(CreateExecutionSchema.safeParse({ ...valid, actualDurationMinutes: 30.5 }).success).toBe(
      false,
    );
  });

  // -----------------------------------------------------------
  // actualStaffCount
  // -----------------------------------------------------------

  it('should accept actualStaffCount=1 (minimum)', () => {
    expect(CreateExecutionSchema.safeParse({ ...valid, actualStaffCount: 1 }).success).toBe(true);
  });

  it('should accept actualStaffCount=50 (maximum)', () => {
    expect(CreateExecutionSchema.safeParse({ ...valid, actualStaffCount: 50 }).success).toBe(true);
  });

  it('should reject actualStaffCount=0', () => {
    expect(CreateExecutionSchema.safeParse({ ...valid, actualStaffCount: 0 }).success).toBe(false);
  });

  it('should reject actualStaffCount=51 (over max)', () => {
    expect(CreateExecutionSchema.safeParse({ ...valid, actualStaffCount: 51 }).success).toBe(false);
  });

  // -----------------------------------------------------------
  // documentation
  // -----------------------------------------------------------

  it('should accept documentation up to 10000 characters', () => {
    expect(
      CreateExecutionSchema.safeParse({
        ...valid,
        documentation: 'X'.repeat(10_000),
      }).success,
    ).toBe(true);
  });

  it('should reject documentation over 10000 characters', () => {
    expect(
      CreateExecutionSchema.safeParse({
        ...valid,
        documentation: 'X'.repeat(10_001),
      }).success,
    ).toBe(false);
  });

  it('should trim documentation whitespace', () => {
    const data = CreateExecutionSchema.parse({
      ...valid,
      documentation: '  Trimmed  ',
    });
    expect(data.documentation).toBe('Trimmed');
  });

  it('should accept null documentation', () => {
    expect(CreateExecutionSchema.safeParse({ ...valid, documentation: null }).success).toBe(true);
  });
});

// =============================================================
// CompleteCardSchema
// =============================================================

describe('CompleteCardSchema', () => {
  // -----------------------------------------------------------
  // Happy path
  // -----------------------------------------------------------

  it('should accept empty payload (all fields optional)', () => {
    expect(CompleteCardSchema.safeParse({}).success).toBe(true);
  });

  it('should accept full payload with participantUuids', () => {
    const result = CompleteCardSchema.safeParse({
      executionDate: '2026-03-01',
      noIssuesFound: true,
      actualDurationMinutes: 30,
      actualStaffCount: 2,
      documentation: 'Bericht',
      customData: {},
      participantUuids: ['019c9088-c3da-751f-ad4f-06ef7c086342'],
    });
    expect(result.success).toBe(true);
  });

  // -----------------------------------------------------------
  // Defaults
  // -----------------------------------------------------------

  it('should leave participantUuids undefined when not provided', () => {
    const data = CompleteCardSchema.parse({});
    expect(data.participantUuids).toBeUndefined();
  });

  it('should default noIssuesFound to false', () => {
    const data = CompleteCardSchema.parse({});
    expect(data.noIssuesFound).toBe(false);
  });

  it('should default customData to empty object', () => {
    const data = CompleteCardSchema.parse({});
    expect(data.customData).toEqual({});
  });

  // -----------------------------------------------------------
  // participantUuids
  // -----------------------------------------------------------

  it('should accept 10 participant UUIDs (max)', () => {
    const uuids = Array.from({ length: 10 }, (_, i) => `019c9088-c3da-751f-ad4f-06ef7c08634${i}`);
    expect(CompleteCardSchema.safeParse({ participantUuids: uuids }).success).toBe(true);
  });

  it('should reject 11 participant UUIDs (over max)', () => {
    const uuids = Array.from(
      { length: 11 },
      (_, i) => `019c9088-c3da-751f-ad4f-06ef7c0863${String(i).padStart(2, '0')}`,
    );
    expect(CompleteCardSchema.safeParse({ participantUuids: uuids }).success).toBe(false);
  });

  it('should reject invalid UUID in participantUuids', () => {
    expect(CompleteCardSchema.safeParse({ participantUuids: ['invalid'] }).success).toBe(false);
  });

  // -----------------------------------------------------------
  // Field constraints (same ranges as CreateExecutionSchema)
  // -----------------------------------------------------------

  it('should reject actualDurationMinutes=0', () => {
    expect(CompleteCardSchema.safeParse({ actualDurationMinutes: 0 }).success).toBe(false);
  });

  it('should reject actualStaffCount=51', () => {
    expect(CompleteCardSchema.safeParse({ actualStaffCount: 51 }).success).toBe(false);
  });

  it('should reject documentation over 10000 characters', () => {
    expect(CompleteCardSchema.safeParse({ documentation: 'X'.repeat(10_001) }).success).toBe(false);
  });
});
